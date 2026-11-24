'use strict';

// The permit card on the thread page (docs/plans/fix-others-prs, Spec section 1). Cards are seeded
// straight into the thread file, as app-reach.spec.js does.
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

const permit = (n, extra = {}) => ({
  id: `permit-${n}`, kind: 'permit', session: 'wc-x-lead', at: new Date().toISOString(), created_at: new Date().toISOString(),
  pr_url: 'https://github.com/o/r/pull/42', why: 'Fix the parser bug it reports.',
  pr_number: 42, pr_title: 'Fix parser crash', pr_author: 'alice', head_branch: 'alice/fix-parser', ...extra,
});

test.describe('permit card, phone', () => {
  test.use({ viewport: { width: 375, height: 800 } });
  let ctx;
  test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
  test.afterEach(async () => { await ctx.close(); });
  const seed = async (cards) => {
    const made = await ctx.make({ cli: 'claude' });
    await ctx.patch(made.id, (x) => { x.cards.push(...cards); });
    return made.id;
  };
  const open = (page, id) => page.goto(`${ctx.server.url}/app/thread?id=${id}`);

  test('an open card shows author, number, title and both buttons, and Allow shows it answered', async ({ page }) => {
    const id = await seed([permit(1)]);
    const bodies = [];
    await page.route('**/cards/permit-1/press', async (route) => {
      bodies.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await open(page, id);
    const card = page.locator('#card-permit-1');
    await expect(card.locator('h3')).toHaveText("Let this thread push its fix to alice's pull request #42: Fix parser crash?");
    await expect(card.locator('h3 strong')).toHaveText('alice');
    await expect(card).toContainText('Fix the parser bug it reports.');
    await expect(card).toContainText('alice/fix-parser');
    await expect(card.getByRole('button')).toHaveCount(2);
    await expect(card.getByRole('button', { name: "Don't allow" })).toBeEnabled();
    await expect(card.locator('.answered-tag')).toHaveCount(0);
    await card.getByRole('button', { name: 'Allow', exact: true }).click();
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0]).toEqual({ action: 'picked', value: 'allow' });
    await expect(card.locator('.answered-tag')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Allow', exact: true })).toBeDisabled();
  });

  test('answered, failed and withdrawn cards show their tag', async ({ page }) => {
    const done = { answered: true, answered_action: 'picked' };
    const id = await seed([
      permit(1, { ...done, answered_value: 'allow' }),
      permit(2, { ...done, answered_value: "don't allow" }),
      permit(3, { ...done, answered_value: 'allow', allow_failed: 'that branch belongs to the thread "x" on this hub' }),
    ]);
    await open(page, id);
    const tag = (n) => page.locator(`#card-permit-${n} .answered-tag`);
    await expect(tag(1)).toContainText('You picked Allow');
    await expect(tag(2)).toContainText("You picked Don't allow");
    await expect(tag(3)).toContainText('Allow failed: that branch belongs to the thread "x" on this hub');
    await expect(page.locator('#card-permit-3 button.picked')).toHaveCount(0);
    await expect(page.locator('#card-permit-1 button.picked')).toHaveText('Allow');
  });
});
