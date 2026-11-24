'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempSync } = require('../run-dir');
const { chooseWorkers, liveOthers, register, unregister } = require('../browser-workers');

test('worker count depends on full runs and CPUs', () => {
  for (const [cpus, expected] of [[16, 6], [8, 4], [4, 2], [2, 2], [1, 2]])
    assert.equal(chooseWorkers({ full: true, othersFull: false, cpus }), expected);
  assert.equal(chooseWorkers({ full: false, othersFull: false, cpus: 16 }), 2);
  assert.equal(chooseWorkers({ full: true, othersFull: true, cpus: 16 }), 2);
});

test('stale entries are ignored and removed', () => {
  const dir = makeTempSync('browser-workers-');
  const stale = path.join(dir, '2147483647');
  fs.writeFileSync(stale, '');
  assert.equal(liveOthers(dir, process.pid), 0);
  assert.equal(fs.existsSync(stale), false);
});

test('live entries count except for own pid', () => {
  const dir = makeTempSync('browser-workers-');
  register(dir, process.pid);
  assert.equal(liveOthers(dir, process.pid), 0);
  assert.equal(liveOthers(dir, 0), 1);
});

test('register and unregister create and remove the pid file', () => {
  const dir = makeTempSync('browser-workers-');
  const file = path.join(dir, String(process.pid));
  register(dir, process.pid);
  assert.equal(fs.existsSync(file), true);
  unregister(dir, process.pid);
  assert.equal(fs.existsSync(file), false);
});
