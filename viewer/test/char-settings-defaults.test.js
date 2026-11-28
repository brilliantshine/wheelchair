'use strict';
require('./helpers/isolate-models.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const settings = require('../app/settings');

test('fresh and migrated placement orders preserve exclusions and add unseen families', () => {
  const fresh = settings.defaults();
  assert.deepEqual(fresh.lead_order, ['claude', 'any']);
  assert.deepEqual(fresh.worker_order, ['gpt', 'claude', 'gemini', 'kimi']);
  assert.deepEqual(fresh.worker_order_seen, ['claude', 'gpt', 'gemini', 'kimi', 'openrouter']);
  const migrated = settings.normalize({ lead_order: ['gpt'], worker_order: ['gpt'], worker_order_seen: ['claude', 'gpt'] });
  assert.deepEqual(migrated.lead_order, ['gpt']);
  assert.deepEqual(migrated.worker_order, ['gpt', 'gemini', 'kimi']);
  assert.deepEqual(migrated.worker_order_seen, ['claude', 'gpt', 'gemini', 'kimi', 'openrouter']);
  for (const family of ['both', 'claude', 'gpt', 'gemini', 'kimi', 'openrouter']) assert.equal(settings.normalize({ review_families: family }).review_families, family);
});
