'use strict';
// Comment on a spot in a mockup (mockup-polish T3): the thread and the picture page.
const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

let ctx;
test.use({ viewport: { width: 390, height: 844 } });
test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
test.afterEach(async () => { await ctx.close(); });

const TEXT = (x, y, c) => `Comment on mockup "Home mockup" (docs/plans/dark/graphs/home.html, 600x900) at x=${x}, y=${y}: ${c}`;

async function seed() {
  const made = await ctx.make({ cli: 'claude' });
  const worktree = path.join(ctx.state, 'worktree');
  const dir = path.join(worktree, 'docs/plans/dark/graphs'); await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'home.html'), '<body style="margin:0;background:#def"><h1 id="proof" style="margin:0">Mockup home</h1></body>');
  await ctx.patch(made.id, (t) => { t.worktree = worktree; t.slug = 'dark'; });
  const card = await ctx.post(made.id, { kind: 'diagram', plan: 'dark', graph: 'home', title: 'Home mockup', format: 'mockup', width: 600, height: 900 });
  return { made, card };
}
const needs = (id, at) => ({ id, kind: 'needs', title: 'Note ' + id, body: 'Body', at, created_at: at, answered: true, resolved_by: 'user' });
const open = async (page, made) => {
  await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
  await expect(page.locator('.card-diagram .mockup-box')).toHaveCount(1);
};
// The mockup is 600x900 shown at box width / 600, so a tap at CSS (px, py) in the layer means round(px / s).
async function tapAt(page, fx, fy) {
  await page.locator('.spot-layer').evaluate((n) => n.scrollIntoView({ block: 'center' })); // clear of the sticky nav
  const r = await page.locator('.spot-layer').boundingBox();
  const s = Math.min(1, r.width / 600);
  const cx = Math.round(r.x + r.width * fx); const cy = Math.round(r.y + r.height * fy); // whole pixels, as touch events give
  await page.mouse.click(cx, cy);
  return { x: Math.round((cx - r.x) / s), y: Math.round((cy - r.y) / s), s };
}

test('a tap on a scaled mockup sends the exact message with rounded coordinates', async ({ page }) => {
  const { made } = await seed();
  await open(page, made);
  const bodies = [];
  await page.route('**/messages', async (route) => { bodies.push(route.request().postDataJSON()); await route.continue(); });
  await page.getByRole('button', { name: 'Comment on a spot' }).click();
  await expect(page.locator('.spot-layer')).toBeVisible();
  const iframe = page.locator('.card-diagram iframe');
  await expect(iframe).toHaveAttribute('sandbox', '');
  const want = await tapAt(page, 0.5, 0.25);
  expect(want.s).toBeLessThan(1);
  await expect(page.locator('.spot-pin')).toBeVisible();
  await expect(page.locator('.spot-text')).toBeVisible();
  // Tapping elsewhere moves the pin and the new point is what gets sent.
  const moved = await tapAt(page, 0.3, 0.8);
  expect(moved.x).not.toBe(want.x);
  await expect(page.locator('.spot-box').getByRole('button', { name: 'Send' })).toBeDisabled(); // empty comment
  await page.locator('.spot-text').fill('Make this wider');
  await page.locator('.spot-box').getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('.spot-layer')).toBeHidden();
  expect(bodies).toEqual([{ text: TEXT(moved.x, moved.y, 'Make this wider') }]);
  await expect(page.locator('#chat .human').last()).toContainText('Make this wider');
});

test('taps at the far corner are clamped to the mockup edge', async ({ page }) => {
  const { made } = await seed();
  await open(page, made);
  const bodies = [];
  await page.route('**/messages', async (route) => { bodies.push(route.request().postDataJSON()); await route.continue(); });
  await page.getByRole('button', { name: 'Comment on a spot' }).click();
  await page.locator('.spot-layer').evaluate((n) => n.scrollIntoView({ block: 'center' })); // clear of the sticky nav
  const r = await page.locator('.spot-layer').boundingBox();
  await page.mouse.click(r.x + r.width - 0.2, r.y + r.height - 0.2);
  await page.locator('.spot-text').fill('corner');
  await page.locator('.spot-box').getByRole('button', { name: 'Send' }).click();
  await expect.poll(() => bodies.length).toBe(1);
  const m = /at x=(\d+), y=(\d+):/.exec(bodies[0].text);
  expect(Number(m[1])).toBeLessThanOrEqual(599); expect(Number(m[1])).toBeGreaterThanOrEqual(598);
  expect(Number(m[2])).toBeLessThanOrEqual(899); expect(Number(m[2])).toBeGreaterThanOrEqual(898);
});

