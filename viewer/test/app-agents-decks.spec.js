'use strict';

// Finished-agent decks on the Agents page (Spec §3-§6), with /api/agents mocked, at phone and desktop width.
const { test, expect } = require('@playwright/test');
const { closeViews, openPage, setupViews } = require('./helpers/app-views-setup.js');

const VIEWPORTS = { phone: { width: 360, height: 844 }, desktop: { width: 1280, height: 800 } };
let context;
test.beforeAll(async () => { context = await setupViews(); });
test.afterAll(async () => { await closeViews(context); });

const at = i => new Date(Date.UTC(2026, 10, 18, 9, i)).toISOString();
const node = (name, role, i, extra = {}) => ({ name, role, display_title: `${role} ${name}`, live: false, state: 'finished', created_at: at(i), finished_at: at(i + 1), children: [], ...extra });
const reviewer = (r, k = 0, extra = {}) => node(`rev-${r}-${k}`, 'reviewer', r * 2 + k, { round: r, ...extra });
const lead = (children, rounds = { review: {} }) => ({ thread_id: 'a', thread_title: 'A thread', lead_name: 'Alpha', project: 'p', stage: 'review', counts: { total: children.length + 1 }, rounds, asides: [], session: { name: 'lead-a', role: 'lead', display_title: 'Lead', live: true, state: 'working', created_at: at(0), children } });

