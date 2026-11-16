'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { features } = require('../app/views.js');

async function worktreeWithStatus(status) {
  const worktree = await fs.mkdtemp(path.join(os.tmpdir(), 'wc-features-'));
  await fs.mkdir(path.join(worktree, 'docs', 'plans', 'example'), { recursive: true });
  await fs.writeFile(path.join(worktree, 'docs', 'plans', 'example', 'PLAN.md'), `status: ${status}\n`);
  return worktree;
}

test('answers without waiting on a thread that is busy', async (t) => {
  const worktree = await worktreeWithStatus('implementing');
  t.after(() => fs.rm(worktree, { recursive: true, force: true }));
  const thread = { id: 't1', slug: 'example', worktree, last_status: 'implementing', sessions: [], cards: [
    { id: 'q1', kind: 'question', question: 'Choose?', answered: false },
  ] };
  const hub = {
    allThreads: async () => [thread],
    withThread: () => new Promise(() => {}), // held for good, as by a slow session start
  };
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('features waited on the lock')), 1000));
  const result = await Promise.race([features(hub), timeout]);
  assert.equal(result.building[0].id, 't1');
  assert.equal(result.needs[0].card_id, 'q1');
});

test('saves a changed status under the lock, on a fresh read', async (t) => {
  const worktree = await worktreeWithStatus('verifying');
  t.after(() => fs.rm(worktree, { recursive: true, force: true }));
  const snapshot = { id: 't1', slug: 'example', worktree, last_status: 'implementing', sessions: [], cards: [] };
  const stored = { ...snapshot, cards: [{ id: 'new' }] };
  const saved = [];
  const hub = {
    allThreads: async () => [snapshot],
    withThread: (id, work) => work(),
    thread: async () => stored,
    save: async (thread) => { saved.push(thread); },
  };
  const result = await features(hub);
  assert.equal(result.verifying[0].id, 't1');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].last_status, 'verifying');
  assert.deepEqual(saved[0].cards, [{ id: 'new' }]);
  await features({ ...hub, allThreads: async () => [{ ...snapshot, last_status: 'verifying' }] });
  assert.equal(saved.length, 1, 'an unchanged status is not saved again');
});
