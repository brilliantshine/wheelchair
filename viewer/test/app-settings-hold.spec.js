'use strict';

// Settings repaints keep what is in use in place: a waiting sign-in card is not rebuilt by a usage
// answer, and a pressed, focused or hovered control below a repainted block holds its screen position.
// Usage and sign-in routes are answered by page.route; the pages and the real server are real.
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

const HOUR = 3600000;
const iso = (ms) => new Date(Date.now() + ms).toISOString();

function usageBody(overrides = {}) {
  const claude = {
    label: 'Claude', left: 0.4, amber: true, runs_out_at: iso(30 * HOUR), first_refill: iso(60 * HOUR),
    below_notify: true, all_paused: false,
    accounts: [
      { id: 'default-claude', provider: 'claude', name: 'default', plan: 'max5', weight: 5, paused: false,
        machines: { hub: 'signed_in', beelink: 'signed_out', laptop: 'unknown' },
        reading: { account: 'default-claude', at: iso(-60000), five_hour: { used: 42, resets_at: iso(2 * HOUR) }, week: { used: 61, resets_at: iso(60 * HOUR) } },
        next: true, reason: 'next: refills soonest', live_sessions: 2 },
      { id: 'work', provider: 'claude', name: 'Work', plan: 'pro', weight: 1, paused: true,
        machines: { hub: 'signed_in', beelink: 'signed_in', laptop: 'signed_in' }, reading: null,
        next: false, reason: 'skipped: paused', live_sessions: 0 },
    ],
  };
  const gpt = {
    label: 'GPT', left: null, amber: false, runs_out_at: null, first_refill: null, below_notify: false, all_paused: true,
    accounts: [{ id: 'default-gpt', provider: 'gpt', name: 'default', plan: 'plus', weight: 1, paused: true,
      machines: { hub: 'signed_in', beelink: 'signed_in', laptop: 'signed_in' }, reading: null,
      next: false, reason: 'skipped: paused', live_sessions: 0 }],
  };
  const gemini = { label: 'Antigravity', left: null, accounts: [{ id: 'default-gemini', provider: 'gemini', name: 'default', plan: 'unknown', weight: 1, paused: false, machines: { beelink: 'signed_out' }, reading: null, live_sessions: 0 }] };
  return { providers: { claude, gpt, gemini }, ...overrides };
}

// Answers the account routes the pages call; everything else goes to the real server.
async function mock(page, state) {
  state.calls = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*\/api/, '');
    const method = request.method();
    const body = request.postData() ? JSON.parse(request.postData()) : {};
    const json = (status, value) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (path === '/settings' && method === 'GET') {
      if (!state.settings) return route.fallback();
      try {
        const response = await route.fetch();
        const settings = await response.json();
        return json(200, { ...settings, ...state.settings });
      } catch {
        return route.abort();
      }
    }
    if (path === '/settings/preferences' && method === 'PUT' && body.review_families) {
      state.calls.push([method, path, body]);
      return json(200, body);
    }
    if (path === '/usage' && method === 'GET') { state.usageGets = (state.usageGets || 0) + 1; return json(200, state.usage || usageBody()); }
    if (path === '/usage/alert') return json(200, { dot: state.dot !== false });
    if (path === '/usage/seen' && method === 'POST') { state.dot = false; state.calls.push([method, path]); return json(200, { ok: true }); }
    if (path === '/settings/accounts' && method === 'POST') { state.calls.push([method, path, body]); return json(201, { id: 'new-one', ...body, weight: 1, paused: false }); }
    if (/^\/settings\/accounts\/[^/]+\/restore$/.test(path) && method === 'POST') { state.calls.push([method, path]); return json(201, { ok: true }); }
    const acct = path.match(/^\/settings\/accounts\/([^/]+)$/);
    if (acct && (method === 'PUT' || method === 'DELETE')) {
      state.calls.push([method, path, body]);
      if (state.onAccount) state.onAccount(method, acct[1], body);
      return json(200, { ok: true });
    }
    if (path === '/settings/balancing' && method === 'PUT') {
      state.calls.push([method, path, body]);
      return state.balancingError ? json(400, { error: state.balancingError }) : json(200, { ...body, reserved_provider: state.savedProvider === undefined ? 'Claude' : state.savedProvider });
    }
    const signin = path.match(/^\/accounts\/([^/]+)\/signin(?:\/([^/]+))?(?:\/(code|pane|keys))?$/);
    if (signin) {
      state.calls.push([method, path, body]);
      if (method === 'POST' && !signin[2]) return json(201, { state: 'starting' });
      if (method === 'POST' && signin[3] === 'code') return state.codeError ? json(409, { error: state.codeError }) : json(200, { ok: true });
      if (signin[3] === 'pane') return json(200, { text: 'LOGIN-PANE-TEXT\n' });
      return json(200, state.signin);
    }
    return route.fallback();
  });
}

