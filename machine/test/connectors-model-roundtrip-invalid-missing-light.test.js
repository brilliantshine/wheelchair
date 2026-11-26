'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const connectors = require('../../connectors');
const { roundTrip } = require('./helpers/model-roundtrip');

test('model round trip rejects invalid sixth connector: missing light', { timeout: 120000 }, () => {
  const extra = structuredClone(connectors.list().find(t => t.provider === 'claude'));
  extra.provider = 'sixth'; extra.cli = 'sixth'; delete extra.models.pins.light;
  assert.throws(() => roundTrip([...connectors.list(), extra]), /(?:Traceback|KeyError).*light/s);
});
