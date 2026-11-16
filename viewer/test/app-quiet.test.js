'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, close, thread, machinePost, event, card } = require('./helpers/app.js');
const { Hub } = require('../app/hub.js');
const env = { WHEELCHAIR_QUIET_GRACE_MS: '50', WHEELCHAIR_QUIET_ESCALATE_MS: '400', WHEELCHAIR_QUEUE_RETRY_MS: '20' };
const delay = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, timeout = 8000) { const end = Date.now() + timeout; while (Date.now() < end) { const v = await fn(); if (v) return v; await delay(20); } assert.fail('timed out waiting for condition'); }
async function fixture(extraEnv = {}) {
  const c = await setup({ env: { ...env, ...extraEnv } }); const t = await thread(c); const lead = t.sessions[0];
  async function start(starter, role, id = role) { const r = await machinePost(c, '/machine/session', { calling_session: starter.name, action: 'start', role, attempt_id: id, brief: 'work' }); assert.equal(r.status, 200); return r.body.session; }
  const sub = await start(lead, 'sub-lead'); const worker = await start(sub, 'worker');
  const hub = new Hub({ stateDir: c.state });
  const read = () => hub.thread(t.id); const session = async s => (await read()).sessions.find(x => x.name === s.name);
  const submits = s => c.machine.sessions.get(s.name).submits || [];
  const end = (s, extra) => event(c, t.id, s.name, 'turn-ended', extra);
  const result = s => card(c, t.id, s.name, { kind: 'result', task: 'T1', outcome: 'done', summary: 'done' });
  const message = (s, to) => card(c, t.id, s.name, { kind: 'message', to: to.name, text: 'question' });
  const quietCard = async () => (await read()).cards.find(x => x.title === 'An agent stopped without reporting');
  const stage1 = async () => { await end(worker); await until(() => submits(worker).some(x => x.includes('[wc:from app]'))); };
  const stage2 = async () => { await stage1(); await end(sub); await end(worker); await until(() => submits(sub).some(x => x.includes('ended two turns'))); };
  return { c, t, lead, sub, worker, hub, read, session, submits, end, result, message, quietCard, stage1, stage2, start };
}
// Ends s's turns until a message from `from` has been delivered to it and its queue is empty, so
// s is mid-turn on that work and owes a reply; its next turn end is then the one under test.
async function feed(f, s, from) {
  const done = async () => { const x = await f.session(s); return f.submits(s).some(t => t.includes(`[wc:from ${from.name}]`)) && x.owes_reply && !x.turn_ended && !x.queue?.length; };
  for (let i = 0; i < 5 && !(await done()); i++) { const n = f.submits(s).length; await f.end(s); await until(async () => f.submits(s).length > n || await done()); }
  await until(done);
}
async function run(fn, extraEnv) { const f = await fixture(extraEnv); try { await fn(f); } finally { await close(f.c); } }

