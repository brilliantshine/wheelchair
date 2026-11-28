'use strict';
require('./helpers/isolate-models.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const connectors = require('../../connectors');

test('fresh accounts take unknown weight from the manifest', () => {
  const original = connectors.list;
  connectors.list = () => original().map(m => m.provider === 'gpt' ? { ...m, settings: { ...m.settings, weights: { ...m.settings.weights, unknown: 3 } } } : m);
  try {
    const path = require.resolve('../app/settings.js'); delete require.cache[path];
    const settings = require('../app/settings.js');
    assert.equal(settings.defaults().accounts.find(a => a.provider === 'gpt').weight, 3);
    delete require.cache[path];
  } finally { connectors.list = original; }
});
