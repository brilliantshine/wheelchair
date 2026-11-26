'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const connectors = require('../../connectors');
const { roundTrip } = require('./helpers/model-roundtrip');

test('model round trip rejects invalid sixth connector: capital model', { timeout: 120000 }, () => {
  const extra = structuredClone(connectors.list().find(t => t.provider === 'claude'));
  extra.provider = 'sixth'; extra.cli = 'sixth'; extra.models.pins.light.model = 'Capital';
  assert.throws(() => roundTrip([...connectors.list(), extra]), /malformed/i);
});
