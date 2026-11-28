'use strict';

// The Settings page against a real server whose models file, models cache and state directory
// are temporary, so nothing here touches ~/.wheelchair/models. The style preview is stubbed in
// the page (page.route) rather than running Claude.
const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { makeDir, startServer } = require('./helpers/server.js');
const { runDir } = require('../../test-support/run-dir');
const { openPage } = require('./helpers/app-views-setup.js');

test.describe.configure({ mode: 'serial' });

let context;
test.beforeAll(async () => {
  const state = await makeDir('app-settings-state-');
  await fs.writeFile(path.join(state, 'projects.json'), JSON.stringify(['/tmp/proj-alpha', '/tmp/proj-beta']));
  const models = path.join(state, 'models');
  const modelsCache = path.join(state, 'models-cache.json');
  await fs.writeFile(modelsCache, JSON.stringify({ models: [] }));
  const server = await startServer({ stateDir: state, env: { WHEELCHAIR_AGY: '', WHEELCHAIR_MODELS: models, WHEELCHAIR_MODELS_CACHE: modelsCache } });
  context = { state, server, models };
});
test.afterAll(async () => { await context.server.stop(); });

const KEYS = ['you', 'providers', 'usage', 'models', 'leads', 'threads', 'behavior', 'tools', 'shared-tools'];
const TITLES = ['You', 'AI providers', 'Usage and balancing', 'Models', 'Assistant and project leads', 'Threads', 'Agent behavior', 'Project tools', 'Shared tools'];
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
    await expect(links).toHaveText([/Features/, /Threads/, /Agents/, /Settings/]);
    await expect(page.locator('#app-nav .seg a[aria-current="page"]')).toHaveText('Settings');
    await expect(page.locator('#app-nav .seg .lbl')).toBeVisible();
    await expect(page.locator('#app-nav .seg .gear')).toBeHidden();
    await expect(page.locator('.catview h1')).toHaveText('You');
  });

  test('nine categories in order, kept across a reload through the hash', async ({ page }) => {
    await openPage(page, context, '/app/settings');
    const nav = page.locator('#sections a');
    await expect(nav).toHaveText(TITLES);
    await nav.nth(6).click();
    await expect(page).toHaveURL(/#behavior$/);
    await expect(page.locator('.tpl-list h2')).toHaveText('Behavior templates');
    await page.reload();
    await expect(page.locator('.tpl-list h2')).toBeVisible();
    await expect(page.locator('#sections a[aria-current="page"]')).toHaveText('Agent behavior');
    await nav.nth(0).click();
    await page.reload();
    await expect(page.locator('.catview h1')).toHaveText('You');
    await expect(page.locator('.covers')).not.toContainText('Phone notifications');
  });

  test('the Kimi row has no effort select while Claude keeps one', async ({ page }) => {
    await openPage(page, context, '/app/settings#models');
    await expect(page.getByLabel('Kimi Code standard model', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Kimi Code standard effort', { exact: true })).toHaveCount(0);
    await expect(page.locator('tr[data-provider="kimi"] select.effort')).toHaveCount(0);
    await expect(page.getByLabel('Claude standard effort', { exact: true })).toHaveCount(1);
  });

  test('permission labels name the tools in their groups', async ({ page }) => {
    await openPage(page, context, '/app/settings#threads');
    await expect(page.getByText('Claude and Kimi sessions', { exact: true })).toBeVisible();
    await expect(page.getByText('Codex sessions', { exact: true })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Claude and Kimi permission mode', exact: true })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Codex permission mode', exact: true })).toBeVisible();
  });

  test('a slashed Kimi alias saves through Other, survives a reload, and other providers refuse a slash', async ({ page }) => {
    await openPage(page, context, '/app/settings#models');
    await expect(page.locator('tr[data-provider="kimi"]')).toContainText('Kimi Code');
    const standard = page.getByLabel('Kimi Code standard model', { exact: true });
    await expect(standard).toHaveValue('kimi-code/k3');
    await standard.selectOption('__other');
    await page.getByLabel('Kimi Code standard model, other').fill('kimi-code/a/b');
    await page.getByRole('button', { name: 'Use', exact: true }).click();
    await expect(page.locator('.inline-err')).toBeVisible();
    await page.getByLabel('Kimi Code standard model, other').fill('kimi-code/k3-preview');
    await page.getByRole('button', { name: 'Use', exact: true }).click();
    await expect(page.locator('.note').first()).toHaveText('Saved, applies to new sessions');
    await expect.poll(async () => (await settings(page)).models.kimi.standard.model).toBe('kimi-code/k3-preview');
    await page.reload();
    await expect(page.getByLabel('Kimi Code standard model', { exact: true })).toHaveValue('kimi-code/k3-preview');
    const light = page.getByLabel('GPT light model', { exact: true });
    await light.selectOption('__other');
    await page.getByLabel('GPT light model, other').fill('gpt/x');
    await page.getByRole('button', { name: 'Use', exact: true }).click();
    await expect(page.locator('.inline-err')).toBeVisible();
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

    await page.locator('#sections a[data-section="threads"]').click();
    await page.getByRole('radio', { name: 'Bypass' }).click();
    await expect.poll(async () => (await settings(page)).permission_mode).toBe('bypass');
    await expect(page.getByText('Never asks: it can write only inside its worktree.')).toBeVisible();
    await page.getByRole('radio', { name: 'Unrestricted' }).click();
    await expect.poll(async () => (await settings(page)).codex_mode).toBe('unrestricted');
    await expect(page.getByText(/it can change anything on the machine/)).toBeVisible();
    await page.locator('#sections a[data-section="models"]').click();
    await page.getByLabel('Checker', { exact: true }).selectOption('critical');
    await expect.poll(async () => (await settings(page)).other_agents.verifier).toBe('critical');

    await page.reload();
    await expect(page.getByLabel('Claude standard model', { exact: true })).toHaveValue('__none');
    await expect(page.getByLabel('Checker', { exact: true })).toHaveValue('critical');
    await page.locator('#sections a[data-section="threads"]').click();
    await expect(page.getByRole('radio', { name: 'Bypass' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: 'Unrestricted' })).toHaveAttribute('aria-checked', 'true');
  });

  test('effort selects: GPT tier and both leads save; GPT has no max', async ({ page }) => {
    await openPage(page, context, '/app/settings#models');
    await expect(page.locator('tr[data-provider="gemini"]')).toContainText('Antigravity');
    await expect(page.getByLabel('Antigravity light model')).toBeVisible();
    await expect(page.getByLabel('Antigravity light effort').locator('option')).toContainText(['max']);
    await expect(page.getByLabel('Antigravity lead model')).toBeVisible();
    const gptStd = page.getByLabel('GPT standard effort', { exact: true });
    await expect(gptStd.locator('option')).toHaveText(['CLI default', 'low', 'medium', 'high', 'xhigh']);
    await expect(page.getByLabel('Claude heavy effort', { exact: true }).locator('option')).toHaveText(['CLI default', 'low', 'medium', 'high', 'xhigh', 'max']);
    await gptStd.selectOption('high');
    await expect.poll(async () => (await settings(page)).models.gpt.standard.effort).toBe('high');
    await page.getByLabel('GPT lead effort', { exact: true }).selectOption('medium');
    await expect.poll(async () => (await settings(page)).models.gpt.lead.effort).toBe('medium');
    await page.getByLabel('Claude lead effort', { exact: true }).selectOption('max');
    await expect.poll(async () => (await settings(page)).models.claude.lead.effort).toBe('max');
    await page.reload();
    await expect(page.getByLabel('GPT standard effort', { exact: true })).toHaveValue('high');
    await expect(page.getByLabel('Claude lead effort', { exact: true })).toHaveValue('max');
  });

  test('sub-lead models and scout tiers render and save independently', async ({ page }) => {
    await openPage(page, context, '/app/settings#models');
    for (const provider of ['Claude', 'GPT', 'Antigravity', 'Kimi Code', 'OpenRouter']) {
      await expect(page.getByLabel(`${provider} lead model`, { exact: true })).toBeVisible();
      await expect(page.getByLabel(`${provider} sub-lead model`, { exact: true })).toBeVisible();
    }
    await expect(page.getByText('Leads run on', { exact: true })).toHaveCount(5);
    await expect(page.getByText('Sub-leads run on', { exact: true })).toHaveCount(5);
    const modelRequest = page.waitForRequest((request) => request.url().endsWith('/api/settings/models') && request.method() === 'PUT');
    await page.getByLabel('GPT sub-lead effort', { exact: true }).selectOption('high');
    expect((await modelRequest).postDataJSON()).toMatchObject({ provider: 'gpt', slot: 'sub-lead', effort: 'high' });
    await expect.poll(async () => (await settings(page)).models.gpt['sub-lead'].effort).toBe('high');

    await expect(page.getByLabel('Scout', { exact: true }).locator('option:checked')).toHaveText('Light');
    await expect(page.getByLabel('Scout for bigger changes', { exact: true }).locator('option:checked')).toHaveText('Standard');
    const preferenceRequest = page.waitForRequest((request) => request.url().endsWith('/api/settings/preferences') && request.method() === 'PUT');
    await page.getByLabel('Scout for bigger changes', { exact: true }).selectOption('heavy');
    expect((await preferenceRequest).postDataJSON()).toEqual({ other_agents: { 'scout-heavy': 'heavy' } });
    await expect.poll(async () => (await settings(page)).other_agents['scout-heavy']).toBe('heavy');
  });

  test('Escalation: default text, Model first, Highest tier Heavy', async ({ page }) => {
    await openPage(page, context, '/app/settings#models');
    await expect(page.locator('h2#escalation')).toHaveText('Escalation');
    const text = page.locator('.escalation-text');
    await expect(text).toContainText('up to xhigh');
    await expect(text).toContainText('up to Critical');
    await expect(text).toContainText('Before moving a task to Critical');
    await page.getByRole('radiogroup', { name: 'What steps up first' }).getByRole('radio', { name: 'Model' }).click();
    await expect(text).toContainText('Move up one tier');
    await expect.poll(async () => (await settings(page)).escalation.first).toBe('model');
    await page.reload();
    await expect(page.getByRole('radiogroup', { name: 'What steps up first' }).getByRole('radio', { name: 'Model' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.escalation-text p').nth(1)).toHaveText(/^Move up one tier/);
    await page.getByRole('radiogroup', { name: 'Highest tier' }).getByRole('radio', { name: 'Heavy' }).click();
    await expect(text).not.toContainText('Before moving a task to Critical');
    await expect.poll(async () => (await settings(page)).escalation.max_tier).toBe('heavy');
    // put the defaults back
    await page.getByRole('radiogroup', { name: 'Highest tier' }).getByRole('radio', { name: 'Critical' }).click();
    await page.getByRole('radiogroup', { name: 'What steps up first' }).getByRole('radio', { name: 'Effort' }).click();
    await expect.poll(async () => (await settings(page)).escalation).toEqual({ first: 'effort', max_effort: 'xhigh', max_tier: 'critical', ask_before: 'critical' });
  });

  test('creating and saving a template, marking it in use, and the worker-only switch', async ({ page }) => {
    await openPage(page, context, '/app/settings#behavior');
    await page.getByRole('button', { name: '+ New template' }).click();
    await page.locator('#tname').fill('Careful');
    await expect(page.getByText("When the brief doesn't settle something")).toBeVisible();
    await expect(page.locator('#layer-footer')).toContainText("Nothing overrides layer 1. …except this template's 'Pick, record it, keep going'");
    await expect(page.getByText("can't be turned off")).toHaveCount(0);
    await page.locator('#trole').selectOption('lead');
    await expect(page.getByText("When the brief doesn't settle something")).toHaveCount(0);
    await expect(page.locator('#layer-footer')).not.toContainText('except');
    await expect(page.locator('#layer-lessons')).toContainText('Lessons learned for leads');
    await expect(page.locator('.layers .layer .n')).toHaveText(['1', '2', '3', '4']);
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
    await expect(page.locator('#full-prompt')).toContainText('Role: worker');
    await expect(page.locator('#full-prompt')).toContainText('Save your work after every step.');
    await expect(page.locator('#full-prompt-caption')).toHaveText('Claude gets this as its starting instructions; GPT, Antigravity and Kimi Code sessions get it as a file, through a short first message that points to it. Lessons marked for one AI or one project reach only agents on that AI or in that project.');
    await expect(page.locator('#full-prompt-caption')).toContainText('Kimi Code');
    await page.locator('#see-full').click();
    await expect(page.locator('#full-prompt-caption')).toHaveCount(1);
    await expect(page.locator('#full-prompt')).toHaveCount(1);

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
    await openPage(page, context, '/app/settings#behavior');
    await expect(page.locator('.tpl-item', { hasText: 'Careful' }).locator('.tag')).toContainText('project no longer listed');
    await page.locator('.tpl-item', { hasText: 'Careful' }).click();
    await expect(page.locator('#tscope option:checked')).toContainText('project no longer listed');
    await fs.writeFile(path.join(context.state, 'projects.json'), JSON.stringify(['/tmp/proj-alpha', '/tmp/proj-beta']));
  });

  test('the auto-merge switch says Saved, not applies to new sessions, and survives a reload', async ({ page }) => {
    await openPage(page, context, '/app/settings#threads');
    const merge = page.getByRole('radiogroup', { name: 'Merge pull requests when done' });
    await expect(page.getByRole('radiogroup', { name: 'Delete the branch after merging' })).toHaveCount(0);
    await merge.getByRole('radio', { name: 'On' }).click();
    await page.getByRole('radiogroup', { name: 'Delete the branch after merging' }).getByRole('radio', { name: 'On' }).click();
    await expect.poll(async () => (await settings(page)).auto_merge_delete_branch).toBe('on');
    await expect(merge.getByRole('radio', { name: 'On' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.note').first()).toHaveText('Saved');
    await expect.poll(async () => (await settings(page)).auto_merge).toBe('on');
    await page.reload();
    await expect(page.getByRole('radiogroup', { name: 'Merge pull requests when done' }).getByRole('radio', { name: 'On' })).toHaveAttribute('aria-checked', 'true');
  });

  test('the style saves', async ({ page }) => {
    await openPage(page, context, '/app/settings#you');
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
    await openPage(page, context, '/app/settings#you');
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
    await openPage(page, context, '/app/settings#you');
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

  test('the Settings link shows a gear, is wide enough to tap, and opens Settings', async ({ page }) => {
    await openPage(page, context, '/app/features');
    const link = page.locator('#app-nav .seg a[href="/wheelchair/app/settings"]');
    await expect(link.locator('.gear')).toBeVisible();
    await expect(link.locator('.lbl')).toBeHidden();
    const box = await link.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(24);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await link.click();
    await expect(page).toHaveURL(/\/app\/settings/);
  });

  test('every category fits without scrolling sideways', async ({ page }) => {
    await openPage(page, context, '/app/settings');
    await noSideScroll(page);
    for (const [key, title] of KEYS.map((key, i) => [key, TITLES[i]])) {
      await openPage(page, context, '/app/settings#' + key);
      await expect(page.locator('.catview[data-category="' + key + '"]')).toBeVisible();
      if (key !== 'tools') await expect(page.locator('.catview h1')).toHaveText(title);
      await page.waitForTimeout(200);
      await noSideScroll(page);
    }
  });

  for (const width of [390, 360]) {
    for (const route of ['/app/threads', '/app/settings', '/app/new']) {
      test(`the nav fits ${width}px on ${route}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await openPage(page, context, route);
        const boxes = await page.locator('#app-nav').evaluate((nav) => [...nav.children]
          .filter((n) => n.getClientRects().length)
          .map((n) => ({ cls: n.className, ...n.getBoundingClientRect().toJSON() })));
        expect(boxes.length).toBeGreaterThanOrEqual(3);
        for (const b of boxes) {
          expect(b.left, b.cls).toBeGreaterThanOrEqual(0);
          expect(b.right, b.cls).toBeLessThanOrEqual(width);
        }
        if (route === '/app/threads') {
          const add = await page.locator('#new-toggle').boundingBox();
          expect(add.x).toBeGreaterThanOrEqual(0);
          expect(add.x + add.width).toBeLessThanOrEqual(width);
        }
        await noSideScroll(page);
      });
    }
  }

  test('the Escalation section fits a phone and the effort selects stay usable', async ({ page }) => {
    await openPage(page, context, '/app/settings#models');
    const section = page.locator('#escalation');
    await section.scrollIntoViewIfNeeded();
    await expect(section).toBeVisible();
    await expect(page.locator('.escalation-text')).toContainText('up to xhigh');
    await expect(page.getByRole('radiogroup', { name: 'Ask me before' })).toBeVisible();
    await page.getByRole('radiogroup', { name: 'Ask me before' }).getByRole('radio', { name: 'Any step up' }).click();
    await expect.poll(async () => (await settings(page)).escalation.ask_before).toBe('any');
    await page.getByRole('radiogroup', { name: 'Ask me before' }).getByRole('radio', { name: 'Critical', exact: true }).click();
    await expect.poll(async () => (await settings(page)).escalation.ask_before).toBe('critical');
    const sel = page.getByLabel('GPT heavy effort', { exact: true });
    await sel.scrollIntoViewIfNeeded();
    const box = await sel.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await noSideScroll(page);
  });

  test('Your name saves and survives a reload, and a too-long name is refused with the typed value kept', async ({ page }) => {
    await openPage(page, context, '/app/settings#you');
    const row = page.locator('.row-line', { hasText: 'Your name' });
    const input = page.getByLabel('Your name', { exact: true });
    await expect(input).toHaveValue('');
    await input.fill('Sam');
    await row.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(row.getByRole('status')).toHaveText('Saved');
    expect((await settings(page)).user_name).toBe('Sam');
    await page.reload();
    await expect(page.getByLabel('Your name', { exact: true })).toHaveValue('Sam');
    await page.evaluate(() => { document.getElementById('user-name').removeAttribute('maxlength'); });
    await page.getByLabel('Your name', { exact: true }).fill('a'.repeat(81));
    await page.locator('.row-line', { hasText: 'Your name' }).getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.row-line', { hasText: 'Your name' }).locator('.inline-err')).toBeVisible();
    expect((await settings(page)).user_name).toBe('Sam');
    await page.getByLabel('Your name', { exact: true }).fill('');
    await page.locator('.row-line', { hasText: 'Your name' }).getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.row-line', { hasText: 'Your name' }).getByRole('status')).toHaveText('Saved');
    expect((await settings(page)).user_name).toBe('');
  });

  test('the Default project folder saves, and a refusal shows under it with the typed value kept', async ({ page }) => {
    await openPage(page, context, '/app/settings#threads');
    const input = page.getByLabel('Default project folder', { exact: true });
    await expect(input).toHaveValue('');
    await input.fill('~/projects');
    await page.locator('.row-line', { hasText: 'Default project folder' }).getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.row-line', { hasText: 'Default project folder' }).getByRole('status')).toHaveText('Saved');
    expect((await settings(page)).default_project_folder).toBe('~/projects');
    await page.reload();
    await expect(page.getByLabel('Default project folder', { exact: true })).toHaveValue('~/projects');
    const again = page.getByLabel('Default project folder', { exact: true });
    await again.fill('relative/path');
    await page.locator('.row-line', { hasText: 'Default project folder' }).getByRole('button', { name: 'Save' }).click();
    const err = page.locator('.row-line', { hasText: 'Default project folder' }).locator('.inline-err');
    await expect(err).toBeVisible();
    await expect(again).toHaveValue('relative/path');
    expect((await settings(page)).default_project_folder).toBe('~/projects');
    await again.fill('');
    await page.locator('.row-line', { hasText: 'Default project folder' }).getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.row-line', { hasText: 'Default project folder' }).getByRole('status')).toHaveText('Saved');
    expect((await settings(page)).default_project_folder).toBe('');
  });

  test('Settings keeps its accessible name on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await openPage(page, context, '/app/settings');
    await expect(page.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
    await expect(page.locator('#app-nav .seg .lbl')).toBeHidden();
  });
});

test('picks a lead name list and uploads a custom one in Settings', async ({ page }) => {
  await openPage(page, context, '/app/settings#threads');
  await page.getByLabel('Lead names', { exact: true }).selectOption('nato');
  await expect.poll(async () => (await settings(page)).lead_name_list).toBe('nato');
  await expect(page.getByLabel('Upload lead names')).toBeHidden();
  await page.getByLabel('Lead names', { exact: true }).selectOption('custom');
  await expect(page.getByLabel('Upload lead names')).toBeVisible();
  await page.getByLabel('Upload lead names').setInputFiles({ name: 'names.txt', mimeType: 'text/plain', buffer: Buffer.from('Ada\r\n\nGrace, ada\n') });
  await expect.poll(async () => { const value = await settings(page); return [value.lead_name_list, value.lead_names]; }).toEqual(['custom', ['Ada', 'Grace']]);
  await page.reload();
  await expect(page.getByLabel('Lead names', { exact: true })).toHaveValue('custom');
  await expect(page.locator('.lead-names-custom .note')).toHaveText('2 names: Ada, Grace');
});

test('a quoted CSV upload keeps commas inside names', async ({ page }) => {
  await openPage(page, context, '/app/settings#threads');
  await page.getByLabel('Lead names', { exact: true }).selectOption('custom');
  await page.getByLabel('Upload lead names').setInputFiles({ name: 'names.csv', mimeType: 'text/csv', buffer: Buffer.from('"Ada","Grace, Jr."\n"Say ""Hi"""\n') });
  await expect.poll(async () => (await settings(page)).lead_names).toEqual(['Ada', 'Grace, Jr.', 'Say "Hi"']);
});

test('a later dropdown choice wins over a slow upload save', async ({ page }) => {
  await openPage(page, context, '/app/settings#threads');
  const select = page.getByLabel('Lead names', { exact: true });
  await select.selectOption('custom');
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  await page.route('**/settings/preferences', async (route) => {
    if (JSON.parse(route.request().postData() || '{}').lead_names) await held;
    await route.continue();
  });
  await page.getByLabel('Upload lead names').setInputFiles({ name: 'names.txt', mimeType: 'text/plain', buffer: Buffer.from('Ada\nGrace\n') });
  await select.selectOption('people');
  release();
  await expect.poll(async () => (await settings(page)).lead_name_list).toBe('people');
  await expect(select).toHaveValue('people');
});

test('a slow upload does not undo a list picked after switching sections', async ({ page }) => {
  await openPage(page, context, '/app/settings#threads');
  const select = page.getByLabel('Lead names', { exact: true });
  await select.selectOption('custom');
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  let uploading;
  const sent = new Promise((resolve) => { uploading = resolve; });
  await page.route('**/settings/preferences', async (route) => {
    // Held without blocking the handler, so other saves still go through meanwhile.
    if (JSON.parse(route.request().postData() || '{}').lead_names) { uploading(); held.then(() => route.continue()); return; }
    await route.continue();
  });
  await page.getByLabel('Upload lead names').setInputFiles({ name: 'names.txt', mimeType: 'text/plain', buffer: Buffer.from('Ada\nGrace\n') });
  await sent;
  await page.locator('#sections a[data-section="models"]').click();
  await page.locator('#sections a[data-section="threads"]').click();
  const picked = page.waitForResponse((response) => response.url().includes('/settings/preferences') && JSON.parse(response.request().postData() || '{}').lead_name_list === 'people');
  await select.selectOption('people');
  // The old page sent this straight away; the fixed one waits behind the upload.
  await Promise.race([picked, page.waitForTimeout(1000)]);
  const answered = page.waitForResponse((response) => response.url().includes('/settings/preferences') && JSON.parse(response.request().postData() || '{}').lead_names);
  release();
  await answered;
  await page.waitForTimeout(300);
  await expect.poll(async () => (await settings(page)).lead_name_list).toBe('people');
  await expect(select).toHaveValue('people');
  await page.reload();
  await expect(page.getByLabel('Lead names', { exact: true })).toHaveValue('people');
});

test('picking Custom while another list saves keeps Custom and its file picker', async ({ page }) => {
  await openPage(page, context, '/app/settings#threads');
  await page.evaluate(() => fetch('/wheelchair/api/settings/preferences', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lead_names: [], lead_name_list: 'greek' }) }));
  await page.reload();
  const select = page.getByLabel('Lead names', { exact: true });
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  await page.route('**/settings/preferences', async (route) => {
    if (JSON.parse(route.request().postData() || '{}').lead_name_list === 'nato') await held;
    await route.continue();
  });
  await select.selectOption('nato');
  await select.selectOption('custom');
  const answered = page.waitForResponse((response) => response.url().includes('/settings/preferences'));
  release();
  await answered;
  await page.waitForTimeout(100);
  await expect.poll(async () => (await settings(page)).lead_name_list).toBe('nato');
  await expect(select).toHaveValue('custom');
  await expect(page.getByLabel('Upload lead names')).toBeVisible();
});

const clearLeadNames = async (page) => {
  await page.evaluate(() => fetch('/wheelchair/api/settings/preferences', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lead_names: [], lead_name_list: 'greek' }) }));
  await page.reload();
};

test('Custom picked again during a slow upload and another save stays Custom', async ({ page }) => {
  await openPage(page, context, '/app/settings#threads');
  await clearLeadNames(page);
  const select = page.getByLabel('Lead names', { exact: true });
  await select.selectOption('custom');
  let release, uploading;
  const held = new Promise((resolve) => { release = resolve; });
  const sent = new Promise((resolve) => { uploading = resolve; });
  await page.route('**/settings/preferences', async (route) => {
    if (JSON.parse(route.request().postData() || '{}').lead_names) { uploading(); held.then(() => route.continue()); return; }
    await route.continue();
  });
  await page.getByLabel('Upload lead names').setInputFiles({ name: 'names.txt', mimeType: 'text/plain', buffer: Buffer.from('Ada\n') });
  await sent;
  await select.selectOption('nato');
  await select.selectOption('custom');
  release();
  await expect.poll(async () => (await settings(page)).lead_name_list).toBe('custom');
  await page.waitForTimeout(300);
  await expect(select).toHaveValue('custom');
  await expect(page.getByLabel('Upload lead names')).toBeVisible();
  expect((await settings(page)).lead_name_list).toBe('custom');
});

test('a failed save of another list keeps a later pick of Custom', async ({ page }) => {
  await openPage(page, context, '/app/settings#threads');
  await clearLeadNames(page);
  const select = page.getByLabel('Lead names', { exact: true });
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  await page.route('**/settings/preferences', async (route) => {
    await held;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'unavailable', detail: 'hub unavailable' }) });
  });
  await select.selectOption('nato');
  await select.selectOption('custom');
  const answered = page.waitForResponse((response) => response.url().includes('/settings/preferences'));
  release();
  await answered;
  await page.waitForTimeout(200);
  await expect(select).toHaveValue('custom');
  await expect(page.getByLabel('Upload lead names')).toBeVisible();
});

test('only the newest uploaded file is saved', async ({ page }) => {
  await openPage(page, context, '/app/settings#threads');
  await clearLeadNames(page);
  await page.evaluate(() => {
    const read = File.prototype.text;
    let first = true;
    File.prototype.text = function () {
      if (!first) return read.call(this);
      first = false;
      return new Promise((resolve) => { window.releaseFirstRead = () => resolve(read.call(this)); });
    };
  });
  await page.getByLabel('Lead names', { exact: true }).selectOption('custom');
  const upload = page.getByLabel('Upload lead names');
  await upload.setInputFiles({ name: 'first.txt', mimeType: 'text/plain', buffer: Buffer.from('Ada\n') });
  await upload.setInputFiles({ name: 'second.txt', mimeType: 'text/plain', buffer: Buffer.from('Grace\n') });
  await expect.poll(async () => (await settings(page)).lead_names).toEqual(['Grace']);
  await page.evaluate(() => window.releaseFirstRead());
  await page.waitForTimeout(300);
  expect((await settings(page)).lead_names).toEqual(['Grace']);
});

test('the preview panes are unfilled and Visibility is a short track under its label', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page, context, '/app/settings#you');
  await expect(page.locator('.pane')).toHaveCount(2);
  const panes = await page.locator('.pane').evaluateAll((els) => els.map((el) => ({ fill: getComputedStyle(el).backgroundColor, line: getComputedStyle(el).borderTopColor })));
  for (const pane of panes) expect(pane).toEqual({ fill: 'rgba(0, 0, 0, 0)', line: panes[0].line });
  const slider = page.getByLabel('Visibility');
  const track = await slider.boundingBox();
  const box = await page.locator('.background-editor .box').boundingBox();
  expect(track.width).toBeLessThan(box.width / 2);
  const value = await slider.locator('xpath=preceding-sibling::span').boundingBox();
  expect(track.y).toBeGreaterThanOrEqual(value.y + value.height - 1);
});

// mockup-phone-you.html: 14px text on 1.45 lines with a line's margin around each paragraph.
test('the preview panes carry the mockup\u2019s text and are its height at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page, context, '/app/settings#you');
  await expect(page.locator('.pane')).toHaveCount(2);
  await page.evaluate(() => document.fonts.ready);
  const text = await page.locator('.pane p').evaluateAll((els) => els.map((el) => {
    const css = getComputedStyle(el);
    return { size: css.fontSize, line: Math.round(parseFloat(css.lineHeight) * 10) / 10, above: css.marginTop, below: css.marginBottom };
  }));
  for (const p of text) expect(p).toEqual({ size: '14px', line: 20.3, above: '14px', below: '14px' });
  // The mockup in the app's own Inter measures 176px and 115px. (Opened as a file it loads no
  // Inter, and its first pane wraps one line more in the fallback font.)
  const heights = await page.locator('.pane').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  expect(Math.abs(heights[0] - 176)).toBeLessThanOrEqual(4);
  expect(Math.abs(heights[1] - 115)).toBeLessThanOrEqual(4);
});

test('Models fits at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page, context, '/app/settings#models');
  await expect(page.locator('tr[data-provider="gemini"]')).toBeVisible();
  await noSideScroll(page);
});

async function sharedPickerRoutes(page, saved, lookup) {
  await page.route('**/wheelchair/api/settings', async route => {
    const response = await route.fetch(), body = await response.json();
    await route.fulfill({ response, json: { ...body, saved_dirs: saved } });
  });
  await page.route('**/wheelchair/api/project-tools/read', lookup);
}

test('shared tools picker uses saved projects, resolves in parallel and retains a missing choice', async ({ page }) => {
  const saved = [{ name: 'shared-tools', path: '/tmp/shared-tools', machine: 'hub' }, { name: 'local', path: '/tmp/local', machine: 'remote' }, { name: 'shared-again', path: '/tmp/shared-copy', machine: 'remote' }];
  let pending = 0, parallel = true, release; const gate = new Promise(resolve => { release = resolve; });
  await sharedPickerRoutes(page, saved, async route => {
    const body = route.request().postDataJSON(); expect(body.repo_only).toBe(true);
    if (++pending === 3) release();
    await Promise.race([gate, new Promise(resolve => setTimeout(() => { parallel = false; resolve(); }, 1500))]);
    await route.fulfill({ json: { repo: body.path === '/tmp/local' ? null : 'owner/shared' } });
  });
  await page.route('**/wheelchair/api/new-thread*', route => route.fulfill({ json: { machines: ['hub'], saved: [], found: [{ name: 'found', path: '/found' }], previous: ['/previous'] } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page, context, '/app/settings#shared-tools');
  const picker = page.getByLabel('Shared tools project');
  await expect(picker.locator('option')).toContainText(['None', 'shared-tools (hub)', 'local (remote) (no GitHub origin)', 'shared-again (remote)']);
  expect(pending).toBe(3); expect(parallel).toBe(true); await expect(picker.locator('option:disabled')).toHaveCount(1);
  await picker.selectOption('owner/shared');
  await expect.poll(async () => (await settings(page)).shared_tools_repo).toBe('owner/shared');
  await picker.selectOption('');
  await expect.poll(async () => (await settings(page)).shared_tools_repo).toBe(null);
  await page.evaluate(async () => fetch('/wheelchair/api/settings/preferences', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ shared_tools_repo: 'owner/gone' }) }));
  await page.reload();
  await expect(picker).toHaveValue('owner/gone'); await expect(picker.locator('option[value="owner/gone"]')).toHaveText('owner/gone');
  await picker.selectOption('');
});

test('capture shared tools picker screens', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium' || !process.env.WHEELCHAIR_SCREENSHOTS);
  await sharedPickerRoutes(page, [{ name: 'shared-tools', path: '/tmp/shared-tools', machine: 'hub' }], route => route.fulfill({ json: { repo: 'owner/shared' } }));
  const capture = async name => { const file = path.join(runDir(), name); await page.screenshot({ path: file }); await fs.copyFile(file, path.join(process.env.WHEELCHAIR_SCREENSHOTS, name)); };
  await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page, context, '/app/settings#shared-tools');
  const picker = page.getByLabel('Shared tools project'); await expect(picker).toBeEnabled();
  await picker.selectOption(''); await page.reload(); await expect(picker).toBeEnabled(); await capture('shared-none-phone.png');
  await picker.selectOption('owner/shared'); await expect.poll(async () => (await settings(page)).shared_tools_repo).toBe('owner/shared');
  await page.reload(); await expect(picker).toHaveValue('owner/shared'); await capture('shared-chosen-phone.png'); await picker.selectOption('');
});

test.describe('categories', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  const view = (page, key) => page.locator(`.catview[data-category="${key}"]`);
  const goTo = (page, hash) => page.evaluate((k) => { location.hash = k; }, hash);
  const rename = (page) => page.getByRole('textbox', { name: 'Account name' });
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');

  // Two machines whose harnesses are all missing; `install` answers the status polls.
  async function stubHarnesses(page, install = () => ({ state: 'idle' })) {
    const names = ['claude', 'gpt', 'gemini', 'kimi', 'openrouter'];
    const machine = (name) => ({ name, reachable: true, harnesses: Object.fromEntries(names.map((n) => [n, { installed: false, version: null, signed_in: false, recipe: true }])) });
    await page.route('**/api/harnesses**', (r) => r.fulfill({ json: { switches: Object.fromEntries(names.map((n) => [n, true])), threads_using: {}, machines: [machine('hub'), machine('node-2')], can_start: { machine: 'hub', lead: { ok: true }, worker: { ok: true } } } }));
    await page.route('**/api/machines/*/harnesses/*/install', (r) => r.fulfill({ json: install(r.request().url()) }));
  }
  async function openRename(page) {
    await page.locator('.acct[data-account="default-claude"]').getByRole('button', { name: 'Rename' }).click();
    await rename(page).fill('typed, not saved');
  }

  test('each moved control is in its category', async ({ page }) => {
    await stubHarnesses(page);
    await page.route('**/api/settings/diagram-sensitivity', (r) => r.fulfill({ json: { machines: { hub: { level: 'high', files: [] } } } }));
    await openPage(page, context, '/app/settings#you');
    await page.evaluate(() => fetch('/wheelchair/api/settings/preferences', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ auto_merge: 'on' }) }));
    await page.reload();
    const radios = (name) => page.getByRole('radiogroup', { name, exact: true });
    const found = {
      you: [page.getByRole('textbox', { name: 'Your name' }), page.locator('#style-text'), radios('Diagram sensitivity'), radios('Enter to send'), page.getByLabel('Choose background image')],
      providers: [page.locator('.h-row[data-provider="claude"]'), page.locator('.acct[data-account="default-claude"]')],
      usage: [page.locator('[data-order="lead_order"]'), page.locator('#bal-save')],
      models: [page.getByLabel('Claude standard model', { exact: true }), page.getByLabel('Claude lead model', { exact: true }), page.getByLabel('Checker', { exact: true }), radios('What steps up first')],
      leads: [radios('Personal assistant'), radios('Project leads')],
      threads: [radios('Tool steps'), radios('Merge pull requests when done'), radios('Delete the branch after merging'), page.getByLabel('Default project folder', { exact: true }), radios('Aside access'), page.getByRole('combobox', { name: 'Lead names' })],
      behavior: [page.getByRole('button', { name: '+ New template' }), page.locator('#export-lessons')],
    };
    for (const [key, controls] of Object.entries(found)) {
      await page.locator(`#sections a[data-section="${key}"]`).click();
      await expect(view(page, key)).toBeVisible();
      for (const control of controls) await expect(control, key).toBeVisible();
    }
    await page.locator('#sections a[data-section="usage"]').click();
    const order = await page.locator('[data-order="lead_order"]').boundingBox();
    const balancing = await page.locator('.balancing').boundingBox();
    expect(order.y + order.height).toBeLessThan(balancing.y);
  });

  test('Diagrams choices show in You', async ({ page }) => {
    await page.route('**/api/settings/diagram-sensitivity', (r) => r.fulfill({ json: { machines: { hub: { level: 'high', files: [] } } } }));
    await openPage(page, context, '/app/settings#models');
    await expect(page.locator('#diagram-choices')).toHaveCount(0);
    await goTo(page, 'you');
    await expect(view(page, 'you').getByRole('radio', { name: /High/ })).toHaveAttribute('aria-checked', 'true');
  });

  test('old keys open the category holding them, and an unknown key opens You', async ({ page }) => {
    await openPage(page, context, '/app/settings#models');
    const keys = { harnesses: 'providers', accounts: 'providers', writing: 'you', background: 'you', templates: 'behavior', nonsense: 'you', 'templates/lessons/nobody': 'you', constructor: 'you' };
    for (const [old, key] of Object.entries(keys)) {
      await goTo(page, 'models');
      await expect(view(page, 'models')).toBeVisible();
      await goTo(page, old);
      await expect(view(page, key), old).toBeVisible();
      await expect(page.locator('#sections a[aria-current="page"]')).toHaveAttribute('data-section', key);
      await expect(page).toHaveURL(new RegExp(`#${old}$`));
    }
  });

  test("both lesson addresses open that role's editor", async ({ page }) => {
    for (const [address, role] of [['behavior/lessons/reviewer', 'Reviewer'], ['templates/lessons/worker', 'Worker']]) {
      await openPage(page, context, '/app/settings#models');
      await goTo(page, address);
      await expect(page.locator('.lessons-edit h2')).toHaveText('Lessons learned · ' + role);
      await openPage(page, context, '/app/settings#' + address);
      await expect(page.locator('.lessons-edit h2')).toHaveText('Lessons learned · ' + role);
    }
    await goTo(page, 'behavior/lessons/mapper');
    await expect(page.locator('.lessons-edit h2')).toHaveText('Lessons learned · Mapper');
  });

  test('on a phone no hash lists the categories, and ‹ Settings returns to the list', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPage(page, context, '/app/settings');
    const list = page.locator('.category-list');
    const back = page.getByRole('link', { name: /Settings$/ }).and(page.locator('.back'));
    await expect(list).toBeVisible();
    await expect(list.locator('strong')).toHaveText(TITLES);
    await expect(page.locator('.catview')).toBeHidden();
    await expect(page.locator('#sections')).toBeHidden();
    await expect(page.locator('.back')).toBeHidden();
    await noSideScroll(page);
    await list.getByRole('link', { name: /^Threads/ }).click();
    await expect(view(page, 'threads')).toBeVisible();
    await expect(list).toBeHidden();
    await back.click();
    await expect(list).toBeVisible();
    await expect(view(page, 'you')).toBeHidden();
    await page.goBack();
    await expect(view(page, 'threads')).toBeVisible();
    await openPage(page, context, '/app/settings#models');
    await expect(list).toBeHidden();
    await back.click();
    await expect(list).toBeVisible();
    await expect(page.locator('.catview')).toBeHidden();
  });

  test('crossing the phone width rebuilds nothing', async ({ page }) => {
    await stubHarnesses(page);
    await openPage(page, context, '/app/settings#providers');
    await openRename(page);
    await page.setViewportSize({ width: 899, height: 844 });
    await expect(page.locator('#sections')).toBeHidden();
    await expect(page.locator('.back')).toBeVisible();
    await expect(rename(page)).toHaveValue('typed, not saved');
    await page.setViewportSize({ width: 900, height: 844 });
    await expect(page.locator('#sections')).toBeVisible();
    await expect(page.locator('.back')).toBeHidden();
    await expect(rename(page)).toHaveValue('typed, not saved');

    await openPage(page, context, '/app/settings');
    await expect(view(page, 'you')).toBeVisible();
    await expect(page.locator('.category-list')).toBeHidden();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.category-list')).toBeVisible();
    await expect(view(page, 'you')).toBeHidden();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(view(page, 'you')).toBeVisible();
    await expect(page.locator('.category-list')).toBeHidden();
  });

  test('switching the Harnesses machine keeps an open account rename', async ({ page }) => {
    await stubHarnesses(page);
    await openPage(page, context, '/app/settings#providers');
    await expect(page.locator('.h-row')).toHaveCount(5);
    await openRename(page);
    await page.getByLabel('Machine', { exact: true }).selectOption('node-2');
    await expect(page.getByLabel('Machine', { exact: true })).toHaveValue('node-2');
    await expect(page.locator('.h-row')).toHaveCount(5);
    await expect(rename(page)).toHaveValue('typed, not saved');
  });

  test('an install progress tick keeps an open account rename', async ({ page }) => {
    let ticks = 0;
    await stubHarnesses(page, (url) => (url.includes('/claude/') ? { state: 'running', output_tail: `tick ${++ticks}` } : { state: 'idle' }));
    await openPage(page, context, '/app/settings#providers');
    const tail = page.locator('.h-row[data-provider="claude"] .h-tail');
    await expect(tail).toContainText('tick');
    await openRename(page);
    const seen = ticks;
    await expect(tail).toHaveText(`tick ${seen + 1}`, { timeout: 8000 });
    await expect(rename(page)).toHaveValue('typed, not saved');
  });

  test('saving a background keeps text typed in Writing style', async ({ page }) => {
    await openPage(page, context, '/app/settings#you');
    await page.locator('#style-text').fill('typed, not saved');
    // A phrase not yet added lives only in the page: rebuilding Writing style would drop it.
    await page.getByLabel('Add a phrase').fill('half a phrase');
    await expect.poll(() => page.evaluate(() => window.wcBackground.current().metadata !== null)).toBe(true);
    await page.getByLabel('Choose background image').setInputFiles({ name: 'one.png', mimeType: 'image/png', buffer: PNG });
    const editor = page.locator('.background-editor');
    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(editor.getByRole('status')).toHaveText('Saved');
    await expect(page.locator('#style-text')).toHaveValue('typed, not saved');
    await expect(page.getByLabel('Add a phrase')).toHaveValue('half a phrase');
    await editor.getByRole('button', { name: 'Remove background' }).click();
    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(editor.getByRole('status')).toHaveText('Saved');
    await expect(page.locator('#style-text')).toHaveValue('typed, not saved');
  });

  test('the phone list keeps the hidden background editor until You is reopened', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPage(page, context, '/app/settings#you');
    const editor = page.locator('.background-editor');
    const visibility = editor.getByLabel('Visibility');
    const save = editor.getByRole('button', { name: 'Save', exact: true });
    await expect(editor.getByLabel('Choose background image')).toBeEnabled();
    await editor.getByLabel('Choose background image').setInputFiles({ name: 'one.png', mimeType: 'image/png', buffer: PNG });
    await save.click();
    await expect(editor.getByRole('status')).toHaveText('Saved');
    await expect(visibility).toHaveValue('35');

    await page.locator('.back').click();
    const you = page.locator('.cat-link[data-category="you"]');
    await expect(you).toBeVisible();
    await expect(editor).toBeHidden();
    const hiddenNode = await editor.elementHandle();
    const updated = await page.evaluate(async () => {
      const { revision, image_id } = window.wcBackground.current().metadata;
      const response = await fetch('/wheelchair/api/settings/background', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ revision, image_id, opacity: 42 }),
      });
      await window.wcBackground.refresh();
      return response.ok;
    });
    expect(updated).toBe(true);
    await expect(page.locator('.background-layer')).toHaveCSS('opacity', '0.42');
    const sameEditor = (el) => el.isConnected && el === document.querySelector('.background-editor');
    expect.soft(await hiddenNode.evaluate(sameEditor), 'editor after refresh').toBe(true);
    await you.click();
    await expect(editor).toBeVisible();
    await expect(visibility).toHaveValue('42');

    // The restore event used by pageshow must also leave the hidden editor in place.
    await page.locator('.back').click();
    await expect(you).toBeVisible();
    const beforeRestore = await editor.elementHandle();
    await page.evaluate(() => window.dispatchEvent(new Event('backgroundrestore')));
    expect.soft(await beforeRestore.evaluate(sameEditor), 'editor after restore').toBe(true);
    await you.click();
    await expect(editor).toBeVisible();
    await expect(visibility).toHaveValue('42');
    await editor.getByRole('button', { name: 'Remove background' }).click();
    await save.click();
    await expect(editor.getByRole('status')).toHaveText('Saved');
  });
});

test.describe('one place for sign-in, usage and each draft', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }); });
  const NAMES = ['claude', 'gpt', 'gemini', 'kimi', 'openrouter'];
  const goTo = (page, hash) => page.evaluate((k) => { location.hash = k; }, hash);
  const group = (page, p) => page.locator(`.prov-group[data-provider="${p}"]`);
  const row = (page, p) => page.locator(`.h-row[data-provider="${p}"]`);
  const acct = (page, id) => page.locator(`.acct[data-account="${id}"]`);
  const allOn = () => Object.fromEntries(NAMES.map((n) => [n, true]));

  // One signed-out default account per provider shown, as the hub's /usage would answer.
  function usageBody(state = 'signed_out', machines = ['hub'], reading = null) {
    const one = (provider, label) => ({ label, left: null, accounts: [{ id: `default-${provider}`, provider, name: 'default', plan: 'unknown', weight: 1, paused: false, machines: Object.fromEntries(machines.map((m) => [m, state])), reading, next: false, reason: '', live_sessions: 0 }] });
    return { providers: { claude: one('claude', 'Claude'), gpt: one('gpt', 'GPT') } };
  }
  // Codex is installed and, unless `signedIn()` says otherwise, signed out on every machine.
  function harnessBody({ machines = ['hub'], signedIn = () => false, switches = allOn() } = {}) {
    const rowFor = (n) => ({ installed: n === 'gpt', version: n === 'gpt' ? '1' : null, signed_in: n === 'gpt' && signedIn(), recipe: true });
    return { switches, threads_using: {}, machines: machines.map((name) => ({ name, reachable: true, harnesses: Object.fromEntries(NAMES.map((n) => [n, rowFor(n)])) })), can_start: { machine: 'hub', lead: { ok: true }, worker: { ok: true } } };
  }
  const idle = (page) => page.route('**/api/machines/*/harnesses/*/install', (r) => r.fulfill({ json: { state: 'idle' } }));
  async function patchSettings(page, patch) {
    await page.route('**/api/settings', async (r) => {
      try { await r.fulfill({ json: { ...await (await r.fetch()).json(), ...patch() } }); } catch { await r.abort().catch(() => {}); }
    });
  }

  test("Harnesses' sign-in link opens the account cards' sign-in for the Harnesses machine", async ({ page }) => {
    const machines = ['hub', 'node-2'];
    const posts = [];
    await idle(page);
    await page.route('**/api/harnesses**', (r) => r.fulfill({ json: harnessBody({ machines }) }));
    await page.route('**/api/usage', (r) => r.fulfill({ json: usageBody('signed_out', machines) }));
    await page.route('**/api/accounts/*/signin', (r) => { posts.push([new URL(r.request().url()).pathname, r.request().postDataJSON()]); return r.fulfill({ json: {} }); });
    await page.route('**/api/accounts/*/signin/*', (r) => r.fulfill({ json: { state: 'waiting', url: 'https://example.test/login' } }));
    await openPage(page, context, '/app/settings#providers');
    await page.getByLabel('Machine', { exact: true }).selectOption('node-2');
    const link = row(page, 'gpt').getByRole('link', { name: 'Sign in Codex' });
    await expect(link).toHaveAttribute('href', '#providers');
    await expect(row(page, 'gpt').getByRole('button', { name: /Sign in/ })).toHaveCount(0);
    await expect(page.locator('.signin-card')).toHaveCount(0);
    expect(posts).toEqual([]);
    await link.click();
    const card = group(page, 'gpt').locator('.signin-card');
    await expect(card).toContainText('Sign in default on node-2');
    await expect(card.getByRole('link', { name: 'https://example.test/login' })).toBeVisible();
    await expect(group(page, 'gpt')).toBeInViewport();
    await expect(page.locator('.signin-card')).toHaveCount(1);
    expect(posts).toEqual([['/wheelchair/api/accounts/default-gpt/signin', { machine: 'node-2' }]]);
    // The 30-second repaint of Accounts keeps the card where it is.
    await goTo(page, 'usage');
    await goTo(page, 'providers');
    await expect(group(page, 'gpt').locator('.signin-card')).toContainText('node-2');
  });

  test('account cards show one usage line and no usage bars', async ({ page }) => {
    const hour = (n) => new Date(Date.now() + n * 3600000).toISOString();
    const reading = { at: hour(0), five_hour: { used: 42, resets_at: hour(2) }, week: { used: 61, resets_at: hour(60) } };
    await page.route('**/api/usage', (r) => r.fulfill({ json: usageBody('signed_in', ['hub'], reading) }));
    await openPage(page, context, '/app/settings#providers');
    const card = acct(page, 'default-claude');
    await expect(card.locator('.acct-usage')).toHaveCount(1);
    await expect(card.locator('.acct-usage')).toHaveText(/^5-hour 42% used · week 61% used · as of [^·]+$/);
    await expect(card.locator('.win, .meter, .bar, meter, progress')).toHaveCount(0);
    await expect(card).not.toContainText('resets');
    const lines = await card.locator('.acct-usage').evaluate((el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight || '20'));
    expect(lines).toBeLessThan(1.5);
  });

  test('the per-account table draws a bar for each window and account cards draw none', async ({ page }) => {
    const hour = (n) => new Date(Date.now() + n * 3600000).toISOString();
    const body = usageBody('signed_in', ['hub'], { at: hour(0), five_hour: { used: 42, resets_at: hour(2) }, week: { used: 61, resets_at: hour(60) } });
    body.providers.claude.left = 0.39;
    body.providers.claude.accounts.push({ ...body.providers.claude.accounts[0], id: 'spare', name: 'Spare', reading: { at: hour(0), five_hour: { used: 88, resets_at: hour(-1) } } });
    await page.route('**/api/usage', (r) => r.fulfill({ json: body }));
    await openPage(page, context, '/app/settings#usage');
    const claude = page.locator('.usage-prov[data-provider="claude"]');
    await claude.locator('.usage-toggle').click();
    const bar = (id, label) => claude.locator(`tr[data-account="${id}"] td[data-label="${label}"] .meter`);
    const share = (locator) => locator.evaluate((el) => Math.round(100 * el.firstElementChild.getBoundingClientRect().width / el.getBoundingClientRect().width));
    for (const [id, label, n, name] of [['default-claude', '5-hour used', 42, '5-hour'], ['default-claude', 'Week used', 61, 'week'], ['spare', '5-hour used', 0, '5-hour']]) {
      await expect(bar(id, label)).toHaveAttribute('aria-label', `${n}% of the ${name} window used`);
      expect(await bar(id, label).evaluate((el) => el.getBoundingClientRect().width)).toBe(90);
      expect(await share(bar(id, label))).toBe(n);
      await expect(claude.locator(`tr[data-account="${id}"] td[data-label="${label}"]`)).toHaveText(`${n}%`);
    }
    await expect(bar('spare', 'Week used')).toHaveCount(0);
    await page.evaluate(() => { location.hash = 'providers'; });
    await expect(acct(page, 'default-claude')).toContainText('42% used');
    await expect(page.locator('.acct .meter, .acct .bar')).toHaveCount(0);
  });

  test('Harnesses answering while a button below is pressed does not move it from under the press', async ({ page }) => {
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    await idle(page);
    await page.route('**/api/harnesses**', async (r) => { await held; await r.fulfill({ json: harnessBody() }); });
    await page.route('**/api/usage', (r) => r.fulfill({ json: usageBody() }));
    await openPage(page, context, '/app/settings#providers');
    // The browser's own scroll anchoring would sometimes hide a missing hold.
    await page.addStyleTag({ content: '* { overflow-anchor: none !important; }' });
    await expect(acct(page, 'default-claude')).toBeVisible();
    await page.locator('#add-account').click();
    const cancel = page.locator('.add-form').getByRole('button', { name: 'Cancel' });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    expect(await page.locator('[data-block="harnesses"]').evaluate((el) => el.getBoundingClientRect().bottom)).toBeLessThan(0);
    const box = await cancel.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    release();
    await expect(page.locator('.h-row')).toHaveCount(5);
    expect(Math.abs((await cancel.boundingBox()).y - box.y)).toBeLessThan(2);
    await page.mouse.up();
    await expect(page.locator('.add-form')).toHaveCount(0);
  });

  test('Harnesses answering during Send code keeps the sign-in card in place', async ({ page }) => {
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    const codes = [];
    const usage = usageBody();
    usage.providers.openrouter = {
      ...usage.providers.claude,
      label: 'OpenRouter',
      accounts: [{ ...usage.providers.claude.accounts[0], id: 'default-openrouter', provider: 'openrouter' }],
    };
    await idle(page);
    await page.route('**/api/harnesses**', async (route) => { await held; await route.fulfill({ json: harnessBody() }); });
    await page.route('**/api/usage', (route) => route.fulfill({ json: usage }));
    await page.route('**/api/accounts/default-openrouter/signin', (route) => route.fulfill({ json: {} }));
    await page.route('**/api/accounts/default-openrouter/signin/hub', (route) =>
      route.fulfill({ json: { state: 'waiting', wantsCode: true } }));
    await page.route('**/api/accounts/default-openrouter/signin/hub/code', (route) => {
      codes.push(route.request().postDataJSON().code);
      return route.fulfill({ status: 409, json: { error: 'The sign-in screen has moved on.' } });
    });
    await openPage(page, context, '/app/settings#providers');
    await page.addStyleTag({ content: '* { overflow-anchor: none !important; }' });
    await acct(page, 'default-openrouter').getByRole('button', { name: 'Sign in default on hub' }).click();
    const card = page.locator('.signin-card');
    const key = card.getByPlaceholder('Paste your OpenRouter key');
    const send = card.getByRole('button', { name: 'Send code' });
    await key.fill('sk-or-test-1');
    await send.click();
    await expect(card.getByRole('button', { name: 'Start again' })).toBeVisible();
    await key.fill('sk-or-test-2');
    const harnesses = page.locator('[data-block="harnesses"]');
    expect(await harnesses.evaluate((el) => {
      const navBottom = document.getElementById('app-nav').getBoundingClientRect().bottom;
      window.scrollBy(0, el.getBoundingClientRect().bottom - navBottom - 24);
      return el.getBoundingClientRect().bottom > navBottom;
    })).toBe(true);
    await expect(send).toBeInViewport();
    const box = await send.boundingBox();
    const cardNode = await card.elementHandle();
    const keyNode = await key.elementHandle();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    const focused = await page.evaluateHandle(() => document.activeElement);
    release();
    await expect(page.locator('.h-row')).toHaveCount(5);
    const after = await send.boundingBox();
    const preserved = await cardNode.evaluate((el, { field, focus }) => ({
      card: el === document.querySelector('.signin-card'),
      field: field === el.querySelector('input[type="password"]'),
      focus: focus === document.activeElement,
      key: field.value,
    }), { field: keyNode, focus: focused });
    await page.mouse.up();
    await expect.poll(() => codes).toEqual(['sk-or-test-1', 'sk-or-test-2']);
    expect(Math.abs(after.y - box.y)).toBeLessThan(2);
    expect(after.x).toBe(box.x);
    expect(preserved).toEqual({ card: true, field: true, focus: true, key: 'sk-or-test-2' });
  });

  for (const first of ['lead-order', 'balancing']) {
    test(`pressing the ${first} Save keeps the other box's unsaved edit and updates the reserve label`, async ({ page }) => {
      const saved = [];
      await patchSettings(page, () => ({ harnesses: allOn(), lead_order: ['claude', 'gpt', 'any'], leave: 10, reserved_provider: 'Claude' }));
      await page.route('**/api/settings/balancing', (r) => { const body = r.request().postDataJSON(); saved.push(body); return r.fulfill({ json: { ...body, reserved_provider: 'GPT' } }); });
      await page.route('**/api/usage', (r) => r.fulfill({ json: usageBody('signed_in', ['hub']) }));
      await openPage(page, context, '/app/settings#usage');
      const leads = page.locator('[data-order="lead_order"]');
      const order = () => leads.locator('li span').allTextContents();
      await expect(page.locator('#bal-save-lead')).toHaveAttribute('aria-label', 'Save Claude for leads');
      await expect(page.locator('.usage-bars .usage-prov')).toHaveCount(2);
      await leads.getByRole('button', { name: 'Move Claude down' }).click();
      await page.locator('#bal-leave').fill('33');
      const [one, other] = first === 'lead-order' ? ['#lead-order-save', '#bal-save'] : ['#bal-save', '#lead-order-save'];
      await page.locator(one).click();
      await expect(page.locator('#bal-save-lead')).toHaveAttribute('aria-label', 'Save GPT for leads');
      await expect(page.locator('.balancing')).toContainText('When GPT is projected to have less than this left at refill');
      await expect(page.locator('.balancing')).toContainText('Held back when GPT runs short');
      await expect(page.locator('#bal-leave')).toHaveValue('33');
      expect(await order()).toEqual(['GPT', 'Claude']);
      expect(Object.hasOwn(saved[0], 'lead_order')).toBe(first === 'lead-order');
      expect(Object.hasOwn(saved[0], 'leave')).toBe(first === 'balancing');
      await page.locator(other).click();
      await expect.poll(() => saved.length).toBe(2);
      if (first === 'lead-order') expect(saved[1].leave).toBe(33);
      else expect(saved[1].lead_order).toEqual(['gpt', 'claude', 'any']);
    });
  }

  test('opening Usage and balancing re-reads the reserved provider and keeps what was typed', async ({ page }) => {
    let reserved = 'Claude';
    await patchSettings(page, () => ({ leave: 10, reserved_provider: reserved }));
    await openPage(page, context, '/app/settings#usage');
    await page.locator('#bal-leave').fill('33');
    await goTo(page, 'models');
    await expect(page.locator('#bal-leave')).toHaveCount(0);
    reserved = 'GPT';
    await goTo(page, 'usage');
    await expect(page.locator('#bal-save-lead')).toHaveAttribute('aria-label', 'Save GPT for leads');
    await expect(page.locator('.balancing')).toContainText('Save GPT for leads');
    await expect(page.locator('.balancing')).toContainText('When GPT is projected');
    await expect(page.locator('.balancing')).toContainText('Held back when GPT runs short');
    await expect(page.locator('#bal-leave')).toHaveValue('33');
  });

  test('turning a harness on shows its account cards, waiting while an account edit is open', async ({ page }) => {
    const switches = { ...allOn(), gpt: false, claude: false };
    await idle(page);
    await page.route('**/api/harnesses**', (r) => r.fulfill({ json: harnessBody({ switches }) }));
    await patchSettings(page, () => ({ harnesses: { ...switches } }));
    await page.route('**/api/usage', (r) => r.fulfill({ json: usageBody() }));
    await page.route('**/api/settings/harnesses/*', (r) => { switches[r.request().url().split('/').pop()] = r.request().postDataJSON().enabled; return r.fulfill({ json: { harnesses: { ...switches } } }); });
    await openPage(page, context, '/app/settings#providers');
    await expect(row(page, 'gpt')).toBeVisible();
    await expect(group(page, 'gpt')).toHaveCount(0);
    await page.getByLabel('Use Codex').click();
    await expect(group(page, 'gpt').locator('.acct[data-account="default-gpt"]')).toBeVisible();
    await expect(page.locator('.catview h1')).toHaveText('AI providers');

    await acct(page, 'default-gpt').getByRole('button', { name: 'Rename' }).click();
    const name = page.getByRole('textbox', { name: 'Account name' });
    await name.fill('typed, not saved');
    await page.getByLabel('Use Claude Code').click();
    await expect(page.getByLabel('Use Claude Code')).toBeChecked();
    await expect(row(page, 'claude').getByRole('button', { name: 'Install Claude Code' })).toBeVisible();
    await expect(name).toHaveValue('typed, not saved');
    await expect(group(page, 'claude')).toHaveCount(0);
    await acct(page, 'default-gpt').getByRole('button', { name: 'Cancel' }).click();
    await expect(group(page, 'claude')).toHaveCount(1);
  });

  // The hub keeps each machine's answer for a while: only a fresh harness read renews what
  // both /harnesses and /usage say.
  test('after an account sign-in, Harnesses and the account card show the new status', async ({ page }) => {
    let machine = false; let kept = false; let hold = null; let release = null; let heldAnswered = false;
    await idle(page);
    await page.route('**/api/harnesses**', async (r) => {
      if (r.request().url().includes('fresh=1')) { await new Promise((done) => setTimeout(done, 300)); kept = machine; }
      await r.fulfill({ json: harnessBody({ signedIn: () => kept }) });
    });
    await page.route('**/api/usage', async (r) => {
      const body = usageBody(kept ? 'signed_in' : 'signed_out');
      const wait = hold; hold = null;
      if (wait) await wait;
      await r.fulfill({ json: body });
      if (wait) heldAnswered = true;
    });
    await page.route('**/api/accounts/default-gpt/signin', (r) => r.fulfill({ json: {} }));
    await page.route('**/api/accounts/default-gpt/signin/hub', (r) => { machine = true; return r.fulfill({ json: { state: 'done', logged_in: true } }); });
    await openPage(page, context, '/app/settings#providers');
    const state = acct(page, 'default-gpt').locator('li[data-machine="hub"] .mstate');
    await expect(state).toHaveText('signed out');
    await expect(row(page, 'gpt').locator('.h-state')).toHaveText('Installed 1');
    // A reading asked for before the sign-in, and answered after it, must not undo it.
    hold = new Promise((done) => { release = done; });
    await goTo(page, 'usage');
    await expect.poll(() => hold === null).toBe(true);
    // Coming back reads Harnesses afresh; let that finish so it cannot stand in for the sign-in's.
    const entered = page.waitForResponse((res) => res.url().includes('/harnesses?fresh=1'));
    await goTo(page, 'providers');
    await entered;
    await acct(page, 'default-gpt').getByRole('button', { name: 'Sign in default on hub' }).click();
    await expect(row(page, 'gpt').locator('.h-state')).toHaveText('Signed in', { timeout: 8000 });
    await expect(state).toHaveText('signed in');
    release();
    await expect.poll(() => heldAnswered).toBe(true);
    await page.waitForTimeout(300);
    await expect(state).toHaveText('signed in');
  });

  test('pausing and adding an account reload the Harnesses status', async ({ page }) => {
    let paused = false; let added = false;
    await idle(page);
    await page.route('**/api/harnesses**', (r) => r.fulfill({ json: harnessBody({ signedIn: () => !paused || added }) }));
    await page.route('**/api/usage', (r) => r.fulfill({ json: usageBody('signed_in') }));
    await page.route('**/api/settings/accounts/default-gpt', (r) => { paused = true; return r.fulfill({ json: {} }); });
    await page.route('**/api/settings/accounts', (r) => { added = true; return r.fulfill({ status: 201, json: { id: 'spare' } }); });
    await openPage(page, context, '/app/settings#providers');
    const status = row(page, 'gpt').locator('.h-state');
    await expect(status).toHaveText('Signed in');
    await acct(page, 'default-gpt').getByRole('button', { name: 'Pause' }).click();
    await expect(status).toHaveText('Installed 1');
    await page.locator('#add-account').click();
    await page.locator('#add-provider').selectOption('gpt');
    await page.locator('#add-name').fill('Spare');
    await page.locator('.add-form button[type="submit"]').click();
    await expect(status).toHaveText('Signed in');
  });
});

