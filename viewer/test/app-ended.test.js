'use strict';
// The hub must not tell a starter "your session ended" while that session still runs, and must not
// let a replacement worker share a worktree with a worker whose tmux session still exists.
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, close, api, machinePost } = require('./helpers/app.js');
const { Hub } = require('../app/hub.js');

async function threadWithWorker(c, project, attempt) {
  const made = (await api(c, '/threads', { method: 'POST', body: { project } })).body;
  const lead = made.sessions[0];
  const sub = (await machinePost(c, '/machine/session', { calling_session: lead.name, action: 'start', role: 'sub-lead', attempt_id: `${attempt}-sub` })).body.session;
  const worker = (await machinePost(c, '/machine/session', { calling_session: sub.name, action: 'start', role: 'worker', provider: 'gpt', attempt_id: attempt, brief: 'work' })).body.session;
  return { made, lead, sub, worker };
}

async function until(check) {
  for (let i = 0; i < 200 && !check(); i += 1) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(check());
}

test('a session started while the poll waits for the thread lock is not reported ended', async () => {
  const c = await setup();
  try {
    const { made, sub } = await threadWithWorker(c, '/tmp/ended-race', 'race');
    const hub = new Hub({ stateDir: c.state });
    const late = 'wc-late-worker';
    let poll;
    await hub.withThread(made.id, async () => {
      const before = c.machine.calls.length;
      poll = hub.pollDead();
      // The poll has its listing and is now queued behind this lock.
      await until(() => c.machine.calls.slice(before).some((call) => call.method === 'GET' && call.path === '/v1/sessions'));
      // A start lands while the poll waits: in the machine and in the thread, after the listing.
      c.machine.sessions.set(late, { name: late, thread_id: made.id, role: 'worker', status: 'ready', running: true });
      const thread = await hub.thread(made.id);
      thread.sessions.push({ name: late, role: 'worker', started_by: sub.name, token: 'x', status: 'ready', live: true, queue: [], created_at: new Date().toISOString() });
      await hub.save(thread);
    });
    await poll;
    const thread = await hub.thread(made.id);
    assert.equal(thread.sessions.find((s) => s.name === late).live, true);
    assert.equal((thread.sent || []).some((entry) => entry.text.includes(`${late} ended`)), false);
  } finally { await close(c); }
});

test('a session the machine could not check stays live; one gone from tmux ends', async () => {
  const c = await setup();
  try {
    const { made, worker } = await threadWithWorker(c, '/tmp/ended-unknown', 'unknown');
    const hub = new Hub({ stateDir: c.state });
    delete c.machine.sessions.get(worker.name).running;
    await hub.pollDead();
    assert.equal((await hub.thread(made.id)).sessions.find((s) => s.name === worker.name).live, true);
    c.machine.sessions.get(worker.name).running = false;
    await hub.pollDead();
    const target = (await hub.thread(made.id)).sessions.find((s) => s.name === worker.name);
    assert.equal(target.live, false);
    assert.equal(target.status, 'ended');
  } finally { await close(c); }
});

test('--replaces is refused while the old worker still runs in tmux', async () => {
  const c = await setup();
  try {
    const { made, sub, worker } = await threadWithWorker(c, '/tmp/ended-replace', 'replace');
    const hub = new Hub({ stateDir: c.state });
    // The hub's record says ended (the false notice), but tmux still has the session.
    await hub.withThread(made.id, async () => {
      const thread = await hub.thread(made.id);
      Object.assign(thread.sessions.find((s) => s.name === worker.name), { live: false, status: 'ended' });
      await hub.save(thread);
    });
    const start = (attempt) => machinePost(c, '/machine/session', { calling_session: sub.name, action: 'start', role: 'worker', provider: 'gpt', attempt_id: attempt, brief: 'again', replaces: worker.name });
    const refused = await start('replace-2');
    assert.equal(refused.status, 409);
    assert.match(JSON.stringify(refused.body), /still running in tmux/);
    c.machine.sessions.get(worker.name).running = false;
    const accepted = await start('replace-3');
    assert.equal(accepted.status, 200);
    const call = c.machine.calls.filter((x) => x.method === 'POST' && x.path === '/v1/sessions').at(-1);
    assert.equal(call.body.worktree, `/tmp/${worker.name}`);
    // A second replacement of the same worker would share the first replacement's worktree.
    const second = await start('replace-4');
    assert.equal(second.status, 409);
    assert.match(JSON.stringify(second.body), /already working in that worktree/);
  } finally { await close(c); }
});
