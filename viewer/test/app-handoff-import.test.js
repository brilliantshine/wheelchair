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
