'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Hub } = require('../app/hub.js');
const { api, card, close, event, setup, thread } = require('./helpers/app.js');

async function withContext(work, options = {}) {
  const context = await setup(options);
  try { await work(context); } finally { await close(context); }
}

const post = (context, route, body) => api(context, route, { method: 'POST', body });
const save = (context, input) => post(context, '/threads', { project: '/tmp/project', stub: true, ...input });
const attachments = (context, id, body) => post(context, `/threads/${id}/stub-attachments`, body);

async function upload(context, id) {
  const url = `${context.server.url}/api/threads/${id}/uploads?name=a.txt`;
  return fetch(url, { method: 'POST', headers: { 'x-graph-token': context.server.token, origin: new URL(url).origin, 'content-type': 'application/octet-stream' }, body: 'x' });
}

test('saved idea creation validates message and file count', async () => {
  await withContext(async (context) => {
    for (const input of [{ message: '' }, { message: '  ' }, { message: '', files: 0 }]) {
      const result = await save(context, input);
      assert.equal(result.status, 400);
      assert.equal(result.body.detail, 'a stub needs a message');
    }
    for (const files of [-1, 1.5, '1']) {
      assert.equal((await save(context, { message: 'x', files })).status, 400);
    }
  });
});

test('saving an idea persists its fields without starting a machine session', async () => {
  await withContext(async (context) => {
    const before = context.machine.sessions.size;
    const result = await save(context, { message: '  First line\nFull message  ', files: 1 });
    assert.equal(result.status, 201);
    const made = result.body;
    assert.deepEqual([made.stub, made.title, made.context, made.parent, made.depends_on_parent, made.commits, made.sessions, made.saving_files], [true, 'First line', 'First line\nFull message', null, false, [], [], true]);
    assert.equal(Object.hasOwn(made, 'parent_title'), false);
    assert.equal(context.machine.sessions.size, before);
    assert.equal((await api(context, '/threads?view=list')).body.threads.find(t => t.id === made.id).saving_files, true);
    assert.equal((await api(context, `/threads/${made.id}/chat`)).body.thread.saving_files, true);
    const noFiles = (await save(context, { message: 'No files' })).body;
    assert.equal(Object.hasOwn(noFiles, 'saving_files'), false);
  });
});

test('files-only saved idea uses its file name as title', async () => {
  await withContext(async (context) => {
    const result = await save(context, { message: '', files: 1, title: 'photo.png' });
    assert.equal(result.status, 201);
    assert.deepEqual([result.body.title, result.body.context, result.body.saving_files], ['photo.png', '', true]);
  });
});

test('unopened saved ideas accept uploads; archived ones refuse them', async () => {
  await withContext(async (context) => {
    const made = (await save(context, { message: 'Idea', files: 1 })).body;
    assert.equal((await upload(context, made.id)).status, 201);
    assert.equal((await post(context, `/threads/${made.id}/archive`, {})).status, 200);
    assert.equal((await upload(context, made.id)).status, 409);
  });
});

test('an opened saved idea with a dead lead refuses uploads', async () => {
  await withContext(async (context) => {
    const stub = (await save(context, { message: 'Idea' })).body;
    const made = (await post(context, `/threads/${stub.id}/open`, {})).body;
    const hub = new Hub({ stateDir: context.state });
    context.machine.sessions.get(made.sessions[0].name).running = false;
    await hub.init(); await hub.pollDead();
    assert.equal((await upload(context, made.id)).status, 409);
  });
});

test('stub attachments append to text and only done clears saving_files', async () => {
  await withContext(async (context) => {
    const made = (await save(context, { message: 'text', files: 1 })).body;
    const appended = await attachments(context, made.id, { paths: ['/a'] });
    assert.equal(appended.status, 200);
    assert.equal(appended.body.context, 'text\n\n[attached: /a]');
    assert.equal((await api(context, `/threads/${made.id}/chat`)).body.thread.saving_files, true);
    assert.equal((await attachments(context, made.id, { paths: [], done: true })).status, 200);
    assert.equal(Object.hasOwn((await api(context, `/threads/${made.id}/chat`)).body.thread, 'saving_files'), false);
  });
});

