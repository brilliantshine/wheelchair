'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeTempSync } = require('../../test-support/run-dir');
const { readState, writeState, hasUnresolved } = require('../lib/win-sync');
test('state is persisted and unresolved paths are reported', () => {
  const root = makeTempSync('win-sync-'); assert.equal(hasUnresolved(root,'a'),false);
  const state = {last_ok:'now',last_failed:null,used_since_ok:false,unresolved:['a']}; writeState(root,'a',state);
  assert.deepEqual(readState(root,'a'),state); assert.equal(hasUnresolved(root,'a'),true);
});
