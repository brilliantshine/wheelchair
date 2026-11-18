'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { historyText, buildHandoffFile, validateHandoffFile, handoffFileName } = require('../app/handoff.js');
const at = '2026-11-17T12:00:00.000Z';
const id = 'abcdef123456';
function sample() { return buildHandoffFile({ id, title: 'A'.repeat(120), slug: 'a-plan', sent: [], cards: [] }, { head: 'a'.repeat(40), stage: 'approved', repository: 'github.com/owner/repo' }); }
function valid(value) { return validateHandoffFile(JSON.stringify(value)).ok; }
test('handoff validator checks schema, limits and unknown fields', () => {
  const file = sample();
  assert.equal(valid(file), true);
  assert.equal(validateHandoffFile('{').ok, false);
  for (const edit of [
    (f) => { f.thread.id = 'bad'; }, (f) => { f.version = 2; }, (f) => { f.extra = 1; },
    (f) => { f.thread.extra = 1; }, (f) => { f.history = [{ at, who: 'lead', kind: 'question', text: 'x', extra: 1 }]; },
    (f) => { f.history = [{ at, who: 'nobody', kind: 'question', text: 'x' }]; },
    (f) => { f.branch = 'wc/other'; }, (f) => { f.pr_url = 'url'; }, (f) => { f.stage = 'done'; },
  ]) { const changed = structuredClone(file); edit(changed); assert.equal(valid(changed), false); }
  assert.equal(validateHandoffFile(' '.repeat(10 * 1024 * 1024 + 1)).ok, false);
  file.stage = 'done'; file.pr_url = 'https://github.com/owner/repo/pull/1'; assert.equal(valid(file), true);
});
test('history renders shown cards and skips hidden and progress cards', () => {
  const cases = [
    [{ kind: 'question', question: 'Why?', options: [{ label: 'Yes' }], answered_value: 'Yes' }, ['Why?', 'Yes']],
    [{ kind: 'idea', bullets: [{ text: 'A' }] }, ['A']],
    [{ kind: 'approval', objections: [{ finding: 'F', reason: 'R' }], answered_action: 'start-building' }, ['F', 'R', 'start-building']],
    [{ kind: 'done', title: 'Done', can_do: ['C'], left_as_is: ['L'], pr_url: 'P' }, ['Done', 'C', 'L', 'P']],
    [{ kind: 'needs', title: 'N', body: 'B' }, ['N', 'B']],
    [{ kind: 'offer', summary: 'S', retracted_at: at }, ['S', 'withdrawn']],
    ...['stub', 'diagram', 'image'].map((kind) => [{ kind, title: 'T' }, ['T']]),
    [{ kind: 'sudo', command: 'cmd', state: 'ran', exit_code: 0 }, ['cmd', 'ran', 'exit 0']],
  ];
  for (const [card, parts] of cases) for (const part of parts) assert.match(historyText(card), new RegExp(part));
  assert.equal(historyText({ kind: 'progress' }), null); assert.equal(historyText({ kind: 'result' }), null);
});
test('history accumulates, orders and trims entries, and names downloads', () => {
  const old = '2026-11-16T12:00:00.000Z';
  const thread = { id, title: 'A title!', slug: 'plan', imported: { at: old, history: [{ at: old, who: 'lead', kind: 'message', text: 'prior' }] }, sent: [{ at: old, source: 'collin', text: 'excluded' }, { at, source: 'card', text: 'pressed' }], cards: [{ at, kind: 'needs', title: 'Notice', body: 'X'.repeat(21000) }, { at, kind: 'progress' }] };
  let file = buildHandoffFile(thread, { head: 'a'.repeat(40), stage: 'approved', repository: 'github.com/owner/repo' });
  assert.equal(file.history.length, 3); assert.equal(file.history[0].text, 'prior'); assert.equal(file.history[1].kind, 'press'); assert.match(file.history[2].text, /… \(cut\)$/); assert.ok(valid(file));
  thread.sent = Array.from({ length: 2100 }, (_, i) => ({ at, source: 'collin', text: String(i) })); thread.cards = [];
  file = buildHandoffFile(thread, { head: 'a'.repeat(40), stage: 'approved', repository: 'github.com/owner/repo' });
  assert.equal(file.history.length, 2000); assert.match(file.history[0].text, /102 earlier entries/); assert.ok(valid(file));
  thread.sent = Array.from({ length: 600 }, () => ({ at, source: 'collin', text: '😀'.repeat(10000) }));
  file = buildHandoffFile(thread, { head: 'a'.repeat(40), stage: 'approved', repository: 'github.com/owner/repo' });
  assert.ok(Buffer.byteLength(JSON.stringify(file)) <= 10 * 1024 * 1024); assert.match(file.history[0].text, /earlier entries/); assert.ok(valid(file));
  assert.equal(handoffFileName('Hello, WORLD!'), 'hello-world.wheelchair.json'); assert.equal(handoffFileName('!!!'), 'thread.wheelchair.json'); assert.equal(handoffFileName('a'.repeat(120)), `${'a'.repeat(60)}.wheelchair.json`);
});
