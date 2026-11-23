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
