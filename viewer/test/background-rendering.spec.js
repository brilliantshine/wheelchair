'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

const fixtures = path.join(__dirname, 'fixtures/background-browser');
let ctx, thread, plan, graph;

test.beforeEach(async ({ page }) => {
  ctx = await startWorld();
  thread = await ctx.make({ cli: 'claude' });
  await ctx.transcript(thread.id);
  plan = path.join(ctx.state, 'worktree/docs/plans/dark');
  await fs.mkdir(path.join(plan, 'graphs'), { recursive: true });
  await fs.copyFile(path.join(__dirname, 'fixtures/plan-doc/PLAN.md'), path.join(plan, 'PLAN.md'));
  await fs.appendFile(path.join(plan, 'PLAN.md'), '\n' + 'A readable paragraph for scrolling.\n\n'.repeat(80));
  graph = path.join(plan, 'graphs/flow.json');
  await fs.copyFile(path.join(__dirname, 'fixtures/canonical.json'), graph);
  await ctx.patch(thread.id, t => { t.worktree = path.join(ctx.state, 'worktree'); t.slug = 'dark'; });
  await ctx.post(thread.id, { kind: 'diagram', plan: 'dark', graph: 'flow', title: 'Flow', format: 'graph' });
  await signIn(page, ctx);
  // Reading chat registers the plan and its graphs with the isolated server.
  const response = await page.request.get(`${ctx.server.url}/api/threads/${thread.id}/chat?token=${ctx.server.token}`);
  expect(response.ok()).toBeTruthy();
});
test.afterEach(async () => { await ctx.close(); });

async function settings(page) {
  await page.goto(`${ctx.server.url}/app/settings#background`);
  await expect.poll(() => page.evaluate(() => window.wcBackground.current().metadata !== null)).toBe(true);
}
async function choose(page, file, type) {
  await page.getByLabel('Choose background image').setInputFiles({ name: file, mimeType: type, buffer: await fs.readFile(path.join(fixtures, file)) });
  await expect(page.locator('.background-layer img')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
}
async function save(page) {
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
}
async function solid(locator) {
  await expect(locator).toBeVisible();
  const color = await locator.evaluate(e => getComputedStyle(e).backgroundColor);
  expect(color, 'content surface must have an opaque background').toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  expect(await locator.evaluate(e => { for (let node = e; node; node = node.parentElement) { if (Number(getComputedStyle(node).opacity) !== 1) return false; } return true; }), 'surface ancestors must not fade text or controls over the image').toBe(true);
}
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
async function active(page) {
  await expect(page.locator('.background-layer img')).toHaveCount(1);
  await expect(page.locator('html')).toHaveClass(/background-active/);
  await expect(page.locator('.background-layer')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.background-layer')).toHaveCSS('pointer-events', 'none');
  expect(await page.locator('script[src$="/background.js"]').count()).toBe(1);
  expect(await page.locator('link[href$="/background.css"]').count()).toBe(1);
  await noOverflow(page);
}
async function screenshot(page, testInfo, label, width) {
  const file = testInfo.outputPath(`${label}-${width}.png`);
  await page.screenshot({ path: file });
  console.log(`T6 screenshot: ${file}`);
}
async function changingPixels(page) {
  // Sample a visible Settings gutter, avoiding controls, via the browser's native paint.
  const samples = [];
  for (let i = 0; i < 12; i++) {
    const image = await page.screenshot({ clip: { x: 1240, y: 800, width: 8, height: 8 }, animations: 'allow' });
    samples.push(image.toString('base64'));
    await page.waitForTimeout(120);
  }
  expect(new Set(samples).size, 'native GIF should show distinct frames').toBeGreaterThan(1);
}

test('native finite-loop GIF keeps changing after preview and save, refresh and opacity', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 850 });
  await settings(page);
  await choose(page, 'finite-colors.gif', 'image/gif');
  // Two 300ms frames, finite repeat count 1: the original stops by 1.2 seconds.
  await page.waitForTimeout(1600);
  await page.evaluate(() => { window.original = document.querySelector('.background-layer img'); window.originalSrc = window.original.src; });
  let imageRequests = 0;
  page.on('request', req => { if (req.url().includes('/settings/background/image/')) imageRequests++; });
  await page.evaluate(() => window.wcBackground.refresh());
  await page.waitForTimeout(150);
  await page.getByLabel('Visibility').fill('80');
  await expect(page.locator('.background-layer')).toHaveCSS('opacity', '0.8');
  expect(await page.evaluate(() => document.querySelector('.background-layer img') === window.original && window.original.src === window.originalSrc)).toBe(true);
  expect(imageRequests).toBe(0);
  await changingPixels(page);
  await save(page);
  await expect.poll(() => page.evaluate(() => document.querySelector('.background-layer img')?.src.includes('/settings/background/image/'))).toBe(true);
  await page.waitForTimeout(1600);
  await page.evaluate(() => { window.original = document.querySelector('.background-layer img'); window.originalSrc = window.original.src; });
  imageRequests = 0;
  await page.evaluate(() => window.wcBackground.refresh());
  await page.waitForTimeout(150);
  await page.getByLabel('Visibility').fill('60');
  await expect(page.locator('.background-layer')).toHaveCSS('opacity', '0.6');
  expect(await page.evaluate(() => document.querySelector('.background-layer img') === window.original && window.original.src === window.originalSrc)).toBe(true);
  expect(imageRequests).toBe(0);
  await changingPixels(page);
});

