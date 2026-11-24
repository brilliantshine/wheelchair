'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { renderTurn } = require('../../connectors/hub-common.js');

const at = '2026-01-01T00:00:00Z';
const reply = { type: 'assistant', text: 'Reply', at };
const render = (human) => renderTurn({ human, at, replies: [reply] }, {});

test('assistant messages and presses retain attribution after style stripping', () => {
  assert.deepEqual(render('[wc:assistant] Hello\n\n[wc:style]\nstyle'), [
    { type: 'human', text: 'Hello', by: 'assistant', at }, reply,
  ]);
  assert.deepEqual(render('[wc:assistant] [card abc] picked: B'), [
    { type: 'human', text: 'Your assistant: Picked B', card: true, by: 'assistant', at }, reply,
  ]);
});

test('restart context identifies the assistant and handles malformed state', () => {
  for (const [state, text] of [
    ['{"assistant":true,"by":"assistant"}', 'Assistant restarted · starting fresh'],
    ['{"by":"assistant"}', 'Lead restarted by your assistant'],
    ['{}', 'Lead restarted'],
    ['{broken', 'Lead restarted'],
    ['null', 'Lead restarted'],
  ]) {
    assert.deepEqual(render(`[wc:context restart] Thread state:\n${state}`), [
      { type: 'context', text, context: 'restart', at }, reply,
    ]);
  }
});

test('ordinary messages and presses stay unchanged', () => {
  assert.deepEqual(render('Hello'), [{ type: 'human', text: 'Hello', at }, reply]);
  assert.deepEqual(render('[card abc] picked: B'), [{ type: 'human', text: 'Picked B', card: true, at }, reply]);
});
