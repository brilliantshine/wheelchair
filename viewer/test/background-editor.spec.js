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
