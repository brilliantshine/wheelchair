'use strict';

// Settings > You > Diagrams against a real server; the hub's diagram routes are stubbed in
// the page (page.route) so the machines' answers are whatever each test says.
const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { makeDir, startServer } = require('./helpers/server.js');
const { openPage } = require('./helpers/app-views-setup.js');

let context;
test.beforeAll(async () => {
  const state = await makeDir('app-diagram-state-');
  const modelsCache = path.join(state, 'models-cache.json');
  await fs.writeFile(modelsCache, JSON.stringify({ models: [] }));
  const server = await startServer({ stateDir: state, env: { WHEELCHAIR_MODELS: path.join(state, 'models'), WHEELCHAIR_MODELS_CACHE: modelsCache } });
  context = { state, server };
});
test.afterAll(async () => { await context.server.stop(); });

const ok = (level) => ({ level, files: [{ harness: 'claude', level }, { harness: 'codex', level }] });

// Stub both routes; `state.machines` is what GET returns, `post` decides each POST.
async function stub(page, state, post) {
  const posts = [];
  await page.route('**/api/settings/diagram-sensitivity', async (route) => {
    const request = route.request();
    if (request.method() === 'GET') { state.reads = (state.reads || 0) + 1; return route.fulfill({ json: { machines: state.machines } }); }
    const body = request.postDataJSON();
    posts.push(body);
    const result = post(body);
    return route.fulfill({ status: result.status, json: result.body });
  });
  return posts;
}

const radio = (page, name) => page.getByRole('radiogroup', { name: 'Diagram sensitivity' }).getByRole('radio', { name });

test('Diagrams sits between Writing style and Enter to send and selects the level every machine agrees on', async ({ page }) => {
  await stub(page, { machines: { hub: ok('default'), 'node-2': ok('default') } }, () => ({ status: 200, body: {} }));
  await openPage(page, context, '/app/settings#you');
  await expect(radio(page, /Default/)).toHaveAttribute('aria-checked', 'true');
  const headings = await page.locator('#panel h2').allTextContents();
  expect(headings.indexOf('Diagrams')).toBeGreaterThan(headings.indexOf('Writing style'));
  expect(headings.indexOf('Enter to send')).toBe(headings.indexOf('Diagrams') + 1);
  await expect(radio(page, /Default/)).toHaveAttribute('aria-checked', 'true');
  await expect(radio(page, /Ask/)).toHaveAttribute('aria-checked', 'false');
  await expect(radio(page, /Ask/)).toContainText('Only when you ask, or a lead draws a proposed flow');
  await expect(radio(page, /High/)).toContainText('Whenever there is a shape');
  await expect(page.locator('.diagram-lines')).toHaveCount(0);
  // Nothing but the radio group: a skipped note must not leave text such as "null" behind.
  expect(await page.locator('#diagram-choices').evaluate((box) => [...box.childNodes].map((n) => n.nodeName))).toEqual(['DIV']);
});

test('Diagrams is read each time You comes on screen, and never behind the phone list', async ({ page }) => {
  const state = { machines: { hub: ok('default') } };
  await stub(page, state, () => ({ status: 200, body: {} }));
  await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page, context, '/app/settings');
  const you = page.locator('.cat-link[data-category="you"]');
  const back = page.locator('.back');
  const shows = async (level, reads) => {
    await expect(radio(page, level)).toHaveAttribute('aria-checked', 'true');
    expect(state.reads).toBe(reads);
  };
  await expect(you).toBeVisible();
  state.machines = { hub: ok('high') };
  await you.click();
  await shows(/High/, 1);
  await back.click();
  await expect(you).toBeVisible();
  state.machines = { hub: ok('ask') };
  await you.click();
  await shows(/Ask/, 2);
  // Growing past the phone width uncovers You.
  await back.click();
  await expect(you).toBeVisible();
  state.machines = { hub: ok('default') };
  await page.setViewportSize({ width: 1280, height: 900 });
  await shows(/Default/, 3);
  // Desktop: opening You again from another category.
  await page.locator('#sections a[data-section="models"]').click();
  await expect(page.locator('.catview[data-category="models"]')).toBeVisible();
  state.machines = { hub: ok('high') };
  await page.locator('#sections a[data-section="you"]').click();
  await shows(/High/, 4);
});

