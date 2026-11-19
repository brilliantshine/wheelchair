'use strict';

const { test, expect } = require('@playwright/test');
const { startServer } = require('./helpers/server');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aWQAAAAASUVORK5CYII=', 'base64');

let server;
test.beforeEach(async () => { server = await startServer(); });
test.afterEach(async () => { await server.stop(); });

async function open(page) {
  await page.goto(`${server.url}/?token=${server.token}`);
  await page.goto(`${server.url}/app/settings#background`);
  await expect(page.getByRole('heading', { name: 'Background Customization' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.wcBackground.current().metadata !== null)).toBe(true);
}

for (const width of [390, 1280]) {
  test(`background preview, save and discard at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await open(page);
    await page.getByLabel('Choose background image').setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: png });
    await expect(page.locator('.background-layer img')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
    await page.getByLabel('Visibility').fill('100');
    await expect(page.locator('.background-layer')).toHaveCSS('opacity', '1');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.background-layer')).toHaveCount(0);
    await page.getByLabel('Choose background image').setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: png });
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
    await page.reload();
    await expect(page.locator('.background-layer img')).toHaveCount(1);
    await page.getByRole('button', { name: 'Remove background' }).click();
    await expect(page.locator('.background-layer')).toHaveCount(0);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  });
}

test('background previews remain private until saved', async ({ browser, page }) => {
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  try {
    await open(page); await open(other);
    await page.getByLabel('Choose background image').setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: png });
    await expect(page.locator('.background-layer img')).toHaveCount(1);
    await expect(other.locator('.background-layer')).toHaveCount(0);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
    await other.evaluate(() => window.wcBackground.refresh());
    await expect(other.locator('.background-layer img')).toHaveCount(1);
  } finally { await otherContext.close(); }
});

const choose = (page, name = 'sample.png', buffer = png) => page.getByLabel('Choose background image').setInputFiles({ name, mimeType: 'image/png', buffer });
const save = async page => { await page.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible(); };

test('clean editor follows shared save and reset; stale draft conflicts then Cancel restores latest', async ({ browser, page }) => {
  const context = await browser.newContext(); const other = await context.newPage();
  try {
    await open(page); await open(other);
    await choose(page); await save(page);
    await other.evaluate(() => window.wcBackground.refresh());
    await expect(other.locator('.background-layer img')).toHaveCount(1);
    await expect(other.getByLabel('Visibility')).toHaveValue('35');
    await other.getByLabel('Visibility').fill('100');
    await page.getByLabel('Visibility').fill('0'); await save(page);
    await other.evaluate(() => window.wcBackground.refresh());
    await expect(other.getByLabel('Visibility')).toHaveValue('100');
    const conflict = other.waitForResponse(r => r.url().includes('/settings/background') && r.request().method() === 'PUT');
    await other.getByRole('button', { name: 'Save', exact: true }).click();
    expect((await conflict).status()).toBe(409);
    await expect(other.getByRole('alert')).toContainText('changed elsewhere');
    await other.getByRole('button', { name: 'Cancel' }).click();
    await expect(other.getByLabel('Visibility')).toHaveValue('0');
    await page.getByRole('button', { name: 'Remove background' }).click(); await save(page);
    await other.evaluate(() => window.wcBackground.refresh());
    await expect(other.locator('.background-layer')).toHaveCount(0);
  } finally { await context.close(); }
});

test('draft survives rebuild and invalid file, but navigation, reload and pageshow discard it', async ({ page }) => {
  await open(page); await choose(page);
  const image = page.locator('.background-layer img'); await expect(image).toHaveCount(1);
  await page.evaluate(() => {
    window.draftImage = document.querySelector('.background-layer img');
    window.oldEditor = document.querySelector('.background-editor');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  expect(await page.evaluate(() => document.querySelector('.background-editor') !== window.oldEditor)).toBe(true);
  await expect(page.getByText(/sample.png/)).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('.background-layer img') === window.draftImage)).toBe(true);
  await choose(page, 'bad.png', Buffer.from('not an image'));
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('.background-layer img') === window.draftImage)).toBe(true);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  await page.evaluate(() => window.wcBackground.accept(window.wcBackground.current().metadata));
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  await page.locator('#sections a[data-section="models"]').click();
  await expect(page.locator('.background-layer')).toHaveCount(0);
  await page.locator('#sections a[data-section="background"]').click();
  await choose(page); await page.reload();
  await expect(page.locator('.background-layer')).toHaveCount(0);
  await choose(page);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await expect(page.locator('.background-layer')).toHaveCount(0);
});

test('slider changes only image opacity without replacing or requesting saved image', async ({ page }) => {
  await open(page); await choose(page); await save(page);
  await expect(page.locator('.background-layer img')).toHaveCount(1);
  await page.evaluate(() => { window.originalImage = document.querySelector('.background-layer img'); });
  let requests = 0; page.on('request', r => { if (r.url().includes('/settings/background/image/')) requests++; });
  const panelColor = await page.locator('.background-editor .box').evaluate(e => getComputedStyle(e).backgroundColor);
  for (const value of [0, 35, 100]) {
    await page.getByLabel('Visibility').fill(String(value));
    await expect(page.locator('.background-layer')).toHaveCSS('opacity', String(value / 100));
    expect(await page.evaluate(() => document.querySelector('.background-layer img') === window.originalImage)).toBe(true);
    expect(await page.locator('.background-editor .box').evaluate(e => getComputedStyle(e).backgroundColor)).toBe(panelColor);
  }
  expect(requests).toBe(0);
});

test('new selection and Remove invalidate an older pending file read', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const read = File.prototype.arrayBuffer; let first = true;
    File.prototype.arrayBuffer = function () { if (!first) return read.call(this); first = false; return new Promise(resolve => { window.releaseRead = () => resolve(read.call(this)); }); };
  });
  await choose(page, 'old.png'); await choose(page, 'new.png');
  await expect(page.getByText(/new.png/)).toBeVisible();
  await page.evaluate(() => window.releaseRead());
  await expect(page.getByText(/new.png/)).toBeVisible();
  await page.getByRole('button', { name: 'Remove background' }).click();
  await expect(page.locator('.background-layer')).toHaveCount(0);
});

test('late save cannot release a newer section visit preview', async ({ page }) => {
  await open(page); await choose(page, 'first.png');
  let release, started; const held = new Promise(r => { release = r; }); const sent = new Promise(r => { started = r; });
  await page.route('**/settings/background/upload?*', async route => { started(); await held; await route.continue(); });
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await sent;
  await page.locator('#sections a[data-section="models"]').click();
  await page.locator('#sections a[data-section="background"]').click(); await choose(page, 'second.png');
  await expect(page.getByText(/second.png/)).toBeVisible();
  await expect(page.locator('.background-layer img')).toHaveCount(1);
  await page.evaluate(() => { window.newPreview = document.querySelector('.background-layer img'); });
  const response = page.waitForResponse(r => r.url().includes('/background/upload') && r.request().method() === 'POST');
  release(); await response;
  await expect(page.getByText(/second.png/)).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('.background-layer img') === window.newPreview)).toBe(true);
  await expect(page.getByRole('status')).not.toHaveText('Saved');
});

test('older metadata cannot regress a newer save', async ({ page }) => {
  await open(page);
  const old = await page.evaluate(() => window.wcBackground.current().metadata);
  await choose(page); await save(page);
  const revision = await page.evaluate(() => window.wcBackground.current().metadata.revision);
  await page.evaluate(value => window.wcBackground.accept(value), old);
  expect(await page.evaluate(() => window.wcBackground.current().metadata.revision)).toBe(revision);
  await expect(page.locator('.background-layer img')).toHaveCount(1);
});

test('representative settings views retain screenshots and restore appearance after removal', async ({ page }, testInfo) => {
  await open(page);
  const before = await page.locator('.background-editor .box').evaluate(e => getComputedStyle(e).backgroundColor);
  await choose(page); await save(page);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 850 });
    await expect(page.locator('.background-layer')).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByLabel('Visibility').focus(); await expect(page.getByLabel('Visibility')).toBeFocused();
    await page.screenshot({ path: `/tmp/backgrounds-T5-artifacts/${testInfo.project.name}-settings-${width}.png` });
  }
  await page.getByRole('button', { name: 'Remove background' }).click(); await save(page);
  await expect(page.locator('.background-layer')).toHaveCount(0);
  expect(await page.locator('.background-editor .box').evaluate(e => getComputedStyle(e).backgroundColor)).toBe(before);
});
