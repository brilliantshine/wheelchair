'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Hub } = require('../app/hub.js');
const asides = require('../app/asides.js');
const settings = require('../app/settings.js');

test('assistant ids count hidden transcript text before filtering', () => {
  const { transcriptItems } = require('../app/hub.js');
  const rows = [{ type: 'user', origin: { kind: 'human' }, message: { content: '[wc:role] instructions' } }, { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'hidden' }] } }, { type: 'user', origin: { kind: 'human' }, message: { content: 'visible' } }, { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'answer' }] } }];
  assert.equal(transcriptItems('claude', rows.map(JSON.stringify).join('\n'), {}, 'lead').at(-1).id, 'lead#1');
});

test('aside turns fork, resume, save before ack, and retry failures', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wc-asides-'));
  const hub = new Hub({ stateDir: dir, root: path.resolve(__dirname, '../..'), graphCacheRoot: dir });
  await hub.state.init();
  const thread = { id: 'aside-test', project: '/tmp/repo', worktree: '/tmp/repo', machine: 'hub', sessions: [], asides: [], cards: [], pinned: {}, queues: {}, sent: [] };
  const aside = { id: 'a', number: 1, anchor: { quote: 'words' }, action: 'ask', provider: 'gpt', account: 'default-gpt', fork_parent: 'parent', cli_id: null, slot: 'standard', status: 'open', pending: [{ kind: 'start', text: 'why?' }], turn: null, history: [], failed: null };
  thread.asides.push(aside); await hub.save(thread);
  const original = settings.modelCommand;
  let modelPrefix = 'model';
  settings.modelCommand = async (_, args) => ({ stdout: args[0] === 'effort' ? 'high' : `${modelPrefix}-${args[1]}` });
  const turns = new Map(), posts = [];
  hub.call = async (_, route, method, body) => {
    if (route === '/v1/aside-turns' && method === 'POST') { posts.push(body); turns.set(body.turn_id, { state: 'running' }); return {}; }
    const id = route.split('/')[3];
    if (route.endsWith('/ack')) { assert.equal((await hub.thread(thread.id)).asides[0].turn, null); return {}; }
    if (!turns.has(id)) { const error = new Error('missing'); error.status = 404; throw error; }
    return turns.get(id);
  };
  try {
    await asides.pump(hub, thread.id);
    let current = (await hub.thread(thread.id)).asides[0];
    assert.equal(posts[0].mode, 'fork'); assert.equal(posts[0].from, 'parent'); assert.ok(posts[0].style);
    modelPrefix = 'changed';
    turns.set(current.turn.id, { state: 'ok', reply: 'answer', conversation_id: 'fork' });
    await asides.pump(hub, thread.id);
    current = (await hub.thread(thread.id)).asides[0]; assert.equal(current.history[0].reply, 'answer'); assert.equal(current.history[0].model, 'model-standard');
    const record = await hub.thread(thread.id); await asides.change(hub, record, record.asides[0], 'messages', { text: 'again' });
    await asides.pump(hub, thread.id); current = (await hub.thread(thread.id)).asides[0];
    assert.equal(posts[1].mode, 'resume'); assert.equal(posts[1].from, 'fork');
    turns.set(current.turn.id, { state: 'failed', error: 'failed' }); await asides.pump(hub, thread.id);
    current = (await hub.thread(thread.id)).asides[0]; assert.equal(current.failed, 'failed'); assert.equal(current.pending[0].text, 'again');
    const retry = await hub.thread(thread.id); await asides.change(hub, retry, retry.asides[0], 'retry', {}); await asides.pump(hub, thread.id);
    assert.match(posts[2].prompt, /again/);
    current = (await hub.thread(thread.id)).asides[0];
    turns.set(current.turn.id, { state: 'ok', reply: '[wc:step-up] difficult', conversation_id: 'fork' });
    await asides.pump(hub, thread.id);
    current = (await hub.thread(thread.id)).asides[0];
    assert.equal(current.slot, 'heavy'); assert.equal(current.history.at(-1).text, 'Thinking harder: difficult');
    assert.match(posts.at(-1).prompt, /again/); assert.match(posts.at(-1).prompt, /slot=heavy/);
    turns.set(current.turn.id, { state: 'ok', reply: 'better', conversation_id: 'fork' });
    const closing = await hub.thread(thread.id); await asides.change(hub, closing, closing.asides[0], 'close', { outcome: 'done' });
    const count = posts.length; await asides.pump(hub, thread.id);
    current = (await hub.thread(thread.id)).asides[0]; assert.equal(current.history.at(-1).reply, 'better'); assert.equal(posts.length, count);
    const reopen = await hub.thread(thread.id); await asides.change(hub, reopen, reopen.asides[0], 'messages', { text: 'new question' });
    await asides.pump(hub, thread.id); assert.match(posts.at(-1).prompt, /new question/);
    current = (await hub.thread(thread.id)).asides[0];
    await assert.rejects(() => asides.change(hub, current, current, 'summary', {}), { status: 409 });

  } finally { settings.modelCommand = original; }
});

