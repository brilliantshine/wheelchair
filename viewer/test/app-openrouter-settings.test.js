'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { api, close, setup } = require('./helpers/app.js');
const settings = require('../app/settings.js');

const source = fs.readFileSync(path.join(__dirname, '../pages/settings.js'), 'utf8');
// The page's tool data is the connector manifests, served as tools.js without `install`.
const tools = JSON.parse(JSON.stringify(require('../../connectors').list())).map(({ install, ...rest }) => rest);
const pi = tools.find((t) => t.provider === 'openrouter');
const pageRule = new RegExp(pi.settings.modelPattern);
const cases = [['a/' + 'x'.repeat(126), true], ['a/' + 'x'.repeat(127), false], ['ab', false], ['a/b/c', false], ['a/b:', false], ['a/b::c', false], ['a/b:free', true]];

test('OpenRouter settings defaults, migration and page display', () => {
  assert.deepEqual(settings.PLANS.openrouter, { unknown: 1 });
  for (const value of [settings.defaults(), settings.normalize({ worker_order: ['claude', 'gpt'], lead_order: ['claude', 'any'] })]) {
    assert.ok(!value.worker_order.includes('openrouter'));
    assert.ok(!value.lead_order.includes('openrouter'));
    assert.ok(value.worker_order_seen.includes('openrouter'));
  }
  const saved = settings.normalize({ worker_order: ['openrouter', 'gpt'], lead_order: ['openrouter', 'any'] });
  assert.ok(saved.worker_order.includes('openrouter')); assert.ok(saved.lead_order.includes('openrouter'));
  assert.equal(settings.normalize({ review_families: 'openrouter' }).review_families, 'openrouter');
  assert.match(source, /const PROVIDERS = TOOLS\.map\(\(t\) => \[t\.provider, t\.label, t\.settings\.cliLabel\]\)/);
  assert.deepEqual([pi.provider, pi.label, pi.settings.cliLabel], ['openrouter', 'OpenRouter', 'Pi']);
  assert.ok(source.includes("text: tool.settings.familyHint"));
  assert.equal(pi.settings.familyHint, 'Counts as its own family for cross-checked reviews, even when it runs a Claude or GPT model.');
  assert.equal(pi.settings.modelError, 'Use vendor/model with an optional :variant, up to 128 lowercase letters, digits, dots, dashes and underscores.');
  assert.ok(source.includes('inlineErr(wrap, toolOf(provider).settings.modelError)'));
});

test('OpenRouter model IDs agree in the page and save route', async () => {
  const c = await setup();
  try {
    for (const [model, valid] of cases) {
      assert.equal(pageRule.test(model), valid, model);
      const response = await api(c, '/settings/models', { method: 'PUT', body: { provider: 'openrouter', slot: 'light', model } });
      assert.equal(response.status, valid ? 200 : 400, model);
    }
    const none = await api(c, '/settings/models', { method: 'PUT', body: { provider: 'openrouter', slot: 'light', model: null } });
    assert.equal(none.status, 200); assert.equal((await api(c, '/settings')).body.models.openrouter.light, null);
  } finally { await close(c); }
});

test('OpenRouter effort pin round-trips through Settings; unknown level is refused', async () => {
  const c = await setup();
  try {
    for (const effort of ['low', 'medium', 'high', 'xhigh', 'max']) {
      const saved = await api(c, '/settings/models', { method: 'PUT', body: { provider: 'openrouter', slot: 'heavy', model: 'a/b', effort } });
      assert.equal(saved.status, 200, effort);
      assert.deepEqual(saved.body.models.openrouter.heavy, { model: 'a/b', effort });
      assert.deepEqual((await api(c, '/settings')).body.models.openrouter.heavy, { model: 'a/b', effort });
    }
    const bad = await api(c, '/settings/models', { method: 'PUT', body: { provider: 'openrouter', slot: 'heavy', model: 'a/b', effort: 'ultra' } });
    assert.equal(bad.status, 400);
    const cleared = await api(c, '/settings/models', { method: 'PUT', body: { provider: 'openrouter', slot: 'heavy', model: 'a/b' } });
    assert.deepEqual(cleared.body.models.openrouter.heavy, { model: 'a/b', effort: null });
  } finally { await close(c); }
});
