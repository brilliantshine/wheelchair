'use strict';
// The thread chat updates in place (mockup-polish T1): mockups never reload, the reader keeps
// their place, mockup boxes have their height up front, and image links open the picture page.
const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
let ctx;
test.use({ viewport: { width: 390, height: 844 } });
test.beforeEach(async ({ page }) => { ctx = await startWorld(); ctx.machine.uploadsDir = path.join(ctx.state, 'uploads'); await signIn(page, ctx); });
test.afterEach(async () => { await ctx.close(); });

async function seed() {
  const made = await ctx.make({ cli: 'claude' });
  const worktree = path.join(ctx.state, 'worktree');
  const dir = path.join(worktree, 'docs/plans/dark/graphs'); await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'home.html'), '<body style="margin:0;background:#def"><h1 id="proof" style="margin:0">Mockup home</h1></body>');
  await ctx.patch(made.id, (t) => { t.worktree = worktree; t.slug = 'dark'; });
  return made;
}
const mockupCard = (made, title, at) => ctx.post(made.id, { kind: 'diagram', plan: 'dark', graph: 'home', title, format: 'mockup', width: 390, height: 844 })
  .then((card) => ctx.patch(made.id, (t) => { const c = t.cards.find((x) => x.id === card.id); c.at = at; c.created_at = at; return card; }).then(() => card));
const needs = (id, title, at) => ({ id, kind: 'needs', title, body: 'Body of ' + title, at, created_at: at, answered: true, resolved_by: 'user' });

test('new cards and a lead-state change leave mockups loaded and the reader in place', async ({ page }) => {
  const made = await seed();
  const t0 = Date.now() - 600000;
  const at = (n) => new Date(t0 + n * 1000).toISOString();
  await ctx.patch(made.id, (t) => t.cards.push(needs('n1', 'First note', at(1))));
  await mockupCard(made, 'Mockup one', at(2));
  await ctx.patch(made.id, (t) => t.cards.push(needs('n2', 'Second note', at(3))));
  await mockupCard(made, 'Mockup two', at(4));
  await ctx.patch(made.id, (t) => t.cards.push(needs('n3', 'Third note', at(5))));
  await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
  await expect(page.locator('.card-diagram iframe')).toHaveCount(2);
  for (const f of await page.locator('.card-diagram iframe').elementHandles()) {
    const frame = await f.contentFrame();
    await frame.waitForSelector('#proof');
    await frame.waitForLoadState('load');
  }
  // Count loads from now on, and make the browser's own scroll anchoring unable to hide a missing fix.
  await page.addStyleTag({ content: 'html, body { overflow-anchor: none !important; }' });
  await page.evaluate(() => {
    window.__frames = [...document.querySelectorAll('.card-diagram iframe')]; window.__loads = [0, 0];
    window.__frames.forEach((f, i) => f.addEventListener('load', () => { window.__loads[i] += 1; }));
  });
  // Scroll into the middle of the first mockup.
  await page.evaluate(() => { const r = document.querySelector('.card-diagram').getBoundingClientRect(); window.scrollTo(0, window.scrollY + r.top + 150); });
  const before = await page.evaluate(() => {
    const top = [...document.querySelectorAll('#chat > *')].find((n) => n.getBoundingClientRect().bottom > 5 && n.dataset.card);
    return { id: top.dataset.card, top: top.getBoundingClientRect().top, y: window.scrollY };
  });
  expect(before.y).toBeGreaterThan(300);
  // An older card slots in above the reader, a new one at the end, and the lead's name changes.
  await ctx.patch(made.id, (t) => {
    t.cards.unshift(needs('older', 'An older note with a good deal of extra words so it wraps onto more lines than the others do in a narrow phone column', at(0.5)));
    t.cards.push(needs('newest', 'Newest note', new Date().toISOString()));
    t.lead_name = 'Renamed';
  });
  await expect(page.locator('#card-newest')).toHaveCount(1, { timeout: 8000 });
  await expect(page.locator('#card-older')).toHaveCount(1);
  const after = await page.evaluate(() => {
    return { same: [...document.querySelectorAll('.card-diagram iframe')].map((f, i) => f === window.__frames[i]), loads: window.__loads };
  });
  expect(after.same).toEqual([true, true]);
  expect(after.loads).toEqual([0, 0]);
  const moved = await page.evaluate((id) => document.querySelector('#chat [data-card="' + id + '"]').getBoundingClientRect().top, before.id);
  expect(Math.abs(moved - before.top)).toBeLessThanOrEqual(2);
});