test('stub attachments append to empty context and after an addition', async () => {
  await withContext(async (context) => {
    const made = (await save(context, { message: '', files: 1, title: 'photo.png' })).body;
    assert.equal((await attachments(context, made.id, { paths: ['/b', '/c'] })).body.context, '[attached: /b]\n[attached: /c]');
    const parent = await thread(context);
    const added = await card(context, parent.id, parent.sessions[0].name, { kind: 'stub', title: 'Addition', summary: 'Extra', depends_on_parent: false, adds_to: made.id });
    assert.equal(added.status, 202);
    const afterAddition = (await api(context, `/threads/${made.id}/chat`)).body.thread.context;
    assert.match(afterAddition, /Added from[\s\S]*Extra$/);
    assert.equal((await attachments(context, made.id, { paths: ['/d'] })).body.context, `${afterAddition}\n\n[attached: /d]`);
  });
});

test('stub attachments reject invalid bodies and threads that are not unopened stubs', async () => {
  await withContext(async (context) => {
    const made = (await save(context, { message: 'Idea' })).body;
    for (const bad of [{}, { paths: 'a' }, { paths: [''] }, { paths: [1] }, { paths: [], done: false }]) {
      assert.equal((await attachments(context, made.id, bad)).status, 400);
    }
    const normal = await thread(context);
    assert.equal((await attachments(context, normal.id, { paths: [] })).status, 409);
    await post(context, `/threads/${made.id}/open`, {});
    assert.equal((await attachments(context, made.id, { paths: [] })).status, 409);
  });
});

test('opening a saved idea sends its exact context and clears saving_files', async () => {
  await withContext(async (context) => {
    const made = (await save(context, { message: 'First line\nFull message', files: 1 })).body;
    await attachments(context, made.id, { paths: ['/a'] });
    const opened = (await post(context, `/threads/${made.id}/open`, {})).body;
    assert.equal(Object.hasOwn(opened, 'saving_files'), false);
    await event(context, made.id, opened.sessions[0].name, 'turn-ended');
    assert.deepEqual(context.machine.sessions.get(opened.sessions[0].name).submits, ['[wc:context stub] (saved from the New thread screen)\nFirst line\nFull message\n\n[attached: /a]']);
  });
});

test('restart context preserves a saved idea summary', async () => {
  await withContext(async (context) => {
    await api(context, '/settings/balancing', { method: 'PUT', body: { lead_order: ['gpt'] } });
    const stub = (await save(context, { message: 'Restart idea' })).body;
    const made = (await post(context, `/threads/${stub.id}/open`, {})).body;
    const oldLead = made.sessions[0];
    const hub = new Hub({ stateDir: context.state });
    context.machine.sessions.get(oldLead.name).running = false;
    await hub.init(); await hub.pollDead();
    const restarted = await api(context, `/threads/${made.id}/restart`, { method: 'POST', body: {} });
    const after = await hub.thread(made.id);
    const message = after.sessions.find((s) => s.name === restarted.body.name).queue.find((m) => m.source === 'context').text;
    const state = JSON.parse(message.replace(/^\[wc:context restart] Thread state:\n/, ''));
    assert.equal(state.stub_summary, '(saved from the New thread screen)\nRestart idea');
  });
});

test('session leads offers a saved idea for additions', async () => {
  await withContext(async (context) => {
    const made = (await save(context, { message: 'Idea' })).body;
    const parent = await thread(context);
    const hub = new Hub({ stateDir: context.state });
    const peers = await hub.sessionRequest({ action: 'leads', calling_session: parent.sessions[0].name });
    const candidate = peers.leads.find(t => t.thread === made.id);
    assert.deepEqual([candidate.takes_additions, candidate.waits_on_parent], [true, false]);
    const added = await card(context, parent.id, parent.sessions[0].name, { kind: 'stub', title: 'Addition', summary: 'Extra', depends_on_parent: false, adds_to: made.id });
    assert.equal(added.status, 202);
  });
});
