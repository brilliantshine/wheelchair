'use strict';

// The "Check it yourself" card on the thread page, at phone and desktop width, against a real
// viewer server started with a temporary state dir (startWorld) and the fake gh the done card needs.
const fs = require('node:fs/promises');
const path = require('node:path');
const { makeTemp } = require('../../test-support/run-dir');
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

const SIZES = [
  ['phone', { width: 390, height: 844 }],
  ['desktop', { width: 1280, height: 800 }],
];
const H1 = 'a'.repeat(40);
const H2 = 'b'.repeat(40);

async function postDone(ctx, id, head, ghBin) {
  await fs.writeFile(path.join(ghBin, 'head'), head);
  await ctx.patch(id, (t) => { t.branch = null; t.default_branch = null; });
  return ctx.post(id, done(head));
}
function done(head) {
  return { head, kind: 'done', title: 'Built ' + head.slice(0, 1), can_do: ['Use it'], left_as_is: [], pr_url: 'https://github.com/x/y/pull/1' };
}
function check(head, steps) {
  return { kind: 'check', head, update: 'Merge the pull request, then run the installer.', steps };
}
const APP = { where: 'app', do: 'Open the thread page', see: 'A card titled Done', agent: 'matched' };
const CMD = { where: 'machine', do: 'Run the script', see: 'The word ok', command: 'echo one\necho two', agent: 'matched' };
const NOT = { where: 'app', do: 'Tap the thing', see: 'It turns blue', agent: 'not-tried', note: 'needs a real phone' };
const BAD = { where: 'app', do: 'Press save', see: 'A saved note', agent: 'broken', note: 'nothing happened' };

for (const [label, size] of SIZES) {
  test.describe(label, () => {
    test.use({ viewport: size });
    let ctx; let ghBin;
    test.beforeEach(async ({ page }) => {
      const bin = await makeTemp('browser-check-gh-');
      await fs.writeFile(path.join(bin, 'gh'), `#!/bin/sh\nprintf '{"state":"OPEN","mergeStateStatus":"CLEAN","headRefOid":"%s"}' "$(cat "$(dirname "$0")/head")"\n`, { mode: 0o755 });
      await fs.writeFile(path.join(bin, 'head'), H1);
      ghBin = bin;
      const oldPath = process.env.PATH; process.env.PATH = `${bin}:${oldPath}`;
      try { ctx = await startWorld(); } finally { process.env.PATH = oldPath; }
      await page.addInitScript(() => {
        window.__copied = [];
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } },
        });
      });
      await signIn(page, ctx);
    });
    test.afterEach(async () => { await ctx.close(); });
    const open = (page, id) => page.goto(`${ctx.server.url}/app/thread?id=${id}`);

    test('renders the steps, copy, notes and the two buttons', async ({ page }) => {
      const { id } = await ctx.make({ cli: 'claude' });
      await postDone(ctx, id, H1, ghBin);
      const good = await ctx.post(id, check(H1, [APP, CMD, NOT]));
      await open(page, id);
      const card = page.locator(`#card-${good.id}`);
      await expect(card.getByRole('heading', { name: 'Check it yourself' })).toBeVisible();
      await expect(card).toContainText('Merge the pull request, then run the installer.');
      const items = card.locator('ol > li');
      await expect(items).toHaveCount(3);
      await expect(items.nth(0)).toContainText('In the app');
      await expect(items.nth(0)).toContainText('Open the thread page');
      await expect(items.nth(1)).toContainText('On the machine');
      await expect(items.nth(1).locator('pre')).toHaveText('echo one\necho two');
      await expect(items.nth(1)).toContainText('You should see:');
      await expect(items.nth(1)).toContainText('The word ok');
      await expect(items.nth(2)).toContainText('Not tried by an agent: needs a real phone');
      await expect(card).not.toContainText("An agent tried this and it didn't work");
      // no broken step: no Fix/Leave, and Copy is the only button
      await expect(card.getByRole('button')).toHaveCount(1);
      const copy = card.getByRole('button', { name: 'Copy' });
      await copy.click();
      await expect(card.getByRole('button', { name: 'Copied' })).toBeVisible();
      expect(await page.evaluate(() => window.__copied)).toEqual(['echo one\necho two']);
      await expect(card.getByRole('button', { name: 'Copy', exact: true })).toBeVisible({ timeout: 5000 });

      const bad = await ctx.post(id, { ...check(H1, [BAD, APP]) , head: H1 }).catch((e) => e);
      expect(String(bad)).toMatch(/already has a check card/);
    });

    test('broken step: buttons show once, vanish after a press', async ({ page }) => {
      const { id } = await ctx.make({ cli: 'claude' });
      await postDone(ctx, id, H1, ghBin);
      const c = await ctx.post(id, check(H1, [APP, BAD]));
      await open(page, id);
      const card = page.locator(`#card-${c.id}`);
      await expect(card.locator('.check-broken')).toHaveText("An agent tried this and it didn't work: nothing happened");
      await expect(card.getByRole('button', { name: 'Fix it now' })).toBeVisible();
      await expect(card.getByRole('button', { name: 'Leave it' })).toBeVisible();
      await expect(card.getByRole('button')).toHaveCount(2);
      await card.getByRole('button', { name: 'Fix it now' }).click();
      await expect(card.getByRole('button')).toHaveCount(0);
      await expect(card).toHaveClass(/is-answered/);
    });

    test('buttons go once a newer done appears', async ({ page }) => {
      const { id } = await ctx.make({ cli: 'claude' });
      await postDone(ctx, id, H1, ghBin);
      const old = await ctx.post(id, check(H1, [BAD]));
      await open(page, id);
      await expect(page.locator(`#card-${old.id}`).getByRole('button', { name: 'Leave it' })).toBeVisible();
      await postDone(ctx, id, H2, ghBin);
      const fresh = await ctx.post(id, check(H2, [BAD]));
      await page.reload();
      await expect(page.locator(`#card-${fresh.id}`).getByRole('button', { name: 'Fix it now' })).toBeVisible();
      await expect(page.locator(`#card-${old.id}`).getByRole('button')).toHaveCount(0);
    });

    test('a very long command scrolls inside its block', async ({ page }) => {
      const { id } = await ctx.make({ cli: 'claude' });
      await postDone(ctx, id, H1, ghBin);
      const c = await ctx.post(id, check(H1, [{ ...CMD, command: 'x'.repeat(900) }]));
      await open(page, id);
      const pre = page.locator(`#card-${c.id} pre`);
      await expect(pre).toBeVisible();
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(wide).toBe(false);
      expect(await pre.evaluate((n) => n.scrollWidth > n.clientWidth)).toBe(true);
    });
  });
}
