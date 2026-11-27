'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Hub } = require('../app/hub.js');
const { api, card, close, event, setup, thread } = require('./helpers/app.js');

const post = (c, route, body) => api(c, route, { method: 'POST', body });
test('saved ideas validate, retain attachments, open and restart', async () => {
  const c = await setup();
  try {
    for (const body of [{ message: '' }, { message: '  ' }, { message: '', files: 0 }]) {
      const r = await post(c, '/threads', { project: '/tmp/project', stub: true, ...body });
      assert.equal(r.status, 400); assert.equal(r.body.detail, 'a stub needs a message');
    }
    for (const files of [-1, 1.5, '1']) assert.equal((await post(c, '/threads', { project: '/tmp/project', stub: true, message: 'x', files })).status, 400);
    const made = (await post(c, '/threads', { project: '/tmp/project', stub: true, message: '  First line\nFull message  ', files: 1 })).body;
    assert.deepEqual([made.stub, made.title, made.context, made.parent, made.depends_on_parent, made.commits, made.sessions, made.saving_files], [true, 'First line', 'First line\nFull message', null, false, [], [], true]);
    assert.equal(Object.hasOwn(made, 'parent_title'), false);
    assert.equal((await api(c, '/threads?view=list')).body.threads.find(t => t.id === made.id).saving_files, true);
    assert.equal((await api(c, `/threads/${made.id}/chat`)).body.thread.saving_files, true);
    const base = `${c.server.url}/api/threads/${made.id}/uploads?name=a.txt`;
    const headers = { 'x-graph-token': c.server.token, origin: new URL(base).origin, 'content-type': 'application/octet-stream' };
    const upload = () => fetch(base, { method: 'POST', headers, body: 'x' });
    assert.equal((await upload()).status, 201);
    for (const bad of [{}, { paths: 'a' }, { paths: [''] }, { paths: [1] }, { paths: [], done: false }]) assert.equal((await post(c, `/threads/${made.id}/stub-attachments`, bad)).status, 400);
    const route = `/threads/${made.id}/stub-attachments`;
    assert.equal((await post(c, route, { paths: ['/a'] })).body.context, 'First line\nFull message\n\n[attached: /a]');
    assert.equal((await api(c, `/threads/${made.id}/chat`)).body.thread.saving_files, true);
    const opened = (await post(c, `/threads/${made.id}/open`, {})).body;
    assert.equal(Object.hasOwn(opened, 'saving_files'), false);
    await event(c, made.id, opened.sessions[0].name, 'turn-ended');
    assert.deepEqual(c.machine.sessions.get(opened.sessions[0].name).submits, ['[wc:context stub] (saved from the New thread screen)\nFirst line\nFull message\n\n[attached: /a]']);
    assert.equal((await post(c, route, { paths: [] })).status, 409);
    const restartStub = (await post(c, '/threads', { project: '/tmp/project', stub: true, message: 'Restart idea' })).body;
    const restartOpen = (await post(c, `/threads/${restartStub.id}/open`, {})).body;
    const hub = new Hub({ stateDir: c.state });
    c.machine.sessions.get(opened.sessions[0].name).running = false;
    c.machine.sessions.get(restartOpen.sessions[0].name).running = false;
    await hub.init(); await hub.pollDead();
    assert.equal((await upload()).status, 409);
    const restarted = await post(c, `/threads/${restartStub.id}/restart`, {});
    const current = await hub.thread(restartStub.id);
    const text = current.sessions.find(s => s.name === restarted.body.name).queue.find(m => m.source === 'context').text;
    assert.equal(JSON.parse(text.split('Thread state:\n')[1]).stub_summary, '(saved from the New thread screen)\nRestart idea');
    const filesOnly = (await post(c, '/threads', { project: '/tmp/project', stub: true, files: 1, title: 'photo.png' })).body;
    assert.deepEqual([filesOnly.title, filesOnly.context, filesOnly.saving_files], ['photo.png', '', true]);
    const fileRoute = `/threads/${filesOnly.id}/stub-attachments`;
    assert.equal((await post(c, fileRoute, { paths: ['/b', '/c'] })).body.context, '[attached: /b]\n[attached: /c]');
    assert.equal((await post(c, fileRoute, { paths: [], done: true })).status, 200);
    assert.equal(Object.hasOwn((await api(c, `/threads/${filesOnly.id}/chat`)).body.thread, 'saving_files'), false);
    const normal = await thread(c);
    assert.equal((await post(c, `/threads/${normal.id}/stub-attachments`, { paths: [] })).status, 409);
    const added = await card(c, normal.id, normal.sessions[0].name, { kind: 'stub', title: 'Addition', summary: 'Extra', depends_on_parent: false, adds_to: filesOnly.id });
    assert.equal(added.status, 202);
    assert.match((await post(c, fileRoute, { paths: ['/d'] })).body.context, /Added from[\s\S]*Extra\n\n\[attached: \/d\]$/);
    const peers = await hub.sessionRequest({ action: 'leads', calling_session: normal.sessions[0].name });
    const candidate = peers.leads.find(t => t.thread === filesOnly.id);
    assert.deepEqual([candidate.takes_additions, candidate.waits_on_parent], [true, false]);
    await post(c, `/threads/${filesOnly.id}/archive`, {});
    const archivedUrl = `${c.server.url}/api/threads/${filesOnly.id}/uploads?name=x`;
    assert.equal((await fetch(archivedUrl, { method: 'POST', headers, body: 'x' })).status, 409);
  } finally { await close(c); }
});
