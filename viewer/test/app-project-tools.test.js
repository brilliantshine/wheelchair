'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Readable } = require('node:stream');
const { api, close, setup } = require('./helpers/app.js');
const { handle } = require('../app/routes.js');

async function files(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const contents = await Promise.all(entries.map(async (entry) => {
    const name = path.join(dir, entry.name);
    return entry.isDirectory() ? files(name) : entry.isFile() ? fs.readFile(name, 'utf8') : '';
  }));
  return contents.flat();
}

test('project tools routes forward requests and machine responses without storing keys', async (t) => {
  const ctx = await setup();
  t.after(() => close(ctx));
  const secret = 'unique-project-tools-secret-72319';
  const replies = {
    read: { status: 200, body: { mode: 'tools', keys: [] } },
    save: { status: 200, body: { outcome: 'opened', key_revision: 1, keys: ['TOKEN'], pr_url: 'https://example.test/pr', warnings: [] } },
    'remove-key': { status: 409, body: { outcome: 'refused', reason: 'changed since you opened it' } },
  };
  Object.assign(ctx.machine.projectToolsReplies, replies);
  for (const route of Object.keys(replies)) {
    const body = { machine: 'hub', path: '/project', keys: { TOKEN: secret }, token: { key_revision: 0 } };
    const result = await api(ctx, `/project-tools/${route}`, { method: 'POST', body });
    assert.deepEqual(result, replies[route]);
    const call = ctx.machine.calls.findLast((item) => item.path === `/v1/project-tools/${route}`);
    const { machine, ...forwarded } = body;
    assert.deepEqual(call.body, forwarded);
  }
  for (const reply of [
    { status: 400, body: { outcome: 'refused', reason: 'bad key' } },
    { status: 502, body: { outcome: 'failed', key_revision: 2, keys: ['TOKEN'], error: 'push failed' } },
  ]) {
    ctx.machine.projectToolsReplies.save = reply;
    assert.deepEqual(await api(ctx, '/project-tools/save', { method: 'POST', body: { path: '/project' } }), reply);
  }
  assert.ok((await files(ctx.state)).every((content) => !content.includes(secret)));
});

test('project tools transport failures, validation and browser authorization', async (t) => {
  const ctx = await setup();
  t.after(() => close(ctx));
  ctx.machine.projectToolsReplies.read = { status: 200, raw: 'not json' };
  const bad = await api(ctx, '/project-tools/read', { method: 'POST', body: { path: '/project' } });
  assert.equal(bad.status, 504);
  assert.equal(typeof bad.body.error, 'string');
  assert.equal('outcome' in bad.body, false);
  const missing = await api(ctx, '/project-tools/read', { method: 'POST', body: {} });
  assert.deepEqual(missing, { status: 400, body: { error: 'path is required' } });
  const unknown = await api(ctx, '/project-tools/read', { method: 'POST', body: { machine: 'missing', path: '/project' } });
  assert.deepEqual(unknown, { status: 404, body: { error: 'unknown machine: missing' } });
  const url = `${ctx.server.url}/api/project-tools/read`;
  for (const headers of [
    { origin: new URL(ctx.server.url).origin },
    { origin: 'https://foreign.example', 'x-graph-token': ctx.server.token },
  ]) {
    const response = await fetch(url, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ path: '/project' }) });
    assert.ok(response.status === 401 || response.status === 403);
  }
  await ctx.machine.stop();
  const unreachable = await api(ctx, '/project-tools/read', { method: 'POST', body: { path: '/project' } });
  assert.equal(unreachable.status, 504);
  assert.equal(typeof unreachable.body.error, 'string');
  assert.equal('outcome' in unreachable.body, false);
});

test('project tools forwards with a 120 second timeout', async () => {
  let args;
  const hub = { client: { passThrough: async (...value) => { args = value; return { status: 200, body: {} }; } } };
  const request = Readable.from([Buffer.from(JSON.stringify({ path: '/project', machine: 'hub' }))]);
  request.method = 'POST';
  const response = { writeHead() {}, end() {} };
  await handle(hub, request, response, new URL('http://localhost/wheelchair/api/project-tools/save'), false);
  assert.deepEqual(args, ['hub', '/v1/project-tools/save', 'POST', { path: '/project' }, 120_000]);
});

test('machine replies keep multi-byte characters split across chunks', async (t) => {
  const http = require('node:http');
  const { requestJson } = require('../app/machine-client');
  const server = http.createServer((request, response) => {
    const bytes = Buffer.from(JSON.stringify({ GREETING: 'Olá' }));
    const split = bytes.indexOf(0xc3);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.write(bytes.subarray(0, split + 1));
    setTimeout(() => {
      response.end(bytes.subarray(split + 1));
    }, 50);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  const { body } = await requestJson(`http://127.0.0.1:${server.address().port}/x`, 'POST', {}, {}, 5000, true);
  assert.equal(body.GREETING, 'Olá');
});

test('project tools forwards windows-status like the other routes', async () => {
  let args;
  const hub = { client: { passThrough: async (...value) => { args = value; return { status: 200, body: { wsl: true, status: {} } }; } } };
  const payload = { path: '/project', machine: 'hub', token: { key_revision: 1 }, tools: [{ id: '0', name: 'a', type: 'http', url: 'http://localhost:80' }] };
  const request = Readable.from([Buffer.from(JSON.stringify(payload))]);
  request.method = 'POST';
  let sent;
  const response = { writeHead(status) { sent = status; }, end() {} };
  await handle(hub, request, response, new URL('http://localhost/wheelchair/api/project-tools/windows-status'), false);
  const { machine, ...forwarded } = payload;
  assert.equal(sent, 200);
  assert.deepEqual(args, ['hub', '/v1/project-tools/windows-status', 'POST', forwarded, 120_000]);
});