let ctx;
test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
test.afterEach(async () => { await ctx.close(); });
const open = (page, hash) => page.goto(`${ctx.server.url}/app/settings#${hash}`);
const waiting = { state: 'waiting', url: 'https://claude.example/login', wantsCode: true, logged_in: false };
async function cardSetup(page, state) {
  await mock(page, state);
  await open(page, 'providers');
  await page.locator('.acct[data-account="default-claude"] li[data-machine="beelink"] button').click();
  const card = page.locator('.signin-card');
  await expect(card.getByPlaceholder('Paste the code here')).toBeVisible();
  return card;
}
async function holdNextUsage(page, state) {
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  let requested;
  let answers = 0;
  const request = new Promise((resolve) => { requested = resolve; });
  await page.route('**/api/usage', async (route) => { requested(); await held; await route.fulfill({ json: state.usage || usageBody() }); answers++; });
  return { release, request, answers: () => answers };
}

test('usage during Send code leaves Accounts and delivers one click', async ({ page }) => {
  const state = { signin: waiting };
  await page.clock.install();
  const card = await cardSetup(page, state);
  await page.addStyleTag({ content: '* { overflow-anchor: none !important; }' });
  await card.getByPlaceholder('Paste the code here').fill('abc');
  await page.evaluate(() => { document.activeElement.blur(); document.querySelector('.acct').dataset.marker = 'kept'; });
  const held = await holdNextUsage(page, state);
  await page.clock.runFor(30000); await held.request;
  const send = card.getByRole('button', { name: 'Send code' });
  const box = await send.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  held.release(); await expect.poll(held.answers).toBe(1); await page.mouse.up();
  await expect.poll(() => state.calls.filter((c) => c[1].endsWith('/code')).length).toBe(1);
  await expect(page.locator('.acct').first()).toHaveAttribute('data-marker', 'kept');
});

test('focused code and account survive usage and timer until close shows newer reading', async ({ page }) => {
  const state = { signin: waiting };
  await page.clock.install();
  const card = await cardSetup(page, state);
  const field = card.getByPlaceholder('Paste the code here');
  await field.fill('typed');
  const node = await card.elementHandle();
  await page.locator('.acct').first().evaluate((el) => { el.dataset.marker = 'kept'; });
  const newer = usageBody(); newer.providers.claude.accounts[0].reading.five_hour.used = 73; state.usage = newer;
  const held = await holdNextUsage(page, state);
  await page.clock.runFor(30000); await held.request; held.release();
  await expect.poll(held.answers).toBe(1);
  await page.clock.runFor(30000); await expect.poll(held.answers).toBeGreaterThanOrEqual(2);
  await expect(field).toBeFocused(); await expect(field).toHaveValue('typed');
  expect(await node.evaluate((el) => el === document.querySelector('.signin-card'))).toBe(true);
  await expect(page.locator('.acct').first()).toHaveAttribute('data-marker', 'kept');
  await card.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.acct[data-account="default-claude"]')).toContainText('73% used');
});

