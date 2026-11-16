'use strict';

const { trackChild } = require('../../test-support/run-dir');
function trackedSpawn(...args) { const child = spawn(...args); trackChild(child); return child; }

const { makeTemp } = require('../../test-support/run-dir');

// The hub's own machine as the installer registers it: under the hostname, while threads say
// "hub" (docs/plans/app-shell, "State" and "Machine service on the hub").
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const test = require('node:test');
const { Hub } = require('../app/hub.js');
const { State } = require('../app/state.js');
const { freePort, makeDir } = require('./helpers/server');

async function installerShapedState(port) {
  const dir = await makeDir('machines-');
  const secret = path.join(dir, 'machine.secret');
  await fs.writeFile(secret, 'x'.repeat(64));
  await fs.writeFile(path.join(dir, 'machine.json'), JSON.stringify({
    hub_url: 'http://127.0.0.1:1/wheelchair', secret_file: secret, host: '127.0.0.1', port,
  }));
  await fs.writeFile(path.join(dir, 'machines.json'), JSON.stringify({
    hearth: { name: 'hearth', host: '127.0.0.1', port, secret_file: secret },
  }));
  return dir;
}

test('"hub" names the installer-registered entry for this host\'s own service', async () => {
  const state = new State(await installerShapedState(7999));
  await state.init();
  assert.equal((await state.machine('hub')).name, 'hearth');
  assert.equal((await state.machine('hearth')).name, 'hearth');
  await assert.rejects(state.machine('elsewhere'), /unknown machine: elsewhere/);
  await state.markMachineSeen('hub', '2026-11-14T00:00:00.000Z');
  assert.equal((await state.machines()).hearth.last_seen, '2026-11-14T00:00:00.000Z');
});

// A machine service that passes the path check and refuses everything else, so the start
// itself is what fails.
async function checkOnlyMachine() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://machine.test');
    const ok = url.pathname === '/v1/projects';
    response.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' });
    response.end(JSON.stringify(ok ? { checked: { path: url.searchParams.get('check'), ok: true } } : { error: 'refused' }));
  });
  const port = await freePort();
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return { port, stop: () => new Promise((resolve) => server.close(resolve)) };
}

test('a lead waits when its machine passes the path check but cannot start it', async () => {
  const machine = await checkOnlyMachine();
  try {
    const hub = new Hub({ stateDir: await installerShapedState(machine.port) });
    await hub.init();
    const made = await hub.createThread({ project: '/tmp/nowhere', machine: 'hub' });
    assert.equal(made.sessions[0].status, 'waiting');
    assert.equal(made.sessions[0].live, true);
  } finally { await machine.stop(); }
});

test('a reachable machine that refuses a lead start records failure', async () => {
  const { setup, close, api } = require('./helpers/app.js');
  const context = await setup();
  try {
    context.machine.startOk = false;
    const result = await api(context, '/threads', { method: 'POST', body: { project: '/tmp/refused' } });
    assert.equal(result.status, 503);
    const [made] = await (new Hub({ stateDir: context.state })).allThreads();
    assert.equal(made.sessions[0].status, 'failed');
    assert.equal(made.sessions[0].live, false);
    assert.ok(made.sessions[0].error);
  } finally { await close(context); }
});

test('an unreachable machine leaves no thread and no projects.json entry', async () => {
  const hub = new Hub({ stateDir: await installerShapedState(await freePort()) });
  await hub.init();
  await assert.rejects(
    hub.createThread({ project: '/tmp/nowhere', machine: 'hub' }),
    (error) => error.status === 502 && error.message === 'hub is not reachable',
  );
  assert.deepEqual(await hub.allThreads(), []);
  assert.deepEqual(await hub.projects(), []);
});

