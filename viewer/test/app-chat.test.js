'use strict';

const { makeTemp } = require('../../test-support/run-dir');

const assert = require('node:assert/strict');
const test = require('node:test');
const { transcriptItems } = require('../app/hub.js');
const { lastAssistantText } = require('../app/chat.js');
const { readFileSync } = require('node:fs');
const path = require('node:path');

function lines(rows) {
  return rows.map((row) => JSON.stringify(row)).join('\n');
}

test('renders Antigravity fixture turns, tools, timestamps and report', () => {
  const raw = readFileSync(path.join(__dirname, '../../machine/test/fixtures/agy/transcript-tools.jsonl'), 'utf8');
  const rows = raw.trim().split('\n').map(JSON.parse);
  const items = transcriptItems('agy', raw, {}, 'wc-x-lead');
  assert.deepEqual(items.map((item) => item.type), ['human', 'tool', 'tool', 'assistant', 'human', 'assistant']);
  assert.equal(items[0].text, 'Create a file named x.txt containing hi, then run `ls` and tell me what you saw.');
  assert.equal(items[1].text, 'write_file');
  assert.match(items[1].detail, /Created file\./);
  assert.doesNotMatch(items[1].detail, /Created At:/);
  assert.equal(items[2].text, 'run_command');
  assert.match(items[2].detail, /x\.txt/);
  assert.match(items[3].text, /^I created/);
  assert.equal(items[4].text, 'Reply with the word done.');
  assert.equal(items[5].text, 'done');
  assert.deepEqual(items.map((item) => item.at), [2, 3, 5, 7, 8, 9].map((i) => rows[i].created_at));
  assert.deepEqual([items[3].id, items[5].id], ['wc-x-lead#1', 'wc-x-lead#2']);
  assert.equal(lastAssistantText('agy', raw), 'done');
  assert.equal(lastAssistantText('agy', ''), '');
});

test('renders the single-turn Antigravity fixture', () => {
  const raw = readFileSync(path.join(__dirname, '../../machine/test/fixtures/agy/transcript.jsonl'), 'utf8');
  assert.deepEqual(transcriptItems('agy', raw, {}).map((item) => item.text), ['reply with the word ok', 'ok']);
});

test('skips unknown Antigravity rows and folds queued tool results in order', () => {
  const raw = lines([
    { type: 'USER_INPUT', content: ' <pasted_content id="1">Hello</pasted_content id="1"> ' },
    { type: 'PLANNER_RESPONSE', content: 'Working', tool_calls: [{ name: 'one', args: 'a' }, { args: 'b' }] },
    { type: 'UNKNOWN' },
    { type: 'GENERIC', content: 'Created At: today\nCompleted At: today\nfirst' },
    { type: 'GENERIC', content: 'second' },
  ]);
  const items = transcriptItems('agy', raw, {});
  assert.deepEqual(items.map((item) => item.text), ['Hello', 'Working', 'one', 'tool call']);
  assert.equal(items[2].detail, 'Input:\na\n\nResult:\nfirst');
  assert.equal(items[3].detail, 'Input:\nb\n\nResult:\nsecond');
});

test('reports unreadable nonempty Antigravity transcripts', () => {
  const notice = [{ type: 'notice', text: "Couldn't read this Antigravity transcript", at: new Date(0).toISOString() }];
  for (const raw of ['junk\nnot json', lines([{ type: 'UNKNOWN' }, { type: 'OTHER' }])]) {
    assert.deepEqual(transcriptItems('agy', raw, {}), notice);
  }
  assert.deepEqual(transcriptItems('agy', '  \n', {}), []);
});

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

