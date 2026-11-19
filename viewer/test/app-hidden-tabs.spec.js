'use strict';

// Hidden tabs (docs/plans/lighter-server, S6): pages stop polling while the tab is hidden, poll
// once at once when shown, and then keep a full interval between ticks. Visibility is simulated by
// overriding document.visibilityState; time moves only through Playwright's clock.
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

let ctx;
test.beforeEach(async ({ page }) => {
  ctx = await startWorld();
  await signIn(page, ctx);
  await page.addInitScript(() => {
    window.__vis = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
    window.__show = (visible) => { window.__vis = visible ? 'visible' : 'hidden'; document.dispatchEvent(new Event('visibilitychange')); };
  });
});
test.afterEach(async () => { await ctx.close(); });

// Counts requests by name; `reset` zeroes them.
function counter(page, names) {
  const counts = {};
  const reset = () => { for (const k of Object.keys(names)) counts[k] = 0; };
  reset();
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    for (const [k, re] of Object.entries(names)) if (re.test(path)) counts[k]++;
  });
  return { counts, reset };
}
const show = (page, visible) => page.evaluate((v) => window.__show(v), visible);
const settle = (page) => page.waitForTimeout(400);
// The installed clock keeps running in real time; freeze it so only runFor moves it.
const freeze = (page) => page.clock.pauseAt(new Date(Date.now() + 2000));

test('a list page pauses while hidden, polls once when shown, then a full interval later', async ({ page }) => {
  const c = counter(page, { threads: /\/api\/threads$/, sessions: /\/api\/sessions$/, alert: /\/usage\/alert$/ });
  await page.clock.install();
  await page.goto(`${ctx.server.url}/app/threads`);
  await expect.poll(() => c.counts.threads).toBeGreaterThanOrEqual(1);
  await freeze(page);
  await show(page, false);
  await settle(page); c.reset();
  await page.clock.runFor(300000);
  await settle(page);
  expect(c.counts.threads).toBe(0);
  expect(c.counts.sessions).toBe(0);
  expect(c.counts.alert).toBeGreaterThanOrEqual(1);   // the 5-minute alert check is not paused
  c.reset();
  await show(page, true);
  await expect.poll(() => c.counts.threads).toBe(1);
  await page.clock.runFor(4900); await settle(page);
  expect(c.counts.threads).toBe(1);
  await page.clock.runFor(200);
  await expect.poll(() => c.counts.threads).toBe(2);
});

test('the chat poll pauses while hidden and polls once when shown', async ({ page }) => {
  const made = await ctx.make({ cli: 'claude' });
  const c = counter(page, { chat: /\/chat$/ });
  await page.clock.install();
  await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
  await expect.poll(() => c.counts.chat).toBeGreaterThanOrEqual(1);
  await freeze(page);
  await show(page, false);
  await settle(page); c.reset();
  await page.clock.runFor(20000); await settle(page);
  expect(c.counts.chat).toBe(0);
  await show(page, true);
  await expect.poll(() => c.counts.chat).toBe(1);
  await page.clock.runFor(1900); await settle(page);
  expect(c.counts.chat).toBe(1);
  await page.clock.runFor(200);
  await expect.poll(() => c.counts.chat).toBe(2);
});

