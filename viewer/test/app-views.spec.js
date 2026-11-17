'use strict';

// Features, Agents and Terminal pages against a real server (Spec "Views"), at phone and
// desktop width. Server and fake machine services come from helpers/app-views-setup.js.
const { test, expect } = require('@playwright/test');
const { closeViews, openPage, setupViews } = require('./helpers/app-views-setup.js');

const VIEWPORTS = {
  phone: { width: 360, height: 844 },
  desktop: { width: 1280, height: 800 },
};

let context;
test.beforeAll(async () => { context = await setupViews(); });
test.afterAll(async () => { await closeViews(context); });

for (const [label, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(label, () => {
    test.use({ viewport });

    async function noSideScroll(page) {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    }

    test('features are grouped by status', async ({ page }) => {
      await openPage(page, context, '/app/features');
      const expected = {
        idea: 'idea-one', planning: 'plan-one', review: 'review-one',
        building: 'build-one', verifying: 'verify-one', done: 'done-one',
      };
      for (const [stage, slug] of Object.entries(expected)) {
        const group = page.locator(`section[data-stage="${stage}"]`);
        await expect(group.locator('.feature')).toHaveCount(1);
        await expect(group).toContainText(slug);
        const link = group.locator('.feature a');
        const id = context.seed.made[slug].id;
        await expect(link).toHaveAttribute('href', `/wheelchair/app/thread?id=${id}`);
      }
      await noSideScroll(page);
    });

    test('the Needs you strip lists open cards with links to them', async ({ page }) => {
      await openPage(page, context, '/app/features');
      const strip = page.locator('#needs');
      await expect(strip).toBeVisible();
      await expect(strip.locator('.need')).toHaveCount(2);
      const { question, approval, made } = context.seed;
      const questionLink = strip.locator('.need[data-kind="question"] a');
      await expect(questionLink).toContainText('Who does a stuck worker ask?');
      await expect(questionLink).toHaveAttribute(
        'href', `/wheelchair/app/thread?id=${made['plan-one'].id}#card-${question.id}`);
      await expect(strip.locator('.need[data-kind="approval"] a')).toHaveAttribute(
        'href', `/wheelchair/app/thread?id=${made['review-one'].id}#card-${approval.id}`);
    });

    test('agent tree shows waits, attach commands and keeps its fold across redraws', async ({ page }) => {
      const child = { name: 'wc-a-reviewer', role: 'reviewer', live: true, status: 'running', children: [{ name: 'wc-a-worker', role: 'worker', live: true, status: 'running', children: [], waiting_on: [] }], waiting_on: [] };
      const lead = { name: 'wc-a-lead', role: 'lead', live: true, status: 'running', cli: 'codex', model: 'model-a', effort: null, children: [child], waiting_on: [child.name] };
      await page.route('**/api/agents', route => route.fulfill({ json: { leads: [{ thread_id: 'a', thread_title: 'A thread', lead_name: 'Alpha', machine: 'hub', session: lead, children: [child] }], machines: [{ machine: 'hearth', hub: true, reachable: true }, { machine: 'node-3', reachable: false, last_seen: '2030-06-15T12:00:00Z' }] } }));
      await openPage(page, context, '/app/agents#lead-a');
      const group = page.locator('#lead-a');
      await expect(group).toContainText('Waiting on: reviewer');
      await expect(group.locator('[data-session="wc-a-reviewer"]')).toHaveClass(/awaited/);
      await expect(group.locator('[data-session="wc-a-worker"]')).toBeVisible();
      await expect(group.locator('[data-session="wc-a-lead"] code')).toHaveText('tmux attach -t wc-a-lead');
      await expect(page.locator('#unreachable')).toContainText('node-3 unreachable, last seen');
      await noSideScroll(page);
      await group.locator('summary').first().click();
      await page.waitForTimeout(5500);
      await expect(group.locator('[data-session="wc-a-reviewer"]')).toBeHidden();
    });

    test('sessions URL redirects to Agents', async ({ page }) => {
      await openPage(page, context, '/app/sessions');
      await expect(page).toHaveURL(/\/app\/agents$/);
    });

    test('the New thread screen offers found repositories and earlier projects', async ({ page }) => {
      await openPage(page, context, '/app/threads');
      await page.evaluate(() => fetch('/wheelchair/api/settings/preferences', {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ default_project_folder: '/srv/repos' }),
      }));
      context.hub.projects = { found: [{ name: 'listed-only', path: '/srv/repos/listed-only' }] };
      try {
        await page.goto(`${context.server.url}/app/new`);
        await expect(page.locator('#nt-project optgroup[label="In /srv/repos"] option[value="/srv/repos/listed-only"]')).toHaveCount(1);
        await expect(page.locator('#nt-project optgroup[label="Used before"] option[value="/tmp/proj-alpha"]')).toHaveCount(1);
        await expect(page.locator('#nt-project')).toBeEnabled();
        await expect(page.locator('#nt-note')).toHaveText('Only git repositories in /srv/repos are listed.');
        await expect(page.locator('#nt-machine option')).toHaveText(['hub', 'node-2', 'node-3']);
        await noSideScroll(page);
      } finally {
        context.hub.projects = { found: [] };
        await page.evaluate(() => fetch('/wheelchair/api/settings/preferences', {
          method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ default_project_folder: '' }),
        }));
      }
    });

    test('view only blocks input and typing discards mouse and queued paste', async ({ page }) => {
      const name = context.seed.made['build-one'].sessions[0].name;
      const panes = [];
      page.on('request', request => { if (request.url().includes('/pane')) panes.push(request.url()); });
      await openPage(page, context, `/app/terminal?name=${name}`);
      await expect(page.locator('.xterm-rows')).toContainText('fake pane');
      expect(panes.some(url => new URL(url).searchParams.get('history') === '2000')).toBe(true);
      const count = () => context.hub.calls.filter(call => call.path.endsWith('/keys')).length;
      const before = count();
      await page.locator('.xterm').click();
      await page.keyboard.type('abc');
      await page.mouse.wheel(0, -500);
      await page.waitForTimeout(200);
      expect(count()).toBe(before);
      await page.getByRole('button', { name: 'View only' }).click();
      await page.evaluate(() => window.termView._onDataForTest('\x1b[<0;10;20M'));
      await page.waitForTimeout(100);
      expect(count()).toBe(before);
      await page.evaluate(() => window.termView._onDataForTest('x'.repeat(200)));
      await expect.poll(count).toBeGreaterThan(before);
      await page.getByRole('button', { name: 'Typing' }).click();
      await page.waitForTimeout(1500);
      const stopped = count();
      await page.waitForTimeout(1000);
      expect(count()).toBe(stopped);
      expect(stopped - before).toBeLessThan(200);
      await page.getByRole('button', { name: 'View only' }).click();
      await page.reload();
      await expect(page.getByRole('button', { name: 'View only' })).toHaveAttribute('aria-pressed', 'false');
      const afterReload = count();
      await page.locator('.xterm').click();
      await page.keyboard.type('abc');
      await page.waitForTimeout(200);
      expect(count()).toBe(afterReload);
    });

    test('the terminal shows the pane and sends typed keys without an extra Enter', async ({ page }) => {
      const name = context.seed.made['build-one'].sessions[0].name;
      await openPage(page, context, `/app/terminal?name=${name}`);
      await expect(page.locator('.xterm-rows')).toContainText('fake pane');
      await noSideScroll(page);
      await page.getByRole('button', { name: 'View only' }).click();
      const before = context.hub.calls.filter((call) => call.path.endsWith('/keys')).length;
      await page.keyboard.type('l');
      await expect.poll(() => context.hub.calls.filter((call) => call.path.endsWith('/keys')).slice(before).some(call => call.body.keys === 'l')).toBe(true);
      await page.keyboard.type('s');
      await page.keyboard.press('Enter');
      await expect.poll(() => context.hub.calls.filter((call) => call.path.endsWith('/keys')).length)
        .toBe(before + 3);
      await page.waitForTimeout(700);
      const keys = context.hub.calls.filter((call) => call.path.endsWith('/keys')).slice(before);
      expect(keys.map((call) => call.body.keys)).toEqual(['l', 's', 'Enter']);
    });

    test('a typed semicolon is sent as backslash-semicolon, one argument', async ({ page }) => {
      const name = context.seed.made['build-one'].sessions[0].name;
      await openPage(page, context, `/app/terminal?name=${name}`);
      await page.getByRole('button', { name: 'View only' }).click();
      const before = context.hub.calls.filter((call) => call.path.endsWith('/keys')).length;
      await page.locator('.xterm').click();
      await page.keyboard.type(';');
      await expect.poll(() => context.hub.calls.filter((call) => call.path.endsWith('/keys')).length).toBe(before + 1);
      const keys = context.hub.calls.filter((call) => call.path.endsWith('/keys')).slice(before);
      expect(keys.map((call) => call.body.keys)).toEqual(['\\;']);
    });

    test('the key row sends Esc, Tab, Ctrl-C and arrows on a small screen', async ({ page }) => {
      test.skip(label !== 'phone', 'the key row is for touch and narrow screens');
      const name = context.seed.made['build-one'].sessions[0].name;
      await openPage(page, context, `/app/terminal?name=${name}`);
      await page.getByRole('button', { name: 'View only' }).click();
      const before = context.hub.calls.filter((call) => call.path.endsWith('/keys')).length;
      for (const label of ['Esc', 'Tab', 'Ctrl-C']) await page.getByRole('button', { name: label }).click();
      await page.getByRole('button', { name: 'Up' }).click();
      await expect.poll(() => context.hub.calls.filter((call) => call.path.endsWith('/keys')).length)
        .toBe(before + 4);
      const keys = context.hub.calls.filter((call) => call.path.endsWith('/keys')).slice(before);
      expect(keys.map((call) => call.body.keys)).toEqual(['Escape', 'Tab', 'C-c', 'Up']);
    });
  });
}
