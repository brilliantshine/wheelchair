'use strict';

require('./helpers/isolate-models.js');
const { makeTemp } = require('../../test-support/run-dir');

// A thread's slug is the plan its branch adds, not whatever docs/plans/ already holds.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const { newPlanDirectories, findSlug, features, addNeeds } = require('../app/views.js');

function git(cwd, ...args) { return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }); }

async function repoWithOldPlans() {
  const root = await makeTemp('app-slug-');
  const origin = path.join(root, 'origin.git');
  const work = path.join(root, 'work');
  execFileSync('git', ['init', '-q', '--bare', origin]);
  execFileSync('git', ['clone', '-q', origin, work]);
  git(work, 'config', 'user.email', 't@example.com'); git(work, 'config', 'user.name', 't');
  for (const name of ['aaa-old', 'zzz-old']) {
    await fs.mkdir(path.join(work, 'docs', 'plans', name), { recursive: true });
    await fs.writeFile(path.join(work, 'docs', 'plans', name, 'PLAN.md'), 'old\n');
  }
  git(work, 'add', '.'); git(work, 'commit', '-q', '-m', 'old plans');
  const branch = git(work, 'rev-parse', '--abbrev-ref', 'HEAD').trim();
  git(work, 'push', '-q', 'origin', branch);
  git(work, 'checkout', '-q', '-b', 'wc/t1', '--track', `origin/${branch}`);
  return { root, work, branch };
}

