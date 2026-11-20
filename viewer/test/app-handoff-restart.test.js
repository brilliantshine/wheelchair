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
  await hub.save({ ...base, id: 'cccccccccccc', archived: true, sessions: [] });
  await hub.init();
  t.after(() => { for (const key of ['asideTimer', 'pollTimer', 'queueRetryTimer', 'waitTimer', 'usageTimer', 'usageStartTimer']) clearTimeout(hub[key]); });
  const imported = await hub.thread('aaaaaaaaaaaa');
  assert.equal(imported.sessions[0].live, false); assert.ok(!Number.isNaN(Date.parse(imported.sessions[0].ended_at)));
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
  thread.sessions[0].live = false; thread.sessions[0].queue = [{ text: 'old context', source: 'context' }, { text: 'queued', source: 'user' }];
  thread.imported = { at: '2099-01-01T00:00:00Z', stage: 'approved', exported_at: '2026-01-01', pr_url: null, history: Array.from({ length: 60 }, (_, i) => i) };
  thread.worktree = null; thread.slug = 'plan'; thread.checkout_sha = 'a'.repeat(40);
  await hub.save(thread);
  const old = thread.sessions[0].name;
  const orphan = `wc-${made.id}-lead-8`; thread.queues[orphan] = [{ text: 'orphan queue', source: 'card' }]; await hub.save(thread);
  c.machine.handoffReplies.running = { names: [old, orphan, `wc-${made.id}-worker`] };
  c.machine.handoffReplies.kill = { names: [`wc-${made.id}-worker`] };
  const snapshots = []; const save = hub.save.bind(hub); let postsAtPending;
  hub.save = async (value) => { snapshots.push(structuredClone(value)); if (value.sessions.some((s) => s.status === 'pending')) postsAtPending = c.machine.calls.filter((x) => x.path === '/v1/sessions' && x.method === 'POST').length; return save(value); };
  const beforePosts = c.machine.calls.filter((x) => x.path === '/v1/sessions' && x.method === 'POST').length;
  const lead = await hub.restartLead(made.id);
  const pending = snapshots.flatMap((x) => x.sessions).find((x) => x.name === lead.name && x.status === 'pending');
  assert.equal(postsAtPending, beforePosts);
  assert.ok(pending); assert.equal(pending.live, false); assert.match(pending.queue[0].text, /^\[wc:context import\]/);
  assert.deepEqual(JSON.parse(pending.queue[0].text.split('Thread state:\n')[1]).import.history, Array.from({ length: 50 }, (_, i) => i + 10));
  assert.equal(lead.queue[1].text, 'queued');
  const kill = c.machine.calls.find((x) => x.body.action === 'kill'); assert.deepEqual(kill.body.names, [old, orphan]);
  assert.equal(lead.queue[2].text, 'orphan queue');
  const call = c.machine.calls.filter((x) => x.path === '/v1/sessions' && x.method === 'POST').at(-1);
  assert.deepEqual(call.body.from_remote_branch, { sha: 'a'.repeat(40) });
  assert.ok(registered.includes(`/tmp/${lead.name}/docs/plans/plan`));
});

