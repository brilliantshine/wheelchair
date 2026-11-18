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
  assert.deepEqual(await hub.withThread(id, () => ops.createLocked(hub, { file, machine: 'hub', project: '/repo' })), { outcome: 'created', id });
  assert.equal(started, false); await hub.restartLead(id);
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

test('each kind retries failed steps without creating a second claim', async () => {
  const { makeTemp } = require('../../test-support/run-dir.js');
  const { Hub } = require('../app/hub.js');
  for (const kind of ['create', 'advance', 'undo']) for (const failure of ['claim-push', 'running', 'set-branch', 'reopen']) {
    const hub = new Hub({ stateDir: await makeTemp('handoff-matrix-') }); await hub.state.init();
    const op = ops.operation(kind, parent, kind === 'undo' ? null : { stage: 'approved', exported_at: 'date', history: [] });
    await hub.save({ id, machine: 'hub', project: '/repo', slug: 'plan', sessions: [], cards: [], pinned: {}, handoff_op: op });
    let failed = false, commits = 0, starts = 0;
    hub.client.handoff = async (_, input) => {
      if (input.action === 'claim-commit') { commits++; return { sha }; }
      if (input.action === failure && !failed) { failed = true; return input.action === 'claim-push' ? { result: 'unknown', error: 'injected' } : { result: 'failed', error: 'injected' }; }
      return ({ inspect: { worktree_exists: false }, known: { checked_out: [] }, 'claim-push': { result: 'landed' }, running: { names: [] }, 'set-branch': { result: 'ok' }, reopen: { ok: true } })[input.action];
    };
    hub.restartLead = async () => { starts++; };
    await assert.rejects(ops.runOperation(hub, id), /injected/);
    assert.equal(starts, 0, `${kind}/${failure}`);
    const pending = await hub.thread(id); assert.equal(pending.handoff_op.last_error.includes('injected'), true);
    await ops.runOperation(hub, id);
    const done = await hub.thread(id); assert.equal(done.handoff_op, undefined); assert.equal(done.checkout_sha, sha); assert.equal(commits, 1); assert.equal(starts, 1);
  }
});

test('own cancelled claim schedules a revoke after releasing the thread lock', async () => {
  const { makeTemp } = require('../../test-support/run-dir.js');
  const { Hub } = require('../app/hub.js');
  const hub = new Hub({ stateDir: await makeTemp('handoff-own-') }); await hub.state.init();
  const cancelled = 'c'.repeat(40), op = ops.operation('undo', parent, null);
  await hub.save({ id, machine: 'hub', project: '/repo', slug: 'plan', sessions: [], handoff_op: op });
  await ops.writeRevokes(hub, [{ thread_id: id, machine: 'hub', project: '/repo', branch: `wc/${id}`, parent, sha: cancelled, until: new Date(Date.now() + 100000).toISOString() }]);
  let revoked; const completion = new Promise((resolve) => { revoked = resolve; });
  hub.client.handoff = async (_, input) => {
    if (input.action === 'claim-revoke') { revoked(); return { result: 'revoked' }; }
    return ({ inspect: { worktree_exists: false }, known: { checked_out: [] }, 'claim-commit': { sha }, 'claim-push': { result: 'moved', remote_tip: cancelled } })[input.action];
  };
  await assert.rejects(ops.runOperation(hub, id), /still being taken back/);
  await Promise.race([completion, new Promise((_, reject) => setTimeout(() => reject(new Error('revoke deadlocked')), 1000))]);
  assert.match((await hub.thread(id)).handoff_op.last_error, /still being taken back/);
});

test('revocation writes for different threads are serialized and an operation wins', async () => {
  const { makeTemp } = require('../../test-support/run-dir.js');
  const { Hub } = require('../app/hub.js');
  const hub = new Hub({ stateDir: await makeTemp('handoff-lock-') }); await hub.state.init();
  const other = 'abcdef123457';
  for (const threadId of [id, other]) { const op = ops.operation('undo', parent, null); op.claim_sha = sha; await hub.save({ id: threadId, machine: 'hub', project: '/repo', sessions: [], handoff_op: op }); }
  await Promise.all([ops.cancel(hub, id), ops.cancel(hub, other)]);
  let entries = await ops.revokes(hub); assert.equal(entries.length, 2);
  const thread = await hub.thread(id); thread.handoff_op = ops.operation('undo', parent, null); thread.handoff_op.claim_sha = sha; await hub.save(thread);
  hub.client.handoff = async () => ({ result: 'waiting' });
  await ops.sweep(hub); entries = await ops.revokes(hub); assert.deepEqual(entries.map((entry) => entry.thread_id), [other]);
});