test('shared pages and standalone or framed documents use the expected appearance', async ({ page }) => {
  await settings(page); await choose(page, 'quadrants.png', 'image/png'); await save(page);
  const chat = await page.request.get(`${ctx.server.url}/api/threads/${thread.id}/chat?token=${ctx.server.token}`).then(r => r.json());
  const card = chat.cards.find(c => c.kind === 'diagram');
  const framedRequests = [];
  page.on('request', request => { if (request.frame() !== page.mainFrame() && request.url().includes('/settings/background')) framedRequests.push(request.url()); });
  const pages = [
    ['/app/features', '.section-head:visible'], ['/app/threads', '.col-list'],
    [`/app/thread?id=${thread.id}`, '#composer'], ['/app/new', '#new-form'],
    [`/app/agents?lead=${thread.id}`, '.agents-heading'], ['/app/settings#background', '.background-editor .box'],
    ['/app/terminal?login=default-claude&machine=hub', '.term-bar'],
    [`/app/doc?thread=${thread.id}&file=PLAN.md`, '#content'],
    [`/app/picture?thread=${thread.id}&card=${card.id}`, 'iframe.picture-frame'],
    [`/docs?plan=${encodeURIComponent(plan)}&file=PLAN.md`, '#content'],
  ];
  for (const [url, surface] of pages) {
    await page.goto(ctx.server.url + url);
    await active(page); await solid(page.locator(surface).first());
    if (url === '/app/features') await solid(page.locator('.v-group.empty .stage-head').first());
    if (url.startsWith('/app/picture')) {
      await solid(page.locator('.picture-bar'));
      await expect(page.frameLocator('iframe.picture-frame').locator('svg#canvas')).toBeVisible();
      expect(await page.frameLocator('iframe.picture-frame').locator('html').evaluate(el => ({ active: el.classList.contains('background-active'), controller: !!window.wcBackground, layers: document.querySelectorAll('.background-layer').length }))).toEqual({ active: false, controller: false, layers: 0 });
    }
  }
  expect(framedRequests).toEqual([]);
  // Shipped documents prohibit framing with CSP. For this defensive-guard test only,
  // remove that child response directive; keep the production headers unchanged.
  await page.goto(`${ctx.server.url}/app/threads`);
  // Framed app and legacy documents must not initialize appearance at all.
  for (const url of [`/wheelchair/app/doc?thread=${thread.id}&file=PLAN.md`, `/wheelchair/docs?plan=${encodeURIComponent(plan)}&file=PLAN.md`]) {
    await page.route(new URL(url, ctx.server.url).href, async route => {
      const response = await route.fetch();
      const headers = { ...response.headers() };
      headers['content-security-policy'] = headers['content-security-policy'].replace(/;?\s*frame-ancestors[^;]*/g, '');
      await route.fulfill({ response, headers });
    }, { times: 1 });
    const requests = [];
    const listener = req => { if (req.frame() !== page.mainFrame() && req.url().includes('/settings/background')) requests.push(req.url()); };
    page.on('request', listener);
    await page.evaluate(src => { const f = document.createElement('iframe'); f.id = 'test-frame'; f.src = src; document.body.appendChild(f); }, url);
    const frame = page.frameLocator('#test-frame'); await expect(frame.locator('#content h1')).toBeVisible();
    expect(await frame.locator('html').evaluate(el => ({ active: el.classList.contains('background-active'), controller: !!window.wcBackground, layers: document.querySelectorAll('.background-layer').length }))).toEqual({ active: false, controller: false, layers: 0 });
    expect(requests).toEqual([]);
    await page.locator('#test-frame').evaluate(el => el.remove()); page.off('request', listener);
  }
  const requests = [];
  page.on('request', req => { if (req.url().includes('/settings/background')) requests.push(req.url()); });
  await page.goto(`${ctx.server.url}/?path=${encodeURIComponent(graph)}`);
  await expect(page.locator('svg#canvas')).toBeVisible();
  expect(await page.evaluate(() => ({ active: document.documentElement.classList.contains('background-active'), controller: !!window.wcBackground, layers: document.querySelectorAll('.background-layer').length }))).toEqual({ active: false, controller: false, layers: 0 });
  expect(requests).toEqual([]);
});

