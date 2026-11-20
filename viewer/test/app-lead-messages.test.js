'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { makeDir } = require('./helpers/server.js');
const { Hub, transcriptItems } = require('../app/hub.js');
const { buildAgents } = require('../app/agents.js');

async function fixture() {
  const dir = await makeDir('lead-messages-');
  const hub = new Hub({ stateDir: dir }); await hub.state.init();
  await fs.writeFile(path.join(dir, 'machines.json'), JSON.stringify({ host: { address: 'local', port: 7374 }, other: { address: 'remote' } }));
  await fs.writeFile(path.join(dir, 'machine.json'), JSON.stringify({ host: 'local', port: 7374 }));
  const make = (id, name) => ({ id: id.repeat(12), title: id, machine: 'hub', project: '/one', cli: 'codex', sessions: [{ name, role: 'lead', live: true, queue: [] }], cards: [], pinned: {}, queues: {} });
  const a = make('a', 'lead-a'), b = make('b', 'lead-b');
  hub.deliver = async () => {};
  await hub.state.save(a); await hub.state.save(b);
  const send = (from, to, extra = {}) => hub.acceptCard({ thread_id: from.id, session: from.sessions[0].name, kind: 'message', to, text: 'hello', ...extra });
  return { hub, a, b, send };
}

test('cross-thread refusals are ordered and store nothing', async () => {
  const cases = [
    ['missing', {}, 'no lead by that name'],
    ['lead-b', { machine: 'other', archived: true, handed_off: {}, project: '/two', sessions: [{ name: 'lead-b', role: 'lead', live: false }] }, 'that lead is on another machine'],
    ['lead-b', { archived: true, handed_off: {}, project: '/two', sessions: [{ name: 'lead-b', role: 'lead', live: false }] }, 'that thread is archived'],
    ['lead-b', { handed_off: {}, project: '/two', sessions: [{ name: 'lead-b', role: 'lead', live: false }] }, 'that thread was handed off'],
    ['lead-b', { project: '/two', sessions: [{ name: 'lead-b', role: 'lead', live: false }] }, 'that lead is in another project; ask the user with a reach card first'],
    ['lead-b', { sessions: [{ name: 'lead-b', role: 'lead', live: false }] }, 'that thread has no live lead right now'],
    ['lead-b', { sessions: [{ name: 'lead-b', role: 'worker', live: true }] }, 'no lead by that name'],
  ];
  for (const [to, change, reason] of cases) {
    const { hub, a, b, send } = await fixture(); Object.assign(b, change); await hub.state.save(b);
    const beforeA = await hub.state.thread(a.id), beforeB = await hub.state.thread(b.id);
    await assert.rejects(send(a, to), e => e.status === 422 && e.message === reason);
    assert.deepEqual(await hub.state.thread(a.id), beforeA); assert.deepEqual(await hub.state.thread(b.id), beforeB);
  }
});

test('restart routes to latest lead; cross-thread question is hidden in agents and chat', async () => {
  const { hub, a, b, send } = await fixture();
  b.sessions[0].live = false; b.sessions.push({ name: 'lead-new', role: 'lead', live: true, queue: [] }); await hub.state.save(b);
  const card = await send(a, 'lead-b', { asks: true });
  const sender = await hub.state.thread(a.id), target = await hub.state.thread(b.id);
  const text = target.sessions[1].queue[0].text;
  assert.equal(text, `[wc:from lead-a] [thread ${a.id}: a] [question ${card.id}] hello`);
  assert.deepEqual(target.queues['lead-new'], target.sessions[1].queue);
  assert.equal(buildAgents([sender])[0].session.question, null);
  const raw = [ { type: 'user', origin: { kind: 'human' }, message: { role: 'user', content: text } }, { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'hidden reply' }] } } ].map(JSON.stringify).join('\n');
  assert.deepEqual(transcriptItems('claude', raw, {}), []);
  await assert.rejects(send(a, 'lead-b', { passes_on: 'outside' }), e => e.status === 422 && e.message === 'passes_on names no question in this thread');
});

test('workers cannot cross threads', async () => {
  const { hub, a, b } = await fixture(); a.sessions.push({ name: 'worker', role: 'worker', live: true }); await hub.state.save(a);
  await assert.rejects(hub.acceptCard({ thread_id: a.id, session: 'worker', kind: 'message', to: 'lead-b', text: 'hello' }), e => e.status === 404 && e.message === 'session not found in thread');
});

test('simultaneous legacy leads exchange messages without deadlock', async () => {
  const { hub, a, b, send } = await fixture();
  await Promise.all([send(a, 'lead-b'), send(b, 'lead-a')]);
  assert.equal((await hub.state.thread(a.id)).sessions[0].queue.length, 1);
  assert.equal((await hub.state.thread(b.id)).sessions[0].queue.length, 1);
});

test('a link on either side permits messages in both directions', async () => {
  for (const owner of ['a', 'b']) {
    const { hub, a, b, send } = await fixture(); b.project = '/two';
    (owner === 'a' ? a : b).lead_links = [(owner === 'a' ? b : a).id];
    await hub.state.save(a); await hub.state.save(b);
    await send(a, 'lead-b'); await send(b, 'lead-a');
    assert.equal((await hub.state.thread(a.id)).sessions[0].queue.length, 1);
    assert.equal((await hub.state.thread(b.id)).sessions[0].queue.length, 1);
  }
});
