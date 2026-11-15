'use strict';

// The app's fonts come from the app (Spec S6): an app page loads Inter and JetBrains Mono as
// FontFace entries served as font/woff2 from /wheelchair/assets/fonts/, and the CSP allows it.
// `document.fonts.check` is deliberately not used: it is true when no @font-face matches.
const { test, expect } = require('@playwright/test');
const { closeViews, openPage, setupViews } = require('./helpers/app-views-setup.js');

let context;
test.beforeAll(async () => { context = await setupViews(); });
test.afterAll(async () => { await closeViews(context); });

test('Inter and JetBrains Mono load from the app with no CSP violation', async ({ page }) => {
  const fontResponses = [];
  const violations = [];
  page.on('response', (response) => {
    if (response.url().includes('/assets/fonts/')) {
      fontResponses.push({ url: response.url(), status: response.status(), type: response.headers()['content-type'] });
    }
  });
  page.on('console', (message) => { if (/content security policy|violat/i.test(message.text())) violations.push(message.text()); });
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  await openPage(page, context, '/app/threads');
  await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.id = 'font-probe';
    probe.innerHTML = '<span style="font-family: Inter; font-weight: 400">a</span>'
      + '<span style="font-family: Inter; font-weight: 600">b</span>'
      + '<span style="font-family: Inter; font-weight: 700">c</span>'
      + '<code style="font-family: \'JetBrains Mono\'">d</code>';
    document.body.append(probe);
  });
  const faces = await page.evaluate(async () => {
    // Loading is lazy: faces load when an element uses them. Wait for those loads to settle.
    await document.fonts.ready;
    await Promise.all([...document.fonts].map((face) => (face.status === 'unloaded' ? face.load().catch(() => {}) : null)));
    await document.fonts.ready;
    return [...document.fonts].map((face) => ({ family: face.family.replace(/["']/g, ''), weight: face.weight, status: face.status }));
  });
  const loaded = (family) => faces.filter((face) => face.family === family && face.status === 'loaded');
  expect(loaded('Inter').length).toBeGreaterThan(0);
  expect(loaded('JetBrains Mono').length).toBeGreaterThan(0);
  expect(fontResponses.length).toBeGreaterThanOrEqual(2);
  for (const response of fontResponses) {
    expect(response.status, response.url).toBe(200);
    expect(response.type, response.url).toBe('font/woff2');
  }
  expect(fontResponses.some((response) => /inter-\d+\.woff2/.test(response.url))).toBe(true);
  expect(fontResponses.some((response) => /jetbrains-mono-400\.woff2/.test(response.url))).toBe(true);
  expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
  expect(violations).toEqual([]);
});
