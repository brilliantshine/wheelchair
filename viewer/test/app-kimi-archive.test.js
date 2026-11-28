'use strict';

require('./helpers/isolate-models.js');
const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { makeTemp } = require('../../test-support/run-dir');
const { Hub } = require('../app/hub');

test('archive stays open while a fatal stop is pending, then retries successfully', async () => {
  const dir = await makeTemp('kimi-archive-');
  const hub = new Hub({ stateDir: path.join(dir, 'state'), codeVersion: '' });
  await hub.state.init();
  await hub.save({
    id: 'thread-one', machine: 'hub', archived: false, archive: null,
    sessions: [{ name: 'wc-thread-one-worker', live: true }],
    cards: [], pinned: {}, queues: {}, asides: [],
  });
  const responses = [
    {
      pending: true,
      pending_sessions: ['wc-thread-one-worker'],
      stopped: [], committed: [], removed: [],
      kept: [{ worktree: '/tmp/worktree', reason: 'fatal stop pending' }],
    },
    { pending: false, pending_sessions: [], stopped: ['wc-thread-one-worker'], committed: [], removed: [], kept: [] },
  ];
  hub.call = async () => responses.shift();

  const first = await hub.archive('thread-one');
  assert.equal(first.pending, true);
  let thread = await hub.thread('thread-one');
  assert.equal(thread.archived, false);
  assert.equal(thread.sessions[0].live, true);
  assert.equal(Object.hasOwn(thread.sessions[0], 'ended_at'), false);
  const needs = thread.cards.filter((card) => card.kind === 'needs' && card.title === 'Archive waiting for a session to stop');
  assert.equal(needs.length, 1);
  assert.match(needs[0].body, /wc-thread-one-worker/);
  assert.match(needs[0].body, /hub/);

  const second = await hub.archive('thread-one');
  assert.equal(second.pending, false);
  thread = await hub.thread('thread-one');
  assert.equal(thread.archived, true);
  assert.equal(thread.sessions[0].live, false);
  assert.ok(thread.sessions[0].ended_at);
});

