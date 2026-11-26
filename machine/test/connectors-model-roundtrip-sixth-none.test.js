'use strict';
const test = require('node:test');
const connectors = require('../../connectors');
const { roundTrip } = require('./helpers/model-roundtrip');

test('sixth connector with none defaults round trip', { timeout: 120000 }, () => {
  const extra = structuredClone(connectors.list().find(t => t.provider === 'claude'));
  extra.provider = 'sixth'; extra.cli = 'sixth';
  for (const slot of ['light', 'standard', 'heavy', 'critical', 'lead']) extra.models.pins[slot] = { model: 'none' };
  roundTrip([...connectors.list(), extra]);
});
