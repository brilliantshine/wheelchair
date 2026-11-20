'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const pi = require('../adapters/pi'), { makeTempSync } = require('../../test-support/run-dir');
test('Pi spend sums local calendar buckets and excludes invalid and other messages', () => {
  const dir = makeTempSync('pi-spend-'), folder = path.join(dir, 'sessions', 'nested'); fs.mkdirSync(folder, { recursive: true });
  const now = new Date(2026, 10, 20, 0, 1), row = (days, cost, provider = 'openrouter') => JSON.stringify({ type: 'message', timestamp: new Date(2026, 10, 20 - days, 0, 0).toISOString(), message: { role: 'assistant', provider, usage: { cost: { total: cost } } } });
  fs.writeFileSync(path.join(folder, 'a.jsonl'), [row(0, 1), row(1, 2), row(6, 3), row(7, 4), row(29, 5), row(30, 6), row(0, 90, 'other'), row(0, 'bad'), 'broken'].join('\n'));
  assert.deepEqual(pi.spend(dir, now), { today: 1, last_7_days: 6, last_30_days: 15 });
});