for (const [label, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(label, () => {
    test.use({ viewport });
    const serve = async (page, getLead) => { await page.route('**/api/agents', route => route.fulfill({ json: { leads: [getLead()], machines: [] } })); };
    const open = async (page, getLead, tail = '') => { await serve(page, getLead); await openPage(page, context, `/app/agents?lead=a${tail}`); await page.getByRole('button', { name: /Show \d+ finished/ }).click(); };

    test('reviewers, workers, verifiers and live agents', async ({ page }) => {
      const rounds = { review: { 1: { found: 6 }, 2: { found: 3 }, 3: { found: 0, clean: true } } };
      await open(page, () => lead([
        reviewer(1, 0, { report: { findings: 6, first: 'x' } }), reviewer(2), reviewer(3),
        node('w1', 'worker', 20), node('v1', 'verifier', 30), node('v2', 'verifier', 32),
        node('live-r', 'reviewer', 40, { live: true, state: 'working', round: 4 }),
      ], rounds));
      const deck = page.locator('.agents-deck').filter({ hasText: 'reviewer' });
      await expect(deck).toHaveCount(1);
      await expect(deck).toContainText('×3');
      await expect(deck).toContainText('Plan review · 3 rounds, last round clean');
      await expect(deck).toContainText(/Finished \d\d:\d\d/);
      const colors = await deck.locator('.agents-sq').evaluateAll(n => n.map(q => getComputedStyle(q).backgroundColor));
      expect(colors).toEqual(['rgb(217, 100, 90)', 'rgb(224, 144, 74)', 'rgb(78, 168, 123)']);
      await expect(deck.locator('.agents-squares')).toHaveAttribute('aria-label', '3 rounds; objections went from 6 to 0');
      await expect(page.locator('.agents-deck')).toHaveCount(2);
      const vdeck = page.locator('.agents-deck').filter({ hasText: 'verifier' });
      await expect(vdeck).toContainText('×2'); await expect(vdeck.locator('.agents-sq')).toHaveCount(0);
      await expect(page.locator('[data-session="w1"]')).not.toHaveClass(/agents-deck/);
      await expect(page.locator('[data-session="live-r"]')).not.toHaveClass(/agents-deck/);
    });

    test('Hide finished agents on shows no decks', async ({ page }) => {
      await serve(page, () => lead([reviewer(1), reviewer(2)]));
      await openPage(page, context, '/app/agents?lead=a');
      await expect(page.locator('.agents-deck')).toHaveCount(0);
      await expect(page.locator('.agents-box')).toHaveCount(1);
    });

    test('popover lists rounds newest first, selects an agent, and Show all expands', async ({ page }) => {
      const rounds = { review: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(r => [r, { found: r === 7 ? 1 : 2 }])) };
      await open(page, () => lead([1, 2, 3, 4, 5, 6, 7].flatMap(r => [reviewer(r, 0, { report: { findings: 1, first: 'bad thing' } }), reviewer(r, 1)]), rounds));
      await page.locator('.agents-deck').click();
      const pop = page.locator('.deck-pop');
      await expect(pop.locator('.deck-round-name')).toHaveText(['Round 7', 'Round 6', 'Round 5', 'Round 4', 'Round 3']);
      await expect(pop.locator('.deck-round-text').first()).toHaveText('2 reviewers · 1 objection: bad thing');
      await pop.getByRole('button', { name: 'Show all 7 rounds' }).click();
      await expect(pop.locator('.deck-round-name')).toHaveCount(7);
      const box = await pop.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      await pop.locator('[data-round="7"]').click();
      await pop.locator('[data-agent="rev-7-1"]').click();
      await expect(page).toHaveURL(/agent=rev-7-1/);
      await expect(page.locator('.agents-side h2')).toHaveText('reviewer rev-7-1');
      await expect(page.locator('.deck-pop')).toHaveCount(0);
    });

    test('closes on Escape, outside click and deck click; one at a time', async ({ page }) => {
      await open(page, () => lead([node('w1', 'worker', 1), node('w2', 'worker', 3), reviewer(1), reviewer(2)]));
      const decks = page.locator('.agents-deck');
      await decks.nth(0).click(); await expect(page.locator('.deck-pop')).toHaveCount(1);
      await decks.nth(1).dispatchEvent('click'); await expect(page.locator('.deck-pop')).toHaveCount(1);
      await page.keyboard.press('Escape'); await expect(page.locator('.deck-pop')).toHaveCount(0);
      await decks.nth(0).click(); await expect(page.locator('.deck-pop')).toHaveCount(1);
      await decks.nth(0).click(); await expect(page.locator('.deck-pop')).toHaveCount(0);
      await decks.nth(0).click(); await page.locator('.agents-heading h2').click(); await expect(page.locator('.deck-pop')).toHaveCount(0);
    });

    test('? popout opens and closes', async ({ page }) => {
      await open(page, () => lead([reviewer(1), reviewer(2)]));
      const info = page.locator('.agents-info');
      await expect(info).toBeHidden();
      await page.getByRole('button', { name: 'How to read this tree' }).click();
      await expect(info).toBeVisible(); await expect(info).toContainText('Going in circles');
      await page.keyboard.press('Escape'); await expect(info).toBeHidden();
      await page.getByRole('button', { name: 'How to read this tree' }).click(); await expect(info).toBeVisible();
      await info.getByRole('button', { name: 'Close' }).click(); await expect(info).toBeHidden();
    });

    test('a poll adding a member keeps the popover and round open', async ({ page }) => {
      let members = [reviewer(1, 0), reviewer(1, 1), reviewer(2, 0)];
      const rounds = { review: { 1: { found: 2 }, 2: { found: 0 } } };
      await open(page, () => lead(members, rounds));
      await page.locator('.agents-deck').click();
      await page.locator('[data-round="1"]').click();
      await expect(page.locator('.deck-agent')).toHaveCount(2);
      members = [...members, reviewer(1, 2)];
      await page.waitForResponse(r => r.url().includes('/api/agents'), { timeout: 8000 });
      await expect(page.locator('.deck-agent')).toHaveCount(3, { timeout: 8000 });
      await expect(page.locator('.deck-pop')).toHaveCount(1);
      await expect(page.locator('.agents-deck')).toContainText('×4');
    });

    test('decked sub-leads share one deck of workers', async ({ page }) => {
      await open(page, () => lead([
        node('sl1', 'sub-lead', 1, { children: [node('wa', 'worker', 2), node('wb', 'worker', 3)] }),
        node('sl2', 'sub-lead', 5, { children: [node('wc', 'worker', 6)] }),
      ]));
      const decks = page.locator('.agents-deck');
      await expect(decks).toHaveCount(2);
      await expect(decks.filter({ hasText: 'sub-lead' })).toContainText('×2');
      await expect(decks.filter({ hasText: 'worker' })).toContainText('×3');
    });
  });
}
