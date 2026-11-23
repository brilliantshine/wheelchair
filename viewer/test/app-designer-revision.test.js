'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, close, thread, machinePost, event, card } = require('./helpers/app.js');
const { Hub } = require('../app/hub.js');
const { buildAgents } = require('../app/agents.js');

async function run(role, fn) {
  const c = await setup({ env: { WHEELCHAIR_QUIET_GRACE_MS: '10000' } });
  try {
    const t = await thread(c); const lead = t.sessions[0];
    const start = async (starter, childRole) => {
      const r = await machinePost(c, '/machine/session', { calling_session: starter.name, action: 'start', role: childRole, attempt_id: childRole, brief: 'work' });
      assert.equal(r.status, 200); return r.body.session;
    };
    const agent = await start(lead, role);
    const hub = new Hub({ stateDir: c.state });
    const read = () => hub.thread(t.id);
    const session = async () => (await read()).sessions.find(s => s.name === agent.name);
    const post = (sender, body) => card(c, t.id, sender.name, body);
    const result = () => post(agent, { kind: 'result', task: 'mockups', outcome: 'done', summary: 'done' });
    const message = sender => post(sender, { kind: 'message', to: agent.name, text: 'follow up' });
    const end = () => event(c, t.id, agent.name, 'turn-ended');
    const delivered = async sender => {
      for (let i = 0; i < 100; i++) {
        const s = await session();
        if (!s.turn_ended && s.owes_reply && !s.queue?.length && c.machine.sessions.get(agent.name).submits.some(x => x.startsWith(`[wc:from ${sender.name}]`))) return s;
        await new Promise(r => setTimeout(r, 20));
      }
      assert.fail('message was not delivered');
    };
    await fn({ lead, agent, start, read, session, post, result, message, end, delivered });
  } finally { await close(c); }
}

test('designer reopens on starter delivery and owes a result after a status', () => run('designer', async f => {
  assert.equal((await f.result()).status, 202);
  assert.equal((await f.session()).finished, true);
  await f.end(); assert.equal((await f.message(f.lead)).status, 202);
  const s = await f.delivered(f.lead);
  assert.equal(s.finished, false);
  const root = buildAgents([await f.read()])[0];
  assert.notEqual(root.children.find(n => n.name === f.agent.name).state, 'finished');
  assert.equal((await f.post(f.agent, { kind: 'message', to: f.lead.name, text: 'still working' })).status, 202);
  assert.equal((await f.session()).owes_reply, true);
  assert.equal((await f.result()).status, 202);
  assert.equal((await f.session()).owes_reply, false);
  assert.equal((await f.session()).finished, true);
}));

test('another sender does not reopen a designer', () => run('designer', async f => {
  const other = await f.start(f.lead, 'mapper');
  assert.equal((await f.result()).status, 202);
  await f.end(); assert.equal((await f.message(other)).status, 202);
  assert.equal((await f.delivered(other)).finished, true);
}));

test('a mapper remains finished after its starter follows up', () => run('mapper', async f => {
  assert.equal((await f.result()).status, 202);
  await f.end(); assert.equal((await f.message(f.lead)).status, 202);
  assert.equal((await f.delivered(f.lead)).finished, true);
}));
