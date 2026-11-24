'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { api, card, close, machinePost, setup, thread } = require('./helpers/app.js');

test('assistant lifecycle, visibility, refusals and fresh context', async () => {
  const c = await setup();
  try {
    const normal = await thread(c);
    assert.equal((await api(c, '/settings')).body.assistant, 'off');
    assert.deepEqual((await api(c, '/assistant')).body, { on: false });
    const toggle = (assistant) => api(c, '/settings/preferences', { method: 'PUT', body: { assistant } });
    assert.equal((await toggle('on')).status, 200);
    const status = (await api(c, '/assistant')).body;
    assert.equal(status.on, true); assert.equal(status.lead_live, true);
    const id = status.thread;
    let listed = (await api(c, '/threads')).body.threads;
    assert.equal(listed.filter((t) => t.assistant).length, 1);
    const assistant = listed.find((t) => t.id === id);
    assert.equal(assistant.project, null); assert.equal(assistant.title, 'Personal assistant');
    const lead = assistant.sessions[0];
    const start = c.machine.calls.find((x) => x.path === '/v1/sessions' && x.body.thread_id === id).body;
    assert.equal(start.assistant, true); assert.equal(start.prompt_role, 'assistant');
    for (const key of ['project', 'project_dir', 'worktree']) assert.equal(Object.hasOwn(start, key), false);
    assert.equal((await toggle('on')).status, 200);
    assert.equal((await api(c, '/threads')).body.threads.filter((t) => t.assistant).length, 1);
    assert.match(JSON.stringify((await api(c, `/threads/${id}/archive`, { method: 'POST', body: {} })).body), /assistant can't be archived/);
    assert.match(JSON.stringify((await api(c, `/threads/${id}/asides`, { method: 'POST', body: {} })).body), /no asides in the assistant thread/);
    assert.match(JSON.stringify((await card(c, id, lead.name, { kind: 'offer', summary: 'No' })).body), /assistant doesn't post offer/);
    assert.match(JSON.stringify((await machinePost(c, '/machine/session', { calling_session: lead.name, action: 'start', role: 'worker', attempt_id: 'x' })).body), /assistant starts threads, not helpers/);
    const peers = await machinePost(c, '/machine/session', { calling_session: normal.sessions[0].name, action: 'leads', all_projects: true });
    assert.equal(peers.status, 200); assert.equal(JSON.stringify(peers.body).includes(id), false);
    assert.equal(JSON.stringify((await api(c, '/agents')).body).includes(id), true);
    assert.equal((await api(c, '/new-thread')).body.previous.includes(null), false);
    assert.equal(JSON.stringify((await api(c, '/features')).body).includes(id), false);
    assert.equal((await toggle('off')).status, 200);
    assert.equal(c.machine.sessions.get(lead.name).running, false);
    assert.deepEqual((await api(c, '/assistant')).body, { on: false });
    for (const route of [`/threads/${id}`, `/threads/${id}/chat`]) {
      const response = await api(c, route); assert.equal(response.status, 404); assert.match(JSON.stringify(response.body), /the assistant is off/);
    }
    assert.equal((await api(c, `/threads/${id}/restart`, { method: 'POST', body: {} })).status, 404);
    assert.equal((await api(c, '/threads')).body.threads.some((t) => t.id === id), false);
    assert.equal(JSON.stringify((await api(c, '/features')).body).includes(id), false);
    assert.equal(JSON.stringify((await api(c, '/agents')).body).includes(id), false);
    const file = path.join(c.state, 'threads', `${id}.json`);
    const stored = JSON.parse(await fs.readFile(file, 'utf8'));
    stored.sessions[0].queue = [{ text: 'still waiting', source: 'user' }, { text: '[card q] picked: yes', source: 'card' }];
    stored.cards.push({ id: 'q', kind: 'question', question: 'Old?', answered: false }, { id: 'n', kind: 'needs', title: 'Old need', answered: false });
    stored.sent.push({ text: 'secret history', source: 'user' });
    await fs.writeFile(file, JSON.stringify(stored));
    assert.equal((await toggle('on')).status, 200);
    const after = JSON.parse(await fs.readFile(file, 'utf8'));
    const next = after.sessions.at(-1);
    const context = next.queue.find((m) => m.source === 'context').text;
    assert.equal(context, `[wc:context restart] Thread state:\n${JSON.stringify({ thread: id, title: 'Personal assistant', assistant: true })}`);
    assert.ok(next.queue.some((m) => m.text === 'still waiting'));
    assert.ok(!next.queue.some((m) => m.source === 'card'));
    for (const old of after.cards.filter((x) => ['q', 'n'].includes(x.id))) assert.equal(old.retracted_note, 'The assistant restarted');
    const restartStart = c.machine.calls.filter((x) => x.path === '/v1/sessions' && x.body.thread_id === id).at(-1).body;
    assert.equal(Object.hasOwn(restartStart, 'worktree'), false);
  } finally { await close(c); }
});

test('account switching sends assistant identity without a project', async () => {
  const { Hub } = require('../app/hub.js');
  const settings = require('../app/settings.js');
  const sessions = require('../app/sessions.js');
  const { makeDir } = require('./helpers/server.js');
  const hub = new Hub({ stateDir: await makeDir('assistant-switch-') }); await hub.state.init();
  const calls = [];
  hub.machines = async () => ({ hub: { name: 'hub' } });
  hub.call = async (machine, path, method, body) => {
    calls.push({ path, body });
    if (path === '/v1/status') return { claude: { installed: true }, accounts: [{ id: 'default-claude', cli: 'claude', logged_in: true }, { id: 'second', cli: 'claude', logged_in: true }] };
    return { accepted: true };
  };
  await settings.update(hub, (s) => { s.accounts.push({ id: 'second', provider: 'claude', name: 'Second', plan: 'unknown', weight: 1, paused: false }); s.held_back.worker = false; });
  await hub.save({ id: 'assistant-switch', assistant: true, title: 'Personal assistant', project: null, machine: 'hub', sessions: [{ name: 'agent', role: 'lead', provider: 'claude', account: 'default-claude', model: 'saved', live: true, ready: true, turn_ended: false, queue: [] }], cards: [], queues: {}, sent: [] });
  await sessions.event(hub, { thread_id: 'assistant-switch', session: 'agent', type: 'limit-hit', limited_until: new Date(Date.now() + 3600000).toISOString() });
  for (let i = 0; i < 100 && !calls.some((c) => c.path.endsWith('/switch')); i++) await new Promise((resolve) => setTimeout(resolve, 20));
  const request = calls.find((c) => c.path.endsWith('/switch'));
  assert.ok(request); assert.equal(request.body.assistant, true);
  assert.equal(Object.hasOwn(request.body, 'project'), false); assert.equal(Object.hasOwn(request.body, 'project_dir'), false);
});

test('assistant actions authenticate, list, send, press, restart and archive', async () => {
  const c = await setup();
  try {
    const normal = await thread(c);
    const call = (calling_session, body) => machinePost(c, '/machine/assistant', { calling_session, ...body });
    assert.match((await call(normal.sessions[0].name, { action: 'threads' })).body.error, /assistant is off/);
    await api(c, '/settings/preferences', { method: 'PUT', body: { assistant: 'on' } });
    const status = (await api(c, '/assistant')).body;
    const assistant = (await api(c, `/threads/${status.thread}/chat`)).body.thread.sessions[0].name;
    assert.equal((await call(normal.sessions[0].name, { action: 'threads' })).status, 403);
    assert.equal((await call(assistant, { action: 'thread', thread: status.thread })).status, 403);
    const question = await card(c, normal.id, normal.sessions[0].name, { kind: 'question', fits: 'Fits', question: 'Choose?', options: [{ id: 'a', label: 'Yes', consequence: 'Yes' }, { id: 'b', label: 'No', consequence: 'No' }], leaning: 'a', why: 'Why' });
    assert.equal(question.status, 202);
    const listed = await call(assistant, { action: 'threads' });
    assert.equal(listed.status, 200);
    assert.equal(listed.body.threads.some((t) => t.id === status.thread), false);
    assert.equal(listed.body.threads.find((t) => t.id === normal.id).waiting[0].text, 'Choose?');
    const msg = await call(assistant, { action: 'message', thread: normal.id, text: 'Please proceed' });
    assert.deepEqual(msg.body, { ok: true, queued: true });
    const detail = await call(assistant, { action: 'thread', thread: normal.id });
    assert.ok(detail.body.queued.includes('[wc:assistant] Please proceed'));
    assert.ok(Array.isArray(detail.body.recent));
    const pressed = await call(assistant, { action: 'press', thread: normal.id, card: question.body.id, press_action: 'picked', value: 'Yes' });
    assert.equal(pressed.body.ok, true);
    const after = (await api(c, `/threads/${normal.id}/chat`)).body;
    assert.equal(after.cards.find((x) => x.id === question.body.id).answered_by, 'assistant');
    assert.ok((await call(assistant, { action: 'thread', thread: normal.id })).body.queued.some((s) => s.startsWith(`[wc:assistant] [card ${question.body.id}]`)));
    const created = await call(assistant, { action: 'start', project: '/tmp/project', machine: 'hub', message: 'A useful title\nDetails' });
    assert.equal(created.body.ok, true);
    const createdThread = (await api(c, `/threads/${created.body.thread}/chat`)).body.thread;
    assert.equal(createdThread.title, 'A useful title');
    assert.ok(createdThread.sessions[0].queue.some((x) => x.text === '[wc:assistant] A useful title\nDetails'));
    assert.equal(JSON.stringify(created.body).includes('token'), false);
    const savedPath = path.join(c.state, 'threads', `${created.body.thread}.json`);
    let saved = JSON.parse(await fs.readFile(savedPath, 'utf8'));
    saved.sessions[0].live = false;
    await fs.writeFile(savedPath, JSON.stringify(saved));
    const noLead = await call(assistant, { action: 'message', thread: created.body.thread, text: 'hello' });
    assert.match(noLead.body.error, /no live lead; restart it first/);
    const restarted = await call(assistant, { action: 'restart', thread: created.body.thread });
    assert.equal(restarted.body.ok, true);
    assert.equal(JSON.stringify(restarted.body).includes('token'), false);
    saved = JSON.parse(await fs.readFile(savedPath, 'utf8'));
    assert.match(saved.sessions.at(-1).queue.find((x) => x.source === 'context').text, /"by":"assistant"/);
    saved.handed_off = { at: new Date().toISOString() };
    saved.cards.push({ id: 'sudo-test', kind: 'sudo', answered: false });
    await fs.writeFile(savedPath, JSON.stringify(saved));
    assert.match((await call(assistant, { action: 'message', thread: created.body.thread, text: 'hello' })).body.error, /handed off/);
    saved.handed_off = null;
    await fs.writeFile(savedPath, JSON.stringify(saved));
    assert.match((await call(assistant, { action: 'press', thread: created.body.thread, card: 'sudo-test', press_action: 'decline' })).body.error, /a root command needs you/);
    const assistantPath = path.join(c.state, 'threads', `${status.thread}.json`);
    const source = JSON.parse(await fs.readFile(assistantPath, 'utf8'));
    source.peer_log = Array.from({ length: 20 }, () => ({ direction: 'sent', thread: created.body.thread, at: new Date(Date.now() + 1000).toISOString() }));
    await fs.writeFile(assistantPath, JSON.stringify(source));
    assert.match((await call(assistant, { action: 'message', thread: created.body.thread, text: 'overflow' })).body.error, /message limit/);
    const archived = await call(assistant, { action: 'archive', thread: created.body.thread });
    assert.equal(archived.body.ok, true);
    assert.equal((await api(c, `/threads/${created.body.thread}/chat`)).body.thread.archived_by, 'assistant');
  } finally { await close(c); }
});

test('assistant command retries reads but not writes and reports failures as JSON', async () => {
  const http = require('node:http');
  const { spawn } = require('node:child_process');
  let calls = 0, alwaysFail = false;
  const server = http.createServer((request, response) => {
    calls++;
    response.writeHead(alwaysFail || calls === 1 ? 503 : 200, { 'content-type': 'application/json' });
    response.end(alwaysFail || calls === 1 ? '{"error":"hub unavailable"}' : '{"threads":[]}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const run = (...args) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, '../app/wc.js'), 'assistant', ...args], { env: { ...process.env, WHEELCHAIR_SESSION_TOKEN: 'test', WHEELCHAIR_MACHINE_URL: `http://127.0.0.1:${server.address().port}` } });
    let stdout = '', stderr = ''; child.stdout.on('data', (x) => { stdout += x; }); child.stderr.on('data', (x) => { stderr += x; }); child.on('error', reject); child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
  try {
    const write = await run('archive', 'some-thread');
    assert.equal(write.code, 0); assert.equal(calls, 1); assert.deepEqual(JSON.parse(write.stdout), { ok: false, error: 'hub unavailable' });
    calls = 0; alwaysFail = false;
    const read = await run('threads');
    assert.equal(read.code, 0); assert.equal(calls, 2); assert.deepEqual(JSON.parse(read.stdout), { threads: [] });
    const invalid = await run('message'); assert.equal(invalid.code, 0); assert.equal(JSON.parse(invalid.stdout).ok, false);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

async function assistantFixture() {
  const c = await setup();
  await api(c, '/settings/preferences', { method: 'PUT', body: { assistant: 'on' } });
  const id = (await api(c, '/assistant')).body.thread;
  const name = (await api(c, `/threads/${id}/chat`)).body.thread.sessions[0].name;
  return { c, id, call: (body) => machinePost(c, '/machine/assistant', { calling_session: name, ...body }) };
}

async function editThread(c, id, edit) {
  const file = path.join(c.state, 'threads', `${id}.json`);
  const value = JSON.parse(await fs.readFile(file, 'utf8'));
  edit(value);
  await fs.writeFile(file, JSON.stringify(value));
}

test('browser thread creation ignores the private assistant title', async () => {
  const c = await setup();
  try {
    const made = await thread(c, { message: 'Browser title', _assistant_title: 'Injected title' });
    assert.equal(made.title, 'Browser title');
  } finally { await close(c); }
});

test('threads lists both registered machines and includes archives only on request', async () => {
  const { c, id, call } = await assistantFixture();
  try {
    const file = path.join(c.state, 'machines.json');
    const machines = JSON.parse(await fs.readFile(file, 'utf8'));
    machines.second = { ...machines.hub, name: 'second' };
    await fs.writeFile(file, JSON.stringify(machines));
    const local = await thread(c), remote = await thread(c, { machine: 'second' }), archived = await thread(c);
    await editThread(c, archived.id, (t) => { t.archived = true; });
    const normal = (await call({ action: 'threads' })).body.threads;
    assert.ok(normal.some((t) => t.id === local.id && t.machine === 'hub'));
    assert.ok(normal.some((t) => t.id === remote.id && t.machine === 'second'));
    assert.ok(!normal.some((t) => t.id === archived.id || t.id === id));
    const all = (await call({ action: 'threads', archived: true })).body.threads;
    assert.ok(all.some((t) => t.id === archived.id));
    assert.ok(!all.some((t) => t.id === id));
  } finally { await close(c); }
});

test('start reports the saved thread and URL when lead launch fails', async () => {
  const { c, call } = await assistantFixture();
  try {
    c.machine.startOk = false;
    const result = (await call({ action: 'start', project: '/tmp/project', machine: 'hub', message: 'Saved before failure' })).body;
    assert.equal(result.ok, false); assert.match(result.error, /start refused/);
    assert.ok(result.thread); assert.equal(result.url, `/wheelchair/app/thread?id=${result.thread}`);
    assert.equal((await api(c, `/threads/${result.thread}/chat`)).body.thread.title, 'Saved before failure');
  } finally { await close(c); }
});

test('assistant press attribution is cleared by a later browser press on the same idea', async () => {
  const { c, call } = await assistantFixture();
  try {
    const t = await thread(c);
    const idea = await card(c, t.id, t.sessions[0].name, { kind: 'idea', bullets: [{ id: 'a', text: 'First' }] });
    assert.equal((await call({ action: 'press', thread: t.id, card: idea.body.id, press_action: 'picked', value: 'First' })).body.ok, true);
    let cards = (await api(c, `/threads/${t.id}/chat`)).body.cards;
    assert.equal(cards.find((x) => x.id === idea.body.id).answered_by, 'assistant');
    const response = await api(c, `/threads/${t.id}/cards/${idea.body.id}/press`, { method: 'POST', body: { action: 'picked', value: 'First' } });
    assert.equal(response.status, 202);
    cards = (await api(c, `/threads/${t.id}/chat`)).body.cards;
    assert.equal(Object.hasOwn(cards.find((x) => x.id === idea.body.id), 'answered_by'), false);
  } finally { await close(c); }
});

test('approval recheck refreshes Ready without attributing an answer', async () => {
  const { c, call } = await assistantFixture();
  try {
    const t = await thread(c);
    await editThread(c, t.id, (v) => v.cards.push({ id: 'refresh', kind: 'approval', answered: false, ready: { ok: false, missing: ['stale'] } }));
    const result = await call({ action: 'press', thread: t.id, card: 'refresh', press_action: 'recheck' });
    assert.equal(result.body.ok, true); assert.equal(result.body.result.queued, false);
    const refreshed = (await api(c, `/threads/${t.id}/chat`)).body.cards.find((x) => x.id === 'refresh');
    assert.notDeepEqual(refreshed.ready, { ok: false, missing: ['stale'] });
    assert.equal(refreshed.answered, false); assert.equal(Object.hasOwn(refreshed, 'answered_by'), false);
  } finally { await close(c); }
});

test('press and archive results do not expose session tokens', async () => {
  const { c, call } = await assistantFixture();
  try {
    const t = await thread(c); const token = 'sensitive-session-token-123';
    await editThread(c, t.id, (v) => { v.sessions[0].token = token; v.cards.push({ id: 'token-card', kind: 'idea', bullets: [] }); });
    const pressed = await call({ action: 'press', thread: t.id, card: 'token-card', press_action: 'picked', value: 'yes' });
    assert.equal(pressed.body.ok, true); assert.ok(!JSON.stringify(pressed.body).includes(token));
    const archived = await call({ action: 'archive', thread: t.id });
    assert.equal(archived.body.ok, true); assert.ok(!JSON.stringify(archived.body).includes(token));
  } finally { await close(c); }
});

test('message and restart refuse archived threads and restart refuses handed-off threads', async () => {
  const { c, call } = await assistantFixture();
  try {
    const t = await thread(c);
    await editThread(c, t.id, (v) => { v.archived = true; });
    for (const action of ['message', 'restart']) assert.match((await call({ action, thread: t.id, text: 'hello' })).body.error, /archived/);
    await editThread(c, t.id, (v) => { v.archived = false; v.handed_off = { at: new Date().toISOString() }; });
    assert.match((await call({ action: 'restart', thread: t.id })).body.error, /handed off/);
  } finally { await close(c); }
});

test('every assistant action refuses the assistant thread as a target', async () => {
  const { c, id, call } = await assistantFixture();
  try {
    for (const action of ['projects', 'threads', 'thread', 'start', 'message', 'press', 'restart', 'archive']) {
      const response = await call({ action, thread: id, project: '/tmp/project', machine: 'hub', message: 'hello', text: 'hello', card: 'x', press_action: 'picked', value: 'yes' });
      assert.equal(response.status, 403, action); assert.match(response.body.error, /assistant thread cannot be a target/, action);
    }
  } finally { await close(c); }
});

test('assistant CLI sends the contents of message and text files', async () => {
  const http = require('node:http'); const { spawn } = require('node:child_process');
  const received = [];
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    received.push(JSON.parse(Buffer.concat(chunks).toString()));
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { makeDir } = require('./helpers/server.js'); const dir = await makeDir('assistant-files-');
  const file = path.join(dir, 'message.txt'); await fs.writeFile(file, 'First line\nSecond line\n');
  const run = (...args) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, '../app/wc.js'), 'assistant', ...args], { env: { ...process.env, WHEELCHAIR_SESSION_TOKEN: 'test', WHEELCHAIR_MACHINE_URL: `http://127.0.0.1:${server.address().port}` } });
    let out = ''; child.stdout.on('data', (x) => { out += x; }); child.on('error', reject); child.on('close', (code) => resolve({ code, out }));
  });
  try {
    assert.equal((await run('start', '--project', '/tmp/project', '--machine', 'hub', '--message-file', file)).code, 0);
    await fs.writeFile(file, 'Different message\n');
    assert.equal((await run('message', 'target', '--text-file', file)).code, 0);
    assert.equal(received[0].message, 'First line\nSecond line\n'); assert.equal(received[1].text, 'Different message\n');
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('the thread guard reads without writing, so it cannot overwrite a concurrent change', async () => {
  const { Hub } = require('../app/hub.js');
  const assistant = require('../app/assistant.js');
  const { makeDir } = require('./helpers/server.js');
  const hub = new Hub({ stateDir: await makeDir('assistant-guard-') }); await hub.state.init();
  // An older thread with a cli and a session but no provider: hub.thread() would migrate it and save.
  const old = { ...require('../app/threads.js').emptyThread({ project: '/tmp/x', machine: 'hub' }), cli: 'claude', sessions: [{ name: 's', role: 'lead', live: true }] };
  delete old.provider;
  await hub.save(old);
  const saves = []; const save = hub.state.save.bind(hub.state);
  hub.state.save = (t) => { saves.push(t.id); return save(t); };
  await assistant.guard(hub, old.id);
  assert.deepEqual(saves, []);
});


test('assistant reads omit aside conversations', async () => {
  const { c, call } = await assistantFixture();
  try {
    const t = await thread(c);
    const secret = 'unique-private-aside-987';
    await editThread(c, t.id, (v) => { v.asides = [{ id: 'a', history: [{ reply: secret, graph: secret }] }]; });
    const listed = (await call({ action: 'threads' })).body;
    const detail = (await call({ action: 'thread', thread: t.id })).body;
    assert.ok(!JSON.stringify(listed).includes(secret));
    assert.ok(!JSON.stringify(detail).includes(secret));
  } finally { await close(c); }
});

test('assistant reads refresh local plan status like features', async () => {
  const { c, call } = await assistantFixture();
  try {
    const t = await thread(c);
    const { makeDir } = require('./helpers/server.js');
    const worktree = await makeDir('assistant-plan-');
    const dir = path.join(worktree, 'docs/plans/example');
    await fs.mkdir(dir, { recursive: true });
    const plan = path.join(dir, 'PLAN.md');
    await fs.writeFile(plan, 'status: planning\n');
    await editThread(c, t.id, (v) => { v.worktree = worktree; v.slug = 'example'; v.last_status = 'planning'; });
    assert.equal((await call({ action: 'thread', thread: t.id })).body.last_status, 'planning');
    await fs.writeFile(plan, 'status: implementing\n');
    assert.equal((await call({ action: 'threads' })).body.threads.find((v) => v.id === t.id).last_status, 'implementing');
    await editThread(c, t.id, (v) => { v.last_status = 'planning'; });
    assert.equal((await call({ action: 'thread', thread: t.id })).body.last_status, 'implementing');
    assert.equal((await api(c, '/features')).body.building.find((v) => v.id === t.id).status, 'implementing');
  } finally { await close(c); }
});


test('assistant recent filters before applying the 30 item limit', async () => {
  const routes = require('../app/routes.js');
  const helpers = require('../app/assistant.js');
  const originalList = routes.listThreads, originalOn = helpers.isOn;
  const target = { id: 'target', sessions: [], cards: [], queues: {} };
  routes.listThreads = async () => [target]; helpers.isOn = async () => true;
  const hub = {
    allThreads: async () => [{ assistant: true, id: 'assistant', sessions: [{ role: 'lead', live: true, name: 'lead' }] }],
    thread: async () => target,
    chat: async () => ({ items: [{ type: 'human', text: 'user' }, { type: 'assistant', text: 'reply' }, ...Array.from({ length: 31 }, () => ({ type: 'tool', text: 'tool' }))] }),
  };
  try {
    const result = await require('../app/assistant-actions.js').dispatch(hub, { calling_session: 'lead', action: 'thread', thread: 'target' });
    assert.deepEqual(result.recent.map((item) => item.text), ['user', 'reply']);
  } finally { routes.listThreads = originalList; helpers.isOn = originalOn; }
});

test('restart starts a fresh assistant after first preflight fails', async () => {
  const c = await setup();
  try {
    await api(c, '/settings/balancing', { method: 'PUT', body: { lead_order: ['gpt'] } });
    c.machine.preflightOk = false;
    const response = await api(c, '/settings/preferences', { method: 'PUT', body: { assistant: 'on' } });
    assert.equal(response.status, 200);
    assert.equal(response.body.assistant, 'on');
    assert.ok(response.body.assistant_error);
    const id = (await api(c, '/assistant')).body.thread;
    const file = path.join(c.state, 'threads', `${id}.json`);
    assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).sessions.length, 0);
    c.machine.preflightOk = true;
    await api(c, '/settings/balancing', { method: 'PUT', body: { lead_order: ['claude'] } });
    assert.equal((await api(c, `/threads/${id}/restart`, { method: 'POST', body: {} })).status, 201);
    const saved = JSON.parse(await fs.readFile(file, 'utf8'));
    assert.equal(saved.sessions.length, 1);
    assert.equal(saved.sent.find((m) => m.source === 'context').text, `[wc:context restart] Thread state:\n${JSON.stringify({ thread: id, title: 'Personal assistant', assistant: true })}`);
    assert.equal(c.machine.calls.filter((x) => x.path === '/v1/sessions').at(-1).body.prompt_role, 'assistant');
  } finally { await close(c); }
});
