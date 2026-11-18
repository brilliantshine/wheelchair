'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { importHandoff } = require('../app/handoff-import.js');
const file = { format: 'wheelchair-handoff', version: 1, exported_at: '2026-01-01T00:00:00Z', thread: { id: '0123456789ab', title: 'Title', slug: 'title' }, repository: 'github.com/a/b', branch: 'wc/0123456789ab', head: 'a'.repeat(40), stage: 'approved', history: [] };
function fixture(thread, inspect = {}) {
  const calls = [];
  const hub = { state: { machine: async () => {}, addProject: async () => {} }, call: async () => ({ checked: { ok: true, path: '/project' } }), withThread: async (_, fn) => fn(), thread: async () => { if (!thread) { const e = new Error(); e.status = 404; throw e; } return thread; }, client: { handoff: async (machine, body) => { calls.push({ machine, ...body }); return { repository: 'github.com/a/b', remote_has_branch: true, remote_contains_head: true, remote_tip: file.head, plan_status: 'approved', relation: 'same', ...inspect }; } } };
  return { hub, calls };
}
test('validates input before inspecting and reports invalid JSON', async () => {
  const { hub, calls } = fixture();
  await assert.rejects(importHandoff(hub, Buffer.from('{'), 'hub', '/project'), { status: 422 });
  assert.equal(calls.length, 0);
});
test('opens an existing thread on its own machine and project', async () => {
  const { hub, calls } = fixture({ id: file.thread.id, machine: 'other', project: '/else' });
  const result = await importHandoff(hub, Buffer.from(JSON.stringify(file)), 'hub', '/project');
  assert.equal(result.outcome, 'opened'); assert.match(result.note, /^This thread lives on other, \/else/); assert.equal(calls[0].machine, 'other');
});
test('rejects a mismatched repository and missing branch', async () => {
  for (const inspect of [{ repository: 'github.com/a/c' }, { remote_has_branch: false }]) {
    const { hub } = fixture(null, inspect);
    await assert.rejects(importHandoff(hub, Buffer.from(JSON.stringify(file)), 'hub', '/project'));
  }
});

test('saved undo opens without inspecting or running it', async () => {
  const thread = { id: file.thread.id, machine: 'hub', project: '/project', handoff_op: { kind: 'undo' } };
  const { hub, calls } = fixture(thread);
  const result = await importHandoff(hub, Buffer.from(JSON.stringify(file)), 'hub', '/project');
  assert.match(result.note, /undo.*didn't finish/); assert.equal(thread.handoff_op.kind, 'undo'); assert.equal(calls.length, 0);
});
test('checks the file stage at the exported head', async () => {
  for (const [stage, inspect] of [['approved', { plan_status: 'planning' }], ['idea-confirmed', { idea_status: 'confirmed', map_committed: false, plan_status: null }]]) {
    const { hub } = fixture(null, inspect);
    await assert.rejects(importHandoff(hub, Buffer.from(JSON.stringify({ ...file, stage })), 'hub', '/project'), { status: 422 });
  }
});
test('opens older and diverged files without changing the thread', async () => {
  for (const [relation, text] of [['behind', /older/], ['diverged', /separately/]]) {
    const thread = { id: file.thread.id, machine: 'hub', project: '/project' };
    const { hub } = fixture(thread, { relation });
    const result = await importHandoff(hub, Buffer.from(JSON.stringify(file)), 'hub', '/project');
    assert.equal(result.outcome, 'opened'); assert.match(result.note, text);
  }
});
test('refuses advancing a busy thread', async () => {
  const thread = { id: file.thread.id, machine: 'hub', project: '/project', sessions: [{ role: 'worker', live: true }] };
  const { hub } = fixture(thread, { relation: 'ahead' });
  await assert.rejects(importHandoff(hub, Buffer.from(JSON.stringify(file)), 'hub', '/project'), { status: 409, message: 'The thread here is busy' });
});
test('refuses an advanced remote tip', async () => {
  const thread = { id: file.thread.id, machine: 'hub', project: '/project' };
  const { hub } = fixture(thread, { relation: 'ahead', remote_tip: 'b'.repeat(40), picked_up_at: 'today' });
  await assert.rejects(importHandoff(hub, Buffer.from(JSON.stringify(file)), 'hub', '/project'), { status: 409, message: /picked up elsewhere on today/ });
});
