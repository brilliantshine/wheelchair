'use strict';

// A thread's slug is the plan its branch adds, not whatever docs/plans/ already holds.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const { newPlanDirectories, findSlug } = require('../app/views.js');

function git(cwd, ...args) { return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }); }

async function repoWithOldPlans() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'app-slug-'));
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
  return { root, work };
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
