'use strict';
const test = require('node:test');
const connectors = require('../../connectors');
const { roundTrip } = require('./helpers/model-roundtrip');

test('real model pin round trip for every connector', { timeout: 120000 }, () => roundTrip(connectors.list()));