test('wc.js passes worktree-remove through with the worker session, and requires a commit message', () => {
  const { gitRequest } = require('../app/wc.js');
  assert.deepEqual(gitRequest('worktree-remove', ['wc-t-worker']).body.args, ['wc-t-worker']);
  assert.equal(gitRequest('commit', ['--paths', 'a.txt', '-m', 'msg']).body.message, 'msg');
  assert.throws(() => gitRequest('commit', ['--paths', 'a.txt']), /message/);
  assert.throws(() => gitRequest('rebase', []), /unsupported/);
});

test('wc.js preserves git flags and the worker replacement option', () => {
  const { gitRequest, sessionRequest } = require('../app/wc.js');
  assert.deepEqual(gitRequest('pr', ['--title', 'X', '--body', 'b', '--base', 'main']).body.args,
    ['--title', 'X', '--body', 'b', '--base', 'main']);
  assert.deepEqual(gitRequest('merge', ['--no-ff', 'wc-branch']).body.args, ['--no-ff', 'wc-branch']);
  assert.deepEqual(gitRequest('commit', ['--paths', 'a,b', '-m', 'msg']).body, {
    operation: 'commit', args: [], paths: ['a', 'b'], message: 'msg',
  });
  assert.deepEqual(gitRequest('pr', ['--title', 'X', '--body', 'Y', '--base', 'main']).body.args,
    ['--title', 'X', '--body', 'Y', '--base', 'main']);
  const oldRead = require('node:fs').readFileSync;
  require('node:fs').readFileSync = () => 'brief';
  try {
    assert.equal(sessionRequest('start', ['--role', 'worker', '--cli', 'codex', '--brief-file', 'x', '--attempt', 'again', '--replaces', 'wc-old']).body.replaces, 'wc-old');
  } finally { require('node:fs').readFileSync = oldRead; }
});

test('a hub keeps the version captured at construction after its clone advances', async () => {
  const root = await makeTemp('hub-version-');
  const git = (...args) => execFileSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args]);
  git('init', '-q');
  await fs.writeFile(path.join(root, 'version.txt'), 'A\n');
  git('add', '.'); git('commit', '-q', '-m', 'A');
  const versionA = git('rev-parse', 'HEAD').toString().trim();
  const hub = new Hub({ stateDir: await makeDir('hub-version-state-'), root });
  await fs.writeFile(path.join(root, 'version.txt'), 'B\n');
  git('add', '.'); git('commit', '-q', '-m', 'B');
  const { outOfDate } = require('../app/ready.js');
  assert.equal(await outOfDate(hub, { version: versionA }), false);
});


test('wc.js sends provider constraints and prints waiting and notice output', async () => {
  const http = require('node:http');
  const dir = await makeDir('wc-output-');
  const brief = path.join(dir, 'brief.txt');
  await fs.writeFile(brief, 'work');
  let received;
  const server = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received = { path: request.url, token: request.headers['x-wheelchair-session-token'], body: JSON.parse(Buffer.concat(chunks)) };
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ session: { status: 'waiting', waiting_until: '2026-12-01T12:00:00.000Z' }, note: 'Using another provider.' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const child = trackedSpawn(process.execPath, [path.join(__dirname, '../app/wc.js'), 'session', 'start', '--role', 'worker', '--brief-file', brief, '--attempt', 'test', '--cli', 'codex', '--provider', 'gpt', '--not-provider', 'claude'], {
      env: { ...process.env, WHEELCHAIR_MACHINE_ORIGIN: `http://127.0.0.1:${server.address().port}`, WHEELCHAIR_MACHINE_URL: '', WHEELCHAIR_SESSION_TOKEN: 'test-token' },
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
    assert.equal(code, 0);
    assert.equal(received.path, '/v1/agent/session');
    assert.equal(received.token, 'test-token');
    assert.equal(Object.hasOwn(received.body, 'cli'), false);
    assert.equal(received.body.provider, 'gpt');
    assert.equal(received.body.not_provider, 'claude');
    assert.match(stderr, /--cli is ignored: the hub picks the provider/);
    assert.match(stderr, /Using another provider\./);
    assert.match(stdout, /waiting for room until 2026-12-01T12:00:00.000Z/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
