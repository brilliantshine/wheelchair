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
  a.title = undefined; a.slug = undefined; a.project = '/one'; await hub.state.save(a);
  const card = await send(a, 'lead-b', { asks: true });
  const sender = await hub.state.thread(a.id), target = await hub.state.thread(b.id);
  const text = target.sessions[1].queue[0].text;
  assert.equal(text, `[wc:from lead-a] [thread ${a.id}: one] [question ${card.id}] hello`);
  assert.deepEqual(target.queues['lead-new'], target.sessions[1].queue);
  assert.equal(buildAgents([sender])[0].session.question, null);
  const raw = [ { type: 'user', origin: { kind: 'human' }, message: { role: 'user', content: text } }, { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'hidden reply' }] } } ].map(JSON.stringify).join('\n');
  assert.deepEqual(transcriptItems('claude', raw, {}), []);
  await assert.rejects(send(a, 'lead-b', { passes_on: 'outside' }), e => e.status === 422 && e.message === 'passes_on names no question in this thread');
});

test('receiving chat hides cross-thread traffic and retains ordinary turns', async () => {
  const { hub, a, b, send } = await fixture();
  b.sessions[0].cli = 'claude'; await hub.state.save(b);
  await send(a, 'lead-b', { asks: true });
  const delivered = (await hub.state.thread(b.id)).sessions[0].queue[0].text;
  const raw = [
    { type: 'user', origin: { kind: 'human' }, message: { role: 'user', content: 'ordinary user turn' } },
    { type: 'user', origin: { kind: 'human' }, message: { role: 'user', content: delivered } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'hidden reply' }] } },
  ].map(JSON.stringify).join('\n');
  hub.call = async () => ({ data: raw, gen: 'g', end: raw.length });
  const result = await hub.chat(b.id);
  const visible = JSON.stringify(result.items);
  assert.match(visible, /ordinary user turn/);
  assert.ok(!visible.includes(delivered));
  assert.ok(!visible.includes('hidden reply'));
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

test('ended lead holds a peer message and logs only the send', async () => {
  const { hub, a, b, send } = await fixture(); b.sessions[0].live = false; await hub.state.save(b);
  const card = await send(a, 'lead-b', { asks: true });
  assert.equal(card.held, true);
  const sender = await hub.state.thread(a.id), target = await hub.state.thread(b.id);
  assert.deepEqual(target.sessions[0].queue[0].peer, { thread: a.id, title: 'a', session: 'lead-a', question: card.id });
  assert.equal(target.peer_log, undefined);
  assert.deepEqual(sender.peer_log[0], { at: card.at, thread: b.id, title: 'b', session: 'lead-b', direction: 'sent', text: 'hello', question: card.id });
});

test('lead ending between acceptance and delivery holds the message', async () => {
  const { hub, a, b, send } = await fixture(); const original = hub.withThread.bind(hub);
  hub.withThread = async (id, fn) => { if (id === b.id) { const target = await hub.state.thread(id); target.sessions[0].live = false; await hub.state.save(target); } return original(id, fn); };
  let deliveries = 0; hub.deliver = async () => { deliveries++; };
  assert.equal((await send(a, 'lead-b')).held, true);
  const queue = (await hub.state.thread(b.id)).sessions[0].queue;
  assert.equal(queue.length, 1);
  assert.deepEqual(queue[0].peer, { thread: a.id, title: 'a', session: 'lead-a' });
  assert.equal(deliveries, 0);
});

test('pause persists outside capped log until user activity and counts only recent sends', async () => {
  const { hub, a, b, send } = await fixture(); const now = Date.now();
  const entry = { at: new Date(now - 1000).toISOString(), thread: b.id, title: 'b', session: 'lead-b', direction: 'sent', text: 'old' };
  a.peer_log = Array.from({ length: 20 }, () => ({ ...entry })); await hub.state.save(a);
  const reason = 'message limit reached with b: 20 messages within an hour; messaging that thread is paused until the user writes in this thread';
  await assert.rejects(send(a, 'lead-b'), e => e.status === 422 && e.message === reason);
  let stored = await hub.state.thread(a.id); assert.equal(stored.cards.length, 0); assert.ok(stored.peer_pauses[b.id]); assert.equal(stored.peer_log.at(-1).direction, 'limit');
  await assert.rejects(send(a, 'lead-b'), /message limit reached/); stored = await hub.state.thread(a.id); assert.equal(stored.peer_log.filter(x => x.direction === 'limit').length, 1);
  stored.peer_log = Array.from({ length: 200 }, () => ({ ...entry, thread: 'other' })); await hub.state.save(stored);
  await assert.rejects(send(a, 'lead-b'), /message limit reached/);
  const other = { ...b, id: 'c'.repeat(12), title: 'c', sessions: [{ name: 'lead-c', role: 'lead', live: true, queue: [] }], queues: {} }; await hub.state.save(other); await send(a, 'lead-c');
  stored = await hub.state.thread(a.id); stored.user_at = null; stored.peer_log = Array.from({ length: 20 }, () => ({ ...entry, at: new Date(now - 3600001).toISOString() })); delete stored.peer_pauses; await hub.state.save(stored);
  await send(a, 'lead-b');
});

