'use strict';
// Mockup display (design-in-threads T2): a mockup diagram card, an image card beside its mockup,
// and the full-size picture page.
const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

const SHOTS = process.env.MOCKUP_SHOTS || '';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
let ctx;
test.beforeEach(async ({ page }) => { ctx = await startWorld(); ctx.machine.uploadsDir = path.join(ctx.state, 'uploads'); await signIn(page, ctx); });
test.afterEach(async () => { await ctx.close(); });

async function seed() {
  const made = await ctx.make({ cli: 'claude' });
  const worktree = path.join(ctx.state, 'worktree');
  const dir = path.join(worktree, 'docs/plans/dark/graphs'); await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'home.html'), '<body style="margin:0;background:#def"><h1 id="proof" style="margin:0">Mockup home</h1><div style="height:2000px">tall</div></body>');
  await ctx.patch(made.id, (t) => { t.worktree = worktree; t.slug = 'dark'; });
  return made;
}
async function seedImage(made) {
  const dir = path.join(ctx.machine.uploadsDir, made.id); await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, '1-shot.png'); await fs.writeFile(file, png);
  return ctx.post(made.id, { kind: 'image', path: file, title: 'Home screen', mockup: { graph: 'home', width: 390, height: 844 } });
}
async function shot(page, name) { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); }

for (const [label, width] of [['phone', 390], ['laptop', 1280]]) {
  test.describe(label, () => {
    test.use({ viewport: { width, height: 900 } });
    test('a mockup card shows the whole screen scaled, never above 1, without inner scrolling', async ({ page }) => {
      const made = await seed();
      await ctx.post(made.id, { kind: 'diagram', plan: 'dark', graph: 'home', title: 'Home mockup', format: 'mockup', width: 390, height: 844 });
      await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
      const frame = page.locator('.card-diagram .mockup-box');
      const iframe = frame.locator('iframe');
      await expect(iframe).toHaveAttribute('sandbox', '');
      await expect(page.frameLocator('.card-diagram iframe').locator('#proof')).toBeVisible();
      const m = await page.evaluate(() => {
        const box = document.querySelector('.card-diagram .mockup-box'); const f = box.querySelector('iframe');
        const card = document.querySelector('.card-diagram').getBoundingClientRect(); const r = box.getBoundingClientRect(); const fr = f.getBoundingClientRect();
        return { cardLeft: card.left, cardRight: card.right, left: r.left, right: r.right, height: r.height, fh: fr.height, fw: fr.width, cw: box.clientWidth, st: getComputedStyle(f).transform, boxScroll: box.scrollTop + box.scrollLeft };
      });
      const scale = Math.min(1, m.cw / 390);
      expect(m.left).toBeGreaterThanOrEqual(m.cardLeft - 1); expect(m.right).toBeLessThanOrEqual(m.cardRight + 1);
      expect(Math.abs(m.height - 2 - 844 * scale)).toBeLessThanOrEqual(1);
      expect(Math.abs(m.fh - 844 * scale)).toBeLessThanOrEqual(1);
      expect(Math.abs(m.fw - 390 * scale)).toBeLessThanOrEqual(1);
      expect(m.fw).toBeLessThanOrEqual(390 + 1);
      expect(m.boxScroll).toBe(0);
      if (width > 600) expect(scale).toBe(1); else expect(scale).toBeLessThan(1);
      await shot(page, 'mockup-card-' + label);
    });
  });
}

