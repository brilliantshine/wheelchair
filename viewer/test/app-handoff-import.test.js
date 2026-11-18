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

async function operationFixture(overrides = {}) {
  const { Hub } = require('../app/hub.js');
  const { makeTemp } = require('../../test-support/run-dir.js');
  const hub = new Hub({ stateDir: await makeTemp('handoff-import-') });
  await hub.state.init();
  hub.state.machine = async () => ({});
  hub.call = async () => ({ checked: { ok: true, path: '/project' } });
  const calls = [], sha = 'b'.repeat(40);
  let restarts = 0;
  hub.restartLead = async () => { restarts++; await hub.withThread(file.thread.id, async () => assert.equal((await hub.thread(file.thread.id)).handoff_op, undefined)); };
  hub.client.handoff = async (_, input) => {
    calls.push(input);
    const standard = { inspect: { repository: file.repository, remote_has_branch: true, remote_contains_head: true, remote_tip: file.head, plan_status: 'approved', relation: 'same', worktree_exists: false }, known: { known: false, local_branch: false, checked_out: [] }, 'claim-commit': { sha }, 'claim-push': { result: 'landed' }, running: { names: [] }, 'set-branch': { result: 'ok' }, 'fast-forward': { result: 'ok' }, reopen: { result: 'ok' }, status: { branch: file.branch, dirty: false } };
    const reply = overrides[input.action] ?? standard[input.action];
    return typeof reply === 'function' ? reply(input) : reply;
  };
  return { hub, calls, get restarts() { return restarts; }, sha };
}
const bytes = () => Buffer.from(JSON.stringify(file));

test('Create claims in order, persists history, and restarts outside the lock', async () => {
  const f = await operationFixture();
  file.history = [{ at: '2026-01-01T00:00:00Z', who: 'lead', kind: 'message', text: 'history' }];
  try {
    const result = await importHandoff(f.hub, bytes(), 'hub', '/project');
    assert.equal(result.outcome, 'created');
    const thread = await f.hub.thread(file.thread.id);
    assert.deepEqual(thread.imported.history, file.history); assert.equal(f.restarts, 1);
    assert.ok(f.calls.findIndex((c) => c.action === 'claim-commit') < f.calls.findIndex((c) => c.action === 'claim-push'));
  } finally { file.history = []; }
});

test('imports of one ID serialize into Create then Open', async () => {
  const f = await operationFixture();
  const results = await Promise.all([importHandoff(f.hub, bytes(), 'hub', '/project'), importHandoff(f.hub, bytes(), 'hub', '/project')]);
  assert.deepEqual(results.map((r) => r.outcome).sort(), ['created', 'opened']);
  assert.equal(f.calls.filter((c) => c.action === 'claim-commit').length, 1);
});

test('Create refuses occupied machine, checked out and divergent branches', async () => {
  for (const [known, message] of [
    [{ known: true }, /another wheelchair app/],
    [{ known: false, checked_out: ['/else'] }, /checked out in \/else/],
    [{ known: false, checked_out: [], local_branch: true, local_ancestor: false }, /differs from the file/],
  ]) {
    const f = await operationFixture({ known });
    await assert.rejects(importHandoff(f.hub, bytes(), 'hub', '/project'), { status: 409, message });
    await assert.rejects(f.hub.thread(file.thread.id), { status: 404 });
  }
});

test('moved claim abandons the Create record', async () => {
  const f = await operationFixture({ 'claim-push': { result: 'moved', remote_tip: 'c'.repeat(40), picked_up_at: 'today' } });
  await assert.rejects(importHandoff(f.hub, bytes(), 'hub', '/project'), { status: 409, message: /picked up elsewhere/ });
  await assert.rejects(f.hub.thread(file.thread.id), { status: 404 });
});

test('saved Create and Advance validate first and resume without the route inspection', async () => {
  const ops = require('../app/handoff-ops.js');
  for (const kind of ['create', 'advance']) {
    const f = await operationFixture();
    const op = ops.operation(kind, file.head, file); op.claim_landed = true; op.claim_sha = f.sha;
    await f.hub.save({ id: file.thread.id, machine: 'hub', project: '/project', slug: 'title', sessions: [], cards: [], pinned: {}, handoff_op: op });
    await assert.rejects(importHandoff(f.hub, Buffer.from('{'), 'hub', '/project'), { status: 422 });
    assert.equal(f.calls.length, 0);
    const result = await importHandoff(f.hub, bytes(), 'hub', '/project');
    assert.equal(result.outcome, kind === 'create' ? 'created' : 'advanced');
    assert.match(result.note, /Finished the earlier import/);
    assert.equal(f.calls.filter((c) => c.action === 'inspect').length, 1);
    assert.equal(f.calls.find((c) => c.action === 'inspect').head, f.sha);
  }
});