test('stop accepts an unknown managed session and refuses surviving tmux sessions', async () => {
  const { makeTemp } = require('../../test-support/run-dir.js');
  const { Hub } = require('../app/hub.js');
  const hub = new Hub({ stateDir: await makeTemp('handoff-stop-') }); await hub.state.init();
  const op = ops.operation('undo', parent, null); op.claim_sha = sha; op.claim_landed = true;
  await hub.save({ id, machine: 'hub', project: '/repo', slug: 'plan', sessions: [{ name: `wc-${id}-lead`, live: true, status: 'running' }], cards: [], pinned: {}, handoff_op: op });
  hub.call = async () => { const e = new Error('unknown managed session'); e.status = 404; throw e; };
  let left = true;
  hub.client.handoff = async (_, input) => ({ running: { names: left ? [`wc-${id}-lead`] : [] }, kill: { names: left ? [`wc-${id}-lead`] : [] }, inspect: { worktree_exists: false }, 'set-branch': { result: 'ok' }, reopen: { ok: true } })[input.action];
  hub.restartLead = async () => {};
  await assert.rejects(ops.runOperation(hub, id), /Couldn't stop the agent working here/);
  assert.equal((await hub.thread(id)).sessions[0].live, false);
  left = false; await ops.runOperation(hub, id);
  assert.equal((await hub.thread(id)).checkout_sha, sha);
});

test('undo and cancel routes enforce saved operation and frozen archive', async () => {
  const { setup, close, api } = require('./helpers/app.js');
  const { Hub } = require('../app/hub.js');
  const c = await setup();
  try {
    const hub = new Hub({ stateDir: c.state });
    const thread = { id, machine: 'hub', project: '/repo', slug: 'plan', branch: `wc/${id}`, title: 'test', sessions: [], cards: [], asides: [], pinned: {}, queues: {}, sent: [], handed_off: { head: parent, at: '2026-11-17T12:00:00Z' }, archived: true };
    await hub.save(thread);
    c.machine.handoffReplies.inspect = { worktree_exists: false };
    c.machine.handoffReplies.known = { checked_out: [] };
    c.machine.handoffReplies['claim-commit'] = { sha };
    c.machine.handoffReplies['claim-push'] = { result: 'unknown', error: 'network' };
    let response = await api(c, `/threads/${id}/undo-handoff`, { method: 'POST' });
    assert.equal(response.status, 409); assert.match(response.body.detail, /network/);
    response = await api(c, `/threads/${id}/handoff`); assert.equal(response.body.state, 'undo-unfinished');
    response = await api(c, `/threads/${id}/archive`, { method: 'POST' }); assert.equal(response.status, 409);
    response = await api(c, `/threads/${id}/cancel-handoff`, { method: 'POST' }); assert.equal(response.status, 200);
    assert.equal((await ops.revokes(hub))[0].sha, sha); assert.equal((await hub.thread(id)).handoff_op, undefined);
  } finally { await close(c); }
});

test('lost push response saves the claim and retries without another commit', async () => {
  const { makeTemp } = require('../../test-support/run-dir.js'); const { Hub } = require('../app/hub.js');
  const hub = new Hub({ stateDir: await makeTemp('handoff-lost-') }); await hub.state.init();
  await hub.save({ id, machine: 'hub', project: '/repo', slug: 'plan', sessions: [], cards: [], pinned: {}, handoff_op: ops.operation('undo', parent, null) });
  let pushes = 0, commits = 0;
  hub.client.handoff = async (_, input) => {
    if (input.action === 'claim-commit') { commits++; return { sha }; }
    if (input.action === 'claim-push' && !pushes++) throw new Error('timeout');
    return ({ inspect: { worktree_exists: false, repository: 'github.com/o/r' }, known: { checked_out: [] }, 'claim-push': { result: 'landed' }, running: { names: [] }, 'set-branch': { result: 'ok' }, reopen: { ok: true } })[input.action];
  }; hub.restartLead = async () => {};
  await assert.rejects(ops.runOperation(hub, id), /timeout/);
  const saved = await hub.thread(id); assert.equal(saved.handoff_op.claim_sha, sha); assert.match(saved.handoff_op.last_error, /timeout/); assert.equal(saved.handoff_op.repository, 'github.com/o/r');
  await ops.runOperation(hub, id); assert.equal(commits, 1);
});

test('moved claim abandons each kind and uses re-import wording', async () => {
  const { makeTemp } = require('../../test-support/run-dir.js'); const { Hub } = require('../app/hub.js');
  for (const kind of ['create', 'advance', 'undo']) {
    const hub = new Hub({ stateDir: await makeTemp('handoff-abandon-') }); await hub.state.init();
    await hub.save({ id, machine: 'hub', project: '/repo', slug: 'plan', sessions: [], cards: [], pinned: {}, handoff_op: ops.operation(kind, parent, null), handed_off: { head: parent } });
    hub.client.handoff = async (_, input) => ({ inspect: { worktree_exists: false }, known: { checked_out: [] }, 'claim-commit': { sha }, 'claim-push': { result: 'moved', remote_tip: 'c'.repeat(40), picked_up_at: '2026-01-01' } })[input.action];
    await assert.rejects(ops.runOperation(hub, id, { reimport: true }), kind === 'undo' ? /picked up elsewhere on 2026-01-01/ : /import that file again/);
    if (kind === 'create') await assert.rejects(hub.thread(id), { status: 404 });
    else { const thread = await hub.thread(id); assert.equal(thread.handoff_op, undefined); assert.equal(thread.handed_off.head, parent); }
  }
});

test('checkout failure is saved and reopen is called on open threads', async () => {
  const { makeTemp } = require('../../test-support/run-dir.js'); const { Hub } = require('../app/hub.js');
  const hub = new Hub({ stateDir: await makeTemp('handoff-checkout-') }); await hub.state.init();
  const op = ops.operation('undo', parent, null); op.claim_sha = sha; op.claim_landed = true;
  await hub.save({ id, machine: 'hub', project: '/repo', worktree: '/work', slug: 'plan', sessions: [], cards: [], pinned: {}, archived: false, handoff_op: op });
  let fails = true, reopened = 0;
  hub.client.handoff = async (_, input) => {
    if (input.action === 'fast-forward') return fails ? { result: 'failed', error: 'HEAD past claim' } : { result: 'ok' };
    if (input.action === 'reopen') { reopened++; return { ok: true }; }
    return ({ running: { names: [] }, inspect: { worktree_exists: true } })[input.action];
  }; hub.restartLead = async () => {};
  await assert.rejects(ops.runOperation(hub, id), /HEAD past claim/); assert.match((await hub.thread(id)).handoff_op.last_error, /HEAD past claim/);
  fails = false; await ops.runOperation(hub, id); assert.equal(reopened, 1);
});

test('revoke expiry, machine exceptions, repeated revocation, and dismissal', async () => {
  const { makeTemp } = require('../../test-support/run-dir.js'); const { Hub } = require('../app/hub.js');
  const hub = new Hub({ stateDir: await makeTemp('handoff-expiry-') }); await hub.state.init();
  const entry = { thread_id: id, project: '/repo', machine: 'hub', repository: 'github.com/o/r', branch: `wc/${id}`, parent, sha, until: new Date(Date.now() + 100000).toISOString() };
  await ops.writeRevokes(hub, [entry]); let calls = 0;
  hub.client.handoff = async () => { calls++; return { result: 'revoked' }; };
  await ops.sweep(hub); let [saved] = await ops.revokes(hub); assert.ok(Date.parse(saved.until) > Date.now() + 80000000);
  await ops.sweep(hub); assert.equal(calls, 2);
  hub.client.handoff = async () => { throw new Error('offline'); }; await ops.sweep(hub);
  [saved] = await ops.revokes(hub); assert.equal(saved.last_result, 'waiting'); assert.equal(saved.error, 'offline');
  await ops.dismiss(hub, saved); assert.equal((await ops.revokes(hub)).length, 1);
  saved.until = new Date(0).toISOString(); await ops.writeRevokes(hub, [saved]); await ops.sweep(hub); assert.equal((await ops.revokes(hub)).length, 0);
  entry.until = new Date(0).toISOString(); entry.last_result = 'failed'; entry.error = 'lease'; await ops.writeRevokes(hub, [entry]);
  hub.client.handoff = async () => ({ result: 'failed', error: 'lease' }); await ops.sweep(hub); assert.equal((await ops.revokes(hub)).length, 1);
  await ops.dismiss(hub, entry); assert.equal((await ops.revokes(hub)).length, 0);
});

test('faults at every operation step converge to the uninterrupted record', async () => {
  const { makeTemp } = require('../../test-support/run-dir.js'); const { Hub } = require('../app/hub.js');
  async function run(kind, failure) {
    const hub = new Hub({ stateDir: await makeTemp('handoff-converge-') }); await hub.state.init();
    const op = ops.operation(kind, parent, kind === 'undo' ? null : { stage: 'approved', exported_at: 'date', history: [], repository: 'github.com/o/r' }); op.started_at = '2026-01-01T00:00:00.000Z';
    await hub.save({ id, machine: 'hub', project: '/repo', slug: 'plan', sessions: [], cards: [], pinned: {}, handoff_op: op });
    let failed = false, commits = 0, starts = 0, calls = 0;
    hub.client.handoff = async (_, input) => {
      if (input.action === 'claim-commit') { commits++; return { sha }; }
      if (input.action === 'running' && failure === 'kill' && !failed) return { names: [`wc-${id}-lead`] };
      if (input.action === failure && !failed) { failed = true; return input.action === 'claim-push' ? { result: 'unknown', error: 'fault' } : { result: 'failed', error: 'fault' }; }
      return ({ inspect: { worktree_exists: false }, known: { checked_out: [] }, 'claim-push': { result: 'landed' }, running: { names: [] }, 'set-branch': { result: 'ok' }, reopen: { ok: true } })[input.action];
    };
    const save = hub.save.bind(hub);
    hub.save = async (thread) => { if (failure === 'done' && !failed && !thread.handoff_op) { failed = true; throw new Error('fault'); } return save(thread); };
    hub.restartLead = async () => { starts++; assert.equal((await hub.thread(id)).handoff_op, undefined); };
    if (failure) { await assert.rejects(ops.runOperation(hub, id), /fault/); assert.equal(starts, 0); }
    await ops.runOperation(hub, id); const result = await hub.thread(id); delete result.updated_at; assert.equal(commits, 1); assert.equal(starts, 1); return result;
  }
  for (const kind of ['create', 'advance', 'undo']) {
    const baseline = await run(kind, null);
    for (const failure of ['claim-push', 'running', 'kill', 'set-branch', 'reopen', 'done']) assert.deepEqual(await run(kind, failure), baseline, `${kind}/${failure}`);
  }
});

test('undo retry and cancellation routes report moved claims and enforce claim boundary', async () => {
  const { setup, close, api } = require('./helpers/app.js'); const { Hub } = require('../app/hub.js'); const c = await setup();
  try {
    const hub = new Hub({ stateDir: c.state });
    const thread = { id, machine: 'hub', project: '/repo', slug: 'plan', branch: `wc/${id}`, title: 'test', sessions: [], cards: [], asides: [], pinned: {}, queues: {}, sent: [], handed_off: { head: parent, at: '2026-11-17T12:00:00Z' }, archived: true };
    await hub.save(thread);
    Object.assign(c.machine.handoffReplies, { inspect: { worktree_exists: false, repository: 'github.com/o/r' }, known: { checked_out: [] }, 'claim-commit': { sha }, 'claim-push': { result: 'moved', remote_tip: 'c'.repeat(40), picked_up_at: '2026-01-01' } });
    let r = await api(c, `/threads/${id}/undo-handoff`, { method: 'POST' }); assert.equal(r.status, 409); assert.match(r.body.detail, /picked up elsewhere on 2026-01-01/);
    thread.handoff_op = ops.operation('undo', parent, null); thread.handoff_op.claim_sha = sha; thread.handoff_op.claim_landed = true; await hub.save(thread);
    r = await api(c, `/threads/${id}/cancel-handoff`, { method: 'POST' }); assert.equal(r.status, 409);
    Object.assign(c.machine.handoffReplies, { running: { names: [] }, 'set-branch': { result: 'ok' }, reopen: { ok: true } });
    r = await api(c, `/threads/${id}/undo-handoff`, { method: 'POST' }); assert.equal(r.status, 200); assert.equal(r.body.outcome, 'undone');
    thread.handoff_op = ops.operation('undo', parent, null); thread.handoff_op.claim_sha = sha; thread.handoff_op.claim_landed = true; await hub.save(thread);
    r = await api(c, `/threads/${id}/retry-handoff`, { method: 'POST' }); assert.equal(r.status, 200);
    thread.handoff_op = ops.operation('undo', parent, null); thread.handoff_op.claim_sha = sha; thread.handoff_op.repository = 'github.com/o/r'; await hub.save(thread);
    r = await api(c, `/threads/${id}/cancel-handoff`, { method: 'POST' }); assert.equal(r.status, 200); assert.equal((await ops.revokes(hub))[0].repository, 'github.com/o/r');
  } finally { await close(c); }
});

test('failed revoke notice uses repository and survives handoff file sweep', async () => {
  const { setup, close, api } = require('./helpers/app.js'); const { Hub } = require('../app/hub.js'); const handoff = require('../app/handoff.js'); const c = await setup();
  try {
    const hub = new Hub({ stateDir: c.state }); const entry = { thread_id: id, project: '/repo', machine: 'hub', repository: 'github.com/o/r', branch: `wc/${id}`, parent, sha, until: new Date(0).toISOString(), last_result: 'failed', error: 'lease' };
    await ops.writeRevokes(hub, [entry]); await handoff.sweepFiles(hub); assert.equal((await ops.revokes(hub)).length, 1);
    let r = await api(c, '/threads?view=list'); assert.match(r.body.revoke_notices[0].text, /github.com\/o\/r wc\/abcdef123456: lease/);
    r = await api(c, '/handoff-revokes/dismiss', { method: 'POST', body: { thread_id: id, sha } }); assert.equal(r.status, 200); assert.deepEqual(await ops.revokes(hub), []);
  } finally { await close(c); }
});
