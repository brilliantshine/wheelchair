'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const connectors = require('../../connectors');
const { validateManifest } = require('../../connectors/contract');

test('minimal manifest can be read by the settings store', () => {
  const original = connectors.list;
  const source = original()[0];
  const m = structuredClone(source);
  for (const key of Object.keys(m)) if (!['cli','provider','label','displayName','typesRoleMessage','singleAccount','capabilities','install','settings','models','placement'].includes(key)) delete m[key];
  m.install = { command: m.install.command, binary: m.install.binary, lookup: 'path', label: m.install.label };
  m.settings = { modelPattern: m.settings.modelPattern };
  m.models = { pins: m.models.pins, format: m.models.format, hubPattern: m.models.hubPattern, efforts: m.models.efforts };
  m.placement = { workerRank: null };
  validateManifest(m);
  connectors.list = () => original().map(x => x.cli === m.cli ? m : x);
  const settingsPath = require.resolve('../app/settings');
  delete require.cache[settingsPath];
  try {
    const settings = require(settingsPath);
    assert.equal(settings.PLANS[m.provider], undefined);
    assert.doesNotThrow(() => settings.defaults());
    assert.doesNotThrow(() => settings.normalize({ accounts: [{ id: 'custom', provider: m.provider, name: 'test', plan: 'unknown' }] }));
    assert.equal(settings.options({})[m.provider], undefined);
  } finally { connectors.list = original; delete require.cache[settingsPath]; }
});

test('minimal manifest works in hub routes, assets and usage', async () => {
  const path = require('node:path');
  const { setup, close, api } = require('./helpers/app');
  const hook = path.join(__dirname, 'hooks/minimal-connector.js');
  const context = await setup({ env: { NODE_OPTIONS: `--require=${hook}` } });
  try {
    const bad = await api(context, '/settings/models', { method: 'PUT', body: { provider: 'claude', slot: 'light', model: 'model', effort: 'bad' } });
    assert.equal(bad.status, 400); assert.equal(bad.body.detail, 'effort is invalid');
    const valid = await api(context, '/settings/models', { method: 'PUT', body: { provider: 'claude', slot: 'light', model: 'model' } });
    assert.equal(valid.status, 200);
    const asset = await fetch(`${context.server.url}/assets/tools.js`); assert.equal(asset.status, 200); assert.match(await asset.text(), /WHEELCHAIR_TOOLS/);
    const balancing = await api(context, '/settings/balancing', { method: 'PUT', body: { worker_order: ['claude'] } }); assert.equal(balancing.status, 200);
    const placement = await api(context, '/harnesses'); assert.equal(placement.status, 200); assert.equal(typeof placement.body.can_start.worker.ok, 'boolean');
    const usage = await api(context, '/usage'); assert.equal(usage.status, 200); assert.ok(usage.body.providers.claude);
  } finally { await close(context); }
});
