'use strict';
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

const { api } = require('./helpers/app');

const setAssistant = (page, ctx, value) => api(ctx, '/settings/preferences', { method: 'PUT', body: { assistant: value } });
const status = async (ctx) => (await api(ctx, '/assistant')).body;
async function assistantId(page, ctx) {
  const body = await status(ctx);
  return body.on ? body.thread : null;
}

for (const [name, size] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]]) {
  test(`Threads list: the assistant row is first when on, absent when off (${name})`, async ({ page }) => {
    const ctx = await startWorld();
    try {
      await ctx.make({ cli: 'claude', title: 'Usage page' });
      await signIn(page, ctx);
      await page.setViewportSize(size);
      await page.goto(`${ctx.server.url}/app/threads`);
      await expect(page.locator('#list li.row')).toHaveCount(1);
      await expect(page.locator('.assistant-row')).toHaveCount(0);

      expect((await setAssistant(page, ctx, 'on')).status).toBe(200);
      const id = await assistantId(page, ctx);
      expect(id).toBeTruthy();
      await ctx.patch(id, (t) => { t.user_at = '2000-01-01T00:00:00.000Z'; });
      await page.goto(`${ctx.server.url}/app/threads`);
      const first = page.locator('#list > li').first();
      await expect(first).toHaveClass(/assistant-row/);
      await expect(first.locator('a.title')).toHaveText('Personal assistant');
      await expect(first.locator('a.title')).toHaveAttribute('href', `/wheelchair/app/thread?id=${id}`);
      await expect(first.getByRole('button')).toHaveCount(0);
      await expect(first).not.toContainText('Archive');
      await expect(page.locator('#list > li.group-label').first()).toBeVisible();
      await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/threads-${name}.png` : undefined });

      await setAssistant(page, ctx, 'off');
      await page.goto(`${ctx.server.url}/app/threads`);
      await expect(page.locator('#list li.row')).toHaveCount(1);
      await expect(page.locator('.assistant-row')).toHaveCount(0);
    } finally { await ctx.close(); }
  });
}

test('assistant thread page: no project controls, labels, seen marker', async ({ page }) => {
  const ctx = await startWorld();
  try {
    await setAssistant(page, ctx, 'on');
    await signIn(page, ctx);
    await setAssistant(page, ctx, 'on');
    const id = await assistantId(page, ctx);
    const at = '2026-03-04T05:06:07.000Z';
    await page.route('**/api/threads/*/chat', async (route) => {
      const response = await route.fetch(); const json = await response.json();
      json.items = [{ type: 'human', text: 'start a thread', at, by: 'assistant' }, { type: 'human', text: 'plain note', at: '2026-03-04T05:00:00.000Z' }, { type: 'assistant', text: 'Done.', at: '2026-03-04T05:06:00.000Z', id: 'm1' }];
      json.cards = [{ id: 'q1', kind: 'question', question: 'Which?', options: [], at, answered: true, answered_by: 'assistant' }];
      await route.fulfill({ response, json });
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${ctx.server.url}/app/thread?id=${id}`);
    await expect(page.locator('#head h1')).toHaveText('Personal assistant');
    await expect(page.locator('.bubble.human', { hasText: 'start a thread' }).locator('.by-assistant')).toHaveText('From your assistant');
    await expect(page.locator('.by-assistant')).toHaveCount(1);
    await expect(page.locator('.answered-tag')).toContainText('by your assistant');
    for (const name of ['Archive', 'Export', 'Agents']) await expect(page.locator('#head').getByText(name, { exact: true })).toHaveCount(0);
    await expect(page.locator('#head .badge')).toHaveCount(0);
    await expect(page.locator('#head .meta')).toHaveText('Across your projects');
    await expect(page.locator('#copy')).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('wc-assistant-seen'))).toBe(at);
    await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/thread-desktop.png` : undefined });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/thread-phone.png` : undefined });
  } finally { await page.unrouteAll({ behavior: 'ignoreErrors' }); await ctx.close(); }
});

test('an ordinary thread shows archived_by, and no assistant label without by', async ({ page }) => {
  const ctx = await startWorld();
  try {
    const made = await ctx.make({ cli: 'claude' });
    await page.route('**/api/threads/*/chat', async (route) => {
      const response = await route.fetch(); const json = await response.json();
      json.thread.archived = true; json.thread.archived_by = 'assistant';
      json.items = [{ type: 'human', text: 'by you', at: '2026-03-04T05:00:00.000Z' }];
      await route.fulfill({ response, json });
    });
    await signIn(page, ctx); await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    await expect(page.locator('#head')).toContainText('Archived by your assistant');
    await expect(page.locator('.by-assistant')).toHaveCount(0);
    await expect(page.locator('#head').getByText('Agents', { exact: true })).toBeVisible();
  } finally { await page.unrouteAll({ behavior: 'ignoreErrors' }); await ctx.close(); }
});

test('Settings control turns the assistant on and off', async ({ page }) => {
  const ctx = await startWorld();
  try {
    await signIn(page, ctx);
    await page.goto(`${ctx.server.url}/app/settings`);
    const row = page.locator('#assistant-setting');
    await expect(row).toContainText('An assistant that sees all your threads and acts on what you tell it.');
    await expect(row.getByRole('radio', { name: 'Off' })).toHaveAttribute('aria-checked', 'true');
    await row.getByRole('radio', { name: 'On' }).click();
    await expect(row.getByRole('radio', { name: 'On' })).toHaveAttribute('aria-checked', 'true');
    expect((await status(ctx)).on).toBe(true);
    await row.getByRole('radio', { name: 'Off' }).click();
    await expect(row.getByRole('radio', { name: 'Off' })).toHaveAttribute('aria-checked', 'true');
    expect((await status(ctx)).on).toBe(false);
  } finally { await ctx.close(); }
});
