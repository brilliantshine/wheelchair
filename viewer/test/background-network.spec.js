'use strict';

const { test, expect } = require('@playwright/test');
const { startServer } = require('./helpers/server');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
let server;
test.beforeEach(async () => { server = await startServer(); });
test.afterEach(async () => { await server.stop(); });
async function open(page) {
  await page.goto(`${server.url}/?token=${server.token}`);
  await page.goto(`${server.url}/app/settings#you`);
  await expect(page.getByRole('heading', { name: 'Background Customization' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.wcBackground.current().metadata !== null)).toBe(true);
}
const choose = (page, name = 'sample.png') => page.getByLabel('Choose background image').setInputFiles({ name, mimeType: 'image/png', buffer: png });
const save = async page => { await page.locator('.background-editor').getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.locator('.background-editor').getByRole('status').filter({ hasText: 'Saved' })).toBeVisible(); };
const gate = () => { let release, started; return { wait: new Promise(r => { release = r; }), started: new Promise(r => { started = r; }), release: () => release(), start: () => started() }; };

// Hold a callback only after the browser has actually decoded the native Image.
async function imageGate(page) {
  await page.evaluate(() => {
    const NativeImage = window.Image;
    window.imageHolds = []; window.imageGateKind = '';
    window.Image = function (...args) {
      const image = new NativeImage(...args); let onload = null;
      Object.defineProperty(image, 'onload', { configurable: true, get: () => onload, set: fn => { onload = fn; } });
      image.addEventListener('load', event => {
        const callback = onload;
        if (!callback) return;
        const kind = image.src.startsWith('blob:') ? 'candidate' : 'saved';
        if (window.imageGateKind === kind) { window.imageGateKind = ''; window.imageHolds.push(() => callback.call(image, event)); }
        else callback.call(image, event);
      });
      return image;
    };
  });
}

test('older actual metadata response held over Save cannot regress display', async ({ page }) => {
  await open(page);
  const held = gate(); let old;
  await page.route('**/api/settings/background', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    old = await route.fetch(); held.start(); await held.wait; await route.fulfill({ response: old });
  });
  await page.evaluate(() => { window.pollDone = window.wcBackground.refresh(); }); await held.started;
  expect((await old.json()).revision).toBe(0);
  await choose(page); await save(page);
  const current = await page.evaluate(() => window.wcBackground.current().metadata);
  expect(current.revision).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.wcBackground.current().available)).toBe(true);
  await page.evaluate(() => { window.savedNode = document.querySelector('.background-layer img'); });
  held.release(); await page.evaluate(() => window.pollDone);
  await expect.poll(() => page.evaluate(() => window.wcBackground.current().metadata.revision)).toBe(current.revision);
  await expect(page.locator('.background-layer img')).toHaveCount(1);
  expect(await page.evaluate(() => document.querySelector('.background-layer img') === window.savedNode)).toBe(true);
});

test('metadata abort frees the slot and visibility and focus resume single-flight polling', async ({ page }) => {
  await open(page); await page.clock.install();
  let count = 0; const held = gate();
  await page.route('**/api/settings/background', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    count++; if (count === 1) { held.start(); await held.wait; await route.abort().catch(() => {}); } else await route.continue();
  });
  await page.evaluate(() => { void window.wcBackground.refresh(); void window.wcBackground.refresh(); window.dispatchEvent(new Event('focus')); });
  await held.started; expect(count).toBe(1);
  await page.clock.fastForward(15001);
  await expect(page.locator('.background-editor').getByRole('alert')).toContainText('Could not load background settings');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => count).toBe(2);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.clock.fastForward(30000); expect(count).toBe(2);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => count).toBe(3); held.release();
});

test('saved image timeout clears loading and retries same revision', async ({ page, browser }) => {
  const context = await browser.newContext(); const other = await context.newPage();
  try {
    await open(page); await open(other); await imageGate(page); await page.clock.install();
    await choose(other); await save(other);
    await page.evaluate(() => { window.imageGateKind = 'saved'; void window.wcBackground.refresh(); });
    await expect.poll(() => page.evaluate(() => window.imageHolds.length)).toBe(1);
    await expect(page.getByLabel('Visibility')).toBeDisabled();
    await expect(page.getByLabel('Choose background image')).toBeEnabled();
    await expect(page.locator('.background-editor').getByRole('button', { name: 'Remove background' })).toBeEnabled();
    const revision = await page.evaluate(() => window.wcBackground.current().metadata.revision);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.clock.fastForward(60001);
    await expect(page.locator('.background-editor').getByRole('alert')).toContainText('Could not load the saved background');
    await expect.poll(() => page.evaluate(() => window.wcBackground.current().ready)).toBe(true);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(page.getByLabel('Visibility')).toBeEnabled();
    expect(await page.evaluate(() => window.wcBackground.current().metadata.revision)).toBe(revision);
    await expect(page.locator('.background-layer img')).toHaveCount(1);
  } finally { await context.close(); }
});

