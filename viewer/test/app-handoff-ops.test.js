'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ops = require('../app/handoff-ops.js');
const id = 'abcdef123456';
const parent = 'a'.repeat(40);
const sha = 'b'.repeat(40);
function fixture(replies = {}) {
  const calls = [], saves = [];
  const thread = { id, machine: 'hub', project: '/repo', slug: 'plan', sessions: [], cards: [], pinned: {}, handoff_op: ops.operation('advance', parent, { stage: 'approved', exported_at: 'date', history: [] }) };
  const hub = { client: { handoff: async (_, input) => { calls.push(input); const value = replies[input.action]; return typeof value === 'function' ? value(input) : value || ({ inspect: { worktree_exists: false }, known: { checked_out: [], local_branch: false }, 'claim-commit': { sha }, 'claim-push': { result: 'landed' } }[input.action]); } }, save: async (value) => saves.push(structuredClone(value)), stateDir: '/nonexistent' };
  return { hub, thread, calls, saves };
}
test('claim persists the commit before pushing and retries the same commit', async () => {
  let pushes = 0;
  const f = fixture({ 'claim-push': () => ++pushes === 1 ? { result: 'unknown', error: 'network' } : { result: 'landed' } });
  await assert.rejects(ops.claim(f.hub, f.thread, false), /network/);
  assert.equal(f.saves[0].handoff_op.claim_sha, sha);
  await ops.claim(f.hub, f.thread, false);
  assert.equal(f.calls.filter((x) => x.action === 'claim-commit').length, 1);
  assert.equal(f.thread.handoff_op.claim_landed, true);
});
test('preclaim refuses unsafe local branches and worktrees', async () => {
  for (const [replies, message] of [
    [{ inspect: { worktree_exists: true, relation: 'same' }, status: { branch: null } }, /isn't on its branch/],
    [{ inspect: { worktree_exists: true, relation: 'same' }, status: { branch: `wc/${id}`, dirty: true } }, /uncommitted/],
    [{ inspect: { worktree_exists: true, relation: 'behind' }, status: { branch: `wc/${id}` } }, /commits that aren't/],
    [{ known: { checked_out: ['/other'] } }, /checked out in \/other/],
    [{ known: { checked_out: [], local_branch: true, local_ancestor: false } }, /differs from the file/],
  ]) {
    const f = fixture(replies); f.thread.worktree = '/work';
    await assert.rejects(ops.claim(f.hub, f.thread, false), message);
    assert.equal(f.calls.some((x) => x.action === 'claim-commit'), false);
  }
});

test('operation applies carried state after reopening, and restarts after completion', async () => {
  const { makeTemp } = require('../../test-support/run-dir.js');
  const { Hub } = require('../app/hub.js');
  const fs = require('node:fs/promises');
  const path = require('node:path');
  const dir = await makeTemp('handoff-ops-');
  const hub = new Hub({ stateDir: dir }); await hub.state.init();
  const file = { thread: { id, title: 'Title', slug: 'plan' }, head: parent, stage: 'approved', exported_at: 'date', history: [] };
  const calls = [];
  hub.client.handoff = async (_, input) => {
    calls.push(input.action);
    return ({ inspect: { worktree_exists: false }, known: { checked_out: [] }, 'claim-commit': { sha }, 'claim-push': { result: 'landed' }, running: { names: [] }, 'set-branch': { result: 'ok' }, reopen: { ok: true } })[input.action];
  };
  let started = false;
  hub.restartLead = async () => { const thread = await hub.thread(id); assert.equal(thread.handoff_op, undefined); started = true; };
  await fs.mkdir(path.join(dir, 'handoffs'));
  await fs.writeFile(path.join(dir, 'handoffs', `${id}.json`), '{}');
  assert.deepEqual(await ops.startCreate(hub, { file, machine: 'hub', project: '/repo' }), { outcome: 'created', id });
  const thread = await hub.thread(id);
  assert.equal(thread.checkout_sha, sha); assert.equal(thread.imported.stage, 'approved'); assert.equal(started, true);
  assert.ok(calls.indexOf('reopen') > calls.indexOf('set-branch'));
  await assert.rejects(fs.stat(path.join(dir, 'handoffs', `${id}.json`)), { code: 'ENOENT' });
});

test('failed reopen preserves operation and retry uses the original imported cutoff', async () => {
  const { makeTemp } = require('../../test-support/run-dir.js');
  const { Hub } = require('../app/hub.js');
  const hub = new Hub({ stateDir: await makeTemp('handoff-retry-') }); await hub.state.init();
  const file = { stage: 'approved', exported_at: 'date', history: [{ text: 'old' }] };
  const op = ops.operation('advance', parent, file);
  const thread = { id, machine: 'hub', project: '/repo', slug: 'plan', handoff_op: op, sessions: [], cards: [{ id: 'a' }], pinned: { question: {} }, handed_off: { head: parent }, archived: true };
  await hub.save(thread);
  let reopen = 0, commits = 0, starts = 0;
  hub.client.handoff = async (_, input) => {
    if (input.action === 'claim-commit') { commits++; return { sha }; }
    if (input.action === 'reopen') return ++reopen === 1 ? { result: 'failed', error: 'reopen failed' } : { ok: true };
    return ({ inspect: { worktree_exists: false }, known: { checked_out: [] }, 'claim-push': { result: 'landed' }, running: { names: [] }, 'set-branch': { result: 'ok' } })[input.action];
  };
  hub.restartLead = async () => { starts++; };
  await assert.rejects(ops.runOperation(hub, id), /reopen failed/);
  let saved = await hub.thread(id); assert.equal(saved.imported, undefined); assert.equal(saved.handed_off.head, parent); assert.equal(starts, 0);
  await ops.runOperation(hub, id);
  saved = await hub.thread(id); assert.equal(saved.imported.at, op.started_at); assert.equal(saved.cards[0].retracted_by, 'import'); assert.deepEqual(saved.pinned, {}); assert.equal(commits, 1); assert.equal(starts, 1);
});

test('cancelled claim is retained after revoke and dismissed only after failure', async () => {
  const { makeTemp } = require('../../test-support/run-dir.js');
  const { Hub } = require('../app/hub.js');
  const hub = new Hub({ stateDir: await makeTemp('handoff-revoke-') }); await hub.state.init();
  const op = ops.operation('undo', parent, null); op.claim_sha = sha;
  await hub.save({ id, machine: 'hub', project: '/repo', sessions: [], handoff_op: op });
  await ops.cancel(hub, id);
  let entries = await ops.revokes(hub); assert.equal(entries.length, 1);
  hub.client.handoff = async () => ({ result: 'revoked' });
  await ops.sweep(hub); entries = await ops.revokes(hub); assert.equal(entries[0].last_result, 'revoked');
  hub.client.handoff = async () => ({ result: 'failed', error: 'lease rejected' });
  await ops.sweep(hub); entries = await ops.revokes(hub); assert.equal(entries[0].error, 'lease rejected');
  await ops.dismiss(hub, { thread_id: id, sha }); assert.deepEqual(await ops.revokes(hub), []);
});
