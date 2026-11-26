'use strict';

const { test, expect } = require('@playwright/test');
const { startServer } = require('./helpers/server');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');
let server;
test.beforeEach(async () => { server = await startServer(); });
test.afterEach(async () => { await server.stop(); });

async function signedIn(page) {
  await page.goto(`${server.url}/?token=${server.token}`);
}
async function editor(page) {
  await page.goto(`${server.url}/app/settings#you`);
  await expect(page.getByRole('heading', { name: 'Background Customization' })).toBeVisible();
}
const choose = page => page.getByLabel('Choose background image').setInputFiles({ name: 'ready.png', mimeType: 'image/png', buffer: png });

test('file choice waits for initial metadata and the first enabled choice previews and saves', async ({ page }) => {
  await signedIn(page);
  let release, started;
  const held = new Promise(resolve => { release = resolve; });
  const requested = new Promise(resolve => { started = resolve; });
  await page.route('**/api/settings/background', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    started(); await held; await route.continue();
  });
  try {
    await editor(page); await requested;
    expect(await page.evaluate(() => window.wcBackground.current().metadata)).toBeNull();
    await expect(page.getByLabel('Choose background image')).toBeDisabled();
    await expect(page.locator('.background-editor').getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    release();
    await expect(page.getByLabel('Choose background image')).toBeEnabled();
    await choose(page);
    await expect(page.getByText(/ready.png/)).toBeVisible();
    await expect(page.locator('.background-layer img')).toHaveCount(1);
    await expect(page.locator('.background-editor').getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
    await page.locator('.background-editor').getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.background-editor').getByRole('status')).toHaveText('Saved');
    await expect.poll(() => page.evaluate(() => window.wcBackground.current().metadata.image_id)).toMatch(/^[a-f0-9]{64}$/);
  } finally { release(); }
});

test('unchanged saved metadata preserves slider keyboard focus and the displayed image', async ({ page }) => {
  await signedIn(page); await editor(page);
  await expect.poll(() => page.evaluate(() => window.wcBackground.current().metadata !== null)).toBe(true);
  await choose(page);
  await page.locator('.background-editor').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.background-editor').getByRole('status')).toHaveText('Saved');
  await expect.poll(() => page.evaluate(() => window.wcBackground.current().available)).toBe(true);
  await page.getByLabel('Visibility').focus();
  await expect(page.getByLabel('Visibility')).toBeFocused();
  await page.evaluate(() => {
    window.focusedSlider = document.activeElement;
    window.savedBackgroundImage = document.querySelector('.background-layer img');
  });
  let imageReads = 0;
  page.on('request', request => { if (request.url().includes('/settings/background/image/')) imageReads++; });
  await page.evaluate(() => window.wcBackground.refresh());
  await expect(page.getByLabel('Visibility')).toBeFocused();
  expect(await page.evaluate(() => document.activeElement === window.focusedSlider)).toBe(true);
  expect(await page.evaluate(() => document.querySelector('.background-layer img') === window.savedBackgroundImage)).toBe(true);
  expect(imageReads).toBe(0);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Visibility')).toHaveValue('36');
  await expect(page.locator('.background-editor').getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
});

test('opening an agent lesson deep-link discards the local background preview', async ({ page }) => {
  await signedIn(page); await editor(page);
  await expect.poll(() => page.evaluate(() => window.wcBackground.current().metadata !== null)).toBe(true);
  await choose(page);
  await expect(page.getByText(/ready.png/)).toBeVisible();
  await expect(page.locator('.background-layer img')).toHaveCount(1);
  await page.evaluate(() => { location.hash = 'templates/lessons/lead'; });
  await expect(page.locator('#sections a[data-section="behavior"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.background-layer')).toHaveCount(0);
  await page.locator('#sections a[data-section="you"]').click();
  await expect(page.locator('.background-editor').getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await expect(page.getByText(/ready.png/)).toHaveCount(0);
});