test('the button is hidden but keeps its space when the thread is archived or has no live lead', async ({ page }) => {
  const { made } = await seed();
  await open(page, made);
  const btn = page.locator('.spot-btn');
  await expect(btn).toHaveCSS('visibility', 'visible');
  const mockup = page.locator('.card-diagram .mockup-box');
  const top = (await mockup.boundingBox()).y;
  await page.evaluate(() => { window.__frame = document.querySelector('.card-diagram iframe'); });
  await ctx.patch(made.id, (t) => t.sessions.forEach((s) => { if (s.role === 'lead') s.live = false; }));
  await expect(btn).toHaveCSS('visibility', 'hidden', { timeout: 8000 });
  expect((await mockup.boundingBox()).y).toBe(top);
  // The same card node and iframe: hiding is done in place.
  expect(await page.evaluate(() => window.__frame === document.querySelector('.card-diagram iframe'))).toBe(true);
  await ctx.patch(made.id, (t) => { t.archived = true; t.branch = 'gone'; t.kept_files = []; });
  await page.reload();
  await expect(page.locator('.card-diagram .mockup-box')).toHaveCount(1);
  await expect(page.locator('.spot-btn')).toHaveCSS('visibility', 'hidden');
});

test('a failed send keeps the pin and text and says why; Send again works', async ({ page }) => {
  const { made } = await seed();
  await open(page, made);
  let fail = true; const bodies = [];
  await page.route('**/messages', async (route) => {
    bodies.push(route.request().postDataJSON());
    if (fail) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'hub is down' }) });
    return route.continue();
  });
  await page.getByRole('button', { name: 'Comment on a spot' }).click();
  const tap = await tapAt(page, 0.4, 0.4);
  await page.locator('.spot-text').fill('Try again');
  await page.locator('.spot-box').getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('.spot-error')).toHaveText('Comment not sent: hub is down');
  await expect(page.locator('.spot-text')).toHaveValue('Try again');
  await expect(page.locator('.spot-pin')).toBeVisible();
  await expect(page.locator('.spot-text')).toBeEnabled();
  fail = false;
  await page.locator('.spot-box').getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('.spot-layer')).toBeHidden();
  expect(bodies.map((b) => b.text)).toEqual([TEXT(tap.x, tap.y, 'Try again'), TEXT(tap.x, tap.y, 'Try again')]);
});

test('a draft is disabled while sending', async ({ page }) => {
  const { made } = await seed();
  await open(page, made);
  let release; const gate = new Promise((r) => { release = r; });
  await page.route('**/messages', async (route) => { await gate; await route.continue(); });
  await page.getByRole('button', { name: 'Comment on a spot' }).click();
  await tapAt(page, 0.4, 0.4);
  await page.locator('.spot-text').fill('Slow one');
  await page.locator('.spot-box').getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('.spot-text')).toBeDisabled();
  await expect(page.locator('.spot-box').getByRole('button', { name: 'Cancel' })).toBeDisabled();
  await expect(page.locator('.spot-box').getByRole('button', { name: 'Send' })).toBeDisabled();
  release();
  await expect(page.locator('.spot-layer')).toBeHidden();
});

test('an open draft survives a poll that replaces its card node', async ({ page }) => {
  const { made, card } = await seed();
  await open(page, made);
  await page.getByRole('button', { name: 'Comment on a spot' }).click();
  const tap = await tapAt(page, 0.6, 0.5);
  await page.locator('.spot-text').fill('Still here');
  await page.evaluate(() => { window.__card = document.querySelector('.card-diagram'); });
  // A change to a signature input (kept files) gives the card a new signature, so the node is replaced.
  await ctx.patch(made.id, (t) => { t.kept_files = ['unrelated.txt']; });
  await expect.poll(() => page.evaluate(() => window.__card.isConnected), { timeout: 8000 }).toBe(false);
  await expect(page.locator('.spot-text')).toHaveValue('Still here');
  await expect(page.locator('.spot-pin')).toBeVisible();
  await expect(page.locator('.spot-layer')).toBeVisible();
  await page.locator('.spot-box').getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('#chat .human').last()).toContainText(`at x=${tap.x}, y=${tap.y}: Still here`);
  await expect(page.locator('.spot-layer')).toBeHidden();
});

test('Cancel removes the layer, pin and box and forgets the draft', async ({ page }) => {
  const { made } = await seed();
  await open(page, made);
  await page.getByRole('button', { name: 'Comment on a spot' }).click();
  await tapAt(page, 0.5, 0.5);
  await page.locator('.spot-text').fill('never mind');
  await page.locator('.spot-box').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('.spot-layer')).toBeHidden();
  await expect(page.locator('.spot-box')).toBeHidden();
  await page.getByRole('button', { name: 'Comment on a spot' }).click();
  await expect(page.locator('.spot-pin')).toBeHidden();
  await expect(page.locator('.spot-text')).toBeHidden();
});

