'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const connectors = require('../../connectors');
const sessions = require('../app/sessions');

test('a manifest without report takes hook text before reading the transcript', async () => {
  const original = connectors.manifest;
  const manifest = structuredClone(original('codex'));
  delete manifest.report;
  connectors.manifest = cli => cli === manifest.cli ? manifest : original(cli);
  const target = { name: 'reviewer', role: 'reviewer', started_by: 'lead', cli: manifest.cli, live: true, ready: true, queue: [] };
  const lead = { name: 'lead', role: 'lead', live: true, ready: false, queue: [] };
  const thread = { id: 't', machine: 'm', sessions: [target, lead], cards: [], queues: {}, delivered_ids: [] };
  const hub = { thread: async () => thread, save: async () => {}, appendSent: async () => {}, call: async () => { throw new Error('unexpected transcript read'); } };
  try {
    await sessions.event(hub, { thread_id: 't', session: target.name, type: 'turn-ended', turn_id: 1, 'last-assistant-message': 'hook report' });
    assert.equal(thread.cards[0].summary, 'hook report');
    assert.match(lead.queue[0].text, /hook report/);
  } finally { connectors.manifest = original; }
});
