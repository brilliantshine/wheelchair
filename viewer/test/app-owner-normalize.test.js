'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeThread } = require('../app/state.js');

test('normalizes all old thread fields in place and is idempotent', () => {
  const record = { collin_at: '2026-01', user_at: '2026-02', queues: { lead: [{ source: 'collin' }] }, sessions: [{ queue: [{ source: 'collin' }] }], sent: [{ source: 'collin' }], cards: [{ resolved_by: 'collin' }], pinned: { needs: { resolved_by: 'collin' }, other: 'id' }, imported: { history: [{ who: 'collin' }] }, handoff_op: { carried: { history: [{ who: 'collin' }] } } };
  assert.equal(normalizeThread(record), record);
  assert.equal(record.user_at, '2026-02'); assert.equal('collin_at' in record, false);
  assert.equal(JSON.stringify(record).includes('collin'), false);
  const copy = structuredClone(record); normalizeThread(record); assert.deepEqual(record, copy);
  assert.equal(normalizeThread({ collin_at: '2027', user_at: '2026' }).user_at, '2027');
  assert.doesNotThrow(() => normalizeThread({ queues: { bad: null }, sessions: [null], cards: {}, pinned: null }));
});