test('a save or read that finishes after You is hidden neither reads nor draws Diagrams', async ({ page }) => {
  const state = { machines: { hub: ok('default') } };
  await stub(page, state, () => ({ status: 200, body: {} }));
  // Registered after the stub, so it runs first: each held request waits for its release.
  const held = [];
  let hold = null; // the method to hold
  await page.route('**/api/settings/diagram-sensitivity', async (route) => {
    if (route.request().method() === hold) await new Promise((release) => held.push(release));
    await route.fallback();
  });
  const release = async () => {
    await expect.poll(() => held.length).toBe(1);
    const answered = page.waitForResponse('**/api/settings/diagram-sensitivity');
    held.pop()();
    await (await answered).finished();
    // Long enough for the page to act on the answer: what follows asserts that nothing happens.
    await page.waitForTimeout(500);
  };
  const radios = page.locator('#diagram-choices [role="radio"]');
  const drawn = () => page.locator('#diagram-choices').evaluate((box) => box.innerHTML);

  // Phone: save, then back to the list before the save answers.
  await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page, context, '/app/settings#you');
  await expect(radio(page, /Default/)).toHaveAttribute('aria-checked', 'true');
  hold = 'POST';
  await radio(page, /High/).click();
  await page.locator('.back').click();
  await expect(page.locator('.cat-link[data-category="you"]')).toBeVisible();
  state.machines = { hub: ok('high') };
  await release();
  expect(state.reads).toBe(1);
  await expect(radios).toHaveCount(0);
  hold = null;
  await page.locator('.cat-link[data-category="you"]').click();
  await expect(radio(page, /High/)).toHaveAttribute('aria-checked', 'true');
  expect(state.reads).toBe(2);

  // Desktop: the same, leaving for another category.
  await page.setViewportSize({ width: 1280, height: 900 });
  hold = 'POST';
  await radio(page, /Ask/).click();
  await page.locator('#sections a[data-section="models"]').click();
  await expect(page.locator('.catview[data-category="models"]')).toBeVisible();
  await release();
  expect(state.reads).toBe(2);
  hold = null;
  await page.locator('#sections a[data-section="you"]').click();
  await expect(radio(page, /High/)).toHaveAttribute('aria-checked', 'true');
  expect(state.reads).toBe(3);

  // A read already on its way when the list covers You draws nothing there.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.back').click();
  await expect(page.locator('.cat-link[data-category="you"]')).toBeVisible();
  hold = 'GET';
  await page.locator('.cat-link[data-category="you"]').click();
  await expect.poll(() => held.length).toBe(1);
  await page.locator('.back').click();
  await expect(page.locator('.cat-link[data-category="you"]')).toBeVisible();
  const before = await drawn();
  await release();
  expect(await drawn()).toBe(before);
});

test('disagreeing machines select nothing and the note says why', async ({ page }) => {
  await stub(page, {
    machines: {
      hub: { level: null, files: [{ harness: 'claude', level: 'ask' }, { harness: 'codex', level: null }] },
      'node-2': ok('high'),
      'node-3': { error: 'did not answer' },
    },
  }, () => ({ status: 200, body: {} }));
  await openPage(page, context, '/app/settings#you');
  for (const name of [/Ask/, /Default/, /High/]) await expect(radio(page, name)).toHaveAttribute('aria-checked', 'false');
  const lines = page.locator('.diagram-lines');
  await expect(lines).toContainText("hub: its CLIs' files disagree (claude ask, codex none)");
  await expect(lines).toContainText('node-2: high');
  await expect(lines).toContainText('node-3: did not answer');
});

test('two machines at different levels select nothing', async ({ page }) => {
  await stub(page, { machines: { hub: ok('ask'), 'node-2': ok('high') } }, () => ({ status: 200, body: {} }));
  await openPage(page, context, '/app/settings#you');
  await expect(page.locator('.diagram-lines')).toContainText('hub: ask');
  for (const name of [/Ask/, /Default/, /High/]) await expect(radio(page, name)).toHaveAttribute('aria-checked', 'false');
});

test('picking a level saves, shows the note, and re-reads', async ({ page }) => {
  const state = { machines: { hub: ok('ask') } };
  const posts = await stub(page, state, (body) => { state.machines = { hub: ok(body.level) }; return { status: 200, body: { machines: { hub: { level: body.level } } } }; });
  await openPage(page, context, '/app/settings#you');
  await radio(page, /High/).click();
  await expect(page.locator('.note').first()).toHaveText("Applies from each agent's next session");
  await expect(radio(page, /High/)).toHaveAttribute('aria-checked', 'true');
  expect(posts).toEqual([{ level: 'high' }]);
});

