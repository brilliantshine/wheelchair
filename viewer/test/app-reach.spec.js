'use strict';

// The reach card on the thread page (docs/plans/lead-chat, Spec section 3): the text, the two
// buttons, the press body, and every answered state, at phone width. Cards are seeded straight
// into the thread file so this spec does not depend on the hub accepting the kind.
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

const reach = (n, extra = {}) => ({
  id: `reach-${n}`, kind: 'reach', session: 'wc-x-lead', at: new Date().toISOString(), created_at: new Date().toISOString(),
  thread: 'other-thread', why: 'It owns the API this change calls.',
  target_title: 'Other thread', target_project: '/home/u/projects/other-app',
  title: 'Let this lead talk to Other thread?', ...extra,
});

test.describe('reach card, phone', () => {
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

  test('an open card shows its text and both buttons, and Allow posts the pick', async ({ page }) => {
    const id = await seed([reach(1)]);
    const bodies = [];
    await page.route('**/cards/reach-1/press', async (route) => {
      bodies.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await open(page, id);
    const card = page.locator('#card-reach-1');
    await expect(card.locator('h3')).toHaveText("Let this thread's lead talk to the lead of Other thread (other-app)?");
    await expect(card.locator('h3 strong')).toHaveText('Other thread');
    await expect(card).toContainText('It owns the API this change calls.');
    await expect(card.getByRole('button')).toHaveCount(2);
    await expect(card.getByRole('button', { name: "Don't allow" })).toBeEnabled();
    if (process.env.REACH_SHOTS) await page.screenshot({ path: `${process.env.REACH_SHOTS}/reach-open.png` });
    await card.getByRole('button', { name: 'Allow', exact: true }).click();
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0]).toEqual({ action: 'picked', value: 'allow' });
  });

  test('Don\'t allow posts its own value', async ({ page }) => {
    const id = await seed([reach(1)]);
    const bodies = [];
    await page.route('**/cards/reach-1/press', async (route) => {
      bodies.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await open(page, id);
    await page.locator('#card-reach-1').getByRole('button', { name: "Don't allow" }).click();
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0]).toEqual({ action: 'picked', value: "don't allow" });
  });

  test('answered, failed and withdrawn cards show their tag with disabled buttons', async ({ page }) => {
    const done = { answered: true, answered_action: 'picked' };
    const id = await seed([
      reach(1, { ...done, answered_value: 'allow' }),
      reach(2, { ...done, answered_value: "don't allow" }),
      reach(3, { ...done, answered_value: 'allow', allow_failed: 'that thread has no lead' }),
      reach(4, { retracted_at: new Date().toISOString(), retracted_note: 'No longer needed' }),
    ]);
    await open(page, id);
    const tag = (n) => page.locator(`#card-reach-${n} .answered-tag`);
    await expect(tag(1)).toContainText('You picked Allow');
    await expect(tag(2)).toContainText("You picked Don't allow");
    await expect(tag(3)).toContainText('Allow failed: that thread has no lead');
    await expect(tag(4)).toContainText('Withdrawn · No longer needed');
    for (const n of [1, 2, 3, 4]) {
      const buttons = page.locator(`#card-reach-${n}`).getByRole('button');
      await expect(buttons).toHaveCount(2);
      await expect(buttons.first()).toBeDisabled();
      await expect(buttons.last()).toBeDisabled();
    }
    await expect(page.locator('#card-reach-1 button.picked')).toHaveText('Allow');
    await expect(page.locator('#card-reach-2 button.picked')).toHaveText("Don't allow");
    await expect(page.locator('#card-reach-3 button.picked')).toHaveCount(0);
    await page.locator('#card-reach-3').scrollIntoViewIfNeeded();
    if (process.env.REACH_SHOTS) await page.screenshot({ path: `${process.env.REACH_SHOTS}/reach-answered.png` });
  });
});