test('an aside poll pauses while hidden, and a closed aside is not polled on show', async ({ page }) => {
  const made = await ctx.make({ cli: 'claude' });
  const now = new Date().toISOString();
  await ctx.timedTranscript(made.id, [['human', 'Hello', now], ['assistant', 'Words to discuss.', now]]);
  const aside = { id: 'a1', number: 1, anchor: { message_id: '', start: 0, end: 5, quote: 'Words' }, created_at: now, status: 'open', slot: 'standard', cli_id: 'cli', heavy_usable: true, history: [{ kind: 'ask', text: 'why', reply: 'answer' }], turn: null, failed: null };
  await page.route('**/api/threads/*/chat', async (route) => {
    const response = await route.fetch(); const json = await response.json();
    aside.anchor.message_id = json.items.find((item) => item.role === 'assistant' || item.type === 'assistant')?.message_id || '';
    json.asides = [aside]; await route.fulfill({ response, json });
  });
  await page.route('**/api/threads/*/asides**', (route) => route.fulfill({ json: aside }));
  const c = counter(page, { aside: /\/asides\/a1$/ });
  await page.clock.install();
  await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
  await page.getByRole('button', { name: /1 asides/ }).click();
  await page.getByRole('button', { name: /Aside 1 ·/ }).click();
  await expect(page.locator('#aside-panel')).toContainText('answer');
  await expect.poll(() => c.counts.aside).toBeGreaterThanOrEqual(1);
  await freeze(page);
  await show(page, false);
  await settle(page); c.reset();
  await page.clock.runFor(20000); await settle(page);
  expect(c.counts.aside).toBe(0);
  await show(page, true);
  await expect.poll(() => c.counts.aside).toBe(1);
  await page.getByRole('button', { name: 'Close aside' }).click();
  await settle(page); c.reset();
  await show(page, false); await show(page, true);
  await page.clock.runFor(10000); await settle(page);
  expect(c.counts.aside).toBe(0);
});

test.describe('terminal pane', () => {
  async function openTerminal(page) {
    const c = counter(page, { pane: /\/signin\/beelink\/pane$/ });
    await page.route('**/api/accounts/**/signin/beelink/pane', (route) => route.fulfill({ json: { text: 'PANE\n' } }));
    await page.clock.install();
    await page.goto(`${ctx.server.url}/app/terminal?login=default-claude&machine=beelink`);
    await expect.poll(() => c.counts.pane).toBeGreaterThanOrEqual(1);
    await freeze(page);
    return c;
  }

  test('pauses while hidden and polls once when shown', async ({ page }) => {
    const c = await openTerminal(page);
    await show(page, false);
    await settle(page); c.reset();
    await page.clock.runFor(10000); await settle(page);
    expect(c.counts.pane).toBe(0);
    await show(page, true);
    await expect.poll(() => c.counts.pane).toBe(1);
    await page.clock.runFor(900); await settle(page);
    expect(c.counts.pane).toBe(1);
    await page.clock.runFor(200);
    await expect.poll(() => c.counts.pane).toBe(2);
  });

  test('a disposed terminal is not polled on show', async ({ page }) => {
    const c = await openTerminal(page);
    await page.evaluate(() => window.termView.destroy());
    await settle(page); c.reset();
    await show(page, false); await show(page, true);
    await page.clock.runFor(10000); await settle(page);
    expect(c.counts.pane).toBe(0);
  });
});

test('sign-in polling keeps going while the tab is hidden', async ({ page }) => {
  const c = counter(page, { signin: /\/accounts\/default-claude\/signin\/beelink$/ });
  const iso = (ms) => new Date(Date.now() + ms).toISOString();
  const usage = { providers: { claude: { label: 'Claude', left: 0.4, amber: false, runs_out_at: iso(1e8), first_refill: iso(2e8), below_notify: false, all_paused: false, accounts: [
    { id: 'default-claude', provider: 'claude', name: 'default', plan: 'max5', weight: 5, paused: false, machines: { hub: 'signed_in', beelink: 'signed_out' }, reading: null, next: true, reason: 'next', live_sessions: 0 }] } } };
  await page.route('**/api/usage', (route) => route.fulfill({ json: usage }));
  await page.route('**/api/accounts/*/signin{,/beelink}', (route) => route.fulfill({ status: route.request().method() === 'POST' ? 201 : 200, json: { state: 'waiting', url: 'https://claude.example/login', code: null, wantsCode: true, logged_in: false } }));
  await page.clock.install();
  await page.goto(`${ctx.server.url}/app/settings#accounts`);
  const button = page.locator('.acct[data-account="default-claude"] li[data-machine="beelink"] button');
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator('.signin-card')).toBeVisible();
  await freeze(page);
  await show(page, false);
  await settle(page); c.reset();
  await page.clock.runFor(10000);
  await expect.poll(() => c.counts.signin).toBeGreaterThanOrEqual(2);
});
