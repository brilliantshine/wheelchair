'use strict';

// Real headless Chromium against the served page — not jsdom, which has no layout and would pass
// a drag that did nothing. Every gesture below goes through real pointer events (page.mouse,
// locator.click) or dispatched keyboard events; window.__viewer is read *only* to check state back,
// never to drive the page. See docs/plans/editable-node-graphs/PLAN.md §13 (test:browser) and
// ~/.cache/wheelchair/contract.md sections L and M for the exact
// names and rules this file asserts against.

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test, expect } = require('@playwright/test');
const { makeDir, stage, startServer, getGraph, put, copy, sha256 } = require('./helpers/server');

// The fixture's world extent runs to x=2300, y=974 (node d, node h's box). A default ~1280x720
// viewport would put the far group off-screen at zoom 1; widen it once for the whole file so every
// test can locate every node without panning, and the minimum-zoom test still has to zoom out on
// its own merits to prove the hit band is computed in device pixels.
test.use({ viewport: { width: 2600, height: 1300 } });

// ---- server lifecycle -------------------------------------------------------------------------

async function launch(fixtureName, targetName = fixtureName) {
  const root = await makeDir('browser-');
  const graphDir = path.join(root, 'graphs');
  await fs.mkdir(graphDir, { recursive: true });
  const graphPath = await stage({ graphDir }, fixtureName, targetName);
  return startServer({ cacheRoot: root, open: graphPath });
}

function pageUrl(ctx) {
  return `${ctx.url}/?path=${encodeURIComponent(ctx.graphPath)}&token=${encodeURIComponent(ctx.token)}`;
}

async function diskGraph(ctx) {
  return JSON.parse(await fs.readFile(ctx.graphPath, 'utf8'));
}

function entry(graph, id) {
  return [...graph.nodes, ...graph.edges].find((item) => item.id === id);
}

// Agent write from outside the page: reads the current graph, lets the caller mutate a copy, PUTs
// it through /graph exactly as an agent would (never through the page).
async function agentPut(ctx, mutate) {
  const state = await getGraph(ctx);
  const g = copy(state.graph);
  mutate(g);
  const res = await put(ctx, '/graph', g, state.hash);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res;
}

// ---- page helpers ------------------------------------------------------------------------------

async function ready(page) {
  await page.waitForFunction(() => window.__viewer && !!window.__viewer.graph());
}

async function selection(page) {
  return page.evaluate(() => window.__viewer.selection().slice().sort());
}

async function pageGraph(page) {
  return page.evaluate(() => window.__viewer.graph());
}

async function pageZoom(page) {
  return page.evaluate(() => window.__viewer.zoom);
}

function nodeBox(page, id) { return page.locator(`svg#canvas g.node[data-id="${id}"] rect.node-box`); }
function edgeLine(page, id) { return page.locator(`svg#canvas g.edge[data-id="${id}"] path.edge-line`); }
function edgeLabel(page, id) { return page.locator(`svg#canvas g.edge[data-id="${id}"] text.edge-label`); }
function edgeHandle(page, id, end) {
  return page.locator(`svg#canvas g.edge[data-id="${id}"] circle.edge-handle[data-end="${end}"]`);
}

