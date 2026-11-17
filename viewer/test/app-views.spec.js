'use strict';

// Features, Agents and Terminal pages against a real server (Spec "Views"), at phone and
// desktop width. Server and fake machine services come from helpers/app-views-setup.js.
const { test, expect } = require('@playwright/test');
const { buildAgents } = require('../app/agents.js');
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

    test('wide and narrow agent trees open centred', async ({ page }) => {
      test.skip(label !== 'desktop');
      const makeLead = count => ({
        name: 'wc-a-lead', role: 'lead', display_title: 'A thread', live: true, state: 'working',
        children: Array.from({ length: count }, (_, i) => ({ name: `wc-a-worker-${i}`, role: 'worker', display_title: `Worker ${i}`, live: true, state: 'working', children: [] })),
      });
      await page.route('**/api/agents', route => route.fulfill({ json: { leads: [{ thread_id: 'a', thread_title: 'A thread', lead_name: 'Alpha', project: 'project-a', stage: 'building', counts: { total: 6 }, session: makeLead(5), asides: [] }], machines: [] } }));
      await openPage(page, context, '/app/agents?lead=a');
      const tree = page.locator('.agents-tree');
      await expect(tree.locator('.agents-box')).toHaveCount(6);
      await expect(page.locator('.agents-tree .agents-children > .agents-branch .agents-box').first()).toBeVisible();
      const wide = await page.evaluate(() => {
        const tree = document.querySelector('.agents-tree');
        const first = tree.querySelector('.agents-sizer > .agents-branch > .agents-box').getBoundingClientRect();
        return { tree: tree.getBoundingClientRect().toJSON(), first: first.toJSON(), scrollWidth: tree.scrollWidth, clientWidth: tree.clientWidth };
      });
      expect(Math.abs(wide.first.left + wide.first.width / 2 - wide.tree.left - wide.tree.width / 2)).toBeLessThanOrEqual(2);
      expect(wide.scrollWidth).toBeGreaterThan(wide.clientWidth);
      await tree.evaluate(node => { node.scrollLeft = node.scrollWidth; });
      const lastRight = await page.locator('.agents-children > .agents-branch .agents-box').last().evaluate(node => node.getBoundingClientRect().right);
      const treeRight = await tree.evaluate(node => node.getBoundingClientRect().right);
      expect(lastRight).toBeLessThanOrEqual(treeRight + 1);

      await page.route('**/api/agents', route => route.fulfill({ json: { leads: [{ thread_id: 'a', thread_title: 'A thread', lead_name: 'Alpha', project: 'project-a', stage: 'building', counts: { total: 3 }, session: makeLead(2), asides: [] }], machines: [] } }));
      await page.reload();
      await expect(page.locator('.agents-tree .agents-box')).toHaveCount(3);
      await expect(page.locator('.agents-tree .agents-sizer > .agents-branch > .agents-box')).toBeVisible();
      const centered = await page.evaluate(() => {
        const tree = document.querySelector('.agents-tree').getBoundingClientRect();
        const lead = document.querySelector('.agents-tree .agents-sizer > .agents-branch > .agents-box').getBoundingClientRect();
        return Math.abs((lead.left + lead.width / 2) - (tree.left + tree.width / 2));
      });
      expect(centered).toBeLessThanOrEqual(2);
    });

    test('zooming keeps the point under the pointer still, including when scrolled down', async ({ page }) => {
      test.skip(label !== 'desktop');
      const chain = depth => depth ? [{ name: `deep-${depth}`, role: 'worker', display_title: `Deep ${depth}`, live: true, state: 'working', children: chain(depth - 1) }] : [];
      await page.route('**/api/agents', route => route.fulfill({ json: { leads: [{ thread_id: 'a', lead_name: 'a', counts: { total: 9 }, session: { name: 'lead-a', role: 'lead', live: true, state: 'working', children: chain(8) }, asides: [] }], machines: [] } }));
      await openPage(page, context, '/app/agents?lead=a');
      const tree = page.locator('.agents-tree');
      await expect(page.locator('.agents-zoom')).toHaveText('100%');
      await tree.evaluate(n => { n.scrollTop = 200; });
      const rect = await tree.boundingBox(); const x = rect.x + rect.width / 2, y = rect.y + 150;
      const box = page.locator('[data-session="deep-5"]');
      const before = await box.boundingBox();
      await tree.dispatchEvent('wheel', { ctrlKey: true, deltaY: -40, clientX: x, clientY: y });
      const after = await box.boundingBox(); const ratio = after.width / before.width;
      expect(ratio).toBeGreaterThan(1.1);
      expect(Math.abs((after.y - y) - (before.y - y) * ratio)).toBeLessThanOrEqual(1.5);
      expect(Math.abs((after.x - x) - (before.x - x) * ratio)).toBeLessThanOrEqual(1.5);
    });

    test('tree viewport supports pan, zoom, refresh, selection and terminal', async ({ page }) => {
      test.skip(label !== 'desktop');
      const children = Array.from({ length: 12 }, (_, i) => ({ name: `worker-${i}`, role: 'worker', display_title: `Worker ${i}`, live: true, state: 'working', children: i < 2 ? [{ name: `nested-${i}`, role: 'worker', display_title: `Nested ${i}`, live: true, state: 'working', children: [] }] : [] }));
      const lead = id => ({ thread_id: id, lead_name: id, counts: { total: 15 }, session: { name: `lead-${id}`, role: 'lead', live: true, state: 'working', children }, asides: [] });
      await page.route('**/api/agents', route => route.fulfill({ json: { leads: [lead('a'), lead('b')], machines: [] } }));
      await page.route('**/api/sessions/*/pane?*', route => route.fulfill({ json: { pane: '' } }));
      await openPage(page, context, '/app/agents?lead=a');
      const tree = page.locator('.agents-tree'), zoom = page.locator('.agents-zoom');
      await expect(zoom).toHaveText('100%');
      const rect = await tree.boundingBox();
      const before = await tree.evaluate(n => n.scrollLeft);
      await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height - 10); await page.mouse.down(); await page.mouse.move(rect.x + rect.width / 2 - 80, rect.y + rect.height - 40); await page.mouse.up();
      expect(await tree.evaluate(n => n.scrollLeft)).toBeGreaterThan(before);
      const box = page.locator('[data-session="lead-a"]');
      await box.scrollIntoViewIfNeeded(); const b = await box.boundingBox();
      await page.mouse.move(b.x + 20, b.y + 20); await page.mouse.down(); await page.mouse.move(b.x - 40, b.y + 20); await page.mouse.up();
      await expect(page).not.toHaveURL(/agent=/); await expect(page.locator('.agents-side')).toContainText('Select an agent');
      await page.getByRole('button', { name: 'Zoom in' }).click(); await expect(zoom).toHaveText('125%');
      await page.getByRole('button', { name: 'Zoom out' }).click(); await expect(zoom).toHaveText('100%');
      for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Zoom in' }).click(); await expect(zoom).toHaveText('200%');
      for (let i = 0; i < 15; i++) await page.getByRole('button', { name: 'Zoom out' }).click(); await expect(zoom).toHaveText('20%');
      await page.getByRole('button', { name: 'Full size' }).click();
      const width = await box.evaluate(n => n.getBoundingClientRect().width), dpr = await page.evaluate(() => devicePixelRatio);
      await tree.dispatchEvent('wheel', { ctrlKey: true, deltaY: -20, clientX: rect.x + 100, clientY: rect.y + 100 });
      expect(await box.evaluate(n => n.getBoundingClientRect().width)).toBeGreaterThan(width); expect(await page.evaluate(() => devicePixelRatio)).toBe(dpr);
      const state = await tree.evaluate(n => [n.scrollLeft, n.scrollTop]); const zoomText = await zoom.textContent();
      await page.waitForTimeout(5500); await expect(zoom).toHaveText(zoomText); const after = await tree.evaluate(n => [n.scrollLeft, n.scrollTop]); expect(Math.abs(after[0]-state[0])).toBeLessThanOrEqual(1); expect(Math.abs(after[1]-state[1])).toBeLessThanOrEqual(1);
      await page.getByRole('button', { name: 'Fit', exact: true }).click();
      const fits = await tree.evaluate(n => { const r=n.getBoundingClientRect(); return [...n.querySelectorAll('.agents-box')].every(b => { const x=b.getBoundingClientRect(); return x.left >= r.left-1 && x.right <= r.right+1 && x.top >= r.top-1 && x.bottom <= r.bottom+1; }); }); expect(fits).toBe(true);
      await page.getByRole('button', { name: 'Full size' }).click(); await expect(zoom).toHaveText('100%');
      await box.scrollIntoViewIfNeeded();
      const held = await box.boundingBox(); await page.mouse.move(held.x + 20, held.y + 20); await page.mouse.down(); await page.waitForTimeout(5500); await page.mouse.up(); await expect(page).toHaveURL(/agent=lead-a/);
      await expect(zoom).toHaveText('100%');
      await page.getByRole('button', { name: 'Open terminal' }).click(); await tree.evaluate(n => n.scrollTop=n.scrollHeight);
      const bounds = await page.evaluate(() => ({ terminal: document.querySelector('#agents-terminal').getBoundingClientRect().top, bottom: Math.max(...[...document.querySelectorAll('.agents-box')].map(n => n.getBoundingClientRect().bottom)) })); expect(bounds.bottom).toBeLessThanOrEqual(bounds.terminal+1);
      await page.locator('.agents-entry', { hasText: 'b' }).click(); await expect(zoom).toHaveText('100%');
    });

    async function setupPanTree(page) {
      const children = Array.from({ length: 12 }, (_, i) => ({ name: `worker-${i}`, role: 'worker', display_title: `Worker ${i}`, live: true, state: 'working', children: i < 2 ? [{ name: `nested-${i}`, role: 'worker', display_title: `Nested ${i}`, live: true, state: 'working', children: [] }] : [] }));
      const lead = id => ({ thread_id: id, lead_name: id, counts: { total: 15 }, session: { name: `lead-${id}`, role: 'lead', live: true, state: 'working', children }, asides: [] });
      const response = { leads: [lead('a'), lead('b')], machines: [] };
      await page.route('**/api/agents', route => route.fulfill({ json: response }));
      await openPage(page, context, '/app/agents?lead=a');
      await expect(page.locator('.agents-tree .agents-box')).toHaveCount(15);
      return response;
    }

    async function panTree(page) {
      const tree = page.locator('.agents-tree');
      const rect = await tree.boundingBox();
      await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height - 10);
      await page.mouse.down();
      await page.mouse.move(rect.x + rect.width / 2 - 80, rect.y + rect.height - 70);
      await page.mouse.up();
    }

    test('dragging empty tree space moves both scroll axes by the pointer distance', async ({ page }) => {
      test.skip(label !== 'desktop');
      await setupPanTree(page);
      for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Zoom in' }).click();
      const tree = page.locator('.agents-tree');
      await tree.evaluate(n => { n.scrollTop = 30; });
      const before = await tree.evaluate(n => ({ left: n.scrollLeft, top: n.scrollTop, remaining: n.scrollHeight - n.clientHeight - n.scrollTop }));
      expect(before.remaining).toBeGreaterThanOrEqual(60);
      await panTree(page);
      const after = await tree.evaluate(n => ({ left: n.scrollLeft, top: n.scrollTop }));
      expect(Math.abs(after.left - before.left - 80)).toBeLessThanOrEqual(2);
      expect(Math.abs(after.top - before.top - 60)).toBeLessThanOrEqual(2);
    });

    test('selecting a box after pan and zoom preserves the view', async ({ page }) => {
      test.skip(label !== 'desktop');
      await setupPanTree(page);
      await panTree(page);
      await page.getByRole('button', { name: 'Zoom in' }).click();
      const tree = page.locator('.agents-tree'), zoom = page.locator('.agents-zoom');
      const box = page.locator('[data-session="lead-a"]');
      await box.scrollIntoViewIfNeeded();
      const before = await tree.evaluate(n => [n.scrollLeft, n.scrollTop]);
      const zoomText = await zoom.textContent();
      await box.click();
      await expect(page).toHaveURL(/agent=lead-a/);
      await expect(zoom).toHaveText(zoomText);
      const after = await tree.evaluate(n => [n.scrollLeft, n.scrollTop]);
      expect(Math.abs(after[0] - before[0])).toBeLessThanOrEqual(1);
      expect(Math.abs(after[1] - before[1])).toBeLessThanOrEqual(1);
    });

    test('switching leads resets zoom and centres the new lead at the top', async ({ page }) => {
      test.skip(label !== 'desktop');
      await setupPanTree(page);
      await panTree(page);
      await page.getByRole('button', { name: 'Zoom in' }).click();
      await page.locator('.agents-entry', { hasText: 'b' }).click();
      await expect(page.locator('.agents-zoom')).toHaveText('100%');
      const position = await page.locator('.agents-tree').evaluate(n => {
        const tree = n.getBoundingClientRect(), box = n.querySelector('[data-session="lead-b"]').getBoundingClientRect();
        return { top: n.scrollTop, centre: Math.abs(box.left + box.width / 2 - tree.left - tree.width / 2) };
      });
      expect(position.top).toBe(0);
      expect(position.centre).toBeLessThanOrEqual(2);
    });

    test('release outside the tree allows polls and later selection', async ({ page }) => {
      test.skip(label !== 'desktop');
      const response = await setupPanTree(page);
      const tree = await page.locator('.agents-tree').boundingBox();
      const sidebar = await page.locator('.agents-sidebar').boundingBox();
      await page.mouse.move(tree.x + 10, tree.y + tree.height - 10);
      await page.mouse.down();
      await page.mouse.move(sidebar.x + 10, sidebar.y + sidebar.height - 10);
      await page.mouse.up();
      response.leads[0].session.display_title = 'Updated after poll';
      await page.waitForTimeout(5500);
      await expect(page.locator('[data-session="lead-a"]')).toContainText('Updated after poll');
      await page.locator('[data-session="lead-a"]').click();
      await expect(page).toHaveURL(/agent=lead-a/);
    });

    async function showTree(page, children, selectedName) {
      const lead = { name: 'wc-a-lead', role: 'lead', display_title: 'A thread', live: true, state: 'working', children };
      await page.route('**/api/agents', route => route.fulfill({ json: { leads: [{ thread_id: 'a', thread_title: 'A thread', lead_name: 'Alpha', project: 'project-a', stage: 'building', counts: { total: children.length + 1 }, session: lead, asides: [] }], machines: [] } }));
      await openPage(page, context, `/app/agents?lead=a${selectedName ? `&agent=${selectedName}` : ''}`);
      await expect(page.locator('.agents-tree .agents-box')).toHaveCount(children.length + 1);
    }

    // The horizontal connector each child draws, as page x-ranges, plus each child box's centre.
    function connectors(page) {
      return page.evaluate(() => {
        const list = document.querySelector('.agents-tree .agents-sizer > .agents-branch > .agents-children');
        const branches = [...list.children];
        const centre = r => r.left + r.width / 2;
        return {
          listBorder: getComputedStyle(list).borderTopStyle,
          stub: centre(document.querySelector('.agents-tree .agents-sizer > .agents-branch > .agents-box').getBoundingClientRect()),
          centres: branches.map(b => centre(b.querySelector('.agents-box').getBoundingClientRect())),
          bars: branches.map(b => {
            const s = getComputedStyle(b, '::after'); const r = b.getBoundingClientRect();
            return s.display === 'none' || s.content === 'none' ? null : [r.left + parseFloat(s.left), r.right - parseFloat(s.right)];
          }),
        };
      });
    }

    test('one child hangs from a single straight line', async ({ page }) => {
      test.skip(label !== 'desktop');
      await showTree(page, [{ name: 'wc-a-worker', role: 'worker', display_title: 'Only child', live: true, state: 'working', children: [] }]);
      const c = await connectors(page);
      expect(c.listBorder).toBe('none');
      expect(c.bars).toEqual([null]);
      expect(Math.abs(c.centres[0] - c.stub)).toBeLessThanOrEqual(1);
    });

    test('several children share a bar from the first centre to the last', async ({ page }) => {
      test.skip(label !== 'desktop');
      const kids = [0, 1, 2].map(i => ({ name: `wc-a-worker-${i}`, role: 'worker', display_title: `Worker ${i}`, live: true, state: 'working', children: [] }));
      await showTree(page, kids);
      const c = await connectors(page);
      expect(c.listBorder).toBe('none');
      expect(c.bars.every(Boolean)).toBe(true);
      const left = Math.min(...c.bars.map(b => b[0])); const right = Math.max(...c.bars.map(b => b[1]));
      expect(Math.abs(left - c.centres[0])).toBeLessThanOrEqual(1);
      expect(Math.abs(right - c.centres[2])).toBeLessThanOrEqual(1);
      for (let i = 1; i < c.bars.length; i++) expect(c.bars[i][0]).toBeLessThanOrEqual(c.bars[i - 1][1] + 1);
    });

    test('a long box title is clamped to three lines; the side panel shows it whole with the report', async ({ page }) => {
      const long = Array.from({ length: 40 }, (_, i) => `Finding ${i}: something the reviewer said at length.`).join(' ');
      await showTree(page, [{ name: 'wc-a-reviewer', role: 'reviewer', display_title: long, result_summary: 'VERDICT: PASS\nAll checks ran.', live: false, state: 'finished', children: [] }]);
      const title = page.locator('[data-session="wc-a-reviewer"] .agents-box-title');
      const size = await title.evaluate(node => ({ height: node.clientHeight, full: node.scrollHeight, line: parseFloat(getComputedStyle(node).lineHeight) }));
      expect(size.height).toBeLessThanOrEqual(size.line * 3 + 2);
      expect(size.height).toBeGreaterThan(size.line * 2);
      expect(size.full).toBeGreaterThan(size.height);
      await page.locator('[data-session="wc-a-reviewer"]').click();
      await expect(page.locator('.agents-side h2')).toHaveText(long);
      await expect(page.locator('.agents-report-head')).toHaveText('Report');
      await expect(page.locator('.agents-report')).toHaveText('VERDICT: PASS\nAll checks ran.');
    });

    test('phone agent selection shows only details and returns to the tree', async ({ page }) => {
      test.skip(label !== 'phone');
      await page.setViewportSize({ width: 390, height: 844 });
      const child = { name: 'wc-a-child', role: 'worker', display_title: 'Build the feature', live: true, state: 'working', children: [] };
      const lead = { name: 'wc-a-lead', role: 'lead', display_title: 'A thread', live: true, state: 'working', children: [child] };
      await page.route('**/api/agents', route => route.fulfill({ json: { leads: [{ thread_id: 'a', thread_title: 'A thread', lead_name: 'Alpha', project: 'project-a', stage: 'building', counts: { total: 2 }, session: lead, asides: [] }], machines: [] } }));
      await openPage(page, context, '/app/agents?lead=a&agent=wc-a-child');
      await expect(page.locator('.agents-main')).toBeHidden();
      await expect(page.locator('.agents-sidebar')).toBeHidden();
      await expect(page.locator('.agents-side')).toBeVisible();
      await page.getByRole('button', { name: '‹ Alpha' }).click();
      await expect(page.locator('.agents-main')).toBeVisible();
      await expect(page.locator('.agents-toolbar')).toBeHidden();
      await expect(page.locator('.agents-children')).toHaveCSS('display', 'block');
      await expect(page.locator('.agents-side')).toBeHidden();
    });

    test('agent tree keeps selection and shows agent details', async ({ page }) => {
      const waiting = { name: 'wc-a-mapper', role: 'mapper', display_title: 'Map the code', live: true, state: 'waiting', waiting_on: { label: 'Waiting on the lead' }, children: [] };
      const child = { name: 'wc-a-reviewer', role: 'reviewer', display_title: 'Review the plan', live: true, state: 'working', model: 'model-a', effort: 'high', turn_started_at: new Date(Date.now() - 4 * 60000).toISOString(), has_brief: true, children: [waiting] };
      const done = { name: 'wc-a-worker', role: 'worker', display_title: 'Finished work', live: false, state: 'finished', created_at: '2026-01-01T00:00:00Z', ended_at: '2026-01-01T00:22:00Z', children: [] };
      const lead = { name: 'wc-a-lead', role: 'lead', display_title: 'A thread', live: true, state: 'needs-you', model: 'model-a', children: [child, done] };
      await page.route('**/api/agents', route => route.fulfill({ json: { leads: [{ thread_id: 'a', thread_title: 'A thread', lead_name: 'Alpha', project: 'project-a', stage: 'building', machine: 'hub', counts: { total: 4, working: 1, waiting: 2, finished: 1 }, session: lead, asides: [] }, { thread_id: 'b', thread_title: 'Done thread', lead_name: 'Beta', project: 'project-b', stage: 'done', finished: true, finished_at: new Date().toISOString(), counts: { total: 1 }, session: done }], machines: [{ machine: 'node-3', reachable: false }] } }));
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
      await expect(page.locator('.agents-finished')).toContainText('Done · 1 agent');
      if (label === 'phone') await page.locator('.agents-entry', { hasText: 'Alpha' }).click();
      await expect(page.locator('[data-session="wc-a-worker"]')).toHaveCSS('border-top-style', 'dashed');
      await expect(page.locator('[data-session="wc-a-mapper"]')).toContainText('Waiting on the lead');
      await expect(page.locator('.agents-box', { hasText: 'Needs you' })).toHaveCount(1);
      await expect(page.locator('body')).not.toContainText('tmux');
      await page.locator('[data-session="wc-a-reviewer"]').click();
      await page.getByRole('button', { name: 'Read its brief' }).click();
      await expect(page.locator('#brief-text')).toHaveText('<b>Plain brief</b>');
      await page.waitForTimeout(5500);
      await expect(page.locator('#brief-dialog')).toBeVisible();
      await page.getByRole('button', { name: 'Close', exact: true }).last().click();
      await expect(page.locator('.agents-side')).toContainText('Review the plan');
      await expect(page.locator('.agents-side')).toContainText('model-a · high');
      await expect(page.locator('.agents-side')).toContainText(/Working for \d+m/);
      await page.waitForTimeout(5500); // one poll redraw keeps the selected agent
      await expect(page).toHaveURL(/agent=wc-a-reviewer/);
      await expect(page.locator('.agents-side')).toContainText('Review the plan');
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
      await page.waitForTimeout(5500); // a redraw keeps the open terminal, still in Typing
      await expect(page.locator('#agents-terminal')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Typing' })).toBeVisible();
      if (label === 'desktop') {
        await page.locator('[data-session="wc-a-lead"]').click();
        await expect(page.getByRole('button', { name: 'View only' })).toBeVisible();
        await page.locator('[data-session="wc-a-worker"]').click();
        await expect(page.locator('#agents-terminal')).toBeHidden();
        await expect(page.locator('.agents-side')).toContainText('Ran 22m');
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

    test('activity, memory and question paths render from the agents API', async ({ page }) => {
      const since = new Date(Date.now() - 10000).toISOString();
      const worker = { name: 'worker', role: 'worker', live: true, state: 'working', children: [], context: { percent: 75 }, activity: { counts: { files: 10, shell: 5, web: 5 }, trail: ['files','shell'], current: { kind: 'web', label: 'Running tests', since }, latest: Array.from({ length: 5 }, (_, i) => ({ label: `Step ${i}`, at: since, state: 'running' })), normal: { samples: [180000,180000], typical_ms: 180000 } } };
      const middle = { name: 'middle', role: 'sub-lead', children: [worker] };
      const other = { name: 'other', role: 'worker', children: [{ name: 'other-child', role: 'worker', children: [] }] };
      const lead = { name: 'lead', role: 'lead', children: [middle, other] };
      const payload = { leads: [{ thread_id: 'a', lead_name: 'Alpha', session: lead, question_paths: [['worker','lead']] }], machines: [] };
      await page.route('**/api/agents', route => route.fulfill({ json: payload }));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openPage(page, context, '/app/agents?lead=a&agent=worker');
      await expect(page.locator('.activity-line')).toHaveCount(6);
      await expect(page.locator('.activity-line[data-kind="files"]')).toHaveAttribute('stroke-width','6');
      await expect(page.locator('.activity-line[data-kind="shell"]')).toHaveAttribute('stroke-width','3.5');
      await expect(page.locator('.activity-count')).toHaveCount(3);
      await expect(page.locator('.activity-trail')).toHaveCount(1);
      await expect(page.locator('.activity-label').first()).toHaveText('Sub-lead');
      const bounds = await page.locator('.agents-activity svg').evaluate(map => [...map.querySelectorAll('text')].every(n => { const b = n.getBBox(), v = map.viewBox.baseVal; return b.x >= v.x && b.y >= v.y && b.x + b.width <= v.x + v.width && b.y + b.height <= v.y + v.height; }));
      expect(bounds).toBe(true);
      await expect(page.locator('.activity-ring-group title')).toHaveText('Memory 75% full');
      await expect(page.locator('.agents-insight')).toContainText("That's expected.");
      await expect(page.locator('.agents-insight')).toContainText('about 3 minutes the last two times');
      await expect(page.locator('.agents-latest-row')).toHaveCount(4);
      await expect(page.locator('.latest-running').first()).toHaveText('●');
      await expect(page.locator('.agents-latest-row time').first()).toHaveText(/^\d{2}:\d{2}$/);
      await expect(page.locator('.activity-ring-group > .activity-ring-base')).toHaveCount(1);
      if (process.env.AGENTS_SHOTS && test.info().project.name === 'chromium') { await page.setViewportSize(label === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 800 }); await page.screenshot({ path: `${process.env.AGENTS_SHOTS}/${label}.png` }); }
      if (label === 'phone') await page.getByRole('button', { name: '‹ Alpha' }).click();
      await expect(page.locator('.agents-path-overlay path')).toHaveCount(2);
      await expect(page.locator('[data-session="middle"]')).not.toHaveClass(/question-path/);
      await expect(page.locator('[data-session="worker"]')).toHaveClass(/question-path/);
      await expect(page.locator('[data-session="lead"]')).toHaveClass(/question-path/);
      const stroke = await page.locator('.agents-path-overlay path').first().evaluate(n => [getComputedStyle(n).stroke, getComputedStyle(n).getPropertyValue('--warn').trim()]);
      expect(stroke[0]).toBe(await page.evaluate(color => { const e = document.createElement('div'); e.style.color = color; document.body.append(e); const c = getComputedStyle(e).color; e.remove(); return c; }, stroke[1]));
      if (label === 'phone') {
        for (const name of ['worker', 'middle']) {
          const list = page.locator(`[data-session="${name}"]`).locator('..').locator('..');
          await expect(list).toHaveClass(/question-path-line/);
          const colors = await list.evaluate(n => { const probe = document.createElement('span'); probe.style.color = 'var(--warn)'; n.append(probe); const values = [getComputedStyle(n).borderLeftColor, getComputedStyle(probe).color]; probe.remove(); return values; });
          expect(colors[0]).toBe(colors[1]);
        }
        await expect(page.locator('[data-session="other-child"]').locator('..').locator('..')).not.toHaveClass(/question-path-line/);
        await expect(page.locator('.agents-path-overlay')).toBeHidden();
        if (process.env.AGENTS_SHOTS && test.info().project.name === 'chromium') await page.screenshot({ path: `${process.env.AGENTS_SHOTS}/phone-tree.png` });
      }
      await expect(page.locator('.agents-path-legend')).toBeVisible();
      if (label === 'phone') await page.locator('[data-session="worker"]').click();
      await expect(page.locator('.activity-flow')).toHaveCSS('animation-name','none');
      const before = await page.locator('.activity-now').textContent();
      await expect.poll(() => page.locator('.activity-now').textContent()).not.toBe(before);
    });

    for (const relayed of [false, true]) {
      test(`real agents payload renders ${relayed ? 'relayed' : 'direct'} question trail`, async ({ page }) => {
        test.skip(label !== 'desktop');
        const at = '2026-01-01T06:23:00';
        const sessions = [
          { name: 'lead', role: 'lead', live: true },
          { name: 'sub', role: 'sub-lead', started_by: 'lead', live: true },
          { name: 'worker', role: 'worker', started_by: 'sub', live: true },
        ];
        const cards = [{ kind: 'message', id: 'ask', session: 'worker', to: relayed ? 'sub' : 'lead', asks: true, text: 'Question?', at }];
        if (relayed) cards.push({ kind: 'message', id: 'relay', session: 'sub', to: 'lead', asks: true, passes_on: 'ask', text: 'Needs a decision', at });
        cards.push({ kind: 'question', id: 'card', session: 'lead', passes_on: relayed ? 'relay' : 'ask', question: 'Choose?', at });
        const leads = buildAgents([{ id: 'a', title: 'Thread', lead_name: 'Beta', sessions, cards }]);
        await page.route('**/api/agents', route => route.fulfill({ json: { leads, machines: [] } }));
        await openPage(page, context, '/app/agents?lead=a&agent=worker');
        await expect(page.locator('[data-session="worker"]')).toHaveClass(/question-path/);
        await expect(page.locator('[data-session="lead"]')).toHaveClass(/question-path/);
        await expect(page.locator('.agents-path-legend')).toBeVisible();
        const lines = [`Asked ${relayed ? 'the sub-lead' : 'Beta'} at 06:23`];
        if (relayed) lines.push('The sub-lead passed it to Beta: Needs a decision');
        lines.push('Beta is asking you in the thread');
        await expect(page.locator('.agents-question strong, .agents-question span')).toHaveText(lines);
        await expect(page.getByRole('link', { name: 'Go to the question' })).toHaveAttribute('href', '/wheelchair/app/thread?id=a#card-card');
      });
    }

    test('activity handles timing, memory and waiting variations', async ({ page }) => {
      test.skip(label !== 'desktop');
      const worker = { name: 'worker', role: 'worker', children: [], activity: {}, context: null };
      const middle = { name: 'middle', role: 'sub-lead', children: [worker] };
      const lead = { name: 'lead', role: 'lead', children: [middle] };
      const record = { thread_id: 'a', lead_name: 'Beta', session: lead };
      await page.route('**/api/agents', route => route.fulfill({ json: { leads: [record], machines: [] } }));
      const load = () => openPage(page, context, '/app/agents?lead=a&agent=worker');
      await load();
      await expect(page.locator('.agents-insight')).toHaveCount(0);
      await expect(page.locator('.activity-ring')).toHaveCount(0);
      await expect(page.locator('.agents-activity title')).toHaveCount(0);
      await expect(page.locator('.agents-latest')).toContainText('Nothing yet.');
      await expect(page.locator('.agents-path-legend')).toHaveCount(0);
      worker.activity = { current: { kind: 'files', label: 'Reading files', since: new Date(Date.now()-45000).toISOString() }, latest: [{ label: 'Done', at: new Date().toISOString(), state: 'done' }, { label: 'Failed', at: new Date().toISOString(), state: 'failed' }] };
      worker.context = { percent: 50 }; await load();
      await expect(page.locator('.agents-insight')).toContainText('Nothing earlier to compare it with.');
      await expect(page.locator('.activity-ring-group title')).toHaveText('Memory 50% full');
      await expect(page.locator('.latest-done')).toHaveText('✓'); await expect(page.locator('.latest-failed')).toHaveText('✕');
      worker.activity.normal = { samples: [10000], typical_ms: 10000 }; worker.context.percent = 95; await load();
      await expect(page.locator('.agents-insight')).toContainText('Longer than usual.');
      await expect(page.locator('.agents-long')).toContainText('last time.');
      await expect(page.locator('.activity-ring-group title')).toHaveText('Memory 95% full');
      worker.activity.current = { kind: 'files', since: new Date(Date.now()-3900000).toISOString() }; await load();
      await expect(page.locator('.agents-insight')).toContainText('Quiet for 1h 05m');
      await expect(page.locator('.agents-insight')).toContainText("It's working");
      await openPage(page, context, '/app/agents?lead=a&agent=lead');
      await expect(page.locator('.activity-label').first()).toHaveText('You');
      record.question_paths = [['worker','missing']]; await load();
      await expect(page.locator('.agents-path-overlay path')).toHaveCount(0);
      worker.question = { asked_at: new Date().toISOString(), to: 'middle', trail: [{ who: 'worker', text: 'Question' }, { who: 'middle', text: 'Needs a decision' }], card_id: 'card1' }; await load();
      await expect(page.locator('.agents-question')).toContainText('Asked the sub-lead at');
      await expect(page.locator('.agents-question')).toContainText('The sub-lead passed it to Beta: Needs a decision');
      await expect(page.getByRole('link', { name: 'Go to the question' })).toHaveAttribute('href','/wheelchair/app/thread?id=a#card-card1');
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