test('step-up refusal retries once; controls never step up; graphs are saved', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wc-asides-edge-'));
  const saved = [], calls = [];
  const hub = new Hub({ stateDir: dir, graphCacheRoot: dir, saveGraph: async (file, value) => saved.push({ file, value }) });
  await hub.state.init();
  const aside = { id: 'a', number: 1, anchor: { quote: 'words' }, action: 'ask', provider: 'gpt', account: 'default-gpt', fork_parent: 'parent', cli_id: null, slot: 'standard', status: 'open', pending: [{ kind: 'start', text: 'why?' }], turn: null, history: [], failed: null };
  await hub.save({ id: 'edges', project: '/tmp/repo', worktree: '/tmp/repo', machine: 'hub', sessions: [], asides: [aside], cards: [], pinned: {}, queues: {}, sent: [] });
  const original = settings.modelCommand;
  settings.modelCommand = async (_, args) => { if (args.includes('heavy')) { const error = new Error('unused'); error.code = 3; throw error; } return { stdout: args[0] === 'effort' ? 'high' : 'model' }; };
  const machine = new Map();
  hub.call = async (_, route, method, body) => {
    if (route === '/v1/aside-turns') { calls.push(body); machine.set(body.turn_id, { state: 'running' }); return {}; }
    if (route.endsWith('/ack')) return {};
    const id = route.split('/')[3]; if (machine.has(id)) return machine.get(id);
    const error = new Error('missing'); error.status = 404; throw error;
  };
  try {
    await asides.pump(hub, 'edges'); let a = (await hub.thread('edges')).asides[0];
    machine.set(a.turn.id, { state: 'ok', conversation_id: 'fork', reply: '[wc:step-up] hard' });
    await asides.pump(hub, 'edges'); a = (await hub.thread('edges')).asides[0];
    assert.equal(a.history[0].text, "Can't think harder: the stronger model is off in Settings");
    assert.match(calls.at(-1).prompt, /Answer now; stepping up isn't available/);
    machine.set(a.turn.id, { state: 'ok', conversation_id: 'fork', reply: '[wc:step-up] again' });
    await asides.pump(hub, 'edges'); a = (await hub.thread('edges')).asides[0];
    assert.equal(a.failed, "The aside couldn't answer");
    let t = await hub.thread('edges'); await assert.rejects(() => asides.change(hub, t, t.asides[0], 'think-harder', {}), { status: 409 });
    await assert.rejects(() => asides.change(hub, t, t.asides[0], 'summary', {}), { status: 409 });
    t.asides[0].pending = [{ kind: 'control', text: '' }]; t.asides[0].failed = null; await hub.save(t);
    await asides.pump(hub, 'edges'); a = (await hub.thread('edges')).asides[0];
    machine.set(a.turn.id, { state: 'ok', conversation_id: 'fork', reply: '[wc:step-up] draft line' });
    await asides.pump(hub, 'edges'); a = (await hub.thread('edges')).asides[0]; assert.equal(a.history.at(-1).reply, 'draft line');
    t = await hub.thread('edges'); await asides.change(hub, t, t.asides[0], 'messages', { text: 'draw' });
    await asides.pump(hub, 'edges'); a = (await hub.thread('edges')).asides[0];
    machine.set(a.turn.id, { state: 'ok', conversation_id: 'fork', reply: 'Picture.\n```wc-graph\n{"nodes":[],"edges":[]}\n```' });
    await asides.pump(hub, 'edges'); a = (await hub.thread('edges')).asides[0];
    assert.equal(a.history.at(-1).reply, 'Picture.'); assert.equal(a.history.at(-1).graph, saved[0].file); assert.deepEqual(saved[0].value, { nodes: [], edges: [] });
  } finally { settings.modelCommand = original; }
});

