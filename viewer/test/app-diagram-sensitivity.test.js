'use strict';

// The hub's /settings/diagram-sensitivity routes against inline fake machine services.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');
const { api } = require('./helpers/app.js');
const { freePort, makeDir, startServer } = require('./helpers/server.js');

const SECRET = 'diagram-secret';

// behavior: {level, files} for a good machine, {status, error} for a refusing one, 'hang' for one
// that accepts the connection and never answers.
async function fakeMachine(behavior) {
  const port = await freePort();
  const posts = [];
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    if (request.url !== '/v1/diagram-sensitivity') { response.writeHead(404); return response.end('{}'); }
    if (behavior === 'hang') return;
    const reply = (status, body) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(body)); };
    if (behavior.status) return reply(behavior.status, { error: behavior.error });
    if (request.method === 'GET') return reply(200, { level: behavior.level, files: behavior.files || [], text: 'dial' });
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    posts.push(body);
    behavior.level = body.level;
    return reply(200, { level: body.level, text: 'dial' });
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return { port, posts, stop: () => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); } };
}

async function withHub(behaviors, work) {
  const fakes = {};
  for (const [name, behavior] of Object.entries(behaviors)) fakes[name] = await fakeMachine(behavior);
  const state = await makeDir('app-diagram-state-');
  const machines = Object.fromEntries(Object.entries(fakes).map(([name, fake]) => [name, { name, address: '127.0.0.1', port: fake.port, secret: SECRET }]));
  await fs.writeFile(path.join(state, 'machines.json'), JSON.stringify(machines));
  let server;
  try {
    server = await startServer({ stateDir: state, env: { WHEELCHAIR_DIAGRAM_TIMEOUT_MS: '300' } });
    await work({ server, state }, fakes);
  } finally {
    if (server) await server.stop();
    for (const fake of Object.values(fakes)) await fake.stop();
  }
}

test('GET reports each machine, and POST forwards to all of them', async () => {
  await withHub({
    a: { level: 'default', files: [{ harness: 'claude', level: 'default' }] },
    b: { level: null, files: [{ harness: 'claude', level: 'ask' }, { harness: 'codex', level: 'high' }] },
  }, async (context, fakes) => {
    const read = await api(context, '/settings/diagram-sensitivity');
    assert.equal(read.status, 200);
    assert.deepEqual(read.body.machines.a, { level: 'default', files: [{ harness: 'claude', level: 'default' }] });
    assert.equal(read.body.machines.b.level, null);
    const saved = await api(context, '/settings/diagram-sensitivity', { method: 'POST', body: { level: 'high' } });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body, { machines: { a: { level: 'high' }, b: { level: 'high' } } });
    assert.deepEqual(fakes.a.posts, [{ level: 'high' }]);
    assert.deepEqual(fakes.b.posts, [{ level: 'high' }]);
  });
});

test('one machine failing gives 502 with the per-machine map; the others keep the level', async () => {
  await withHub({
    good: { level: 'ask', files: [] },
    bad: { status: 422, error: 'harness file is not writable' },
  }, async (context, fakes) => {
    const saved = await api(context, '/settings/diagram-sensitivity', { method: 'POST', body: { level: 'high' } });
    assert.equal(saved.status, 502);
    assert.deepEqual(saved.body.machines, { good: { level: 'high' }, bad: { error: 'harness file is not writable' } });
    assert.deepEqual(fakes.good.posts, [{ level: 'high' }]);
  });
});

test('a machine that does not answer is "did not answer" within the timeout, on GET and POST', async () => {
  await withHub({ good: { level: 'ask', files: [] }, silent: 'hang' }, async (context) => {
    const started = Date.now();
    const read = await api(context, '/settings/diagram-sensitivity');
    assert.equal(read.status, 200);
    assert.deepEqual(read.body.machines.silent, { error: 'did not answer' });
    assert.equal(read.body.machines.good.level, 'ask');
    const saved = await api(context, '/settings/diagram-sensitivity', { method: 'POST', body: { level: 'default' } });
    assert.equal(saved.status, 502);
    assert.deepEqual(saved.body.machines.silent, { error: 'did not answer' });
    assert.deepEqual(saved.body.machines.good, { level: 'default' });
    assert.ok(Date.now() - started < 3000, 'machines are called in parallel and time out quickly');
  });
});

test('a refused connection is "did not answer", and a bad level is 400 without calling machines', async () => {
  await withHub({ good: { level: 'ask', files: [] } }, async (context, fakes) => {
    const machines = JSON.parse(await fs.readFile(path.join(context.state, 'machines.json'), 'utf8'));
    machines.gone = { name: 'gone', address: '127.0.0.1', port: await freePort(), secret: SECRET };
    await fs.writeFile(path.join(context.state, 'machines.json'), JSON.stringify(machines));
    const read = await api(context, '/settings/diagram-sensitivity');
    assert.deepEqual(read.body.machines.gone, { error: 'did not answer' });
    for (const level of ['loud', '', undefined, 3]) {
      const bad = await api(context, '/settings/diagram-sensitivity', { method: 'POST', body: { level } });
      assert.equal(bad.status, 400);
    }
    assert.deepEqual(fakes.good.posts, []);
  });
});
