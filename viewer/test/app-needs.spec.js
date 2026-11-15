'use strict';

// A lead's needs card is answered from the thread page with Keep going or Talk about it;
// the hub's own needs cards get neither.
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

test.describe('needs cards', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  let ctx;
  test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
  test.afterEach(async () => { await ctx.close(); });

  test('Keep going shows on a lead needs card, not on a system one, and closes it', async ({ page }) => {
    const made = await ctx.make({ cli: 'claude' });
    await ctx.post(made.id, { kind: 'needs', title: 'Lead card', body: 'Please look at this.' });
    await ctx.patch(made.id, (t) => {
      t.cards.push({
        id: 'system-needs', kind: 'needs', title: 'Permission needed', body: 'A prompt is open.',
        session: t.sessions[0].name, at: new Date().toISOString(), answered: false, system: true,
      });
    });
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    const lead = page.locator('.card-needs', { hasText: 'Lead card' });
    const system = page.locator('.card-needs', { hasText: 'Permission needed' });
    await expect(lead.getByRole('button', { name: 'Keep going' })).toBeVisible();
    await expect(lead.getByRole('button', { name: 'Talk about it' })).toBeVisible();
    await expect(lead.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
    await expect(system).toBeVisible();
    await expect(system.getByRole('button', { name: 'Keep going' })).toHaveCount(0);
    await lead.getByRole('button', { name: 'Keep going' }).click();
    await expect(lead).toHaveClass(/is-answered/);
    await expect(lead.locator('.answered-tag')).toContainText('Keep going');
    await expect(lead.getByRole('button', { name: 'Keep going' })).toHaveCount(0);
    await expect(system.locator('.is-answered')).toHaveCount(0);
  });
});
