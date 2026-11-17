'use strict';
const test = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { sessionRequest } = require('../app/wc.js');
const { setup, close, thread, api, machinePost, event } = require('./helpers/app.js');

test('session title, brief, timing and history routes', async () => {
  const parsed = sessionRequest('start', ['--role', 'reviewer', '--attempt', 'a', '--brief-file', __filename, '--title', 'Review']);
  assert.equal(parsed.body.title, 'Review');
  const context = await setup();
  try {
    const made = await thread(context);
    const lead = made.sessions[0];
    const result = await machinePost(context, '/machine/session', { calling_session: lead.name, action: 'start', role: 'reviewer', attempt_id: 'meta', title: '  Review work  ', brief: 'Exact\nbrief\n' });
    assert.equal(result.status, 200);
    const name = result.body.session.name;
    assert.equal(result.body.session.title, 'Review work');
    assert.equal(result.body.session.brief, undefined);
    assert.ok(result.body.session.turn_started_at);
    assert.deepEqual((await api(context, `/sessions/${name}/brief`)).body, { brief: 'Exact\nbrief\n' });
    assert.equal((await api(context, '/sessions/wc-missing/brief')).status, 404);
    assert.equal((await api(context, `/sessions/${lead.name}/brief`)).status, 404);
    const unsigned = await fetch(`${context.server.url}/api/sessions/${name}/brief`, { redirect: 'manual' });
    assert.notEqual(unsigned.status, 200);
    assert.equal((await api(context, `/sessions/${name}/pane?history=2000`)).status, 200);
    assert.equal((await api(context, `/sessions/${name}/pane?history=2001`)).status, 400);
    assert.equal((await api(context, `/sessions/${name}/pane?history=-1`)).status, 400);
    await event(context, made.id, name, 'turn-ended');
    let state = JSON.parse(await fs.readFile(path.join(context.state, 'threads', `${made.id}.json`), 'utf8')).sessions.find((s) => s.name === name);
    assert.ok(state.turn_ended_at);
    await api(context, `/sessions/${name}/keys`, { method: 'POST', body: { keys: 'Enter' } });
    state = JSON.parse(await fs.readFile(path.join(context.state, 'threads', `${made.id}.json`), 'utf8')).sessions.find((s) => s.name === name);
    assert.equal(state.turn_ended, false); assert.ok(state.turn_started_at);
  } finally { await close(context); }
});

test('pane forwards history unchanged to the machine', async () => {
  const { handle } = require('../app/routes.js');
  let called;
  const hub = { findSessionMachine: async () => 'hub', call: async (...args) => { called = args; return { pane: '' }; } };
  const request = { method: 'GET', url: '/wheelchair/api/sessions/wc-one/pane?history=2000' };
  const response = { writeHead() {}, end() {} };
  await handle(hub, request, response, new URL(request.url, 'http://localhost'), false);
  assert.deepEqual(called, ['hub', '/v1/sessions/wc-one/pane?history=2000', 'GET']);
});
