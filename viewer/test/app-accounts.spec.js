'use strict';

// The accounts interface: Settings Accounts and Usage, the sign-in card, the terminal page in
// login mode, the lead order editor, the Settings dot and the lead waiting line. The hub's
// usage and sign-in routes are answered by page.route here (their own tests live in
// app-usage.test.js and app-hub.test.js); the pages, the real server and the thread world are real.
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

async function noSideScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

let ctx;
test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
test.afterEach(async () => { await ctx.close(); });

const open = (page, hash) => page.goto(`${ctx.server.url}/app/settings#${hash}`);

for (const [label, size] of [['phone', { width: 375, height: 800 }], ['desktop', { width: 1280, height: 900 }]]) {
  test.describe(label, () => {
    test.use({ viewport: size });

    test('a Kimi account shows each machine\'s problem sentence in place of "signed out"', async ({ page }) => {
      const usage = usageBody();
      usage.providers.kimi = { label: 'Kimi Code', left: null, accounts: [{ id: 'default-kimi', provider: 'kimi', name: 'default', plan: 'unknown', weight: 1, paused: false, machines: { hub: 'signed_in', beelink: { state: 'problem', text: "signed in to Kimi's China region; log in again" }, laptop: 'signed_out' }, reading: null, live_sessions: 0 }] };
      await mock(page, { usage });
      await open(page, 'providers');
      const kimi = page.locator('.prov-group[data-provider="kimi"] .acct[data-account="default-kimi"]');
      await expect(kimi.locator('li[data-machine="hub"] .mstate')).toHaveText('signed in');
      await expect(kimi.locator('li[data-machine="beelink"] .mstate')).toHaveText("signed in to Kimi's China region; log in again");
      await expect(kimi.locator('li[data-machine="beelink"] button')).toHaveText('Sign in');
      await expect(kimi.locator('li[data-machine="hub"] button')).toHaveCount(0);
      await expect(kimi.locator('li[data-machine="laptop"] .mstate')).toHaveText('signed out');
    });

    test('Accounts groups accounts by provider with each machine\'s state', async ({ page }) => {
      await mock(page, {});
      await open(page, 'providers');
      await expect(page.locator('[data-block="accounts"] h2')).toHaveText('Accounts');
      const claude = page.locator('.prov-group[data-provider="claude"]');
      await expect(claude.locator('.acct')).toHaveCount(2);
      await expect(page.locator('.prov-group[data-provider="gpt"] .acct')).toHaveCount(1);
      const gemini = page.locator('.prov-group[data-provider="gemini"]');
      await expect(gemini).toContainText('Antigravity supports one account per machine');
      await expect(gemini.locator('.acct[data-account="default-gemini"]')).toHaveCount(1);
      await expect(gemini.getByRole('button', { name: 'Add account' })).toHaveCount(0);
      await claude.getByRole('button', { name: 'Add account' }).click();
      await expect(claude.locator('.add-form')).toHaveCount(1);
      await expect(page.locator('#add-provider')).toHaveValue('claude');
      await expect(page.locator('.add-form select').first().locator('option')).not.toContainText(['Antigravity']);
      await page.locator('.prov-group[data-provider="gpt"]').getByRole('button', { name: 'Add account' }).click();
      await expect(page.locator('.prov-group[data-provider="gpt"] .add-form')).toHaveCount(1);
      await expect(page.locator('#add-provider')).toHaveValue('gpt');
      const first = claude.locator('.acct[data-account="default-claude"]');
      await expect(first).toContainText('Max 5x');
      await expect(first).toContainText('in use · 2 agents');
      await expect(first.locator('li[data-machine="hub"] .mstate')).toHaveText('signed in');
      await expect(first.locator('li[data-machine="beelink"] .mstate')).toHaveText('signed out');
      await expect(first.locator('li[data-machine="laptop"] .mstate')).toHaveText('unknown');
      await expect(first.locator('li[data-machine="hub"] button')).toHaveCount(0);
      await expect(first.locator('li[data-machine="beelink"] button')).toHaveText('Sign in');
      await expect(first).toContainText('42% used');
      await expect(first).toContainText('61% used');
      await expect(first).toContainText('as of');
      await expect(claude.locator('.acct[data-account="work"]')).toContainText('no reading yet');
      await expect(first.getByRole('button', { name: 'Remove' })).toHaveCount(1);
      await expect(claude.locator('.acct[data-account="work"]').getByRole('button', { name: 'Resume' })).toBeVisible();
      await noSideScroll(page);
    });

    test('the Claude sign-in card shows the link and the paste box, and posts the code', async ({ page }) => {
      const state = { signin: { state: 'waiting', url: 'https://claude.example/login', code: null, wantsCode: true, logged_in: false } };
      await mock(page, state);
      await open(page, 'providers');
      await page.locator('.acct[data-account="default-claude"] li[data-machine="beelink"] button').click();
      const card = page.locator('.signin-card');
      await expect(card.getByRole('link', { name: 'Open sign-in link' })).toHaveAttribute('href', 'https://claude.example/login');
      await expect(card.getByRole('link', { name: 'Open sign-in link' })).toHaveAttribute('target', '_blank');
      await card.getByPlaceholder('Paste the code here').fill('abc-123');
      await card.getByRole('button', { name: 'Send code' }).click();
      await expect.poll(() => state.calls.find((c) => c[1].endsWith('/code'))).toBeTruthy();
      expect(state.calls.find((c) => c[1].endsWith('/code'))[2]).toEqual({ code: 'abc-123' });
      expect(state.calls.find((c) => c[0] === 'POST' && c[1].endsWith('/signin'))[2]).toEqual({ machine: 'beelink' });
      await expect(card.getByRole('link', { name: 'Open terminal' })).toHaveAttribute('href', /terminal\?login=default-claude&machine=beelink/);
      await noSideScroll(page);
      // Done and signed in: the card turns green and closes.
      state.signin = { state: 'done', url: null, code: null, wantsCode: false, logged_in: true };
      await expect(card).toHaveClass(/done/, { timeout: 6000 });
      await expect(card).toHaveCount(0, { timeout: 6000 });
    });

    test('a failed code on a Claude account shows the error and keeps the code, with no Start again', async ({ page }) => {
      const state = { signin: { state: 'waiting', url: 'https://claude.example/login', code: null, wantsCode: true, logged_in: false }, codeError: 'tmux submit failed' };
      await mock(page, state);
      await open(page, 'providers');
      await page.locator('.acct[data-account="default-claude"] li[data-machine="beelink"] button').click();
      const card = page.locator('.signin-card');
      await card.getByPlaceholder('Paste the code here').fill('abc-123');
      await card.getByRole('button', { name: 'Send code' }).click();
      await expect(card.locator('.inline-err')).toHaveText('tmux submit failed');
      await expect(card.getByPlaceholder('Paste the code here')).toHaveValue('abc-123');
      await expect(card.getByRole('button', { name: 'Start again' })).toHaveCount(0);
    });

    test('a failed key on an OpenRouter account clears the key and offers one Start again', async ({ page }) => {
      const usage = usageBody();
      usage.providers.openrouter = { label: 'OpenRouter', left: null, accounts: [{ id: 'default-openrouter', provider: 'openrouter', name: 'default', plan: 'unknown', weight: 1, paused: false, machines: { beelink: 'signed_out' }, reading: null, live_sessions: 0 }] };
      const state = { usage, signin: { state: 'waiting', url: null, code: null, wantsCode: true, logged_in: false }, codeError: 'the sign-in screen has moved on; start again' };
      await mock(page, state);
      await open(page, 'providers');
      await page.locator('.acct[data-account="default-openrouter"] li[data-machine="beelink"] button').click();
      const card = page.locator('.signin-card');
      const key = card.getByPlaceholder('Paste your OpenRouter key');
      await key.fill('sk-or-test-1');
      await card.getByRole('button', { name: 'Send code' }).click();
      await expect(card.locator('.inline-err')).toHaveText('the sign-in screen has moved on; start again');
      await expect(key).toHaveValue('');
      await expect(card.getByRole('button', { name: 'Start again' })).toHaveCount(1);
      await key.fill('sk-or-test-2');
      await card.getByRole('button', { name: 'Send code' }).click();
      await expect.poll(() => state.calls.filter((c) => c[1].endsWith('/code')).length).toBe(2);
      await expect(key).toHaveValue('');
      await expect(card.getByRole('button', { name: 'Start again' })).toHaveCount(1);
    });

    test('Antigravity sign-in opens Google and posts the code', async ({ page }) => {
      const state = { signin: { state: 'waiting', url: 'https://accounts.google.com/o/oauth2/auth?x=1', wantsCode: true } };
      await mock(page, state);
      await open(page, 'providers');
      await page.locator('.acct[data-account="default-gemini"] li[data-machine="beelink"] button').click();
      const card = page.locator('.signin-card');
      await expect(card.getByRole('link', { name: 'Open sign-in link' })).toHaveAttribute('href', state.signin.url);
      await card.getByPlaceholder('Paste the code here').fill('google-code');
      await card.getByRole('button', { name: 'Send code' }).click();
      await expect.poll(() => state.calls.find((c) => c[1] === '/accounts/default-gemini/signin/beelink/code')).toEqual(['POST', '/accounts/default-gemini/signin/beelink/code', { code: 'google-code' }]);
    });

    test('the Codex sign-in card shows the link and the big code with Copy', async ({ page }) => {
      const state = { signin: { state: 'waiting', url: 'https://codex.example/device', code: 'ABCD-1234', wantsCode: false, logged_in: false } };
      await mock(page, state);
      // The GPT account is signed out on the hub, so its Sign in button is offered.
      state.usage = usageBody();
      state.usage.providers.gpt.accounts[0].machines.hub = 'signed_out';
      await open(page, 'providers');
      await page.locator('.acct[data-account="default-gpt"] li[data-machine="hub"] button').click();
      const card = page.locator('.signin-card');
      await expect(card.getByRole('link', { name: 'https://codex.example/device' })).toBeVisible();
      await expect(card.locator('.device-code')).toHaveText('ABCD-1234');
      await expect(card.getByRole('button', { name: 'Copy' })).toBeVisible();
      await expect(card.getByPlaceholder('Paste the code here')).toBeHidden();
      await noSideScroll(page);
    });

    test('a failed sign-in shows the fallback and an Open terminal link', async ({ page }) => {
      await mock(page, { signin: { state: 'failed', url: null, code: null, wantsCode: false, logged_in: false } });
      await open(page, 'providers');
      await page.locator('.acct[data-account="default-claude"] li[data-machine="beelink"] button').click();
      const card = page.locator('.signin-card');
      await expect(card).toContainText("Couldn't read the sign-in screen", { timeout: 6000 });
      await expect(card.getByRole('link', { name: 'Open terminal' }).first()).toBeVisible();
    });

    test('a second Claude account warns once, and Cancel saves nothing', async ({ page }) => {
      const state = {};
      await mock(page, state);
      await open(page, 'providers');
      await page.locator('.prov-group[data-provider="claude"] .add-account').click();
      await page.locator('#add-name').fill('Spare');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.locator('#claude-warning')).toContainText("Anthropic's terms say plan limits assume ordinary, individual use. Several Claude accounts behind one setup may get flagged.");
      await page.locator('#add-cancel').click();
      await expect(page.locator('.add-form')).toHaveCount(0);
      expect(state.calls.filter((c) => c[1] === '/settings/accounts')).toHaveLength(0);
      // Again, and this time Add anyway.
      await page.locator('.prov-group[data-provider="claude"] .add-account').click();
      await page.locator('#add-name').fill('Spare');
      await page.getByRole('button', { name: 'Save' }).click();
      state.usage = usageBody();
      state.usage.providers.claude.accounts.push({ id: 'new-one', provider: 'claude', name: 'Spare', plan: 'unknown', weight: 1, paused: false,
        machines: { hub: 'signed_out', beelink: 'signed_out' }, reading: null, next: false, reason: 'skipped: signed out on hub', live_sessions: 0 });
      await page.locator('#add-anyway').click();
      await expect.poll(() => state.calls.filter((c) => c[1] === '/settings/accounts').length).toBe(1);
      expect(state.calls.find((c) => c[1] === '/settings/accounts')[2]).toMatchObject({ provider: 'claude', name: 'Spare', plan: 'unknown' });
      await expect(page.locator('.just-added').first()).toContainText('Sign in on');
      await noSideScroll(page);
    });

    test('adding a GPT account does not warn', async ({ page }) => {
      const state = {};
      await mock(page, state);
      await open(page, 'providers');
      await page.locator('.prov-group[data-provider="gpt"] .add-account').click();
      await expect(page.locator('#add-provider')).toHaveValue('gpt');
      await page.locator('#add-name').fill('Second GPT');
      await page.locator('#add-plan').selectOption('pro');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect.poll(() => state.calls.filter((c) => c[1] === '/settings/accounts').length).toBe(1);
      await expect(page.locator('#claude-warning')).toHaveCount(0);
    });

    test('changing provider in an open Add account form keeps the form visible', async ({ page }) => {
      await mock(page, {});
      await open(page, 'providers');
      const openrouter = page.locator('.prov-group[data-provider="openrouter"]');
      await openrouter.locator('.add-account').click();
      await expect(page.locator('#add-provider')).toHaveValue('openrouter');
      await page.locator('#add-provider').selectOption('claude');
      await expect(page.locator('.prov-group[data-provider="claude"] .add-form')).toBeVisible();
      const inView = await page.locator('.add-form').evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight;
      });
      expect(inView).toBe(true);
    });

    test('a pending save on one provider does not clear a newer draft opened on another', async ({ page }) => {
      const state = {};
      await mock(page, state);
      let releaseSave;
      const saveHeld = new Promise((resolve) => { releaseSave = resolve; });
      await page.route('**/wheelchair/api/settings/accounts', async (route) => {
        if (route.request().method() !== 'POST') return route.fallback();
        await saveHeld;
        return route.fulfill({ status: 201, json: { id: 'new-gpt' } });
      });
      await open(page, 'providers');
      await page.locator('.prov-group[data-provider="gpt"] .add-account').click();
      await page.locator('#add-name').fill('Second GPT');
      await page.getByRole('button', { name: 'Save' }).click();
      await page.locator('.prov-group[data-provider="claude"] .add-account').click();
      await page.locator('#add-name').fill('Claude Draft');
      releaseSave();
      await expect(page.locator('.prov-group[data-provider="claude"] .add-form')).toBeVisible();
      await expect(page.locator('#add-name')).toHaveValue('Claude Draft');
    });

    test('Usage shows bars, the amber line and the account table with reasons', async ({ page }) => {
      await mock(page, {});
      await open(page, 'usage');
      await expect(page.locator('.catview h1')).toHaveText('Usage and balancing');
      const claude = page.locator('.usage-prov[data-provider="claude"]');
      await expect(claude.locator('.usage-left')).toHaveText('40% left');
      await expect(claude.locator('.usage-line.amber').first()).toContainText(/^Runs out \w+ (morning|afternoon|evening|night), before the first refill/);
      await expect(claude).toContainText('Under your notify line');
      const gpt = page.locator('.usage-prov[data-provider="gpt"]');
      await expect(gpt).toContainText('All accounts paused');
      await claude.locator('.usage-toggle').click();
      const table = claude.locator('.usage-table');
      await expect(table.locator('tr[data-account="default-claude"]')).toContainText('next: refills soonest');
      await expect(table.locator('tr[data-account="default-claude"] .v-badge')).toHaveText('next');
      await expect(table.locator('tr[data-account="work"]')).toContainText('skipped: paused');
      await expect(table.locator('tr[data-account="default-claude"]')).toContainText('42%');
      await noSideScroll(page);
    });

    test('Usage says no reading yet when there is none', async ({ page }) => {
      const usage = usageBody();
      usage.providers.gpt.all_paused = false;
      await mock(page, { usage });
      await open(page, 'usage');
      await expect(page.locator('.usage-prov[data-provider="gpt"]')).toContainText('no reading yet');
    });

    test('Usage says no accounts added when a provider has none', async ({ page }) => {
      const usage = usageBody();
      usage.providers.gpt.accounts = [];
      await mock(page, { usage });
      await open(page, 'usage');
      const gpt = page.locator('.usage-prov[data-provider="gpt"]');
      await expect(gpt).toContainText('No accounts added');
      await expect(gpt).not.toContainText('All accounts paused');
    });

    test('balancing saves, and a 400 shows inline', async ({ page }) => {
      const state = { balancingError: 'leave must be between 0 and 100' };
      await mock(page, state);
      await open(page, 'usage');
      await page.locator('#bal-leave').fill('150');
      await page.locator('#bal-within').selectOption('spread');
      await page.locator('#bal-held-reviewer').uncheck();
      expect(state.calls.filter((c) => c[1] === '/settings/balancing')).toHaveLength(0);
      await page.locator('#bal-save').click();
      await expect(page.locator('.balancing .inline-err')).toHaveText('leave must be between 0 and 100');
      state.balancingError = null;
      await page.locator('#bal-save').click();
      await expect(page.locator('.balancing .note')).toHaveText(/Saved/);
      const sent = state.calls.filter((c) => c[1] === '/settings/balancing').pop()[2];
      expect(sent).toMatchObject({ leave: 150, within: 'spread', held_back: { worker: true, reviewer: false, verifier: true, mapper: true } });
      expect(Object.keys(sent).sort()).toEqual(['held_back', 'leave', 'margin', 'notify_below', 'save_for_leads', 'within']);
      await noSideScroll(page);
    });

    test('reserve labels follow the returned provider without reloading', async ({ page }) => {
      const state = { settings: { lead_order: ['gpt', 'any'], reserved_provider: 'GPT' }, savedProvider: 'Claude' };
      await mock(page, state);
      await open(page, 'usage');
      await expect(page.locator('[data-order]')).toHaveCount(0);
      const checkbox = page.locator('#bal-save-lead');
      await expect(checkbox).toHaveAttribute('aria-label', 'Save GPT for leads');
      await expect(checkbox.locator('..')).toContainText('Save GPT for leads');
      await expect(page.locator('.balancing')).toContainText('Held back when GPT runs short');
      await page.locator('#bal-save').click();
      await expect(checkbox).toHaveAttribute('aria-label', 'Save Claude for leads');
      await expect(page.locator('.balancing')).toContainText('When Claude is projected to have less than this left at refill');
      state.settings.reserved_provider = null;
      await page.reload();
      await expect(checkbox).toHaveAttribute('aria-label', "Save the lead's provider for leads");
      await expect(checkbox.locator('..')).toContainText("Save the lead's provider for leads");
      await noSideScroll(page);
    });

    test('review family choice saves and updates its hint', async ({ page }) => {
      const state = {};
      await mock(page, state);
      await open(page, 'models');
      const group = page.getByRole('radiogroup', { name: 'Reviewers and checkers' });
      await expect(group.getByRole('radio')).toHaveText(['Mix families', 'Claude', 'GPT', 'Antigravity', 'Kimi Code', 'OpenRouter']);
      await group.getByRole('radio', { name: 'Antigravity' }).click();
      await expect(group.getByRole('radio', { name: 'Antigravity' })).toHaveAttribute('aria-checked', 'true');
      expect(state.calls.find((c) => c[1] === '/settings/preferences')[2]).toEqual({ review_families: 'gemini' });
      await expect(group.locator('..')).toContainText('One plan reviewer and the checker, both on Antigravity.');
      await noSideScroll(page);
    });

    test('the Lead ladder on Models saves through the balancing route', async ({ page }) => {
      const state = { savedProvider: 'GPT' };
      await mock(page, state);
      await open(page, 'models');
      const editor = page.locator('[data-order="lead_order"]');
      await expect(editor.getByRole('button', { name: '+ Antigravity' })).toBeVisible();
      await expect(editor.locator('li').first()).toContainText('Claude');
      await editor.getByRole('button', { name: '+ GPT' }).click();
      await editor.getByRole('button', { name: 'Move Claude down' }).click();
      await editor.locator('input[type="checkbox"]').uncheck();
      const sent = () => state.calls.filter((c) => c[1] === '/settings/balancing').map((c) => c[2]);
      await expect.poll(() => sent().length).toBe(3);
      expect(sent().at(-1)).toEqual({ lead_order: ['gpt', 'claude'] });
      await expect(page.locator('.note[data-for="section"]')).toHaveText(/Saved/);
      await noSideScroll(page);
    });

    test('the new-thread form has no CLI picker', async ({ page }) => {
      await mock(page, {});
      await page.goto(`${ctx.server.url}/app/threads?new=1`);
      await expect(page.locator('#nt-project')).toBeVisible();
      await expect(page.locator('#nt-cli')).toHaveCount(0);
    });
  });
}

