'use strict';

const { makeTemp } = require('../../test-support/run-dir');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
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
  const dir = await makeTemp('wc-asides-');
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
    assert.equal(posts[0].mode, 'fork'); assert.equal(posts[0].from, 'parent'); assert.ok(posts[0].style); assert.equal(posts[0].access, 'read-only');
    await settings.update(hub, (value) => { value.aside_access = 'full'; });
    modelPrefix = 'changed';
    turns.set(current.turn.id, { state: 'ok', reply: 'answer', conversation_id: 'fork' });
    await asides.pump(hub, thread.id);
    current = (await hub.thread(thread.id)).asides[0]; assert.equal(current.history[0].reply, 'answer'); assert.equal(current.history[0].model, 'model-standard');
    const record = await hub.thread(thread.id); await asides.change(hub, record, record.asides[0], 'messages', { text: 'again' });
    await asides.pump(hub, thread.id); current = (await hub.thread(thread.id)).asides[0];
    assert.equal(posts[1].mode, 'resume'); assert.equal(posts[1].from, 'fork'); assert.equal(posts[1].access, 'full');
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
  const dir = await makeTemp('wc-asides-edge-');
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
  const dir = await makeTemp('wc-asides-lost-');
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
  const dir = await makeTemp('wc-asides-routes-');
  const registered = [], calls = [], turns = new Map();
  const hub = new Hub({ stateDir: dir, registerGraph: async (p) => registered.push(p) }); await hub.state.init();
  const lead = { name: 'lead', role: 'lead', cli: 'claude', provider: 'claude', account: 'default-claude', account_dir: '/x/y', live: true, cli_session_id: 'parent', queue: [], ready: false };
  await hub.save({ id: 'routes', project: '/tmp/repo', worktree: '/tmp/repo', machine: 'hub', sessions: [lead], asides: [], cards: [], pinned: {}, queues: {}, sent: [], archived: false });
  const transcript = [ { type: 'user', origin: { kind: 'human' }, message: { content: 'Hi' } }, { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Hello words' }] } } ].map(JSON.stringify).join('\n');
  hub.call = async (_, route, method, body) => { calls.push({ route, method, body }); if (route.split('?')[0].endsWith('/transcript')) return { data: transcript }; if (route === '/v1/sessions') return [{ name: 'lead', running: true, cli_session_id: 'listed-cli', codex_thread_id: 'listed-codex' }]; if (route === '/v1/aside-turns' && method === 'POST') { turns.set(body.turn_id, { state: 'running' }); return {}; } if (method === 'GET' && turns.has(route.split('/')[3])) return turns.get(route.split('/')[3]); if (method === 'DELETE' && route === '/v1/aside-turns/turn1') { const error = new Error('missing'); error.status = 404; throw error; } if (route === '/v1/archive') return { kept: [] }; if (method === 'GET') { const error = new Error('missing'); error.status = 404; throw error; } return {}; };
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
    let before = await hub.thread('routes');
    before.sessions[0].provider = 'gemini'; before.sessions[0].cli_session_id = null; await hub.save(before);
    const unavailable = await request('POST', '/asides', data);
    assert.equal(unavailable.status, 400);
    assert.equal(unavailable.error, "Side conversations aren't available on Antigravity sessions yet");
    before.sessions[0].provider = 'claude'; await hub.save(before);
    assert.equal((await request('POST', '/asides', data)).error, "the lead isn't ready yet");
    before.sessions[0].cli_session_id = 'parent'; await hub.save(before);
    settings.modelCommand = async () => { const error = new Error('unused'); error.code = 3; throw error; };
    assert.equal((await request('POST', '/asides', data)).error, 'asides need a Standard or Heavy model for claude in Settings');
    settings.modelCommand = async () => ({ stdout: 'model' });
    before = await hub.thread('routes'); before.sessions[0].provider = 'gpt'; await hub.save(before);
    const made = await request('POST', '/asides', data); assert.equal(made.status, 201); assert.equal(made.body.history, undefined);
    await asides.pump(hub, 'routes');
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
    await asides.pump(hub, 'routes'); t = await hub.thread('routes'); assert.equal(t.asides[0].outcome, 'changed'); assert.equal(t.queues.lead[0].source, 'user'); assert.match(t.queues.lead[0].text, /from aside 1 on: "Hello"/);
    t.asides[0].status = 'open'; t.asides[0].turn = { id: 'turn1', state: 'running', message: { kind: 'ask', text: 'test' } }; await hub.save(t);
    assert.equal((await request('POST', '/archive', {})).status, 200); assert.ok(calls.some((c) => c.route === '/v1/aside-turns/turn1' && c.method === 'DELETE'));
    const archived = await request('GET', `/asides/${id}`); assert.equal(archived.status, 200); assert.equal(archived.body.status, 'closed'); assert.equal(archived.body.history.at(-1).reply, 'better answer');
    for (const [suffix, body] of [['/asides', data], [`/asides/${id}/messages`, { text: 'again' }], [`/asides/${id}/close`, { outcome: 'done' }], [`/asides/${id}/retry`, {}], [`/asides/${id}/think-harder`, {}], [`/asides/${id}/summary`, {}]]) {
      const response = await request('POST', suffix, body); assert.equal(response.status, 409); assert.equal(response.error, 'this thread is archived');
    }
  } finally { settings.modelCommand = original; }
});

