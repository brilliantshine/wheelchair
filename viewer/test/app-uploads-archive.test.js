'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const { MachineService } = require('../../machine/service.js');
const { api, thread } = require('./helpers/app.js');
const { freePort, makeDir, startServer } = require('./helpers/server.js');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function setup() {
  const root = await makeDir('real-machine-');
  const state = path.join(root, 'machine');
  const hubState = path.join(root, 'hub');
  const bin = path.join(root, 'bin');
  const project = path.join(root, 'project');
  const origin = path.join(root, 'origin.git');
  await Promise.all([state, hubState, bin, project].map(dir => fs.mkdir(dir, { recursive: true })));
  const git = (...args) => execFileSync('git', args, { stdio: 'ignore' });
  git('init', '--bare', '--initial-branch=main', origin);
  git('init', '--initial-branch=main', project);
  git('-C', project, 'config', 'user.name', 'Integration test');
  git('-C', project, 'config', 'user.email', 'integration@example.test');
  await fs.writeFile(path.join(project, 'README'), 'test\n');
  git('-C', project, 'add', 'README');
  git('-C', project, 'commit', '-m', 'initial');
  git('-C', project, 'remote', 'add', 'origin', origin);
  git('-C', project, 'push', '-u', 'origin', 'main');
  const script = `#!/bin/sh\ncase "$(basename "$0"):$1" in\n  systemd-run:*) exit 1 ;;\n  tmux:capture-pane) printf 'auto mode on\\n❯ Try anything\\n' ;;\n  claude:--version) echo claude-test ;;\n  claude:auth) echo '{"loggedIn":true}' ;;\nesac\n`;
  for (const name of ['tmux', 'systemd-run', 'claude']) await fs.writeFile(path.join(bin, name), script, { mode: 0o755 });
  const priorPath = process.env.PATH;
  process.env.PATH = `${bin}:${priorPath}`;
  let instance, server;
  try {
    const port = await freePort();
    const secret = 'integration-secret';
    const secretFile = path.join(root, 'secret');
    await fs.writeFile(secretFile, secret);
    await fs.writeFile(path.join(state, 'machine.json'), JSON.stringify({ secret_file: secretFile, host: '127.0.0.1', port }));
    instance = new MachineService({ stateDir: state, host: '127.0.0.1', port });
    await instance.listen();
    await fs.writeFile(path.join(hubState, 'machines.json'), JSON.stringify({ hub: { name: 'hub', address: '127.0.0.1', port, secret } }));
    const modelsCache = path.join(root, 'models-cache.json');
    await fs.writeFile(modelsCache, JSON.stringify({ models: [] }));
    server = await startServer({ stateDir: hubState, env: { WHEELCHAIR_MODELS: path.join(root, 'models'), WHEELCHAIR_MODELS_CACHE: modelsCache } });
    return { server, state: hubState, machineState: state, instance, project, async close() {
      try { await server.stop(); } finally {
        instance.server.closeAllConnections();
        await new Promise(resolve => instance.server.close(resolve));
        process.env.PATH = priorPath;
      }
    } };
  } catch (error) {
    if (server) await server.stop();
    if (instance?.server?.listening) await new Promise(resolve => instance.server.close(resolve));
    process.env.PATH = priorPath;
    throw error;
  }
}

test('archive through the hub cancels a stalled upload to the real machine', { timeout: 30000 }, async () => {
  const context = await setup();
  let request;
  try {
    const made = await thread(context, { project: context.project, cli: 'claude' });
    assert.ok(made.id, JSON.stringify(made));
    assert.ok(made.sessions.some(session => session.role === 'lead' && session.live));
    assert.ok(Object.values(context.instance.sessions).some(session => session.thread_id === made.id && session.role === 'lead'));
    const base = `${context.server.url}/api/threads/${made.id}`;
    const headers = { 'x-graph-token': context.server.token, origin: new URL(base).origin, 'content-type': 'application/octet-stream' };
    const bytes = Buffer.from('small upload through the hub');
    const uploaded = await fetch(`${base}/uploads?name=small.bin`, { method: 'POST', headers, body: bytes });
    assert.equal(uploaded.status, 201);
    const stored = (await uploaded.json()).path;
    const uploads = path.join(context.machineState, 'uploads', made.id);
    assert.equal(path.dirname(stored), uploads);
    assert.deepEqual(await fs.readFile(stored), bytes);

    const outcome = new Promise(resolve => {
      request = http.request(`${base}/uploads?name=slow.bin`, { method: 'POST', headers: { ...headers, 'content-length': 1024 * 1024 } }, response => {
        response.resume();
        response.on('end', () => resolve({ status: response.statusCode }));
        response.on('error', error => resolve({ error }));
      });
      request.on('error', error => resolve({ error }));
      request.write(Buffer.alloc(4096));
    });
    const deadline = Date.now() + 3000;
    while (!(await fs.readdir(uploads)).some(name => name.endsWith('.part'))) {
      assert.ok(Date.now() < deadline, 'upload reached the machine');
      await delay(20);
    }
    await delay(5200);
    const started = Date.now();
    const archived = await api(context, `/threads/${made.id}/archive`, { method: 'POST', body: {} });
    assert.ok(Date.now() - started < 5000, 'archive completed before the default machine timeout');
    assert.equal(archived.status, 200, JSON.stringify(archived.body));
    assert.equal((await api(context, `/threads/${made.id}/chat`)).body.thread.archived, true);
    const result = await Promise.race([outcome, delay(3000).then(() => ({ timeout: true }))]);
    assert.ok(result.status === 409 || result.error, `upload did not end with 409 or a dropped connection: ${JSON.stringify(result)}`);
    await assert.rejects(fs.access(uploads), { code: 'ENOENT' });
  } finally {
    request?.destroy();
    await context.close();
  }
});
