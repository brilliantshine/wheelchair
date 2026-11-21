'use strict';

// The Settings Harnesses section and the home "Set up an agent" checklist, against a real server
// with the harness routes stubbed in the page (page.route), so they do not depend on the hub's
// harness code or on any real install.
const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { makeDir, startServer } = require('./helpers/server.js');
const { openPage } = require('./helpers/app-views-setup.js');

let context;
test.beforeAll(async () => {
  const state = await makeDir('app-harnesses-state-');
  await fs.writeFile(path.join(state, 'projects.json'), JSON.stringify(['/tmp/proj-alpha']));
  const modelsCache = path.join(state, 'models-cache.json');
  await fs.writeFile(modelsCache, JSON.stringify({ models: [] }));
  const server = await startServer({ stateDir: state, env: { WHEELCHAIR_MODELS: path.join(state, 'models'), WHEELCHAIR_MODELS_CACHE: modelsCache } });
  context = { state, server };
});
test.afterAll(async () => { await context.server.stop(); });

const NAMES = ['claude', 'gpt', 'gemini', 'kimi', 'openrouter'];
const h = (over = {}) => ({ installed: false, version: null, signed_in: false, recipe: true, ...over });
function status(over = {}, extra = {}) {
  return {
    switches: { claude: true, gpt: true, gemini: true, kimi: true, openrouter: true },
    threads_using: {},
    machines: [{ name: 'hub', reachable: true, harnesses: Object.fromEntries(NAMES.map((n) => [n, h()])) }],
    can_start: { machine: 'hub', lead: { ok: true }, worker: { ok: true } },
    ...extra,
    ...over,
  };
}
const json = (route, body, code = 200) => route.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(body) });
// A settings GET stub: fetch the real body, patch it, fulfil. The test can end while the real
// response is still in flight (a reload after a POST), so any late failure is swallowed here
// instead of failing the test with "Test ended while running route callback".
async function patchSettings(r, patch) {
  try {
    const body = await (await r.fetch()).json();
    await json(r, patch(body));
  } catch {
    await r.abort().catch(() => {});
  }
}
// The page's settings reload after a POST: registered before the click that sends the POST.
const settingsGet = (page) => page.waitForResponse((res) => res.request().method() === 'GET' && res.url().endsWith('/api/settings'));

// Routes the page needs; `world` is read on each request so a test can change it mid-run.
async function stub(page, world) {
  world.calls = [];
  await page.route('**/api/harnesses**', (route) => { world.calls.push(route.request().url()); return world.harnesses(route); });
  await page.route('**/api/machines/*/harnesses/*/install', (route) => {
    world.calls.push(route.request().method() + ' ' + new URL(route.request().url()).pathname);
    return world.install(route);
  });
  await page.route('**/api/settings/harnesses/*', (route) => world.put(route));
}
const rows = (page) => page.locator('.h-row');
const row = (page, p) => page.locator(`.h-row[data-provider="${p}"]`);

