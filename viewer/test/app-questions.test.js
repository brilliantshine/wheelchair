'use strict';
require('./helpers/isolate-models.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeTemp } = require('../../test-support/run-dir');
const { validate } = require('../app/card');
const { acceptCard } = require('../app/cards');
const { buildAgents, agents } = require('../app/agents');

const question = { fits: 'Fits', question: 'Choose?', options: [{ id: 'a', label: 'A', consequence: 'A' }, { id: 'b', label: 'B', consequence: 'B' }], leaning: 'a', why: 'Reason' };
const sessions = () => [{ name: 'lead', role: 'lead', live: true }, { name: 'sub', role: 'sub-lead', started_by: 'lead', live: true }, { name: 'worker', role: 'worker', started_by: 'sub', live: true }];
const message = (id, session, to, passes_on) => ({ kind: 'message', id, session, to, asks: true, text: id, at: id, ...(passes_on && { passes_on }) });
const node = (root, name) => root.name === name ? root : root.children.map(c => node(c, name)).find(Boolean);
const record = cards => buildAgents([{ id: 't', title: 'T', sessions: sessions(), cards }])[0];
const tree = cards => record(cards).session;

test('optional question fields validate and old cards remain valid', () => {
  for (const value of [{ to: 'lead', text: 'Hi' }, { to: 'lead', text: 'Hi', asks: true, passes_on: 'id' }]) assert.equal(validate('message', value).ok, true);
  for (const value of [{ asks: 'true' }, { passes_on: 1 }]) assert.equal(validate('message', { to: 'lead', text: 'Hi', ...value }).ok, false);
  assert.equal(validate('question', question).ok, true);
  assert.equal(validate('question', { ...question, passes_on: 'id' }).ok, true);
  assert.equal(validate('question', { ...question, passes_on: false }).ok, false);
});

test('acceptance tags asking messages and refuses invalid references within the thread', async () => {
  const thread = { id: 't', sessions: sessions(), cards: [], queues: {}, pinned: {} };
  const hub = { updateThread: async (_, fn) => fn(thread), session: (t, name) => t.sessions.find(s => s.name === name), thread: async () => thread, deliver: async () => {} };
  const post = (session, card) => acceptCard(hub, { thread_id: 't', session, ...card });
  const asked = await post('worker', { kind: 'message', to: 'lead', text: 'Why?', asks: true });
  assert.equal(thread.sessions[0].queue[0].text, `[wc:from worker] [question ${asked.id}] Why?`);
  const plain = await post('worker', { kind: 'message', to: 'lead', text: 'Hello' });
  for (const id of ['unknown', plain.id, 'other-thread-id']) await assert.rejects(post('lead', { kind: 'question', ...question, passes_on: id }), /passes_on names no question in this thread/);
  assert.equal((await post('lead', { kind: 'question', ...question, passes_on: asked.id })).passes_on, asked.id);
});

test('paths and waiting questions follow direct and relayed cards and close on replies', () => {
  const first = message('1', 'worker', 'lead');
  const leadCard = { kind: 'question', id: '2', session: 'lead', at: '2', question: 'Choose?', passes_on: '1' };
  let root = tree([first, leadCard]);
  assert.deepEqual(record([first, leadCard]).question_paths, [['worker', 'lead']]);
  assert.equal(node(root, 'worker').question.card_id, '2');
  assert.deepEqual(node(root, 'worker').question.trail.map(h => h.who), ['worker', 'lead']);
  const relay = message('3', 'sub', 'lead', '1');
  const relayed = { ...leadCard, passes_on: '3' };
  root = tree([{ ...first, to: 'sub', text: 'x'.repeat(81) + '\nsecond' }, relay, relayed]);
  assert.deepEqual(record([{ ...first, to: 'sub' }, relay, relayed]).question_paths, [['worker', 'sub', 'lead']]);
  assert.equal(node(root, 'worker').question.trail[0].text, 'x'.repeat(79) + '…');
  assert.equal(node(tree([first, { kind: 'message', session: 'lead', to: 'worker' }]), 'worker').question, null);
  assert.equal(node(tree([message('4', 'sub', 'worker'), { kind: 'result', session: 'worker' }]), 'sub').question, null);
  for (const closed of [{ answered: true }, { retracted_at: 'now' }]) {
    root = tree([first, { ...leadCard, ...closed }]);
    assert.equal(node(root, 'worker').question, null);
    assert.deepEqual(record([first, { ...leadCard, ...closed }]).question_paths, []);
  }
  assert.equal(Object.hasOwn(root, 'question_paths'), false);
  assert.equal(Object.hasOwn(node(root, 'worker'), 'question_paths'), false);
  const loop = [message('a', 'worker', 'sub', 'b'), message('b', 'sub', 'lead', 'a'), { ...leadCard, passes_on: 'b' }];
  assert.ok(record(loop).question_paths[0].length <= 3);
});

test('agents hides raw activity state', async () => {
  const dir = await makeTemp('questions-');
  const now = new Date();
  const start = new Date(now.getTime() - 2000).toISOString();
  const ss = sessions();
  Object.assign(ss[2], { steps: [{ id: 's', kind: 'shell', key: 'shell:npm test', label: 'Run', started_at: start }], pending_ends: [1], turns: [1], step_counts: { shell: 1 } });
  const thread = { id: 't', title: 'T', project: '/project', sessions: ss, cards: [] };
  const hub = { stateDir: dir, allThreads: async () => [thread], machines: async () => ({}), state: { resolveMachine: async () => null } };
  const result = await agents(hub); const worker = node(result.leads[0].session, 'worker');
  for (const key of ['steps', 'pending_ends', 'turns', 'step_counts']) assert.equal(Object.hasOwn(worker, key), false);
});

test('delivery ids identify stored cards and both duplicate paths', async () => {
  const thread = { id: 't', sessions: sessions(), cards: [], queues: {}, pinned: {} };
  const hub = { updateThread: async (_, fn) => fn(thread), session: (t, name) => t.sessions.find(s => s.name === name) };
  const payload = { thread_id: 't', session: 'lead', kind: 'question', ...question, about_thread: '012345abcdef', delivery_id: 'delivery-one' };
  const card = await acceptCard(hub, payload);
  assert.equal(card.id, payload.delivery_id);
  assert.equal(card.about_thread, payload.about_thread);
  const duplicate = { ok: true, duplicate: true, id: payload.delivery_id };
  assert.deepEqual(await acceptCard(hub, payload), duplicate);
  thread.delivered_ids = [];
  assert.deepEqual(await acceptCard(hub, payload), duplicate);
  assert.equal(thread.cards.length, 1);
});

test('about_thread is a question-only lowercase thread id', () => {
  assert.equal(validate('question', { ...question, about_thread: '012345abcdef' }).ok, true);
  for (const about_thread of ['012345ABCDEf', '012345abcde', '012345abcdef0', 123456789012, null]) {
    assert.equal(validate('question', { ...question, about_thread }).ok, false);
  }
  assert.equal(validate('message', { to: 'lead', text: 'hello', about_thread: '012345abcdef' }).ok, false);
});