test('dispatching turns recover a lost POST with the same id', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wc-asides-lost-'));
  const hub = new Hub({ stateDir: dir }); await hub.state.init();
  const aside = { id: 'a', anchor: { quote: 'words' }, action: 'ask', provider: 'gpt', account: 'default-gpt', fork_parent: 'parent', cli_id: null, slot: 'standard', status: 'open', pending: [], turn: { id: 'same-id', state: 'dispatching', message: { kind: 'start', text: 'why' } }, history: [], failed: null };
  await hub.save({ id: 'lost', project: '/tmp/repo', worktree: '/tmp/repo', machine: 'hub', sessions: [], asides: [aside], cards: [], pinned: {}, queues: {}, sent: [] });
  const original = settings.modelCommand; let configured = 'model';
  settings.modelCommand = async (_, args) => ({ stdout: args[0] === 'effort' ? 'high' : configured });
  const posts = []; hub.call = async (_, route, method, body) => {
    if (method === 'GET') { const error = new Error('missing'); error.status = 404; throw error; }
    posts.push(body); if (posts.length === 1) throw new Error('lost response'); return {};
  };
  try { await asides.pump(hub, 'lost'); configured = 'changed'; await asides.pump(hub, 'lost'); assert.equal(posts.length, 2); assert.equal(posts[0].turn_id, posts[1].turn_id); assert.equal(posts[1].model, 'model'); assert.equal(posts[1].effort, 'high'); assert.equal((await hub.thread('lost')).asides[0].turn.state, 'running'); }
  finally { settings.modelCommand = original; }
});

