'use strict';
// The thread page's file sections (docs/plans/thread-sidebar-files, S1, S2, S5 chat card):
// Project documents, Sent to you, the phone Files panel and the `file` chat card.
const fs = require('node:fs/promises');
const path = require('node:path');
const { makeTemp } = require('../../test-support/run-dir');
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

let ctx;
test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
test.afterEach(async () => { await ctx.close(); });

let shots = process.env.FILES_SHOTS;
async function shotDir() { return shots || (shots = await makeTemp('wc-files-shots-')); }

async function seed(extra = {}) {
  const made = await ctx.make({ cli: 'claude' });
  const wt = await makeTemp('wc-files-');
  await fs.mkdir(path.join(wt, 'docs/plans/dark/graphs'), { recursive: true });
  await fs.writeFile(path.join(wt, 'docs/plans/dark/PLAN.md'), '# plan');
  await fs.writeFile(path.join(wt, 'docs/plans/dark/IDEA.md'), '# idea');
  await fs.writeFile(path.join(wt, 'docs/plans/dark/graphs/flow.json'), JSON.stringify({ title: 'Flow', nodes: [], edges: [] }));
  const now = Date.parse('2031-01-01T00:00:00Z');
  const at = (n) => new Date(now + n * 1000).toISOString();
  await ctx.patch(made.id, (t) => {
    t.worktree = wt; t.slug = 'dark';
    t.cards.push(
      { id: 'f1', kind: 'file', title: 'Quarterly report', file: '3-report.pdf', name: 'report.pdf', size: 12 * 1024, created_at: at(1), at: at(1) },
      { id: 'i1', kind: 'image', title: 'Screenshot', file: '4-shot.png', created_at: at(2), at: at(2) },
      { id: 'f2', kind: 'file', title: 'Retracted one', file: '5-gone.pdf', name: 'gone.pdf', size: 5, created_at: at(3), at: at(3), retracted_at: at(4) },
      { id: 'f3', kind: 'file', title: 'Big sheet', file: '6-big.xlsx', name: 'big.xlsx', size: Math.round(3.4 * 1024 * 1024), created_at: at(5), at: at(5) },
    );
  });
  await ctx.post(made.id, { kind: 'diagram', plan: 'dark', graph: 'flow', title: 'Flow picture', format: 'graph' });
  if (extra.thread) await ctx.patch(made.id, (t) => Object.assign(t, extra.thread));
  return made;
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the right column shows Project documents then Sent to you, newest first', async ({ page }) => {
    const made = await seed();
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    const side = page.locator('#files');
    await expect(side.locator('h3')).toHaveText(['Project documents', 'Sent to you']);
    const docs = side.locator('.files-section').first();
    await expect(docs.locator('a.file')).toHaveText(['IDEA.md', 'PLAN.md', 'Flow picture']);
    await expect(docs.getByRole('link', { name: 'Download', exact: true })).toHaveCount(2);
    await expect(docs.getByRole('link', { name: 'Download', exact: true }).last()).toHaveAttribute('href', `/wheelchair/api/threads/${made.id}/doc?file=PLAN.md&download=1`);
    await expect(side.getByText('MAP.md')).toHaveCount(0);
    const sent = side.locator('.sent-row');
    await expect(sent.locator('.file-title, a.file')).toHaveText(['Big sheet', 'Screenshot', 'Quarterly report']);
    await expect(sent.nth(0)).toContainText('big.xlsx · 3.4 MB');
    await expect(sent.nth(1)).toContainText('shot.png');
    await expect(sent.nth(2)).toContainText('report.pdf · 12 KB');
    const dl = sent.nth(2).getByRole('link', { name: 'Download' });
    await expect(dl).toHaveAttribute('href', `/wheelchair/api/threads/${made.id}/files/3-report.pdf`);
    await expect(dl).toHaveAttribute('download', 'report.pdf');
    await expect(sent.nth(1).locator('a.file')).toHaveAttribute('target', '_blank');
    await expect(side).not.toContainText('Retracted one');
    await expect(side).not.toContainText("This thread's files");
    await page.screenshot({ path: path.join(await shotDir(), 'T3-sidebar.png') });
  });

  test('an archived thread keeps the names and drops the links', async ({ page }) => {
    const made = await seed({ thread: { archived: true, branch: 'gone' } });
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    const sent = page.locator('#files .sent-row');
    await expect(sent).toHaveCount(3);
    await expect(sent.first()).toContainText('Big sheet');
    await expect(sent.first()).toContainText('Removed when the thread was archived');
    await expect(page.locator('#files .sent-row a')).toHaveCount(0);
    const card = page.locator('#card-f1');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Removed when the thread was archived');
    await expect(card.getByRole('link', { name: 'Download' })).toHaveCount(0);
  });

  test('a card from before an import is not listed', async ({ page }) => {
    const made = await seed({ thread: { imported: { at: '2031-01-01T00:00:03Z', history: [] } } });
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    const sent = page.locator('#files .sent-row');
    await expect(sent.locator('.file-title')).toHaveText(['Big sheet']);
  });

  test('the file chat card shows name and size with a Download button', async ({ page }) => {
    const made = await seed();
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    const card = page.locator('#card-f1');
    await expect(card.locator('h3')).toHaveText('Quarterly report');
    await expect(card).toContainText('report.pdf · 12 KB');
    await expect(card.getByRole('link', { name: 'Download' })).toHaveAttribute('href', `/wheelchair/api/threads/${made.id}/files/3-report.pdf`);
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the Files button opens a panel with both sections, every link 44px tall', async ({ page }) => {
    const made = await seed();
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    const button = page.getByRole('button', { name: 'Files (6)' });
    await expect(button).toBeVisible();
    await expect(page.locator('#files')).toBeHidden();
    const panel = page.locator('#files-panel');
    await expect(panel).toBeHidden();
    await button.click();
    await expect(panel.locator('h3')).toHaveText(['Project documents', 'Sent to you']);
    await expect(panel.locator('.sent-row')).toHaveCount(3);
    // The panel opens directly under its button, with nothing (such as Your copy) between them.
    expect(await page.evaluate(() => document.getElementById('head-files').nextElementSibling.id)).toBe('files-panel');
    const below = (await panel.boundingBox()).y - ((await button.boundingBox()).y + (await button.boundingBox()).height);
    expect(below).toBeLessThan(40);
    await page.screenshot({ path: path.join(await shotDir(), 'T3-phone-panel.png') });
    for (const a of await panel.locator('a').all()) {
      expect((await a.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await button.click();
    await expect(panel).toBeHidden();
    await button.click();
    await panel.getByRole('link', { name: 'PLAN.md' }).click();
    await expect(page).toHaveURL(/\/app\/doc\?/);
  });

  test('no files, no button', async ({ page }) => {
    const made = await ctx.make({ cli: 'claude' });
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    await expect(page.locator('#head')).toBeVisible();
    await expect(page.locator('#files-toggle')).toBeHidden();
  });
});
