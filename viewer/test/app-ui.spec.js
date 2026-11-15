'use strict';

// The app pages' layout and Markdown in chat (docs/proposals/app-shell/design): three columns on
// a wide screen, one column at 390 px with no sideways scroll, the sticky thread header that
// keeps Archive in reach, and a lead message that renders Markdown without running anything.
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');
const { closeViews, openPage, setupViews } = require('./helpers/app-views-setup.js');

async function noSideScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const MARKDOWN = [
  'A paragraph with **bold**, *italic* and `inline code`.',
  '',
  '- first bullet',
  '- second bullet',
  '',
  '1. step one',
  '2. step two',
  '',
  '```',
  'tmux attach -t wc-x',
  '```',
  '',
  'See [the docs](https://example.com/docs) and [a page](/wheelchair/docs?x=1).',
  '',
  '<script>window.__pwned = 1</script>',
  '',
  '[bad link](javascript:window.__pwned=2) and [tabbed](java\tscript:window.__pwned=3)',
  '',
  '<img src=x onerror="window.__pwned=4">',
].join('\n');

test.describe('thread page layout', () => {
  let ctx;
  test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
  test.afterEach(async () => { await ctx.close(); });

  test('desktop: thread list, chat and the new-thread column sit side by side', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const made = await ctx.make({ cli: 'claude' });
    await ctx.patch(made.id, (t) => { t.title = 'Layout thread'; t.slug = 'dark'; t.worktree = '/tmp/wt-dark'; });
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    const list = page.locator('.col-list'); const chat = page.locator('.col-main'); const side = page.locator('.col-side');
    await expect(list.locator('li.row', { hasText: 'Layout thread' })).toBeVisible();
    await expect(chat.locator('#head h1')).toHaveText('Layout thread');
    await expect(side.locator('#new-form')).toBeVisible();
    await expect(side.locator('#files a', { hasText: 'PLAN.md' })).toBeVisible();
    const [a, b, c] = await Promise.all([list.boundingBox(), chat.boundingBox(), side.boundingBox()]);
    expect(a.x + a.width).toBeLessThanOrEqual(b.x + 1);
    expect(b.x + b.width).toBeLessThanOrEqual(c.x + 1);
    expect(b.width).toBeGreaterThan(a.width);
    // The new-thread form works from this column too.
    await page.locator('#nt-project').fill('/tmp/project');
    await expect(page.locator('#nt-go')).toBeEnabled();
    await noSideScroll(page);
  });

  test('phone: one column, the thread list behind the Threads tab', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const made = await ctx.make({ cli: 'claude' });
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    await expect(page.locator('#head h1')).toBeVisible();
    await expect(page.locator('.col-list')).toBeHidden();
    await expect(page.locator('.col-side')).toBeHidden();
    await expect(page.locator('#msg')).toBeVisible();
    await noSideScroll(page);
    await page.locator('#app-nav a', { hasText: 'Threads' }).click();
    await expect(page.locator('.col-list li.row')).toHaveCount(1);
    await expect(page.locator('.col-main')).toBeHidden();
    await expect(page.locator('#new-form')).toBeHidden();
    await page.locator('#new-toggle').click();
    await expect(page.locator('#nt-project')).toBeVisible();
    await noSideScroll(page);
  });

  test('the thread header stays put with Archive in reach after a long chat', async ({ page }) => {
    for (const [width, height] of [[1280, 800], [390, 844]]) {
      await page.setViewportSize({ width, height });
      const made = await ctx.make({ cli: 'claude' });
      const lines = [];
      for (let i = 0; i < 60; i += 1) {
        lines.push([i % 2 ? 'assistant' : 'human', `message number ${i}`, new Date(Date.UTC(2030, 0, 1, 0, i)).toISOString()]);
      }
      await ctx.timedTranscript(made.id, lines);
      await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
      await expect(page.locator('#chat')).toContainText('message number 59');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const archive = page.getByRole('button', { name: 'Archive', exact: true });
      await expect(archive).toBeInViewport({ ratio: 1 });
      const nav = await page.locator('#app-nav').boundingBox();
      const head = await page.locator('#head').boundingBox();
      expect(Math.abs(head.y - (nav.y + nav.height))).toBeLessThan(2);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.evaluate(() => window.scrollTo(0, 600));
      await expect(archive).toBeInViewport({ ratio: 1 });
      await expect(page.locator('#head a', { hasText: 'Sessions' })).toHaveAttribute('href', '/wheelchair/app/sessions');
      await expect(page.locator('#head a', { hasText: 'Open in terminal' })).toHaveAttribute(
        'href', `/wheelchair/app/terminal?name=${encodeURIComponent(ctx.lead(made.id).name)}`);
      await archive.click();
      await expect(page.getByRole('button', { name: 'Confirm archive' })).toBeInViewport({ ratio: 1 });
      await noSideScroll(page);
    }
  });

  test('the lead\'s messages and card bodies render Markdown and stay inert', async ({ page }) => {
    const made = await ctx.make({ cli: 'claude' });
    await ctx.timedTranscript(made.id, [
      ['human', 'show me the formats', '2030-01-01T00:00:00.000Z'],
      ['assistant', MARKDOWN, '2030-01-01T00:01:00.000Z'],
    ]);
    await ctx.post(made.id, { kind: 'needs', title: 'Sign in', body: 'Codex is **signed out**. Run `codex login`.\n\n- on beelink' });
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    const lead = page.locator('#chat .bubble.assistant');
    await expect(lead).toBeVisible();
    await expect(lead.locator('p', { hasText: 'A paragraph with' }).locator('strong')).toHaveText('bold');
    await expect(lead.locator('p em')).toHaveText('italic');
    await expect(lead.locator('p code').first()).toHaveText('inline code');
    await expect(lead.locator('ul li')).toHaveText(['first bullet', 'second bullet']);
    await expect(lead.locator('ol li')).toHaveText(['step one', 'step two']);
    await expect(lead.locator('pre code')).toHaveText('tmux attach -t wc-x');
    const link = lead.locator('a', { hasText: 'the docs' });
    await expect(link).toHaveAttribute('href', 'https://example.com/docs');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(lead.locator('a', { hasText: 'a page' })).toHaveAttribute('href', '/wheelchair/docs?x=1');
    // Untrusted text stays text: no script, no image, no javascript: link.
    await expect(lead).toContainText('<script>window.__pwned = 1</script>');
    await expect(lead).toContainText('<img src=x onerror="window.__pwned=4">');
    await expect(lead.locator('script, img')).toHaveCount(0);
    await expect(lead.locator('a[href^="javascript" i]')).toHaveCount(0);
    await expect(lead.locator('a', { hasText: 'bad link' })).toHaveCount(0);
    await expect(lead.locator('a', { hasText: 'tabbed' })).toHaveCount(0);
    await expect(lead).toContainText('bad link');
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
    // Card body text too.
    const needs = page.locator('.card-needs');
    await expect(needs.locator('strong')).toHaveText('signed out');
    await expect(needs.locator('code')).toHaveText('codex login');
    await expect(needs.locator('li')).toHaveText('on beelink');
  });
});