async function center(locator) {
  const box = await locator.boundingBox();
  assert.ok(box, 'element has a layout box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function clickNode(page, id, { shift = false } = {}) {
  await nodeBox(page, id).click({ modifiers: shift ? ['Shift'] : [] });
}

async function clearSelectionViaButton(page) {
  await page.locator('#clear-selection').click();
}

function collectViewResponses(page) {
  const responses = [];
  const listener = (resp) => {
    if (resp.request().method() === 'PUT' && resp.url().includes('/view')) responses.push(resp);
  };
  page.on('response', listener);
  return { responses, stop: () => page.off('response', listener) };
}

// ============================================================================================
// Dragging a node writes matching integer coordinates to disk.
// ============================================================================================
test('dragging a single node writes matching integer coordinates to disk', async ({ page }) => {
  const ctx = await launch('interactive.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);
    const before = entry(await pageGraph(page), 'a');
    const start = await center(nodeBox(page, 'a'));

    const collector = collectViewResponses(page);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 133, start.y + 61, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => collector.responses.some((r) => r.status() === 200)).toBe(true);
    collector.stop();

    const onDisk = entry(await diskGraph(ctx), 'a');
    assert.equal(onDisk.x, before.x + 133);
    assert.equal(onDisk.y, before.y + 61);
    assert.ok(Number.isInteger(onDisk.x));
    assert.ok(Number.isInteger(onDisk.y));
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// Dragging a multi-node selection moves every member.
// ============================================================================================
test('dragging a multi-node selection moves every member', async ({ page }) => {
  const ctx = await launch('interactive.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);
    const beforeGraph = await pageGraph(page);
    const a0 = entry(beforeGraph, 'a');
    const b0 = entry(beforeGraph, 'b');

    await clickNode(page, 'a');
    await clickNode(page, 'b', { shift: true });
    // Both endpoints of a->b are now selected, so the effective selection implicitly includes
    // the edge too (decision 63) — the drag itself must still move only the two *node* ids.
    assert.deepEqual(await selection(page), ['a', 'a->b', 'b'].sort());

    const start = await center(nodeBox(page, 'a'));
    const collector = collectViewResponses(page);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 90, start.y + 40, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => collector.responses.some((r) => r.status() === 200)).toBe(true);
    collector.stop();

    const after = await diskGraph(ctx);
    const a1 = entry(after, 'a');
    const b1 = entry(after, 'b');
    assert.equal(a1.x, a0.x + 90);
    assert.equal(a1.y, a0.y + 40);
    assert.equal(b1.x, b0.x + 90);
    assert.equal(b1.y, b0.y + 40);
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// A drag interrupted by an agent write mid-gesture loses the drag and keeps the agent's write.
// The mechanism: the page polls GET /graph every 1000ms and, on a hash change, replaces its whole
// in-memory `graph` object and re-renders. If that swap happens while the pointer is still down and
// no further pointermove follows before pointerup, the position read at drag-end comes off the
// freshly-polled (undragged) node — the visible drag never lands, while the agent's unrelated field
// change (which the page's structural-identity check has to preserve verbatim) does. This is the
// accepted risk in decision 117 / PLAN.md §13, asserted here rather than assumed.
// ============================================================================================
test('a drag interrupted by an agent write mid-gesture loses the drag and keeps the agent write', async ({ page }) => {
  const ctx = await launch('interactive.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);
    const before = entry(await pageGraph(page), 'a');
    const start = await center(nodeBox(page, 'a'));

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 77, start.y + 33, { steps: 5 }); // dragState.moved = true

    await agentPut(ctx, (g) => { entry(g, 'b').note = 'agent wrote this mid-drag'; });

    // Let the page's 1000ms poll pick up the new hash and swap `graph` out from under the drag,
    // with no further pointermove to reapply the offset onto the fresh object.
    await page.waitForTimeout(1300);

    const collector = collectViewResponses(page);
    await page.mouse.up(); // no intervening move — this is the failure window the risk describes
    await expect.poll(() => collector.responses.some((r) => r.status() === 200)).toBe(true);
    collector.stop();

    const onDisk = await diskGraph(ctx);
    assert.equal(entry(onDisk, 'a').x, before.x, 'the drag did not land');
    assert.equal(entry(onDisk, 'a').y, before.y, 'the drag did not land');
    assert.equal(entry(onDisk, 'b').note, 'agent wrote this mid-drag', "the agent's write survived");
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// Clearing `was`: after an agent resets an `agreed` entry, approving it again through the page
// removes the field.
// ============================================================================================
test('approving a reset entry through the page clears was', async ({ page }) => {
  const ctx = await launch('verdicts.json');
  try {
    await agentPut(ctx, (g) => {
      Object.assign(entry(g, 'agree'), { origin: 'proposed', was: 'agreed' });
    });
    let onDisk = await diskGraph(ctx);
    assert.equal(entry(onDisk, 'agree').was, 'agreed');

    await page.goto(pageUrl(ctx));
    await ready(page);
    assert.equal(entry(await pageGraph(page), 'agree').was, 'agreed');

    await clickNode(page, 'agree');
    const collector = collectViewResponses(page);
    await page.locator('#approve').click();
    await expect.poll(() => collector.responses.some((r) => r.status() === 200)).toBe(true);
    collector.stop();

    onDisk = await diskGraph(ctx);
    assert.equal(entry(onDisk, 'agree').origin, 'agreed');
    assert.equal(entry(onDisk, 'agree').was, null);
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// Box-select then approve sets `agreed` on every node and every edge whose endpoints are both
// selected.
// ============================================================================================
test('box-select then approve sets agreed on every selected node and implied edge', async ({ page }) => {
  const ctx = await launch('interactive.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const boxA = await nodeBox(page, 'a').boundingBox();
    const boxB = await nodeBox(page, 'b').boundingBox();
    const x0 = Math.min(boxA.x, boxB.x) - 30;
    const y0 = Math.min(boxA.y, boxB.y) - 30;
    const x1 = Math.max(boxA.x + boxA.width, boxB.x + boxB.width) + 30;
    const y1 = Math.max(boxA.y + boxA.height, boxB.y + boxB.height) + 30;

    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.mouse.move(x1, y1, { steps: 6 });
    await page.mouse.up();

    const sel = await selection(page);
    assert.deepEqual(sel, ['a', 'a->b', 'b'].sort());

    const collector = collectViewResponses(page);
    await page.locator('#approve').click();
    await expect.poll(() => collector.responses.some((r) => r.status() === 200)).toBe(true);
    collector.stop();

    const onDisk = await diskGraph(ctx);
    assert.equal(entry(onDisk, 'a').origin, 'agreed');
    assert.equal(entry(onDisk, 'b').origin, 'agreed');
    assert.equal(entry(onDisk, 'a->b').origin, 'agreed');
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// Shift-clicking an implied edge removes it from the selection and it stays removed across later
// clicks, while both its endpoints remain selected.
// ============================================================================================
test('shift-clicking an implied edge removes it and it stays removed', async ({ page }) => {
  const ctx = await launch('interactive.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    await clickNode(page, 'a');
    await clickNode(page, 'b', { shift: true });
    assert.deepEqual(await selection(page), ['a', 'a->b', 'b'].sort());

    const bandPoint = await center(edgeLine(page, 'a->b'));
    await page.keyboard.down('Shift');
    await page.mouse.click(bandPoint.x, bandPoint.y);
    await page.keyboard.up('Shift');

    let sel = await selection(page);
    assert.deepEqual(sel, ['a', 'b'].sort(), 'edge removed from the effective selection');

    // A later, unrelated click (shift-selecting a third, unrelated node) must not resurrect it —
    // both endpoints of a->b are still selected throughout.
    await clickNode(page, 'e', { shift: true });
    sel = await selection(page);
    assert.deepEqual(sel, ['a', 'b', 'e'].sort(), 'implied edge stays removed across a later click');
    assert.ok(!sel.includes('a->b'));
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// An edge is selectable by label, by band, and by endpoint handle — at minimum zoom (0.3). The
// band case clicks a point on the line away from both nodes and away from the label: at 0.3 zoom a
// 24-*user-unit* band (rather than 24 *device* pixels) would be roughly 7px wide and miss this
// click by design.
// ============================================================================================
test('an edge is selectable by label, band and endpoint handle at minimum zoom', async ({ page }) => {
  const ctx = await launch('interactive.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    for (let i = 0; i < 10; i += 1) await page.locator('#zoom-out').click();
    assert.equal(await pageZoom(page), 0.3);

    // 1) the label
    await edgeLabel(page, 'c->d').click();
    assert.deepEqual(await selection(page), ['c->d']);
    await clearSelectionViaButton(page);

    // 2) the band, off-center: 9 real screen px away from the line, on the side opposite the
    // label (which renders above a horizontal edge per index.html's perpendicular offset).
    const lineBox = await edgeLine(page, 'c->d').boundingBox();
    const midX = lineBox.x + lineBox.width / 2;
    const midY = lineBox.y + lineBox.height / 2;
    await page.mouse.click(midX, midY + 9);
    assert.deepEqual(await selection(page), ['c->d']);
    await clearSelectionViaButton(page);

    // 3) an endpoint handle
    await edgeHandle(page, 'c->d', 'from').click();
    assert.deepEqual(await selection(page), ['c->d']);
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// Two edges between one pair of nodes, one in each direction, are drawn on separate geometry and
// each is independently selectable — on a single geometry they would read as one double-headed
// arrow and one band would cover the other.
// ============================================================================================
test('two edges between one pair of nodes in opposite directions are independently selectable', async ({ page }) => {
  const ctx = await launch('interactive.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const efLine = await edgeLine(page, 'e->f').boundingBox();
    const feLine = await edgeLine(page, 'f->e').boundingBox();
    // Fanned apart perpendicular to the (horizontal) line: distinct y, same x span.
    assert.notEqual(efLine.y, feLine.y, 'the two edges are drawn on separate geometry');

    const efPoint = await center(edgeLine(page, 'e->f'));
    await page.mouse.click(efPoint.x, efPoint.y);
    assert.deepEqual(await selection(page), ['e->f']);

    const fePoint = await center(edgeLine(page, 'f->e'));
    await page.mouse.click(fePoint.x, fePoint.y);
    assert.deepEqual(await selection(page), ['f->e']);
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// Selecting one item expands `ref`, `note`, and for an edge its payload with its inferred state,
// at the item. Elements for absent fields are omitted, not left empty.
// ============================================================================================
test('selecting an item expands ref, note, and an edge payload with its inferred state', async ({ page }) => {
  const ctx = await launch('interactive.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    await clickNode(page, 'g');
    const nodeDetail = page.locator('svg#canvas g.detail[data-for="g"]');
    await expect(nodeDetail).toHaveCount(1);
    assert.equal((await nodeDetail.locator('.detail-ref').textContent()).trim(), 'src/example.js');
    assert.equal((await nodeDetail.locator('.detail-note').textContent()).trim(), 'A note worth reading.');

    await clearSelectionViaButton(page);
    await clickNode(page, 'h'); // no ref, no note
    const plainDetail = page.locator('svg#canvas g.detail[data-for="h"]');
    await expect(plainDetail).toHaveCount(1);
    assert.equal(await plainDetail.locator('.detail-ref').count(), 0, 'absent field is omitted, not empty');
    assert.equal(await plainDetail.locator('.detail-note').count(), 0, 'absent field is omitted, not empty');

    await clearSelectionViaButton(page);
    // A horizontal edge's <path> reports a zero-height bounding box in Chromium — real geometry,
    // not a bug, but it fails Playwright's own element-actionability visibility check for
    // `.click()`. Dispatch a raw pointer click at the line's midpoint instead, same as the other
    // edge-hit tests.
    const ghPoint = await center(edgeLine(page, 'g->h'));
    await page.mouse.click(ghPoint.x, ghPoint.y);
    const edgeDetail = page.locator('svg#canvas g.detail[data-for="g->h"]');
    await expect(edgeDetail).toHaveCount(1);
    assert.equal((await edgeDetail.locator('.detail-value').textContent()).trim(), 'a widget');
    const inferredText = (await edgeDetail.locator('.detail-inferred').textContent()).trim();
    assert.ok(inferredText.includes('inferred'), `expected the inferred marker, got "${inferredText}"`);
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// No gesture and no control adds, renames or connects anything. Authoring is cut.
// ============================================================================================
test('no gesture or control adds, renames or connects anything', async ({ page }) => {
  const ctx = await launch('interactive.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);
    const before = await pageGraph(page);
    const beforeShape = {
      nodeCount: before.nodes.length,
      edgeCount: before.edges.length,
      nodeLabels: before.nodes.map((n) => [n.id, n.label]).sort(),
      edgeLabels: before.edges.map((e) => [e.id, e.label]).sort(),
    };

    // Double-click the background.
    await page.mouse.dblclick(1900, 700);
    // Double-click a node.
    await nodeBox(page, 'a').dblclick();
    // Drag from one node to another — the page has no connect gesture, so this only relocates 'a'.
    const fromPoint = await center(nodeBox(page, 'a'));
    const toPoint = await center(nodeBox(page, 'b'));
    await page.mouse.move(fromPoint.x, fromPoint.y);
    await page.mouse.down();
    await page.mouse.move(toPoint.x, toPoint.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    // Press an assortment of keys that would matter if any authoring shortcut existed.
    for (const key of ['a', 'n', 'e', 'c', 'Enter', '+', 'Delete', 'Backspace']) {
      await page.keyboard.press(key);
    }
    await page.waitForTimeout(200);

    const after = await pageGraph(page);
    const afterShape = {
      nodeCount: after.nodes.length,
      edgeCount: after.edges.length,
      nodeLabels: after.nodes.map((n) => [n.id, n.label]).sort(),
      edgeLabels: after.edges.map((e) => [e.id, e.label]).sort(),
    };
    assert.deepEqual(afterShape, beforeShape);

    const onDisk = await diskGraph(ctx);
    assert.equal(onDisk.nodes.length, beforeShape.nodeCount);
    assert.equal(onDisk.edges.length, beforeShape.edgeCount);
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// A page write carries an Origin the server accepts. The page cannot set that header itself — it
// relies on Chromium attaching it automatically to a same-origin PUT.
// ============================================================================================
test('a page write through the browser carries an Origin the server accepts', async ({ page }) => {
  const ctx = await launch('interactive.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);
    await clickNode(page, 'a');

    const collector = collectViewResponses(page);
    await page.locator('#approve').click();
    await expect.poll(() => collector.responses.some((r) => r.status() === 200)).toBe(true);
    const accepted = collector.responses.find((r) => r.status() === 200);
    assert.ok(accepted, 'the write was accepted');
    // request.headers() reflects only the JS-visible header set, which excludes forbidden headers
    // the browser controls itself. Origin is one of those, so the actual wire value has to come
    // from allHeaders() (the real network request Chromium sent), which is exactly the fact this
    // test exists to pin down: the page cannot set Origin itself.
    const sentHeaders = await accepted.request().allHeaders();
    assert.equal(sentHeaders.origin, ctx.url, 'Chromium attached the same-origin Origin header');
    collector.stop();

    const onDisk = await diskGraph(ctx);
    assert.equal(entry(onDisk, 'a').origin, 'agreed', 'the file on disk changed');
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// A 409 mid-approve is survived: the page re-reads and re-applies its verdicts rather than
// resending the stale payload.
// ============================================================================================
test('a 409 mid-approve is survived by re-reading and re-applying the verdict', async ({ page }) => {
  const ctx = await launch('interactive.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    await clickNode(page, 'a');
    await clickNode(page, 'b', { shift: true });
    await clickNode(page, 'g', { shift: true });
    // a->b's endpoints are both selected, so it rides along implicitly (decision 63); the write
    // under test still only needs to move a, b and g to "agreed".
    assert.deepEqual(await selection(page), ['a', 'a->b', 'b', 'g'].sort());

    // An agent restructures the graph from outside, between the page's last read and its write.
    await agentPut(ctx, (g) => {
      g.nodes.push({
        id: 'agent-added', label: 'Agent added this', kind: 'note', origin: 'proposed', was: null,
        exclusive: false, ref: null, note: null, graph: null, x: 0, y: 0,
      });
    });

    const collector = collectViewResponses(page);
    await page.locator('#approve').click();
    await expect.poll(() => collector.responses.some((r) => r.status() === 200), { timeout: 10000 }).toBe(true);
    collector.stop();

    const statuses = collector.responses.map((r) => r.status());
    assert.ok(statuses.includes(409), `expected a 409 among ${JSON.stringify(statuses)}`);
    assert.ok(statuses[statuses.length - 1] === 200 || statuses.includes(200));

    const onDisk = await diskGraph(ctx);
    assert.equal(entry(onDisk, 'a').origin, 'agreed');
    assert.equal(entry(onDisk, 'b').origin, 'agreed');
    assert.equal(entry(onDisk, 'g').origin, 'agreed');
    assert.ok(entry(onDisk, 'agent-added'), "the agent's restructuring survived");
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// Never touch ~/.cache/agent-graphs. Cheap to assert given the isolation the helper already buys.
// ============================================================================================
test('the browser suite never touches the live default cache root', async ({ page }) => {
  const live = path.join(os.homedir(), '.cache', 'agent-graphs');
  async function snapshot(dir, relative = '') {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const result = {};
      for (const item of entries.sort((l, r) => l.name.localeCompare(r.name))) {
        const target = path.join(dir, item.name);
        const key = path.join(relative, item.name);
        if (item.isDirectory()) Object.assign(result, await snapshot(target, key));
        else result[key] = sha256(await fs.readFile(target));
      }
      return result;
    } catch (error) {
      return error.code === 'ENOENT' ? null : { error: error.code || String(error) };
    }
  }

  const before = await snapshot(live);
  const ctx = await launch('interactive.json');
  try {
    assert.notEqual(ctx.root, live);
    await page.goto(pageUrl(ctx));
    await ready(page);
    await clickNode(page, 'a');
    await page.locator('#approve').click();
    await page.waitForTimeout(300);
  } finally {
    await ctx.stop();
  }
  const after = await snapshot(live);
  assert.deepEqual(after, before);
});
