'use strict';
// The picture page's Download button (docs/plans/sidebar-files-followup, S1): a PNG for a graph
// (even one wider than a phone, panned and zoomed first) and for a form, and a plain link for HTML.
const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { startWorld, signIn } = require('./helpers/app-threads-world');

let ctx;
test.beforeEach(async ({ page }) => { ctx = await startWorld(); await signIn(page, ctx); });
test.afterEach(async () => { await ctx.close(); });

const node = (id, x, y) => ({ id, label: id, kind: 'step', exclusive: false, ref: null, note: null, graph: null, x, y });
const WIDE = { schema: 1, title: 'Wide', source: 'code-read', source_detail: 'test', explanation: 'A wide row of nodes.', groups: [],
  nodes: [node('nodeA', 0, 0), node('nodeB', 900, 0), node('nodeC', 1800, 0), node('nodeD', 2700, 0)], edges: [] };
const GROUPED = { ...WIDE, title: 'Grouped', groups: [{ id: 'g1', label: 'Shaded group', note: 'A visible group.', visible: true, nodes: ['nodeA', 'nodeB'] }],
  nodes: [node('nodeA', 0, 0), node('nodeB', 500, 0)] };
const FORM = { form: 'timeline', explanation: 'Three steps in a long, wrapped explanation sentence that goes on for a while so that it has to wrap.',
  events: [{ when: 'Monday', label: 'Kick-off', detail: 'Everyone meets and agrees the plan together.' }, { when: 'Friday', label: 'Ship' }] };

async function seed(files) {
  const made = await ctx.make({ cli: 'claude' });
  const worktree = path.join(ctx.state, 'worktree');
  const dir = path.join(worktree, 'docs/plans/dark/graphs'); await fs.mkdir(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) await fs.writeFile(path.join(dir, name), typeof body === 'string' ? body : JSON.stringify(body));
  await ctx.patch(made.id, (t) => { t.worktree = worktree; t.slug = 'dark'; });
  return made;
}
async function open(page, made, card) {
  const posted = await ctx.post(made.id, { kind: 'diagram', plan: 'dark', ...card });
  await page.goto(`${ctx.server.url}/app/picture?thread=${made.id}&card=${posted.id}`);
}
async function download(page) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#download').click()]);
  return { dl, bytes: await fs.readFile(await dl.path()) };
}
// Width, height and, per vertical band, whether any pixel differs from the corner (background) pixel.
async function inspect(page, bytes, bands) {
  return page.evaluate(async ({ b64, bands }) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bin], { type: 'image/png' }));
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
    const bg = Array.from(g.getImageData(0, 0, 1, 1).data);
    const hits = [];
    for (let i = 0; i < bands; i++) {
      const x0 = Math.floor(bmp.width * i / bands); const x1 = Math.floor(bmp.width * (i + 1) / bands);
      const d = g.getImageData(x0, 0, x1 - x0, bmp.height).data; let hit = false;
      for (let p = 0; p < d.length; p += 4) if (d[p] !== bg[0] || d[p + 1] !== bg[1] || d[p + 2] !== bg[2]) { hit = true; break; }
      hits.push(hit);
    }
    return { w: bmp.width, h: bmp.height, hits };
  }, { b64: bytes.toString('base64'), bands });
}
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('a graph wider than the phone, panned and zoomed, downloads a PNG with every node', async ({ page }) => {
    const made = await seed({ 'wide.json': WIDE });
    await open(page, made, { graph: 'wide', title: 'Wide graph!', format: 'graph' });
    const frame = page.frameLocator('iframe.picture-frame');
    await expect(frame.locator('.node')).toHaveCount(4);
    const box = await page.locator('iframe.picture-frame').boundingBox();
    await page.mouse.move(box.x + 200, box.y + 300);
    await page.mouse.wheel(0, -600);
    await page.mouse.down(); await page.mouse.move(box.x + 60, box.y + 380, { steps: 5 }); await page.mouse.up();
    await page.waitForTimeout(200);
    const live = await page.frames().find((f) => f !== page.mainFrame()).evaluate(() => {
      const root = Array.from(document.getElementById('canvas').children).filter((c) => c.tagName === 'g').pop();
      const b = root.getBBox(); return { w: b.width, h: b.height, transform: root.getAttribute('transform') };
    });
    expect(live.transform).not.toBe('translate(0,0) scale(1)');
    const { dl, bytes } = await download(page);
    expect(dl.suggestedFilename()).toBe('Wide-graph.png');
    expect(bytes.subarray(0, 4).equals(PNG)).toBe(true);
    const got = await inspect(page, bytes, 4);
    expect(got.w).toBe(Math.round(Math.ceil(live.w + 48) * 2));
    expect(got.h).toBe(Math.round(Math.ceil(live.h + 48) * 2));
    expect(got.w).toBeGreaterThan(390 * 2);
    expect(got.hits).toEqual([true, true, true, true]);
  });

  test('an exported graph keeps group shading translucent', async ({ page }) => {
    const made = await seed({ 'grouped.json': GROUPED });
    await open(page, made, { graph: 'grouped', title: 'Grouped', format: 'graph' });
    await expect(page.frameLocator('iframe.picture-frame').locator('.group-region')).toHaveCount(1);
    await page.evaluate(() => {
      window.__svg = []; const real = XMLSerializer.prototype.serializeToString;
      XMLSerializer.prototype.serializeToString = function (n) { const s = real.call(this, n); window.__svg.push(s); return s; };
    });
    await download(page);
    const svg = await page.evaluate(() => window.__svg.join('\n'));
    const region = /<[^>]*class="group-region(?: [^"]*)?"[^>]*>/.exec(svg);
    expect(region).not.toBeNull();
    expect(region[0]).toMatch(/fill-opacity:\s*0?\.0?6/);
    expect(svg).not.toContain('label-metric');
  });

  test('a form downloads a PNG that draws every string', async ({ page }) => {
    const made = await seed({ 'steps.json': FORM });
    await open(page, made, { graph: 'steps', title: 'Steps', format: 'form' });
    await expect(page.locator('.diagram-form')).toBeVisible();
    await page.evaluate(() => {
      window.__text = []; const real = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (t, ...rest) { window.__text.push(t); return real.call(this, t, ...rest); };
    });
    const { dl, bytes } = await download(page);
    expect(dl.suggestedFilename()).toBe('Steps.png');
    expect(bytes.subarray(0, 4).equals(PNG)).toBe(true);
    const drawn = (await page.evaluate(() => window.__text.join(' '))).split(/\s+/);
    const every = [FORM.explanation, 'Monday Kick-off Everyone meets and agrees the plan together. Friday Ship'].join(' ').split(/\s+/);
    for (const word of every) expect(drawn).toContain(word);
    const got = await inspect(page, bytes, 1);
    expect(got.hits).toEqual([true]);
    expect(got.w).toBe(1800);
  });

  test('an HTML picture downloads through the displayed URL plus download=1', async ({ page }) => {
    const made = await seed({ 'page.html': '<p>hi</p>' });
    await open(page, made, { graph: 'page', title: 'Page', format: 'html' });
    const src = await page.locator('iframe.picture-frame').getAttribute('src');
    await expect(page.locator('#download')).toHaveAttribute('href', src + '&download=1');
  });
});
