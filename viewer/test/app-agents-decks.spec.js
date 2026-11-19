'use strict';

// Finished-agent decks on the Agents page (Spec §3-§6), with /api/agents mocked, at phone and desktop width.
const { test, expect } = require('@playwright/test');
const { closeViews, openPage, setupViews } = require('./helpers/app-views-setup.js');

const VIEWPORTS = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
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

    test('deck title is one ellipsized line with the full text in the tooltip and name', async ({ page }) => {
      const rounds = { review: { 1: { found: 2 }, 2: { found: 0, clean: true } } };
      await open(page, () => lead(Array.from({ length: 20 }, (_, i) => reviewer(i % 2 + 1, i)), rounds));
      const deck = page.locator('.agents-deck'), title = deck.locator('.agents-box-title');
      const full = await title.textContent();
      await expect(title).toHaveAttribute('title', full);
      await expect(deck).toHaveAttribute('aria-label', new RegExp(full));
      const m = await title.evaluate(t => { const cs = getComputedStyle(t), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3; return { h: t.getBoundingClientRect().height, lh, ws: cs.whiteSpace, to: cs.textOverflow }; });
      expect(m.ws).toBe('nowrap'); expect(m.to).toBe('ellipsis'); expect(m.h).toBeLessThan(m.lh * 1.9);
      const ordinary = await page.locator('.agents-box:not(.agents-deck) .agents-box-title').first().evaluate(t => getComputedStyle(t).whiteSpace);
      expect(ordinary).not.toBe('nowrap');
    });

    test('deck face is opaque and the two outlines sit offset down and right behind it', async ({ page }) => {
      await open(page, () => lead([reviewer(1), reviewer(2)]));
      const r = await page.locator('.agents-deck').evaluate(d => {
        const alpha = c => { const m = c.match(/rgba?\(([^)]+)\)/)[1].split(',').map(Number); return m.length === 4 ? m[3] : 1; };
        const t = e => { const m = getComputedStyle(d, e).transform.match(/matrix\(([^)]+)\)/)[1].split(',').map(Number); return [m[4], m[5]]; };
        return { alpha: alpha(getComputedStyle(d).backgroundColor), before: t('::before'), after: t('::after'), z: [getComputedStyle(d, '::before').zIndex, getComputedStyle(d, '::after').zIndex] };
      });
      expect(r.alpha).toBe(1);
      for (const o of [r.before, r.after]) { expect(o[0]).toBeGreaterThan(0); expect(o[1]).toBeGreaterThan(0); }
      expect(r.z.every(z => Number(z) < 0)).toBe(true);
    });

    test('popover stays inside the viewport for a deck near the bottom', async ({ page }) => {
      const rounds = { review: Object.fromEntries([1, 2, 3, 4, 5].map(r => [r, { found: 1 }])) };
      await open(page, () => lead([1, 2, 3, 4, 5].flatMap(r => [reviewer(r, 0), reviewer(r, 1)]), rounds));
      await page.addStyleTag({ content: '.agents-count { margin-bottom: 1600px !important; }' });
      const deck = page.locator('.agents-deck');
      await deck.evaluate(d => d.scrollIntoView({ block: 'end' }));
      await deck.click();
      const pop = page.locator('.deck-pop'); await expect(pop).toHaveCount(1);
      const inside = async () => { const b = await pop.boundingBox(); expect(b.x).toBeGreaterThanOrEqual(8 - 0.5); expect(b.y).toBeGreaterThanOrEqual(8 - 0.5); expect(b.x + b.width).toBeLessThanOrEqual(viewport.width - 8 + 0.5); expect(b.y + b.height).toBeLessThanOrEqual(viewport.height - 8 + 0.5); };
      await inside();
      await pop.locator('.deck-round-btn').first().click(); await inside();
    });

    test('page scroll and an open popover survive a refresh with no agent selected', async ({ page }) => {
      test.skip(label !== 'phone');
      const rounds = { review: Object.fromEntries(Array.from({ length: 40 }, (_, i) => [i + 1, { found: 1 }])) };
      const workers = Array.from({ length: 12 }, (_, i) => node('lw' + i, 'worker', i, { live: true, state: 'working' }));
      await open(page, () => lead([...workers, ...Array.from({ length: 40 }, (_, i) => reviewer(i + 1, 0))], rounds));
      await page.locator('.agents-deck').evaluate(d => d.scrollIntoView({ block: 'center' }));
      const scrollBefore = await page.evaluate(() => scrollY);
      expect(scrollBefore).toBeGreaterThan(0);
      await page.locator('.agents-deck').click();
      const pop = page.locator('.deck-pop'); await expect(pop).toHaveCount(1);
      const topBefore = (await pop.boundingBox()).y;
      await page.waitForTimeout(5500);
      await expect(pop).toHaveCount(1);
      expect(Math.abs(await page.evaluate(() => scrollY) - scrollBefore)).toBeLessThanOrEqual(2);
      const b = await pop.boundingBox();
      expect(b.x).toBeGreaterThanOrEqual(8 - 0.5); expect(b.y).toBeGreaterThanOrEqual(8 - 0.5); expect(b.x + b.width).toBeLessThanOrEqual(viewport.width - 8 + 0.5); expect(b.y + b.height).toBeLessThanOrEqual(viewport.height - 8 + 0.5);
      expect(Math.abs(b.y - topBefore)).toBeLessThanOrEqual(2);
    });

    test('popover scrolls, keeps its scroll across a poll, and a bottom row is clickable', async ({ page }) => {
      const rounds = { review: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, { found: 1 }])) };
      await open(page, () => lead(Array.from({ length: 20 }, (_, i) => reviewer(i + 1, 0)), rounds));
      await page.locator('.agents-deck').click();
      const pop = page.locator('.deck-pop');
      await pop.getByRole('button', { name: 'Show all 20 rounds' }).click();
      expect(await pop.evaluate(p => p.scrollHeight > p.clientHeight)).toBe(true);
      const b = await pop.boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.wheel(0, 300);
      await expect.poll(() => pop.evaluate(p => p.scrollTop)).toBeGreaterThan(0);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      expect(await pop.evaluate(p => p.scrollTop)).toBeGreaterThan(0);
      await page.waitForTimeout(5500);
      await expect(pop).toBeVisible();
      expect(await pop.evaluate(p => p.scrollTop)).toBeGreaterThan(0);
      await pop.evaluate(p => { p.scrollTop = p.scrollHeight; });
      await pop.locator('.deck-round-btn[data-round="1"]').click();
      await expect(pop.locator('.deck-agent')).toHaveCount(1);
    });

    test('stacked outlines are painted outside the deck edge', async ({ page }) => {
      await open(page, () => lead([reviewer(1), reviewer(2)]));
      const r = await page.locator('.agents-deck').boundingBox();
      const shot = (x, y) => page.screenshot({ clip: { x, y, width: 4, height: 4 } });
      const outline = await shot(r.x + r.width + 7, r.y + 30);
      const empty = await shot(r.x + r.width + 7, r.y - 8);
      expect(outline.equals(empty)).toBe(false);
    });

    test('desktop deck title is not truncated for the full example', async ({ page }) => {
      test.skip(label !== 'desktop');
      const rounds = { review: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, i === 19 ? { found: 0, clean: true } : { found: 1 }])) };
      await open(page, () => lead(Array.from({ length: 20 }, (_, i) => reviewer(i + 1, 0)), rounds));
      const title = page.locator('.agents-deck .agents-box-title');
      await expect(title).toHaveText('Plan review · 20 rounds, last round clean');
      expect(await title.evaluate(t => t.scrollWidth <= t.clientWidth)).toBe(true);
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

    test('desktop deck card is centred on its branch and sits on the outgoing connector', async ({ page }) => {
      test.skip(label !== 'desktop');
      await open(page, () => lead([
        node('sl1', 'sub-lead', 1, { children: [node('wa', 'worker', 2), node('wb', 'worker', 3)] }),
        node('sl2', 'sub-lead', 5, { children: [node('wc', 'worker', 6)] }),
      ]));
      const deck = page.locator('.agents-deck').filter({ hasText: 'sub-lead' });
      await expect(deck).toHaveCount(1);
      const box = await deck.boundingBox();
      const branch = await deck.locator('xpath=..').boundingBox();
      expect(Math.abs(box.x - branch.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(box.x + box.width - (branch.x + branch.width))).toBeLessThanOrEqual(0.5);
      const kids = await deck.locator('xpath=following-sibling::div[contains(@class,"agents-children")][1]').boundingBox();
      const marginTop = await deck.locator('xpath=following-sibling::div[contains(@class,"agents-children")][1]').evaluate(e => parseFloat(getComputedStyle(e).marginTop));
      expect(marginTop).toBe(30);
      expect(Math.abs(box.y + box.height - (kids.y - marginTop))).toBeLessThanOrEqual(0.5);
    });

    test('finish time comes only from finished_at, so an ended_at-only member reads plain Finished', async ({ page }) => {
      await open(page, () => lead([
        node('wy', 'worker', 6),
        node('wx', 'worker', 8, { finished_at: undefined, ended_at: at(9) }),
      ]));
      await page.locator('.agents-deck').click();
      const pop = page.locator('.deck-pop');
      await expect(pop.locator('[data-agent="wx"] .agents-muted')).toHaveText('Finished');
      await expect(pop.locator('[data-agent="wy"] .agents-muted')).toHaveText(/^Finished \d\d:\d\d$/);
    });

    test.describe('popover invariant across a refresh', () => {
      // Phone stacks children, so 12 live workers scroll the page. Desktop lays them out side by side, so a spacer above the layout stands in for the extra height.
      const W = 12, spacer = async (page, px) => { if (label === 'phone') return; await page.evaluate(h => { document.documentElement.style.overflowAnchor = 'none'; let d = document.getElementById('test-spacer'); if (!d) { d = document.createElement('div'); d.id = 'test-spacer'; document.body.prepend(d); } d.style.height = `${h}px`; }, px); };
      const base = () => Array.from({ length: 40 }, (_, i) => reviewer(i + 1, 0));
      const roundsOf = n => ({ review: Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, { found: 1 }])) });
      const workers = (n, from = 0) => Array.from({ length: n }, (_, i) => node(`lw-${from + i}`, 'worker', -100 + from + i, { live: true, state: 'working' }));
      const raf2 = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const scenario = (title, { before = [], expand = false, scrolled = false, change }) => test(title, async ({ page }) => {
        const state = { members: [...before, ...base()], rounds: roundsOf(40) };
        await open(page, () => lead(state.members, state.rounds));
        const deck = page.locator('.agents-deck').filter({ hasText: 'reviewer' });
        if (before.length) await spacer(page, 1000);
        await deck.evaluate(d => d.scrollIntoView({ block: 'center' }));
        await deck.click();
        const pop = page.locator('.deck-pop');
        await pop.getByRole('button', { name: 'Show all 40 rounds' }).click();
        if (expand) await pop.locator('[data-round="40"]').click();
        await pop.evaluate(e => { e.scrollTop = 250; });
        const want = await pop.evaluate(e => e.scrollTop);
        expect(want).toBeGreaterThan(0);
        if (scrolled) expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
        if (change) {
          change(state); await spacer(page, 3000);
        }
        await page.waitForResponse(r => r.url().includes('/api/agents'), { timeout: 8000 });
        await raf2(page);
        if (change) {
          const vh = page.viewportSize().height;
          await expect.poll(async () => { const d = await deck.boundingBox(); return !!d && (d.y > vh || d.y + d.height > vh); }).toBe(true);
        }
        await expect(pop).toHaveCount(1);
        const b = await pop.boundingBox(), vp = page.viewportSize();
        expect(b.x).toBeGreaterThanOrEqual(8 - 0.5); expect(b.y).toBeGreaterThanOrEqual(8 - 0.5);
        expect(b.x + b.width).toBeLessThanOrEqual(vp.width - 8 + 0.5); expect(b.y + b.height).toBeLessThanOrEqual(vp.height - 8 + 0.5);
        expect(Math.abs(await pop.evaluate(e => e.scrollTop) - want)).toBeLessThanOrEqual(2);
      });
      scenario('deck on screen, page not scrolled', {});
      scenario('page scrolled', { before: workers(W), scrolled: true });
      scenario('deck pushed off screen by a new finished member', {
        before: workers(W), scrolled: true,
        change: s => { s.members = [...workers(W, W), ...s.members, reviewer(41, 0)]; s.rounds = roundsOf(41); },
      });
      scenario('expanded round, long popover', { expand: true });
    });
  });
}
