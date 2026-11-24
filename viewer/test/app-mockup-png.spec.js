'use strict';
// A mockup's picture page downloads a PNG drawn in the browser (docs/plans/mockup-polish S3), and keeps
// a Download HTML link. Colours are read back from the saved PNG's pixels.
const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

let ctx;
test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
test.afterEach(async () => { await ctx.close(); });
test.use({ viewport: { width: 390, height: 844 } });

const W = 200; const H = 300;
const FIXTURES = {
  // Short content, body background set: it must fill the whole picture, below the content too.
  body: '<style>body{margin:0;background:#336699}.b{width:50px;height:50px;background:#ff0000}</style><body><div class="b"></div></body>',
  // No background anywhere: white.
  plain: '<style>body{margin:0}.b{width:50px;height:50px;background:#ff0000}</style><body><div class="b"></div></body>',
  // Colours come from CSS variables declared on :root and used under :root > body.
  vars: '<style>:root{--bg:#00ff00;--fg:#0000ff}:root > body{margin:0;background:var(--bg)}:root > body > .b{width:50px;height:50px;background:var(--fg)}</style><body><div class="b"></div></body>',
  // A script must not run: it would turn the block green.
  script: '<style>body{margin:0}.b{width:50px;height:50px;background:#ff0000}</style><body><div class="b"></div><script>document.querySelector(".b").style.background="#00ff00"</script></body>',
};

async function seed() {
  const made = await ctx.make({ cli: 'claude' });
  const worktree = path.join(ctx.state, 'worktree');
  const dir = path.join(worktree, 'docs/plans/dark/graphs'); await fs.mkdir(dir, { recursive: true });
  for (const [name, html] of Object.entries(FIXTURES)) await fs.writeFile(path.join(dir, name + '.html'), html);
  await ctx.patch(made.id, (t) => { t.worktree = worktree; t.slug = 'dark'; });
  return made;
}
async function open(page, made, graph) {
  const posted = await ctx.post(made.id, { kind: 'diagram', plan: 'dark', graph, title: 'Mockup ' + graph, format: 'mockup', width: W, height: H });
  await page.goto(`${ctx.server.url}/app/picture?thread=${made.id}&card=${posted.id}`);
  await expect(page.locator('#download')).toBeVisible();
}
// The saved PNG's size and the colour at each [x, y] (in export pixels).
async function pixels(page, points) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#download').click()]);
  const bytes = await fs.readFile(await dl.path());
  expect(bytes.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const out = await page.evaluate(async ({ b64, points }) => {
    const bmp = await createImageBitmap(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: 'image/png' }));
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
    return { w: bmp.width, h: bmp.height, colours: points.map(([x, y]) => Array.from(g.getImageData(x, y, 1, 1).data)) };
  }, { b64: bytes.toString('base64'), points });
  return { name: dl.suggestedFilename(), ...out };
}
const near = (got, want) => { for (let i = 0; i < 3; i++) expect(Math.abs(got[i] - want[i])).toBeLessThanOrEqual(2); expect(got[3]).toBe(255); };
// Block at the top-left, a spot below the content, in export pixels (scale 2).
const PTS = [[20, 20], [380, 580]];

test('a body background fills the picture, below the short content too', async ({ page }) => {
  const made = await seed(); await open(page, made, 'body');
  const r = await pixels(page, PTS);
  expect([r.w, r.h]).toEqual([W * 2, H * 2]);
  expect(r.name).toMatch(/\.png$/);
  near(r.colours[0], [255, 0, 0]); near(r.colours[1], [0x33, 0x66, 0x99]);
});

test('a mockup with no background exports white', async ({ page }) => {
  const made = await seed(); await open(page, made, 'plain');
  const r = await pixels(page, PTS);
  near(r.colours[0], [255, 0, 0]); near(r.colours[1], [255, 255, 255]);
});

test('colours from CSS variables on :root come through', async ({ page }) => {
  const made = await seed(); await open(page, made, 'vars');
  const r = await pixels(page, PTS);
  near(r.colours[0], [0, 0, 255]); near(r.colours[1], [0, 255, 0]);
});

test('a script in the mockup does not run', async ({ page }) => {
  const made = await seed(); await open(page, made, 'script');
  const r = await pixels(page, PTS);
  near(r.colours[0], [255, 0, 0]);
});

test('Download HTML still gives the HTML', async ({ page }) => {
  const made = await seed(); await open(page, made, 'body');
  await expect(page.locator('#download-html')).toHaveText('Download HTML');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#download-html').click()]);
  const text = await fs.readFile(await dl.path(), 'utf8');
  expect(dl.suggestedFilename()).toMatch(/\.html$/);
  expect(text).toContain('#336699');
});

test('a browser refusal leaves the note and the HTML link', async ({ page }) => {
  const made = await seed(); await open(page, made, 'body');
  await page.evaluate(() => { window.WCPictureExport.mockupCanvas = () => Promise.reject(new Error('refused')); });
  await page.locator('#download').click();
  await expect(page.locator('#download-note')).toHaveText('This browser could not make a PNG of this mockup. Download HTML instead.');
  await expect(page.locator('#download-html')).toBeVisible();
});
