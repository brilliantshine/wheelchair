'use strict';

const { test, expect } = require('@playwright/test');
const { startServer } = require('./helpers/server');

const THEME = '**/wheelchair/api/settings/theme';
const PREVIEWING = 'Previewing on this page · Save to apply across devices';
const CONFLICT = 'Theme changed elsewhere. Click Reset to load the latest settings.';

let server;
test.beforeEach(async () => { server = await startServer(); });
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await server.stop();
});

const editor = (page) => page.locator('.theme-editor');
const button = (page, name) => editor(page).getByRole('button', { name, exact: true });
const hex = (page) => page.getByLabel('Accent hex color');
const picker = (page) => page.getByLabel('Accent color', { exact: true });
const status = (page) => editor(page).getByRole('status');
const css = (page, name) => page.evaluate((n) => document.documentElement.style.getPropertyValue(n), name);
const mode = (page) => page.evaluate(() => document.documentElement.dataset.themeMode);
const preset = (page) => page.evaluate(() => document.documentElement.dataset.themePreset);
const metadata = (page) => page.evaluate(() => window.wcTheme.current().metadata);

async function open(page, hash = '#you') {
  await page.goto(`${server.url}/?token=${server.token}`);
  await page.goto(`${server.url}/app/settings${hash}`);
  await expect(button(page, 'Dark')).toBeEnabled();
}

// A write the editor under test does not see: no applySaved, no localStorage.
async function putElsewhere(page, value) {
  const result = await page.evaluate(async (next) => {
    const url = '/wheelchair/api/settings/theme';
    const { revision } = await (await fetch(url, { cache: 'no-store' })).json();
    const response = await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...next, revision }) });
    return { status: response.status, body: await response.json() };
  }, value);
  expect(result.status).toBe(200);
  return result.body;
}

const stored = (page) => page.evaluate(async () => (await fetch('/wheelchair/api/settings/theme', { cache: 'no-store' })).json());

async function save(page) {
  await button(page, 'Save theme').click();
  await expect(status(page)).toHaveText('Saved');
}

// Holds the first matching request until release(); `seen` settles when it arrives.
async function hold(page, method, respond) {
  let release, arrived, held = false;
  const gate = new Promise((resolve) => { release = resolve; });
  const seen = new Promise((resolve) => { arrived = resolve; });
  await page.route(THEME, async (route) => {
    if (held || route.request().method() !== method) return route.fallback();
    held = true;
    await respond(route, async () => { arrived(); await gate; });
  });
  return { release, seen };
}

