'use strict';

// Real headless Chromium against the served page — not jsdom, which has no layout and would pass
// a drag that did nothing. Every gesture below goes through real pointer events (page.mouse,
// locator.click) or dispatched keyboard events; window.__viewer is read *only* to check state back,
// never to drive the page. The rules this file asserts against are in
// docs/plans/editable-node-graphs/PLAN.md §13 (test:browser) and §7 (the viewer); the DOM names —
// class names, data- attributes, control ids — are fixed by the page itself, viewer/index.html.

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

// Counts requests the page actually issued, not responses that happened to arrive — a request is
// counted the instant it is sent, before any network round trip, so a hypothetical per-entry
// fan-out is caught even if some of the extra requests are still in flight when we look.
function collectViewRequests(page) {
  const requests = [];
  const listener = (req) => {
    if (req.method() === 'PUT' && req.url().includes('/view')) requests.push(req);
  };
  page.on('request', listener);
  return { requests, stop: () => page.off('request', listener) };
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
// R5a — the bulk gesture, driven through the real UI, on a graph that already holds verdicts.
// Starting from an all-unruled fixture (as the earlier box-select test does) cannot exercise the
// additive-only rule at all: there is nothing already-ruled to protect. bulk-verdicts.json holds
// one already-agreed node+edge, two already-rejected nodes and one already-rejected edge, and
// several unruled ones, so select-all + approve either (a) rules only the unruled and is accepted,
// which is the fix, or (b) is refused outright with nothing ruled, which was the bug: the old page
// set origin on every selected entry unconditionally, so two-or-more already-ruled entries in the
// selection produced more than one reversal and the server's additive-only check refused the whole
// write (PLAN.md §6, §13 "Bulk verdicts are additive").
// ============================================================================================
test('select-all approve on a graph already holding verdicts rules only the unruled, and a lone reversal still works', async ({ page }) => {
  const ctx = await launch('bulk-verdicts.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const unruled = ['unruled1', 'unruled2', 'unruled3', 'agreed1->unruled1', 'unruled1->unruled2'];
    const struck = ['rejected1', 'rejected2', 'rejected1->rejected2'];
    const approved = ['agreed1', 'unruled2->unruled3'];

    const collector = collectViewResponses(page);
    await page.locator('#select-all').click();
    await page.locator('#approve').click();
    await expect.poll(() => collector.responses.some((r) => r.status() === 200)).toBe(true);
    collector.stop();

    // The write was accepted, not refused: every response the page received back is 200, never
    // the 422 bulk-not-additive the original bug produced.
    assert.ok(collector.responses.length > 0, 'the approve click issued a write');
    for (const resp of collector.responses) {
      assert.equal(resp.status(), 200, `expected the bulk approve to be accepted, got ${resp.status()}`);
    }

    const onDisk = await diskGraph(ctx);
    for (const id of unruled) {
      assert.equal(entry(onDisk, id).origin, 'agreed', `${id} should have been ruled on`);
    }
    for (const id of struck) {
      assert.equal(entry(onDisk, id).origin, 'rejected', `${id} must stay struck`);
    }
    for (const id of approved) {
      assert.equal(entry(onDisk, id).origin, 'agreed', `${id} must stay approved`);
    }

    // The deliberate single reversal §6 permits still works: selecting exactly one already-struck
    // entry and approving it reverses that one entry, clearing its reset record.
    await clickNode(page, 'rejected1');
    assert.deepEqual(await selection(page), ['rejected1'], 'exactly one entry selected, no implied edge');

    const single = collectViewResponses(page);
    await page.locator('#approve').click();
    await expect.poll(() => single.responses.some((r) => r.status() === 200)).toBe(true);
    single.stop();

    const afterReversal = await diskGraph(ctx);
    assert.equal(entry(afterReversal, 'rejected1').origin, 'agreed', 'the lone struck entry reversed');
    assert.equal(entry(afterReversal, 'rejected1').was, null, 'its reset record is cleared');
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// R5a, mirror case — select-all + reject on a graph holding approved entries leaves them approved
// and strikes only the unruled. Same additive-only rule, opposite verdict.
// ============================================================================================
test('select-all reject on a graph already holding verdicts strikes only the unruled', async ({ page }) => {
  const ctx = await launch('bulk-verdicts.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const unruled = ['unruled1', 'unruled2', 'unruled3', 'agreed1->unruled1', 'unruled1->unruled2'];
    const struck = ['rejected1', 'rejected2', 'rejected1->rejected2'];
    const approved = ['agreed1', 'unruled2->unruled3'];

    const collector = collectViewResponses(page);
    await page.locator('#select-all').click();
    await page.locator('#reject').click();
    await expect.poll(() => collector.responses.some((r) => r.status() === 200)).toBe(true);
    collector.stop();

    assert.ok(collector.responses.length > 0, 'the reject click issued a write');
    for (const resp of collector.responses) {
      assert.equal(resp.status(), 200, `expected the bulk reject to be accepted, got ${resp.status()}`);
    }

    const onDisk = await diskGraph(ctx);
    for (const id of unruled) {
      assert.equal(entry(onDisk, id).origin, 'rejected', `${id} should have been struck`);
    }
    for (const id of approved) {
      assert.equal(entry(onDisk, id).origin, 'agreed', `${id} must stay approved`);
    }
    for (const id of struck) {
      assert.equal(entry(onDisk, id).origin, 'rejected', `${id} must stay struck`);
    }
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// R5b — one write per action (PLAN.md §13). There is no per-entry fan-out because there are no
// patches: a select-all approve is one PUT /view, and a select-all drag is one more. Counting is
// done on the *requests* the page issues (the 'request' event, which fires the instant a request is
// sent) rather than on responses that happened to arrive, and each count is checked only after
// waiting well past when a queued second write would have appeared — the page's write queue drains
// one job at a time, so a hypothetical per-entry fan-out would show up shortly after the first
// response, not simultaneously with it.
// ============================================================================================
test('select-all approve issues exactly one PUT /view, and a select-all drag issues exactly one more', async ({ page }) => {
  const ctx = await launch('interactive.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const approveReqs = collectViewRequests(page);
    const approveResps = collectViewResponses(page);
    await page.locator('#select-all').click();
    await page.locator('#approve').click();
    await expect.poll(() => approveResps.responses.some((r) => r.status() === 200)).toBe(true);
    // Well past the first response, so a queued second write from a fan-out bug would have drained
    // and been captured by now.
    await page.waitForTimeout(1500);
    approveReqs.stop();
    approveResps.stop();
    assert.equal(approveReqs.requests.length, 1,
      `expected exactly one PUT /view for the select-all approve, got ${approveReqs.requests.length}`);

    // The selection survives the write (performWrite only prunes ids that stopped existing), so
    // the same select-all selection is what gets dragged next.
    assert.ok((await selection(page)).length > 1, 'the selection is still the whole graph');

    const dragReqs = collectViewRequests(page);
    const dragResps = collectViewResponses(page);
    const start = await center(nodeBox(page, 'a'));
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 55, start.y + 21, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => dragResps.responses.some((r) => r.status() === 200)).toBe(true);
    await page.waitForTimeout(1500);
    dragReqs.stop();
    dragResps.stop();
    assert.equal(dragReqs.requests.length, 1,
      `expected exactly one more PUT /view for the select-all drag, got ${dragReqs.requests.length}`);

    const onDisk = await diskGraph(ctx);
    assert.equal(entry(onDisk, 'a').x, 150 + 55, 'the drag landed for the dragged node');
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
// A label too long for the box is readable in full in two places — the box's own tooltip and,
// on selection, the top of the detail panel. A label that fits gets neither, so neither is
// noise on an ordinary node.
// ============================================================================================
test('a label the box truncates is readable in full on hover and in the detail panel', async ({ page }) => {
  const ctx = await launch('long-label.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const full = (await pageGraph(page)).nodes.find((n) => n.id === 'long').label;

    // The box really is hiding text: what is painted ends in an ellipsis and is shorter than
    // the label. Without this the two readouts below could be asserting against nothing.
    const painted = (await page.locator('svg#canvas g.node[data-id="long"] text.node-label')
      .allTextContents()).join(' ');
    assert.ok(painted.endsWith('\u2026'), `expected the box to truncate, painted "${painted}"`);
    assert.ok(painted.length < full.length);

    assert.equal(
      await page.locator('svg#canvas g.node[data-id="long"] > title').textContent(),
      full,
      'the box carries the untruncated label as its tooltip',
    );

    await clickNode(page, 'long');
    const detail = page.locator('svg#canvas g.detail[data-for="long"]');
    await expect(detail).toHaveCount(1);
    // Wrapped across tspans in the panel, and textContent on the parent would run the last word
    // of one line into the first of the next — read the lines and rejoin them.
    const shownWords = (await detail.locator('.detail-label tspan').allTextContents())
      .join(' ').split(/\s+/).filter(Boolean).join(' ');
    assert.equal(shownWords, full.split(/\s+/).filter(Boolean).join(' '));

    // A label that fits carries neither readout.
    await clearSelectionViaButton(page);
    assert.equal(await page.locator('svg#canvas g.node[data-id="short"] > title').count(), 0);
    await clickNode(page, 'short');
    const plain = page.locator('svg#canvas g.detail[data-for="short"]');
    await expect(plain).toHaveCount(1);
    assert.equal(await plain.locator('.detail-label').count(), 0, 'absent field is omitted, not empty');
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

// ============================================================================================
// The explanation panel: a collapsible panel below the topbar, expanded when a graph with a
// non-null explanation opens. Whether it exists at all, its layout impact on the canvas below it,
// and the fixed-vs-scrolling height distinction are all real-layout questions — a DOM test would
// see the markup and the text node and call it done, the same way the two scar comments in
// index.html's CSS describe layout bugs (a 150px-collapsed <svg>, a `hidden` element left visible)
// that "looked" correct to anything short of a real, laid-out browser.
// ============================================================================================
test('the explanation panel renders expanded when a graph opens, showing the explanation text', async ({ page }) => {
  const ctx = await launch('interactive.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    assert.equal(await page.evaluate(() => window.__viewer.explainExpanded), true);
    await expect(page.locator('#explain-panel')).toHaveCount(1);
    await expect(page.locator('#explain-body')).toBeVisible();

    const full = (await pageGraph(page)).explanation;
    assert.equal((await page.locator('#explain-body').textContent()).trim(), full.trim());
  } finally {
    await ctx.stop();
  }
});

test('the panel collapses and expands on click, and the canvas is fully usable in both states', async ({ page }) => {
  const ctx = await launch('interactive.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);
    assert.equal(await page.evaluate(() => window.__viewer.explainExpanded), true);
    await expect(page.locator('#explain-body')).toBeVisible();

    const toggle = page.locator('#explain-toggle');
    await toggle.click();
    assert.equal(await page.evaluate(() => window.__viewer.explainExpanded), false);
    await expect(page.locator('#explain-body')).toBeHidden();
    // Collapsing hides the text, not the panel itself — the toggle has to stay reachable.
    await expect(page.locator('#explain-panel')).toHaveCount(1);

    // Usable while collapsed: a real drag, landed on disk, not just an in-page selection check.
    const beforeB = entry(await pageGraph(page), 'b');
    const startB = await center(nodeBox(page, 'b'));
    const collapsedCollector = collectViewResponses(page);
    await page.mouse.move(startB.x, startB.y);
    await page.mouse.down();
    await page.mouse.move(startB.x + 30, startB.y + 12, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => collapsedCollector.responses.some((r) => r.status() === 200)).toBe(true);
    collapsedCollector.stop();
    const onDiskB = entry(await diskGraph(ctx), 'b');
    assert.equal(onDiskB.x, beforeB.x + 30);
    assert.equal(onDiskB.y, beforeB.y + 12);

    await toggle.click();
    assert.equal(await page.evaluate(() => window.__viewer.explainExpanded), true);
    await expect(page.locator('#explain-body')).toBeVisible();

    // Usable while expanded too: a click selects.
    await clickNode(page, 'a');
    assert.deepEqual(await selection(page), ['a']);
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// The layout inventory: resizeCanvas measured only #topbar, so a panel added below it left the
// canvas starting at the topbar's own bottom edge — its top strip buried under the panel. "The
// canvas is usable" is not enough to catch that; it has to be a node pinned to the canvas's own
// top edge, reached by a real pan gesture, that is then actually clicked and dragged.
// ============================================================================================
test('a node panned into the topmost strip of the canvas is clickable and draggable with the panel expanded', async ({ page }) => {
  const ctx = await launch('interactive.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);
    assert.equal(await page.evaluate(() => window.__viewer.explainExpanded), true);

    const canvasBox = await page.locator('svg#canvas').boundingBox();
    const before = entry(await pageGraph(page), 'a');
    let box = await nodeBox(page, 'a').boundingBox();

    // Pan (alt-drag — a plain background drag is box-select) so node 'a''s own top edge lands a
    // few px inside the canvas's top edge: pinned to the topmost strip, not merely "somewhere
    // visible". The anchor point sits 15px inside the canvas's bottom-left corner, well inside
    // fitToView's 60px margin, so it is guaranteed empty background, not another node.
    const desiredTop = canvasBox.y + 6;
    const dy = box.y - desiredTop;
    const anchorX = canvasBox.x + 15, anchorY = canvasBox.y + canvasBox.height - 15;
    await page.keyboard.down('Alt');
    await page.mouse.move(anchorX, anchorY);
    await page.mouse.down();
    await page.mouse.move(anchorX, anchorY - dy, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up('Alt');

    box = await nodeBox(page, 'a').boundingBox();
    assert.ok(box.y >= canvasBox.y - 1 && box.y < canvasBox.y + 30,
      `expected node 'a' pinned to the canvas's top strip, got box.y=${box.y}, canvas top=${canvasBox.y}`);

    // Clickable there.
    await clickNode(page, 'a');
    assert.deepEqual(await selection(page), ['a']);
    await clearSelectionViaButton(page);

    // Draggable there, landed on disk.
    const zoom = await pageZoom(page);
    const start = await center(nodeBox(page, 'a'));
    const collector = collectViewResponses(page);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 44, start.y + 18, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => collector.responses.some((r) => r.status() === 200)).toBe(true);
    collector.stop();

    const onDisk = entry(await diskGraph(ctx), 'a');
    assert.equal(onDisk.x, Math.round(before.x + 44 / zoom));
    assert.equal(onDisk.y, Math.round(before.y + 18 / zoom));
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// `explanation: null` means no panel at all — an element sitting `hidden` would still be one
// element to a DOM count, so this has to assert a count of 0, not merely an invisible one.
// ============================================================================================
test('a graph with a null explanation renders no panel at all', async ({ page }) => {
  for (const fixtureName of ['verdicts.json', 'cycle-layout.json']) {
    const ctx = await launch(fixtureName);
    try {
      await page.goto(pageUrl(ctx));
      await ready(page);
      assert.equal((await pageGraph(page)).explanation, null, `${fixtureName} fixture must carry a null explanation`);
      await expect(page.locator('#explain-panel')).toHaveCount(0);
    } finally {
      await ctx.stop();
    }
  }
});

// ============================================================================================
// A long explanation scrolls inside a bounded panel height instead of growing it: the canvas's
// own height attribute — computed from real, laid-out element boxes via resizeCanvas — must come
// out identical whether the explanation is two sentences or 800 characters.
// ============================================================================================
test('a long explanation scrolls inside a bounded panel without changing the canvas height', async ({ page }) => {
  const shortCtx = await launch('interactive.json');
  let shortHeight;
  try {
    await page.goto(pageUrl(shortCtx));
    await ready(page);
    shortHeight = await page.locator('svg#canvas').getAttribute('height');
  } finally {
    await shortCtx.stop();
  }

  const longCtx = await launch('long-explanation.json');
  try {
    await page.goto(pageUrl(longCtx));
    await ready(page);
    const longHeight = await page.locator('svg#canvas').getAttribute('height');
    assert.equal(longHeight, shortHeight, 'the canvas height must not depend on the explanation length');

    const [scrollHeight, clientHeight] = await page.evaluate(() => {
      const body = document.getElementById('explain-body');
      return [body.scrollHeight, body.clientHeight];
    });
    assert.ok(scrollHeight > clientHeight,
      `expected the long explanation to overflow its fixed-height panel (scrollHeight=${scrollHeight}, clientHeight=${clientHeight})`);
  } finally {
    await longCtx.stop();
  }
});

// ============================================================================================
// The layout inventory: #error-banner sits above the topbar's own z-index specifically so a
// panel below the topbar can never bury it. Faulted at the true boundary — the network request
// itself aborted, not an internal call — so the page's own catch branch is what raises the
// banner, and a real click at the banner's screen position is what proves nothing painted over it
// (Playwright's actionability check hit-tests the click point and times out if something else
// would receive it).
// ============================================================================================
test('the error banner stays visible and legible with the panel expanded', async ({ page }) => {
  const ctx = await launch('interactive.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);
    assert.equal(await page.evaluate(() => window.__viewer.explainExpanded), true);

    await page.route('**/view*', (route) => route.abort());

    await clickNode(page, 'a');
    await page.locator('#approve').click();

    const banner = page.locator('#error-banner');
    await expect(banner).toBeVisible();
    const text = (await banner.textContent()).trim();
    assert.ok(text.length > 0, 'the banner carries readable text');
    const box = await banner.boundingBox();
    assert.ok(box && box.width > 0 && box.height > 0, 'the banner has a real, non-zero box');

    await banner.click({ timeout: 3000 });
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// The layout inventory: #fatal's `inset: 48px 0 0 0` covers the canvas independently of the
// panel and sits above it in z-index, so it must still cover the whole canvas area when the panel
// is expanded. Faulted at the filesystem boundary the server itself reads from — the graph file
// removed out from under a live poll — so the page's own pollOnce -> showFatal path (not an
// internal call) is what raises the overlay.
// ============================================================================================
test('the fatal overlay still covers the canvas with the panel expanded', async ({ page }) => {
  const ctx = await launch('interactive.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);
    assert.equal(await page.evaluate(() => window.__viewer.explainExpanded), true);
    await expect(page.locator('#explain-panel')).toHaveCount(1);

    await fs.unlink(ctx.graphPath);
    await expect.poll(() => page.locator('#fatal').isVisible(), { timeout: 3000 }).toBe(true);

    const fatalBox = await page.locator('#fatal').boundingBox();
    const vp = page.viewportSize();
    assert.ok(fatalBox.y <= 49, `fatal should start at the topbar's bottom edge, got y=${fatalBox.y}`);
    assert.ok(fatalBox.y + fatalBox.height >= vp.height - 1, 'fatal should reach the bottom of the viewport');
    assert.ok(fatalBox.width >= vp.width - 1, 'fatal should span the full viewport width');
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// Collapse state lives in the tab: it must survive the once-a-second poll and a navigation into a
// child graph, but a full page reload starts fresh. parent.json/child.json both carry a null
// explanation in their fixture files, on purpose, so the "no panel at all" fixtures stay honest —
// this test puts a real explanation on the parent with an agent PUT, exactly the way agentPut
// already drives every other cross-graph write in this file, rather than editing a fixture.
// ============================================================================================
test('collapse state survives a poll and a child-graph navigation, but not a reload', async ({ page }) => {
  const ctx = await launch('parent.json');
  try {
    await stage({ graphDir: ctx.graphDir }, 'child.json', 'child.json');
    await agentPut(ctx, (g) => {
      g.explanation = 'A short account of what this parent graph shows, for the collapse-state test.';
    });

    await page.goto(pageUrl(ctx));
    await ready(page);
    assert.equal(await page.evaluate(() => window.__viewer.explainExpanded), true);
    await expect(page.locator('#explain-panel')).toHaveCount(1);

    await page.locator('#explain-toggle').click();
    assert.equal(await page.evaluate(() => window.__viewer.explainExpanded), false);

    // Survives the poll: wait past one full 1000ms cycle without touching the toggle.
    await page.waitForTimeout(1300);
    assert.equal(await page.evaluate(() => window.__viewer.explainExpanded), false);

    // Survives navigating into a child graph — child.json carries no explanation, so no panel
    // renders there, but the underlying state must not have silently reset to expanded.
    await page.locator('svg#canvas g.open-child[data-graph="child"] rect.open-child-bg').click();
    await page.waitForFunction(() => window.__viewer.graph() && window.__viewer.graph().title === 'Child');
    assert.equal(await page.evaluate(() => window.__viewer.explainExpanded), false);
    await expect(page.locator('#explain-panel')).toHaveCount(0, 'child.json has no explanation');

    // Step back to the parent (breadcrumb) to see the still-collapsed state made visible again.
    await page.locator('#breadcrumb .crumb').first().click();
    await page.waitForFunction(() => window.__viewer.graph() && window.__viewer.graph().title === 'Parent');
    assert.equal(await page.evaluate(() => window.__viewer.explainExpanded), false);
    await expect(page.locator('#explain-panel')).toHaveCount(1);
    await expect(page.locator('#explain-body')).toBeHidden();

    // Does not survive a reload.
    await page.reload();
    await ready(page);
    assert.equal(await page.evaluate(() => window.__viewer.explainExpanded), true);
    await expect(page.locator('#explain-body')).toBeVisible();
  } finally {
    await ctx.stop();
  }
});
