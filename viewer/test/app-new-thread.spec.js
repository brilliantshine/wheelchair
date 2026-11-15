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
  await expect(page.locator('#add-error')).toBeVisible();
  await expect(page.locator('#add-name')).toHaveValue('nope');
  await expect(page.locator('#add-error')).toContainText('is not a git repository');
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

// A /new-thread answer for the page, built by hand so a second machine needs no second service.
const answer = (machine, extra = {}) => ({
  machine, machines: ['hub', 'other'], default_folder: '~/code', found: [], previous: [], saved: [], ...extra,
});

test('switching machine disables Start and empties the project list until the answer lands', async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/new-thread?machine=*', async (route) => {
    const machine = new URL(route.request().url()).searchParams.get('machine');
    if (machine === 'other') await gate;
    await route.fulfill({ json: answer(machine, { found: [{ name: machine + '-repo', path: '/srv/' + machine + '-repo' }] }) });
  });
  await open(page);
  await expect(page.locator('#nt-project option')).toHaveText(['hub-repo']);
  await expect(page.locator('#nt-go')).toBeEnabled();
  await page.locator('#nt-machine').selectOption('other');
  await expect(page.locator('#nt-go')).toBeDisabled();
  await expect(page.locator('#nt-project')).toBeDisabled();
  await expect(page.locator('#nt-project option')).toHaveCount(0);
  release();
  await expect(page.locator('#nt-project option')).toHaveText(['other-repo']);
  await expect(page.locator('#nt-go')).toBeEnabled();
  const request = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/api/threads'));
  await page.route('**/api/threads', (route) => route.fulfill({ status: 500, json: { error: 'stop' } }));
  await page.locator('#nt-go').click();
  expect((await request).postDataJSON()).toMatchObject({ machine: 'other', project: '/srv/other-repo' });
});

test('switching machine empties the saved list until the answer lands', async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route('**/api/new-thread?machine=*', async (route) => {
    const machine = new URL(route.request().url()).searchParams.get('machine');
    if (machine === 'other') await gate;
    const saved = [{ name: machine + '-dir', path: '/srv/' + machine + '-dir', machine }];
    await route.fulfill({ json: answer(machine, { saved, found: [{ name: machine + '-repo', path: '/srv/' + machine + '-repo' }] }) });
  });
  await open(page);
  await expect(page.locator('#saved-list li')).toHaveCount(1);
  await expect(page.locator('#saved-list li[data-name="hub-dir"]')).toHaveCount(1);
  await page.locator('#nt-machine').selectOption('other');
  await expect(page.locator('#saved-list li')).toHaveCount(0);
  release();
  await expect(page.locator('#saved-list li[data-name="other-dir"]')).toHaveCount(1);
  await expect(page.locator('#saved-list li')).toHaveCount(1);
});

test('two saved entries with one path give one option', async ({ page }) => {
  await page.route('**/api/new-thread?machine=*', (route) => route.fulfill({ json: answer('hub', {
    saved: [{ name: 'a', path: '/srv/same', machine: 'hub' }, { name: 'b', path: '/srv/same', machine: 'hub' }],
  }) }));
  await open(page);
  await expect(page.locator('#nt-project option[value="/srv/same"]')).toHaveCount(1);
  await expect(page.locator('#nt-project option')).toHaveCount(1);
  await expect(page.locator('#saved-list li')).toHaveCount(2);
});

test('a failed Remove shows inside that entry; an Add refusal shows under the Add row', async ({ page }) => {
  await page.route('**/api/new-thread?machine=*', (route) => route.fulfill({ json: answer('hub', {
    saved: [{ name: 'a', path: '/srv/a', machine: 'hub' }, { name: 'b', path: '/srv/b', machine: 'hub' }],
  }) }));
  await page.route('**/api/settings/saved-dirs/a?*', (route) => route.fulfill({ status: 500, json: { error: 'disk full' } }));
  await open(page);
  await page.locator('#saved-list li[data-name="a"] button').click();
  await expect(page.locator('#saved-list li[data-name="a"] [role="alert"]')).toHaveText('Could not remove a: disk full');
  await expect(page.locator('#saved-list li[data-name="b"] [role="alert"]')).toHaveCount(0);
  await page.route('**/api/settings/saved-dirs', (route) => route.fulfill({ status: 400, json: { error: "name can't be . or .." } }));
  await page.locator('#add-name').fill('..');
  await page.locator('#add-path').fill('/srv/x');
  await page.locator('#add-go').click();
  await expect(page.locator('#add-error')).toHaveText("name can't be . or ..");
  await expect(page.locator('#saved-list .row-error')).toHaveCount(0);
});
