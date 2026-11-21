'use strict';
// The thread page's follow-up files features (docs/plans/sidebar-files-followup): Download all (S2),
// preview links for sent files (S3), kept files after archive (S4), and the saved HTML picture (S1).
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const http = require('node:http');
const { makeTemp } = require('../../test-support/run-dir');
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

let ctx;
test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
test.afterEach(async () => { await ctx.close(); });

const T0 = Date.parse('2031-01-01T00:00:00Z');
const at = (n) => new Date(T0 + n * 1000).toISOString();

async function seed({ docs = true, thread } = {}) {
  const made = await ctx.make({ cli: 'claude' });
  const wt = await makeTemp('wc-ff-');
  await fs.mkdir(path.join(wt, 'docs/plans/dark/graphs'), { recursive: true });
  if (docs) { await fs.writeFile(path.join(wt, 'docs/plans/dark/PLAN.md'), '# plan'); await fs.writeFile(path.join(wt, 'docs/plans/dark/IDEA.md'), '# idea'); }
  await ctx.patch(made.id, (t) => {
    t.worktree = wt; t.slug = 'dark';
    t.cards.push(
      { id: 'f1', kind: 'file', title: 'Notes', file: '3-notes.md', name: 'notes.md', size: 100, created_at: at(1), at: at(1) },
      { id: 'f2', kind: 'file', title: 'Plain', file: '4-plain.txt', name: 'plain.txt', size: 100, created_at: at(2), at: at(2) },
      { id: 'f3', kind: 'file', title: 'Report', file: '5-report.pdf', name: 'report.pdf', size: 100, created_at: at(3), at: at(3) },
      { id: 'f4', kind: 'file', title: 'Huge', file: '6-huge.txt', name: 'huge.txt', size: 3 * 1024 * 1024, created_at: at(4), at: at(4) },
      { id: 'i1', kind: 'image', title: 'Shot', file: '7-shot.png', created_at: at(5), at: at(5) },
      { id: 'i2', kind: 'image', title: 'Lost shot', file: '8-lost.png', created_at: at(6), at: at(6) },
    );
    if (thread) Object.assign(t, thread);
  });
  return made;
}
const open = (page, made) => page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
const get = (page, url) => { const u = new URL(url); u.searchParams.set('token', ctx.server.token); return page.request.get(u.href); };
const REMOVED = 'Removed when the thread was archived';

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('Download all links to the ZIP, which downloads as a zip', async ({ page }) => {
    const made = await seed();
    await open(page, made);
    const all = page.locator('#files').getByRole('link', { name: 'Download all' });
    await expect(all).toHaveAttribute('href', `/wheelchair/api/threads/${made.id}/docs.zip`);
    const res = await get(page, `${ctx.server.url}/api/threads/${made.id}/docs.zip`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('application/zip');
    expect((await res.body()).subarray(0, 2).toString()).toBe('PK');
  });

  test('no documents, no Download all', async ({ page }) => {
    const made = await seed({ docs: false });
    await open(page, made);
    await expect(page.locator('#files .sent-row').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download all' })).toHaveCount(0);
  });

  test('previewable sent files open the preview page; others keep Download', async ({ page }) => {
    const made = await seed();
    await open(page, made);
    const rows = page.locator('#files .sent-row');
    const href = (f) => `/wheelchair/app/file?thread=${made.id}&file=${f}`;
    await expect(rows.filter({ hasText: 'Notes' }).locator('a.file')).toHaveAttribute('href', href('3-notes.md'));
    await expect(rows.filter({ hasText: 'Plain' }).locator('a.file')).toHaveAttribute('href', href('4-plain.txt'));
    await expect(rows.filter({ hasText: 'Report' }).locator('a.file')).toHaveCount(0);
    await expect(rows.filter({ hasText: 'Report' }).getByRole('link', { name: 'Download' })).toHaveAttribute('href', `/wheelchair/api/threads/${made.id}/files/5-report.pdf`);
    await expect(rows.filter({ hasText: 'Huge' }).locator('a.file')).toHaveCount(0);
    await expect(page.locator('#card-f1').getByRole('link', { name: 'Preview' })).toHaveAttribute('href', href('3-notes.md'));
    await expect(page.locator('#card-f3').getByRole('link', { name: 'Preview' })).toHaveCount(0);
    await expect(page.locator('#card-f3').getByRole('link', { name: 'Download' })).toBeVisible();
    await expect(page.locator('#card-i1 img')).toHaveCount(1);
  });

  test('an archived thread links only the kept files', async ({ page }) => {
    const made = await seed({ thread: { archived: true, branch: 'gone', kept_files: ['3-notes.md', '5-report.pdf', '7-shot.png'] } });
    await open(page, made);
    const rows = page.locator('#files .sent-row');
    await expect(rows.filter({ hasText: 'Notes' }).locator('a.file')).toHaveAttribute('href', /\/app\/file\?thread=/);
    await expect(rows.filter({ hasText: 'Notes' })).not.toContainText(REMOVED);
    await expect(rows.filter({ hasText: 'Report' }).getByRole('link', { name: 'Download' })).toHaveCount(1);
    await expect(rows.filter({ hasText: /^Shot/ }).locator('a.file')).toHaveCount(1);
    for (const name of ['Plain', 'Huge', 'Lost shot']) {
      const row = rows.filter({ hasText: name });
      await expect(row).toContainText(REMOVED);
      await expect(row.locator('a')).toHaveCount(0);
    }
    await expect(page.locator('#card-f1').getByRole('link', { name: 'Preview' })).toHaveCount(1);
    await expect(page.locator('#card-f3').getByRole('link', { name: 'Download' })).toHaveCount(1);
    await expect(page.locator('#card-f2')).toContainText(REMOVED);
    await expect(page.locator('#card-f2 a')).toHaveCount(0);
    await expect(page.locator('#card-i1 img')).toHaveCount(1);
    await expect(page.locator('#card-i2 img')).toHaveCount(0);
    await expect(page.locator('#card-i2')).toContainText('Image removed when the thread was archived');
  });

  test('the panel redraws when kept_files changes', async ({ page }) => {
    const made = await seed({ thread: { archived: true, branch: 'gone' } });
    await open(page, made);
    const row = page.locator('#files .sent-row').filter({ hasText: 'Notes' });
    await expect(row).toContainText(REMOVED);
    await ctx.patch(made.id, (t) => { t.kept_files = ['3-notes.md']; });
    await expect(row.locator('a.file')).toHaveCount(1, { timeout: 15000 });
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the Files panel has Download all and preview links', async ({ page }) => {
    const made = await seed();
    await open(page, made);
    await page.getByRole('button', { name: /Files \(/ }).click();
    const panel = page.locator('#files-panel');
    await expect(panel.getByRole('link', { name: 'Download all' })).toHaveAttribute('href', `/wheelchair/api/threads/${made.id}/docs.zip`);
    await expect(panel.locator('.sent-row').filter({ hasText: 'Notes' }).locator('a.file')).toHaveAttribute('href', /\/app\/file\?thread=/);
    for (const a of await panel.locator('a').all()) expect((await a.boundingBox()).height).toBeGreaterThanOrEqual(43.5);
  });

  test('no documents, no Download all in the panel', async ({ page }) => {
    const made = await seed({ docs: false });
    await open(page, made);
    await page.getByRole('button', { name: /Files \(/ }).click();
    await expect(page.locator('#files-panel .sent-row').first()).toBeVisible();
    await expect(page.locator('#files-panel').getByRole('link', { name: 'Download all' })).toHaveCount(0);
  });
});

// ---- S1: the hub's saved HTML picture is inert and opens as a readable page ----
test.describe('saved HTML picture', () => {
  const NONASCII = 'Café 你好 ☃';
  async function fixture(name, html) {
    const made = await ctx.make({ cli: 'claude' });
    const wt = await makeTemp('wc-ffh-');
    const dir = path.join(wt, 'docs/plans/dark/graphs'); await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name + '.html'), html);
    await ctx.patch(made.id, (t) => { t.worktree = wt; t.slug = 'dark'; });
    const posted = await ctx.post(made.id, { kind: 'diagram', plan: 'dark', graph: name, title: name, format: 'html' });
    return { made, wt, card: posted.id };
  }
  async function archivedCopy(made, wt, name) {
    const git = (...a) => execFileSync('git', ['-C', wt, ...a], { stdio: 'pipe' });
    git('init', '-q', '-b', 'wc/x'); git('add', '-A'); git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'x');
    await ctx.patch(made.id, (t) => { t.project = wt; t.archived = true; t.branch = 'wc/x'; });
    return `${ctx.server.url}/api/threads/${made.id}/diagram-html?file=${name}.html&download=1`;
  }
  async function liveUrl(page, made, card) {
    await page.goto(`${ctx.server.url}/app/picture?thread=${made.id}&card=${card}`);
    const src = await page.locator('iframe.picture-frame').getAttribute('src');
    return new URL(src + '&download=1', ctx.server.url).href;
  }
  async function bytesOpenAsPage(page, bytes) {
    const dir = await makeTemp('wc-ffo-'); const file = path.join(dir, 'saved.html');
    await fs.writeFile(file, bytes);
    await page.goto('file://' + file);
  }

  const NO_DOCTYPE = `<form id="f" action="WATCH/submit"><input name="a" value="1"></form><p id="t">${NONASCII}</p><script>window.ran = true; document.title = 'ran'; document.getElementById('f').submit();</script><meta http-equiv="refresh" content="0;url=WATCH/refresh">`;

  async function check(page, url, watch) {
    const res = await get(page, url);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-disposition']).toMatch(/^attachment; filename="[^"]+\.html"$/);
    const bytes = await res.body();
    const text = bytes.toString('utf8');
    expect(text.startsWith('<meta charset="utf-8"><meta http-equiv="Content-Security-Policy"')).toBe(true);
    expect(text).not.toMatch(/http-equiv="refresh"/i);
    await bytesOpenAsPage(page, bytes);
    await expect(page.locator('#t')).toHaveText(NONASCII);
    expect(await page.evaluate(() => window.ran)).toBeUndefined();
    expect(await page.title()).not.toBe('ran');
    await page.waitForTimeout(500);
    expect(watch.hits).toEqual([]);
    expect(page.url().startsWith('file://')).toBe(true);
  }
  async function watcher() {
    const hits = [];
    const server = http.createServer((req, res) => { hits.push(req.url); res.end('ok'); });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    return { hits, base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
  }

  test('a doctype-free page, live route: charset and CSP first, inert, non-ASCII intact', async ({ page }) => {
    const w = await watcher();
    try {
      const { made, card } = await fixture('flow', NO_DOCTYPE.replaceAll('WATCH', w.base));
      await check(page, await liveUrl(page, made, card), w);
    } finally { await w.close(); }
  });

  test('a doctype-free page, archived route: charset and CSP first, inert, non-ASCII intact', async ({ page }) => {
    const w = await watcher();
    try {
      const { made, wt } = await fixture('flow', NO_DOCTYPE.replaceAll('WATCH', w.base));
      await check(page, await archivedCopy(made, wt, 'flow'), w);
    } finally { await w.close(); }
  });

  for (const [label, lead] of [['a doctype', ''], ['a comment before the doctype', '<!-- note -->\n']]) {
    test(`${label} stays first and the refresh meta is removed (both routes)`, async ({ page }) => {
      const w = await watcher();
      try {
        const html = `${lead}<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=${w.base}/r"><title>t</title></head><body><p id="t">${NONASCII}</p></body></html>`;
        const { made, wt, card } = await fixture('flow', html);
        const live = await liveUrl(page, made, card);
        const archived = await archivedCopy(made, wt, 'flow');
        for (const url of [live, archived]) {
          const text = (await (await get(page, url)).body()).toString('utf8');
          const doctype = text.search(/<!DOCTYPE/i);
          expect(doctype).toBeGreaterThanOrEqual(0);
          expect(text.slice(0, doctype).replace(/<!--[\s\S]*?-->|\s/g, '')).toBe('');
          expect(text.indexOf('<meta charset')).toBeGreaterThan(doctype);
          expect(text).not.toMatch(/http-equiv="refresh"/i);
          await bytesOpenAsPage(page, Buffer.from(text));
          await expect(page.locator('#t')).toHaveText(NONASCII);
        }
        expect(w.hits).toEqual([]);
      } finally { await w.close(); }
    });
  }
});
