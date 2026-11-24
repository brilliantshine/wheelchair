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
    await expect(links).toHaveText([/Features/, /Threads/, /Agents/, /Settings/]);
    await expect(page.locator('#app-nav .seg a[aria-current="page"]')).toHaveText('Settings');
    await expect(page.locator('#app-nav .seg .lbl')).toBeVisible();
    await expect(page.locator('#app-nav .seg .gear')).toBeHidden();
    await expect(page.locator('#panel h1')).toHaveText('Models and preferences');
  });

  test('eight sections, kept across a reload through the hash', async ({ page }) => {
    await openPage(page, context, '/app/settings');
    const nav = page.locator('#sections a');
    await expect(nav).toHaveText(['Harnesses', 'Accounts', 'Usage', 'Models and preferences', 'Behavior templates', 'Writing style', 'Project tools', 'Background Customization']);
    await nav.nth(4).click();
    await expect(page).toHaveURL(/#templates$/);
    await expect(page.locator('.tpl-list h1')).toHaveText('Behavior templates');
    await page.reload();
    await expect(page.locator('.tpl-list h1')).toBeVisible();
    await expect(page.locator('#sections a[aria-current="page"]')).toHaveText('Behavior templates');
    await nav.nth(5).click();
    await page.reload();
    await expect(page.locator('#panel h1')).toHaveText('Writing style');
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
    await openPage(page, context, '/app/settings#models');
    await expect(page.getByText('Claude, Antigravity and Kimi sessions', { exact: true })).toBeVisible();
    await expect(page.getByText('Codex sessions', { exact: true })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Claude, Antigravity and Kimi permission mode', exact: true })).toBeVisible();
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

    await page.getByRole('radio', { name: 'Bypass' }).click();
    await expect.poll(async () => (await settings(page)).permission_mode).toBe('bypass');
    await expect(page.getByText('Never asks: it can write only inside its worktree.')).toBeVisible();
    await page.getByRole('radio', { name: 'Unrestricted' }).click();
    await expect.poll(async () => (await settings(page)).codex_mode).toBe('unrestricted');
    await expect(page.getByText(/it can change anything on the machine/)).toBeVisible();
    await page.getByLabel('Checker', { exact: true }).selectOption('critical');
    await expect.poll(async () => (await settings(page)).other_agents.verifier).toBe('critical');

    await page.reload();
    await expect(page.getByLabel('Claude standard model', { exact: true })).toHaveValue('__none');
    await expect(page.getByRole('radio', { name: 'Bypass' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: 'Unrestricted' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByLabel('Checker', { exact: true })).toHaveValue('critical');
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
    await openPage(page, context, '/app/settings#templates');
    await expect(page.locator('.tpl-item', { hasText: 'Careful' }).locator('.tag')).toContainText('project no longer listed');
    await page.locator('.tpl-item', { hasText: 'Careful' }).click();
    await expect(page.locator('#tscope option:checked')).toContainText('project no longer listed');
    await fs.writeFile(path.join(context.state, 'projects.json'), JSON.stringify(['/tmp/proj-alpha', '/tmp/proj-beta']));
  });

  test('the auto-merge switch says Saved, not applies to new sessions, and survives a reload', async ({ page }) => {
    await openPage(page, context, '/app/settings#models');
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

  test('the sections are tabs above the section and the page never scrolls sideways', async ({ page }) => {
    await openPage(page, context, '/app/settings');
    const tabs = page.locator('#sections a');
    await expect(tabs).toHaveCount(8);
    const boxes = await tabs.evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().toJSON()));
    expect(new Set(boxes.map((b) => Math.round(b.top))).size).toBe(1);
    const panel = await page.locator('#panel').boundingBox();
    expect(boxes[0].bottom).toBeLessThanOrEqual(panel.y + 1);
    for (const key of ['harnesses', 'accounts', 'usage', 'models', 'templates', 'writing']) {
      await page.locator(`#sections a[data-section="${key}"]`).click();
      await expect(page.locator('#sections a[aria-current="page"]')).toHaveAttribute('data-section', key);
      await page.waitForTimeout(200);
      await noSideScroll(page);
    }
    await page.locator('#sections a[data-section="models"]').click();
    await expect(page.getByLabel('Claude light model', { exact: true })).toBeVisible();
    await noSideScroll(page);
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
    await openPage(page, context, '/app/settings');
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
    await openPage(page, context, '/app/settings');
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
  await openPage(page, context, '/app/settings#models');
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
  await openPage(page, context, '/app/settings#models');
  await page.getByLabel('Lead names', { exact: true }).selectOption('custom');
  await page.getByLabel('Upload lead names').setInputFiles({ name: 'names.csv', mimeType: 'text/csv', buffer: Buffer.from('"Ada","Grace, Jr."\n"Say ""Hi"""\n') });
  await expect.poll(async () => (await settings(page)).lead_names).toEqual(['Ada', 'Grace, Jr.', 'Say "Hi"']);
});

test('a later dropdown choice wins over a slow upload save', async ({ page }) => {
  await openPage(page, context, '/app/settings#models');
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
  await openPage(page, context, '/app/settings#models');
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
  await page.locator('#sections a').nth(5).click();
  await page.locator('#sections a').nth(3).click();
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
  await openPage(page, context, '/app/settings#models');
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
  await openPage(page, context, '/app/settings#models');
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
  await openPage(page, context, '/app/settings#models');
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
  await openPage(page, context, '/app/settings#models');
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

test('models and preferences fits at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page, context, '/app/settings#models');
  await expect(page.locator('tr[data-provider="gemini"]')).toBeVisible();
  await noSideScroll(page);
});