test('routes anchor lead messages, expose summaries, hand off and archive', async () => {
  const { Readable } = require('node:stream');
  const { handle } = require('../app/hub.js');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wc-asides-routes-'));
  const registered = [], calls = [], turns = new Map();
  const hub = new Hub({ stateDir: dir, registerGraph: async (p) => registered.push(p) }); await hub.state.init();
  const lead = { name: 'lead', role: 'lead', cli: 'claude', provider: 'claude', account: 'default-claude', account_dir: '/x/y', live: true, cli_session_id: 'parent', queue: [], ready: false };
  await hub.save({ id: 'routes', project: '/tmp/repo', worktree: '/tmp/repo', machine: 'hub', sessions: [lead], asides: [], cards: [], pinned: {}, queues: {}, sent: [], archived: false });
  const transcript = [ { type: 'user', origin: { kind: 'human' }, message: { content: 'Hi' } }, { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Hello words' }] } } ].map(JSON.stringify).join('\n');
  hub.call = async (_, route, method, body) => { calls.push({ route, method, body }); if (route.endsWith('/transcript')) return { data: transcript }; if (route === '/v1/sessions') return [{ name: 'lead', running: true, cli_session_id: 'listed-cli', codex_thread_id: 'listed-codex' }]; if (route === '/v1/aside-turns' && method === 'POST') { turns.set(body.turn_id, { state: 'running' }); return {}; } if (method === 'GET' && turns.has(route.split('/')[3])) return turns.get(route.split('/')[3]); if (method === 'DELETE' && route === '/v1/aside-turns/turn1') { const error = new Error('missing'); error.status = 404; throw error; } if (route === '/v1/archive') return { kept: [] }; if (method === 'GET') { const error = new Error('missing'); error.status = 404; throw error; } return {}; };
  const original = settings.modelCommand; settings.modelCommand = async () => ({ stdout: 'model' });
  async function request(method, suffix, body) {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]); req.method = method;
    let status, output; const res = { writeHead(code) { status = code; }, end(bytes) { output = JSON.parse(bytes); } };
    try { await handle(hub, req, res, new URL(`http://localhost/wheelchair/api/threads/routes${suffix}`), false); return { status, body: output }; } catch (error) { return { status: error.status, error: error.message }; }
  }
  try {
    await hub.event({ thread_id: 'routes', session: 'lead', type: 'turn-ended', codex_thread_id: 'event-codex' });
    assert.equal((await hub.thread('routes')).sessions[0].codex_thread_id, 'event-codex');
    await hub.pollDead();
    let listed = (await hub.thread('routes')).sessions[0];
    assert.equal(listed.cli_session_id, 'listed-cli'); assert.equal(listed.codex_thread_id, 'listed-codex');
    const chat = await request('GET', '/chat'); assert.equal(chat.body.items.at(-1).id, 'lead#0');
    assert.equal((await request('GET', '/chat')).body.items.at(-1).id, 'lead#0');
    const data = { message_id: 'lead#0', start: 0, end: 5, quote: 'Hello', action: 'ask' };
    assert.equal((await request('POST', '/asides', { ...data, message_id: 'worker#0' })).status, 400);
    let before = await hub.thread('routes'); before.sessions[0].cli_session_id = null; await hub.save(before);
    assert.equal((await request('POST', '/asides', data)).error, "the lead isn't ready yet");
    before.sessions[0].cli_session_id = 'parent'; await hub.save(before);
    settings.modelCommand = async () => { const error = new Error('unused'); error.code = 3; throw error; };
    assert.equal((await request('POST', '/asides', data)).error, 'asides need a Standard or Heavy model for claude in Settings');
    settings.modelCommand = async () => ({ stdout: 'model' });
    before = await hub.thread('routes'); before.sessions[0].provider = 'gpt'; await hub.save(before);
    const made = await request('POST', '/asides', data); assert.equal(made.status, 201); assert.equal(made.body.history, undefined);
    const id = made.body.id; assert.equal(made.body.fork_parent, 'listed-codex'); let t = await hub.thread('routes'); t.asides[0].history.push({ kind: 'start', text: '', reply: 'r', graph: '/tmp/a.json' }); await hub.save(t);
    t.asides[0].history.push({ kind: 'ask', text: 'Please explain', reply: 'first answer' }); await hub.save(t);
    assert.equal((await request('POST', `/asides/${id}/think-harder`, {})).status, 200);
    await asides.pump(hub, 'routes'); t = await hub.thread('routes');
    const post = calls.find((c) => c.route === '/v1/aside-turns' && c.method === 'POST');
    assert.equal(t.asides[0].slot, 'heavy'); assert.equal(post.body.account_dir, '/x/y'); assert.equal(post.body.from, 'listed-codex');
    assert.match(post.body.prompt, /\[wc:aside ask slot=heavy\]\n\nPlease explain/);
    turns.set(t.asides[0].turn.id, { state: 'ok', reply: 'better answer', conversation_id: 'fork' });
    await asides.pump(hub, 'routes'); t = await hub.thread('routes'); assert.equal(t.asides[0].history.at(-1).reply, 'better answer');
    const full = await request('GET', `/asides/${id}`); assert.equal(full.body.history.length, 3); assert.deepEqual(registered, ['/tmp/a.json']);
    assert.equal((await request('GET', '/chat')).body.asides[0].history, undefined);
    const closed = await request('POST', `/asides/${id}/close`, { outcome: 'changed', line: 'Use this' }); assert.equal(closed.status, 200);
    t = await hub.thread('routes'); assert.equal(t.asides[0].outcome, 'changed'); assert.equal(t.queues.lead[0].source, 'collin'); assert.match(t.queues.lead[0].text, /from aside 1 on: "Hello"/);
    t.asides[0].status = 'open'; t.asides[0].turn = { id: 'turn1', state: 'running', message: { kind: 'ask', text: 'test' } }; await hub.save(t);
    assert.equal((await request('POST', '/archive', {})).status, 200); assert.ok(calls.some((c) => c.route === '/v1/aside-turns/turn1' && c.method === 'DELETE'));
    const archived = await request('GET', `/asides/${id}`); assert.equal(archived.status, 200); assert.equal(archived.body.status, 'closed'); assert.equal(archived.body.history.at(-1).reply, 'better answer');
    for (const [suffix, body] of [['/asides', data], [`/asides/${id}/messages`, { text: 'again' }], [`/asides/${id}/close`, { outcome: 'done' }], [`/asides/${id}/retry`, {}], [`/asides/${id}/think-harder`, {}], [`/asides/${id}/summary`, {}]]) {
      const response = await request('POST', suffix, body); assert.equal(response.status, 409); assert.equal(response.error, 'this thread is archived');
    }
  } finally { settings.modelCommand = original; }
});