test('failed card permits the next usage repaint', async ({ page }) => {
  const state = { signin: waiting };
  await page.clock.install();
  const card = await cardSetup(page, state);
  state.signin = { state: 'failed' };
  await page.clock.runFor(2000); await expect(card.locator('.inline-err')).toBeVisible();
  await page.locator('.acct').first().evaluate((el) => { el.dataset.marker = 'old'; });
  await page.clock.runFor(30000);
  await expect(page.locator('.acct').first()).not.toHaveAttribute('data-marker', 'old');
});

test('phone Technical terms wording fits', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'you');
  const select = page.getByLabel('Technical terms');
  await expect(select.locator('option:checked')).toHaveText('Plain words first, build up if needed');
  await expect(select.locator('xpath=ancestor::div[contains(@class,"row-line")]')).toContainText('How the lead handles technical terms');
  const widths = await select.evaluate((el) => { const s = getComputedStyle(el); const c = document.createElement('canvas').getContext('2d'); c.font = s.font; return { text: c.measureText(el.selectedOptions[0].textContent).width, room: el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) - 24 }; });
  expect(widths.text).toBeLessThanOrEqual(widths.room);
});

for (const mode of ['press', 'hover', 'focus']) {
  test(`Lead order ${mode} stays in place when usage bars arrive`, async ({ page }) => {
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    await mock(page, { settings: { harnesses: { claude: true, gpt: true, gemini: true, kimi: true, openrouter: true }, lead_order: ['claude', 'gpt', 'any'] } });
    await page.route('**/api/usage', async (route) => { await held; await route.fulfill({ json: usageBody() }); });
    await open(page, 'usage');
    await page.addStyleTag({ content: '* { overflow-anchor: none !important; }' });
    const button = page.getByRole('group', { name: 'Lead order' }).getByRole('button', { name: 'Move Claude down' });
    await expect(button).toBeVisible();
    await page.locator('[data-block="usage"]').evaluate((el) => {
      const nav = document.getElementById('app-nav').getBoundingClientRect().bottom;
      window.scrollBy(0, el.getBoundingClientRect().bottom - nav - 20);
    });
    const box = await button.boundingBox();
    const layout = await page.locator('[data-block="usage"]').evaluate((el) => ({ bottom: el.getBoundingClientRect().bottom, nav: document.getElementById('app-nav').getBoundingClientRect().bottom, room: document.documentElement.scrollHeight - innerHeight - scrollY }));
    expect(layout.bottom).toBeGreaterThan(layout.nav);
    expect(layout.room).toBeGreaterThan(200);
    expect(box.y).toBeGreaterThan(layout.nav);
    if (mode === 'focus') {
      await button.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(button).toBeFocused();
      await page.mouse.move(0, 0);
    } else {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      if (mode === 'press') await page.mouse.down();
    }
    release();
    await expect(page.locator('.usage-prov').first()).toBeVisible();
    const after = await button.boundingBox();
    expect(Math.abs(after.y - box.y)).toBeLessThanOrEqual(1);
    if (mode === 'press') {
      await page.mouse.up();
      await expect(page.locator('[data-order="lead_order"] li').nth(0)).toContainText('GPT');
      await expect(page.locator('[data-order="lead_order"] li').nth(1)).toContainText('Claude');
    }
  });
}

test('turning on another harness updates Accounts with a waiting card', async ({ page }) => {
  const switches = { claude: true, gpt: false, gemini: true, kimi: true, openrouter: true };
  const status = () => ({ switches, threads_using: {}, machines: [{ name: 'hub', reachable: true, harnesses: {} }] });
  await page.route('**/api/harnesses**', (route) => route.fulfill({ json: status() }));
  await page.route('**/api/settings/harnesses/gpt', (route) => { switches.gpt = true; return route.fulfill({ json: { harnesses: switches } }); });
  const card = await cardSetup(page, { signin: waiting, settings: { harnesses: switches } });
  await expect(page.locator('.prov-group[data-provider="gpt"]')).toHaveCount(0);
  await page.locator('.h-row[data-provider="gpt"] input[type="checkbox"]').check();
  await expect(page.locator('.prov-group[data-provider="gpt"]')).toBeVisible();
  await expect(card).toBeVisible();
});
