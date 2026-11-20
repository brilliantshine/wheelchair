'use strict';
// A thread's graphs (app-cutover Spec 4): the right column's picture list, the full-size
// picture page, aside graphs, and the phone strip.
const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

let ctx;
test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
test.afterEach(async () => { await ctx.close(); });

async function seed() {
  const made = await ctx.make({ cli: 'claude' });
  const worktree = path.join(ctx.state, 'worktree');
  const dir = path.join(worktree, 'docs/plans/dark/graphs'); await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'flow.json'), JSON.stringify({ title: 'Flow', nodes: [], edges: [] }));
  await fs.writeFile(path.join(dir, 'flow.html'), '<p id="proof">Static proof</p>');
  await ctx.patch(made.id, (t) => { t.worktree = worktree; t.slug = 'dark'; });
  await ctx.post(made.id, { kind: 'diagram', plan: 'dark', graph: 'flow', title: 'Flow first', format: 'graph' });
  await ctx.post(made.id, { kind: 'diagram', plan: 'dark', graph: 'flow', title: 'Flow latest', format: 'form' });
  await ctx.post(made.id, { kind: 'diagram', plan: 'dark', graph: 'flow', title: 'Flow static', format: 'html' });
  return made;
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the right column lists each picture file once, opens it in the same tab, and Back returns', async ({ page }) => {
    const made = await seed();
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    const links = page.locator('#files a.file.graph');
    await expect(links).toHaveText(['Flow latest', 'Flow static']);
    await expect(links.first()).not.toHaveAttribute('target', /.+/);
    await links.first().click();
    await expect(page).toHaveURL(/\/app\/picture\?thread=.*&card=/);
    await expect(page.locator('#picture-title')).toHaveText('Flow latest');
    await expect(page.getByText('This diagram could not be drawn')).toBeVisible();
    await page.getByRole('link', { name: /Back to thread/ }).click();
    await expect(page).toHaveURL(new RegExp(`/app/thread\\?id=${made.id}`));
    await page.locator('#files a.file.graph').nth(1).click();
    await expect(page.locator('#picture-title')).toHaveText('Flow static');
    await expect(page.locator('iframe.picture-frame')).toHaveAttribute('sandbox', '');
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/app/thread\\?id=${made.id}`));
  });

  test('a diagram card opens full size for every format', async ({ page }) => {
    const made = await seed();
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    const open = page.getByRole('link', { name: 'Open full size' });
    await expect(open).toHaveCount(3);
    await expect(open.first()).not.toHaveAttribute('target', /.+/);
  });

  test('an aside graph is listed after the pictures and opens', async ({ page }) => {
    const made = await seed();
    const quote = 'Q'.repeat(60);
    await ctx.patch(made.id, (t) => {
      t.asides.push({ id: 'a1', number: 1, anchor: { message_id: 'm', start: 0, end: 60, quote }, action: 'draw', status: 'open', pending: [], turn: null, failed: null, created_at: new Date().toISOString(), history: [{ kind: 'ask', text: 'x' }, { kind: 'ask', reply: 'r', graph: path.join(ctx.state, 'aside.json') }] });
    });
    // The aside route asks the model settings, which the test world has none of; serve the aside as the hub would.
    const graphPath = path.join(ctx.state, 'aside.json');
    await page.route('**/api/threads/*/asides/a1', (route) => route.fulfill({ json: { id: 'a1', anchor: { quote }, history: [{ kind: 'ask', text: 'x' }, { kind: 'ask', reply: 'r', graph: graphPath }] } }));
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    // The chat payload carries the graphs list (brief); the aside GET above stands in for the hub route, which asks model settings the test world lacks.
    const chat = await page.evaluate((id) => fetch('/wheelchair/api/threads/' + id + '/chat').then((r) => r.json()), made.id);
    expect(chat.asides[0].graphs).toEqual([{ entry: 1, path: graphPath }]);
    const aside = page.locator('#files a.file.graph').last();
    await expect(aside).toHaveText('Aside: ' + 'Q'.repeat(40));
    await aside.click();
    await expect(page).toHaveURL(/aside=a1&entry=1/);
    await expect(page.locator('#picture-title')).toHaveText('Aside: ' + 'Q'.repeat(40));
    await expect(page.locator('iframe.picture-frame')).toHaveAttribute('src', /\/wheelchair\/\?path=/);
    await expect(page.getByRole('link', { name: /Back to thread/ })).toHaveAttribute('href', `/wheelchair/app/thread?id=${made.id}`);
  });

  test('an unknown card, aside or entry shows a message and the back link', async ({ page }) => {
    const made = await seed();
    for (const q of ['card=nope', 'aside=nope&entry=0']) {
      await page.goto(`${ctx.server.url}/app/picture?thread=${made.id}&${q}`);
      await expect(page.locator('#message')).toBeVisible();
      await expect(page.getByRole('link', { name: /Back to thread/ })).toHaveAttribute('href', `/wheelchair/app/thread?id=${made.id}`);
    }
    await page.goto(`${ctx.server.url}/app/picture?thread=nope&card=x`);
    await expect(page.locator('#message')).toContainText('not found');
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('the Files button opens a panel that lists the pictures', async ({ page }) => {
    const made = await seed();
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    await expect(page.locator('#files-panel')).toBeHidden();
    await page.getByRole('button', { name: /^Files \(\d+\)$/ }).click();
    const panel = page.locator('#files-panel');
    await expect(panel.getByRole('link', { name: 'Flow latest' })).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Flow static' })).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Flow first' })).toHaveCount(0);
  });
});