for (const width of [1280, 390]) {
  test(`representative interactions and solid surfaces at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 850 });
    await settings(page); await choose(page, 'quadrants.png', 'image/png');
    await page.getByLabel('Visibility').fill('100'); await save(page);
    await active(page); await solid(page.locator('.background-editor .box'));
    await page.getByLabel('Visibility').focus(); await expect(page.getByLabel('Visibility')).toBeFocused();
    await screenshot(page, testInfo, 'settings', width);
    await page.goto(`${ctx.server.url}/app/thread?id=${thread.id}`);
    await active(page); await solid(page.locator('#composer')); await solid(page.locator('.bubble.assistant').first()); await solid(page.locator('.lead-by').first());
    await page.locator('#msg').fill('Background does not block input'); await expect(page.locator('#msg')).toBeFocused();
    await expect(page.locator('#msg')).toHaveValue('Background does not block input');
    const frame = page.locator('iframe.diagram').first(); await solid(frame);
    await expect(frame.contentFrame().locator('svg#canvas')).toBeVisible();
    await screenshot(page, testInfo, 'thread', width);
    await page.goto(`${ctx.server.url}/app/agents?lead=${thread.id}`); await active(page); await solid(page.locator('.agents-heading').first());
    if (width === 390) await solid(page.locator('.agents-back').first());
    const info = page.getByRole('button', { name: 'How to read this tree' });
    await info.click(); await expect(page.locator('.agents-info')).toBeVisible();
    await page.keyboard.press('Escape'); await expect(page.locator('.agents-info')).toBeHidden();
    await screenshot(page, testInfo, 'agents', width);
    await page.route('**/api/accounts/*/signin/hub/pane', route => route.fulfill({ json: { text: Array.from({ length: 100 }, (_, i) => `Terminal line ${i}`).join('\n') } }));
    await page.goto(`${ctx.server.url}/app/terminal?login=default-claude&machine=hub`);
    await active(page); await solid(page.locator('.term-bar')); await solid(page.locator('.tv-host')); await solid(page.locator('.tv-view'));
    await page.getByRole('button', { name: 'View only' }).click();
    await page.getByRole('button', { name: 'Typing' }).focus();
    await expect(page.getByRole('button', { name: 'Typing' })).toBeFocused();
    await expect(page.locator('.tv-notice')).toBeVisible();
    expect(await page.locator('.tv-notice').evaluate(e => getComputedStyle(e.closest('.tv-view')).backgroundColor)).toMatch(/^rgb\(/);
    await screenshot(page, testInfo, 'terminal', width);
    await page.goto(`${ctx.server.url}/app/doc?thread=${thread.id}&file=PLAN.md`);
    await active(page); await solid(page.locator('#content')); await expect(page.locator('#content h1')).toHaveText('Dark mode plan');
    await page.getByRole('link', { name: /Back to the thread/ }).focus(); await expect(page.getByRole('link', { name: /Back to the thread/ })).toBeFocused();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await noOverflow(page);
  });
}
