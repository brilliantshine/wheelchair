'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { donePr, stageFor } = require('../app/handoff.js');
test('imported PR ignores older done cards and falls back to carried PR', () => {
  const thread = { imported: { at: '2026-01-02T00:00:00Z', pr_url: 'carried' }, cards: [{ kind: 'done', at: '2026-01-01T00:00:00Z', pr_url: 'old' }] };
  assert.equal(donePr(thread), 'carried');
  assert.equal(stageFor(thread, { plan_status: 'done' }), 'done');
  thread.cards.push({ kind: 'done', at: '2026-01-03T00:00:00Z', pr_url: 'new' });
  assert.equal(donePr(thread), 'new');
});

test('startup repairs only partial imported lead starts and registers plans', async (t) => {
  const { makeTemp } = require('../../test-support/run-dir.js');
  const { Hub } = require('../app/hub.js');
  const path = require('node:path');
  const dir = await makeTemp('handoff-restart-');
  const hub = new Hub({ stateDir: dir, registerPlan: async (p) => registered.push(p) });
  const registered = [];
  await hub.state.init();
  const session = (role, extra = {}) => ({ name: role, role, live: true, status: 'starting', queue: [], ...extra });
  const base = { project: '/repo', machine: 'hub', cards: [], pinned: {}, queues: {}, sent: [], slug: 'plan', worktree: '/work', archived: false };
  await hub.save({ ...base, id: 'aaaaaaaaaaaa', imported: { at: '2026-01-01' }, sessions: [session('lead'), session('worker'), session('lead', { name: 'saved', first_message: true })] });
  await hub.save({ ...base, id: 'bbbbbbbbbbbb', sessions: [session('lead')] });
  await hub.init();
  t.after(() => { for (const key of ['asideTimer', 'pollTimer', 'queueRetryTimer', 'waitTimer', 'usageTimer', 'usageStartTimer']) clearTimeout(hub[key]); });
  const imported = await hub.thread('aaaaaaaaaaaa');
  assert.equal(imported.sessions[0].live, false);
  assert.equal(imported.sessions[1].live, true);
  assert.equal(imported.sessions[2].live, true);
  assert.equal((await hub.thread('bbbbbbbbbbbb')).sessions[0].live, true);
  assert.deepEqual(registered.sort(), [path.join('/work', 'docs/plans/plan'), path.join('/work', 'docs/plans/plan')]);
});

test('import restart saves context before launch, moves queues, and uses checkout SHA', async (t) => {
  const { setup, close, thread: makeThread } = require('./helpers/app.js');
  const { Hub } = require('../app/hub.js');
  const c = await setup(); t.after(() => close(c));
  const made = await makeThread(c);
  const registered = [];
  const hub = new Hub({ stateDir: c.state, registerPlan: async (p) => registered.push(p) });
  await hub.init();
  t.after(() => { for (const key of ['asideTimer', 'pollTimer', 'queueRetryTimer', 'waitTimer', 'usageTimer', 'usageStartTimer']) clearTimeout(hub[key]); });
  const thread = await hub.thread(made.id);
  thread.sessions[0].live = false; thread.sessions[0].queue = [{ text: 'queued', source: 'collin' }];
  thread.imported = { at: '2099-01-01T00:00:00Z', stage: 'approved', exported_at: '2026-01-01', pr_url: null, history: Array.from({ length: 60 }, (_, i) => i) };
  thread.worktree = null; thread.slug = 'plan'; thread.checkout_sha = 'a'.repeat(40);
  await hub.save(thread);
  const old = thread.sessions[0].name;
  c.machine.handoffReplies.running = { names: [old, `wc-${made.id}-worker`] };
  c.machine.handoffReplies.kill = { names: [`wc-${made.id}-worker`] };
  const snapshots = []; const save = hub.save.bind(hub);
  hub.save = async (value) => { snapshots.push(structuredClone(value)); return save(value); };
  const lead = await hub.restartLead(made.id);
  const pending = snapshots.flatMap((x) => x.sessions).find((x) => x.name === lead.name && x.status === 'pending');
  assert.ok(pending); assert.equal(pending.live, false); assert.match(pending.queue[0].text, /^\[wc:context import\]/);
  assert.deepEqual(JSON.parse(pending.queue[0].text.split('Thread state:\n')[1]).import.history, Array.from({ length: 50 }, (_, i) => i + 10));
  assert.equal(lead.queue[1].text, 'queued');
  const kill = c.machine.calls.find((x) => x.body.action === 'kill'); assert.deepEqual(kill.body.names, [old]);
  const call = c.machine.calls.filter((x) => x.path === '/v1/sessions' && x.method === 'POST').at(-1);
  assert.deepEqual(call.body.from_remote_branch, { sha: 'a'.repeat(40) });
  assert.ok(registered.includes(`/tmp/${lead.name}/docs/plans/plan`));
});

test('surviving orphan refuses restart without losing its queue', async (t) => {
  const { setup, close, thread: makeThread } = require('./helpers/app.js');
  const { Hub } = require('../app/hub.js');
  const c = await setup(); t.after(() => close(c));
  const made = await makeThread(c);
  const hub = new Hub({ stateDir: c.state }); await hub.state.init();
  const thread = await hub.thread(made.id); const old = thread.sessions[0];
  old.live = false; old.queue = [{ text: 'keep', source: 'context' }];
  thread.imported = { at: '2026-01-01', history: [] }; await hub.save(thread);
  c.machine.handoffReplies.running = { names: [old.name] }; c.machine.handoffReplies.kill = { names: [old.name] };
  await assert.rejects(hub.restartLead(made.id), /The previous agent is still stopping/);
  assert.equal((await hub.thread(made.id)).sessions[0].queue[0].text, 'keep');
});

test('ordinary restart with checkout SHA sends it to the machine', async (t) => {
  const { setup, close, thread: makeThread } = require('./helpers/app.js');
  const { Hub } = require('../app/hub.js');
  const c = await setup(); t.after(() => close(c));
  const made = await makeThread(c);
  const hub = new Hub({ stateDir: c.state }); await hub.state.init();
  const thread = await hub.thread(made.id); thread.sessions[0].live = false; thread.worktree = null; thread.checkout_sha = 'b'.repeat(40); await hub.save(thread);
  await hub.restartLead(made.id);
  const call = c.machine.calls.filter((x) => x.path === '/v1/sessions' && x.method === 'POST').at(-1);
  assert.deepEqual(call.body.from_remote_branch, { sha: 'b'.repeat(40) });
  assert.equal(c.machine.calls.some((x) => x.body.action === 'running'), false);
});