test('a 502 shows one line per failed machine, and pressing the same level again retries', async ({ page }) => {
  const state = { machines: { hub: ok('ask'), 'node-2': ok('ask') } };
  let failing = true;
  const posts = await stub(page, state, (body) => {
    if (failing) {
      state.machines = { hub: ok(body.level), 'node-2': ok('ask') };
      return { status: 502, body: { machines: { hub: { level: body.level }, 'node-2': { error: 'did not answer' } } } };
    }
    state.machines = { hub: ok(body.level), 'node-2': ok(body.level) };
    return { status: 200, body: { machines: { hub: { level: body.level }, 'node-2': { level: body.level } } } };
  });
  await openPage(page, context, '/app/settings#you');
  await radio(page, /High/).click();
  const note = page.locator('.note.bad').first();
  await expect(note).toHaveText('node-2: did not answer');
  await expect(page.locator('.diagram-lines')).toContainText('hub: high');
  await expect(radio(page, /High/)).toHaveAttribute('aria-checked', 'false');
  failing = false;
  await radio(page, /High/).click();
  await expect(page.locator('.note').first()).toHaveText("Applies from each agent's next session");
  await expect(radio(page, /High/)).toHaveAttribute('aria-checked', 'true');
  expect(posts).toEqual([{ level: 'high' }, { level: 'high' }]);
});

// The hub's diagram revision is stubbed along with the diagram routes: `state.rev` moving is
// an outside change.
test.describe('live refresh', () => {
  test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }); });
  const revisions = async (page, state) => {
    state.polls = 0;
    await page.route('**/api/settings/revision', async (route) => {
      state.polls += 1;
      const response = await route.fetch();
      await route.fulfill({ json: { ...await response.json(), diagram: 'stub:' + state.rev } });
    });
  };
  const tick = async (page, state) => {
    const before = state.polls;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect.poll(() => state.polls).toBeGreaterThan(before);
    await page.waitForTimeout(300);
  };

  test('an outside change redraws the choices and keeps focus on the same one', async ({ page }) => {
    const state = { rev: 1, machines: { hub: ok('ask') } };
    await stub(page, state, () => ({ status: 200, body: {} }));
    await revisions(page, state);
    await openPage(page, context, '/app/settings#you');
    await expect(radio(page, /Ask/)).toHaveAttribute('aria-checked', 'true');
    await radio(page, /Default/).focus();
    state.machines = { hub: ok('high') };
    state.rev = 2;
    await tick(page, state);
    await expect(radio(page, /High/)).toHaveAttribute('aria-checked', 'true');
    await expect(radio(page, /Default/)).toBeFocused();
    await expect(page.locator('.stale-banner')).toHaveCount(0);
  });

  test('an unchanged revision reads nothing, even with a machine offline', async ({ page }) => {
    const state = { rev: 1, machines: { hub: ok('ask'), 'node-2': { error: 'did not answer' } } };
    await stub(page, state, () => ({ status: 200, body: {} }));
    await revisions(page, state);
    await openPage(page, context, '/app/settings#you');
    await expect(page.locator('.diagram-lines')).toContainText('node-2: did not answer');
    for (let i = 0; i < 3; i += 1) await tick(page, state);
    expect(state.reads).toBe(1);
    // A change is read once, and the offline machine in that answer does not make it repeat.
    state.rev = 2;
    for (let i = 0; i < 3; i += 1) await tick(page, state);
    expect(state.reads).toBe(2);
  });

  test('a change while You is closed is read on coming back, not before', async ({ page }) => {
    const state = { rev: 1, machines: { hub: ok('ask') } };
    await stub(page, state, () => ({ status: 200, body: {} }));
    await revisions(page, state);
    await openPage(page, context, '/app/settings#you');
    await expect(radio(page, /Ask/)).toHaveAttribute('aria-checked', 'true');
    await page.locator('#sections a[data-section="models"]').click();
    state.machines = { hub: ok('high') };
    state.rev = 2;
    await tick(page, state);
    expect(state.reads).toBe(1);
    await page.locator('#sections a[data-section="you"]').click();
    await expect(radio(page, /High/)).toHaveAttribute('aria-checked', 'true');
    expect(state.reads).toBe(2);
  });
});