test('renders a Claude message sent mid-turn as a Collin bubble, and skips task notices', () => {
  const transcript = lines([
    { type: 'user', origin: { kind: 'human' }, timestamp: '2026-11-14T10:00:00.000Z', message: { role: 'user', content: 'Start' } },
    { type: 'assistant', timestamp: '2026-11-14T10:00:01.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'Working.' }] } },
    { type: 'attachment', timestamp: '2026-11-14T10:00:02.000Z', attachment: { type: 'queued_command', prompt: 'Also this', commandMode: 'prompt', origin: { kind: 'human' } } },
    { type: 'attachment', timestamp: '2026-11-14T10:00:03.000Z', attachment: { type: 'queued_command', prompt: '<task-notification>x</task-notification>', commandMode: 'task-notification', origin: { kind: 'task-notification' } } },
    { type: 'assistant', timestamp: '2026-11-14T10:00:04.000Z', message: { role: 'assistant', content: [{ type: 'text', text: 'Got it.' }] } },
  ]);
  const items = transcriptItems('claude', transcript, {});
  assert.deepEqual(items.map((item) => [item.type, item.text]), [
    ['human', 'Start'], ['assistant', 'Working.'], ['human', 'Also this'], ['assistant', 'Got it.'],
  ]);
  assert.equal(items[2].at, '2026-11-14T10:00:02.000Z');
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
  const path = require('node:path');
  const { api, close, setup, thread } = require('./helpers/app.js');
  const repo = await makeTemp('wc-graph-');
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

test('chat versions, fallback and independent fresh report reads', async () => {
  const fs = require('node:fs/promises');
  const { chatTranscript, sessionTranscript } = require('../app/chat.js');
  const dir = await makeTemp('wc-chat-');
  const local = path.join(dir, 'local');
  const raw = lines([{ type: 'USER_INPUT', content: '[wc:context stub]' }, { type: 'PLANNER_RESPONSE', content: 'answer' }]);
  await fs.writeFile(local, lines([{ type: 'USER_INPUT', content: 'local' }]));
  let now = 1, result = { status: 'full', gen: '1-2', end: 10, data: raw }; const routes = [];
  const hub = { now: () => now, call: async (_, route) => { routes.push(route); if (result instanceof Error) throw result; return result; } };
  const thread = { id: 't', machine: 'm', parent_title: 'First' }, session = { name: 'lead', cli: 'agy', transcript_path: local };
  const first = await chatTranscript(hub, thread, session);
  assert.equal(first[0].text, 'Started from First');
  result = { status: 'unchanged', gen: '1-2', end: 10 }; now++;
  assert.strictEqual(await chatTranscript(hub, thread, session), first, 'unchanged reuses the parsed array');
  assert.equal(new URL(routes.at(-1), 'http://test').searchParams.get('known'), '1-2:10');
  result = { status: 'full', gen: '1-2', end: 11, data: raw };
  assert.notStrictEqual(await chatTranscript(hub, thread, session), first);
  thread.parent_title = 'Second';
  assert.equal((await chatTranscript(hub, thread, session))[0].text, 'Started from Second');
  assert.equal(new URL(routes.at(-1), 'http://test').searchParams.get('known'), '-');
  result = { data: raw }; const old = await chatTranscript(hub, thread, session);
  assert.notStrictEqual(await chatTranscript(hub, thread, session), old);
  assert.equal(new URL(routes.at(-1), 'http://test').searchParams.get('known'), '-');
  for (const reply of [{ status: 'unavailable' }, { status: 'full', data: '' }, { data: '' }, { status: 'other' }, new Error('timeout')]) {
    result = reply; assert.deepEqual(await chatTranscript(hub, thread, session), old);
    assert.equal(await sessionTranscript(hub, thread, session), await fs.readFile(local, 'utf8'));
    assert.ok(!routes.at(-1).includes('?'));
    hub.transcriptCache.clear();
    assert.equal((await chatTranscript(hub, thread, session))[0].text, 'local');
    assert.equal(hub.transcriptCache.size, 0);
    result = { data: raw }; await chatTranscript(hub, thread, session);
  }
  hub.transcriptCache.clear(); result = { data: raw };
  assert.equal(await sessionTranscript(hub, thread, session), raw);
  assert.equal(hub.transcriptCache.size, 0);
  result = { status: 'unavailable' }; session.cli = 'unknown'; session.transcript_path = null;
  assert.match((await chatTranscript(hub, thread, session))[0].text, /no transcript reader/);
});

test('idle sweep protects queued aside and timer drops idle entries', async () => {
  const { Hub, sweepTranscripts } = require('../app/hub.js'); const asides = require('../app/asides.js'); const settings = require('../app/settings.js');
  const dir = await makeTemp('wc-chat-sweep-'); let now = 0;
  const hub = new Hub({ stateDir: dir, now: () => now, transcriptSweepInterval: 10 }); await hub.init();
  const thread = { id: 'cutoff', machine: 'm', project: '/tmp', sessions: [{ role: 'lead', name: 'lead', cli: 'claude', live: true, cli_session_id: 'parent' }], cards: [], pinned: {}, queues: {}, asides: [] };
  await hub.save(thread);
  const raw = lines([{ type: 'user', origin: { kind: 'human' }, message: { content: 'hello' } }, { type: 'assistant', message: { role: 'assistant', content: 'answer' } }]);
  let available = true; hub.call = async () => available ? { status: 'full', gen: '1-2', end: 10, data: raw } : { status: 'unavailable' };
  await hub.chat(thread.id); available = false;
  let release; const gate = new Promise((resolve) => { release = resolve; });
  const held = hub.withThread(thread.id, () => gate);
  const original = settings.modelCommand; settings.modelCommand = async () => ({ stdout: 'model' });
  try {
    const queued = hub.withThread(thread.id, async () => asides.create(hub, await hub.thread(thread.id), { message_id: 'lead#0', start: 0, end: 1, quote: 'a', action: 'ask' }));
    now = 600001; sweepTranscripts(hub);
    release(); await held; assert.equal((await queued).anchor.message_id, 'lead#0');
    await new Promise((resolve) => setImmediate(resolve));
    now += 600001;
    await new Promise((resolve) => setTimeout(resolve, 40)); assert.equal(hub.transcriptCache.size, 0);
  } finally { release(); clearInterval(hub.transcriptTimer); settings.modelCommand = original; }
});

test('machine seen writes are reserved synchronously and throttled', async () => {
  const { Hub } = require('../app/hub.js'); let now = 0, writes = 0;
  const hub = new Hub({ now: () => now });
  hub.client.call = async () => ({}); hub.state.markMachineSeen = async () => { writes++; await new Promise((resolve) => setImmediate(resolve)); };
  await hub.call('m', '/'); assert.equal(hub.machineSeen('m'), new Date(0).toISOString());
  now = 1000; await hub.call('m', '/');
  assert.equal(writes, 1); assert.equal(hub.machineSeen('m'), new Date(1000).toISOString());
  now = 61000; await Promise.all([hub.call('m', '/'), hub.call('m', '/')]); assert.equal(writes, 2);
});

test('versioned fake machine serves full and unchanged transcripts', async () => {
  const { startMachine } = require('./helpers/app-machine.js');
  const machine = await startMachine('secret', { versionedTranscripts: true });
  try {
    machine.sessions.set('lead', { transcript: 'hello' });
    const get = async (query) => (await fetch(`http://127.0.0.1:${machine.port}/v1/sessions/lead/transcript${query}`, { headers: { 'x-wheelchair-machine-secret': 'secret' } })).json();
    const full = await get('?known=-'); assert.equal(full.status, 'full'); assert.equal(full.data, 'hello');
    assert.deepEqual(await get(`?known=${full.gen}:${full.end}`), { status: 'unchanged', gen: full.gen, end: full.end });
    assert.deepEqual(await get(''), { offset: 5, data: 'hello' });
  } finally { await machine.stop(); }
});
