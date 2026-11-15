'use strict';

// The New thread screen at phone width (docs/plans/new-thread-screen, "The New thread screen"):
// one column, no sideways scroll, a thread started, a refusal shown with the fields kept, and a
// directory saved and removed. The hub and the fake machine service come from helpers/app.js.
const { test, expect } = require('@playwright/test');
const { close, setup } = require('./helpers/app.js');
const { signIn } = require('./helpers/app-threads-world');

test.use({ viewport: { width: 390, height: 844 } });

let ctx;
test.beforeEach(async ({ page }) => {
  ctx = await setup();
  ctx.machine.projects = { found: [{ name: 'alpha', path: '/home/fake/code/alpha' }] };
  await signIn(page, ctx);
  await page.evaluate(() => fetch('/wheelchair/api/settings/preferences', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ default_project_folder: '~/code' }),
  }));
});
test.afterEach(async () => { await close(ctx); });

const open = (page) => page.goto(`${ctx.server.url}/app/new`);
async function noSideScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test('one column, full-width controls, no sideways scroll', async ({ page }) => {
  await open(page);
  await expect(page.locator('#nt-project optgroup[label="In ~/code"] option')).toHaveText(['alpha']);
  await expect(page.locator('#nt-path')).toHaveText('/home/fake/code/alpha');
  await expect(page.locator('#nt-note')).toHaveText('Only git repositories in ~/code are listed.');
  const widths = await page.evaluate(() => ['nt-machine', 'nt-project', 'nt-cli', 'nt-message', 'nt-go', 'add-name', 'add-path', 'add-go']
    .map((id) => [id, document.getElementById(id).getBoundingClientRect().width]));
  for (const [id, width] of widths) expect(width, id).toBeGreaterThan(300);
  await noSideScroll(page);
});

test('start posts the picked project and opens the thread', async ({ page }) => {
  await open(page);
  await expect(page.locator('#nt-go')).toBeEnabled();
  await page.locator('#nt-cli').selectOption('codex');
  await page.locator('#nt-message').fill('hello lead');
  const request = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/api/threads'));
  await page.locator('#nt-go').click();
  expect((await request).postDataJSON()).toEqual({ project: '/home/fake/code/alpha', cli: 'codex', machine: 'hub', message: 'hello lead' });
  await expect(page).toHaveURL(/\/app\/thread\?id=[0-9a-f]+/);
});

test('a refusal shows on the screen and keeps the fields', async ({ page }) => {
  ctx.machine.projects = { bad: { '/home/fake/code/alpha': 'is not a git repository' } };
  await open(page);
  await page.locator('#nt-message').fill('keep me');
  await page.locator('#nt-cli').selectOption('codex');
  await page.locator('#nt-go').click();
  await expect(page.locator('#form-error')).toContainText('is not a git repository');
  await expect(page).toHaveURL(/\/app\/new$/);
  await expect(page.locator('#nt-message')).toHaveValue('keep me');
  await expect(page.locator('#nt-cli')).toHaveValue('codex');
  await expect(page.locator('#nt-project')).toHaveValue('/home/fake/code/alpha');
  await expect(page.locator('#nt-go')).toBeEnabled();
  await noSideScroll(page);
});

test('save a directory, pick it, then remove it', async ({ page }) => {
  await open(page);
  await expect(page.locator('#saved-empty')).toBeVisible();
  await page.locator('#add-name').fill('scratch');
  await page.locator('#add-path').fill('~/scratch');
  await page.locator('#add-go').click();
  await expect(page.locator('#saved-list li[data-name="scratch"]')).toContainText('/home/fake/scratch');
  await expect(page.locator('#nt-project optgroup[label="Saved"] option')).toHaveText(['scratch']);
  await expect(page.locator('#nt-project')).toHaveValue('/home/fake/scratch');
  await expect(page.locator('#nt-path')).toHaveText('/home/fake/scratch');
  await noSideScroll(page);
  // A refused save shows beside the row and keeps what was typed.
  ctx.machine.projects = { bad: { '/home/fake/nope': 'is not a git repository' } };
  await page.locator('#add-name').fill('nope');
  await page.locator('#add-path').fill('~/nope');
  await page.locator('#add-go').click();
  await expect(page.locator('#saved-error')).toContainText('is not a git repository');
  await expect(page.locator('#add-name')).toHaveValue('nope');
  await page.locator('#saved-list li[data-name="scratch"] button').click();
  await expect(page.locator('#saved-list li')).toHaveCount(0);
  await expect(page.locator('#nt-project optgroup[label="Saved"]')).toHaveCount(0);
  await expect(page.locator('#nt-project')).toHaveValue('/home/fake/code/alpha');
});

test('an empty list disables Start and points at saving a directory', async ({ page }) => {
  ctx.machine.projects = { found: [] };
  await open(page);
  await expect(page.locator('#nt-empty')).toBeVisible();
  await expect(page.locator('#nt-go')).toBeDisabled();
});

test('no default folder: a line linking to Settings', async ({ page }) => {
  await page.evaluate(() => fetch('/wheelchair/api/settings/preferences', {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ default_project_folder: '' }),
  }));
  await open(page);
  await expect(page.locator('#nt-no-folder a')).toHaveAttribute('href', '/wheelchair/app/settings');
  await expect(page.locator('#nt-note')).toBeHidden();
});