test('1 first quiet turn nudges worker', () => run(async f => { await f.stage1(); assert.match(f.submits(f.worker)[0], /Your turn ended without a result or message card/); assert.equal(f.submits(f.sub).length, 0); }));
test('2 second quiet turn nudges starter', () => run(async f => { await f.stage2(); assert.match(f.submits(f.sub).join(' '), /ended two turns/); }));
test('3 third quiet turn creates and result closes card', () => run(async f => { await f.stage2(); await f.end(f.worker); const a = await until(f.quietCard); assert.equal(a.system, true); assert.equal((await f.result(f.worker)).status, 202); assert.equal((await f.quietCard()).answered, true); assert.equal((await f.session(f.worker)).quiet_stage, 0); }));
test('4 timer escalates after starter told', () => run(async f => { await f.stage2(); const a = await until(f.quietCard); assert.match(a.body, /hasn't reported back/); }));
test('5 late result within grace prevents nudge', () => run(async f => { await f.end(f.worker); await delay(100); assert.equal((await f.session(f.worker)).turn_ended, true); assert.equal(f.submits(f.worker).length, 0); assert.equal((await f.result(f.worker)).status, 202); await delay(500); assert.equal((await f.session(f.worker)).owes_reply, false); assert.equal(f.submits(f.worker).length, 0); }, { WHEELCHAIR_QUIET_GRACE_MS: '300' }));
test('6 message clears debt', () => run(async f => { await f.end(f.worker); assert.equal((await f.message(f.worker, f.sub)).status, 202); await delay(220); assert.equal(f.submits(f.worker).length, 0); }));
test('7 child owing reply or waiting protects sub-lead', () => run(async f => {
  await f.end(f.sub); await delay(220); assert.equal(f.submits(f.sub).length, 0);
  assert.equal((await f.session(f.worker)).live, true); await f.result(f.worker); await f.end(f.sub);
  await until(() => f.submits(f.sub).some(x => x.includes('Your turn ended')));
  // The hub creates a waiting child only under provider limits, so write this one directly.
  async function addWaitingChild() {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const state = await f.read();
      if (!state.sessions.some(s => s.name === 'waiting-child')) {
        state.sessions.push({ name: 'waiting-child', started_by: f.sub.name, role: 'worker', live: true, status: 'waiting', queue: [] });
        await f.hub.save(state);
      } else {
        await delay(60);
        if ((await f.read()).sessions.some(s => s.name === 'waiting-child')) return;
      }
    }
    assert.fail('waiting child did not stick');
  }
  await addWaitingChild();
  // Fresh work for the sub-lead: it is still in its reminder turn, so the message waits in its
  // queue until that turn ends. Take the baseline only once the message has been delivered.
  assert.equal((await f.message(f.lead, f.sub)).status, 202);
  await f.end(f.sub);
  await until(async () => { const sub = await f.session(f.sub); return f.submits(f.sub).some(x => x.includes('[wc:from ' + f.lead.name + ']')) && sub.owes_reply && !sub.turn_ended && !sub.queue?.length; });
  const before = f.submits(f.sub).length;
  const stage = (await f.session(f.sub)).quiet_stage;
  assert.equal(stage, 1);
  await f.end(f.sub); await delay(300);
  assert.ok((await f.read()).sessions.some(s => s.name === 'waiting-child'));
  // Already reminded once, a quiet sub-lead's next reminder would go to the lead, so check both.
  assert.equal(f.submits(f.sub).length, before);
  assert.equal((await f.session(f.sub)).quiet_stage, stage);
  assert.equal(f.submits(f.lead).filter(x => x.includes('ended two turns')).length, 0);
}));
test('8 reviewer empty report nudges, text reports', () => run(async f => { const a = await f.start(f.lead, 'reviewer', 'review-a'); const b = await f.start(f.lead, 'reviewer', 'review-b'); await f.end(a); await f.end(b, { 'last-assistant-message': 'A report' }); await until(() => f.submits(a).length); await delay(220); assert.match(f.submits(a)[0], /Your turn ended with no report/); assert.equal(f.submits(b).length, 0); assert.equal((await f.session(b)).finished, true); }));
test('9 lead is never watched', () => run(async f => { await f.end(f.lead); await delay(220); assert.equal((await f.session(f.lead)).turn_ended, true); assert.equal(f.submits(f.lead).length, 0); assert.equal(await f.quietCard(), undefined); }));
test('10 stopping answers card', () => run(async f => { await f.stage2(); await f.end(f.worker); await until(f.quietCard); assert.equal((await machinePost(f.c, '/machine/session', { calling_session: f.sub.name, action: 'stop', name: f.worker.name })).status, 200); assert.equal((await f.quietCard()).answered, true); }));
test('11 failed nudge is removed by result', () => run(async f => { f.c.machine.sessions.get(f.worker.name).submitFail = true; await f.end(f.worker); await until(async () => (await f.session(f.worker)).queue.some(q => q.quiet === 'agent')); assert.equal((await f.result(f.worker)).status, 202); f.c.machine.sessions.get(f.worker.name).submitFail = false; await delay(220); assert.equal((await f.session(f.worker)).queue.length, 0); assert.equal(f.submits(f.worker).length, 0); }));
test('12 timer starts on delivery to held starter', () => run(async f => { await f.stage1(); await f.end(f.sub); await event(f.c, f.t.id, f.sub.name, 'prompt', { notification_type: 'permission_prompt' }); await f.end(f.worker); await until(async () => (await f.session(f.sub)).queue.some(q => q.quiet === 'starter')); await delay(500); assert.equal(await f.quietCard(), undefined); await event(f.c, f.t.id, f.sub.name, 'prompt-cleared'); await until(() => f.submits(f.sub).some(x => x.includes('ended two turns'))); assert.equal(await f.quietCard(), undefined); await until(f.quietCard); }));
test('13 re-messaged finished child protects sub-lead', () => run(async f => { await f.result(f.worker); await f.end(f.worker); await f.message(f.sub, f.worker); await until(async () => (await f.session(f.worker)).owes_reply); assert.equal((await f.message(f.lead, f.sub)).status, 202); await feed(f, f.sub, f.lead); await f.end(f.sub); await delay(300); assert.ok((await f.session(f.worker)).owes_reply); assert.equal(f.submits(f.sub).filter(x => x.includes('Your turn ended')).length, 0); assert.equal((await f.session(f.sub)).quiet_stage || 0, 0); }));
test('14 due check survives needs hold', () => run(async f => { await event(f.c, f.t.id, f.worker.name, 'stuck'); await f.end(f.worker); await delay(220); assert.equal(f.submits(f.worker).length, 0); const held = await f.session(f.worker); assert.ok(held.needs_open); assert.ok(held.quiet_check_at); assert.equal(held.quiet_stage || 0, 0); assert.ok(!held.queue?.some(q => q.quiet === 'agent')); await event(f.c, f.t.id, f.worker.name, 'prompt-cleared'); await until(() => f.submits(f.worker).length); }));
test('15 child question does not protect starter', () => run(async f => { assert.equal((await f.message(f.worker, f.sub)).status, 202); await f.end(f.sub); await until(() => f.submits(f.sub).some(x => x.includes('question'))); await f.end(f.sub); await until(() => f.submits(f.sub).some(x => x.includes('Your turn ended'))); assert.equal((await f.session(f.worker)).live, true); }));
test('16 quiet turn waits for queued starter reminder', () => run(async f => { await f.stage1(); await f.end(f.sub); await f.message(f.lead, f.sub); await until(async () => !(await f.session(f.sub)).turn_ended); await f.end(f.worker); await until(async () => (await f.session(f.sub)).queue.some(q => q.quiet === 'starter')); await f.message(f.sub, f.worker); await f.end(f.worker); await delay(220); assert.equal(await f.quietCard(), undefined); await f.end(f.sub); await until(f.quietCard); }));
test('17 dead starter escalates queued reminder', () => run(async f => { await f.stage1(); await f.end(f.sub); await f.message(f.lead, f.sub); await until(async () => !(await f.session(f.sub)).turn_ended); await f.end(f.worker); await until(async () => (await f.session(f.sub)).queue.some(q => q.quiet === 'starter')); const stopped = await machinePost(f.c, '/machine/session', { calling_session: f.lead.name, action: 'stop', name: f.sub.name }); assert.equal(stopped.status, 200); const a = await until(f.quietCard); assert.match(a.body, /no longer running/); }));
test('18 queued child answer protects starter', () => run(async f => { await f.message(f.worker, f.sub); await event(f.c, f.t.id, f.worker.name, 'stuck'); await f.end(f.worker); await f.message(f.sub, f.worker); await f.end(f.sub); assert.equal((await f.message(f.lead, f.sub)).status, 202); await feed(f, f.sub, f.lead); await f.end(f.sub); await delay(300); assert.ok((await f.session(f.worker)).queue.length); assert.equal(f.submits(f.sub).filter(x => x.includes('Your turn ended')).length, 0); assert.equal((await f.session(f.sub)).quiet_stage || 0, 0); }));
