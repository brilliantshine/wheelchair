'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { makeDir } = require('./helpers/server.js');
const { Hub } = require('../app/hub.js');
const { validate } = require('../app/card.js');
const { addNeeds } = require('../app/views.js');
const { quietReason, buildHandoffFile, validateHandoffFile } = require('../app/handoff.js');

async function fixture() {
  const dir = await makeDir('reach-');
  const hub = new Hub({ stateDir: dir }); await hub.state.init();
  await fs.writeFile(path.join(dir, 'machines.json'), JSON.stringify({ host: { address: 'local', port: 7374 }, other: { address: 'remote' } }));
  await fs.writeFile(path.join(dir, 'machine.json'), JSON.stringify({ host: 'local', port: 7374 }));
  const make = (id, project) => ({ id: id.repeat(12), title: id, slug: 'test', machine: 'hub', project, cli: 'codex', sessions: [{ name: `lead-${id}`, role: 'lead', live: true, turn_ended: true, queue: [] }], cards: [], pinned: {}, queues: {} });
  const a = make('a', '/one'), b = make('b', '/two');
  hub.deliver = async () => {};
  await hub.state.save(a); await hub.state.save(b);
  const post = (id = b.id) => hub.acceptCard({ thread_id: a.id, session: 'lead-a', kind: 'reach', thread: id, why: 'Coordinate work' });
  const press = (card, value = 'allow') => hub.press(a.id, card.id, { action: 'picked', value });
  return { hub, a, b, post, press };
}
const rejects = (promise, status, message) => assert.rejects(promise, e => e.status === status && e.message === message);

test('validation and ordered post refusals', async () => {
  for (const card of [{ why: 'x' }, { thread: 'x' }]) assert.equal(validate('reach', card, 'lead').ok, false);
  assert.equal(validate('reach', { thread: 'x', why: 'x' }, 'worker').ok, false);
  assert.equal(validate('reach', { thread: 'x', why: 'First line\nSecond line' }, 'lead').ok, false);
  assert.equal(validate('reach', { thread: 'x', why: 'First line\rSecond line' }, 'lead').ok, false);
  assert.equal(validate('reach', { thread: 'x', why: 'One line' }, 'lead').ok, true);
  const cases = [
    ['missing', {}, 'no such thread'], ['self', {}, 'that is this thread'],
    ['target', { machine: 'other', archived: true }, 'that thread is on another machine'],
    ['target', { archived: true, handed_off: {} }, 'that thread is archived'],
    ['target', { handed_off: {} }, 'that thread was handed off'],
    ['target', { project: '/one', lead_links: ['aaaaaaaaaaaa'] }, 'already in your project; no OK needed'],
    ['target', { lead_links: ['aaaaaaaaaaaa'] }, 'already allowed'],
  ];
  for (const [which, changes, reason] of cases) {
    const { hub, a, b, post } = await fixture(); Object.assign(b, changes); await hub.state.save(b);
    const before = await hub.state.thread(a.id);
    await rejects(post(which === 'missing' ? 'cccccccccccc' : which === 'self' ? a.id : b.id), 422, reason);
    assert.deepEqual(await hub.state.thread(a.id), before);
  }
  const { post } = await fixture(); await post(); await rejects(post('cccccccccccc'), 422, 'a reach request is already open');
});

test('allow links only sender and permits reply, and handoff and Needs reflect state', async () => {
  const { hub, a, b, post, press } = await fixture(); b.title = undefined; b.slug = undefined; await hub.state.save(b); const card = await post();
  let current = await hub.state.thread(a.id); const needs = []; addNeeds(needs, current);
  assert.equal(card.target_title, 'two');
  assert.equal(card.title, 'Let this lead talk to two?');
  assert.equal(needs[0].title, 'Let this lead talk to two?');
  assert.ok(!needs[0].title.includes('undefined'));
  assert.equal(quietReason(hub, current), 'A request to talk to another project is waiting');
  const before = await hub.state.thread(b.id); await press(card);
  current = await hub.state.thread(a.id); assert.deepEqual(current.lead_links, [b.id]);
  assert.deepEqual(await hub.state.thread(b.id), before);
  const afterNeeds = []; addNeeds(afterNeeds, current); assert.deepEqual(afterNeeds, []);
  const file = buildHandoffFile(current, { head: 'a'.repeat(40), stage: 'approved', repository: 'github.com/a/b' });
  assert.equal(validateHandoffFile(JSON.stringify(file)).ok, true);
  assert.equal(file.history.find(e => e.kind === 'reach').text, 'Talk to two (two)\nCoordinate work\nallow');
  await hub.acceptCard({ thread_id: b.id, session: 'lead-b', kind: 'message', to: 'lead-a', text: 'reply' });
  assert.match((await hub.state.thread(a.id)).sessions[0].queue.at(-1).text, /reply/);
  await rejects(press(card), 422, 'card is already answered');
});

test('target changes, existing links and denial', async () => {
  for (const scenario of ['archived', 'linked', 'deny']) {
    const { hub, a, b, post, press } = await fixture(); const card = await post();
    if (scenario === 'archived') b.archived = true;
    if (scenario === 'linked') b.lead_links = [a.id];
    await hub.state.save(b); const before = await hub.state.thread(b.id);
    await press(card, scenario === 'deny' ? "don't allow" : 'allow');
    const thread = await hub.state.thread(a.id), answered = thread.cards[0];
    assert.equal(answered.answered, true); assert.equal(thread.lead_links, undefined);
    assert.deepEqual(await hub.state.thread(b.id), before);
    if (scenario === 'archived') { assert.equal(answered.allow_failed, 'that thread is archived'); assert.match(thread.sessions[0].queue[0].text, /allow failed: that thread is archived/); }
    else assert.match(thread.sessions[0].queue[0].text, /picked: /);
  }
});

test('retraction, bad presses and missing lead leave no link', async () => {
  const { hub, a, post, press } = await fixture(); const card = await post();
  await rejects(hub.press(a.id, card.id, { action: 'picked', value: 'yes' }), 400, 'unknown card press');
  let thread = await hub.state.thread(a.id); thread.sessions[0].live = false; await hub.state.save(thread);
  await rejects(press(card), 409, 'no live lead'); thread = await hub.state.thread(a.id); assert.equal(thread.cards[0].answered, false);
  thread.sessions[0].live = true; await hub.state.save(thread);
  await hub.acceptCard({ thread_id: a.id, session: 'lead-a', kind: 'retract', card: card.id, note: 'No longer needed' });
  await rejects(press(card), 422, 'this card was withdrawn');
  await post();
});