test.describe('accounts interface paths', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  const acct = (page, id) => page.locator(`.acct[data-account="${id}"]`);

  test('the reported Codex plan shows beside the chosen plan only when they differ', async ({ page }) => {
    const usage = usageBody();
    const gpt = usage.providers.gpt.accounts[0];
    gpt.plan = 'plus';
    gpt.reading = { account: 'default-gpt', at: iso(-60000), five_hour: null, week: null, plan_type: 'pro' };
    usage.providers.claude.accounts[0].reading.plan_type = 'Max5'; // matches the chosen plan's id, loosely
    usage.providers.claude.accounts[1].plan = 'unknown';
    usage.providers.claude.accounts[1].reading = { account: 'work', at: iso(-60000), five_hour: null, week: null, plan_type: 'pro' };
    await mock(page, { usage });
    await open(page, 'providers');
    await expect(acct(page, 'default-gpt').locator('.v-badge').first()).toHaveText('Plus · reported: pro · weight 1');
    await expect(acct(page, 'default-claude').locator('.v-badge').first()).not.toContainText('reported');
    await expect(acct(page, 'work').locator('.v-badge').first()).toContainText('reported: pro');
  });

  test('Antigravity keeps polling while finishing a slow sign-in', async ({ page }) => {
    const state = { signin: { state: 'waiting', url: 'https://accounts.google.com/o/oauth2/auth?x=1', wantsCode: true } };
    await mock(page, state);
    await page.clock.install();
    await open(page, 'providers');
    await acct(page, 'default-gemini').locator('li[data-machine="beelink"] button').click();
    const card = page.locator('.signin-card');
    await expect(card.getByRole('link', { name: 'Open sign-in link' })).toBeVisible();
    await card.getByPlaceholder('Paste the code here').fill('google-code');
    await card.getByRole('button', { name: 'Send code' }).click();
    await expect.poll(() => state.calls.some((c) => c[1].endsWith('/code'))).toBe(true);
    state.signin = { state: 'starting', url: null, wantsCode: false, logged_in: false };
    await page.clock.runFor(60000);
    await expect(card).toContainText('Finishing sign-in on beelink');
    await expect(card).not.toContainText("Couldn't read the sign-in screen");
    await expect(card.locator('.spinner')).toBeVisible();
    await expect(card.getByRole('link', { name: 'Open sign-in link' })).toHaveCount(0);
    await expect(card.getByPlaceholder('Paste the code here')).toBeHidden();
    const polls = () => state.calls.filter((c) => c[0] === 'GET' && c[1] === '/accounts/default-gemini/signin/beelink').length;
    const before = polls();
    await page.clock.runFor(6000);
    await expect.poll(polls).toBeGreaterThan(before);
    state.signin = { state: 'done', url: null, wantsCode: false, logged_in: true };
    await page.clock.runFor(6000);
    await expect(page.locator('.signin-card')).toHaveCount(0);
  });

  test('Antigravity sign-in gives up after the finish limit', async ({ page }) => {
    const state = { signin: { state: 'waiting', url: 'https://accounts.google.com/o/oauth2/auth?x=1', wantsCode: true } };
    await mock(page, state);
    await page.clock.install();
    await open(page, 'providers');
    await acct(page, 'default-gemini').locator('li[data-machine="beelink"] button').click();
    const card = page.locator('.signin-card');
    await expect(card.getByRole('link', { name: 'Open sign-in link' })).toBeVisible();
    state.signin = { state: 'starting', url: null, wantsCode: false, logged_in: false };
    await page.clock.runFor(10 * 60 * 1000 + 5000);
    await expect(card).toContainText("Couldn't read the sign-in screen");
    await expect(card.getByRole('link', { name: 'Open terminal' }).first()).toBeVisible();
  });

  test('the sign-in card gives up after 30 seconds without a link', async ({ page }) => {
    const state = { signin: { state: 'waiting', url: null, code: null, wantsCode: false, logged_in: false } };
    await mock(page, state);
    await page.clock.install();
    await open(page, 'providers');
    await page.locator('.acct[data-account="default-claude"] li[data-machine="beelink"] button').click();
    const card = page.locator('.signin-card');
    await expect(card).toContainText('Starting sign-in on beelink');
    await expect.poll(() => state.calls.some((c) => c[0] === 'GET')).toBe(true);
    await expect(card).not.toContainText("Couldn't read the sign-in screen");
    await page.clock.runFor(34000);
    await expect(card).toContainText("Couldn't read the sign-in screen");
    await expect(card.getByRole('link', { name: 'Open terminal' }).first()).toBeVisible();
  });

  test('Rename sends the new name and the card shows it', async ({ page }) => {
    const usage = usageBody();
    const state = { usage, onAccount: (m, id, body) => { if (body.name) usage.providers.claude.accounts.find((a) => a.id === id).name = body.name; } };
    await mock(page, state);
    await open(page, 'providers');
    await acct(page, 'work').getByRole('button', { name: 'Rename' }).click();
    await acct(page, 'work').getByLabel('Account name').fill('Side job');
    await acct(page, 'work').getByRole('button', { name: 'Save' }).click();
    await expect(acct(page, 'work').locator('.acct-name')).toHaveText('Side job');
    expect(state.calls.find((c) => c[0] === 'PUT' && c[1] === '/settings/accounts/work')[2]).toEqual({ name: 'Side job' });
  });

  test('Change plan sends the plan and the weight override', async ({ page }) => {
    const usage = usageBody();
    const state = { usage, onAccount: (m, id, body) => { Object.assign(usage.providers.claude.accounts.find((a) => a.id === id), body); } };
    await mock(page, state);
    await open(page, 'providers');
    await acct(page, 'work').getByRole('button', { name: 'Change plan' }).click();
    await acct(page, 'work').getByLabel('Plan').selectOption('max20');
    await acct(page, 'work').getByLabel('Weight override').fill('2.5');
    await acct(page, 'work').getByRole('button', { name: 'Save' }).click();
    await expect(acct(page, 'work').locator('.v-badge').first()).toContainText('weight 2.5');
    expect(state.calls.find((c) => c[0] === 'PUT' && c[1] === '/settings/accounts/work')[2]).toEqual({ plan: 'max20', weight: 2.5 });
    // Blank weight sends the plan alone.
    await acct(page, 'work').getByRole('button', { name: 'Change plan' }).click();
    await acct(page, 'work').getByLabel('Plan').selectOption('pro');
    await acct(page, 'work').getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => state.calls.filter((c) => c[0] === 'PUT').length).toBe(2);
    expect(state.calls.filter((c) => c[0] === 'PUT')[1][2]).toEqual({ plan: 'pro' });
  });

  test('Remove asks first, then deletes; default accounts can be removed and added back', async ({ page }) => {
    const usage = usageBody();
    const state = { usage, onAccount: (m, id) => { if (m === 'DELETE') usage.providers.claude.accounts = usage.providers.claude.accounts.filter((a) => a.id !== id); } };
    await mock(page, state);
    await open(page, 'providers');
    for (const id of ['default-claude', 'default-gpt']) await expect(acct(page, id).getByRole('button', { name: 'Remove' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Add back the default login' })).toHaveCount(0);
    await acct(page, 'work').getByRole('button', { name: 'Remove' }).click();
    await expect(acct(page, 'work')).toContainText('Remove Work?');
    expect(state.calls.some((c) => c[0] === 'DELETE')).toBe(false);
    await acct(page, 'work').getByRole('button', { name: 'Keep' }).click();
    await expect(acct(page, 'work').getByRole('button', { name: 'Rename' })).toBeVisible();
    await acct(page, 'work').getByRole('button', { name: 'Remove' }).click();
    await acct(page, 'work').getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(acct(page, 'work')).toHaveCount(0);
    expect(state.calls.filter((c) => c[0] === 'DELETE').map((c) => c[1])).toEqual(['/settings/accounts/work']);
  });

  test('a removed default account offers Add back the default login', async ({ page }) => {
    const usage = usageBody();
    usage.providers.claude.accounts = usage.providers.claude.accounts.filter((a) => a.id !== 'default-claude');
    const state = { usage, settings: { accounts: [{ id: 'work', provider: 'claude', name: 'Work', plan: 'pro', weight: 1, paused: true }, { id: 'default-gpt', provider: 'gpt', name: 'default', plan: 'unknown', weight: 1, paused: false }, { id: 'default-gemini', provider: 'gemini', name: 'default', plan: 'unknown', weight: 1, paused: false }] } };
    await mock(page, state);
    await open(page, 'providers');
    const claude = page.locator('section.prov-group[data-provider="claude"]');
    await expect(claude.getByRole('button', { name: 'Add back the default login' })).toBeVisible();
    await expect(page.locator('section.prov-group[data-provider="gpt"]').getByRole('button', { name: 'Add back the default login' })).toHaveCount(0);
    await claude.getByRole('button', { name: 'Add back the default login' }).click();
    await expect.poll(() => state.calls.filter((c) => c[0] === 'POST').map((c) => c[1])).toEqual(['/settings/accounts/default-claude/restore']);
  });

  test('usage refreshes every 30 seconds on Accounts and Usage, and stops elsewhere', async ({ page }) => {
    const state = {};
    await mock(page, state);
    await page.clock.install();
    await open(page, 'providers');
    await expect(page.locator('.acct')).toHaveCount(6);
    let seen = state.usageGets;
    await page.clock.runFor(30500);
    await expect.poll(() => state.usageGets).toBeGreaterThan(seen);
    // Usage keeps the same timer.
    await page.locator('#sections a[data-section="usage"]').click();
    await expect(page.locator('.catview h1')).toHaveText('Usage and balancing');
    await expect.poll(() => state.usageGets).toBeGreaterThan(seen);
    await page.waitForTimeout(300);
    seen = state.usageGets;
    await page.clock.runFor(30500);
    await expect.poll(() => state.usageGets).toBeGreaterThan(seen);
    // Another section stops it.
    await page.locator('#sections a[data-section="models"]').click();
    await expect(page.locator('.catview h1')).toHaveText('Models');
    await page.waitForTimeout(300);
    seen = state.usageGets;
    await page.clock.runFor(95000);
    await page.waitForTimeout(500);
    expect(state.usageGets).toBe(seen);
  });
});

test.describe('nav dot', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test('shows while usage is short and clears after opening Usage', async ({ page }) => {
    const state = {};
    await mock(page, state);
    await page.goto(`${ctx.server.url}/app/threads`);
    await expect(page.locator('#app-nav .usage-dot')).toBeVisible();
    await page.goto(`${ctx.server.url}/app/settings#usage`);
    await expect(page.locator('.catview h1')).toHaveText('Usage and balancing');
    await expect(page.locator('#app-nav .usage-dot')).toBeHidden();
    expect(state.calls.some((c) => c[1] === '/usage/seen')).toBe(true);
    await page.goto(`${ctx.server.url}/app/threads`);
    await expect(page.locator('#app-nav .usage-dot')).toBeHidden();
  });
});