test('shared keys follow machine, show refusals and reload on revision conflicts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/wheelchair/api/new-thread*', route => route.fulfill({ json: { machine: 'hub', machines: ['hub', 'node-2'] } }));
  let revision = 1, saves = 0;
  const reads = [];
  await page.route('**/wheelchair/api/shared-keys/*', async route => {
    const action = new URL(route.request().url()).pathname.split('/').pop(), body = route.request().postDataJSON();
    if (action === 'read') {
      reads.push(body.machine);
      return route.fulfill({ json: { revision, keys: body.machine === 'hub' ? [
        { name: 'MAPS_TOKEN', stored: true, folder_usable: false, reason: 'value too short', tools: ['maps'] },
        { name: 'WEATHER_TOKEN', stored: false, folder_usable: null, tools: ['weather'] },
      ] : [], notes: body.machine === 'node-2' ? ["couldn't read the shared tools: no copy"] : [] } });
    }
    if (++saves === 1) return route.fulfill({ status: 400, json: { outcome: 'refused', reason: 'value too short' } });
    if (saves === 2) { revision = 2; return route.fulfill({ status: 409, json: { outcome: 'refused', reason: 'changed elsewhere, reload' } }); }
    return route.fulfill({ json: { outcome: 'saved', revision: ++revision, keys: [] } });
  });
  await openPage(page, context, '/app/settings#shared-tools');
  await expect(page.getByLabel('Shared tools project')).toBeEnabled();
  const row = page.locator('[data-key="MAPS_TOKEN"]');
  await expect(row).toContainText("can't be used by folder tools: value too short");
  await expect(row).toContainText('used by maps');
  await page.screenshot({ path: '/tmp/t3b-shared-phone.png' });
  await row.getByLabel('Value for MAPS_TOKEN').fill('short');
  await row.getByRole('button', { name: 'Replace' }).click();
  await expect(row.getByRole('alert')).toHaveText('value too short');
  await row.getByRole('button', { name: 'Replace' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'changed elsewhere, reload' })).toBeVisible();
  await page.getByLabel('Machine', { exact: true }).selectOption('node-2');
  await expect(page.getByText("couldn't read the shared tools: no copy")).toBeVisible();
  expect(reads).toContain('node-2');
});

