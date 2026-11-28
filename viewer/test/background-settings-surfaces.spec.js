'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');
let ctx;
test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
test.afterEach(async () => { await ctx.close(); });

// Which matches are hidden or have no opaque ancestor. Found and measured in one step in the
// page: blocks repaint as answers arrive, and a node held across a repaint is detached, so its
// styles read as empty.
const bareSurfaces = (page, selector) => page.evaluate((css) => {
  const visibleOnly = css.endsWith(':visible');
  const shown = (element) => {
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden';
  };
  const solid = (element) => {
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      if (!/^rgb\(/.test(getComputedStyle(node).backgroundColor)) continue;
      let opaque = true;
      for (let parent = node; parent && parent !== document.body; parent = parent.parentElement) {
        if (Number(getComputedStyle(parent).opacity) !== 1) opaque = false;
      }
      if (opaque) return true;
    }
    return false;
  };
  const found = [...document.querySelectorAll(css.replace(/:visible$/, ''))].filter((element) => !visibleOnly || shown(element));
  return found.filter((element) => !shown(element) || !solid(element)).map((element) => element.outerHTML.slice(0, 120));
}, selector);

test('all Settings categories keep content solid and outer gutters visible', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.goto(`${ctx.server.url}/app/settings#you`);
  await expect.poll(() => page.evaluate(() => window.wcBackground.current().metadata !== null)).toBe(true);
  await page.getByLabel('Choose background image').setInputFiles({ name: 'quadrants.png', mimeType: 'image/png', buffer: await fs.readFile(path.join(__dirname, 'fixtures/background-browser/quadrants.png')) });
  await expect(page.locator('.background-layer img')).toHaveCount(1);
  await page.getByLabel('Visibility').fill('100');
  await page.locator('.background-editor').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('.background-editor').getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.wcBackground.current().available)).toBe(true);
  for (const [section, selector] of [
    ['providers', '.harnesses > *, .prov-group > h3, .add-account, .cat-head'],
    ['usage', '.usage-bars, .models.balance > section'],
    ['models', '.models > section, .cat-head'],
    ['leads', '.models > section, .cat-head'],
    ['threads', '.models > section, .cat-head'],
    ['behavior', '.tpl-list, .tpl-edit, .cat-head'],
    ['tools', '.pt > div:visible'],
    ['you', '.writing > section, .writing > .actions, .writing > div:first-child, .background-editor > div, .models > section, .cat-head'],
  ]) {
    await page.locator(`#sections a[data-section="${section}"]`).click();
    await expect(page.locator(`#sections a[data-section="${section}"]`)).toHaveAttribute('aria-current', 'page');
    await expect(page.locator(selector).first()).toBeVisible();
    expect(await bareSurfaces(page, selector), 'content needs an opaque ancestor above the decorative image').toEqual([]);
    await expect(page.locator('.background-layer')).toHaveCSS('opacity', '1');
    await expect(page.locator('.settings .panel')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (section === 'tools') await page.screenshot({ path: testInfo.outputPath('settings-tools.png') });
  }
});
