'use strict';

// Features, Sessions and Terminal pages against a real server (Spec "Views"), at phone and
// desktop width. Server and fake machine services come from helpers/app-views-setup.js.
const { test, expect } = require('@playwright/test');
const { closeViews, openPage, setupViews } = require('./helpers/app-views-setup.js');

const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
};

let context;
test.beforeAll(async () => { context = await setupViews(); });
test.afterAll(async () => { await closeViews(context); });

for (const [label, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(label, () => {
    test.use({ viewport });

    async function noSideScroll(page) {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    }

    test('features are grouped by status', async ({ page }) => {
      await openPage(page, context, '/app/features');
      const expected = {
        idea: 'idea-one', planning: 'plan-one', review: 'review-one',
        building: 'build-one', verifying: 'verify-one', done: 'done-one',
      };
      for (const [stage, slug] of Object.entries(expected)) {
        const group = page.locator(`section[data-stage="${stage}"]`);
        await expect(group.locator('.feature')).toHaveCount(1);
        await expect(group).toContainText(slug);
        const link = group.locator('.feature a');
        const id = context.seed.made[slug].id;
        await expect(link).toHaveAttribute('href', `/wheelchair/app/thread?id=${id}`);
      }
      await noSideScroll(page);
    });

    test('the Needs you strip lists open cards with links to them', async ({ page }) => {
      await openPage(page, context, '/app/features');
      const strip = page.locator('#needs');
      await expect(strip).toBeVisible();
      await expect(strip.locator('.need')).toHaveCount(2);
      const { question, approval, made } = context.seed;
      const questionLink = strip.locator('.need[data-kind="question"] a');
      await expect(questionLink).toContainText('Who does a stuck worker ask?');
      await expect(questionLink).toHaveAttribute(
        'href', `/wheelchair/app/thread?id=${made['plan-one'].id}#card-${question.id}`);
      await expect(strip.locator('.need[data-kind="approval"] a')).toHaveAttribute(
        'href', `/wheelchair/app/thread?id=${made['review-one'].id}#card-${approval.id}`);
    });

    test('sessions are grouped by machine with attach commands', async ({ page }) => {
      await openPage(page, context, '/app/sessions');
      const hub = page.locator('section[data-machine="hub"]');
      const node = page.locator('section[data-machine="node-2"]');
      await expect(hub.locator('.session')).toHaveCount(5);
      await expect(node.locator('.session')).toHaveCount(1);
      const hubName = context.seed.made['plan-one'].sessions[0].name;
      const nodeName = context.seed.made['done-one'].sessions[0].name;
      await expect(hub.locator(`[data-session="${hubName}"] code`)).toHaveText(`tmux attach -t ${hubName}`);
      await expect(node.locator(`[data-session="${nodeName}"] code`))
        .toHaveText(`ssh node-2 -t tmux attach -t ${nodeName}`);
      await expect(hub.locator(`[data-session="${hubName}"] a`).first())
        .toHaveAttribute('href', `/wheelchair/app/terminal?name=${hubName}`);
      await expect(hub.locator(`[data-session="${hubName}"] .role`)).toHaveText('lead');
      await noSideScroll(page);
    });

    test('an unreachable machine is greyed and has no sessions', async ({ page }) => {
      await openPage(page, context, '/app/sessions');
      const dead = page.locator('section[data-machine="node-3"]');
      await expect(dead).toHaveClass(/unreachable/);
      await expect(dead).toContainText('unreachable');
      await expect(dead.locator('.seen')).toContainText('last seen');
      await expect(dead.locator('.session')).toHaveCount(0);
      await expect(page.locator('section[data-machine="hub"]')).not.toHaveClass(/unreachable/);
    });

    test('the terminal shows the pane and sends typed keys without an extra Enter', async ({ page }) => {
      const name = context.seed.made['build-one'].sessions[0].name;
      await openPage(page, context, `/app/terminal?name=${name}`);
      await expect(page.locator('.xterm-rows')).toContainText('fake pane');
      await noSideScroll(page);
      const before = context.hub.calls.filter((call) => call.path.endsWith('/keys')).length;
      await page.locator('.xterm').click();
      await page.keyboard.type('ls');
      await page.keyboard.press('Enter');
      await expect.poll(() => context.hub.calls.filter((call) => call.path.endsWith('/keys')).length)
        .toBe(before + 3);
      await page.waitForTimeout(700);
      const keys = context.hub.calls.filter((call) => call.path.endsWith('/keys')).slice(before);
      expect(keys.map((call) => call.body.keys)).toEqual(['l', 's', 'Enter']);
    });

    test('the key row sends Esc, Tab, Ctrl-C and arrows on a small screen', async ({ page }) => {
      test.skip(label !== 'phone', 'the key row is for touch and narrow screens');
      const name = context.seed.made['build-one'].sessions[0].name;
      await openPage(page, context, `/app/terminal?name=${name}`);
      const before = context.hub.calls.filter((call) => call.path.endsWith('/keys')).length;
      for (const label of ['Esc', 'Tab', 'Ctrl-C']) await page.getByRole('button', { name: label }).click();
      await page.getByRole('button', { name: 'Up' }).click();
      await expect.poll(() => context.hub.calls.filter((call) => call.path.endsWith('/keys')).length)
        .toBe(before + 4);
      const keys = context.hub.calls.filter((call) => call.path.endsWith('/keys')).slice(before);
      expect(keys.map((call) => call.body.keys)).toEqual(['Escape', 'Tab', 'C-c', 'Up']);
    });
  });
}
