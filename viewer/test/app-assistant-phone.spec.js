'use strict';

const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

const line = (type, text, minute) => [type, text, new Date(Date.UTC(2026, 0, 1, 0, minute)).toISOString()];
const setting = (page, assistant) => page.evaluate(async (value) => {
  const res = await fetch('/wheelchair/api/settings/preferences', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ assistant: value }) });
  if (!res.ok) throw new Error('preferences ' + res.status);
}, assistant);

async function clearConversation(page) {
  await page.locator('#chat').evaluate((chat) => {
    let el = chat;
    while (el) { el.scrollTop = el.scrollHeight; el = el.parentElement; }
    window.scrollTo(0, document.body.scrollHeight);
  });
  await expect.poll(() => page.evaluate(() => {
    const button = document.querySelector('.wc-asst-float').getBoundingClientRect();
    const overlaps = (r) => r.width > 0 && r.height > 0 && r.left < button.right && r.right > button.left && r.top < button.bottom && r.bottom > button.top;
    return [...document.querySelectorAll('#chat *'), document.querySelector('#composer')]
      .filter((el) => overlaps(el.getBoundingClientRect())).map((el) => el.outerHTML.slice(0, 120));
  })).toEqual([]);
}

test.describe('assistant phone spacing', () => {
  let ctx;
  test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
  test.afterEach(async () => { await ctx.close(); });

  for (const [name, count] of [['one', 1], ['thirty', 30]]) {
    test(`${name} messages and a later lead reply clear the button`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await setting(page, 'on');
      const thread = await ctx.make({ cli: 'claude' });
      const lines = Array.from({ length: count }, (_, i) => line('human', i === 0 ? 'Go ahead' : `Message ${i}`, i));
      await ctx.timedTranscript(thread.id, lines);
      await page.goto(`${ctx.server.url}/app/thread?id=${thread.id}`);
      await expect(page.locator('#chat')).toContainText(count === 1 ? 'Go ahead' : 'Message 29');
      await expect(page.locator('.wc-asst-float')).toBeVisible();
      await clearConversation(page);
      if (count === 1) {
        await ctx.timedTranscript(thread.id, [...lines, line('assistant', 'Lead reply arrived', 31)]);
        await expect(page.locator('#chat')).toContainText('Lead reply arrived', { timeout: 15000 });
        await clearConversation(page);
      }
    });
  }

  for (const [name, width, height] of [['phone', 390, 844], ['desktop', 1280, 800]]) {
    test(`${name} padding changes only on phone with the assistant on`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const thread = await ctx.make({ cli: 'claude' });
      await ctx.timedTranscript(thread.id, [line('human', 'Go ahead', 0)]);
      await page.goto(`${ctx.server.url}/app/thread?id=${thread.id}`);
      await expect(page.locator('#chat')).toContainText('Go ahead');
      const off = await page.locator('#chat').evaluate((el) => getComputedStyle(el).paddingBottom);
      await setting(page, 'on');
      await page.reload();
      await expect(page.locator('.wc-asst-float')).toBeVisible();
      const on = await page.locator('#chat').evaluate((el) => getComputedStyle(el).paddingBottom);
      if (name === 'phone') expect(parseFloat(on)).toBeGreaterThan(parseFloat(off));
      else expect(on).toBe(off);
      await setting(page, 'off');
      await page.reload();
      await expect(page.locator('#chat')).toContainText('Go ahead');
      expect(await page.locator('#chat').evaluate((el) => getComputedStyle(el).paddingBottom)).toBe(off);
    });
  }
});

test('jump to latest remains clickable above a long thread', async ({ page }) => {
  const ctx = await startWorld();
  try {
    await signIn(page, ctx); await page.setViewportSize({ width: 390, height: 844 });
    await setting(page, 'on');
    const thread = await ctx.make({ cli: 'claude' });
    await ctx.timedTranscript(thread.id, Array.from({ length: 80 }, (_, i) => line('human', `Message ${i}`, i)));
    await page.goto(`${ctx.server.url}/app/thread?id=${thread.id}`);
    await expect(page.locator('#chat')).toContainText('Message 79');
    await page.evaluate(() => window.scrollTo(0, 0));
    const jump = page.locator('#jump-bottom');
    await expect(jump).toBeVisible();
    await expect.poll(() => jump.evaluate((j) => {
      const a = j.getBoundingClientRect(), b = document.querySelector('.wc-asst-float').getBoundingClientRect();
      return document.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2)?.closest('button') === j && (b.bottom <= a.top || b.top >= a.bottom || b.right <= a.left || b.left >= a.right);
    })).toBe(true);
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/r7-jump.png` });
    await jump.click();
    await expect(jump).toBeHidden();
    await clearConversation(page);
  } finally { await ctx.close(); }
});
