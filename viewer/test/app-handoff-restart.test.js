'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { donePr, stageFor } = require('../app/handoff.js');
test('imported PR ignores older done cards and falls back to carried PR', () => {
  const thread = { imported: { at: '2026-01-02T00:00:00Z', pr_url: 'carried' }, cards: [{ kind: 'done', at: '2026-01-01T00:00:00Z', pr_url: 'old' }] };
  assert.equal(donePr(thread), 'carried');
  assert.equal(stageFor(thread, { plan_status: 'done' }), 'done');
  thread.cards.push({ kind: 'done', at: '2026-01-03T00:00:00Z', pr_url: 'new' });
  assert.equal(donePr(thread), 'new');
});
