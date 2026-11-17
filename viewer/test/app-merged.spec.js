'use strict';

const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

test.describe('merged card', () => {
  let ctx;
  test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
  test.afterEach(async () => { await ctx.close(); });

  test('links to the PR and confirms archive, preserving confirmation across a poll', async ({ page }) => {
    const made = await ctx.make({ cli: 'claude' });
    const url = 'https://github.com/example/repo/pull/42';
    await ctx.patch(made.id, (t) => t.cards.push({ id: 'merged-1', kind: 'merged', title: 'Pull request merged', pr_url: url, at: new Date().toISOString(), answered: false, system: true }));
    let archiveCalls = 0;
    await page.route('**/api/threads/*/archive', async (route) => { archiveCalls++; await route.fulfill({ json: {} }); });
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    const card = page.locator('.card-merged');
    await expect(card.getByRole('heading', { name: 'Pull request merged' })).toBeVisible();
    await expect(card.getByRole('link', { name: 'Review pull request' })).toHaveAttribute('href', url);
    await card.getByRole('button', { name: 'Archive', exact: true }).click();
    await expect(card.getByText('Stops its sessions and removes the worktree.')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Confirm archive' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await ctx.patch(made.id, (t) => { t.cards[0].title = 'Pull request merged again'; });
    await expect(card.getByRole('heading', { name: 'Pull request merged again' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Confirm archive' })).toBeVisible();
    await card.getByRole('button', { name: 'Cancel' }).click();
    await expect(card.getByRole('button', { name: 'Keep it' })).toBeVisible();
    await card.getByRole('button', { name: 'Archive', exact: true }).click();
    await card.getByRole('button', { name: 'Confirm archive' }).click();
    await expect.poll(() => archiveCalls).toBe(1);
  });

  test('Keep it sends keep and shows the resolved card', async ({ page }) => {
    const made = await ctx.make({ cli: 'claude' });
    await ctx.patch(made.id, (t) => t.cards.push({ id: 'merged-1', kind: 'merged', title: 'Pull request merged', pr_url: 'https://github.com/example/repo/pull/42', at: new Date().toISOString(), answered: false, system: true }));
    let action;
    await page.route('**/api/threads/*/cards/merged-1/press', async (route) => {
      action = route.request().postDataJSON().action;
      await ctx.patch(made.id, (t) => Object.assign(t.cards.find((c) => c.id === 'merged-1'), { answered: true, resolved_by: 'collin', resolved_note: 'Kept' }));
      await route.fulfill({ json: { queued: false } });
    });
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    const card = page.locator('.card-merged');
    await card.getByRole('button', { name: 'Keep it' }).click();
    await expect.poll(() => action).toBe('keep');
    await expect(card).toHaveClass(/is-answered/);
    await expect(card.locator('.answered-tag')).toContainText('Kept');
    await expect(card.getByRole('button')).toHaveCount(0);
  });
});