test('user message and card press each lift a paused pair', async () => {
  for (const activity of ['message', 'press']) {
    const { hub, a, b, send } = await fixture();
    const past = Date.now() - 2000;
    a.peer_pauses = { [b.id]: new Date(past + 1000).toISOString() };
    a.peer_log = Array.from({ length: 20 }, () => ({ at: new Date(past).toISOString(), thread: b.id, direction: 'sent' }));
    a.cards.push({ id: 'merged', kind: 'merged' });
    await hub.state.save(a);
    await assert.rejects(send(a, 'lead-b'), /message limit reached/);
    if (activity === 'message') await hub.enqueue(await hub.thread(a.id), 'lead-a', 'User typed this', 'user');
    else await hub.press(a.id, 'merged', { action: 'keep' });
    const acted = await hub.thread(a.id);
    assert.ok(Date.parse(acted.user_at) > Date.parse(acted.peer_pauses[b.id]), activity);
    await send(a, 'lead-b');
  }
});

test('only sends after user activity count toward the pair limit', async () => {
  for (const activityAfterEntries of [true, false]) {
    const { hub, a, b, send } = await fixture(); const now = Date.now();
    a.peer_log = Array.from({ length: 20 }, () => ({ at: new Date(now - 2000).toISOString(), thread: b.id, direction: 'sent' }));
    a.user_at = new Date(now - (activityAfterEntries ? 1000 : 3000)).toISOString();
    await hub.state.save(a);
    if (activityAfterEntries) await send(a, 'lead-b');
    else await assert.rejects(send(a, 'lead-b'), /message limit reached/);
  }
});

test('accepted held message follows restart context on the new lead', async t => {
  const { setup, close, thread: makeThread } = require('./helpers/app.js');
  const c = await setup(); t.after(() => close(c));
  const sender = await makeThread(c), made = await makeThread(c);
  const hub = new Hub({ stateDir: c.state }); await hub.state.init();
  const target = await hub.thread(made.id); target.sessions[0].live = false; await hub.save(target);
  const senderThread = await hub.thread(sender.id); senderThread.title = 'Sending thread'; await hub.save(senderThread);
  const receipt = await hub.acceptCard({ thread_id: sender.id, session: sender.sessions[0].name, kind: 'message', to: target.sessions[0].name, text: 'held through restart' });
  assert.equal(receipt.held, true);
  const held = (await hub.thread(made.id)).sessions[0].queue[0];
  assert.deepEqual(held.peer, { thread: sender.id, title: senderThread.title, session: sender.sessions[0].name });
  const lead = await hub.restartLead(made.id);
  assert.match(lead.queue[0].text, /^\[wc:context restart\]/);
  assert.deepEqual(lead.queue[1], held);
});

test('successful submit records received and caps the peer log', async () => {
  const { hub, a, b, send } = await fixture();
  b.sessions[0].ready = true; b.sessions[0].turn_ended = true; b.peer_log = Array.from({ length: 200 }, (_, i) => ({ direction: 'sent', text: String(i) })); await hub.state.save(b);
  await send(a, 'lead-b', { asks: true });
  const target = await hub.state.thread(b.id); assert.equal(target.peer_log.length, 200);
  hub.call = async () => { throw new Error('offline'); };
  await require('../app/sessions.js').deliver(hub, target, target.sessions[0]);
  assert.equal((await hub.state.thread(b.id)).peer_log.length, 200); assert.equal(target.sessions[0].queue.length, 1);
  hub.call = async () => ({});
  await require('../app/sessions.js').deliver(hub, target, target.sessions[0]);
  const saved = await hub.state.thread(b.id); assert.equal(saved.peer_log.length, 200); assert.equal(saved.peer_log[0].text, '1'); assert.equal(saved.peer_log.at(-1).text, 'hello'); assert.equal(saved.peer_log.at(-1).direction, 'received'); assert.ok(saved.peer_log.at(-1).question);
});
