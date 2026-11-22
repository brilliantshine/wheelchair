'use strict';

// "Talked with" lines (lead-chat-solid S5): a peer item in the chat is a line with a link to the
// other thread. peer_log is seeded on the thread file, so chat.js builds the items for real.
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

let ctx;
test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
test.afterEach(async () => { await ctx.close(); });

test('a peer item renders as a line with a link to the other thread', async ({ page }) => {
  const made = await ctx.make({ cli: 'claude' });
  await ctx.transcript(made.id);
  const entry = (at, direction) => ({ at, thread: 'other-1', title: 'Other <b>work</b>', session: 'wc-other-1-lead', direction, text: direction === 'limit' ? '' : 'SECRET' });
  await ctx.patch(made.id, (t) => { t.peer_log = [entry('2026-03-01T10:00:00Z', 'sent'), entry('2026-03-01T10:05:00Z', 'received'), { ...entry('2026-03-01T10:10:00Z', 'limit'), thread: 'other-2', title: 'Third' }]; });
  await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
  const lines = page.locator('#chat .ctx', { hasText: /Talked with|Message limit/ });
  await expect(lines).toHaveCount(2);
  await expect(lines.nth(0)).toHaveText('Talked with Other <b>work</b> · 2 messages');
  await expect(lines.nth(0).locator('a')).toHaveAttribute('href', '/wheelchair/app/thread?id=other-1');
  await expect(lines.nth(0).locator('b')).toHaveCount(0);
  await expect(lines.nth(1)).toHaveText('Message limit reached with Third');
  await expect(lines.nth(1).locator('a')).toHaveAttribute('href', '/wheelchair/app/thread?id=other-2');
  await expect(page.locator('#chat')).not.toContainText('SECRET');
  // One message reads "1 message".
  await ctx.patch(made.id, (t) => { t.peer_log = [entry('2026-03-01T10:00:00Z', 'sent')]; });
  await page.reload();
  await expect(page.locator('#chat .ctx', { hasText: 'Talked with' })).toHaveText('Talked with Other <b>work</b> · 1 message');
});
