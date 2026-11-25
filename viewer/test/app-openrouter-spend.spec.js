'use strict';

// OpenRouter's spend line in Settings > Usage and balancing sits on one line on a wide row.
const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { makeDir, startServer } = require('./helpers/server.js');
const { openPage } = require('./helpers/app-views-setup.js');

let context;
test.beforeAll(async () => {
  const state = await makeDir('app-or-spend-state-');
  await fs.writeFile(path.join(state, 'projects.json'), JSON.stringify([]));
  const modelsCache = path.join(state, 'models-cache.json');
  await fs.writeFile(modelsCache, JSON.stringify({ models: [] }));
  const server = await startServer({ stateDir: state, env: { WHEELCHAIR_MODELS: path.join(state, 'models'), WHEELCHAIR_MODELS_CACHE: modelsCache } });
  context = { state, server };
});
test.afterAll(async () => { await context.server.stop(); });

test.use({ viewport: { width: 1200, height: 900 } });

test('spend text is not in the 76px column and fits one line', async ({ page }) => {
  await page.route('**/api/usage', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.providers = { ...body.providers, openrouter: { label: 'OpenRouter', left: null, accounts: [], spend: { today: 0.001, last_7_days: 0.001, last_30_days: 0.001 } } };
    await route.fulfill({ response, json: body });
  });
  await openPage(page, context, '/app/settings');
  await page.locator('#sections a[data-section="usage"]').click();
  const spend = page.locator('[data-provider="openrouter"] .usage-spend-text');
  await expect(spend).toHaveText('<$0.01 today · <$0.01 last 7 days · <$0.01 last 30 days');
  await expect(spend).not.toHaveClass(/usage-left/);
  await expect(spend).not.toHaveCSS('flex-basis', '76px');
  await expect(spend).toHaveCSS('flex-grow', '1');
  await expect(spend).toHaveCSS('text-align', 'left');
  await expect.poll(async () => spend.evaluate((el) => {
    const cs = getComputedStyle(el);
    const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
    return el.isConnected && el.getBoundingClientRect().height <= line * 1.5;
  })).toBe(true);
  await expect(page.locator('[data-provider="openrouter"] .bar')).toHaveCount(0);
  await expect(page.locator('[data-provider="openrouter"] .usage-name')).toHaveText('OpenRouter');
});