test('raw route rejects oversized bodies before invoking import', async () => {
  const { Readable } = require('node:stream');
  const { handle } = require('../app/routes.js');
  const request = Readable.from([Buffer.alloc(10 * 1024 * 1024 + 1)]);
  request.method = 'POST'; request.headers = {};
  let called = false;
  await assert.rejects(handle({ importHandoff: async () => { called = true; } }, request, {}, new URL('http://test/wheelchair/api/threads/import?project=%2Fproject')), { status: 413 });
  assert.equal(called, false);
});

test('invalid file shapes fail before any machine handoff call', async () => {
  for (const edit of [(f) => { f.thread.id = 'bad'; }, (f) => { f.version = 2; }, (f) => { f.unknown = true; }, (f) => { f.history = [{ who: 'bad' }]; }]) {
    const invalid = structuredClone(file); edit(invalid);
    const f = await operationFixture();
    await assert.rejects(importHandoff(f.hub, Buffer.from(JSON.stringify(invalid)), 'hub', '/project'), { status: 422 });
    assert.equal(f.calls.length, 0);
  }
});

test('repository and branch failures precede creating a record', async () => {
  for (const [change, status] of [[{ repository: null }, 422], [{ repository: 'github.com/a/c' }, 422], [{ remote_has_branch: false }, 409], [{ remote_contains_head: false }, 409]]) {
    const base = { repository: file.repository, remote_has_branch: true, remote_contains_head: true, remote_tip: file.head, plan_status: 'approved' };
    const f = await operationFixture({ inspect: { ...base, ...change } });
    await assert.rejects(importHandoff(f.hub, bytes(), 'hub', '/project'), { status });
    await assert.rejects(f.hub.thread(file.thread.id), { status: 404 });
  }
});

test('Advance reopens retained and absent worktrees and retracts prior cards', async () => {
  for (const worktree of [null, '/work']) {
    const f = await operationFixture({ inspect: { repository: file.repository, remote_has_branch: true, remote_contains_head: true, remote_tip: file.head, plan_status: 'approved', relation: 'ahead', worktree_exists: Boolean(worktree) } });
    const thread = { id: file.thread.id, machine: 'hub', project: '/project', slug: 'title', worktree, archived: true, sessions: [], cards: [{ id: 'old', kind: 'question' }], pinned: { question: 'old' }, queues: {} };
    await f.hub.save(thread);
    const result = await importHandoff(f.hub, bytes(), 'hub', '/project');
    assert.equal(result.outcome, 'advanced');
    const saved = await f.hub.thread(file.thread.id);
    assert.equal(saved.archived, false); assert.equal(saved.cards[0].retracted_by, 'import'); assert.deepEqual(saved.pinned, {});
    assert.ok(f.calls.some((c) => c.action === (worktree ? 'fast-forward' : 'set-branch')));
    assert.equal(f.restarts, 1);
  }
});

test('busy Advance preserves imported state, cards and pins; ended worker queue does not block', async () => {
  for (const scenario of ['worker', 'lead queue', 'sudo', 'upload', 'ended worker']) {
    const f = await operationFixture({ inspect: { repository: file.repository, remote_has_branch: true, remote_contains_head: true, remote_tip: file.head, plan_status: 'approved', relation: 'ahead', worktree_exists: false } });
    const thread = { id: file.thread.id, machine: 'hub', project: '/project', slug: 'title', sessions: [], queues: {}, cards: [{ id: 'old', kind: 'question' }], pinned: { question: 'old' }, imported: { history: ['old'] } };
    if (scenario === 'worker') thread.sessions.push({ role: 'worker', live: true });
    if (scenario === 'lead queue') thread.sessions.push({ role: 'lead', live: false, queue: [{}] });
    if (scenario === 'sudo') thread.cards.push({ kind: 'sudo', state: 'running' });
    if (scenario === 'upload') f.hub.uploadsInFlight.set(file.thread.id, 1);
    if (scenario === 'ended worker') thread.sessions.push({ role: 'worker', live: false, status: 'stopped', queue: [{}] });
    await f.hub.save(thread);
    if (scenario === 'ended worker') assert.equal((await importHandoff(f.hub, bytes(), 'hub', '/project')).outcome, 'advanced');
    else {
      await assert.rejects(importHandoff(f.hub, bytes(), 'hub', '/project'), { status: 409, message: 'The thread here is busy' });
      const saved = await f.hub.thread(file.thread.id);
      assert.deepEqual(saved.imported, thread.imported); assert.deepEqual(saved.cards, thread.cards); assert.deepEqual(saved.pinned, thread.pinned);
    }
  }
});

