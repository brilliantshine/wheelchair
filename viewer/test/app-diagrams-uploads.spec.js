'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox";
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEUlEQVR4nGP4z8AARAxg8j8AG/ID/fPnS7EAAAAASUVORK5CYII=', 'base64');
test.use({ viewport: { width: 390, height: 844 } });
let ctx;
test.beforeEach(async ({ page }) => { ctx = await startWorld(); ctx.machine.uploadsDir = path.join(ctx.state, 'uploads'); await signIn(page, ctx); });
test.afterEach(async () => { await ctx.close(); });

test('forms and static sandboxed HTML render without overflow or network', async ({ page }) => {
  const requests = [];
  const recorder = http.createServer((req, res) => { requests.push(req.url); res.end('unexpected'); });
  await new Promise((resolve) => recorder.listen(0, '127.0.0.1', resolve));
  try {
    const made = await ctx.make({ cli: 'claude' });
    const worktree = path.join(ctx.state, 'worktree');
    const dir = path.join(worktree, 'docs/plans/dark/graphs'); await fs.mkdir(dir, { recursive: true });
    const forms = {
      timeline: { form: 'timeline', explanation: 'Timeline explanation', events: [{ when: 'Today', label: 'Start', detail: 'Details' }] },
      change: { form: 'before-after', explanation: 'Change explanation', before: { items: ['Old'] }, after: { items: ['New'] } },
      layers: { form: 'layers', explanation: 'Layers explanation', layers: [{ label: 'Top' }] },
      compare: { form: 'side-by-side', explanation: 'Compare explanation', columns: [{ title: 'One', items: ['A'] }, { title: 'Two', items: ['B'] }] },
      invalid: { form: 'timeline', explanation: 'Invalid', events: [] },
    };
    const url = `http://127.0.0.1:${recorder.address().port}`;
    await fs.writeFile(path.join(dir, 'custom.html'), `<meta http-equiv="refresh" content="0;url=${url}/refresh"><style>#proof { color: rgb(1, 2, 3) }</style><link rel="stylesheet" href="${url}/style"><script>fetch('${url}/script')</script><img src="${url}/image"><p id="proof">Sandbox proof</p>`);
    for (const [name, value] of Object.entries(forms)) await fs.writeFile(path.join(dir, name + '.json'), JSON.stringify(value));
    await ctx.patch(made.id, (t) => { t.worktree = worktree; t.slug = 'dark'; });
    for (const name of Object.keys(forms)) await ctx.post(made.id, { kind: 'diagram', plan: 'dark', graph: name, title: name, format: 'form' });
    await ctx.post(made.id, { kind: 'diagram', plan: 'dark', graph: 'custom', title: 'Custom HTML', format: 'html' });
    const response = page.waitForResponse((r) => r.url().includes('/diagram-html?'));
    await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
    expect((await response).headers()['content-security-policy']).toBe(CSP);
    for (const name of ['Timeline explanation', 'Change explanation', 'Layers explanation', 'Compare explanation']) await expect(page.getByText(name)).toBeVisible();
    await expect(page.getByText('This diagram could not be drawn')).toBeVisible();
    const frame = page.frameLocator('iframe[title="Custom HTML"]');
    await expect(frame.locator('#proof')).toHaveText('Sandbox proof');
    await expect(frame.locator('#proof')).toHaveCSS('color', 'rgb(1, 2, 3)');
    await page.waitForTimeout(500); expect(requests).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await new Promise((resolve) => recorder.close(resolve)); }
});

test('paste uploads bytes, oversize is refused, and image cards respect archive', async ({ page }) => {
  const made = await ctx.make({ cli: 'claude' });
  await page.goto(`${ctx.server.url}/app/thread?id=${made.id}`);
  await expect(page.locator('#msg')).toBeEnabled();
  await page.locator('#msg').evaluate((node, bytes) => {
    const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array(bytes)], 'image.png', { type: 'image/png' }));
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: transfer }); node.dispatchEvent(event);
  }, [...png]);
  await expect(page.locator('.attachment-chip')).toContainText('pasted-');
  const msg = page.waitForRequest((r) => r.method() === 'POST' && r.url().endsWith('/messages'));
  await page.locator('#send').click();
  const text = (await msg).postDataJSON().text; const match = text.match(/^\[attached: (.+)\]$/); expect(match).toBeTruthy();
  expect(await fs.readFile(match[1])).toEqual(png);
  const before = ctx.machine.calls.filter((c) => c.path === '/v1/uploads').length;
  await page.locator('#attachment-input').setInputFiles({ name: 'large.bin', mimeType: 'application/octet-stream', buffer: Buffer.alloc(25 * 1024 * 1024 + 1) });
  await expect(page.locator('#attachment-error')).toHaveText('large.bin is over 25 MB');
  expect(ctx.machine.calls.filter((c) => c.path === '/v1/uploads')).toHaveLength(before);
  await ctx.post(made.id, { kind: 'image', path: match[1], title: 'Screenshot' });
  const img = page.locator('img.card-image'); await expect(img).toBeVisible(); await expect.poll(() => img.evaluate((n) => n.naturalWidth)).toBeGreaterThan(0);
  await ctx.patch(made.id, (t) => { t.archived = true; });
  const requested = []; page.on('request', (r) => { if (r.url().includes('/files/')) requested.push(r.url()); });
  await page.reload(); await expect(page.getByText('Image removed when the thread was archived')).toBeVisible(); expect(requested).toEqual([]);
});
