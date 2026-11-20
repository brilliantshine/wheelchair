'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const { api, close, setup } = require('./helpers/app.js');
const settings = require('../app/settings.js');

const source = fs.readFileSync(path.join(__dirname, '../pages/settings.js'), 'utf8');
const expression = source.match(/const OPENROUTER_MODEL_VALUE = (.*);/)[1];
const pageRule = vm.runInNewContext(expression);
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
  assert.match(source, /\['openrouter', 'OpenRouter', 'Pi'\]/);
  assert.ok(source.includes('Counts as its own family for cross-checked reviews, even when it runs a Claude or GPT model.'));
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