test('the image card Mockup half has the button too', async ({ page }) => {
  const made = await ctx.make({ cli: 'claude' });
  const worktree = path.join(ctx.state, 'worktree');
  const dir = path.join(worktree, 'docs/plans/dark/graphs'); await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'home.html'), '<body>x</body>');
  ctx.machine.uploadsDir = path.join(ctx.state, 'uploads');
  await ctx.patch(made.id, (t) => { t.worktree = worktree; t.slug = 'dark'; });
  const up = path.join(ctx.machine.uploadsDir, made.id); await fs.mkdir(up, { recursive: true });
  const file = path.join(up, '1-shot.png');
  await fs.writeFile(file, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  await ctx.post(made.id, { kind: 'image', path: file, title: 'Home screen', mockup: { graph: 'home', width: 390, height: 844 } });
  const bodies = [];
  await page.route('**/messages', async (route) => { bodies.push(route.request().postDataJSON()); await route.continue(); });
  await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
  await expect(page.locator('.image-half .mockup-box')).toHaveCount(1);
  await page.getByRole('button', { name: 'Comment on a spot' }).click();
  await page.locator('.spot-layer').evaluate((n) => n.scrollIntoView({ block: 'center' })); // clear of the sticky nav
  const r = await page.locator('.spot-layer').boundingBox();
  await page.mouse.click(r.x + r.width / 2, 400); // the layer is taller than the screen here; 400 is below the sticky header

  await page.locator('.spot-text').fill('corner');
  await page.locator('.spot-box').getByRole('button', { name: 'Send' }).click();
  await expect.poll(() => bodies.length).toBe(1);
  expect(bodies[0].text).toMatch(/^Comment on mockup "Home screen" \(docs\/plans\/dark\/graphs\/home\.html, 390x844\) at x=\d+, y=\d+: corner$/);
  expect(Number(/x=(\d+)/.exec(bodies[0].text)[1])).toBeGreaterThan(100);
});

async function openPicture(page, made, card) {
  await page.goto(`${ctx.server.url}/app/picture?thread=${made.id}&card=${card.id}`);
  await expect(page.locator('#picture iframe')).toHaveAttribute('scrolling', 'no');
}

test('the picture page sends the same format and shows Sent to the thread', async ({ page }) => {
  const { made, card } = await seed();
  const bodies = [];
  await page.route('**/messages', async (route) => { bodies.push(route.request().postDataJSON()); await route.continue(); });
  await openPicture(page, made, card);
  await page.getByRole('button', { name: 'Comment on a spot' }).click();
  const f = await page.locator('#picture iframe').boundingBox();
  await page.mouse.click(f.x + 1 + 100.4, f.y + 1 + 200.4); // 1px border; the layer sits inside it
  await page.locator('.spot-text').fill('Move it');
  await page.locator('.spot-box').getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('#spot-sent')).toBeVisible();
  await expect(page.locator('#spot-sent a')).toHaveAttribute('href', new RegExp(`/wheelchair/app/thread\\?id=${made.id}$`));
  expect(bodies).toEqual([{ text: TEXT(100, 200, 'Move it') }]);
  await expect(page.locator('.spot-layer')).toBeHidden();
});

test('the picture page refuses with the failed condition and keeps the draft', async ({ page }) => {
  const { made, card } = await seed();
  const bodies = [];
  await page.route('**/messages', async (route) => { bodies.push(route.request().postDataJSON()); await route.continue(); });
  await openPicture(page, made, card);
  await page.getByRole('button', { name: 'Comment on a spot' }).click();
  const f = await page.locator('#picture iframe').boundingBox();
  await page.mouse.click(f.x + 51, f.y + 51);
  await page.locator('.spot-text').fill('Keep me');
  await ctx.patch(made.id, (t) => t.sessions.forEach((s) => { if (s.role === 'lead') s.live = false; }));
  await page.locator('.spot-box').getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('.spot-error')).toHaveText("Comment not sent: the lead isn't running");
  await expect(page.locator('.spot-text')).toHaveValue('Keep me');
  await expect(page.locator('.spot-pin')).toBeVisible();
  await expect(page.locator('#spot-sent')).toBeHidden();
  // Archived is named as its own condition.
  await ctx.patch(made.id, (t) => { t.archived = true; });
  await page.locator('.spot-box').getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('.spot-error')).toHaveText('Comment not sent: the thread is archived');
  expect(bodies).toEqual([]);
});

test('the picture page says why at load when the lead is not running', async ({ page }) => {
  const { made, card } = await seed();
  await ctx.patch(made.id, (t) => t.sessions.forEach((s) => { if (s.role === 'lead') s.live = false; }));
  await openPicture(page, made, card);
  await expect(page.locator('#spot-note')).toContainText("the lead isn't running");
  await expect(page.locator('.spot-btn')).toHaveCSS('visibility', 'hidden');
});

test('a hand-off starting hides the button in place without redrawing the mockup', async ({ page }) => {
  const { made } = await seed();
  await open(page, made);
  await expect(page.locator('.spot-btn')).toHaveCSS('visibility', 'visible');
  await page.evaluate(() => {
    window.__frame = document.querySelector('.card-diagram iframe'); window.__loads = 0;
    window.__frame.addEventListener('load', () => { window.__loads += 1; });
  });
  await ctx.patch(made.id, (t) => { t.handoff_op = { kind: 'create', state: 'running' }; });
  await expect(page.locator('.spot-btn')).toHaveCSS('visibility', 'hidden', { timeout: 8000 });
  expect(await page.evaluate(() => window.__frame === document.querySelector('.card-diagram iframe'))).toBe(true);
  expect(await page.evaluate(() => window.__loads)).toBe(0);
});
