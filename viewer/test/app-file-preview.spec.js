'use strict';
// The sent-file preview page (docs/plans/sidebar-files-followup, S3).
const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

let ctx;
test.beforeEach(async ({ page }) => { ctx = await startWorld(); ctx.machine.uploadsDir = path.join(ctx.state, 'uploads'); await signIn(page, ctx); });
test.afterEach(async () => { await ctx.close(); });

async function sent(files) {
  const made = await ctx.make({ cli: 'claude' });
  const dir = path.join(ctx.machine.uploadsDir, made.id); await fs.mkdir(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) await fs.writeFile(path.join(dir, name), body);
  return made;
}
const url = (made, file) => `${ctx.server.url}/app/file?thread=${made.id}&file=${file}`;

test.use({ viewport: { width: 390, height: 844 } });

test('Markdown renders, with only external links live and no raw HTML', async ({ page }) => {
  const made = await sent({ '1-notes.md': '# Title\n\nSee [site](https://example.com) and [local](PLAN.md) <script>window.__x=1</script>\n' });
  await page.goto(url(made, '1-notes.md'));
  await expect(page.locator('#content h1')).toHaveText('Title');
  await expect(page.locator('#file-name')).toHaveText('notes.md');
  await expect(page.locator('#content a[href="https://example.com"]')).toHaveCount(1);
  await expect(page.locator('#content a[href="PLAN.md"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__x)).toBeUndefined();
  await expect(page.locator('#file-download')).toHaveAttribute('href', `/wheelchair/api/threads/${made.id}/files/1-notes.md`);
  await expect(page.getByRole('link', { name: /Back to the thread/ })).toHaveAttribute('href', `/wheelchair/app/thread?id=${made.id}`);
});

test('plain text shows as text, wrapped, never as HTML', async ({ page }) => {
  const made = await sent({ '2-log.txt': '<b>bold?</b> ' + 'x'.repeat(400) });
  await page.goto(url(made, '2-log.txt'));
  const pre = page.locator('#file-text');
  await expect(pre).toContainText('<b>bold?</b>');
  await expect(page.locator('#file-text b')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
});

test('a file over 2 MiB says Too big to preview', async ({ page }) => {
  const made = await sent({ '3-big.txt': Buffer.alloc(2 * 1024 * 1024 + 1, 'a') });
  await page.goto(url(made, '3-big.txt'));
  await expect(page.locator('#message')).toContainText('Too big to preview');
  await expect(page.locator('#file-text')).toBeHidden();
});

test('the previewable helper follows the extension list and size rule', async ({ page }) => {
  const made = await sent({});
  await page.goto(url(made, '1-x.md'));
  const r = await page.evaluate(() => {
    const p = window.WCFilePreview.previewable;
    return [p('a.MD', 10), p('a.json', 2 * 1024 * 1024), p('a.json', 2 * 1024 * 1024 + 1), p('a.pdf', 1), p('a.txt', undefined), p('a.toml', 0)];
  });
  expect(r).toEqual([true, true, false, false, false, true]);
});
