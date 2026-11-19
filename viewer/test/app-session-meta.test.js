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
  assert.equal(Object.hasOwn(sessionRequest('start', ['--role', 'reviewer', '--attempt', 'a', '--brief-file', __filename]).body, 'title'), false);
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
    const unsignedPane = await fetch(`${context.server.url}/api/sessions/${name}/pane`, { redirect: 'manual' });
    assert.equal(unsigned.status, unsignedPane.status);
    assert.equal((await api(context, '/sessions/not-wc/brief')).status, 404);
    for (const route of ['/sessions', '/threads', `/threads/${made.id}/chat`, '/agents']) {
      const response = await api(context, route);
      assert.equal(response.status, 200, route);
      assert.equal(JSON.stringify(response.body).includes('Exact\\nbrief'), false, route);
    }
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
  for (const [query, expected] of [['?history=0', '?history=0'], ['', '']]) {
    request.url = `/wheelchair/api/sessions/wc-one/pane${query}`;
    await handle(hub, request, response, new URL(request.url, 'http://localhost'), false);
    assert.equal(called[1], `/v1/sessions/wc-one/pane${expected}`);
  }
});

test('title normalization and session lifecycle timestamps', async () => {
  const { Hub } = require('../app/hub.js');
  const context = await setup();
  try {
    const made = await thread(context); const lead = made.sessions[0];
    const start = (attempt, title) => machinePost(context, '/machine/session', { calling_session: lead.name, action: 'start', role: 'reviewer', attempt_id: attempt, title, brief: 'private' });
    const long = (await start('long', '  ' + 'x'.repeat(90) + '  ')).body.session;
    assert.equal(long.title, 'x'.repeat(80));
    const blank = (await start('blank', '   ')).body.session;
    assert.equal(Object.hasOwn(blank, 'title'), false);
    await event(context, made.id, blank.name, 'turn-failed', { error: 'failure' });
    const failedTurn = JSON.parse(await fs.readFile(path.join(context.state, 'threads', `${made.id}.json`), 'utf8')).sessions.find((s) => s.name === blank.name);
    assert.ok(failedTurn.turn_ended_at);
    const stopped = await machinePost(context, '/machine/session', { calling_session: lead.name, action: 'stop', name: long.name });
    assert.equal(stopped.status, 200);
    const hub = new Hub({ stateDir: context.state });
    assert.ok((await hub.thread(made.id)).sessions.find((s) => s.name === long.name).ended_at);
    context.machine.sessions.delete(blank.name);
    await hub.pollDead();
    assert.ok((await hub.thread(made.id)).sessions.find((s) => s.name === blank.name).ended_at);
    context.machine.startOk = false;
    assert.equal((await start('failed', 'Failure')).status, 503);
    const failed = (await hub.thread(made.id)).sessions.find((s) => s.attempt_id === 'failed');
    assert.ok(failed.ended_at); assert.equal(failed.live, false);
  } finally { await close(context); }
});

test('open and restart responses filter every session, including waiting stub wrapper', async () => {
  const { handle } = require('../app/routes.js');
  const secret = { name: 'wc-one', role: 'lead', brief: 'private', token: 'secret' };
  let value = { id: 't', sessions: [secret] };
  const hub = { openStub: async () => value, restartLead: async () => secret };
  const invoke = async (action) => {
    const request = { method: 'POST', url: `/wheelchair/api/threads/t/${action}`, async *[Symbol.asyncIterator]() {} };
    let output; const response = { writeHead() {}, end(data) { output = JSON.parse(data); } };
    await handle(hub, request, response, new URL(request.url, 'http://localhost'), false);
    return output;
  };
  for (const action of ['open', 'restart']) {
    const result = await invoke(action);
    const session = action === 'open' ? result.sessions[0] : result;
    assert.equal(Object.hasOwn(session, 'brief'), false);
    assert.equal(Object.hasOwn(session, 'token'), false);
  }
  value = { waiting: true, thread: { id: 't', sessions: [secret] } };
  const waiting = await invoke('open');
  assert.equal(waiting.waiting, true); assert.equal(Object.hasOwn(waiting.thread.sessions[0], 'brief'), false); assert.equal(Object.hasOwn(waiting.thread.sessions[0], 'token'), false);
});

test('archive records end times and preserves existing values on success and partial failure', async () => {
  const { archive } = require('../app/threads.js');
  for (const uploads_removed of [true, false]) {
    const record = { id: 't', machine: 'hub', sessions: [{ live: true }, { live: true, ended_at: '2020-01-01T00:00:00.000Z' }], cards: [], asides: [] };
    const hub = { thread: async () => record, save: async () => {}, call: async () => ({ kept: [], uploads_removed }) };
    await archive(hub, 't');
    assert.equal(record.sessions[0].live, false); assert.ok(Date.parse(record.sessions[0].ended_at));
    assert.equal(record.sessions[1].ended_at, '2020-01-01T00:00:00.000Z');
  }
});

test('review round is validated before dedupe and retained on retry', async () => {
  const args = ['--role', 'reviewer', '--attempt', 'a', '--brief-file', __filename];
  assert.equal(sessionRequest('start', [...args, '--round', '2']).body.round, '2');
  assert.equal(sessionRequest('start', [...args, '--title', '--round']).body.title, '--round');
  for (const suffix of [['--round'], ['--round', '--title', 'x']]) assert.throws(() => sessionRequest('start', [...args, ...suffix]), /--round/);
  const context = await setup();
  try {
    const made = await thread(context); const lead = made.sessions[0];
    const start = (extra) => machinePost(context, '/machine/session', { calling_session: lead.name, action: 'start', role: 'reviewer', attempt_id: 'round', ...extra });
    const first = await start({ round: '2' });
    assert.equal(first.status, 200); assert.equal(first.body.session.round, 2);
    assert.equal((await start({ round: 3 })).body.session.round, 2);
    for (const round of [0, -1, 1.5, 'abc', [2], [[3]], {}, true, null]) { const res = await start({ round }); assert.equal(res.status, 400); assert.match(res.body.detail, /--round/); }
    for (const role of ['verifier', 'worker']) { const res = await start({ role, round: 1 }); assert.equal(res.status, 400); assert.match(res.body.detail, /--round/); }
  } finally { await close(context); }
});
