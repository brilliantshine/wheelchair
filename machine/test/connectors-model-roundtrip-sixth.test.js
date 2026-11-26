'use strict';
const test = require('node:test');
const connectors = require('../../connectors');
const { roundTrip } = require('./helpers/model-roundtrip');

test('sixth connector round trip', { timeout: 120000 }, () => {
  const extra = structuredClone(connectors.list().find(t => t.provider === 'claude'));
  extra.provider = 'sixth'; extra.cli = 'sixth';
  roundTrip([...connectors.list(), extra]);
});
