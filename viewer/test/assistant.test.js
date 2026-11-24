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
