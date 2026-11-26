'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const connectors = require('../../connectors');
const { roundTrip } = require('./helpers/model-roundtrip');

test('model round trip rejects invalid sixth connector: sub-lead', { timeout: 120000 }, () => {
  const extra = structuredClone(connectors.list().find(t => t.provider === 'claude'));
  extra.provider = 'sixth'; extra.cli = 'sixth'; extra.models.pins['sub-lead'] = { model: 'sixth-sublead-model', effort: 'high' };
  assert.throws(() => roundTrip([...connectors.list(), extra]), /init default sixth sub-lead .*sixth-sublead-model/i);
});
