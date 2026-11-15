'use strict';

// The hub's own machine as the installer registers it: under the hostname, while threads say
// "hub" (docs/plans/app-shell, "State" and "Machine service on the hub").
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
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

test('a lead waits when its machine is unreachable', async () => {
  const hub = new Hub({ stateDir: await installerShapedState(await freePort()) });
  await hub.init();
  const made = await hub.createThread({ project: '/tmp/nowhere', machine: 'hub' });
  assert.equal(made.sessions[0].status, 'waiting');
  assert.equal(made.sessions[0].live, true);
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
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hub-version-'));
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
