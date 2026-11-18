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
