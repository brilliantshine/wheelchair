'use strict';

// The assistant pop-up (viewer/pages/assistant-popup.js) against the real hub behind a real
// viewer server: the button's presence, the sheet and side panel, sending, "thinking…", the
// unread dot and the off state.
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

const OLD = '2026-01-01T10:00:00.000Z';
const NEW = '2026-01-01T11:00:00.000Z';

test.describe('assistant pop-up', () => {
  let ctx;
  test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
  test.afterEach(async () => { await ctx.close(); });

  const setting = (page, assistant) => page.evaluate(async (value) => {
    const res = await fetch('/wheelchair/api/settings/preferences', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assistant: value }) });
    if (!res.ok) throw new Error('preferences ' + res.status);
  }, assistant);
  const status = (page) => page.evaluate(async () => (await fetch('/wheelchair/api/assistant')).json());
  async function turnOn(page) {
    await setting(page, 'on');
    const s = await status(page);
    expect(s.on).toBe(true);
    return s.thread;
  }
  const projectPage = async (page) => {
    const made = await ctx.make({ cli: 'claude' });
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
  };
    // A reply only shows after a human line, so each seed starts with one (older than the replies).
  const seedAssistant = async (id, lines) => {
    await ctx.timedTranscript(id, [['human', 'hello', '2025-12-31T00:00:00.000Z'], ...lines]);
  };

  test('button shows on a project thread page, not on the assistant thread page; off adds nothing', async ({ page }) => {
    const id = await turnOn(page);
    await projectPage(page);
    await expect(page.locator('.wc-asst-float')).toBeVisible();
    await page.goto(`${ctx.server.url}/app/thread?id=${id}`);
    await expect(page.locator('#app-nav')).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.locator('.wc-asst-float')).toHaveCount(0);
    await page.goto(`${ctx.server.url}/app/threads`);
    await expect(page.locator('.wc-asst-float')).toBeVisible();
    await setting(page, 'off');
    await page.goto(`${ctx.server.url}/app/agents`);
    await expect(page.locator('#app-nav .seg')).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.locator('.wc-asst-float, .wc-asst-panel')).toHaveCount(0);
  });

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });
    test('opens as a sheet covering nearly the screen, with a close control', async ({ page }) => {
      const id = await turnOn(page);
      await seedAssistant(id, [['assistant', 'Hello from the assistant', OLD]]);
      await page.goto(`${ctx.server.url}/app/threads`);
      await page.locator('.wc-asst-float').click();
      const panel = page.locator('.wc-asst-panel');
      await expect(panel).toBeVisible();
      await expect(panel).toContainText('Hello from the assistant');
      const box = await panel.boundingBox();
      expect(box.width).toBeGreaterThan(390 - 24);
      expect(box.height).toBeGreaterThan(844 - 40);
      await expect(page.locator('.wc-asst-shade')).toBeVisible();
      await expect(page.getByRole('link', { name: /Open thread/ })).toHaveAttribute('href', `/wheelchair/app/thread?id=${id}`);
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(panel).toBeHidden();
      await expect(page.locator('.wc-asst-float')).toBeVisible();
    });
  });

  test.describe('desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('opens as a side panel and sends text to the assistant thread', async ({ page }) => {
      const id = await turnOn(page);
      await seedAssistant(id, [['assistant', 'Hello from the assistant', OLD]]);
      await page.goto(`${ctx.server.url}/app/threads`);
      await page.locator('.wc-asst-float').click();
      const panel = page.locator('.wc-asst-panel');
      const box = await panel.boundingBox();
      expect(box.width).toBeLessThan(500);
      expect(box.x + box.width).toBeGreaterThan(1280 - 40);
      await expect(page.locator('.wc-asst-shade')).toBeHidden();
      const sent = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith(`/api/threads/${id}/messages`));
      await page.getByRole('textbox', { name: 'Message the assistant' }).fill('where do things stand?');
      await page.getByRole('button', { name: 'Send' }).click();
      expect((await sent).postDataJSON()).toEqual({ text: 'where do things stand?' });
      await expect(panel.locator('.wc-asst-human', { hasText: 'where do things stand?' })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Message the assistant' })).toHaveValue('');
    });

    test('shows thinking while the lead is mid-turn and not after', async ({ page }) => {
      const id = await turnOn(page);
      await seedAssistant(id, [['assistant', 'Hi', OLD]]);
      await ctx.patch(id, (t) => { Object.assign(t.sessions[0], { live: true, ready: true, turn_ended: true }); });
      await page.goto(`${ctx.server.url}/app/threads`);
      await page.locator('.wc-asst-float').click();
      await expect(page.locator('.wc-asst-panel')).toContainText('Hi');
      await expect(page.locator('.wc-asst-work')).toHaveCount(0);
      await ctx.patch(id, (t) => { t.sessions[0].turn_ended = false; });
      await expect(page.locator('.wc-asst-work')).toContainText('thinking');
      await ctx.patch(id, (t) => { t.sessions[0].turn_ended = true; });
      await expect(page.locator('.wc-asst-work')).toHaveCount(0);
    });

    test('unread dot appears for a newer item and clears on open', async ({ page }) => {
      const id = await turnOn(page);
      await seedAssistant(id, [['assistant', 'Old news', OLD], ['assistant', 'Newer news', NEW]]);
      await page.goto(`${ctx.server.url}/app/threads`);
      await page.evaluate((at) => localStorage.setItem('wc-assistant-seen', at), OLD);
      await page.reload();
      await expect(page.locator('.wc-asst-unread')).toBeVisible();
      await page.locator('.wc-asst-float').click();
      await expect(page.locator('.wc-asst-panel')).toContainText('Newer news');
      expect(await page.evaluate(() => localStorage.getItem('wc-assistant-seen'))).toBe(NEW);
      await page.getByRole('button', { name: 'Close' }).click();
      await expect(page.locator('.wc-asst-unread')).toBeHidden();
      await page.reload();
      await expect(page.locator('.wc-asst-float')).toBeVisible();
      await page.waitForTimeout(1500);
      await expect(page.locator('.wc-asst-unread')).toBeHidden();
    });

    test('says the assistant is not running and offers Restart', async ({ page }) => {
      const id = await turnOn(page);
      await seedAssistant(id, [['assistant', 'Hi', OLD]]);
      await ctx.patch(id, (t) => { t.sessions[0].live = false; });
      await page.goto(`${ctx.server.url}/app/threads`);
      await page.locator('.wc-asst-float').click();
      await expect(page.locator('.wc-asst-stopped')).toContainText("The assistant isn't running");
      await expect(page.getByRole('button', { name: 'Restart' })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Message the assistant' })).toBeDisabled();
    });
  });
});