test('Think harder repeats the last question and summary observes its readiness gates', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wc-asides-controls-'));
  const hub = new Hub({ stateDir: dir }); await hub.state.init();
  const original = settings.modelCommand;
  settings.modelCommand = async (_, args) => ({ stdout: args[0] === 'effort' ? 'high' : 'heavy-model' });
  const a = { id: 'a', status: 'open', provider: 'gpt', slot: 'standard', cli_id: 'fork', turn: null, failed: null, pending: [], history: [{ kind: 'start', text: 'first', reply: 'one' }, { kind: 'ask', text: 'latest', reply: 'two' }, { kind: 'control', text: '', reply: 'draft' }] };
  const t = { id: 'controls', machine: 'hub', asides: [a], sessions: [], cards: [], pinned: {}, queues: {}, sent: [] };
  try {
    await hub.save(t); await asides.change(hub, t, a, 'think-harder', {});
    assert.equal(a.slot, 'heavy'); assert.deepEqual(a.pending, [{ kind: 'ask', text: 'latest' }]);
    await assert.rejects(() => asides.change(hub, t, a, 'think-harder', {}), { status: 409 });
    a.pending = []; await asides.change(hub, t, a, 'summary', {}); assert.deepEqual(a.pending, [{ kind: 'control', text: '' }]);
    a.turn = { id: 'busy', state: 'running', message: a.pending.shift() };
    await assert.rejects(() => asides.change(hub, t, a, 'summary', {}), { status: 409 });
  } finally { settings.modelCommand = original; }
});


test('a fresh hub selects stranded queued asides but not failed or archived ones', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wc-asides-restart-'));
  const first = new Hub({ stateDir: dir }); await first.state.init();
  const aside = { id: 'a', anchor: { quote: 'words' }, action: 'ask', provider: 'gpt', account: 'default-gpt', fork_parent: 'parent', slot: 'standard', status: 'open', pending: [{ kind: 'start', text: 'queued' }], turn: null, history: [], failed: null };
  const thread = { id: 'restart', project: '/tmp/repo', worktree: '/tmp/repo', machine: 'hub', sessions: [], asides: [aside], cards: [], pinned: {}, queues: {}, sent: [] };
  await first.save(thread);
  assert.equal(asides.needsPump({ ...thread, asides: [{ ...aside, failed: 'failed' }] }), false);
  assert.equal(asides.needsPump({ ...thread, archived: true }), false);
  const fresh = new Hub({ stateDir: dir }); await fresh.state.init();
  const original = settings.modelCommand; settings.modelCommand = async () => ({ stdout: 'model' });
  const posts = []; fresh.call = async (_, route, method, body) => { if (method === 'GET') { const error = new Error('missing'); error.status = 404; throw error; } posts.push({ route, body }); return {}; };
  try {
    await Promise.all((await fresh.allThreads()).filter(asides.needsPump).map(t => asides.pump(fresh, t.id)));
    assert.equal(posts.length, 1); assert.equal(posts[0].route, '/v1/aside-turns'); assert.match(posts[0].body.prompt, /queued/);
  } finally { settings.modelCommand = original; }
});

test('aside GET computes heavy usability from the model command without storing it', async () => {
  const { Readable } = require('node:stream'); const { handle } = require('../app/hub.js');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wc-asides-model-'));
  await fs.mkdir(path.join(dir, 'codex'));
  const script = path.join(dir, 'codex', 'model.sh');
  const hub = new Hub({ stateDir: path.join(dir, 'state'), root: dir, codeVersion: '' }); await hub.state.init();
  await hub.save({ id: 'model', sessions: [], asides: [{ id: 'a', provider: 'gpt', history: [] }], cards: [], pinned: {}, queues: {}, sent: [] });
  async function get() { const req = Readable.from([]); req.method = 'GET'; let body; const res = { writeHead() {}, end(bytes) { body = JSON.parse(bytes); } }; await handle(hub, req, res, new URL('http://localhost/wheelchair/api/threads/model/asides/a'), false); return body; }
  await fs.writeFile(script, '#!/bin/sh\nexit 3\n', { mode: 0o755 });
  assert.equal((await get()).heavy_usable, false);
  await fs.writeFile(script, '#!/bin/sh\necho model\n', { mode: 0o755 });
  assert.equal((await get()).heavy_usable, true);
  assert.equal((await hub.thread('model')).asides[0].heavy_usable, undefined);
});