test('an untracked new plan directory is the thread plan, not an existing one', async () => {
  const { root, work } = await repoWithOldPlans();
  try {
    await fs.mkdir(path.join(work, 'docs', 'plans', 'new-thing'), { recursive: true });
    await fs.writeFile(path.join(work, 'docs', 'plans', 'new-thing', 'IDEA.md'), 'idea\n');
    assert.deepEqual(await newPlanDirectories(work), ['new-thing']);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('a plan directory committed on the thread branch is found against its upstream', async () => {
  const { root, work } = await repoWithOldPlans();
  try {
    await fs.mkdir(path.join(work, 'docs', 'plans', 'new-thing'), { recursive: true });
    await fs.writeFile(path.join(work, 'docs', 'plans', 'new-thing', 'IDEA.md'), 'idea\n');
    git(work, 'add', '.'); git(work, 'commit', '-q', '-m', 'idea');
    assert.deepEqual(await newPlanDirectories(work), ['new-thing']);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('an edited file in an existing plan directory does not claim that plan', async () => {
  const { root, work } = await repoWithOldPlans();
  try {
    await fs.writeFile(path.join(work, 'docs', 'plans', 'aaa-old', 'PLAN.md'), 'edited\n');
    await fs.writeFile(path.join(work, 'docs', 'plans', 'zzz-old', 'NOTES.md'), 'new file\n');
    assert.deepEqual(await newPlanDirectories(work), []);
    await fs.mkdir(path.join(work, 'docs', 'plans', 'new-thing'), { recursive: true });
    await fs.writeFile(path.join(work, 'docs', 'plans', 'new-thing', 'IDEA.md'), 'idea\n');
    assert.deepEqual(await newPlanDirectories(work), ['new-thing']);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('a file committed into an existing plan directory does not claim that plan', async () => {
  const { root, work } = await repoWithOldPlans();
  try {
    await fs.writeFile(path.join(work, 'docs', 'plans', 'aaa-old', 'PLAN.md'), 'edited\n');
    await fs.writeFile(path.join(work, 'docs', 'plans', 'aaa-old', 'NOTES.md'), 'new file\n');
    await fs.mkdir(path.join(work, 'docs', 'plans', 'new-thing'), { recursive: true });
    await fs.writeFile(path.join(work, 'docs', 'plans', 'new-thing', 'IDEA.md'), 'idea\n');
    git(work, 'add', '.'); git(work, 'commit', '-q', '-m', 'edit old, add new');
    assert.deepEqual(await newPlanDirectories(work), ['new-thing']);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('finds a committed plan on a no-track worktree branch against origin/default', async () => {
  const { root, work, branch } = await repoWithOldPlans();
  const noTrack = path.join(root, 'no-track');
  try {
    git(work, 'worktree', 'add', '--no-track', '-b', 'wc/no-track', noTrack, `origin/${branch}`);
    await fs.mkdir(path.join(noTrack, 'docs', 'plans', 'no-track-plan'), { recursive: true });
    await fs.writeFile(path.join(noTrack, 'docs', 'plans', 'no-track-plan', 'IDEA.md'), 'idea\n');
    git(noTrack, 'add', '.'); git(noTrack, 'commit', '-q', '-m', 'no-track plan');
    const thread = { worktree: noTrack, default_branch: branch };
    await findSlug({ save: async () => {} }, thread);
    assert.equal(thread.slug, 'no-track-plan');
  } finally { /* temp repositories are intentionally left for the test runner to reclaim */ }
});

test('finding the slug registers the plan directory once', async () => {
  const { root, work } = await repoWithOldPlans();
  try {
    await fs.mkdir(path.join(work, 'docs', 'plans', 'new-thing'), { recursive: true });
    await fs.writeFile(path.join(work, 'docs', 'plans', 'new-thing', 'IDEA.md'), 'idea\n');
    const registered = [];
    const hub = { save: async () => {}, registerPlan: async (dir) => { registered.push(dir); } };
    const thread = { worktree: work };
    await findSlug(hub, thread);
    await findSlug(hub, thread);
    assert.equal(thread.slug, 'new-thing');
    assert.deepEqual(registered, [path.join(work, 'docs', 'plans', 'new-thing')]);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('an archived thread whose worktree is gone is not searched for a slug', async () => {
  const root = await makeTemp('app-slug-gone-');
  try {
    let saves = 0;
    const thread = { worktree: path.join(root, 'removed'), archived: true };
    await findSlug({ save: async () => { saves += 1; } }, thread);
    assert.equal(thread.slug, undefined);
    assert.equal(saves, 0);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('an archived thread whose worktree the archive left behind is still searched', async () => {
  const { root, work } = await repoWithOldPlans();
  try {
    await fs.mkdir(path.join(work, 'docs', 'plans', 'new-thing'), { recursive: true });
    await fs.writeFile(path.join(work, 'docs', 'plans', 'new-thing', 'IDEA.md'), 'idea\n');
    const thread = { worktree: work, archived: true };
    await findSlug({ save: async () => {} }, thread);
    assert.equal(thread.slug, 'new-thing');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('target PR threads never discover a local plan', async () => {
  const { work, branch } = await repoWithOldPlans();
  await fs.mkdir(path.join(work, 'docs', 'plans', 'new-thing'), { recursive: true });
  await fs.writeFile(path.join(work, 'docs', 'plans', 'new-thing', 'IDEA.md'), 'idea');
  const thread = { id: 'one', worktree: work, default_branch: branch, target_pr: { url: 'https://github.com/o/r/pull/1' }, cards: [], sessions: [] };
  let saves = 0;
  const hub = { allThreads: async () => [thread], save: async () => { saves++; }, withThread: async (_id, fn) => fn(), thread: async () => thread };
  await findSlug(hub, thread);
  await features(hub);
  assert.equal(thread.slug, undefined);
  assert.equal(saves, 0);
});

test('open permit appears in Needs you with its PR number', () => {
  const needs = [];
  addNeeds(needs, { id: 'one', cards: [{ id: 'permit', kind: 'permit', pr_number: 42 }, { id: 'answered', kind: 'permit', pr_number: 43, answered: true }] });
  assert.deepEqual(needs, [{ thread_id: 'one', card_id: 'permit', kind: 'permit', title: 'Push to #42?' }]);
});