test('shared key saves from two tabs use the read revision and reload the stale tab', async ({ page }) => {
  const second = await page.context().newPage();
  let revision = 1;
  const writes = [];
  for (const tab of [page, second]) {
    await tab.route('**/wheelchair/api/new-thread*', route => route.fulfill({ json: { machine: 'hub', machines: ['hub'] } }));
    await tab.route('**/wheelchair/api/shared-keys/*', async route => {
      const action = new URL(route.request().url()).pathname.split('/').pop();
      const body = route.request().postDataJSON();
      if (action === 'read') return route.fulfill({ json: { revision, keys: [{ name: 'TOKEN', stored: revision > 1, tools: ['maps'] }], notes: [] } });
      writes.push(body);
      if (body.revision !== revision) return route.fulfill({ status: 409, json: { outcome: 'refused', reason: 'changed elsewhere, reload' } });
      return route.fulfill({ json: { outcome: 'saved', revision: ++revision, keys: [] } });
    });
    await openPage(tab, context, '/app/settings#shared-tools');
    await expect(tab.locator('[data-key="TOKEN"]')).toBeVisible();
  }
  for (const tab of [page, second]) {
    const row = tab.locator('[data-key="TOKEN"]');
    await row.getByLabel('Value for TOKEN').fill('abcdefgh');
    await row.getByRole('button', { name: 'Set', exact: true }).click();
    if (tab === page) await expect(row.locator('.pt-chip')).toHaveText('set');
    else await expect(tab.getByRole('alert').filter({ hasText: 'changed elsewhere, reload' })).toBeVisible();
  }
  expect(writes.map(body => body.revision)).toEqual([1, 1]);
  await expect(second.locator('[data-key="TOKEN"] .pt-chip')).toHaveText('set');
  await second.close();
});