test('Think harder repeats the last question and summary observes its readiness gates', async () => {
  const dir = await makeTemp('wc-asides-controls-');
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
  const dir = await makeTemp('wc-asides-restart-');
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
  const dir = await makeTemp('wc-asides-model-');
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


test('slow machine calls leave routes free, coalesce pumps, and discard archived results', async () => {
  const { Readable } = require('node:stream');
  const { handle } = require('../app/hub.js');
  const dir = await makeTemp('wc-asides-slow-');
  const hub = new Hub({ stateDir: dir }); await hub.state.init();
  const aside = { id: 'a', status: 'open', provider: 'gpt', slot: 'standard', pending: [], failed: null, history: [], turn: { id: 'turn', state: 'running', message: { kind: 'ask', text: 'question' } } };
  await hub.save({ id: 'slow', project: '/tmp/repo', worktree: '/tmp/repo', machine: 'hub', sessions: [], asides: [aside], cards: [], pinned: {}, queues: {}, sent: [], archived: false });
  let release, entered;
  let held = new Promise((resolve) => { release = resolve; });
  let started = new Promise((resolve) => { entered = resolve; });
  let gets = 0, concurrent = 0, maxConcurrent = 0;
  hub.call = async (_, route, method) => {
    if (method === 'GET' && route === '/v1/aside-turns/turn') {
      gets++; concurrent++; maxConcurrent = Math.max(maxConcurrent, concurrent); entered();
      const result = await held; concurrent--; return result;
    }
    if (route === '/v1/archive') return { kept: [] };
    return {};
  };
  async function request(suffix, body) {
    const req = Readable.from([Buffer.from(JSON.stringify(body))]); req.method = 'POST';
    let status; const res = { writeHead(code) { status = code; }, end() {} };
    await handle(hub, req, res, new URL(`http://localhost/wheelchair/api/threads/slow${suffix}`), false);
    return status;
  }
  const first = asides.pump(hub, 'slow'); await started;
  try {
    await Promise.all(Array.from({ length: 5 }, () => asides.pump(hub, 'slow', { fromTimer: true })));
    assert.equal(gets, 1); assert.equal(maxConcurrent, 1);
    const closed = await Promise.race([request('/asides/a/close', { outcome: 'done' }), new Promise((_, reject) => setTimeout(() => reject(new Error('close waited for GET')), 1000))]);
    assert.equal(closed, 200); assert.equal((await hub.thread('slow')).asides[0].status, 'closed');
    release({ state: 'running' }); await first;
    assert.equal(gets, 2); assert.equal(maxConcurrent, 1);

    held = new Promise((resolve) => { release = resolve; });
    started = new Promise((resolve) => { entered = resolve; });
    const second = asides.pump(hub, 'slow'); await started;
    try {
      assert.equal(await request('/archive', {}), 200);
      release({ state: 'ok', reply: 'late answer', conversation_id: 'fork' }); await second;
      assert.deepEqual((await hub.thread('slow')).asides[0].history, []);
    } finally { release({ state: 'running' }); await second; }
  } finally { release({ state: 'running' }); await first; }
});

test('archive races compensate claimed turns without changing history', async (t) => {
  for (const scenario of ['before recheck', 'before post response', 'finished unheld']) {
    await t.test(scenario, async () => {
      const dir = await makeTemp('wc-asides-archive-');
      const hub = new Hub({ stateDir: dir }); await hub.state.init();
      const turn = { id: 'turn', state: scenario === 'finished unheld' ? 'running' : 'dispatching', message: { kind: 'ask', text: 'question' }, model: 'model' };
      const aside = { id: 'a', status: 'open', provider: 'gpt', account: 'default-gpt', fork_parent: 'parent', slot: 'standard', pending: [], failed: null, history: [{ kind: 'note', text: 'existing' }], turn };
      const id = `race-${scenario.replaceAll(' ', '-')}`;
      await hub.save({ id, project: '/tmp/repo', worktree: '/tmp/repo', machine: 'hub', sessions: [], asides: [aside], cards: [], pinned: {}, queues: {}, sent: [], archived: false });
      const calls = [];
      let release, entered;
      const held = new Promise((resolve) => { release = resolve; });
      const started = new Promise((resolve) => { entered = resolve; });
      const archive = () => hub.withThread(id, () => require('../app/threads.js').archive(hub, id));
      hub.call = async (_, route, method) => {
        calls.push({ route, method });
        if (route === '/v1/aside-turns/turn' && method === 'GET') {
          entered(); await held;
          if (scenario === 'finished unheld') return { state: 'ok', reply: 'late', conversation_id: 'fork' };
          const error = new Error('missing'); error.status = 404; throw error;
        }
        if (route === '/v1/aside-turns' && method === 'POST' && scenario === 'before post response') await archive();
        if (route === '/v1/archive') return { kept: [] };
        return {};
      };
      const pumping = asides.pump(hub, id); await started;
      try {
        if (scenario !== 'before post response') await archive();
        release(); await pumping;
        const post = calls.filter((c) => c.route === '/v1/aside-turns' && c.method === 'POST');
        assert.equal(post.length, scenario === 'before post response' ? 1 : 0);
        const deletes = calls.filter((c) => c.route === '/v1/aside-turns/turn' && c.method === 'DELETE');
        assert.equal(deletes.length, scenario === 'before post response' ? 2 : 1);
        const acks = calls.filter((c) => c.route === '/v1/aside-turns/turn/ack' && c.method === 'POST');
        assert.equal(acks.length, 0);
        assert.deepEqual((await hub.thread(id)).asides[0].history, [{ kind: 'note', text: 'existing' }]);
      } finally { release(); await pumping; }
    });
  }
});

test('a cancelled turn is never acknowledged, so a late start runs nothing', async () => {
  const dir = await makeTemp('wc-asides-cancelled-race-');
  const hub = new Hub({ stateDir: dir }); await hub.state.init();
  const turn = { id: require('node:crypto').randomUUID(), state: 'dispatching', message: { kind: 'ask', text: 'question' }, model: 'model' };
  const history = [{ kind: 'note', text: 'existing' }];
  const aside = { id: 'a', status: 'open', provider: 'gpt', account: 'default-gpt', fork_parent: 'parent', slot: 'standard', pending: [], failed: null, history, turn };
  await hub.save({ id: 'cancelled-race', project: '/tmp/repo', worktree: '/tmp/repo', machine: 'hub', sessions: [], asides: [aside], cards: [], pinned: {}, queues: {}, sent: [], archived: false });
  const known = new Map(), calls = []; let starts = 0, release, entered, postBody;
  const held = new Promise(resolve => { release = resolve; });
  const posting = new Promise(resolve => { entered = resolve; });
  const machine = async (_, route, method, body) => {
    calls.push({ route, method });
    if (route === `/v1/aside-turns/${turn.id}` && method === 'GET') {
      if (known.has(turn.id)) return known.get(turn.id);
      const error = new Error('missing'); error.status = 404; throw error;
    }
    if (route === `/v1/aside-turns/${turn.id}` && method === 'DELETE') {
      known.set(turn.id, { state: 'failed', error: 'stopped' }); return {};
    }
    if (route === `/v1/aside-turns/${turn.id}/ack` && method === 'POST') { known.delete(turn.id); return {}; }
    if (route === '/v1/aside-turns' && method === 'POST') {
      if (!known.has(body.turn_id)) { starts++; known.set(body.turn_id, { state: 'running' }); }
      return {};
    }
    if (route === '/v1/archive') return { kept: [] };
    throw new Error(`unexpected ${method} ${route}`);
  };
  hub.call = async (machineId, route, method, body) => {
    const result = await machine(machineId, route, method, body);
    if (route === '/v1/aside-turns' && method === 'POST') { postBody = body; entered(); await held; }
    return result;
  };
  const pumping = asides.pump(hub, 'cancelled-race'); await posting;
  try {
    assert.equal(starts, 1); assert.deepEqual(known.get(turn.id), { state: 'running' });
    await hub.withThread('cancelled-race', () => require('../app/threads.js').archive(hub, 'cancelled-race'));
    release(); await pumping;
    assert.equal(calls.filter(c => c.route === `/v1/aside-turns/${turn.id}/ack` && c.method === 'POST').length, 0);
    assert.deepEqual(known.get(turn.id), { state: 'failed', error: 'stopped' });
    await machine('hub', '/v1/aside-turns', 'POST', postBody);
    assert.equal(starts, 1); assert.deepEqual(known.get(turn.id), { state: 'failed', error: 'stopped' });
    const archived = await hub.thread('cancelled-race');
    assert.equal(archived.archived, true); assert.deepEqual(archived.asides[0].history, history);
  } finally { release(); await pumping; }
});

test('a stopped result after archive is never acknowledged, so a late start runs nothing', async () => {
  const dir = await makeTemp('wc-asides-stopped-race-');
  const hub = new Hub({ stateDir: dir }); await hub.state.init();
  const turn = { id: require('node:crypto').randomUUID(), state: 'dispatching', message: { kind: 'ask', text: 'question' }, model: 'model' };
  const history = [{ kind: 'note', text: 'existing' }];
  const aside = { id: 'a', status: 'open', provider: 'gpt', account: 'default-gpt', fork_parent: 'parent', slot: 'standard', pending: [], failed: null, history, turn };
  const id = 'stopped-race';
  await hub.save({ id, project: '/tmp/repo', worktree: '/tmp/repo', machine: 'hub', sessions: [], asides: [aside], cards: [], pinned: {}, queues: {}, sent: [], archived: false });
  const known = new Map(), calls = []; let starts = 0, release, entered, postBody, holdGet = false;
  const held = new Promise(resolve => { release = resolve; });
  const polling = new Promise(resolve => { entered = resolve; });
  const machine = async (_, route, method, body) => {
    calls.push({ route, method });
    if (route === `/v1/aside-turns/${turn.id}` && method === 'GET') {
      if (holdGet) { entered(); await held; }
      if (known.has(turn.id)) return known.get(turn.id);
      const error = new Error('missing'); error.status = 404; throw error;
    }
    if (route === `/v1/aside-turns/${turn.id}` && method === 'DELETE') { known.set(turn.id, { state: 'failed', error: 'stopped' }); return {}; }
    if (route === `/v1/aside-turns/${turn.id}/ack` && method === 'POST') { known.delete(turn.id); return {}; }
    if (route === '/v1/aside-turns' && method === 'POST') {
      postBody = body;
      if (!known.has(body.turn_id)) { starts++; known.set(body.turn_id, { state: 'running' }); }
      return {};
    }
    if (route === '/v1/archive') return { kept: [] };
    throw new Error(`unexpected ${method} ${route}`);
  };
  hub.call = machine;
  await asides.pump(hub, id);
  assert.equal(starts, 1); assert.deepEqual(known.get(turn.id), { state: 'running' });
  holdGet = true;
  const pumping = asides.pump(hub, id); await polling;
  try {
    await hub.withThread(id, () => require('../app/threads.js').archive(hub, id));
    assert.deepEqual(known.get(turn.id), { state: 'failed', error: 'stopped' });
    release(); await pumping;
    assert.equal(calls.filter(c => c.route === `/v1/aside-turns/${turn.id}/ack` && c.method === 'POST').length, 0);
    assert.deepEqual(known.get(turn.id), { state: 'failed', error: 'stopped' });
    await machine('hub', '/v1/aside-turns', 'POST', postBody);
    assert.equal(starts, 1); assert.deepEqual(known.get(turn.id), { state: 'failed', error: 'stopped' });
    const archived = await hub.thread(id);
    assert.equal(archived.archived, true); assert.deepEqual(archived.asides[0].history, history);
  } finally { release(); await pumping; }
});

test('archive tombstones a delayed POST whose response is lost', async () => {
  const dir = await makeTemp('wc-asides-tombstone-race-');
  const hub = new Hub({ stateDir: dir }); await hub.state.init();
  const turn = { id: require('node:crypto').randomUUID(), state: 'dispatching', message: { kind: 'ask', text: 'question' }, model: 'model' };
  const history = [{ kind: 'note', text: 'existing' }];
  const aside = { id: 'a', status: 'open', provider: 'gpt', account: 'default-gpt', fork_parent: 'parent', slot: 'standard', pending: [], failed: null, history, turn };
  await hub.save({ id: 'tombstone-race', project: '/tmp/repo', worktree: '/tmp/repo', machine: 'hub', sessions: [], asides: [aside], cards: [], pinned: {}, queues: {}, sent: [], archived: false });
  const known = new Map(), events = []; let starts = 0, release, entered;
  const held = new Promise(resolve => { release = resolve; });
  const posting = new Promise(resolve => { entered = resolve; });
  hub.call = async (_, route, method, body) => {
    if (route === `/v1/aside-turns/${turn.id}` && method === 'GET') {
      if (known.has(turn.id)) return known.get(turn.id);
      const error = new Error('missing'); error.status = 404; throw error;
    }
    if (route === `/v1/aside-turns/${turn.id}` && method === 'DELETE') {
      events.push('delete');
      if (!known.has(turn.id)) known.set(turn.id, { state: 'failed', error: 'stopped' });
      return {};
    }
    if (route === '/v1/aside-turns' && method === 'POST') {
      entered(); await held; events.push('post');
      if (!known.has(body.turn_id)) { starts++; known.set(body.turn_id, { state: 'running' }); }
      throw new Error('response timed out');
    }
    if (route === '/v1/archive') return { kept: [] };
    throw new Error(`unexpected ${method} ${route}`);
  };
  const pumping = asides.pump(hub, 'tombstone-race'); await posting;
  try {
    await hub.withThread('tombstone-race', () => require('../app/threads.js').archive(hub, 'tombstone-race'));
    assert.deepEqual(events, ['delete']);
    release(); await pumping;
    assert.deepEqual(events, ['delete', 'post']);
    assert.equal(starts, 0); assert.deepEqual(known.get(turn.id), { state: 'failed', error: 'stopped' });
    const archived = await hub.thread('tombstone-race');
    assert.equal(archived.archived, true); assert.deepEqual(archived.asides[0].history, history);
  } finally { release(); await pumping; }
});

test('a partly failed archive saves first and the hub retries the cancel', async () => {
  const dir = await makeTemp('wc-asides-retry-');
  const hub = new Hub({ stateDir: dir }); await hub.state.init();
  const id = 'partial-archive', ids = ['first-turn', 'second-turn'];
  const aside = (turnId) => ({ id: turnId, status: 'open', pending: [], history: [], turn: { id: turnId, state: 'running' } });
  await hub.save({ id, machine: 'hub', sessions: [], asides: ids.map(aside), cards: [], queues: {}, archived: false });
  const known = new Map(ids.map(turnId => [turnId, { state: 'running' }])), calls = []; let starts = 0, timeout = true;
  const machine = async (_, route, method, body) => {
    calls.push({ route, method });
    if (method === 'DELETE') {
      const saved = await hub.thread(id);
      assert.deepEqual(saved.asides.map(a => a.turn), [null, null]);
      const turnId = decodeURIComponent(route.split('/')[3]);
      if (turnId === ids[1] && timeout) { timeout = false; throw new Error('timeout'); }
      known.set(turnId, { state: 'failed', error: 'stopped' }); return {};
    }
    if (route.endsWith('/ack')) { known.delete(route.split('/')[3]); return {}; }
    if (route === '/v1/aside-turns' && method === 'POST') { if (!known.has(body.turn_id)) { starts++; known.set(body.turn_id, { state: 'running' }); } return {}; }
    if (route === '/v1/archive') return { kept: [] };
    throw new Error(`unexpected ${method} ${route}`);
  };
  hub.call = machine;
  await hub.withThread(id, () => require('../app/threads.js').archive(hub, id));
  let saved = await hub.thread(id);
  assert.equal(saved.archived, true); assert.deepEqual(saved.asides.map(a => a.turn), [null, null]); assert.deepEqual(saved.pending_cancels, [ids[1]]);
  await asides.pump(hub, id);
  await asides.sweepCancels(hub, id);
  saved = await hub.thread(id); assert.deepEqual(saved.pending_cancels, []);
  assert.equal(calls.filter(c => c.route.endsWith('/ack')).length, 0);
  assert.equal(calls.filter(c => c.method === 'DELETE' && c.route.endsWith(ids[1])).length, 2);
  await machine('hub', '/v1/aside-turns', 'POST', { turn_id: ids[1] });
  assert.equal(starts, 0); assert.deepEqual(known.get(ids[1]), { state: 'failed', error: 'stopped' });
});

test('a fresh hub retries pending cancels on init', async () => {
  const dir = await makeTemp('wc-asides-init-cancel-');
  const first = new Hub({ stateDir: dir }); await first.state.init();
  await first.save({ id: 'pending-init', machine: 'hub', pending_cancels: ['turn'], archived: true, sessions: [], asides: [], cards: [], queues: {} });
  const fresh = new Hub({ stateDir: dir }); const calls = [];
  fresh.call = async (machine, route, method) => { calls.push({ machine, route, method }); return {}; };
  await fresh.init();
  assert.deepEqual(calls, [{ machine: 'hub', route: '/v1/aside-turns/turn', method: 'DELETE' }]);
  assert.deepEqual((await fresh.thread('pending-init')).pending_cancels, []);
});

test('brief carries one graphs entry per history entry that has a graph, and drops history', () => {
  const out = asides.brief({ id: 'a', history: [{ kind: 'ask', text: 'q' }, { kind: 'ask', reply: 'r', graph: '/x/one.json' }, { kind: 'control' }, { graph: '/x/two.json' }] });
  assert.deepEqual(out.graphs, [{ entry: 1, path: '/x/one.json' }, { entry: 3, path: '/x/two.json' }]);
  assert.equal(out.history, undefined);
  assert.deepEqual(asides.brief({ id: 'b', history: [] }).graphs, []);
});
