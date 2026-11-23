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

test('commandFor forwards every launchContext key', () => {
  const adapter = connectors.machine('claude'), previous = adapter.command;
  let received;
  adapter.command = (_i, _s, _w, context) => { received = context; return {}; };
  try {
    const service = new MachineService({ stateDir: '/tmp/r5-command-context' });
    service.commandFor({ cli:'claude', role:'worker' }, { account_dir:null }, '/work', '/prompt', 'role', {}, { launchExtras:{ marker:1 } });
    assert.equal(received.marker, 1);
  } finally { adapter.command = previous; }
});

test('versionCheck problem masks account even without resolveCli', () => {
  const manifest = connectors.manifest, clone = { ...manifest('claude'), capabilities:{ ...manifest('claude').capabilities, versionCheck:true } };
  connectors.manifest = cli => cli === 'claude' ? clone : manifest(cli);
  try {
    const service = new MachineService({ stateDir: '/tmp/r5-version-status' });
    service.cliStatus = cli => cli === 'claude' ? { problem:'version too old' } : {};
    service.sessionList = () => [];
    assert.equal(connectors.machine('claude').resolveCli, undefined);
    assert.equal(service.status().accounts.find(a => a.cli === 'claude').logged_in, false);
  } finally { connectors.manifest = manifest; }
});
