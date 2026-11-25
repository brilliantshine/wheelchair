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

const KEYS = ['you', 'providers', 'usage', 'models', 'leads', 'threads', 'behavior', 'tools'];
const TITLES = ['You', 'AI providers', 'Usage and balancing', 'Models', 'Assistant and project leads', 'Threads', 'Agent behavior', 'Project tools'];
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

  test('eight categories in order, kept across a reload through the hash', async ({ page }) => {
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

test('Models fits at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page, context, '/app/settings#models');
  await expect(page.locator('tr[data-provider="gemini"]')).toBeVisible();
  await noSideScroll(page);
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

  for (const first of ['lead-order', 'balancing']) {
    test(`pressing the ${first} Save keeps the other box's unsaved edit and updates the reserve label`, async ({ page }) => {
      const saved = [];
      await patchSettings(page, () => ({ harnesses: allOn(), lead_order: ['claude', 'gpt', 'any'], leave: 10, reserved_provider: 'Claude' }));
      await page.route('**/api/settings/balancing', (r) => { const body = r.request().postDataJSON(); saved.push(body); return r.fulfill({ json: { ...body, reserved_provider: 'GPT' } }); });
      await openPage(page, context, '/app/settings#usage');
      const leads = page.locator('[data-order="lead_order"]');
      const order = () => leads.locator('li span').allTextContents();
      await expect(page.locator('#bal-save-lead')).toHaveAttribute('aria-label', 'Save Claude for leads');
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
