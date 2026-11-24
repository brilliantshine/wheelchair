'use strict';
// The picture page's screenshot view (docs/plans/mockup-polish S4): an image card's file at its natural
// pixel size, scrolling sideways on a phone, with a Download link; a removed file says so.
const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

let ctx;
test.beforeEach(async ({ page }) => { ctx = await startWorld(); ctx.machine.uploadsDir = path.join(ctx.state, 'uploads'); await signIn(page, ctx); });
test.afterEach(async () => { await ctx.close(); });
test.use({ viewport: { width: 390, height: 844 } });

function crc(buf) { let c, n = 0xffffffff; for (const b of buf) { c = (n ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; n = (n >>> 8) ^ c; } return (n ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4); data.copy(b, 8); b.writeUInt32BE(crc(b.subarray(4, 8 + data.length)), 8 + data.length); return b; }
// A solid-colour PNG, w x h.
function solid(w, h) {
  const row = Buffer.alloc(1 + w * 3, 0x80); row[0] = 0;
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array(h).fill(row)))), chunk('IEND', Buffer.alloc(0))]);
}

async function seed() {
  const made = await ctx.make({ cli: 'claude' });
  const dir = path.join(ctx.machine.uploadsDir, made.id); await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, '1-wide.png'); await fs.writeFile(file, solid(1200, 300));
  const card = await ctx.post(made.id, { kind: 'image', path: file, title: 'Wide screenshot' });
  return { made, card };
}

test('a 1200px image shows at 1200 CSS px and the page scrolls sideways', async ({ page }) => {
  const { made, card } = await seed();
  await page.goto(`${ctx.server.url}/app/picture?thread=${made.id}&card=${card.id}&view=image`);
  const img = page.locator('#picture img');
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((n) => n.complete && n.naturalWidth)).toBe(1200);
  expect(await img.evaluate((n) => n.getBoundingClientRect().width)).toBe(1200);
  expect(await page.locator('#picture').evaluate((n) => n.scrollWidth > n.clientWidth)).toBe(true);
  const dl = page.locator('#download');
  await expect(dl).toBeVisible();
  expect(await dl.getAttribute('href')).toContain(`/threads/${made.id}/files/`);
  expect(await dl.evaluate(async (n) => (await fetch(n.href)).status)).toBe(200);
});

test('a file removed on archive shows the removal text', async ({ page }) => {
  const { made, card } = await seed();
  await ctx.patch(made.id, (t) => { t.archived = true; t.kept_files = []; });
  await page.goto(`${ctx.server.url}/app/picture?thread=${made.id}&card=${card.id}&view=image`);
  await expect(page.locator('#message')).toHaveText('Image removed when the thread was archived');
  await expect(page.locator('#picture img')).toHaveCount(0);
});