test('capture shared keys with a chosen project at phone size', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/wheelchair/api/settings', async route => {
    const response = await route.fetch();
    const body = await response.json();
    body.shared_tools_repo = 'owner/shared-tools';
    await route.fulfill({ response, json: body });
  });
  await page.route('**/wheelchair/api/new-thread*', route => route.fulfill({ json: { machine: 'hub', machines: ['hub'] } }));
  await page.route('**/wheelchair/api/shared-keys/read', route => route.fulfill({ json: { revision: 1, keys: [
    { name: 'MAPS_TOKEN', stored: true, folder_usable: true, tools: ['maps'] },
    { name: 'WEATHER_TOKEN', stored: false, folder_usable: null, tools: ['weather'] },
  ], notes: [] } }));
  await openPage(page, context, '/app/settings#shared-tools');
  await expect(page.getByLabel('Shared tools project')).toHaveValue('owner/shared-tools');
  await expect(page.locator('[data-key="WEATHER_TOKEN"]')).toBeVisible();
  await page.screenshot({ path: '/tmp/t3b-shared-chosen-phone.png' });
});

// Antigravity's levels, from a fake `agy` and its own pins file.
test.describe('Antigravity levels', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  let agy;
  const ALL = ['CLI default', 'low', 'medium', 'high', 'xhigh', 'max'];
  const THREE = ['CLI default', 'low', 'medium', 'high'];
  const FOUR = [...THREE, 'xhigh'];

  test.beforeAll(async () => {
    const state = await makeDir('app-settings-agy-');
    const models = path.join(state, 'models');
    const modelsCache = path.join(state, 'models-cache.json');
    await fs.writeFile(modelsCache, JSON.stringify({ models: [] }));
    const group = (base, name, levels) => levels.map((level) => [`${base}-${level.toLowerCase()}`, `${name} (${level})`]);
    const listing = [
      ...group('gemini-4-hydrogen', 'Gemini 4 Hydrogen', ['Low', 'Medium', 'High', 'XHigh']),
      ...group('gemini-3.8-flash', 'Gemini 3.8 Flash', ['Low', 'Medium', 'High']),
      ['orchestrator', 'Orchestrator'],
    ];
    const fake = path.join(state, 'agy');
    await fs.writeFile(fake, `#!/bin/sh\nprintf '${listing.map(([id, name]) => `${id}\\t${name}\\n`).join('')}'\n`, { mode: 0o755 });
    const server = await startServer({ stateDir: state, env: { WHEELCHAIR_AGY: fake, WHEELCHAIR_MODELS: models, WHEELCHAIR_MODELS_CACHE: modelsCache } });
    agy = { state, server, models };
  });
  test.afterAll(async () => { await agy.server.stop(); });

  const model = (page) => page.getByLabel('Antigravity light model', { exact: true });
  const effort = (page) => page.getByLabel('Antigravity light effort', { exact: true });
  const saved = async (page) => (await settings(page)).models.gemini.light;
  async function open(page, pin) {
    await fs.writeFile(agy.models, `gemini.light = ${pin}\n`);
    await openPage(page, agy, '/app/settings#models');
    await expect(model(page)).toBeVisible();
  }
  async function other(page, value) {
    await model(page).selectOption('__other');
    await page.getByLabel('Antigravity light model, other').fill(value);
    await page.getByRole('button', { name: 'Use', exact: true }).click();
  }

  test('effort choices are the chosen model\'s levels, and a level it has is kept', async ({ page }) => {
    await open(page, 'gemini-3.8-flash @medium');
    await expect(model(page).locator('option:checked')).toHaveText('Gemini 3.8 Flash · gemini-3.8-flash');
    await expect(effort(page).locator('option')).toHaveText(THREE);
    await model(page).selectOption('gemini-4-hydrogen');
    await expect(effort(page).locator('option')).toHaveText(FOUR);
    await expect(effort(page)).toHaveValue('medium');
    await expect.poll(() => saved(page)).toEqual({ model: 'gemini-4-hydrogen', effort: 'medium' });
  });

  test('effort resets to CLI default when the new model lacks the level', async ({ page }) => {
    await open(page, 'gemini-4-hydrogen @xhigh');
    await expect(effort(page)).toHaveValue('xhigh');
    await model(page).selectOption('gemini-3.8-flash');
    await expect(effort(page).locator('option')).toHaveText(THREE);
    await expect(effort(page)).toHaveValue('');
    await expect.poll(() => saved(page)).toEqual({ model: 'gemini-3.8-flash', effort: null });
    await expect(page.locator('.inline-err')).toHaveCount(0);
  });

  test('effort is disabled at CLI default for a model with no levels', async ({ page }) => {
    await open(page, 'gemini-3.8-flash @high');
    await expect(effort(page)).toBeEnabled();
    await model(page).selectOption('orchestrator');
    await expect(effort(page)).toBeDisabled();
    await expect(effort(page).locator('option')).toHaveText(['CLI default']);
    await expect.poll(() => saved(page)).toEqual({ model: 'orchestrator', effort: null });
    await expect(page.locator('.inline-err')).toHaveCount(0);
  });

  test('effort offers every level for a typed model with unknown levels', async ({ page }) => {
    await open(page, 'gemini-3.8-flash @high');
    await other(page, 'gemini-9');
    await expect(effort(page).locator('option')).toHaveText(ALL);
    await expect(effort(page)).toHaveValue('high');
    await expect(effort(page)).toBeEnabled();
    await expect.poll(() => saved(page)).toEqual({ model: 'gemini-9', effort: 'high' });
  });

  test('effort comes from a member id typed through Other', async ({ page }) => {
    await open(page, 'gemini-4-hydrogen @high');
    await other(page, 'gemini-3.8-flash-low');
    await expect(model(page)).toHaveValue('gemini-3.8-flash');
    await expect(effort(page)).toHaveValue('low');
    await expect(effort(page).locator('option')).toHaveText(THREE);
    await expect.poll(() => saved(page)).toEqual({ model: 'gemini-3.8-flash', effort: 'low' });
  });

  test('effort save redraws the saved cell from a fresh read of the settings', async ({ page }) => {
    await open(page, 'gemini-3.8-flash @low');
    await expect(model(page).locator('option[value="gemini-new"]')).toHaveCount(0);
    await page.route('**/api/settings', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.model_options.gemini.push({ value: 'gemini-new', label: 'Newly listed', efforts: ['low'] });
      await route.fulfill({ response, json: body });
    });
    await effort(page).selectOption('high');
    await expect(model(page).locator('option[value="gemini-new"]')).toHaveCount(1);
    await expect(page.getByText('Saved; the list could not be refreshed')).toHaveCount(0);
    // Another cell is left as drawn, and takes the new list the next time it is drawn.
    const lead = page.getByLabel('Antigravity lead model', { exact: true });
    await expect(lead.locator('option[value="gemini-new"]')).toHaveCount(0);
    await page.getByLabel('Antigravity lead effort', { exact: true }).selectOption('low');
    await expect(lead.locator('option[value="gemini-new"]')).toHaveCount(1);
  });

  test('effort save leaves the drafts typed in other cells, in both blocks', async ({ page }) => {
    await open(page, 'gemini-3.8-flash @low');
    // One draft in the saved cell's own block and one in the other block.
    const drafts = [['Claude heavy model', 'claude-draft-tier'], ['Claude lead model', 'claude-draft-lead']];
    for (const [label, text] of drafts) {
      await page.getByLabel(label, { exact: true }).selectOption('__other');
      await page.getByLabel(`${label}, other`).fill(text);
    }
    await page.route('**/api/settings', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.model_options.gemini.push({ value: 'gemini-new', label: 'Newly listed', efforts: ['low'] });
      await route.fulfill({ response, json: body });
    });
    await effort(page).selectOption('high');
    await expect(model(page).locator('option[value="gemini-new"]')).toHaveCount(1);
    for (const [label, text] of drafts) {
      await expect(page.getByLabel(`${label}, other`)).toHaveValue(text);
      await expect(page.getByLabel(label, { exact: true })).toHaveValue('__other');
    }
  });

  test('effort saves made while the list is still being re-read each get the fresh list', async ({ page }) => {
    await open(page, 'gemini-3.8-flash @low');
    const held = [];
    await page.route('**/api/settings', (route) => { held.push(route); });
    await effort(page).selectOption('high');
    await expect.poll(() => held.length).toBe(1);
    await page.getByLabel('Antigravity lead effort', { exact: true }).selectOption('low');
    await expect.poll(() => held.length).toBe(2);
    for (const route of held) {
      const response = await route.fetch();
      const body = await response.json();
      body.model_options.gemini.push({ value: 'gemini-new', label: 'Newly listed', efforts: ['low'] });
      await route.fulfill({ response, json: body });
    }
    await expect(model(page).locator('option[value="gemini-new"]')).toHaveCount(1);
    await expect(page.getByLabel('Antigravity lead model', { exact: true }).locator('option[value="gemini-new"]')).toHaveCount(1);
  });

  test('effort stays saved, and says so, when the list cannot be re-read after a save', async ({ page }) => {
    await open(page, 'gemini-3.8-flash @low');
    await page.route('**/api/settings', (route) => route.abort());
    await effort(page).selectOption('high');
    await expect(page.locator('[data-cell="tiers:gemini:light"]').getByText('Saved; the list could not be refreshed', { exact: true })).toBeVisible();
    await expect(effort(page)).toHaveValue('high');
    await expect(page.locator('.inline-err')).toHaveCount(0);
    await expect(page.locator('.note').first()).toHaveText('Saved, applies to new sessions');
    await page.unroute('**/api/settings');
    expect((await saved(page)).effort).toBe('high');
  });
});
