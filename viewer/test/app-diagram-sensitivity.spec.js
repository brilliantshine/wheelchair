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
    if (request.method() === 'GET') return route.fulfill({ json: { machines: state.machines } });
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
