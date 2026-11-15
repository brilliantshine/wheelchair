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

test('does not let Codex task_started open a human turn before turn_context', () => {
  const transcript = lines([
    { type: 'event_msg', payload: { type: 'task_started' } },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Injected before context.' }] } },
    { type: 'turn_context', payload: {} },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Actual human turn.' }] } },
  ]);
  assert.deepEqual(transcriptItems('codex', transcript, {}).map((item) => item.text), ['Actual human turn.']);
});

test('requires a fresh Codex turn_context for each turn', () => {
  const user = (text) => ({
    type: 'response_item',
    payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
  });
  const transcript = lines([
    { type: 'event_msg', payload: { type: 'task_started' } },
    user('first injected before context'),
    { type: 'turn_context', payload: {} },
    user('First real human message.'),
    // This rollout lacks task_started. Its first user entry still opens a new turn.
    user('second injected before context'),
    { type: 'turn_context', payload: {} },
    user('Second real human message.'),
  ]);
  assert.deepEqual(transcriptItems('codex', transcript, {}).map((item) => item.text), [
    'First real human message.',
    'Second real human message.',
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

test('folds a Claude tool result into its call, cut at 2000 characters', () => {
  const transcript = lines([
    { type: 'user', origin: { kind: 'human' }, message: { role: 'user', content: 'Run it.' } },
    {
      type: 'assistant',
      message: { role: 'assistant', content: [
        { type: 'tool_use', id: 'toolu_1', name: 'Bash', input: { command: 'ls /tmp' } },
        { type: 'tool_use', id: 'toolu_2', name: 'Read', input: { file_path: '/a' } },
      ] },
    },
    {
      type: 'user',
      message: { role: 'user', content: [
        { type: 'tool_result', tool_use_id: 'toolu_2', content: 'x'.repeat(2500) },
        { type: 'tool_result', tool_use_id: 'toolu_1', content: [{ type: 'text', text: 'file-one' }] },
      ] },
    },
  ]);
  const items = transcriptItems('claude', transcript, {}).filter((item) => item.type === 'tool');
  assert.equal(items.length, 2);
  assert.match(items[0].detail, /"command": "ls \/tmp"/);
  assert.match(items[0].detail, /Result:\nfile-one$/);
  assert.match(items[1].detail, /\[cut: 500 more characters\]$/);
  assert.ok(!items[1].detail.includes('x'.repeat(2001)));
});

test('folds a Codex function_call_output into its call', () => {
  const transcript = lines([
    { type: 'turn_context', payload: {} },
    { type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Go.' }] } },
    { type: 'response_item', payload: { type: 'function_call', name: 'shell', call_id: 'call_1', arguments: '{"cmd":"pwd"}' } },
    { type: 'response_item', payload: { type: 'function_call_output', call_id: 'call_1', output: '/work' } },
  ]);
  const items = transcriptItems('codex', transcript, {}).filter((item) => item.type === 'tool');
  assert.equal(items.length, 1);
  assert.equal(items[0].detail, 'Input:\n{"cmd":"pwd"}\n\nResult:\n/work');
});

test('GET /threads/:id/graph reads an archived thread graph from its branch, and nothing else', async () => {
  const { execFileSync } = require('node:child_process');
  const fs = require('node:fs/promises');
  const os = require('node:os');
  const path = require('node:path');
  const { api, close, setup, thread } = require('./helpers/app.js');
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'wc-graph-'));
  const git = (...args) => execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args]);
  git('init', '-q', '-b', 'main');
  await fs.mkdir(path.join(repo, 'docs/plans/demo/graphs'), { recursive: true });
  await fs.writeFile(path.join(repo, 'docs/plans/demo/graphs/flow.json'), '{"nodes":[{"id":"a"}]}');
  await fs.writeFile(path.join(repo, 'docs/plans/demo/secret.json'), '{"no":true}');
  git('add', '.');
  git('commit', '-q', '-m', 'graph');
  git('branch', 'wc/demo');
  const context = await setup();
  try {
    const made = await thread(context, { project: repo });
    const file = path.join(context.state, 'threads', `${made.id}.json`);
    const stored = JSON.parse(await fs.readFile(file, 'utf8'));
    Object.assign(stored, { branch: 'wc/demo', slug: 'demo' });
    await fs.writeFile(file, JSON.stringify(stored));
    const route = (name) => `/threads/${made.id}/graph?file=${encodeURIComponent(name)}`;
    assert.equal((await api(context, route('flow.json'))).status, 404, 'a live thread has a worktree instead');
    stored.archived = true;
    await fs.writeFile(file, JSON.stringify(stored));
    const good = await api(context, route('flow.json'));
    assert.equal(good.status, 200);
    assert.deepEqual(good.body, { nodes: [{ id: 'a' }] });
    for (const bad of ['../secret.json', 'graphs/../secret.json', 'flow.md', 'missing.json', '..']) {
      assert.equal((await api(context, route(bad))).status, 404, bad);
    }
  } finally {
    await close(context);
  }
});