test.describe('desktop pages', () => {
  test.use({ viewport: { width: 1800, height: 700 } });
  test('Open full size on a mockup shows the iframe at 390x844 with no download', async ({ page }) => {
    const made = await seed();
    await ctx.post(made.id, { kind: 'diagram', plan: 'dark', graph: 'home', title: 'Home mockup', format: 'mockup', width: 390, height: 844 });
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    let downloads = 0; page.on('download', () => { downloads++; });
    await page.getByRole('link', { name: 'Open full size' }).click();
    await expect(page).toHaveURL(/\/app\/picture\?thread=.*&card=/);
    await expect(page.locator('#picture-title')).toHaveText('Home mockup');
    const f = page.locator('#picture iframe');
    await expect(f).toHaveAttribute('sandbox', '');
    await expect(page.frameLocator('#picture iframe').locator('#proof')).toBeVisible();
    const box = await f.boundingBox(); // the 1px border sits outside the 390x844 viewport
    expect(Math.round(box.width)).toBe(392); expect(Math.round(box.height)).toBe(846);
    expect(await f.evaluate((n) => [n.clientWidth, n.clientHeight])).toEqual([390, 844]);
    expect(await page.locator('#picture').evaluate((n) => n.scrollHeight > n.clientHeight)).toBe(true);
    expect(downloads).toBe(0);
    await shot(page, 'picture-page');
  });

  test('an image card with a mockup shows Built and Mockup side by side and opens the mockup full size', async ({ page }) => {
    const made = await seed();
    const image = await seedImage(made);
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    const halves = page.locator('.card-image .image-half');
    await expect(halves).toHaveCount(2);
    await expect(halves.nth(0).locator('.image-label')).toHaveText('Built');
    await expect(halves.nth(1).locator('.image-label')).toHaveText('Mockup');
    await expect(page.frameLocator('.card-image iframe').locator('#proof')).toBeVisible();
    const [a, b] = await Promise.all([halves.nth(0).boundingBox(), halves.nth(1).boundingBox()]);
    expect(b.x).toBeGreaterThan(a.x + a.width - 1); expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(2);
    const card = await page.locator('div.card-image').boundingBox();
    expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(2); expect(a.width).toBeLessThanOrEqual(card.width / 2);
    await shot(page, 'image-pair-wide');
    await expect(halves.nth(0).getByRole('link', { name: 'Open full size' })).toHaveAttribute('href', new RegExp(`/app/picture\\?thread=${made.id}&card=${image.id}&view=image$`));
    await halves.nth(1).getByRole('link', { name: 'Open full size' }).click();
    await expect(page).toHaveURL(new RegExp(`/app/picture\\?thread=${made.id}&card=${image.id}`));
    await expect(page.locator('#picture-title')).toHaveText('Mockup: Home screen');
    await expect(page.frameLocator('#picture iframe').locator('#proof')).toBeVisible();
    expect(await page.locator('#picture iframe').evaluate((n) => [n.clientWidth, n.clientHeight])).toEqual([390, 844]);
  });

  test('without a plan the mockup half says so', async ({ page }) => {
    const made = await seed(); await seedImage(made);
    await ctx.patch(made.id, (t) => { delete t.slug; });
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    await expect(page.locator('.image-half').nth(1).getByText('Mockup not found')).toBeVisible();
    await expect(page.locator('.image-half iframe')).toHaveCount(0);
  });

  test('an image card without a mockup renders as before', async ({ page }) => {
    const made = await seed();
    const dir = path.join(ctx.machine.uploadsDir, made.id); await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, '2-plain.png'); await fs.writeFile(file, png);
    await ctx.post(made.id, { kind: 'image', path: file, title: 'Plain' });
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    await expect(page.locator('.card-image a > img.card-image')).toBeVisible();
    await expect(page.locator('.image-pair')).toHaveCount(0);
  });
});

test.describe('narrow', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('the image card stacks Built above Mockup', async ({ page }) => {
    const made = await seed(); await seedImage(made);
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    const halves = page.locator('.card-image .image-half');
    await expect(halves).toHaveCount(2);
    const [a, b] = await Promise.all([halves.nth(0).boundingBox(), halves.nth(1).boundingBox()]);
    expect(b.y).toBeGreaterThan(a.y + a.height - 1); expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(2);
    await shot(page, 'image-pair-narrow');
  });
});

test.describe('stacking threshold', () => {
  // Resize until the image card is `target` px wide (it tracks the viewport), then report what is on screen.
  async function atCardWidth(page, target) {
    let vw = target + 200;
    for (let i = 0; i < 4; i++) {
      await page.setViewportSize({ width: vw, height: 900 });
      const w = await page.locator('div.card-image').evaluate((n) => n.getBoundingClientRect().width);
      if (Math.abs(w - target) < 1) break;
      vw += Math.round(target - w);
    }
    const w = await page.locator('div.card-image').evaluate((n) => n.getBoundingClientRect().width);
    const halves = page.locator('.card-image .image-half');
    const [a, b] = await Promise.all([halves.nth(0).boundingBox(), halves.nth(1).boundingBox()]);
    return { w, sideBySide: b.x > a.x + a.width - 1 && Math.abs(a.y - b.y) <= 2 };
  }
  test('Built and Mockup stay side by side at a card 600-640px wide and stack under 599px', async ({ page }) => {
    const made = await seed(); await seedImage(made);
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    await expect(page.locator('.card-image .image-half')).toHaveCount(2);
    const wide = await atCardWidth(page, 620);
    expect(wide.w).toBeGreaterThanOrEqual(600); expect(wide.w).toBeLessThanOrEqual(640);
    expect(wide.sideBySide).toBe(true);
    const narrow = await atCardWidth(page, 590);
    expect(narrow.w).toBeLessThan(599); expect(narrow.w).toBeGreaterThan(500);
    expect(narrow.sideBySide).toBe(false);
  });
});
