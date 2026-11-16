'use strict';

// GET /threads?view=list: the summary the pages poll, without each thread's history.
const assert = require('node:assert/strict');
const test = require('node:test');
const { api, close, setup, thread } = require('./helpers/app.js');

test('the list view keeps the summary and drops the history', async () => {
  const context = await setup();
  try {
    const made = await thread(context, { project: '/srv/proj', machine: 'hub', message: 'Faster lists' });
    const full = (await api(context, '/threads')).body.threads.find((t) => t.id === made.id);
    const lean = (await api(context, '/threads?view=list')).body.threads.find((t) => t.id === made.id);
    assert.ok(Array.isArray(full.cards) && full.sessions.length, 'the full view still carries the history');
    for (const key of ['cards', 'sent', 'delivered_ids', 'context', 'pinned', 'archive', 'queues']) assert.equal(key in lean, false, key);
    for (const key of ['id', 'title', 'project', 'machine', 'created_at', 'lead_name']) assert.deepEqual(lean[key], full[key], key);
    assert.equal(lean.sessions.length, full.sessions.length);
    for (const s of lean.sessions) {
      assert.deepEqual(Object.keys(s).sort().filter((k) => s[k] !== undefined), ['created_at', 'live', 'name', 'ready', 'role', 'turn_ended'].filter((k) => s[k] !== undefined));
      assert.ok(s.name && s.role);
    }
  } finally { await close(context); }
});
