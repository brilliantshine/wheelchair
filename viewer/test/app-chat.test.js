'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { transcriptItems } = require('../app/hub.js');

function lines(rows) {
  return rows.map((row) => JSON.stringify(row)).join('\n');
}

test('renders a Claude human turn after unwrapping pasted content', () => {
  const transcript = lines([
    {
      type: 'user',
      origin: { kind: 'human' },
      message: { role: 'user', content: '\n<pasted_content id="1">Hello</pasted_content id="1">\n' },
    },
    {
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'Hi there.' }] },
    },
  ]);
  assert.deepEqual(transcriptItems('claude', transcript, {}).map((item) => item.text), [
    'Hello',
    'Hi there.',
  ]);
});

test('hides a Claude role turn and its reply', () => {
  const transcript = lines([
    {
      type: 'user',
      origin: { kind: 'human' },
      message: { role: 'user', content: '[wc:role] lead instructions' },
    },
    {
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'Hidden reply.' }] },
    },
  ]);
  assert.deepEqual(transcriptItems('claude', transcript, {}), []);
});

test('replaces a stub context marker and keeps its lead reply', () => {
  const transcript = lines([
    {
      type: 'user',
      origin: { kind: 'human' },
      message: { role: 'user', content: '[wc:context stub] prior summary' },
    },
    {
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'I have started.' }] },
    },
  ]);
  const items = transcriptItems('claude', transcript, { parent_title: 'Parent feature' });
  assert.deepEqual(items.map((item) => item.text), ['Started from Parent feature', 'I have started.']);
});

test('replaces a restart context marker and keeps its lead reply', () => {
  const transcript = lines([
    {
      type: 'user',
      origin: { kind: 'human' },
      message: { role: 'user', content: '[wc:context restart] saved state' },
    },
    {
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'Back at work.' }] },
    },
  ]);
  assert.deepEqual(transcriptItems('claude', transcript, {}).map((item) => item.text), [
    'Lead restarted',
    'Back at work.',
  ]);
});

test('renders a card press as a short Collin bubble', () => {
  const transcript = lines([
    {
      type: 'user',
      origin: { kind: 'human' },
      message: { role: 'user', content: '[card card-1] picked: Start building' },
    },
  ]);
  const item = transcriptItems('claude', transcript, {})[0];
  assert.equal(item.type, 'human');
  assert.equal(item.text, 'Picked Start building');
  assert.equal(item.card, true);
  assert.match(item.at, /^\d{4}-\d{2}-\d{2}T/);
});

test('collapses a Claude tool call to one chat item', () => {
  const transcript = lines([
    {
      type: 'user',
      origin: { kind: 'human' },
      message: { role: 'user', content: 'Run the check.' },
    },
    {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'Bash' }],
      },
    },
  ]);
  const items = transcriptItems('claude', transcript, {});
  assert.equal(items.at(-1).type, 'tool');
  assert.equal(items.at(-1).text, 'Bash');
  assert.match(items.at(-1).at, /^\d{4}-\d{2}-\d{2}T/);
});

test('ignores Codex injected entries before turn_context', () => {
  const transcript = lines([
    {
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: '# AGENTS.md injected instructions' }],
      },
    },
    { type: 'turn_context', payload: {} },
    {
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'Visible Codex message.' }],
      },
    },
  ]);
  assert.deepEqual(transcriptItems('codex', transcript, {}).map((item) => item.text), [
    'Visible Codex message.',
  ]);
});

test('collapses a Codex function call to one chat item', () => {
  const transcript = lines([
    { type: 'turn_context', payload: {} },
    {
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'Use a tool.' }],
      },
    },
    {
      type: 'response_item',
      payload: { type: 'function_call', name: 'shell' },
    },
  ]);
  const item = transcriptItems('codex', transcript, {}).at(-1);
  assert.equal(item.type, 'tool');
  assert.equal(item.text, 'shell');
  assert.match(item.at, /^\d{4}-\d{2}-\d{2}T/);
});

test('uses each transcript line timestamp for chat items', () => {
  const transcript = lines([
    {
      type: 'user', timestamp: '2026-11-14T10:00:00.000Z', origin: { kind: 'human' },
      message: { role: 'user', content: 'Timestamped request.' },
    },
    {
      type: 'assistant', timestamp: '2026-11-14T10:00:02.000Z',
      message: { role: 'assistant', content: [{ type: 'text', text: 'Timestamped response.' }] },
    },
  ]);
  assert.deepEqual(transcriptItems('claude', transcript, {}).map((item) => item.at), [
    '2026-11-14T10:00:00.000Z',
    '2026-11-14T10:00:02.000Z',
  ]);
});

test('a line without a timestamp takes the previous one, and Claude echoes are not repeated', () => {
  const transcript = lines([
    { type: 'user', origin: { kind: 'human' }, timestamp: '2026-11-14T10:00:00.000Z', message: { role: 'user', content: 'Go' } },
    { type: 'assistant', timestamp: '2026-11-14T10:00:05.000Z', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Bash' }] } },
    { type: 'progress', message: { role: 'assistant', content: [{ type: 'tool_use' }] } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] } },
  ]);
  const items = transcriptItems('claude', transcript, {});
  assert.deepEqual(items.map((item) => item.text), ['Go', 'Bash', 'Done.']);
  assert.equal(items.at(-1).at, '2026-11-14T10:00:05.000Z');
});