for (const [label, size] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
  test.describe(label, () => {
    test.use({ viewport: size });
    test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }); });

    test('five rows, states, vendor link, no sideways scroll', async ({ page }) => {
      const s = status();
      s.machines[0].harnesses.claude = h({ installed: true, version: '2.1.0', signed_in: true });
      s.machines[0].harnesses.gpt = h({ installed: true, version: '0.9.0' });
      s.machines[0].harnesses.gemini = h({ recipe: false });
      await stub(page, { harnesses: (r) => json(r, s), install: (r) => json(r, { state: 'idle' }), put: (r) => json(r, {}) });
      await openPage(page, context, '/app/settings#harnesses');
      await expect(rows(page)).toHaveCount(5);
      await expect(rows(page).locator('strong')).toHaveText(['Claude Code', 'Codex', 'Antigravity', 'Kimi Code', 'Pi (OpenRouter)']);
      await expect(row(page, 'claude')).toContainText('Signed in');
      await expect(row(page, 'claude').getByRole('button')).toHaveCount(0);
      await expect(row(page, 'gpt')).toContainText('Installed 0.9.0');
      await expect(row(page, 'gpt').getByRole('button', { name: 'Sign in Codex' })).toBeVisible();
      await expect(row(page, 'gemini')).toContainText('Not installed');
      const link = row(page, 'gemini').getByRole('link', { name: "Install from Google's site" });
      await expect(link).toHaveAttribute('href', 'https://antigravity.google/cli');
      await expect(row(page, 'gemini').getByRole('button', { name: /Install/ })).toHaveCount(0);
      await expect(row(page, 'kimi').getByRole('button', { name: 'Install Kimi Code' })).toBeVisible();
      await expect(page.locator('#sections a').first()).toHaveText('Harnesses');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });

    test('an old service shows the update line and no Install', async ({ page }) => {
      const s = status();
      for (const n of NAMES) s.machines[0].harnesses[n] = h({ recipe: null });
      await stub(page, { harnesses: (r) => json(r, s), install: (r) => json(r, { state: 'idle' }), put: (r) => json(r, {}) });
      await openPage(page, context, '/app/settings#harnesses');
      await expect(page.getByText('This machine needs updating: re-run ./install.sh on it.')).toBeVisible();
      await expect(rows(page)).toHaveCount(5);
      await expect(page.getByRole('button', { name: /Install/ })).toHaveCount(0);
    });

    test('install: running on load, then succeeded refreshes; Install posts', async ({ page }) => {
      let phase = 'running';
      const s = status();
      const world = {
        harnesses: (r) => { if (phase === 'done') s.machines[0].harnesses.kimi = h({ installed: true, version: '1.0' }); return json(r, s); },
        install: (r) => {
          const url = r.request().url();
          if (!url.includes('/kimi/')) return json(r, { state: 'idle' });
          if (phase === 'running') { phase = 'done'; return json(r, { state: 'running', output_tail: 'downloading kimi\nunpacking' }); }
          return json(r, { state: 'succeeded', output_tail: 'ok' });
        },
        put: (r) => json(r, {}),
      };
      await stub(page, world);
      await openPage(page, context, '/app/settings#harnesses');
      await expect(row(page, 'kimi')).toContainText('Installing…');
      await expect(row(page, 'kimi').locator('.h-tail')).toContainText('unpacking');
      await expect(row(page, 'kimi')).toContainText('Installed 1.0', { timeout: 8000 });
      expect(world.calls.some((c) => c.includes('/harnesses?fresh=1'))).toBe(true);
    });

    test('install failed shows the tail and Try again, which POSTs and polls', async ({ page }) => {
      let posted = false;
      const s = status();
      const world = {
        harnesses: (r) => json(r, s),
        install: (r) => {
          if (!r.request().url().includes('/gpt/')) return json(r, { state: 'idle' });
          if (r.request().method() === 'POST') { posted = true; return json(r, { state: 'running' }, 202); }
          return posted ? json(r, { state: 'running', output_tail: 'retrying' }) : json(r, { state: 'failed', output_tail: 'npm ERR! boom' });
        },
        put: (r) => json(r, {}),
      };
      await stub(page, world);
      await openPage(page, context, '/app/settings#harnesses');
      await expect(row(page, 'gpt')).toContainText('Install failed');
      await expect(row(page, 'gpt').locator('.h-tail')).toContainText('npm ERR! boom');
      await row(page, 'gpt').getByRole('button', { name: 'Try again Codex' }).click();
      await expect(row(page, 'gpt')).toContainText('Installing…');
      expect(world.calls).toContain('POST /wheelchair/api/machines/hub/harnesses/gpt/install');
    });

    test('a POST answered 404 no recipe falls back to the vendor link', async ({ page }) => {
      let gone = false;
      const s = status();
      const world = {
        harnesses: (r) => { if (gone) s.machines[0].harnesses.kimi = h({ recipe: false }); return json(r, s); },
        install: (r) => {
          if (r.request().method() === 'POST') { gone = true; return json(r, { error: 'no recipe' }, 404); }
          return json(r, { state: 'idle' });
        },
        put: (r) => json(r, {}),
      };
      await stub(page, world);
      await openPage(page, context, '/app/settings#harnesses');
      await row(page, 'kimi').getByRole('button', { name: 'Install Kimi Code' }).click();
      await expect(row(page, 'kimi').getByRole('link', { name: "Install from Kimi's site" })).toBeVisible();
    });

    test('an outage during a poll shows retrying, then the answer', async ({ page }) => {
      let n = 0;
      const s = status();
      const world = {
        harnesses: (r) => json(r, s),
        install: (r) => {
          if (!r.request().url().includes('/pi/') && !r.request().url().includes('/openrouter/')) return json(r, { state: 'idle' });
          n += 1;
          if (n === 1) return json(r, { state: 'running', output_tail: 'a' });
          if (n === 2) return json(r, { error: 'down' }, 502);
          return json(r, { state: 'running', output_tail: 'b' });
        },
        put: (r) => json(r, {}),
      };
      await stub(page, world);
      await openPage(page, context, '/app/settings#harnesses');
      await expect(row(page, 'openrouter')).toContainText("Can't reach hub, retrying…", { timeout: 6000 });
      await expect(row(page, 'openrouter')).toContainText('Installing…', { timeout: 6000 });
      await expect(row(page, 'openrouter').locator('.h-tail')).toContainText('b');
    });

    test('reopening while the machine is unreachable retries, then shows the running job', async ({ page }) => {
      let calls = 0;
      const down = status();
      down.machines[0] = { name: 'hub', reachable: false, harnesses: {} };
      const up = status();
      const world = {
        harnesses: (r) => { calls += 1; return json(r, calls < 3 ? down : up); },
        install: (r) => json(r, r.request().url().includes('/claude/') ? { state: 'running', output_tail: 'still going' } : { state: 'idle' }),
        put: (r) => json(r, {}),
      };
      await stub(page, world);
      await openPage(page, context, '/app/settings#harnesses');
      await expect(page.locator('.h-offline')).toContainText("Can't reach hub, retrying…");
      await expect(rows(page)).toHaveCount(0);
      await expect(row(page, 'claude')).toContainText('Installing…', { timeout: 14000 });
      await expect(row(page, 'claude').locator('.h-tail')).toContainText('still going');
    });

    test('the machine picker switches machines', async ({ page }) => {
      const s = status();
      s.machines.push({ name: 'node-2', reachable: true, harnesses: Object.fromEntries(NAMES.map((n) => [n, h({ installed: true, version: '7', signed_in: true })])) });
      await stub(page, { harnesses: (r) => json(r, s), install: (r) => json(r, { state: 'idle' }), put: (r) => json(r, {}) });
      await openPage(page, context, '/app/settings#harnesses');
      await expect(row(page, 'claude')).toContainText('Not installed');
      await page.getByLabel('Machine', { exact: true }).selectOption('node-2');
      await expect(row(page, 'claude')).toContainText('Signed in');
    });

    test('Sign in mounts the sign-in card under the row, also for a recipe:false harness', async ({ page }) => {
      const s = status();
      s.machines[0].harnesses.gemini = h({ installed: true, version: '3', recipe: false });
      await stub(page, { harnesses: (r) => json(r, s), install: (r) => json(r, { state: 'idle' }), put: (r) => json(r, {}) });
      await page.route('**/api/accounts/default-gemini/signin', (r) => json(r, {}));
      await page.route('**/api/accounts/default-gemini/signin/hub', (r) => json(r, { state: 'waiting', url: 'https://example.test/login' }));
      await openPage(page, context, '/app/settings#harnesses');
      await row(page, 'gemini').getByRole('button', { name: 'Sign in Antigravity' }).click();
      const card = row(page, 'gemini').locator('.signin-card');
      await expect(card).toContainText('Sign in default on hub');
      await expect(card.getByRole('link', { name: 'Open sign-in link' })).toBeVisible();
      await card.getByRole('button', { name: 'Close' }).click();
      await expect(card).toHaveCount(0);
    });

    test('switching off asks first when threads use it, then saves and refreshes', async ({ page }) => {
      const s = status({ threads_using: { claude: 2 } });
      let put = null;
      const world = {
        harnesses: (r) => json(r, s),
        install: (r) => json(r, { state: 'idle' }),
        put: (r) => { put = { url: r.request().url(), body: r.request().postDataJSON() }; s.switches.claude = false; return json(r, { harnesses: { ...s.switches } }); },
      };
      await stub(page, world);
      await openPage(page, context, '/app/settings#harnesses');
      await page.getByLabel('Use Claude Code').click();
      await expect(row(page, 'claude')).toContainText('2 threads use Claude Code. Their running agents keep going, but no new agent starts on it. Leave it out?');
      await row(page, 'claude').getByRole('button', { name: 'Keep' }).click();
      expect(put).toBeNull();
      await page.getByLabel('Use Claude Code').click();
      await row(page, 'claude').getByRole('button', { name: 'Leave it out' }).click();
      await expect(page.getByLabel('Use Claude Code')).not.toBeChecked();
      expect(put.url).toContain('/settings/harnesses/claude');
      expect(put.body).toEqual({ enabled: false });
      await expect.poll(() => world.calls.filter((c) => c.includes('fresh=1')).length).toBeGreaterThan(1);
    });

    test('a 409 on switch-off shows its message under the row', async ({ page }) => {
      const s = status();
      await stub(page, { harnesses: (r) => json(r, s), install: (r) => json(r, { state: 'idle' }),
        put: (r) => json(r, { error: 'Lead order would have no harness left. Add another to Lead order first.' }, 409) });
      await openPage(page, context, '/app/settings#harnesses');
      await page.getByLabel('Use Claude Code').click();
      await expect(row(page, 'claude').getByRole('alert')).toContainText('Lead order would have no harness left.');
      await expect(page.getByLabel('Use Claude Code')).toBeChecked();
    });

    test('a switched-off harness has no action', async ({ page }) => {
      const s = status();
      s.switches.kimi = false;
      s.machines[0].harnesses.kimi = h();
      await stub(page, { harnesses: (r) => json(r, s), install: (r) => json(r, { state: 'idle' }), put: (r) => json(r, {}) });
      await page.route('**/api/settings', (r) => patchSettings(r, (b) => { b.harnesses = { ...s.switches }; return b; }));
      await openPage(page, context, '/app/settings#harnesses');
      await expect(page.getByLabel('Use Kimi Code')).not.toBeChecked();
      await expect(row(page, 'kimi').getByRole('button')).toHaveCount(0);
      await expect(row(page, 'claude').getByRole('button', { name: 'Install Claude Code' })).toBeVisible();
    });

    test("the can't-start notice names the reasons and links the lists", async ({ page }) => {
      const s = status({}, { can_start: { machine: 'hub',
        lead: { ok: false, reason: 'New leads try Claude Code; none is installed and signed in on hub. Add Pi to Leads try in Settings.' },
        worker: { ok: false, reason: 'New workers try Codex; none is installed and signed in on hub. Add Pi to Workers try first in Settings.' } } });
      await stub(page, { harnesses: (r) => json(r, s), install: (r) => json(r, { state: 'idle' }), put: (r) => json(r, {}) });
      await openPage(page, context, '/app/settings#harnesses');
      const notice = page.locator('.h-notice');
      await expect(notice).toContainText("Agents can't start yet on hub:");
      await expect(notice).toContainText('New leads try Claude Code');
      await expect(notice.getByRole('link', { name: 'Leads try' })).toHaveAttribute('href', '#models');
      await expect(notice.getByRole('link', { name: 'Workers try first' })).toHaveAttribute('href', '#usage');
      s.can_start = { machine: 'hub', lead: { ok: true }, worker: { ok: true } };
      await notice.getByRole('link', { name: 'Leads try' }).click();
      await expect(page.locator('#panel h1')).toHaveText('Models and preferences');
      await page.locator('#sections a[data-section="harnesses"]').click();
      await expect(page.locator('.h-notice')).toHaveCount(0);
    });

    test('switching a harness off hides its account row, review-family option and order entries', async ({ page }) => {
      const s = status();
      await stub(page, { harnesses: (r) => json(r, s), install: (r) => json(r, { state: 'idle' }), put: (r) => json(r, {}) });
      await page.route('**/api/settings', (r) => patchSettings(r, (b) => {
        b.harnesses = { claude: true, gpt: true, gemini: false, kimi: true, openrouter: true };
        return b;
      }));
      await openPage(page, context, '/app/settings#accounts');
      await expect(page.locator('.prov-group[data-provider="claude"]')).toBeVisible();
      await expect(page.locator('.prov-group[data-provider="gemini"]')).toHaveCount(0);
      await page.locator('#sections a[data-section="models"]').click();
      await expect(page.locator('tr[data-provider="gemini"]')).toHaveCount(0);
      await expect(page.locator('tr[data-provider="claude"]')).toHaveCount(1);
      await expect(page.getByRole('radio', { name: 'Antigravity' })).toHaveCount(0);
      await expect(page.getByRole('radio', { name: 'Kimi Code' })).toHaveCount(1);
      await expect(page.locator('[data-order="lead_order"]').getByRole('button', { name: '+ Antigravity' })).toHaveCount(0);
      await page.locator('#sections a[data-section="usage"]').click();
      await expect(page.locator('[data-order="worker_order"] li', { hasText: 'Antigravity' })).toHaveCount(0);
      await expect(page.locator('[data-order="worker_order"]').getByRole('button', { name: '+ Antigravity' })).toHaveCount(0);
    });

    test('moving a visible provider keeps switched-off ones at their saved index', async ({ page }) => {
      const s = status();
      s.switches.gpt = false;
      await stub(page, { harnesses: (r) => json(r, s), install: (r) => json(r, { state: 'idle' }), put: (r) => json(r, {}) });
      let saved = null;
      await page.route('**/api/settings', (r) => patchSettings(r, (b) => {
        b.harnesses = { ...s.switches };
        b.worker_order = ['gpt', 'claude', 'gemini', 'kimi'];
        b.lead_order = ['gpt', 'claude', 'gemini', 'kimi', 'any'];
        return b;
      }));
      await page.route('**/api/settings/balancing', async (r) => {
        saved = r.request().postDataJSON();
        return json(r, { ...saved, reserved_provider: null });
      });
      await openPage(page, context, '/app/settings#usage');
      const wo = page.locator('[data-order="worker_order"]');
      await expect(wo.locator('li')).toHaveCount(3);
      await wo.getByRole('button', { name: 'Move Claude down' }).click();
      await expect(wo.locator('li span').first()).toHaveText('Antigravity');
      await page.locator('#bal-save').click();
      await expect.poll(() => saved && saved.worker_order).toEqual(['gpt', 'gemini', 'claude', 'kimi']);
      saved = null;
      await page.locator('#sections a[data-section="models"]').click();
      const lo = page.locator('[data-order="lead_order"]');
      await lo.getByRole('button', { name: 'Move Claude down' }).click();
      await page.locator('#lead-order-save').click();
      await expect.poll(() => saved && saved.lead_order).toEqual(['gpt', 'gemini', 'claude', 'kimi', 'any']);
    });

    test('Install targets the machine the picker shows and waits for its data', async ({ page }) => {
      const s = status();
      s.machines.push({ name: 'node-2', reachable: true, harnesses: Object.fromEntries(NAMES.map((n) => [n, h()])) });
      let hold = null; let release = null;
      const world = {
        harnesses: async (r) => { if (hold) await hold; return json(r, s); },
        install: (r) => json(r, { state: 'idle' }),
        put: (r) => json(r, {}),
      };
      await stub(page, world);
      await openPage(page, context, '/app/settings#harnesses');
      await expect(row(page, 'claude').getByRole('button', { name: 'Install Claude Code' })).toBeVisible();
      hold = new Promise((res) => { release = res; });
      await page.getByLabel('Machine', { exact: true }).selectOption('node-2');
      await expect(page.getByRole('button', { name: /Install/ })).toHaveCount(0);
      release();
      await row(page, 'claude').getByRole('button', { name: 'Install Claude Code' }).click();
      await expect.poll(() => world.calls.some((c) => c === 'POST /wheelchair/api/machines/node-2/harnesses/claude/install')).toBe(true);
      expect(world.calls.some((c) => c.startsWith('POST /wheelchair/api/machines/hub/'))).toBe(false);
    });

    test('switching a harness off closes its open sign-in card', async ({ page }) => {
      const s = status();
      s.machines[0].harnesses.gemini = h({ installed: true, version: '1' });
      await stub(page, { harnesses: (r) => json(r, s), install: (r) => json(r, { state: 'idle' }),
        put: (r) => { s.switches.gemini = false; return json(r, { harnesses: { ...s.switches } }); } });
      await page.route('**/api/accounts/default-gemini/signin', (r) => json(r, {}));
      await page.route('**/api/accounts/default-gemini/signin/hub', (r) => json(r, { state: 'waiting', url: 'https://example.test/login' }));
      await openPage(page, context, '/app/settings#harnesses');
      await row(page, 'gemini').getByRole('button', { name: 'Sign in Antigravity' }).click();
      await expect(row(page, 'gemini').getByRole('link', { name: 'Open sign-in link' })).toBeVisible();
      await page.getByLabel('Use Antigravity').click();
      await expect(page.getByLabel('Use Antigravity')).not.toBeChecked();
      await expect(page.locator('.signin-card')).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Open sign-in link' })).toHaveCount(0);
    });

    // Accounts-panel stubs: settings carries the live switches and one signed-out Claude account.
    async function stubAccounts(page, s, posts) {
      await page.route('**/api/settings', (r) => {
        if (r.request().method() !== 'GET') return r.continue();
        return patchSettings(r, (b) => { b.harnesses = { ...s.switches }; return b; });
      });
      await page.route('**/api/usage', async (r) => {
        const acct = { id: 'acct-claude', provider: 'claude', name: 'Work', plan: 'unknown', weight: 1, paused: false, machines: { hub: 'signed_out' }, reading: null, next: false, live_sessions: 0 };
        return json(r, { providers: { claude: { label: 'Claude', left: null, accounts: [acct] } } });
      });
      await page.route('**/api/settings/accounts', (r) => {
        if (r.request().method() !== 'POST') return r.continue();
        posts.push(r.request().postDataJSON());
        return json(r, { id: 'new-one', ...r.request().postDataJSON(), weight: 1, paused: false }, 201);
      });
    }
    const switchOff = async (page, s, name, key) => {
      await page.locator('#sections a[data-section="harnesses"]').click();
      await page.getByLabel(`Use ${name}`).click();
      const leave = row(page, key).getByRole('button', { name: 'Leave it out' });
      if (await leave.count()) await leave.click();
      await expect(page.getByLabel(`Use ${name}`)).not.toBeChecked();
    };

    test('Add account never hides a switched-off provider: default is the first offered one', async ({ page }) => {
      const s = status();
      s.switches.claude = false;
      const posts = [];
      await stub(page, { harnesses: (r) => json(r, s), install: (r) => json(r, { state: 'idle' }), put: (r) => json(r, {}) });
      await stubAccounts(page, s, posts);
      await openPage(page, context, '/app/settings#accounts');
      await page.locator('#add-account').click();
      await expect(page.locator('#add-provider')).toHaveValue('gpt');
      await page.locator('#add-name').fill('Spare');
      const reloaded = settingsGet(page);
      await page.locator('.add-form button[type="submit"]').click();
      await expect.poll(() => posts.length).toBe(1);
      expect(posts[0].provider).toBe('gpt');
      await reloaded;
    });

    test('switching off the provider chosen in an open Add account form resets it', async ({ page }) => {
      const s = status();
      const posts = [];
      await stub(page, { harnesses: (r) => json(r, s), install: (r) => json(r, { state: 'idle' }),
        put: (r) => { s.switches.gpt = false; return json(r, { harnesses: { ...s.switches } }); } });
      await stubAccounts(page, s, posts);
      await openPage(page, context, '/app/settings#accounts');
      await page.locator('#add-account').click();
      await page.locator('#add-provider').selectOption('gpt');
      await page.locator('#add-name').fill('Spare');
      await switchOff(page, s, 'Codex', 'gpt');
      await page.locator('#sections a[data-section="accounts"]').click();
      const value = await page.locator('#add-provider').inputValue();
      expect(value).not.toBe('gpt');
      expect(await page.locator('#add-provider option').evaluateAll((o) => o.map((x) => x.value))).toContain(value);
      await page.locator('#add-name').fill('Spare');
      const reloaded = settingsGet(page);
      await page.locator('.add-form button[type="submit"]').click();
      if (value === 'claude') await page.locator('#add-anyway').click(); // one Claude account exists: the terms step
      await expect.poll(() => posts.length).toBeGreaterThan(0);
      expect(posts[0].provider).toBe(value);
      expect(posts[0].provider).not.toBe('gpt');
      await reloaded;
    });

    test('switching Claude Code off closes a sign-in card opened from Accounts', async ({ page }) => {
      const s = status();
      await stub(page, { harnesses: (r) => json(r, s), install: (r) => json(r, { state: 'idle' }),
        put: (r) => { s.switches.claude = false; return json(r, { harnesses: { ...s.switches } }); } });
      await stubAccounts(page, s, []);
      await page.route('**/api/accounts/acct-claude/signin', (r) => json(r, {}));
      await page.route('**/api/accounts/acct-claude/signin/hub', (r) => json(r, { state: 'waiting', url: 'https://example.test/login' }));
      await openPage(page, context, '/app/settings#accounts');
      await page.getByRole('button', { name: 'Sign in Work on hub' }).click();
      await expect(page.locator('.signin-card')).toHaveCount(1);
      await switchOff(page, s, 'Claude Code', 'claude');
      await page.locator('#sections a[data-section="accounts"]').click();
      await expect(page.locator('.signin-card')).toHaveCount(0);
    });

    test('the home checklist shows, shows the start reason, and hides', async ({ page }) => {
      let body = { show: true, steps: [
        { id: 'install', label: 'Install an agent harness', done: true },
        { id: 'signin', label: 'Sign in to it', done: true },
        { id: 'start', label: 'Agents can start', done: false, reason: 'New leads try Claude Code; none is installed and signed in on hub.' }] };
      let code = 200;
      await page.route('**/api/onboarding', (r) => json(r, body, code));
      await openPage(page, context, '/app/threads');
      const card = page.locator('#onboarding');
      await expect(card).toContainText('Set up an agent');
      await expect(card.locator('.ob-step.done')).toHaveCount(2);
      await expect(card.locator('.ob-step[data-step="start"]')).toContainText('New leads try Claude Code');
      await expect(card).toContainText("Leave out the ones you don't use.");
      await expect(card.getByRole('link', { name: 'Open Settings' })).toHaveAttribute('href', /\/app\/settings#harnesses$/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
      body = { show: false, steps: [] };
      await expect(card).toHaveCount(0, { timeout: 8000 });
      body = { show: true, steps: [{ id: 'install', label: 'Install an agent harness', done: false }] };
      await expect(page.locator('#onboarding')).toHaveCount(1, { timeout: 8000 });
      code = 500;
      await expect(page.locator('#onboarding')).toHaveCount(0, { timeout: 8000 });
    });
  });
}
