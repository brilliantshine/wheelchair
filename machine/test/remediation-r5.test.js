'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { versionArgs } = require('../lib/harness-install');
const connectors = require('../../connectors');
const { MachineService } = require('../service');

test('omitted installer versionArgs defaults to --version while null skips', () => {
  assert.deepEqual(versionArgs({}), ['--version']);
  assert.deepEqual(versionArgs({ versionArgs: ['-V'] }), ['-V']);
  assert.equal(versionArgs({ versionArgs: null }), null);
});

test('prepareLaunch forwards launchContext keys without replacing service context', async () => {
  const adapter = connectors.machine('claude'), previousCommand = adapter.command, previousLaunchContext = adapter.launchContext;
  let received;
  adapter.launchContext = async () => ({ marker: 1, stateDir: 'x' });
  adapter.command = (_i, _s, _w, context) => { received = context; return { argv: ['fake'] }; };
  try {
    const service = new MachineService({ stateDir: '/tmp/r5-command-context' });
    service.win = null;
    await service.prepareLaunch({ cli:'claude', role:'reviewer' }, { name:'wc-r5-reviewer', cli:'claude', token:'token' }, adapter, '/work', '/prompt', 'role', false);
    assert.equal(received.marker, 1);
    assert.equal(received.stateDir, service.stateDir);
  } finally { adapter.command = previousCommand; adapter.launchContext = previousLaunchContext; }
});

test('versionCheck problem masks account even without resolveCli', () => {
  const manifest = connectors.manifest, adapter = connectors.machine('claude'), previousLoginStatus = adapter.loginStatus;
  const clone = { ...manifest('claude'), capabilities:{ ...manifest('claude').capabilities, versionCheck:true } };
  adapter.loginStatus = () => ({ logged_in: true, problem: 'host credentials should be masked' });
  connectors.manifest = cli => cli === 'claude' ? clone : manifest(cli);
  try {
    const service = new MachineService({ stateDir: '/tmp/r5-version-status' });
    service.cliStatus = cli => cli === 'claude' ? { problem:'version too old' } : {};
    service.sessionList = () => [];
    assert.equal(connectors.machine('claude').resolveCli, undefined);
    const account = service.status().accounts.find(a => a.cli === 'claude');
    assert.equal(account.logged_in, false);
    assert.equal(Object.hasOwn(account, 'problem'), false);
  } finally { connectors.manifest = manifest; adapter.loginStatus = previousLoginStatus; }
});