test('scrolled to the bottom, a new card comes into view', async ({ page }) => {
  const made = await seed();
  await mockupCard(made, 'Mockup one', new Date(Date.now() - 60000).toISOString());
  await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
  await expect(page.frameLocator('.card-diagram iframe').locator('#proof')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.evaluate(() => { window.__frame = document.querySelector('.card-diagram iframe'); });
  await ctx.patch(made.id, (t) => t.cards.push(needs('newest', 'Newest note', new Date().toISOString())));
  const card = page.locator('#card-newest');
  await expect(card).toBeInViewport({ timeout: 8000 });
  expect(await page.evaluate(() => window.__frame === document.querySelector('.card-diagram iframe'))).toBe(true);
});

test('a mockup box has its final height before the iframe loads', async ({ page }) => {
  const made = await seed();
  await mockupCard(made, 'Mockup one', new Date(Date.now() - 60000).toISOString());
  // Hold the mockup's HTML back so the iframe has not loaded when the box is measured.
  let release; const gate = new Promise((r) => { release = r; });
  await page.route('**/diagram-html**', async (route) => { await gate; await route.continue(); });
  await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
  await expect(page.locator('.card-diagram .mockup-box')).toHaveCount(1);
  const h = await page.locator('.card-diagram .mockup-box').evaluate((n) => ({ h: n.clientHeight, w: n.clientWidth, loaded: Boolean(n.querySelector('iframe').contentDocument && n.querySelector('iframe').contentDocument.getElementById('proof')) }));
  expect(h.loaded).toBe(false);
  expect(Math.abs(h.h - h.w * 844 / 390)).toBeLessThanOrEqual(1);
  release();
  await expect(page.frameLocator('.card-diagram iframe').locator('#proof')).toBeVisible();
});

test('the Built half and any image tap open the picture page in image view', async ({ page }) => {
  const made = await seed();
  const dir = path.join(ctx.machine.uploadsDir, made.id); await fs.mkdir(dir, { recursive: true });
  const f1 = path.join(dir, '1-shot.png'); const f2 = path.join(dir, '2-plain.png');
  await fs.writeFile(f1, png); await fs.writeFile(f2, png);
  const withMock = await ctx.post(made.id, { kind: 'image', path: f1, title: 'Home screen', mockup: { graph: 'home', width: 390, height: 844 } });
  const plain = await ctx.post(made.id, { kind: 'image', path: f2, title: 'Plain' });
  await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
  const want = (card) => `/wheelchair/app/picture?thread=${made.id}&card=${card.id}&view=image`;
  const built = page.locator('.image-half').nth(0);
  await expect(built.getByRole('link', { name: 'Open full size' })).toHaveAttribute('href', want(withMock));
  await expect(built.locator('a:has(img)')).toHaveAttribute('href', want(withMock));
  await expect(page.locator('div.card-image', { hasText: 'Plain' }).locator('a:has(img)')).toHaveAttribute('href', want(plain));
});

test('an entry hidden under the sticky header is not the scroll anchor', async ({ page }) => {
  const made = await seed();
  const t0 = Date.now() - 600000;
  const at = (n) => new Date(t0 + n * 1000).toISOString();
  await ctx.patch(made.id, (t) => t.cards.push(needs('n0', 'Top note', at(0.5)), needs('n1', 'Hidden note', at(1))));
  await mockupCard(made, 'Visible mockup', at(2));
  for (let i = 0; i < 4; i++) await ctx.patch(made.id, (t) => t.cards.push(needs('tail' + i, 'Tail note ' + i, at(3 + i))));
  await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
  await expect(page.locator('.card-diagram iframe')).toHaveCount(1);
  await (await (await page.locator('.card-diagram iframe').elementHandle()).contentFrame()).waitForSelector('#proof');
  await page.addStyleTag({ content: 'html, body { overflow-anchor: none !important; scroll-padding: 0 !important; }' });
  // The mockup's top 1px under the header's bottom edge, so the note before it is wholly under the header.
  const setup = await page.evaluate(() => {
    const covered = document.getElementById('head').getBoundingClientRect().bottom;
    const m = document.querySelector('.card-diagram').getBoundingClientRect();
    window.scrollTo(0, window.scrollY + m.top - covered - 1);
    const hidden = document.getElementById('card-n1').getBoundingClientRect();
    return { covered, hiddenBottom: hidden.bottom, top: document.querySelector('.card-diagram').getBoundingClientRect().top };
  });
  expect(setup.hiddenBottom).toBeLessThanOrEqual(setup.covered);
  await ctx.patch(made.id, (t) => t.cards.splice(t.cards.findIndex((c) => c.kind === 'diagram'), 0, needs('between', 'A card that lands between the hidden note and the mockup, long enough to push things well down the page when it arrives', at(1.5))));
  await expect(page.locator('#card-between')).toHaveCount(1, { timeout: 8000 });
  const moved = await page.evaluate(() => document.querySelector('.card-diagram').getBoundingClientRect().top);
  expect(Math.abs(moved - setup.top)).toBeLessThanOrEqual(2);
});

test('an entry hidden behind the composer is not the scroll anchor', async ({ page }) => {
  const made = await seed();
  const t0 = Date.now() - 600000;
  const at = (n) => new Date(t0 + n * 1000).toISOString();
  await ctx.patch(made.id, (t) => t.cards.push(needs('n0', 'Top note', at(0.5))));
  const first = await mockupCard(made, 'Visible mockup', at(2));
  await mockupCard(made, 'Next mockup', at(3));
  for (let i = 0; i < 3; i++) await ctx.patch(made.id, (t) => t.cards.push(needs('tail' + i, 'Tail note ' + i, at(4 + i))));
  await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
  await expect(page.locator('.card-diagram iframe')).toHaveCount(2);
  await page.addStyleTag({ content: 'html, body { overflow-anchor: none !important; scroll-padding: 0 !important; }' });
  // The first mockup's bottom 4px above the composer, so the row after it starts behind the composer
  // and the first mockup is the only entry between the top bars and the composer.
  const setup = await page.evaluate((id) => {
    const card = document.getElementById('card-' + id);
    const composerTop = () => document.getElementById('composer').getBoundingClientRect().top;
    window.scrollTo(0, window.scrollY + card.getBoundingClientRect().bottom - (composerTop() - 4));
    const covered = document.getElementById('head').getBoundingClientRect().bottom;
    const next = card.nextElementSibling.getBoundingClientRect();
    return { covered, composerTop: composerTop(), cardTop: card.getBoundingClientRect().top, nextTop: next.top, y: window.scrollY, h: window.innerHeight };
  }, first.id);
  expect(setup.cardTop).toBeLessThanOrEqual(setup.covered);          // the card fills the whole visible band
  expect(setup.nextTop).toBeGreaterThan(setup.composerTop);          // the next row starts behind the composer
  expect(setup.nextTop).toBeLessThan(setup.h);                       // ...but inside the window
  // A poll swaps the only visible entry for a much shorter one with a new id.
  await ctx.patch(made.id, (t) => { const k = t.cards.findIndex((c) => c.id === first.id); t.cards.splice(k, 1, needs('swap', 'A short card in its place', at(2))); });
  await expect(page.locator('#card-swap')).toHaveCount(1, { timeout: 8000 });
  const y = await page.evaluate(() => window.scrollY);
  expect(Math.abs(y - setup.y)).toBeLessThanOrEqual(2);
});
