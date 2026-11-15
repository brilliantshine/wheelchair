'use strict';

// The Settings page against a real server whose models file, models cache and state directory
// are temporary, so nothing here touches ~/.wheelchair/models. The style preview is stubbed in
// the page (page.route) rather than running Claude.
const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { makeDir, startServer } = require('./helpers/server.js');
const { openPage } = require('./helpers/app-views-setup.js');

test.describe.configure({ mode: 'serial' });

let context;
test.beforeAll(async () => {
  const state = await makeDir('app-settings-state-');
  await fs.writeFile(path.join(state, 'projects.json'), JSON.stringify(['/tmp/proj-alpha', '/tmp/proj-beta']));
  const models = path.join(state, 'models');
  const modelsCache = path.join(state, 'models-cache.json');
  await fs.writeFile(modelsCache, JSON.stringify({ models: [] }));
  const server = await startServer({ stateDir: state, env: { WHEELCHAIR_MODELS: models, WHEELCHAIR_MODELS_CACHE: modelsCache } });
  context = { state, server, models };
});
test.afterAll(async () => { await context.server.stop(); });

const settings = (page) => page.evaluate(async () => (await fetch('/wheelchair/api/settings')).json());
const noSideScroll = async (page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
};

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('the nav shows Settings and the route serves', async ({ page }) => {
    await openPage(page, context, '/app/settings');
    const links = page.locator('#app-nav .seg a');
    await expect(links).toHaveText([/Features/, /Threads/, /Sessions/, /Settings/]);
    await expect(page.locator('#app-nav .seg a[aria-current="page"]')).toHaveText('Settings');
    await expect(page.locator('#panel h1')).toHaveText('Models and preferences');
  });

  test('three sections, kept across a reload through the hash', async ({ page }) => {
    await openPage(page, context, '/app/settings');
    const nav = page.locator('#sections a');
    await expect(nav).toHaveText(['Models and preferences', 'Behavior templates', 'Writing style']);
    await nav.nth(1).click();
    await expect(page).toHaveURL(/#templates$/);
    await expect(page.locator('.tpl-list h1')).toHaveText('Behavior templates');
    await page.reload();
    await expect(page.locator('.tpl-list h1')).toBeVisible();
    await expect(page.locator('#sections a[aria-current="page"]')).toHaveText('Behavior templates');
    await nav.nth(2).click();
    await page.reload();
    await expect(page.locator('#panel h1')).toHaveText('Writing style');
    await expect(page.locator('.covers')).not.toContainText('Phone notifications');
  });

  test('editing a table cell saves, and Not used saves null', async ({ page }) => {
    await openPage(page, context, '/app/settings#models');
    const light = page.getByLabel('GPT light model', { exact: true });
    await expect(light).toHaveValue('gpt-6-luna');
    await light.selectOption('__other');
    await page.getByLabel('GPT light model, other').fill('Bad Name');
    await page.getByRole('button', { name: 'Use', exact: true }).click();
    await expect(page.locator('.inline-err')).toBeVisible();
    await page.getByLabel('GPT light model, other').fill('gpt-6-luna-2');
    await page.getByRole('button', { name: 'Use', exact: true }).click();
    await expect(page.locator('.note').first()).toHaveText('Saved, applies to new sessions');
    await expect(page.getByLabel('GPT light model', { exact: true })).toHaveValue('gpt-6-luna-2');
    expect((await settings(page)).models.gpt.light.model).toBe('gpt-6-luna-2');

    await page.getByLabel('Claude standard model', { exact: true }).selectOption('__none');
    await expect(page.getByLabel('Claude standard effort')).toBeDisabled();
    await expect.poll(async () => (await settings(page)).models.claude.standard).toBeNull();

    await page.getByLabel('Claude heavy effort').selectOption('high');
    await expect.poll(async () => (await settings(page)).models.claude.heavy.effort).toBe('high');

    await page.getByRole('radio', { name: 'Bypass' }).click();
    await expect.poll(async () => (await settings(page)).permission_mode).toBe('bypass');
    await page.getByLabel('Checker', { exact: true }).selectOption('critical');
    await expect.poll(async () => (await settings(page)).other_agents.verifier).toBe('critical');

    await page.reload();
    await expect(page.getByLabel('Claude standard model', { exact: true })).toHaveValue('__none');
    await expect(page.getByRole('radio', { name: 'Bypass' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByLabel('Checker', { exact: true })).toHaveValue('critical');
  });

  test('creating and saving a template, marking it in use, and the worker-only switch', async ({ page }) => {
    await openPage(page, context, '/app/settings#templates');
    await page.getByRole('button', { name: '+ New template' }).click();
    await page.locator('#tname').fill('Careful');
    await expect(page.getByText("When the brief doesn't settle something")).toBeVisible();
    await expect(page.locator('#layer-footer')).toContainText("Nothing overrides layer 1. …except this template's 'Pick, record it, keep going'");
    await expect(page.getByText("can't be turned off")).toHaveCount(0);
    await page.locator('#trole').selectOption('lead');
    await expect(page.getByText("When the brief doesn't settle something")).toHaveCount(0);
    await expect(page.locator('#layer-footer')).not.toContainText('except');
    await page.locator('#trole').selectOption('worker');
    await page.locator('#tunsettled').selectOption('decide');
    await page.getByLabel('Saves after every step').check();
    await page.locator('#tfiles').fill('8');
    await page.locator('#textra').fill('Match the style of the file you are editing.');
    await page.locator('#tscope').selectOption('/tmp/proj-beta');
    await page.locator('#save-template').click();
    await expect(page.locator('.tpl-item[aria-current="true"] .nm')).toHaveText('Careful');
    await expect(page.locator('#using')).toContainText('No workers are using this now');

    await page.getByRole('button', { name: 'Mark in use' }).click();
    await expect(page.locator('.tpl-item[aria-current="true"] .tag')).toContainText('in use');
    const saved = (await settings(page)).templates.find((t) => t.name === 'Careful');
    expect(saved).toMatchObject({ role: 'worker', scope: '/tmp/proj-beta', in_use: true,
      switches: { save_every_step: true, unsettled: 'decide', file_limit: 8, packages: 'ask' } });

    await page.locator('#see-full').click();
    await expect(page.locator('#full-prompt')).toContainText('Careful');
    await expect(page.locator('#full-prompt')).toContainText('Save your work after every step.');

    await page.reload();
    await page.locator('.tpl-item', { hasText: 'Careful' }).click();
    await page.getByRole('button', { name: 'Duplicate' }).click();
    await expect(page.locator('#tname')).toHaveValue('Careful copy');
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Really delete' }).click();
    await expect(page.locator('.tpl-item', { hasText: 'Careful copy' })).toHaveCount(0);
    await expect(page.locator('.tpl-item', { hasText: 'Careful' })).toHaveCount(1);

    await page.getByRole('button', { name: '+ New template' }).click();
    await page.locator('#tname').fill('Plain');
    await page.locator('#save-template').click();
    await expect(page.locator('.tpl-item[aria-current="true"] .nm')).toHaveText('Plain');
    await page.getByRole('button', { name: 'Mark in use' }).click();
    await expect(page.locator('.tpl-item[aria-current="true"] .tag')).toContainText('in use');
    const plain = (await settings(page)).templates.find((t) => t.name === 'Plain');
    expect(plain.switches).toMatchObject({ save_every_step: false, full_tests_before_done: false });
    const prompt = await page.evaluate(async () => (await fetch('/wheelchair/api/settings/prompt?role=worker')).json());
    expect(prompt.text).toContain('Do not make an extra save after every step.');
    expect(prompt.text).toContain('Run the tests that fit the change before reporting done.');
  });

  test('a template whose project is gone says so', async ({ page }) => {
    await fs.writeFile(path.join(context.state, 'projects.json'), JSON.stringify(['/tmp/proj-alpha']));
    await openPage(page, context, '/app/settings#templates');
    await expect(page.locator('.tpl-item', { hasText: 'Careful' }).locator('.tag')).toContainText('project no longer listed');
    await page.locator('.tpl-item', { hasText: 'Careful' }).click();
    await expect(page.locator('#tscope option:checked')).toContainText('project no longer listed');
    await fs.writeFile(path.join(context.state, 'projects.json'), JSON.stringify(['/tmp/proj-alpha', '/tmp/proj-beta']));
  });

  test('the style saves', async ({ page }) => {
    await openPage(page, context, '/app/settings#writing');
    await page.getByRole('radio', { name: 'Thorough' }).click();
    await page.getByRole('radio', { name: 'Always' }).click();
    await page.getByLabel('Technical terms').selectOption('freely');
    await page.getByLabel('Remove load-bearing').click();
    await page.getByLabel('Add a phrase').fill('at the end of the day');
    await page.getByLabel('Add a phrase').press('Enter');
    await page.locator('#style-text').fill('Plain words, please.');
    await page.locator('#save-style').click();
    await expect(page.locator('#style-saved')).toHaveText('Saved');
    const style = (await settings(page)).style;
    expect(style).toEqual({ length: 'thorough', lists: 'always', terms: 'freely',
      never_say: ["It's worth noting", 'at the end of the day'], text: 'Plain words, please.' });
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Thorough' })).toHaveAttribute('aria-checked', 'true');
  });

  test('preview: disabled with a spinner while pending, then the result; nothing is saved', async ({ page }) => {
    await openPage(page, context, '/app/settings#writing');
    const before = JSON.stringify((await settings(page)).style);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let sent = null;
    await page.route('**/api/settings/style/preview', async (route) => {
      sent = route.request().postDataJSON();
      await gate;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ before: 'x', after: 'The signal can fire twice. Repeats now do nothing.' }) });
    });
    await expect(page.locator('#without-style')).toContainText("It's worth noting");
    await page.getByRole('radio', { name: 'Short' }).click();
    const button = page.locator('#preview');
    await button.click();
    await expect(button).toBeDisabled();
    await expect(button.locator('.spinner')).toBeVisible();
    release();
    await expect(page.locator('#with-style')).toHaveText('The signal can fire twice. Repeats now do nothing.');
    await expect(button).toBeEnabled();
    await expect(button.locator('.spinner')).toHaveCount(0);
    expect(sent.length).toBe('short');
    expect(JSON.stringify((await settings(page)).style)).toBe(before);
  });

  test('a failed preview shows one plain line under the panel', async ({ page }) => {
    await openPage(page, context, '/app/settings#writing');
    await page.route('**/api/settings/style/preview', (route) => route.fulfill({
      status: 502, contentType: 'application/json',
      body: JSON.stringify({ error: 'bad gateway', detail: 'Preview failed: Claude is not logged in.' }) }));
    await page.locator('#preview').click();
    await expect(page.locator('#preview-error')).toHaveText('Preview failed: Claude is not logged in.');
    await expect(page.locator('#preview')).toBeEnabled();
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the sections are tabs above the section and the page never scrolls sideways', async ({ page }) => {
    await openPage(page, context, '/app/settings');
    const tabs = page.locator('#sections a');
    await expect(tabs).toHaveCount(3);
    const boxes = await tabs.evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().toJSON()));
    expect(new Set(boxes.map((b) => Math.round(b.top))).size).toBe(1);
    const panel = await page.locator('#panel').boundingBox();
    expect(boxes[0].bottom).toBeLessThanOrEqual(panel.y + 1);
    for (const key of ['models', 'templates', 'writing']) {
      await page.locator(`#sections a[data-section="${key}"]`).click();
      await expect(page.locator('#sections a[aria-current="page"]')).toHaveAttribute('data-section', key);
      await page.waitForTimeout(200);
      await noSideScroll(page);
    }
    await page.locator('#sections a[data-section="models"]').click();
    await expect(page.getByLabel('Claude light model', { exact: true })).toBeVisible();
    await noSideScroll(page);
  });
});