test('controls preview mode, preset, hex and quick swatches without saving', async ({ page }) => {
  await open(page);
  await expect(button(page, 'Reset')).toBeDisabled();
  await expect(button(page, 'Save theme')).toBeDisabled();
  await expect(button(page, 'Reset to preset')).toBeDisabled();
  await expect(button(page, 'Reset to default')).toBeDisabled();
  await expect(button(page, 'Dark')).toHaveAttribute('aria-pressed', 'true');
  await expect(hex(page)).toHaveValue('#5b9dd9');

  // Choosing what is already saved is not an edit.
  await button(page, 'Dark').click();
  await expect(button(page, 'Save theme')).toBeDisabled();

  await button(page, 'Light').click();
  await expect.poll(() => mode(page)).toBe('light');
  await expect(button(page, 'Light')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Dark')).toHaveAttribute('aria-pressed', 'false');
  await expect(status(page)).toHaveText(PREVIEWING);

  await button(page, 'Forest').click();
  await expect.poll(() => preset(page)).toBe('forest');
  await expect(button(page, 'Forest')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Wheelchair Default')).toHaveAttribute('aria-pressed', 'false');
  await expect(hex(page)).toHaveValue('#10b981');
  await expect(picker(page)).toHaveValue('#10b981');
  expect(await css(page, '--accent')).toBe('#10b981');

  await hex(page).fill('#a0c');
  await expect.poll(() => css(page, '--accent')).toBe('#aa00cc');
  await expect(hex(page)).toHaveValue('#a0c');
  await expect(picker(page)).toHaveValue('#aa00cc');

  await button(page, 'Use accent #e06c75').click();
  await expect.poll(() => css(page, '--accent')).toBe('#e06c75');
  await expect(hex(page)).toHaveValue('#e06c75');

  await picker(page).fill('#123456');
  await expect.poll(() => css(page, '--accent')).toBe('#123456');
  await expect(hex(page)).toHaveValue('#123456');

  expect(await stored(page)).toEqual({ mode: 'dark', preset: 'default', accent: null, revision: 0 });
});

test('preset keeps a custom accent; resets restore preset accent and default preset but not mode', async ({ page }) => {
  await open(page);
  await button(page, 'Light').click();
  await button(page, 'Use accent #a78bfa').click();
  await button(page, 'Amber').click();
  await expect.poll(() => preset(page)).toBe('amber');
  expect(await css(page, '--accent')).toBe('#a78bfa');
  await expect(hex(page)).toHaveValue('#a78bfa');

  await button(page, 'Reset to preset').click();
  await expect.poll(() => css(page, '--accent')).toBe('#e5a63a');
  await expect(hex(page)).toHaveValue('#e5a63a');
  await expect(button(page, 'Reset to preset')).toBeDisabled();
  await expect(button(page, 'Reset to default')).toBeEnabled();

  await button(page, 'Use accent #10b981').click();
  await button(page, 'Reset to default').click();
  await expect.poll(() => preset(page)).toBe('default');
  expect(await mode(page)).toBe('light');
  expect(await css(page, '--accent')).toBe('#5b9dd9');
  await expect(button(page, 'Light')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Reset to default')).toBeDisabled();
});

test('Reset discards the preview; Save persists across reload', async ({ page }) => {
  await open(page);
  await button(page, 'Light').click();
  await button(page, 'Rose').click();
  await expect.poll(() => preset(page)).toBe('rose');
  await button(page, 'Reset').click();
  await expect.poll(() => preset(page)).toBe('default');
  expect(await mode(page)).toBe('dark');
  await expect(button(page, 'Dark')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Wheelchair Default')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Reset')).toBeDisabled();
  await expect(status(page)).toHaveText('');

  await button(page, 'Light').click();
  await button(page, 'Slate').click();
  await button(page, 'Use accent #d6a53b').click();
  await save(page);
  await expect(button(page, 'Save theme')).toBeDisabled();
  await expect(button(page, 'Reset')).toBeDisabled();
  expect(await stored(page)).toEqual({ mode: 'light', preset: 'slate', accent: '#d6a53b', revision: 1 });

  await page.reload();
  await expect(button(page, 'Slate')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Light')).toHaveAttribute('aria-pressed', 'true');
  await expect(hex(page)).toHaveValue('#d6a53b');
  expect(await mode(page)).toBe('light');
  expect(await css(page, '--accent')).toBe('#d6a53b');

  // A second save from the same visit uses the revision it just received.
  await button(page, 'Dark').click();
  await save(page);
  await button(page, 'Light').click();
  await save(page);
  expect((await stored(page)).revision).toBe(3);
});

test('System mode follows the OS color scheme, previewed and saved', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await open(page);
  await button(page, 'System').click();
  expect(await mode(page)).toBe('dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => mode(page)).toBe('light');
  await save(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => mode(page)).toBe('dark');
  await expect(button(page, 'System')).toHaveAttribute('aria-pressed', 'true');
});

test('a clean editor adopts a refreshed theme and its revision before the first edit', async ({ page }) => {
  await open(page);
  await putElsewhere(page, { mode: 'light', preset: 'midnight', accent: '#e06c75' });
  await page.evaluate(() => window.wcTheme.refresh());
  await expect(button(page, 'Midnight')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Light')).toHaveAttribute('aria-pressed', 'true');
  await expect(hex(page)).toHaveValue('#e06c75');
  await expect(button(page, 'Save theme')).toBeDisabled();
  await button(page, 'Forest').click();
  await save(page);
  expect(await stored(page)).toEqual({ mode: 'light', preset: 'forest', accent: '#e06c75', revision: 2 });
});

test('a saved theme reaches a second browser that stays open, by polling', async ({ browser, page }) => {
  test.setTimeout(60000);
  const context = await browser.newContext();
  try {
    const other = await context.newPage();
    await open(page);
    await open(other);
    await button(page, 'Light').click();
    await button(page, 'Forest').click();
    expect(await preset(other)).toBe('default');
    await save(page);
    // No reload, focus change or manual refresh: only the 10 second poll.
    await expect(button(other, 'Forest')).toHaveAttribute('aria-pressed', 'true', { timeout: 25000 });
    await expect(button(other, 'Light')).toHaveAttribute('aria-pressed', 'true');
    expect(await mode(other)).toBe('light');
    expect(await preset(other)).toBe('forest');
  } finally { await context.close(); }
});

test('invalid hex shows a hint and disables Save until corrected or reset', async ({ page }) => {
  await open(page);
  const hint = editor(page).getByRole('alert').filter({ hasText: '3- or 6-digit hex' });
  await hex(page).fill('#12');
  await expect(hint).toBeVisible();
  await expect(button(page, 'Save theme')).toBeDisabled();
  await expect(button(page, 'Reset')).toBeEnabled();
  // Another control does not clear the typed text or let it save.
  await button(page, 'Forest').click();
  await expect(hex(page)).toHaveValue('#12');
  await expect(button(page, 'Save theme')).toBeDisabled();

  await hex(page).fill('123456');
  await expect(hint).toBeHidden();
  await expect(button(page, 'Save theme')).toBeEnabled();
  expect(await css(page, '--accent')).toBe('#123456');

  await hex(page).fill('nope');
  await expect(button(page, 'Save theme')).toBeDisabled();
  await button(page, 'Reset').click();
  await expect(hint).toBeHidden();
  await expect(hex(page)).toHaveValue('#5b9dd9');
});

test('a draft keeps its revision through refreshes, conflicts on save, and Reset loads the latest', async ({ page }) => {
  await open(page);
  await button(page, 'Rose').click();
  await putElsewhere(page, { mode: 'light', preset: 'amber', accent: null });
  await page.evaluate(() => window.wcTheme.refresh());
  expect((await metadata(page)).revision).toBe(1);
  await expect(button(page, 'Rose')).toHaveAttribute('aria-pressed', 'true');
  expect(await preset(page)).toBe('rose');

  const request = page.waitForRequest((r) => r.method() === 'PUT' && r.url().endsWith('/settings/theme'));
  const response = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().endsWith('/settings/theme'));
  await button(page, 'Save theme').click();
  expect((await request).postDataJSON()).toEqual({ mode: 'dark', preset: 'rose', accent: null, revision: 0 });
  expect((await response).status()).toBe(409);
  await expect(editor(page).getByRole('alert').filter({ hasText: CONFLICT })).toBeVisible();
  await expect(status(page)).toHaveText('');
  await expect(button(page, 'Save theme')).toBeDisabled();
  await expect(button(page, 'Rose')).toHaveAttribute('aria-pressed', 'true');
  expect(await preset(page)).toBe('rose');
  // Further edits keep previewing, but cannot save until Reset.
  await button(page, 'Slate').click();
  await expect(button(page, 'Save theme')).toBeDisabled();

  await button(page, 'Reset').click();
  await expect(button(page, 'Amber')).toHaveAttribute('aria-pressed', 'true');
  await expect(editor(page).getByRole('alert').filter({ hasText: CONFLICT })).toBeHidden();
  expect(await preset(page)).toBe('amber');
  expect(await mode(page)).toBe('light');
});

test('a 409 alone updates the saved theme behind the draft', async ({ page }) => {
  await open(page);
  await button(page, 'Rose').click();
  await putElsewhere(page, { mode: 'light', preset: 'amber', accent: null });
  await button(page, 'Save theme').click();
  await expect(editor(page).getByRole('alert').filter({ hasText: CONFLICT })).toBeVisible();
  expect((await metadata(page)).preset).toBe('amber');
});

test('saving locks every control; a failed save shows the reason and unlocks', async ({ page }) => {
  await open(page);
  const put = await hold(page, 'PUT', async (route, wait) => {
    await wait();
    await route.fulfill({ status: 500, json: { error: 'Could not write settings.json' } });
  });
  await button(page, 'Forest').click();
  await button(page, 'Use accent #a78bfa').click();
  await button(page, 'Save theme').click();
  await put.seen;
  await expect(editor(page).locator('button, input')).toHaveCount(21);
  await expect(editor(page).locator('button:enabled, input:enabled')).toHaveCount(0);
  put.release();
  await expect(editor(page).getByRole('alert').filter({ hasText: 'Could not write settings.json' })).toBeVisible();
  await expect(button(page, 'Save theme')).toBeEnabled();
  await expect(button(page, 'Forest')).toBeEnabled();
  expect(await preset(page)).toBe('forest');

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.route(THEME, (route) => (route.request().method() === 'PUT' ? route.abort() : route.fallback()));
  await button(page, 'Save theme').click();
  await expect(editor(page).getByRole('alert').filter({ hasText: "Couldn't save theme" })).toBeVisible();
});

test('a save answered after leaving You applies globally without touching the new visit', async ({ page }) => {
  await open(page);
  const put = await hold(page, 'PUT', async (route, wait) => {
    const response = await route.fetch();
    await wait();
    await route.fulfill({ response });
  });
  await button(page, 'Forest').click();
  await button(page, 'Save theme').click();
  await put.seen;
  await page.locator('#sections a[data-section="threads"]').click();
  await expect(editor(page)).toHaveCount(0);
  await expect.poll(() => preset(page)).toBe('default');
  await page.locator('#sections a[data-section="you"]').click();
  await button(page, 'Rose').click();
  const answered = page.waitForResponse((r) => r.request().method() === 'PUT');
  put.release();
  await answered;
  await expect.poll(async () => (await metadata(page)).preset).toBe('forest');
  await expect(button(page, 'Rose')).toHaveAttribute('aria-pressed', 'true');
  await expect(status(page)).toHaveText(PREVIEWING);
  await expect(button(page, 'Save theme')).toBeEnabled();
  expect(await preset(page)).toBe('rose');
  await button(page, 'Reset').click();
  await expect.poll(() => preset(page)).toBe('forest');
});

for (const source of ['this page', 'another tab']) {
  test(`a delayed stale GET does not overwrite a newer save from ${source}`, async ({ context, page }) => {
    await open(page);
    const get = await hold(page, 'GET', async (route, wait) => {
      const response = await route.fetch();
      await wait();
      await route.fulfill({ response });
    });
    await page.evaluate(() => { window.staleRead = window.wcTheme.refresh(); });
    await get.seen;
    const writer = source === 'this page' ? page : await context.newPage();
    if (writer !== page) await open(writer);
    await button(writer, 'Forest').click();
    await save(writer);
    await expect.poll(async () => (await metadata(page)).revision).toBe(1);
    get.release();
    await page.evaluate(() => window.staleRead);
    expect((await metadata(page)).preset).toBe('forest');
    expect(await preset(page)).toBe('forest');
    await expect(button(page, 'Forest')).toHaveAttribute('aria-pressed', 'true');
  });
}

async function previewForest(page) {
  await button(page, 'Light').click();
  await button(page, 'Forest').click();
  await expect.poll(() => preset(page)).toBe('forest');
}

async function expectSaved(page) {
  await expect.poll(() => preset(page)).toBe('default');
  expect(await mode(page)).toBe('dark');
  expect(await css(page, '--accent')).toBe('#5b9dd9');
  await expect(button(page, 'Wheelchair Default')).toHaveAttribute('aria-pressed', 'true');
  await expect(button(page, 'Dark')).toHaveAttribute('aria-pressed', 'true');
  await expect(hex(page)).toHaveValue('#5b9dd9');
  await expect(button(page, 'Save theme')).toBeDisabled();
  await expect(button(page, 'Reset')).toBeDisabled();
  await expect(status(page)).toHaveText('');
}

test('the phone Back link discards the preview', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await previewForest(page);
  await page.getByRole('link', { name: '‹ Settings' }).click();
  await expect.poll(() => preset(page)).toBe('default');
  await page.locator('.cat-link[data-category="you"]').click();
  await expectSaved(page);
});

test('desktop section navigation discards the preview', async ({ page }) => {
  await open(page);
  await previewForest(page);
  await page.locator('#sections a[data-section="threads"]').click();
  await expect.poll(() => preset(page)).toBe('default');
  expect(await mode(page)).toBe('dark');
  await page.locator('#sections a[data-section="you"]').click();
  await expectSaved(page);
});

test('header navigation then browser Back shows the saved theme', async ({ page }) => {
  await open(page);
  await previewForest(page);
  await page.locator('#app-nav .seg a', { hasText: 'Threads' }).click();
  await page.waitForURL(/\/app\/threads/);
  await page.goBack();
  await expect(button(page, 'Dark')).toBeEnabled();
  await expectSaved(page);
});

test('pagehide then a restored pageshow drops a live preview and repaints the controls', async ({ page }) => {
  await open(page);
  await previewForest(page);
  await hex(page).fill('#12');
  await page.evaluate(() => {
    window.sameEditor = document.querySelector('.theme-editor');
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expectSaved(page);
  expect(await page.evaluate(() => window.sameEditor === document.querySelector('.theme-editor'))).toBe(true);
});

for (const [width, height, columns] of [[1280, 900, 6], [390, 844, 3]]) {
  test(`preset grid has ${columns} columns and no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    const tops = await page.locator('.theme-preset').evaluateAll((cards) => cards.map((card) => Math.round(card.getBoundingClientRect().top)));
    expect(tops).toHaveLength(6);
    expect(tops.filter((top) => top === tops[0])).toHaveLength(columns);
    const overflow = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth - innerWidth,
      outside: [...document.querySelectorAll('.theme-editor *')].filter((el) => el.getClientRects().length && el.getBoundingClientRect().right > innerWidth + 0.5).length,
    }));
    expect(overflow).toEqual({ page: 0, outside: 0 });
    // Theme sits directly above Background.
    expect(await page.evaluate(() => document.querySelector('.block[data-block="theme"]').nextElementSibling.dataset.block)).toBe('background');
  });
}