test('native candidate completion cannot replace newer candidate or Remove', async ({ page }) => {
  await open(page); await imageGate(page);
  await page.evaluate(() => { window.imageGateKind = 'candidate'; }); await choose(page, 'old.png');
  await expect.poll(() => page.evaluate(() => window.imageHolds.length)).toBe(1);
  await choose(page, 'new.png'); await expect(page.getByText(/new.png/)).toBeVisible();
  await page.evaluate(() => { window.newImage = document.querySelector('.background-layer img'); window.imageHolds.shift()(); });
  await expect(page.getByText(/new.png/)).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('.background-layer img') === window.newImage)).toBe(true);
  await page.evaluate(() => { window.imageGateKind = 'candidate'; }); await choose(page, 'later.png');
  await expect.poll(() => page.evaluate(() => window.imageHolds.length)).toBe(1);
  await page.locator('.background-editor').getByRole('button', { name: 'Remove background' }).click();
  await page.evaluate(() => window.imageHolds.shift()());
  await expect(page.locator('.background-layer')).toHaveCount(0);
  // Nothing was saved before, so removing the preview leaves nothing to save.
  await expect(page.locator('.background-editor').getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await expect(page.locator('.background-editor').getByRole('button', { name: 'Cancel', exact: true })).toBeEnabled();
});

test('lost response after commit retains draft, conflicts on retry and Cancel loads commit', async ({ page }) => {
  await open(page); await choose(page);
  let committed;
  await page.route('**/settings/background/upload?*', async route => {
    const response = await route.fetch(); committed = await response.json();
    await route.abort('failed');
  }, { times: 1 });
  await page.locator('.background-editor').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.background-editor').getByRole('alert')).toBeVisible();
  expect(committed.revision).toBeGreaterThan(0);
  await expect(page.getByText(/sample.png/)).toBeVisible();
  await page.evaluate(() => window.wcBackground.refresh());
  await expect.poll(() => page.evaluate(() => window.wcBackground.current().metadata.revision)).toBe(committed.revision);
  const retry = page.waitForResponse(r => r.url().includes('/background/upload') && r.request().method() === 'POST');
  await page.locator('.background-editor').getByRole('button', { name: 'Save', exact: true }).click(); expect((await retry).status()).toBe(409);
  await expect(page.locator('.background-editor').getByRole('alert')).toContainText('changed elsewhere');
  await page.locator('.background-editor').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('.background-layer img')).toHaveCount(1);
  expect(await page.evaluate(() => window.wcBackground.current().metadata.revision)).toBe(committed.revision);
  await expect(page.locator('.background-editor').getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
});

test('cancel and exit discard preview when replacement image fails; reset chooses default', async ({ page, browser }) => {
  const fs = require('node:fs');
  const gif = fs.readFileSync(require('node:path').join(__dirname, 'fixtures/background/no-loop.gif'));
  const context = await browser.newContext(); const other = await context.newPage();
  try {
    await open(page); await choose(page); await page.getByLabel('Visibility').fill('60'); await save(page);
    await expect(page.locator('.background-layer')).toHaveCSS('opacity', '0.6');
    await page.evaluate(() => { window.lastSaved = document.querySelector('.background-layer img'); });
    await open(other); await choose(page, 'preview.png');
    await other.getByLabel('Choose background image').setInputFiles({ name: 'remote.gif', mimeType: 'image/gif', buffer: gif }); await save(other);
    const held = gate();
    await page.route('**/settings/background/image/*', async route => { held.start(); await held.wait; await route.abort('failed'); });
    await page.evaluate(() => { void window.wcBackground.refresh(); }); await held.started;
    await page.locator('.background-editor').getByRole('button', { name: 'Cancel' }).click();
    expect(await page.evaluate(() => document.querySelector('.background-layer img') === window.lastSaved)).toBe(true);
    await expect(page.locator('.background-layer')).toHaveCSS('opacity', '0.6');
    held.release(); await expect(page.locator('.background-editor').getByRole('alert')).toContainText('Could not load the saved background');
    expect(await page.evaluate(() => document.querySelector('.background-layer img') === window.lastSaved)).toBe(true);
    await choose(page, 'another-preview.png');
    await page.locator('#sections a[data-section="models"]').click();
    await expect.poll(() => page.evaluate(() => document.querySelector('.background-layer img') === window.lastSaved)).toBe(true);
    await other.locator('.background-editor').getByRole('button', { name: 'Remove background' }).click(); await save(other);
    await page.evaluate(() => window.wcBackground.refresh());
    await expect(page.locator('.background-layer')).toHaveCount(0);
  } finally { await context.close(); }
});