test.describe('lead waiting line', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  const openThread = (page, id) => page.goto(`${ctx.server.url}/app/thread?id=${id}`);

  test('a waiting lead shows when the provider refills', async ({ page }) => {
    const made = await ctx.make({ cli: 'claude' });
    await ctx.patch(made.id, (t) => { Object.assign(t.sessions[0], { status: 'waiting', provider: 'gpt', waiting_until: iso(3 * HOUR) }); });
    await openThread(page, made.id);
    await expect(page.locator('#lead-wait')).toHaveText(/^Waiting for GPT to refill, about \d/);
    await noSideScroll(page);
  });

  test('a waiting lead pinned to a provider names it when the lead has none', async ({ page }) => {
    const made = await ctx.make({ cli: 'claude' });
    await ctx.patch(made.id, (t) => { delete t.provider; delete t.sessions[0].provider; Object.assign(t.sessions[0], { status: 'waiting', waiting_provider: 'gpt', waiting_until: iso(3 * HOUR) }); });
    await openThread(page, made.id);
    await expect(page.locator('#lead-wait')).toHaveText(/^Waiting for GPT to refill, about \d/);
  });

  test('a waiting lead with no provider anywhere says it is waiting for room', async ({ page }) => {
    const made = await ctx.make({ cli: 'claude' });
    // The hub derives thread.provider from thread.cli on read, so both must go for "no provider anywhere".
    await ctx.patch(made.id, (t) => { delete t.cli; delete t.provider; delete t.sessions[0].cli; delete t.sessions[0].provider; Object.assign(t.sessions[0], { status: 'waiting', waiting_until: iso(3 * HOUR) }); });
    await openThread(page, made.id);
    await expect(page.locator('#lead-wait')).toHaveText(/^Waiting for room, about \d/);
  });

  test('a limited running lead names the account', async ({ page }) => {
    const made = await ctx.make({ cli: 'claude' });
    await ctx.patch(made.id, (t) => { Object.assign(t.sessions[0], { account: 'default-claude', provider: 'claude', limited_until: iso(2 * HOUR) }); });
    await openThread(page, made.id);
    await expect(page.locator('#lead-wait')).toHaveText(/^Waiting for default to refill, about \d/);
  });

  test('hidden when the lead is fine or the limit has passed', async ({ page }) => {
    const made = await ctx.make({ cli: 'claude' });
    await openThread(page, made.id);
    await expect(page.locator('#head h1')).toBeVisible();
    await expect(page.locator('#lead-wait')).toBeHidden();
    await ctx.patch(made.id, (t) => { t.sessions[0].limited_until = iso(-HOUR); });
    await page.reload();
    await expect(page.locator('#head h1')).toBeVisible();
    await expect(page.locator('#lead-wait')).toBeHidden();
  });
});

test.describe('terminal login mode', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('reads the login pane and sends keys to the login route', async ({ page }) => {
    const state = {};
    const panes = [];
    page.on('request', request => { if (request.url().includes('/signin/beelink/pane')) panes.push(request.url()); });
    await mock(page, state);
    await page.goto(`${ctx.server.url}/app/terminal?login=default-claude&machine=beelink`);
    await expect(page.locator('#term-status')).toHaveText('live');
    await expect(page.locator('#term-name')).toContainText('default-claude');
    expect(state.calls.some((c) => c[1] === '/accounts/default-claude/signin/beelink/pane')).toBe(true);
    expect(panes.every(url => !new URL(url).searchParams.has('history'))).toBe(true);
    await page.getByRole('button', { name: 'View only' }).click();
    await page.locator('.tv-keys button[data-key="Enter"]').click();
    await expect.poll(() => state.calls.find((c) => c[0] === 'POST' && c[1].endsWith('/keys'))).toBeTruthy();
    const keys = state.calls.find((c) => c[0] === 'POST' && c[1].endsWith('/keys'));
    expect(keys[1]).toBe('/accounts/default-claude/signin/beelink/keys');
    expect(keys[2]).toEqual({ keys: 'Enter' });
  });
});
