'use strict';

// The in-app plan document page (docs/plans/app-paper-cuts, S3), driven in a browser at phone and
// desktop width against a real viewer server, a real git checkout for the live thread's plan and a
// real branch for the archived thread's.
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

const FIXTURES = path.join(__dirname, 'fixtures', 'plan-doc');
const SIZES = [
  ['phone', { width: 390, height: 844 }],
  ['desktop', { width: 1280, height: 800 }],
];

const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { stdio: 'pipe' });

async function planRepo(slug, files) {
  const repo = await fs.mkdtemp(path.join(os.tmpdir(), 'wc-doc-'));
  git(repo, 'init', '-q');
  const dir = path.join(repo, 'docs', 'plans', slug);
  await fs.mkdir(dir, { recursive: true });
  for (const f of files) await fs.copyFile(path.join(FIXTURES, f), path.join(dir, f));
  return repo;
}

async function noSideScroll(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
}

for (const [label, size] of SIZES) {
  test.describe(label, () => {
    test.use({ viewport: size });
    let ctx;
    test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
    test.afterEach(async () => { await ctx.close(); });

    const docUrl = (id, file) => `${ctx.server.url}/app/doc?thread=${id}&file=${file}`;
    async function liveThread() {
      const made = await ctx.make({ cli: 'claude' });
      const repo = await planRepo('dark', ['PLAN.md', 'IDEA.md']);
      await ctx.patch(made.id, (x) => { x.worktree = repo; });
      // The slug is discovered (and the plan registered) when the thread's chat is read.
      const chat = await fetch(`${ctx.server.url}/api/threads/${made.id}/chat?token=${ctx.server.token}`);
      expect((await chat.json()).thread.slug).toBe('dark');
      return made;
    }

    test('a live thread: nav, rendered heading, a table, and Back to the thread', async ({ page }) => {
      const made = await liveThread();
      await page.goto(docUrl(made.id, 'PLAN.md'));
      await expect(page.locator('#app-nav a', { hasText: 'Agents' })).toBeVisible();
      await expect(page.locator('#content h1')).toHaveText('Dark mode plan');
      await expect(page.locator('#content table')).toHaveCount(1);
      await expect(page.locator('#content table td', { hasText: 'Sonnet' })).toBeVisible();
      await noSideScroll(page);
      await page.getByRole('link', { name: /Back to the thread/ }).click();
      await expect(page).toHaveURL(new RegExp(`/app/thread\\?id=${made.id}$`));
    });

    test('links: MAP.md stays in the app, other relative links are text, http opens a new tab', async ({ page }) => {
      const made = await liveThread();
      await page.goto(docUrl(made.id, 'PLAN.md'));
      await expect(page.locator('#content h1')).toBeVisible();
      await expect(page.locator('#content a', { hasText: 'the map' })).toHaveAttribute(
        'href', `/wheelchair/app/doc?thread=${made.id}&file=MAP.md`);
      await expect(page.locator('#content a', { hasText: 'elsewhere' })).toHaveCount(0);
      await expect(page.locator('#content p', { hasText: 'elsewhere' })).toBeVisible();
      const site = page.locator('#content a', { hasText: 'site' });
      await expect(site).toHaveAttribute('target', '_blank');
      await expect(site).toHaveAttribute('rel', /noopener/);
      await expect(page.locator('#content a', { hasText: 'bad' })).toHaveCount(0);
    });

    test('an archived thread reads its document from the branch', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      const repo = await planRepo('dark', ['PLAN.md', 'IDEA.md']);
      git(repo, 'add', '.');
      git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'plan');
      git(repo, 'branch', '-M', 'feature');
      await ctx.patch(made.id, (x) => { x.archived = true; x.branch = 'feature'; x.slug = 'dark'; x.project = repo; });
      await page.goto(docUrl(made.id, 'IDEA.md'));
      await expect(page.locator('#app-nav a', { hasText: 'Agents' })).toBeVisible();
      await expect(page.locator('#content h1')).toHaveText('The idea');
      await page.goto(docUrl(made.id, 'PLAN.md'));
      await expect(page.locator('#content table')).toHaveCount(1);
      await page.getByRole('link', { name: /Back to the thread/ }).click();
      await expect(page).toHaveURL(new RegExp(`/app/thread\\?id=${made.id}$`));
    });

    test('errors are a plain message with the back link, never blank', async ({ page }) => {
      const made = await liveThread();
      const back = () => expect(page.getByRole('link', { name: /Back to the thread/ })).toBeVisible();
      await page.goto(docUrl(made.id, 'MAP.md'));        // in the plan list but not on disk
      await expect(page.locator('#message')).toHaveText('No MAP.md in this thread yet');
      await back();
      await page.goto(docUrl(made.id, 'README.md'));     // not one of the three
      await expect(page.locator('#message')).toContainText('README.md');
      await back();
      await page.goto(docUrl('nope', 'PLAN.md'));        // unknown thread
      await expect(page.locator('#message')).toContainText('thread');
      const bare = await ctx.make({ cli: 'claude' });    // no slug yet
      await page.goto(docUrl(bare.id, 'IDEA.md'));
      await expect(page.locator('#message')).toHaveText('No IDEA.md in this thread yet');
      await back();
    });

    test('an archived thread has MAP/IDEA/PLAN links and no #docview panel', async ({ page }) => {
      const made = await ctx.make({ cli: 'claude' });
      await ctx.patch(made.id, (x) => { x.archived = true; x.branch = 'feature'; x.slug = 'dark'; });
      await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
      for (const f of ['MAP', 'IDEA', 'PLAN']) {
        await expect(page.locator('#files a', { hasText: f })).toHaveAttribute(
          'href', `/wheelchair/app/doc?thread=${made.id}&file=${f}.md`);
      }
      await expect(page.locator('#docview')).toHaveCount(0);
    });
  });
}