test('while saved replacement loads a candidate and Remove remain usable', async ({ page, browser }) => {
  const context = await browser.newContext(); const other = await context.newPage();
  try {
    await open(page); await open(other); await imageGate(page);
    await choose(other); await save(other);
    await page.evaluate(() => { window.imageGateKind = 'saved'; void window.wcBackground.refresh(); });
    await expect.poll(() => page.evaluate(() => window.imageHolds.length)).toBe(1);
    await expect(page.getByLabel('Visibility')).toBeDisabled();
    await choose(page, 'local.png'); await expect(page.getByText(/local.png/)).toBeVisible();
    await page.locator('.background-editor').getByRole('button', { name: 'Remove background' }).click();
    await page.evaluate(() => window.imageHolds.shift()());
    await expect(page.locator('.background-layer')).toHaveCount(0);
    await expect(page.locator('.background-editor').getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  } finally { await context.close(); }
});

test('a same-category hash change rebuilds nothing and keeps the pending save and its preview', async ({ page }) => {
  await open(page); await choose(page, 'pending.png');
  await page.getByLabel('Visibility').fill('72');
  const held = gate();
  await page.route('**/settings/background/upload?*', async route => { held.start(); await held.wait; await route.continue(); });
  await page.locator('.background-editor').getByRole('button', { name: 'Save', exact: true }).click(); await held.started;
  await page.evaluate(() => {
    window.pendingImage = document.querySelector('.background-layer img');
    window.previousEditor = document.querySelector('.background-editor');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  expect(await page.evaluate(() => document.querySelector('.background-editor') === window.previousEditor)).toBe(true);
  expect(await page.evaluate(() => document.querySelector('.background-layer img') === window.pendingImage)).toBe(true);
  await expect(page.getByText(/pending.png/)).toBeVisible();
  await expect(page.getByLabel('Visibility')).toHaveValue('72');
  await expect(page.locator('.background-editor').getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Choose background image')).toBeDisabled();
  held.release(); await expect(page.locator('.background-editor').getByRole('status')).toHaveText('Saved');
  await expect(page.locator('.background-layer')).toHaveCSS('opacity', '0.72');
});

test('missing-image metadata selects default instead of an older saved display', async ({ page }) => {
  await open(page); await choose(page); await save(page);
  await expect.poll(() => page.evaluate(() => window.wcBackground.current().available)).toBe(true);
  await page.route('**/api/settings/background', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch(); const metadata = await response.json();
    await route.fulfill({ response, json: { ...metadata, missing_image: true, image_url: null } });
  }, { times: 1 });
  await page.evaluate(() => window.wcBackground.refresh());
  await expect(page.locator('.background-layer')).toHaveCount(0);
  await expect(page.locator('.background-editor').getByRole('alert')).toContainText('unavailable');
});

test('failed late save cannot affect a new section visit', async ({ page }) => {
  await open(page); await choose(page, 'first.png');
  const held = gate();
  await page.route('**/settings/background/upload?*', async route => { held.start(); await held.wait; await route.fulfill({ status: 503, json: { error: 'unavailable' } }); });
  await page.locator('.background-editor').getByRole('button', { name: 'Save', exact: true }).click(); await held.started;
  await page.locator('#sections a[data-section="models"]').click();
  await page.locator('#sections a[data-section="you"]').click(); await choose(page, 'new-draft.png');
  await expect(page.getByText(/new-draft.png/)).toBeVisible();
  await page.evaluate(() => { window.newDraftImage = document.querySelector('.background-layer img'); });
  const response = page.waitForResponse(r => r.url().includes('/background/upload'));
  held.release(); await response;
  await expect(page.getByText(/new-draft.png/)).toBeVisible();
  await expect(page.locator('.background-editor').getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.background-editor').getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => document.querySelector('.background-layer img') === window.newDraftImage)).toBe(true);
});
