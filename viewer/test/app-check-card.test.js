'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validate, shown, roles } = require('../app/card');
const { acceptCard } = require('../app/cards');
const { press } = require('../app/threads');
const { buildHandoffFile, validateHandoffFile, historyText } = require('../app/handoff');
const head = 'a'.repeat(40), next = 'b'.repeat(40);
const step = { where: 'app', do: 'Open it', see: 'It opens', agent: 'matched' };
const check = { kind: 'check', head, update: 'Update', steps: [step] };
const valid = (c, role = 'lead') => validate('check', c, role).ok;
const done = (h = head, extra = {}) => ({ kind: 'done', head: h, created_at: '2026-01-02T00:00:00.000Z', ...extra });
function fixture(cards = []) {
  const thread = { id: '123456789abc', slug: 'test', cards: structuredClone(cards), pinned: {}, queues: {}, sessions: [{ name: 'lead', role: 'lead', live: true }] };
  const sent = [];
  const hub = { updateThread: async (_, fn) => fn(thread), thread: async () => thread, session: (_, name) => thread.sessions.find(s => s.name === name), enqueue: async (_, name, text) => sent.push({ name, text }), save: async () => {} };
  return { thread, hub, sent, post: (c = check) => acceptCard(hub, { ...c, thread_id: thread.id, session: 'lead' }) };
}
test('check schema validates required fields, limits and cross-field rules', () => {
  assert.ok(shown.has('check')); assert.deepEqual(roles.check, ['lead']); assert.ok(valid(check));
  for (const key of ['head', 'update', 'steps']) { const c = structuredClone(check); delete c[key]; assert.ok(!valid(c), key); }
  for (const key of ['where', 'do', 'see', 'agent']) { const c = structuredClone(check); delete c.steps[0][key]; assert.ok(!valid(c), key); }
  for (const c of [
    { ...check, head: 'A'.repeat(40) }, { ...check, head: 'a'.repeat(39) }, { ...check, update: 'x'.repeat(301) },
    { ...check, steps: [] }, { ...check, steps: Array(7).fill(step) }, { ...check, extra: 1 },
    ...[{ extra: 1 }, { where: 'other' }, { do: 'x'.repeat(301) }, { see: 'x'.repeat(301) }, { command: 'x' }, { agent: 'differed' }, { agent: 'unknown' }, { note: 'unwanted' }, { agent: 'broken' }, { agent: 'not-tried' }, { agent: 'broken', note: 'x\ny' }, { agent: 'broken', note: 'x'.repeat(301) }, { where: 'machine', command: 'x'.repeat(1001) }].map(change => ({ ...check, steps: [{ ...step, ...change }] })),
  ]) assert.ok(!valid(c), JSON.stringify(c).slice(0, 120));
  assert.ok(!valid(check, 'worker'));
  assert.ok(valid({ ...check, steps: [{ ...step, where: 'machine', command: 'x\ny', agent: 'not-tried', note: 'reason' }] }));
});
test('hub accepts only a current done head and one check per head', async () => {
  for (const cards of [[], [done(head, { retracted_at: 'now' })]]) await assert.rejects(fixture(cards).post(), { status: 422, message: 'post the done card first' });
  const imported = fixture([done()]); imported.thread.imported = { at: '2026-01-02T00:00:00.000Z' }; await assert.rejects(imported.post(), { status: 422, message: 'post the done card first' });
  const f = fixture([done()]); await assert.rejects(f.post({ ...check, head: next }), { status: 422, message: 'check head must match the latest done card' });
  await f.post(); await assert.rejects(f.post(), { status: 422, message: 'this done card already has a check card' });
  f.thread.cards.push(done(next)); await assert.rejects(f.post(), { status: 422, message: 'check head must match the latest done card' }); await f.post({ ...check, head: next });
});
test('press checks action, broken status, current head, answer and live lead before enqueue', async () => {
  for (const action of ['fix', 'leave', 'other']) {
    const f = fixture([done(), { ...check, id: 'c', answered: false }]);
    await assert.rejects(press(f.hub, f.thread.id, 'c', { action }), { status: 400, message: action === 'other' ? 'a check card has no buttons' : 'this check card has nothing to fix' });
    assert.equal(f.thread.cards[1].answered, false); assert.equal(f.sent.length, 0);
  }
  const broken = { ...check, id: 'c', answered: false, steps: [{ ...step, agent: 'broken', note: 'failed' }] };
  for (const action of ['fix', 'leave']) {
    const f = fixture([done(), broken]); await press(f.hub, f.thread.id, 'c', { action });
    assert.equal(f.thread.cards[1].answered, true); assert.equal(f.thread.cards[1].answered_action, action); assert.equal(f.thread.cards[1].answered_value, null);
    assert.equal(f.sent[0].text, `[card c] ${action === 'fix' ? 'fix what the check found' : 'leave it'}`);
    await assert.rejects(press(f.hub, f.thread.id, 'c', { action }), { status: 422, message: 'card is already answered' }); assert.equal(f.sent.length, 1);
  }
  for (const [change, action, status, message] of [
    [f => f.thread.cards.push(done(next)), 'fix', 422, 'a newer version was finished since'],
    [f => { f.thread.sessions[0].live = false; }, 'fix', 409, 'no live lead'],
    [() => {}, 'other', 400, 'a check card has no buttons'],
  ]) { const f = fixture([done(), broken]); change(f); await assert.rejects(press(f.hub, f.thread.id, 'c', { action }), { status, message }); assert.equal(f.thread.cards[1].answered, false); assert.equal(f.sent.length, 0); }
});
test('handoff preserves a maximum size check history and validates', () => {
  const steps = Array.from({ length: 6 }, (_, i) => ({ where: 'machine', do: 'd'.repeat(300), see: 's'.repeat(300), command: 'c'.repeat(1000), agent: i % 2 ? 'broken' : 'not-tried', note: 'n'.repeat(300) }));
  const card = { kind: 'check', head, update: 'u'.repeat(300), steps, created_at: '2026-01-02T00:00:00.000Z' }; const { created_at, ...input } = card; assert.ok(valid(input));
  const expected = [card.update, ...steps.flatMap((s, i) => [`${i + 1}. [machine] ${s.do} — see: ${s.see}`, s.command, i % 2 ? `(didn't work: ${s.note})` : `(not tried: ${s.note})`])].join('\n');
  assert.equal(historyText(card), expected);
  const f = fixture([card]); const file = buildHandoffFile(f.thread, { head, stage: 'done', repository: 'github.com/o/r', pr_url: 'https://github.com/o/r/pull/1' });
  assert.equal(file.history[0].text, expected); assert.ok(validateHandoffFile(JSON.stringify(file)).ok);
});
