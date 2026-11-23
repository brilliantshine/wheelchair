'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');
let ctx;
test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
test.afterEach(async () => { await ctx.close(); });

async function opaqueBackdrop(locator) {
  await expect(locator).toBeVisible();
  expect(await locator.evaluate(element => {
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      if (!/^rgb\(/.test(getComputedStyle(node).backgroundColor)) continue;
      let opaque = true;
      for (let parent = node; parent && parent !== document.body; parent = parent.parentElement) {
        if (Number(getComputedStyle(parent).opacity) !== 1) opaque = false;
      }
      if (opaque) return true;
    }
    return false;
  }), 'content needs an opaque ancestor above the decorative image').toBe(true);
}

test('all Settings categories keep content solid and outer gutters visible', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.goto(`${ctx.server.url}/app/settings#background`);
  await expect.poll(() => page.evaluate(() => window.wcBackground.current().metadata !== null)).toBe(true);
  await page.getByLabel('Choose background image').setInputFiles({ name: 'quadrants.png', mimeType: 'image/png', buffer: await fs.readFile(path.join(__dirname, 'fixtures/background-browser/quadrants.png')) });
  await expect(page.locator('.background-layer img')).toHaveCount(1);
  await page.getByLabel('Visibility').fill('100');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.wcBackground.current().available)).toBe(true);
  for (const [section, selector] of [
    ['harnesses', '.harnesses > *'],
    ['accounts', '.prov-group > h2, #add-account'],
    ['usage', '.usage-bars, .models.usage > section'],
    ['models', '.models > section'],
    ['templates', '.tpl-list, .tpl-edit'],
    ['writing', '.writing > section, .writing > .actions'],
    ['tools', '.pt > div:visible'],
    ['background', '.background-editor > div'],
  ]) {
    await page.locator(`#sections a[data-section="${section}"]`).click();
    await expect(page.locator(`#sections a[data-section="${section}"]`)).toHaveAttribute('aria-current', 'page');
    const surfaces = page.locator(selector);
    await expect(surfaces.first()).toBeVisible();
    for (const surface of await surfaces.all()) await opaqueBackdrop(surface);
    await expect(page.locator('.background-layer')).toHaveCSS('opacity', '1');
    await expect(page.locator('.settings .panel')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (section === 'tools') await page.screenshot({ path: testInfo.outputPath('settings-tools.png') });
  }
});
