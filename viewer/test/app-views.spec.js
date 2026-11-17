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

    test('agent tree keeps selection and shows agent details', async ({ page }) => {
      const child = { name: 'wc-a-reviewer', role: 'reviewer', display_title: 'Review the plan', live: true, state: 'waiting', waiting_on: { label: 'Waiting on the lead' }, has_brief: true, children: [] };
      const done = { name: 'wc-a-worker', role: 'worker', display_title: 'Finished work', live: false, state: 'finished', children: [] };
      const lead = { name: 'wc-a-lead', role: 'lead', display_title: 'A thread', live: true, state: 'needs-you', model: 'model-a', children: [child, done] };
      await page.route('**/api/agents', route => route.fulfill({ json: { leads: [{ thread_id: 'a', thread_title: 'A thread', lead_name: 'Alpha', project: 'project-a', stage: 'building', machine: 'hub', counts: { total: 3, waiting: 2, finished: 1 }, session: lead, asides: [] }, { thread_id: 'b', thread_title: 'Done thread', lead_name: 'Beta', project: 'project-b', stage: 'done', finished: true, finished_at: new Date().toISOString(), counts: { total: 1 }, session: done }], machines: [{ machine: 'node-3', reachable: false }] } }));
      const keys = [];
      await page.route('**/api/sessions/*/keys', async route => { keys.push(route.request().postDataJSON()); await route.fulfill({ json: {} }); });
      await page.route('**/api/sessions/*/pane?*', route => route.fulfill({ json: { pane: 'Agent terminal ready' } }));
      await page.route('**/api/sessions/*/brief', route => route.fulfill({ json: { brief: '<b>Plain brief</b>' } }));
      await openPage(page, context, '/app/agents#lead-a');
      await expect(page).toHaveURL(/agents\?lead=a/);
      await expect(page.locator('#unreachable')).toContainText('node-3 unreachable');
      await expect(page.locator('.agents-sidebar')).toContainText('project-a');
      await expect(page.locator('.agents-finished summary')).toContainText('Finished today (1)');
      if (label === 'phone') await page.getByRole('button', { name: '‹ Leads' }).click();
      await page.locator('.agents-finished summary').click();
      await expect(page.locator('.agents-finished')).toContainText('project-b');
      if (label === 'phone') await page.locator('.agents-entry', { hasText: 'Alpha' }).click();
      await expect(page.locator('[data-session="wc-a-worker"]')).toHaveCSS('border-top-style', 'dashed');
      await expect(page.locator('[data-session="wc-a-reviewer"]')).toContainText('Waiting on the lead');
      await expect(page.locator('.agents-box', { hasText: 'Needs you' })).toHaveCount(1);
      await expect(page.locator('body')).not.toContainText('tmux');
      if (label === 'phone' && test.info().project.name === 'chromium') { await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: '../docs/plans/agents-screen-redesign/reports/T4-phone.png' }); }
      await page.locator('[data-session="wc-a-reviewer"]').click();
      await page.getByRole('button', { name: 'Read its brief' }).click();
      await expect(page.locator('#brief-text')).toHaveText('<b>Plain brief</b>');
      await page.waitForTimeout(5500);
      await expect(page.locator('#brief-dialog')).toBeVisible();
      await page.getByRole('button', { name: 'Close', exact: true }).last().click();
      await expect(page.locator('.agents-side')).toContainText('Review the plan');
      if (label === 'desktop' && test.info().project.name === 'chromium') await page.screenshot({ path: '../docs/plans/agents-screen-redesign/reports/T4-desktop.png' });
      await page.getByRole('button', { name: 'Open terminal' }).click();
      await expect(page.getByRole('button', { name: 'View only' })).toBeVisible();
      await page.evaluate(() => window.agentsTermView._onDataForTest('x'));
      await page.mouse.wheel(0, -100);
      expect(keys).toHaveLength(0);
      await page.getByRole('button', { name: 'View only' }).click();
      await expect(page.getByRole('button', { name: 'Typing' })).toBeVisible();
      await page.evaluate(() => window.agentsTermView._onDataForTest('x'));
      await expect.poll(() => keys.length).toBe(1);
      expect(keys[0].keys).toBe('x');
      if (label === 'desktop' && test.info().project.name === 'chromium') await page.screenshot({ path: '../docs/plans/agents-screen-redesign/reports/T4-terminal.png' });
      if (label === 'desktop') {
        await page.locator('[data-session="wc-a-lead"]').click();
        await expect(page.getByRole('button', { name: 'View only' })).toBeVisible();
        await page.locator('[data-session="wc-a-worker"]').click();
        await expect(page.locator('#agents-terminal')).toBeHidden();
        await page.locator('[data-session="wc-a-reviewer"]').click();
        await page.getByRole('button', { name: 'Open terminal' }).click();
      }
      await page.locator('#agents-close').click();
      await page.getByRole('button', { name: 'Open terminal' }).click();
      await expect(page.getByRole('button', { name: 'View only' })).toBeVisible();
      const popup = page.waitForEvent('popup');
      await page.getByRole('button', { name: 'Pop out' }).click();
      expect((await popup).url()).toContain('terminal?name=wc-a-reviewer');
      if (label === 'phone') { await page.getByRole('button', { name: '‹ Alpha' }).click(); await expect(page.locator('.agents-tree')).toBeVisible(); await page.getByRole('button', { name: '‹ Leads' }).click(); await expect(page.locator('.agents-sidebar')).toBeVisible(); }
      await noSideScroll(page);
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
