'use strict';

// The hub's own machine as the installer registers it: under the hostname, while threads say
// "hub" (docs/plans/app-shell, "State" and "Machine service on the hub").
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
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

test('a lead whose machine refuses the start is recorded as failed, not left starting', async () => {
  const hub = new Hub({ stateDir: await installerShapedState(await freePort()) });
  await hub.init();
  await assert.rejects(hub.createThread({ project: '/tmp/nowhere', cli: 'claude', machine: 'hub' }));
  const [made] = await hub.allThreads();
  assert.equal(made.sessions[0].status, 'failed');
  assert.equal(made.sessions[0].live, false);
  assert.ok(made.sessions[0].error);
});