test('import restart normalizes old owner tags in context and saved state', async (t) => {
  const { setup, close, event, thread: makeThread } = require('./helpers/app.js');
  const { Hub } = require('../app/hub.js');
  const c = await setup(); t.after(() => close(c));
  const made = await makeThread(c);
  const hub = new Hub({ stateDir: c.state }); await hub.init();
  t.after(() => { for (const key of ['asideTimer', 'pollTimer', 'queueRetryTimer', 'waitTimer', 'usageTimer', 'usageStartTimer']) clearTimeout(hub[key]); });
  const thread = await hub.thread(made.id);
  thread.sessions[0].live = false;
  thread.sent = [{ source: 'collin', text: 'typed' }];
  thread.cards = [{ id: 'needs', kind: 'needs', resolved_by: 'collin' }];
  thread.pinned = { needs: { id: 'pinned', kind: 'needs', resolved_by: 'collin' }, other: 'card-id' };
  thread.imported = { at: '2099-01-01', history: [{ who: 'collin', text: 'history' }] };
  await hub.save(thread);
  const lead = await hub.restartLead(made.id);
  await event(c, made.id, lead.name, 'turn-ended');
  const delivered = c.machine.sessions.get(lead.name).submits[0];
  assert.match(delivered, /^\[wc:context import\]/);
  const state = JSON.parse(delivered.split('Thread state:\n')[1]);
  assert.equal(state.recent_messages[0].source, 'user');
  assert.equal(state.cards[0].resolved_by, 'user');
  assert.equal(state.pinned.needs.resolved_by, 'user');
  assert.equal(state.pinned.other, 'card-id');
  assert.equal(state.import.history[0].who, 'user');
  const saved = await hub.thread(made.id);
  assert.equal(saved.sent[0].source, 'user');
  assert.equal(saved.cards[0].resolved_by, 'user');
  assert.equal(saved.pinned.needs.resolved_by, 'user');
  assert.equal(saved.imported.history[0].who, 'user');
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

test('import context marker is presented in chat', () => {
  const { transcriptItems } = require('../app/chat.js');
  const raw = JSON.stringify({ type: 'user', origin: { kind: 'human' }, message: { role: 'user', content: '[wc:context import] details' } });
  assert.equal(transcriptItems('claude', raw, {})[0].text, 'Imported from a handoff');
});

test('merge watcher uses the imported PR over an old done card', async (t) => {
  const { makeTemp } = require('../../test-support/run-dir.js');
  const fs = require('node:fs/promises'); const path = require('node:path');
  const dir = await makeTemp('handoff-gh-'); const oldPath = process.env.PATH;
  await fs.writeFile(path.join(dir, 'gh'), '#!/bin/sh\nprintf \'{"state":"MERGED"}\'\n', { mode: 0o755 });
  process.env.PATH = `${dir}:${oldPath}`; t.after(() => { process.env.PATH = oldPath; });
  const pr = 'https://github.com/o/r/pull/2';
  const thread = { id: 'aaaaaaaaaaaa', imported: { at: '2026-01-02', pr_url: pr }, cards: [{ kind: 'done', at: '2026-01-01', pr_url: 'https://github.com/o/r/pull/1' }], pinned: {} };
  const hub = { allThreads: async () => [thread], thread: async () => thread, withThread: async (_, fn) => fn(), save: async () => {} };
  await require('../app/threads.js').pollMerged(hub);
  assert.equal(thread.merge_noticed_url, pr);
  assert.equal(thread.cards.at(-1).pr_url, pr);
});

test('partial imported start is repaired, killed, and restarted twice with the right context', async (t) => {
  const { setup, close, thread: makeThread } = require('./helpers/app.js'); const { Hub } = require('../app/hub.js');
  const c = await setup(); t.after(() => close(c)); const made = await makeThread(c);
  const hub = new Hub({ stateDir: c.state, registerPlan: async () => { throw new Error('registration failed'); } });
  await hub.state.init(); const thread = await hub.thread(made.id); const old = thread.sessions[0];
  old.live = true; old.status = 'starting'; delete old.first_message; old.created_at = '2019-01-01';
  old.queue = [{ text: 'stale', source: 'context' }, { text: 'survives', source: 'user' }];
  thread.imported = { at: '2020-01-01', stage: 'approved', exported_at: '2019-12-30', pr_url: null, history: ['history'] };
  thread.slug = 'plan'; thread.checkout_sha = 'c'.repeat(40); await hub.save(thread);
  c.machine.handoffReplies.inspect = { worktree_exists: false };
  c.machine.handoffReplies.running = { names: [old.name] }; c.machine.handoffReplies.kill = { names: [] };
  await hub.init();
  t.after(() => { for (const key of ['asideTimer', 'pollTimer', 'queueRetryTimer', 'waitTimer', 'usageTimer', 'usageStartTimer']) clearTimeout(hub[key]); });
  const repaired = await hub.thread(made.id); assert.equal(repaired.sessions[0].live, false); assert.equal(repaired.sessions[0].status, 'ended');
  const first = await hub.restartLead(made.id);
  assert.match(first.queue[0].text, /^\[wc:context import\]/); assert.equal(first.queue[1].text, 'survives');
  const firstImport = JSON.parse(first.queue[0].text.split('Thread state:\n')[1]).import;
  const inspect = c.machine.calls.find((x) => x.body.action === 'inspect'); assert.equal(inspect.body.worktree, thread.worktree); assert.equal(inspect.body.head, thread.checkout_sha);
  const start = c.machine.calls.filter((x) => x.path === '/v1/sessions' && x.method === 'POST').at(-1);
  assert.deepEqual(start.body.from_remote_branch, { sha: thread.checkout_sha });
  assert.deepEqual(c.machine.calls.find((x) => x.body.action === 'kill').body.names, [old.name]);
  const current = await hub.thread(made.id); current.sessions.find((x) => x.name === first.name).live = false; await hub.save(current);
  c.machine.handoffReplies.inspect = { worktree_exists: true }; c.machine.handoffReplies.running = { names: [] };
  const second = await hub.restartLead(made.id);
  assert.match(second.queue[0].text, /^\[wc:context restart\]/);
  assert.deepEqual(JSON.parse(second.queue[0].text.split('Thread state:\n')[1]).import, firstImport);
  assert.equal(second.queue.filter((message) => message.source === 'context').length, 1);
});

test('imported Claude lead receives context immediately on start', async (t) => {
  const { setup, close, thread: makeThread } = require('./helpers/app.js'); const { Hub } = require('../app/hub.js');
  const c = await setup(); t.after(() => close(c)); const made = await makeThread(c, { cli: 'claude' });
  const hub = new Hub({ stateDir: c.state }); await hub.state.init();
  const thread = await hub.thread(made.id); thread.sessions[0].live = false; thread.imported = { at: '2099-01-01', history: [] }; await hub.save(thread);
  c.machine.handoffReplies.running = { names: [] };
  const lead = await hub.restartLead(made.id);
  assert.match(c.machine.sessions.get(lead.name).submits[0], /^\[wc:context import\]/);
});

test('imported waiting lead retries with checkout SHA and delivers context', async (t) => {
  const { setup, close, thread: makeThread } = require('./helpers/app.js'); const { Hub } = require('../app/hub.js');
  const settings = require('../app/settings.js'); const { retryWaiting } = require('../app/sessions.js');
  const c = await setup(); t.after(() => close(c)); const made = await makeThread(c, { cli: 'claude' });
  const hub = new Hub({ stateDir: c.state }); await hub.state.init();
  const thread = await hub.thread(made.id); thread.sessions[0].live = false; thread.imported = { at: '2099-01-01', history: [] }; thread.worktree = null; thread.checkout_sha = 'd'.repeat(40); await hub.save(thread);
  await settings.update(hub, (s) => { s.accounts.forEach((a) => { a.paused = true; }); });
  c.machine.handoffReplies.running = { names: [] };
  const waiting = await hub.restartLead(made.id);
  assert.equal(waiting.live, true); assert.equal(waiting.status, 'waiting');
  assert.deepEqual(waiting.pending_start.from_remote_branch, { sha: thread.checkout_sha });
  assert.match(waiting.queue[0].text, /^\[wc:context import\]/);
  assert.equal(c.machine.sessions.has(waiting.name), false);
  await settings.update(hub, (s) => { s.accounts.forEach((a) => { a.paused = false; }); });
  await retryWaiting(hub);
  const started = (await hub.thread(made.id)).sessions.find((s) => s.name === waiting.name);
  assert.equal(started.status, 'ready');
  const request = c.machine.calls.filter((x) => x.path === '/v1/sessions' && x.method === 'POST').at(-1);
  assert.deepEqual(request.body.from_remote_branch, { sha: thread.checkout_sha });
  assert.match(c.machine.sessions.get(waiting.name).submits[0], /^\[wc:context import\]/);
});

test('failed pending start retains non-context queue for the next restart and failed inspect is tolerated', async (t) => {
  const { setup, close, thread: makeThread } = require('./helpers/app.js'); const { Hub } = require('../app/hub.js');
  const c = await setup(); t.after(() => close(c)); const made = await makeThread(c); const hub = new Hub({ stateDir: c.state }); await hub.state.init();
  const thread = await hub.thread(made.id); thread.sessions[0].live = false; thread.sessions[0].queue = [{ text: 'keep me', source: 'user' }];
  thread.imported = { at: '2099-01-01', history: [] }; thread.slug = 'plan'; thread.checkout_sha = 'e'.repeat(40); await hub.save(thread);
  c.machine.handoffReplies.running = { names: [] }; c.machine.handoffReplies.inspect = { result: 'failed', error: 'offline' }; c.machine.startOk = false;
  await assert.rejects(hub.restartLead(made.id), /start refused/);
  const failed = (await hub.thread(made.id)).sessions.at(-1); assert.equal(failed.status, 'failed'); assert.equal(failed.live, false); assert.equal(failed.queue[1].text, 'keep me');
  c.machine.startOk = true; const next = await hub.restartLead(made.id);
  assert.equal(next.queue[1].text, 'keep me'); assert.equal(next.queue.filter((m) => m.source === 'context').length, 1);
  const request = c.machine.calls.filter((x) => x.path === '/v1/sessions' && x.method === 'POST').at(-1);
  assert.equal(request.body.worktree, thread.worktree); assert.equal(request.body.from_remote_branch, undefined);
});

test('ordinary chat and merge watcher retain their different done-card rules', async (t) => {
  const { setup, close, thread: makeThread } = require('./helpers/app.js'); const { Hub } = require('../app/hub.js');
  const { makeTemp } = require('../../test-support/run-dir.js'); const fs = require('node:fs/promises'); const path = require('node:path');
  const c = await setup(); t.after(() => close(c)); const made = await makeThread(c); const hub = new Hub({ stateDir: c.state }); await hub.state.init();
  const thread = await hub.thread(made.id); const older = 'https://github.com/o/r/pull/1'; const replaced = 'https://github.com/o/r/pull/2';
  thread.cards.push({ kind: 'done', pr_url: older }, { kind: 'done', pr_url: replaced, replaced: true }, { kind: 'done', pr_url: '   ' }); await hub.save(thread);
  assert.equal((await hub.chat(made.id)).thread.pr_url, '   ');
  thread.cards.pop(); await hub.save(thread); assert.equal((await hub.chat(made.id)).thread.pr_url, replaced);
  thread.cards.push({ kind: 'done', pr_url: '   ' }); await hub.save(thread);
  const dir = await makeTemp('handoff-gh-'); const oldPath = process.env.PATH; const log = path.join(dir, 'calls');
  await fs.writeFile(path.join(dir, 'gh'), `#!/bin/sh\nprintf '%s' "$3" > '${log}'\nprintf '{"state":"MERGED"}'\n`, { mode: 0o755 });
  process.env.PATH = `${dir}:${oldPath}`; t.after(() => { process.env.PATH = oldPath; });
  await hub.pollMerged(); assert.equal(await fs.readFile(log, 'utf8'), older);
});