test('own cancelled tip schedules revoke after releasing the lock and Open shows waiting note', async () => {
  const ops = require('../app/handoff-ops.js');
  const cancelled = 'c'.repeat(40);
  const inspect = { repository: file.repository, remote_has_branch: true, remote_contains_head: true, remote_tip: cancelled, plan_status: 'approved', relation: 'same' };
  let notify; const revoked = new Promise((resolve) => { notify = resolve; });
  const f = await operationFixture({ inspect, 'claim-revoke': () => { notify(); return { result: 'revoked' }; } });
  const entry = { thread_id: file.thread.id, machine: 'hub', project: '/project', branch: file.branch, parent: file.head, sha: cancelled, until: new Date(Date.now() + 100000).toISOString() };
  await ops.writeRevokes(f.hub, [entry]);
  await assert.rejects(importHandoff(f.hub, bytes(), 'hub', '/project'), { status: 409, message: ops.TAKING_BACK });
  await Promise.race([revoked, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('revoke deadlocked')), 1000); timer.unref(); })]);
  await f.hub.save({ id: file.thread.id, machine: 'hub', project: '/project', sessions: [], cards: [], pinned: {} });
  const result = await importHandoff(f.hub, bytes(), 'hub', '/project');
  assert.match(result.note, /still being taken back/);
});

test('handed-off thread with unchanged tip offers Undo and passes retained checkout and fallback', async () => {
  const f = await operationFixture();
  await f.hub.save({ id: file.thread.id, machine: 'hub', project: '/project', worktree: '/retained', handed_off: { head: file.head }, archived: true, sessions: [], cards: [], pinned: {} });
  const result = await importHandoff(f.hub, bytes(), 'hub', '/project');
  assert.match(result.note, /press Undo/);
  const request = f.calls.find((c) => c.action === 'inspect');
  assert.equal(request.worktree, '/retained'); assert.equal(request.fallback_head, file.head);
});

test('dirty Advance refuses before claim and preserves prior imported content', async () => {
  const inspect = { repository: file.repository, remote_has_branch: true, remote_contains_head: true, remote_tip: file.head, plan_status: 'approved', relation: 'ahead', worktree_exists: true };
  const f = await operationFixture({ inspect, status: { branch: file.branch, dirty: true } });
  await f.hub.save({ id: file.thread.id, machine: 'hub', project: '/project', slug: 'title', worktree: '/work', sessions: [], cards: [{ id: 'old', kind: 'question' }], pinned: { question: 'old' }, imported: { history: ['old'] } });
  await assert.rejects(importHandoff(f.hub, bytes(), 'hub', '/project'), { status: 409, message: /uncommitted changes/ });
  const saved = await f.hub.thread(file.thread.id);
  assert.deepEqual(saved.imported, { history: ['old'] }); assert.deepEqual(saved.pinned, { question: 'old' }); assert.equal(saved.cards[0].retracted_by, undefined); assert.equal(saved.handoff_op, undefined);
  assert.equal(f.calls.some((c) => c.action === 'claim-commit'), false);
});

test('HTTP import returns 413 for an oversized file without recording a thread', async () => {
  const { setup, close } = require('./helpers/app.js');
  const c = await setup();
  try {
    const response = await fetch(`${c.server.url}/api/threads/import?machine=hub&project=%2Fproject`, { method: 'POST', headers: { 'x-graph-token': c.server.token, origin: new URL(c.server.url).origin }, body: Buffer.alloc(10 * 1024 * 1024 + 1) });
    assert.equal(response.status, 413);
    const { Hub } = require('../app/hub.js');
    assert.deepEqual(await new Hub({ stateDir: c.state }).allThreads(), []);
  } finally { await close(c); }
});

test('invalid picker project returns the createThread sentence', async () => {
  const { hub } = await operationFixture();
  hub.call = async () => ({ checked: { ok: false, path: '/bad', reason: 'is not a git repository' } });
  await assert.rejects(importHandoff(hub, bytes(), 'hub', '/bad'), { status: 400, message: '/bad is not a git repository on hub' });
});

test('Advance stops an idle live lead before restarting', async () => {
  const inspect = { repository: file.repository, remote_has_branch: true, remote_contains_head: true, remote_tip: file.head, plan_status: 'approved', relation: 'ahead', worktree_exists: false };
  const f = await operationFixture({ inspect });
  const requests = []; f.hub.call = async (_, route, method) => { requests.push({ route, method }); return route.startsWith('/v1/projects') ? { checked: { ok: true, path: '/project' } } : {}; };
  await f.hub.save({ id: file.thread.id, machine: 'hub', project: '/project', slug: 'title', sessions: [{ name: 'lead', role: 'lead', live: true, turn_ended: true, queue: [] }], queues: {}, cards: [], pinned: {} });
  assert.equal((await importHandoff(f.hub, bytes(), 'hub', '/project')).outcome, 'advanced');
  assert.ok(requests.some((r) => r.route === '/v1/sessions/lead' && r.method === 'DELETE'));
  assert.equal((await f.hub.thread(file.thread.id)).sessions[0].live, false); assert.equal(f.restarts, 1);
});