test.describe('Threads, Features and Sessions at phone width', () => {
  let context;
  test.beforeAll(async () => { context = await setupViews(); });
  test.afterAll(async () => { await closeViews(context); });
  test.use({ viewport: { width: 390, height: 844 } });

  for (const route of ['/app/features', '/app/threads', '/app/sessions']) {
    test(`${route} is one column with no sideways scroll`, async ({ page }) => {
      await openPage(page, context, route);
      await expect(page.locator('#app-nav .seg')).toBeVisible();
      await page.waitForTimeout(700);
      await noSideScroll(page);
    });
  }

  test('Features: Needs you first, then one column per stage down the page', async ({ page }) => {
    await openPage(page, context, '/app/features');
    await expect(page.locator('#needs .need')).toHaveCount(2);
    const needs = await page.locator('#needs').boundingBox();
    const stages = await page.locator('#groups').boundingBox();
    expect(needs.y).toBeLessThan(stages.y);
    const idea = await page.locator('section[data-stage="idea"]').boundingBox();
    const planning = await page.locator('section[data-stage="planning"]').boundingBox();
    expect(planning.y).toBeGreaterThan(idea.y);
    expect(Math.abs(planning.x - idea.x)).toBeLessThan(2);
  });
});

test.describe('Features and Sessions at desktop width', () => {
  let context;
  test.beforeAll(async () => { context = await setupViews(); });
  test.afterAll(async () => { await closeViews(context); });
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Features: projects and machines in the sidebar, Done collapsed to a few', async ({ page }) => {
    await openPage(page, context, '/app/features');
    await expect(page.locator('#side-projects .side-row', { hasText: 'All projects' })).toContainText('active');
    await expect(page.locator('#side-projects .side-row', { hasText: 'proj-alpha' })).toBeVisible();
    await expect(page.locator('#side-machines .side-row', { hasText: 'hub' })).toBeVisible();
    await expect(page.locator('#side-machines .side-row.down', { hasText: 'node-3' })).toBeVisible();
    await expect(page.locator('#app-nav .hubline')).toContainText('hub');
    await expect(page.locator('#app-nav .seg a', { hasText: 'Sessions' }).locator('.count')).toHaveText(/\d+/);
    await expect(page.locator('#app-nav .needs-count')).toContainText('2');
    await noSideScroll(page);
  });

  test('Sessions: cards by machine with a copyable attach command, unreachable dimmed', async ({ page }) => {
    await openPage(page, context, '/app/sessions');
    const hub = page.locator('section[data-machine="hub"]');
    await expect(hub.locator('.session:not(.unmanaged)').first().getByRole('button', { name: 'Copy' })).toBeVisible();
    await expect(page.locator('section[data-machine="node-3"]')).toHaveCSS('opacity', '0.5');
    await noSideScroll(page);
  });
});
