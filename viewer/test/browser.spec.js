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
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { test, expect } = require('@playwright/test');
const { makeDir, stage, startServer, getGraph, put, copy, sha256, ROOT } = require('./helpers/server');

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

// Like `launch`, but the graph bytes are a literal built by the caller rather than a named file
// under fixtures/ — written straight to disk before the server starts, exactly as `stage` writes
// a fixture file's bytes, so the positions given here are exactly what the page draws: no `PUT`
// runs, so `layout()` and the placement pass (`handleGraphPut`, server.js) never see this graph
// and never move a node from where it is written. Used only where the shared fixtures' existing
// geometry can't reach a case (see the G9 tests below, which need a visible group's member placed
// far from the rest of the graph's centroid with no other test's assertions riding on it).
async function launchInline(graphObj) {
  const root = await makeDir('browser-');
  const graphDir = path.join(root, 'graphs');
  await fs.mkdir(graphDir, { recursive: true });
  const graphPath = path.join(graphDir, 'inline.json');
  await fs.writeFile(graphPath, JSON.stringify(graphObj));
  return startServer({ cacheRoot: root, open: graphPath });
}

// label-crowding.json has to land on a path with nothing on it yet: that is the one route where
// the server lays a graph out itself (invents positions) rather than keeping ones already on disk,
// which is the state the label-placement search runs against. Shared by every test below that
// needs this fixture, so each gets its own fresh, isolated server the same way `launch` does.
async function launchLabelCrowding() {
  const root = await makeDir('browser-');
  const graphDir = path.join(root, 'graphs');
  await fs.mkdir(graphDir, { recursive: true });
  const ctx = await startServer({ cacheRoot: root, open: path.join(graphDir, 'crowded.json') });
  const fixture = JSON.parse(await fs.readFile(path.join(__dirname, 'fixtures', 'label-crowding.json'), 'utf8'));
  const written = await put(ctx, '/graph', fixture, '');
  assert.equal(written.status, 200, JSON.stringify(written.body));
  return { ctx, fixture };
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
// Not scoped under g.edge any more: the label lives in its own layer, appended after every edge
// group (see index.html's render()), so it is found by its own data-id instead.
function edgeLabel(page, id) { return page.locator(`svg#canvas text.edge-label[data-id="${id}"]`); }
function edgeHandle(page, id, end) {
  return page.locator(`svg#canvas g.edge[data-id="${id}"] circle.edge-handle[data-end="${end}"]`);
}
// A marked phrase in the explanation panel — a <span class="group-ref"> carrying only the group
// id (see index.html's buildExplainBody), found here rather than by its visible text since two
// different phrases could otherwise collide.
function groupRef(page, id) {
  return page.locator(`#explain-body .group-ref[data-group="${id}"]`);
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
// A graph the server has just laid out is readable before anything is dragged: no edge label sits
// on top of a node's own words. The fixture is built to crowd them — five boxes, six labelled
// arrows, one of them skipping a row so its midpoint falls where the middle row's boxes are — and
// three of its labels landed on a box before the placement search learned to look at boxes at all.
// Real Chromium and real bounding boxes, because the label's width is measured text, not a number
// the page could be asked for.
//
// Checked on .edge-label-bg, not .edge-label: the background rect is what is actually drawn over
// a box, and it is 14px wider than the text it holds (see the width assertion below) — measuring
// only the text would leave seven pixels a side unchecked on either end.
// ============================================================================================
test('a freshly laid out graph puts no edge label on top of a node box', async ({ page }) => {
  const { ctx, fixture } = await launchLabelCrowding();
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);
    const covered = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll('.node-box')].map((el) => el.getBoundingClientRect());
      return [...document.querySelectorAll('.edge-label-bg')].filter((bg) => {
        const r = bg.getBoundingClientRect();
        return boxes.some((b) => r.left < b.right - 2 && r.right > b.left + 2
          && r.top < b.bottom - 2 && r.bottom > b.top + 2);
      }).map((bg) => bg.getAttribute('data-id'));
    });
    assert.deepEqual(covered, [], 'these label backgrounds are sitting on a box');
    // The one existing assertion that would catch a measuring element (.label-metric) wearing the
    // wrong class: Playwright's all() does not filter hidden elements, so a measurer counted as
    // .edge-label would inflate this past fixture.edges.length.
    assert.equal((await page.locator('.edge-label').all()).length, fixture.edges.length);
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// The collision rectangle the placement search tests is the one actually drawn: every
// .edge-label-bg is exactly its label's measured text width plus the 14px background padding,
// never the old per-character estimate. Compared in the SVG's own local units — the bg's `width`
// attribute against the label's own getComputedTextLength() — so the page's current zoom never
// enters into it. label-crowding.json's shortest label is 21 characters, comfortably past the
// Math.max(24, ...) floor, so every label here is long enough that the floor can't mask a
// mis-measured width by coincidentally producing the same 14px difference.
// ============================================================================================
test('every edge label background is exactly its measured text width plus 14px', async ({ page }) => {
  const { ctx } = await launchLabelCrowding();
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);
    const diffs = await page.evaluate(() => {
      return [...document.querySelectorAll('.edge-label-bg')].map((bg) => {
        const id = bg.getAttribute('data-id');
        const label = document.querySelector(`text.edge-label[data-id="${id}"]`);
        const width = parseFloat(bg.getAttribute('width'));
        return { id, diff: width - (label.getComputedTextLength() + 14) };
      });
    });
    assert.ok(diffs.length > 0, 'expected at least one edge label background');
    for (const { id, diff } of diffs) {
      assert.ok(Math.abs(diff) < 1, `edge "${id}": expected bg width to be text length + 14, off by ${diff}`);
    }
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// The assertion standing for the whole change: no label is left floating with nothing tying it to
// its own arrow. Read straight off the rendered SVG's own local coordinates (the edge-line's `d`
// attribute and the edge-label-bg's x/y/width/height) rather than screen bounding boxes — a
// horizontal or vertical edge-line reports a degenerate (zero-width or zero-height)
// getBoundingClientRect in Chromium, which would make a real intersection look like a miss.
// ============================================================================================
test('every edge label on the crowding fixture touches its own line or carries a leader back to it', async ({ page }) => {
  const { ctx, fixture } = await launchLabelCrowding();
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);
    const results = await page.evaluate(() => {
      // Same clip test as index.html's rectIntersectsSegment, computed independently here against
      // the real, rendered DOM rather than by calling back into the page's own implementation.
      function intersects(rect, x1, y1, x2, y2) {
        const dx = x2 - x1, dy = y2 - y1;
        const p = [-dx, dx, -dy, dy];
        const q = [x1 - rect.x, rect.x + rect.w - x1, y1 - rect.y, rect.y + rect.h - y1];
        let tMin = 0, tMax = 1;
        for (let i = 0; i < 4; i += 1) {
          if (p[i] === 0) { if (q[i] < 0) return false; continue; }
          const t = q[i] / p[i];
          if (p[i] < 0) { if (t > tMax) return false; if (t > tMin) tMin = t; }
          else { if (t < tMin) return false; if (t < tMax) tMax = t; }
        }
        return tMin <= tMax;
      }
      return [...document.querySelectorAll('g.edge')].map((edge) => {
        const id = edge.getAttribute('data-id');
        const d = edge.querySelector('path.edge-line').getAttribute('d');
        const [, x1, y1, x2, y2] = d.match(/M([-\d.]+),([-\d.]+) L([-\d.]+),([-\d.]+)/).map(Number);
        const bg = document.querySelector(`rect.edge-label-bg[data-id="${id}"]`);
        const rect = {
          x: parseFloat(bg.getAttribute('x')), y: parseFloat(bg.getAttribute('y')),
          w: parseFloat(bg.getAttribute('width')), h: parseFloat(bg.getAttribute('height')),
        };
        const hasLeader = !!document.querySelector(`line.edge-leader[data-id="${id}"]`);
        return { id, tied: hasLeader || intersects(rect, x1, y1, x2, y2) };
      });
    });
    assert.equal(results.length, fixture.edges.length);
    for (const { id, tied } of results) {
      assert.ok(tied, `edge "${id}": label neither touches its own line nor carries a leader back to it`);
    }
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// The other half of the same guarantee, and the only test that draws a leader at all: crowd
// enough labels into one pair of rows and some of them cannot sit on their own line, which is
// exactly when a reader can no longer tell which words belong to which arrow. The dashed leader
// back to the line is what answers it. Without this fixture the leader path never runs — on the
// crowding fixture every label now lands on its own line, so none is drawn there.
// ============================================================================================
test('a label with nowhere on its own line to sit is drawn with a leader back to it', async ({ page }) => {
  const root = await makeDir('browser-');
  const graphDir = path.join(root, 'graphs');
  await fs.mkdir(graphDir, { recursive: true });
  const ctx = await startServer({ cacheRoot: root, open: path.join(graphDir, 'leaders.json') });
  try {
    const fixture = JSON.parse(await fs.readFile(path.join(__dirname, 'fixtures', 'label-leader.json'), 'utf8'));
    const written = await put(ctx, '/graph', fixture, '');
    assert.equal(written.status, 200, JSON.stringify(written.body));
    await page.goto(pageUrl(ctx));
    await ready(page);

    const leaders = await page.evaluate(() => [...document.querySelectorAll('line.edge-leader')].map((line) => {
      const id = line.getAttribute('data-id');
      const bg = document.querySelector(`rect.edge-label-bg[data-id="${id}"]`);
      const edge = document.querySelector(`g.edge[data-id="${id}"] path.edge-line`);
      const [, x1, y1, x2, y2] = edge.getAttribute('d').match(/M([-\d.]+),([-\d.]+) L([-\d.]+),([-\d.]+)/).map(Number);
      const at = (name) => parseFloat(line.getAttribute(name));
      const box = {
        x: parseFloat(bg.getAttribute('x')), y: parseFloat(bg.getAttribute('y')),
        w: parseFloat(bg.getAttribute('width')), h: parseFloat(bg.getAttribute('height')),
      };
      // Perpendicular distance from the leader's far end to the edge's own line. A leader that
      // does not land on the line it claims to point at is worse than no leader at all.
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      return {
        id,
        offLine: Math.abs((at('x2') - x1) * dy - (at('y2') - y1) * dx) / len,
        startsUnderLabel: at('x1') >= box.x && at('x1') <= box.x + box.w
          && at('y1') >= box.y && at('y1') <= box.y + box.h,
        dashes: getComputedStyle(line).strokeDasharray,
      };
    }));

    assert.ok(leaders.length > 0, 'this fixture exists to crowd at least one label off its own line');
    for (const leader of leaders) {
      assert.ok(leader.offLine < 0.5, `${leader.id}: the leader ends ${leader.offLine} away from the line it points at`);
      assert.ok(leader.startsUnderLabel, `${leader.id}: the leader should start under the label it belongs to`);
      assert.notEqual(leader.dashes, 'none', `${leader.id}: a leader is dashed, so it never reads as another arrow`);
    }
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
// Hovering a label reveals its edge's endpoint handles. This used to come free from
// `.edge:hover .edge-handle` because the label lived inside g.edge; now that it's in its own
// layer (see index.html's render()), the label has to toggle a stand-in class on the edge group
// itself on pointerenter/pointerleave, and this is the test that would catch that affordance
// silently disappearing with the move.
// ============================================================================================
test("hovering a label reveals its edge's endpoint handles", async ({ page }) => {
  const ctx = await launch('interactive.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const handle = edgeHandle(page, 'c->d', 'from');
    const opacity = () => handle.evaluate((el) => parseFloat(getComputedStyle(el).opacity));
    assert.ok((await opacity()) < 0.1, 'the handle starts hidden');

    await edgeLabel(page, 'c->d').hover();
    await expect.poll(opacity).toBeGreaterThan(0.5);

    await page.mouse.move(0, 0);
    await expect.poll(opacity).toBeLessThan(0.1);
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
// A label that needs every line the cap allows (five) but no more draws all five, plain — no
// ellipsis, no tooltip. Both escapes in the previous test are gated on labelTruncated, so a label
// that fits exactly must trip neither.
// ============================================================================================
test('a label needing all five lines draws five lines, with no ellipsis and no tooltip', async ({ page }) => {
  const root = await makeDir('browser-');
  const graphDir = path.join(root, 'graphs');
  await fs.mkdir(graphDir, { recursive: true });
  const ctx = await startServer({ cacheRoot: root, open: path.join(graphDir, 'five-lines.json') });
  try {
    const label = 'the installer renders one file this repo owns outright, and never symlinks a wrapper into either harness';
    const fixture = {
      schema: 1, title: 'Five lines', source: 'router', source_detail: 'fixture', explanation: null,
      nodes: [{ id: 'wide', label }],
      edges: [],
    };
    const written = await put(ctx, '/graph', fixture, '');
    assert.equal(written.status, 200, JSON.stringify(written.body));

    await page.goto(pageUrl(ctx));
    await ready(page);

    const lines = await page.locator('svg#canvas g.node[data-id="wide"] text.node-label').allTextContents();
    assert.equal(lines.length, 5);
    assert.equal(lines.join(' '), label.split(/\s+/).filter(Boolean).join(' '));
    assert.ok(!lines.join(' ').includes('…'), 'a label that fits exactly is never truncated');
    assert.equal(await page.locator('svg#canvas g.node[data-id="wide"] > title').count(), 0,
      'a label that fits carries no tooltip');
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// The page's five-line cap (viewer/index.html, NODE_LABEL_MAX_LINES) and the server's row pitch
// (viewer/server.js, LAYER_GAP) share no module, so nothing structural stops one moving without
// the other — this is the test that would catch it. It measures the box's real, laid-out height
// against the actual vertical distance the server put between two rows, rather than hard-coding
// either number, so it still holds if both change together and still fails if only one does.
// ============================================================================================
test('a five-line box stays shorter than the server\'s row pitch', async ({ page }) => {
  const root = await makeDir('browser-');
  const graphDir = path.join(root, 'graphs');
  await fs.mkdir(graphDir, { recursive: true });
  // PUT to a path with nothing on it yet: the one route where the server invents positions
  // (lays the graph out) rather than keeping what's on disk.
  const ctx = await startServer({ cacheRoot: root, open: path.join(graphDir, 'row-pitch.json') });
  try {
    const label = 'the installer renders one file this repo owns outright, and never symlinks a wrapper into either harness';
    const fixture = {
      schema: 1, title: 'Row pitch', source: 'router', source_detail: 'fixture', explanation: null,
      nodes: [{ id: 'top', label }, { id: 'bottom', label: 'a second row' }],
      edges: [{ id: 'top->bottom', from: 'top', to: 'bottom', label: '' }],
    };
    const written = await put(ctx, '/graph', fixture, '');
    assert.equal(written.status, 200, JSON.stringify(written.body));

    await page.goto(pageUrl(ctx));
    await ready(page);

    const laidOut = await pageGraph(page);
    const top = entry(laidOut, 'top');
    const bottom = entry(laidOut, 'bottom');
    assert.notEqual(top.y, bottom.y, 'the two nodes landed on different rows');
    const rowPitch = Math.abs(bottom.y - top.y);

    // boundingBox() is screen pixels and the row pitch is graph coordinates, so the zoom has to
    // come back out of the measurement — comparing the two directly would let an oversized box
    // pass on any graph the page opened zoomed out.
    const box = await nodeBox(page, 'top').boundingBox();
    assert.ok(box, 'the five-line box has a layout box');
    const drawnHeight = box.height / await pageZoom(page);
    assert.ok(drawnHeight < rowPitch,
      `box height ${drawnHeight} must stay under the row pitch ${rowPitch}`);
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

// ============================================================================================
// Groups: a marked phrase in the explanation — `[the refusal path](#refusal-path)` — is what a
// reader points at instead of a position word. Hovering it lights the group's nodes and every
// arrow with both ends inside it, and dims everything else. Read off the `.group-dim` class
// render() adds to everything *outside* the hovered group (index.html's renderNodeGroup /
// renderEdgeGroup), not a "lit" class of its own: the whole treatment is dimming the rest, and
// what's inside the group is simply left alone — which is also why this must never touch the
// selection: approve stays disabled throughout, since a hover that looked like a selection while
// the button stayed disabled would be a worse lie than no highlight at all.
// ============================================================================================
test('hovering a marked phrase lights the group and dims everything outside it, leaving approve disabled', async ({ page }) => {
  const ctx = await launch('groups-basic.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    await groupRef(page, 'refusal-path').hover();

    // Inside the group: never dimmed.
    await expect(page.locator('g.node[data-id="gate"].group-dim')).toHaveCount(0);
    await expect(page.locator('g.node[data-id="refuse"].group-dim')).toHaveCount(0);
    await expect(page.locator('g.edge[data-id="gate->refuse"].group-dim')).toHaveCount(0);

    // Outside the group: dimmed, including an edge with only one end inside it — groupLitSet
    // requires both ends.
    await expect(page.locator('g.node[data-id="outside"].group-dim')).toHaveCount(1);
    await expect(page.locator('g.node[data-id="far"].group-dim')).toHaveCount(1);
    await expect(page.locator('g.edge[data-id="gate->outside"].group-dim')).toHaveCount(1);
    // Its was-mark too: that dot is drawn into the label layer rather than into g.edge, so it is
    // the one piece of a dimmed edge that could stay at full brightness on its own.
    await expect(page.locator('circle.was-mark[data-id="gate->outside"].group-dim')).toHaveCount(1);

    await expect(page.locator('#approve')).toBeDisabled();

    // Transient: it goes when the pointer leaves, however it left.
    await page.mouse.move(0, 0);
    await expect(page.locator('.group-dim')).toHaveCount(0);
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// The assertion that would catch an unguarded syncExplainPanel: hovering fires a render() (to draw
// the highlight), and render() calls syncExplainPanel() first. Rebuilding the panel body on every
// one of those calls would destroy the very span the pointer is on — firing that span's own
// `pointerleave`, clearing the highlight, and re-rendering again, a loop. Proven by identity: the
// exact same DOM node before and after, not merely the same text.
// ============================================================================================
test('hovering a marked phrase does not rebuild the panel', async ({ page }) => {
  const ctx = await launch('groups-basic.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    await page.evaluate(() => {
      window.__testSpan = document.querySelector('#explain-body .group-ref[data-group="refusal-path"]');
    });

    await groupRef(page, 'refusal-path').hover();
    await expect(page.locator('g.node[data-id="gate"].group-dim')).toHaveCount(0);
    await page.mouse.move(0, 0);
    await expect(page.locator('.group-dim')).toHaveCount(0);

    const same = await page.evaluate(() =>
      document.querySelector('#explain-body .group-ref[data-group="refusal-path"]') === window.__testSpan);
    assert.ok(same, 'the marked-phrase span must survive a hover unchanged — syncExplainPanel rebuilt it');
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// Clicking a marked phrase makes the group the selection, through the existing
// effectiveSelectionIds / applyOrigin path — no separate code adds the arrow between two members.
// Approve then covers the whole option in one press, and the bulk-additive rule (already covered
// elsewhere in this file for select-all) leaves an already-ruled member exactly as it was: `refuse`
// starts `rejected` and must stay that way.
// ============================================================================================
test('clicking a marked phrase selects exactly the group, approves it, and leaves an already-ruled member untouched', async ({ page }) => {
  const ctx = await launch('groups-basic.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    await groupRef(page, 'refusal-path').click();
    assert.deepEqual(await selection(page), ['gate', 'gate->refuse', 'refuse'].sort());

    const collector = collectViewResponses(page);
    await page.locator('#approve').click();
    await expect.poll(() => collector.responses.some((r) => r.status() === 200)).toBe(true);
    collector.stop();

    const onDisk = await diskGraph(ctx);
    assert.equal(entry(onDisk, 'gate').origin, 'agreed');
    assert.equal(entry(onDisk, 'gate->refuse').origin, 'agreed');
    assert.equal(entry(onDisk, 'refuse').origin, 'rejected', 'an already-ruled member must be left untouched');
    // Neither the node outside the group nor its edge was swept in.
    assert.equal(entry(onDisk, 'outside').origin, 'proposed');
    assert.equal(entry(onDisk, 'gate->outside').origin, 'proposed');
  } finally {
    await ctx.stop();
  }
});

// A minimal graph for the two G9 tests below: a single node far from a visible group's one
// member, so fitToView zooms out to hold both and 15 zoom-in clicks (the same recipe the
// off-screen centring test above uses) pushes the far member well outside a small canvas —
// giving centreGroupIfNeeded's box argument somewhere real to matter. Built inline with
// launchInline rather than a fixtures/ file: nothing else needs this shape, and every other test
// against groups-visible.json would have its own geometry disturbed by an extra far-flung node
// changing that fixture's default fit-to-view zoom.
function farGroupGraph() {
  return {
    schema: 1,
    title: 'G9 fixture',
    source: 'code-read',
    source_detail: null,
    explanation: 'The [far group](#far-group) sits far from everything else.',
    groups: [
      { id: 'far-group', label: 'Far Group', note: 'A group placed far from the rest.', visible: true, nodes: ['far'] },
    ],
    nodes: [
      { id: 'anchor', label: 'Anchor', kind: 'step', origin: 'proposed', was: null, exclusive: false, ref: null, note: null, graph: null, x: 150, y: 150 },
      { id: 'far', label: 'Far', kind: 'step', origin: 'proposed', was: null, exclusive: false, ref: null, note: null, graph: null, x: 3000, y: 150 },
    ],
    edges: [],
  };
}

// ============================================================================================
// centreGroupIfNeeded takes a visible group's full box, header included (selectGroup,
// index.html:573) — not just its members' bounds — so a click never leaves the group's own header
// off-screen. The existing centring test above proves the *translate-only, unchanged-zoom* part
// of this gesture, but it does so on groups-basic.json, whose group carries no `visible` flag, so
// it exercises the nodesBoundingBox branch, never visibleGroupBox. It says nothing about the
// branch this test targets.
//
// The canvas is shrunk for this test alone (not the file's 2600x1300 default) because the gap
// between the two boxes' centres is a fixed 19 world units regardless of the group's size — real,
// but small enough that it only shows up as clipping against a canvas short enough for those
// pixels to matter.
// ============================================================================================
test("clicking a visible group whose header would clear the canvas by only a little brings the header fully into view", async ({ page }) => {
  const ctx = await launchInline(farGroupGraph());
  try {
    await page.setViewportSize({ width: 900, height: 620 });
    await page.goto(pageUrl(ctx));
    await ready(page);

    for (let i = 0; i < 15; i += 1) await page.locator('#zoom-in').click();
    assert.equal(await pageZoom(page), 2.5, 'expected the zoom ceiling');

    await groupRef(page, 'far-group').click();
    assert.deepEqual(await selection(page), ['far']);

    const canvasBox = await page.locator('svg#canvas').boundingBox();
    const headerBox = await page.locator('g.group-header[data-group="far-group"] rect.group-header-hit').boundingBox();
    assert.ok(headerBox.y >= canvasBox.y - 1,
      `expected the group's header fully below the canvas top after centring, got header.y=${headerBox.y} canvas.y=${canvasBox.y}`);
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// fitToView bounds itself against every visible group's box, not just node bounds (index.html,
// fitToView, `:652-659`), so a graph opening at fit shows whole boundaries rather than clipping a
// header sitting at the picture's edge. `far-group`'s member is the topmost thing in this graph,
// so its header — 62 world units above the member (GROUP_PAD + GROUP_HEADER) — is the very top of
// the content fitToView has to fit. Loaded fresh, with no click and no zoom: fitToView alone has
// to get this right.
//
// The viewport and the member's y are tuned deliberately, not arbitrary: fitToView's own margin
// is 60px, one world unit short of the header's 62-unit offset, so a correct fit always lands the
// header at exactly +60 (see the comment on the assertion below) while dropping the group box
// from the bound can clip it by at most 2px — a real gap, just a narrow one baked into how close
// those two constants already sit, not something a wider fixture could open up further. The
// numbers here put the node bbox's own fit just past 1:1 zoom so that ceiling is the one in play.
// ============================================================================================
test("a graph opening at fit shows a visible group's header whole, not clipped at the edge", async ({ page }) => {
  const graphObj = farGroupGraph();
  graphObj.explanation = null;
  graphObj.nodes[1].x = 150; // no longer "far": here the point is the header's position, not off-screen centring
  graphObj.nodes[1].y = -309; // the topmost thing in the graph, well above 'anchor' (see comment above)
  const ctx = await launchInline(graphObj);
  try {
    await page.setViewportSize({ width: 900, height: 700 });
    await page.goto(pageUrl(ctx));
    await ready(page);

    const canvasBox = await page.locator('svg#canvas').boundingBox();
    const headerBox = await page.locator('g.group-header[data-group="far-group"] rect.group-header-hit').boundingBox();
    // Correct fitToView lands the header exactly at the 60px margin from the canvas top; dropping
    // the group-box bound instead fits the node alone and clips the header by up to 2px above it.
    assert.ok(headerBox.y >= canvasBox.y - 1,
      `expected the group's header inside the viewport on load, got header.y=${headerBox.y} canvas.y=${canvasBox.y}`);
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// Clicking a group with a member off-screen brings it into view by translating only — the scale
// never changes. Zoomed to the ceiling first so the far group's one member lands well outside the
// canvas; the assertion that matters is that the zoom level is identical before and after, which
// is what distinguishes "moved into view" from "zoomed to fit."
// ============================================================================================
test('clicking a group with a member off-screen brings it into view without changing zoom', async ({ page }) => {
  const ctx = await launch('groups-basic.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    for (let i = 0; i < 15; i += 1) await page.locator('#zoom-in').click();
    const zoomBefore = await pageZoom(page);
    assert.equal(zoomBefore, 2.5, 'expected the zoom ceiling');

    const canvasBox = await page.locator('svg#canvas').boundingBox();
    let farBox = await nodeBox(page, 'far').boundingBox();
    const offScreen = farBox.x + farBox.width < canvasBox.x || farBox.x > canvasBox.x + canvasBox.width
      || farBox.y + farBox.height < canvasBox.y || farBox.y > canvasBox.y + canvasBox.height;
    assert.ok(offScreen, 'expected "far" to start outside the canvas at this zoom');

    await groupRef(page, 'distant-alternative').click();
    assert.deepEqual(await selection(page), ['far']);

    assert.equal(await pageZoom(page), zoomBefore, 'the scale must not change');
    farBox = await nodeBox(page, 'far').boundingBox();
    assert.ok(
      farBox.x >= canvasBox.x - 1 && farBox.x + farBox.width <= canvasBox.x + canvasBox.width + 1
        && farBox.y >= canvasBox.y - 1 && farBox.y + farBox.height <= canvasBox.y + canvasBox.height + 1,
      `expected "far" fully inside the canvas after the click, got box=${JSON.stringify(farBox)}, canvas=${JSON.stringify(canvasBox)}`,
    );
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// The assertion that catches members captured at span-build time, or a rebuild guard keyed on the
// prose alone: an agent redraw changes a group's `nodes` while the explanation string stays
// byte-identical, and both the hover and the click have to follow the new membership, not the one
// that existed when the marked-phrase span was created. Driven the way the existing poll tests do
// — write a new version of the graph through the server (as an agent would) and let the page's
// poll pick it up, never through the page itself.
// ============================================================================================
test("a redraw that changes a group's nodes while the explanation stays byte-identical relights and rules the new membership", async ({ page }) => {
  const ctx = await launch('groups-basic.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);
    const explanationBefore = (await pageGraph(page)).explanation;

    await agentPut(ctx, (g) => {
      const group = g.groups.find((gr) => gr.id === 'refusal-path');
      group.nodes = ['gate', 'other']; // drops 'refuse', adds 'other' — the prose is untouched
    });

    // The page polls every 1000ms; give it a full cycle to pick up the new hash.
    await expect.poll(async () => {
      const g = await pageGraph(page);
      return g.groups.find((gr) => gr.id === 'refusal-path').nodes;
    }, { timeout: 3000 }).toEqual(['gate', 'other']);
    assert.equal((await pageGraph(page)).explanation, explanationBefore, 'the prose must stay byte-identical');

    await groupRef(page, 'refusal-path').hover();
    await expect(page.locator('g.node[data-id="gate"].group-dim')).toHaveCount(0);
    await expect(page.locator('g.node[data-id="other"].group-dim')).toHaveCount(0);
    await expect(page.locator('g.edge[data-id="gate->other"].group-dim')).toHaveCount(0);
    // The dropped member is outside the group now and dims like anything else outside it.
    await expect(page.locator('g.node[data-id="refuse"].group-dim')).toHaveCount(1);
    await page.mouse.move(0, 0);

    await groupRef(page, 'refusal-path').click();
    assert.deepEqual(await selection(page), ['gate', 'gate->other', 'other'].sort());

    const collector = collectViewResponses(page);
    await page.locator('#approve').click();
    await expect.poll(() => collector.responses.some((r) => r.status() === 200)).toBe(true);
    collector.stop();

    const onDisk = await diskGraph(ctx);
    assert.equal(entry(onDisk, 'gate').origin, 'agreed');
    assert.equal(entry(onDisk, 'other').origin, 'agreed');
    assert.equal(entry(onDisk, 'gate->other').origin, 'agreed');
    // 'refuse' left the group and was never selected — its pre-existing verdict is untouched.
    assert.equal(entry(onDisk, 'refuse').origin, 'rejected');
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// The reference grammar (GROUP_REFERENCE_RE) is parsed independently on the server (validation)
// and here (marking up spans) — this is the only test pinning the two to the same answer. A
// non-`#` markdown link, `[the docs](docs/readme.md)`, does not match it (a reference needs a
// `#id` target), so it must render as its own literal brackets and parens, not vanish into a dead
// marked phrase.
// ============================================================================================
test('the page renders a non-# markdown link as plain text, not a marked phrase', async ({ page }) => {
  const ctx = await launch('groups-basic.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const body = await page.locator('#explain-body').textContent();
    assert.ok(body.includes('[the docs](docs/readme.md)'), `expected the literal link text, got: ${body}`);

    // Exactly the two real references became marked phrases — the non-# link did not become a
    // third one.
    await expect(page.locator('#explain-body .group-ref')).toHaveCount(2);
    assert.equal(await page.locator('#explain-body .group-ref[data-group="refusal-path"]').textContent(), 'the refusal path');
    assert.equal(await page.locator('#explain-body .group-ref[data-group="distant-alternative"]').textContent(), 'the distant alternative');
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// Visible groups (docs/plans/group-boxes/PLAN.md): a group carrying `visible: true` is drawn as a
// named boundary around its members. Nine assertions below cover it, against groups-visible.json
// except the first, which builds its own graph — see that test's own comment for why.
// ============================================================================================

// ============================================================================================
// The drift assertion — decision 17's whole reason to exist. viewer/server.js and
// viewer/index.html each hold their own copy of GROUP_PAD / GROUP_HEADER / GROUP_GAP, sharing no
// module, so nothing structural stops one moving without the other. This measures a graph the
// SERVER laid out against the boundary the PAGE draws for it — not a fixture staged straight to
// disk, which would only ever compare the page against itself (decision 29; the pattern to copy
// is the row-pitch test above, at the layout constants).
//
// It needs two `PUT /graph` writes, not one. A single PUT to an empty path is a create, and on a
// create every changed group is in resident mode with only free nodes moving (decision 39) — but a
// create's positions come out of layout(), which this test cannot hand-pick, so there would be no
// way to build "exactly one non-member is pushed" on purpose. So: the first PUT creates the graph
// with the group absent, so its members are ordinary new nodes; a `PUT /view` — a plain drag, the
// same thing a person does to arrange a picture — then plants the members and the intruder at
// exact, known coordinates; the second PUT /graph adds the group as visible over those on-disk
// positions, which is resident mode and pushes the intruder clear. The push itself is computed by
// the server's real placeGroupUnits pass, not by this test.
//
// The fixture is built so the push is exactly one non-member, and horizontal. The server models
// every node as 200x116 while the page draws its real height (74 for a one-line label), so the two
// only ever agree on the left, right and top edges — a downward push would render at
// GROUP_GAP + (116 - 74) off from what an exact assertion expects, failing against *correct* code.
// The intruder sits at x=180, barely overlapping the two-member block's right edge (at x=224) and
// far from its top or bottom, so "move right by the smallest amount that clears" beats every other
// direction by a wide margin (60 vs 156/194/420 — down, up, left).
// ============================================================================================
test('a visible group pushes exactly one non-member clear, at exactly GROUP_GAP, in the direction both files must agree on', async ({ page }) => {
  const GROUP_GAP = 16;
  const root = await makeDir('browser-');
  const graphDir = path.join(root, 'graphs');
  await fs.mkdir(graphDir, { recursive: true });
  const ctx = await startServer({ cacheRoot: root, open: path.join(graphDir, 'group-drift.json') });
  try {
    // 1. Create: the group is absent, so 'm', 'm2' and 'x' are all ordinary new nodes.
    const created = {
      schema: 1, title: 'Group drift', source: 'router', source_detail: null, explanation: null,
      nodes: [{ id: 'm', label: 'M' }, { id: 'm2', label: 'M2' }, { id: 'x', label: 'X' }],
      edges: [],
    };
    let written = await put(ctx, '/graph', created, '');
    assert.equal(written.status, 200, JSON.stringify(written.body));

    // 2. Drag: plant 'm'/'m2' as a 200-wide, two-row block and 'x' overlapping its right edge.
    const dragged = (await getGraph(ctx)).graph;
    for (const [id, point] of [['m', { x: 0, y: 0 }], ['m2', { x: 0, y: 140 }], ['x', { x: 180, y: 0 }]]) {
      Object.assign(dragged.nodes.find((n) => n.id === id), point);
    }
    written = await put(ctx, '/view', dragged, written.body.hash);
    assert.equal(written.status, 200, JSON.stringify(written.body));

    // 3. Make the group visible over the on-disk members: resident mode, which pushes 'x'.
    const grouped = copy(dragged);
    grouped.groups = [{ id: 'sys', label: 'System', note: 'A note about the system.', visible: true, nodes: ['m', 'm2'] }];
    written = await put(ctx, '/graph', grouped, written.body.hash);
    assert.equal(written.status, 200, JSON.stringify(written.body));

    await page.goto(pageUrl(ctx));
    await ready(page);

    const laidOut = await pageGraph(page);
    assert.equal(entry(laidOut, 'm').x, 0); assert.equal(entry(laidOut, 'm').y, 0);
    assert.equal(entry(laidOut, 'm2').x, 0); assert.equal(entry(laidOut, 'm2').y, 140);
    assert.notEqual(entry(laidOut, 'x').x, 180, 'the intruder must actually have moved');
    assert.equal(entry(laidOut, 'x').y, 0, 'the push must be horizontal, not vertical');

    // Every member's real box sits inside the rendered boundary; the intruder's does not.
    const zoom = await pageZoom(page);
    const boundaryEl = page.locator('rect.group-region[data-group="sys"]');
    const boundary = await boundaryEl.boundingBox();
    for (const id of ['m', 'm2']) {
      const box = await nodeBox(page, id).boundingBox();
      assert.ok(box.x >= boundary.x && box.x + box.width <= boundary.x + boundary.width &&
        box.y >= boundary.y && box.y + box.height <= boundary.y + boundary.height,
        `${id}'s box must sit inside the rendered boundary`);
    }
    const xLocator = nodeBox(page, 'x');
    const xBox = await xLocator.boundingBox();
    assert.ok(xBox.x > boundary.x + boundary.width, 'the intruder must render clear of the boundary, not inside it');

    // The exact distance. getBoundingClientRect() on an SVG shape includes half its own
    // stroke-width past its geometric edge on every side (measured directly: a 1px-stroke boundary
    // and a 1.5px-stroke node box together read exactly 1.25 local units short of the true gap at
    // zoom 1) — corrected out here, from the elements' own computed styles, rather than papered
    // over with a loose epsilon, so the comparison below is still exact.
    const boundaryStroke = await boundaryEl.evaluate((el) => parseFloat(getComputedStyle(el).strokeWidth));
    const xStroke = await xLocator.evaluate((el) => parseFloat(getComputedStyle(el).strokeWidth));
    const rawDistance = (xBox.x - (boundary.x + boundary.width)) / zoom;
    const distance = rawDistance + boundaryStroke / 2 + xStroke / 2;
    assert.ok(Math.abs(distance - GROUP_GAP) < 0.05,
      `expected the intruder exactly GROUP_GAP (${GROUP_GAP}) past the boundary, got ${distance}`);

    // The horizontal distance above moves when either file's GROUP_PAD does, but GROUP_HEADER only
    // ever changes the box's top edge, so nothing above would notice it drifting. The top is the
    // one vertical edge that *is* exactly assertable: the server's 116px node model and the page's
    // real height disagree only on the bottom. Same stroke correction, opposite sign — here both
    // rects grow toward each other rather than apart.
    const GROUP_PAD = 24, GROUP_HEADER = 38;
    const topMember = await nodeBox(page, 'm').boundingBox();
    const topGap = (topMember.y - boundary.y) / zoom + xStroke / 2 - boundaryStroke / 2;
    assert.ok(Math.abs(topGap - (GROUP_PAD + GROUP_HEADER)) < 0.05,
      `expected the boundary exactly GROUP_PAD + GROUP_HEADER (${GROUP_PAD + GROUP_HEADER}) above its topmost member, got ${topGap}`);
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// A name or note too long for the box is cut with the same ellipsis a node label uses, at its own
// size — 13px for the name, 11 for the note (decision 27) — and the header's <title> carries both
// strings in full, since the drawn text alone no longer says everything once it is cut.
// ============================================================================================
test('a group name and note too long for the box are cut, and the header tooltip carries both in full', async ({ page }) => {
  const ctx = await launch('groups-visible.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const graph = await pageGraph(page);
    const group = graph.groups.find((g) => g.id === 'alpha-group');
    const labelEl = page.locator('g.group-header[data-group="alpha-group"] text.group-header-label');
    const noteEl = page.locator('g.group-header[data-group="alpha-group"] text.group-header-note');
    const drawnLabel = await labelEl.textContent();
    const drawnNote = await noteEl.textContent();

    assert.ok(drawnLabel.endsWith('…'), `expected the label to be cut, got ${JSON.stringify(drawnLabel)}`);
    assert.ok(drawnLabel.length < group.label.length, 'the drawn label must be shorter than the source');
    assert.ok(drawnNote.endsWith('…'), `expected the note to be cut, got ${JSON.stringify(drawnNote)}`);
    assert.ok(drawnNote.length < group.note.length, 'the drawn note must be shorter than the source');

    assert.equal(await labelEl.evaluate((el) => getComputedStyle(el).fontSize), '13px');
    assert.equal(await noteEl.evaluate((el) => getComputedStyle(el).fontSize), '11px');

    const title = await page.locator('g.group-header[data-group="alpha-group"] rect.group-header-hit > title').textContent();
    assert.ok(title.includes(group.label), 'the tooltip must carry the whole label');
    assert.ok(title.includes(group.note), 'the tooltip must carry the whole note');
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// Clicking a header selects exactly its members and enables approve, driven through a real
// pointer gesture — locator.click() dispatches actual pointerdown/pointerup — which is what proves
// the header's own stopPropagation + self setPointerCapture path (decision 34) actually works
// against the svg's own setPointerCapture (:1441/:1650 above). A call through window.__viewer or a
// dispatched synthetic event would never touch that path at all.
// ============================================================================================
// ============================================================================================
// The hit rect is drawn `fill: none` and sized to the two drawn strings, not the full width of
// the box (decision 24 / the plan's `renderGroupHeader`) — a worker left to guess ships either a
// black bar across the picture (no `fill: none`) or a rect stretched to the box's own width. The
// click test above already guards against the dead-target failure (`pointer-events: all` missing
// entirely would fail it); this guards the other two ways the header can visibly go wrong.
// beta-group's two-word label and short note leave most of its 648px-wide box empty, so a hit
// rect stretched to the box would be trivially distinguishable from one sized to the text.
// ============================================================================================
test('the header hit rect is invisible and sized to its text, not the full box', async ({ page }) => {
  const ctx = await launch('groups-visible.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const hitRect = page.locator('g.group-header[data-group="beta-group"] rect.group-header-hit');
    const fill = await hitRect.evaluate((el) => getComputedStyle(el).fill);
    assert.equal(fill, 'none', `expected the hit rect to paint nothing, got fill=${fill}`);

    const hitBox = await hitRect.boundingBox();
    const boundaryBox = await page.locator('rect.group-region[data-group="beta-group"]').boundingBox();
    assert.ok(hitBox.width < boundaryBox.width * 0.6,
      `expected the hit rect meaningfully narrower than the group's boundary, got hit=${hitBox.width} boundary=${boundaryBox.width}`);
  } finally {
    await ctx.stop();
  }
});

test('clicking a group header selects exactly its members and enables approve', async ({ page }) => {
  const ctx = await launch('groups-visible.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    await page.locator('g.group-header[data-group="beta-group"] rect.group-header-hit').click();
    assert.deepEqual(await selection(page), ['beta1', 'beta2'].sort());
    await expect(page.locator('#approve')).toBeEnabled();
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// locator.click() presses and releases on the same element, so it fires pointerup there whether
// or not the header actually takes its own setPointerCapture — it cannot tell the capture apart
// from an accident of geometry. This drives the two ends of the gesture separately: press on the
// header, move well away — here, over 'alpha' in a different group entirely — and release there.
// Without `hitRect.setPointerCapture` (attachGroupHeaderGesture), the svg's own pointerdown
// handler would have taken capture instead (it runs first on any target that isn't `.node` or
// `.edge`, unless stopPropagation heads it off), retargeting this release to the svg's own
// pointerup, which runs finishMarquee and clears the selection instead of selecting the group.
// ============================================================================================
test('pressing a group header and releasing away from it still selects the group', async ({ page }) => {
  const ctx = await launch('groups-visible.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const headerCenter = await center(page.locator('g.group-header[data-group="beta-group"] rect.group-header-hit'));
    const farPoint = await center(nodeBox(page, 'alpha'));

    await page.mouse.move(headerCenter.x, headerCenter.y);
    await page.mouse.down();
    await page.mouse.move(farPoint.x, farPoint.y, { steps: 8 });
    await page.mouse.up();

    assert.deepEqual(await selection(page), ['beta1', 'beta2'].sort(),
      'the header must take its own pointer capture, so its own pointerup still fires wherever the pointer was released');
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// The boundary rect takes no pointer events at all (decision 24) — its interior stays fully open
// to a marquee. Started just left of 'beta1' and just below both members: inside the group's
// GROUP_PAD margin, on no node and on no header, so this pointerdown must fall through to the
// svg's own handler and box-select normally.
// ============================================================================================
test('a marquee started on empty canvas inside a group boundary still box-selects', async ({ page }) => {
  const ctx = await launch('groups-visible.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const beta1Box = await nodeBox(page, 'beta1').boundingBox();
    const beta2Box = await nodeBox(page, 'beta2').boundingBox();
    const x0 = beta1Box.x - 10;
    const y0 = beta1Box.y + beta1Box.height + 5;
    const x1 = beta2Box.x + beta2Box.width + 10;
    const y1 = beta1Box.y - 10;

    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.mouse.move(x1, y1, { steps: 6 });
    await page.mouse.up();

    assert.deepEqual(await selection(page), ['beta1', 'beta2'].sort());
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// Paint order, not geometry: every boundary rect must precede every node, edge and label in
// *document* order inside root. Checked on order rather than geometry because the geometric form
// is false by construction — a boundary contains its own members, and an edge from a member to a
// non-member must cross it.
//
// The header layer gets the same treatment: it is appended after every edge and before the label
// layer (the plan's "Drawing it" section), so a group's words are never buried under the graph
// drawn over them, and an edge label is never buried under a header either. Checking only that
// boundaries precede nodes/edges/labels (as this test used to) says nothing about where the
// header layer itself lands — moving `root.appendChild(headerLayer)` earlier, ahead of the edge
// loop, would leave every one of those assertions passing.
// ============================================================================================
test('every group boundary precedes every node, edge and label, and every header follows every edge and precedes every label, in document order', async ({ page }) => {
  const ctx = await launch('groups-visible.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const order = await page.evaluate(() => {
      const root = document.querySelector('svg#canvas > g');
      const all = [...root.querySelectorAll('*')];
      const lastIndexOfAny = (selector) => {
        let last = -1;
        all.forEach((el, i) => { if (el.matches(selector)) last = i; });
        return last;
      };
      const firstIndexOfAny = (selector) => all.findIndex((el) => el.matches(selector));
      return {
        lastBoundary: lastIndexOfAny('rect.group-region'),
        firstNode: firstIndexOfAny('g.node'),
        firstEdge: firstIndexOfAny('g.edge'),
        lastEdge: lastIndexOfAny('g.edge'),
        firstLabel: firstIndexOfAny('text.edge-label'),
        firstHeader: firstIndexOfAny('g.group-header'),
        lastHeader: lastIndexOfAny('g.group-header'),
      };
    });
    assert.ok(order.lastBoundary >= 0, 'expected at least one boundary rect');
    assert.ok(order.lastBoundary < order.firstNode, 'every boundary must precede every node');
    assert.ok(order.lastBoundary < order.firstEdge, 'every boundary must precede every edge');
    assert.ok(order.lastBoundary < order.firstLabel, 'every boundary must precede every label');

    assert.ok(order.firstHeader >= 0, 'expected at least one header');
    assert.ok(order.lastEdge < order.firstHeader, 'every header must follow every edge');
    assert.ok(order.lastHeader < order.firstLabel, 'every header must precede every label');
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// An edge label that would land on a group's header is displaced clear of it — header hit rects
// are seeded into labelRects before the edge loop runs (decision 37), so the search's very first
// candidate (the plain segment midpoint) rejects a spot on the header and moves to the next one.
// 'edge-above' and 'edge-below' (groups-visible.json) sit far apart on a vertical line whose
// midpoint falls inside 'alpha-group's header, with nothing else nearby — room to displace into.
// Asserted this way deliberately: the search's last resort is that same midpoint regardless of any
// collision, so avoidance only proves anything against a fixture where a clear spot actually
// exists nearby, never against a crowded one where landing on the header could be coincidence.
// ============================================================================================
test("an edge label that would land on a group's header is displaced clear of it", async ({ page }) => {
  const ctx = await launch('groups-visible.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const headerHit = await page.locator('g.group-header[data-group="alpha-group"] rect.group-header-hit').boundingBox();
    const labelBox = await page.locator('text.edge-label[data-id="edge-above->edge-below"]').boundingBox();

    const overlaps = labelBox.x < headerHit.x + headerHit.width && labelBox.x + labelBox.width > headerHit.x &&
      labelBox.y < headerHit.y + headerHit.height && labelBox.y + labelBox.height > headerHit.y;
    assert.ok(!overlaps,
      `expected the label displaced clear of the header, got label=${JSON.stringify(labelBox)} header=${JSON.stringify(headerHit)}`);
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// Hovering a header changes the cursor and lifts the boundary's stroke, but never sets
// hoveredGroupId and never dims anything — the drawn box already shows its members, so dimming
// here would only flicker as the pointer crosses it. Hovering the marked phrase for the *same*
// group is a different trigger doing a different job, covered above (groups-basic.json,
// "hovering a marked phrase lights the group..."), which this test leaves untouched and passing.
// ============================================================================================
test('hovering a group header dims nothing, and lifts the boundary stroke until the pointer leaves', async ({ page }) => {
  const ctx = await launch('groups-visible.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const boundary = page.locator('rect.group-region[data-group="alpha-group"]');
    const strokeWidthOf = () => boundary.evaluate((el) => getComputedStyle(el).strokeWidth);
    const before = await strokeWidthOf();

    await page.locator('g.group-header[data-group="alpha-group"] rect.group-header-hit').hover();
    await expect(page.locator('.group-dim')).toHaveCount(0);
    const during = await strokeWidthOf();
    assert.notEqual(during, before, `expected the boundary's stroke to change on hover, stayed at ${before}`);

    await page.mouse.move(0, 0);
    const after = await strokeWidthOf();
    assert.equal(after, before, `expected the boundary's stroke to return to ${before} once the pointer left, got ${after}`);
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// Hovering a marked phrase dims every *other* visible group's boundary and header, not just nodes
// and edges — the same treatment those already get, extended to the two new layers — and leaves
// the hovered group's own boundary and header plain.
// ============================================================================================
test('hovering a marked phrase dims every other visible group, leaving its own boundary and header plain', async ({ page }) => {
  const ctx = await launch('groups-visible.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    await groupRef(page, 'alpha-group').hover();

    await expect(page.locator('rect.group-region[data-group="alpha-group"].group-dim')).toHaveCount(0);
    await expect(page.locator('g.group-header[data-group="alpha-group"].group-dim')).toHaveCount(0);

    await expect(page.locator('rect.group-region[data-group="beta-group"].group-dim')).toHaveCount(1);
    await expect(page.locator('g.group-header[data-group="beta-group"].group-dim')).toHaveCount(1);

    // The class alone proves nothing (decision 42): adding `group-dim` is a no-op until the CSS
    // selector list at index.html's .group-dim rule actually names these two layers. Read the
    // rendered effect instead — the hovered group's boundary and header must stay at full opacity,
    // every other visible group's must be measurably reduced.
    const opacityOf = (locator) => locator.evaluate((el) => getComputedStyle(el).opacity);
    const alphaRegionOpacity = await opacityOf(page.locator('rect.group-region[data-group="alpha-group"]'));
    const alphaHeaderOpacity = await opacityOf(page.locator('g.group-header[data-group="alpha-group"]'));
    const betaRegionOpacity = await opacityOf(page.locator('rect.group-region[data-group="beta-group"]'));
    const betaHeaderOpacity = await opacityOf(page.locator('g.group-header[data-group="beta-group"]'));

    assert.equal(alphaRegionOpacity, '1', `expected the hovered group's boundary at full opacity, got ${alphaRegionOpacity}`);
    assert.equal(alphaHeaderOpacity, '1', `expected the hovered group's header at full opacity, got ${alphaHeaderOpacity}`);
    assert.ok(Number(betaRegionOpacity) < 1, `expected the other group's boundary dimmed, got opacity ${betaRegionOpacity}`);
    assert.ok(Number(betaHeaderOpacity) < 1, `expected the other group's header dimmed, got opacity ${betaHeaderOpacity}`);

    await page.mouse.move(0, 0);
    await expect(page.locator('.group-dim')).toHaveCount(0);
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// measureLabelWidth is keyed on size and text together (decision 27): the same string must come
// back genuinely larger at 13px than at 11 — the assertion that catches the size being applied as
// a presentation attribute .label-metric's own CSS rule would silently override — and measuring it
// at 13 must not change what an edge label carrying that same string gets back at 11. The calls
// are ordered 11, 13, 11 so a cache keyed on text alone (poisoned by the 13px call) would show up
// on the second 11px read, not just fail to appear on the first.
// ============================================================================================
test('measureLabelWidth is keyed on size, not just text', async ({ page }) => {
  const ctx = await launch('groups-visible.json');
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const text = 'a shared label string';
    const first11 = await page.evaluate((t) => window.__viewer.measureLabelWidth(t, 11), text);
    const at13 = await page.evaluate((t) => window.__viewer.measureLabelWidth(t, 13), text);
    const second11 = await page.evaluate((t) => window.__viewer.measureLabelWidth(t, 11), text);

    assert.ok(at13 > first11, `expected 13px to measure wider than 11px, got ${at13} vs ${first11}`);
    assert.equal(second11, first11, 'measuring at 13 must not poison the 11px cache entry for the same string');
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// Which face an arrow meets, and where on it (docs/plans/how-a-graph-reads/PLAN.md §3). Every
// graph below is built inline with launchInline and explicit positions, the same reason the G9
// fixture above is: nothing in fixtures/ needs this exact shape, and layout() never runs over an
// inline graph, so the positions written here are exactly what the page draws.
//
// A minimal node or edge, filled out to the shape validateGraph expects (see groups-basic.json
// for the full field list) — only `id`, `x` and `y` vary from one call to the next, since no test
// below reads a label, kind or origin.
function faceNode(id, x, y) {
  return {
    id, label: id, kind: 'step', origin: 'proposed', was: null,
    exclusive: false, ref: null, note: null, graph: null, x, y,
  };
}
function faceEdge(id, from, to) {
  return { id, from, to, label: id, kind: 'sequence', value: null, inferred: false, origin: 'proposed', was: null, note: null };
}
function faceGraph(nodes, edges) {
  return { schema: 1, title: 'Face geometry fixture', source: 'code-read', source_detail: null, explanation: null, groups: [], nodes, edges };
}

// Read straight off the rendered SVG, the same way the label-crowding test above does: an edge's
// two endpoints from its path's `d`, a node's box from its group's own translate and its
// rect.node-box's width/height (not from the graph's x/y and a re-derived height, which would
// just be asserting nodeHeight against itself).
async function edgeGeom(page, id) {
  return page.evaluate((edgeId) => {
    const line = document.querySelector(`g.edge[data-id="${edgeId}"] path.edge-line`);
    const [, x1, y1, x2, y2] = line.getAttribute('d').match(/M([-\d.]+),([-\d.]+) L([-\d.]+),([-\d.]+)/).map(Number);
    return { x1, y1, x2, y2 };
  }, id);
}
async function nodeBoxGeom(page, id) {
  return page.evaluate((nodeId) => {
    const g = document.querySelector(`g.node[data-id="${nodeId}"]`);
    const [, x, y] = g.getAttribute('transform').match(/translate\(([-\d.]+),([-\d.]+)\)/).map(Number);
    const rect = g.querySelector('rect.node-box');
    return { x, y, w: parseFloat(rect.getAttribute('width')), h: parseFloat(rect.getAttribute('height')) };
  }, id);
}

// ============================================================================================
// The forward case: a step that carries the flow down the page leaves the source's bottom edge
// and lands on the target's top edge, each anchor ANCHOR_CLEAR (4) outside the box it belongs to
// — the same clearance rectExit already kept. Neither node has a second edge on the face in
// question, so slotting contributes no offset and the line runs straight down the shared centre.
// ============================================================================================
test("a forward arrow's endpoints sit ANCHOR_CLEAR outside the source's bottom edge and the target's top edge", async ({ page }) => {
  const ctx = await launchInline(faceGraph(
    [faceNode('a', 0, 0), faceNode('b', 0, 140)],
    [faceEdge('a->b', 'a', 'b')],
  ));
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const { x1, y1, x2, y2 } = await edgeGeom(page, 'a->b');
    const a = await nodeBoxGeom(page, 'a');
    const b = await nodeBoxGeom(page, 'b');

    assert.equal(x1, a.x + a.w / 2, 'the source anchor sits centred on the bottom face');
    assert.equal(y1, a.y + a.h + 4, 'the source anchor sits 4px below the bottom edge');
    assert.equal(x2, b.x + b.w / 2, 'the target anchor sits centred on the top face');
    assert.equal(y2, b.y - 4, 'the target anchor sits 4px above the top edge');
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// A back edge — here, from a lower-right box to an upper-left one — is not a step forward, so it
// never takes the bottom-top pair. With the two boxes' x-ranges disjoint (a: x400-600, b: x0-200),
// the facing sides pass cleanly and there is nothing to push it further down the preference list.
// ============================================================================================
test('a back edge between two horizontally separated boxes uses the side faces', async ({ page }) => {
  const ctx = await launchInline(faceGraph(
    [faceNode('a', 400, 300), faceNode('b', 0, 0)],
    [faceEdge('a->b', 'a', 'b')],
  ));
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const { x1, y1, x2, y2 } = await edgeGeom(page, 'a->b');
    const a = await nodeBoxGeom(page, 'a');
    const b = await nodeBoxGeom(page, 'b');

    // A side face keeps the box's vertical centre; only a top or bottom face would move y off it.
    assert.equal(y1, a.y + a.h / 2, "the source anchor sits on a's vertical centre — a side face");
    assert.equal(y2, b.y + b.h / 2, "the target anchor sits on b's vertical centre — a side face");
    assert.ok(x1 === a.x - 4 || x1 === a.x + a.w + 4, `expected the source anchor on a's left or right face, got x=${x1}`);
    assert.ok(x2 === b.x - 4 || x2 === b.x + b.w + 4, `expected the target anchor on b's left or right face, got x=${x2}`);
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// The same back edge, but with the two boxes' x-ranges overlapping (a: x0-200, b: x50-250) rather
// than disjoint. The facing sides and the same flank would each draw straight through one of the
// two boxes, so the preference list falls all the way to top-to-bottom, the one candidate left
// that clears both — the shape a fresh three-cycle layout produces for a back edge.
// ============================================================================================
test('a back edge between two boxes whose x-ranges overlap uses top-to-bottom instead, because the sides would cross a box', async ({ page }) => {
  const ctx = await launchInline(faceGraph(
    [faceNode('a', 0, 300), faceNode('b', 50, 0)],
    [faceEdge('a->b', 'a', 'b')],
  ));
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const { x1, y1, x2, y2 } = await edgeGeom(page, 'a->b');
    const a = await nodeBoxGeom(page, 'a');
    const b = await nodeBoxGeom(page, 'b');

    assert.equal(x1, a.x + a.w / 2, "the source anchor sits centred on a's top face");
    assert.equal(y1, a.y - 4, "the source anchor sits 4px above a's top edge");
    assert.equal(x2, b.x + b.w / 2, "the target anchor sits centred on b's bottom face");
    assert.equal(y2, b.y + b.h + 4, "the target anchor sits 4px below b's bottom edge");
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// The headline guard: over every graph committed to the repo — not one chosen pair — no rendered
// arrow's straight line passes through either box it connects. `git ls-files` rather than a
// hardcoded list, so a graph added by a later plan is covered automatically. Each file is copied
// into its own scratch server the same way `stage` copies a fixtures/ file, since `stage` itself
// only reaches into viewer/test/fixtures.
// ============================================================================================
test("no drawn arrow's line passes through either box it connects, over every committed graph", async ({ page }) => {
  const files = execFileSync('git', ['ls-files', 'docs/plans/*/graphs/*.json'], { cwd: ROOT })
    .toString().split('\n').filter(Boolean);
  assert.ok(files.length > 0, 'expected at least one committed graph to check');

  for (const file of files) {
    const root = await makeDir('browser-');
    const graphDir = path.join(root, 'graphs');
    await fs.mkdir(graphDir, { recursive: true });
    const graphPath = path.join(graphDir, path.basename(file));
    await fs.copyFile(path.join(ROOT, file), graphPath);
    const ctx = await startServer({ cacheRoot: root, open: graphPath });
    try {
      await page.goto(pageUrl(ctx));
      await ready(page);

      const crossings = await page.evaluate(() => {
        // Same Liang-Barsky clip test as index.html's rectIntersectsSegment, computed
        // independently against the real, rendered DOM rather than by calling back into the
        // page's own implementation.
        function intersects(rect, x1, y1, x2, y2) {
          const dx = x2 - x1, dy = y2 - y1;
          const p = [-dx, dx, -dy, dy];
          const q = [x1 - rect.x, rect.x + rect.w - x1, y1 - rect.y, rect.y + rect.h - y1];
          let tMin = 0, tMax = 1;
          for (let i = 0; i < 4; i += 1) {
            if (p[i] === 0) { if (q[i] < 0) return false; continue; }
            const t = q[i] / p[i];
            if (p[i] < 0) { if (t > tMax) return false; if (t > tMin) tMin = t; }
            else { if (t < tMin) return false; if (t < tMax) tMax = t; }
          }
          return tMin <= tMax;
        }
        const boxOf = (id) => {
          const g = document.querySelector(`g.node[data-id="${id}"]`);
          const [, x, y] = g.getAttribute('transform').match(/translate\(([-\d.]+),([-\d.]+)\)/).map(Number);
          const rect = g.querySelector('rect.node-box');
          return { x, y, w: parseFloat(rect.getAttribute('width')), h: parseFloat(rect.getAttribute('height')) };
        };
        const graph = window.__viewer.graph();
        const bad = [];
        for (const e of graph.edges) {
          const line = document.querySelector(`g.edge[data-id="${e.id}"] path.edge-line`);
          if (!line) continue;
          const [, x1, y1, x2, y2] = line.getAttribute('d').match(/M([-\d.]+),([-\d.]+) L([-\d.]+),([-\d.]+)/).map(Number);
          const ra = boxOf(e.from), rb = boxOf(e.to);
          if (intersects(ra, x1, y1, x2, y2) || intersects(rb, x1, y1, x2, y2)) bad.push(e.id);
        }
        return bad;
      });
      assert.deepEqual(crossings, [], `edge(s) crossing a box in ${file}: ${crossings.join(', ')}`);
    } finally {
      await ctx.stop();
    }
  }
});

// ============================================================================================
// The pre-slot face check only ever sees a face pair's *centres* — chooseFaces runs before any
// bundle exists, so it has no way to know a face will end up carrying more than one arrow. Here,
// source `s` has two outgoing arrows whose targets both sit up and to its left, so both take the
// facing-sides candidate on s's left face; slotting then spreads that bundle's two members 9px
// apart, and the one pushed toward the source's own vertical centre lands back inside the source
// box the face check had just cleared it against. render()'s post-slot recheck (see the comment
// above the loop that reads edgeAnchors right after the bundling loop) exists to catch exactly
// this and reroute the offending edge to the same rectExit fallback a failed face search already
// uses, rather than drawing the slotted line uncorrected.
// ============================================================================================
test('a departure slotted toward its own box is rerouted to the centre-to-centre fallback instead of crossing it', async ({ page }) => {
  const ctx = await launchInline(faceGraph(
    [faceNode('s', 0, 400), faceNode('t1', -600, 100), faceNode('t2', -192, 244)],
    [faceEdge('s->t1', 's', 't1'), faceEdge('s->t2', 's', 't2')],
  ));
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const s = await nodeBoxGeom(page, 's');
    const t1 = await nodeBoxGeom(page, 't1');
    const t2 = await nodeBoxGeom(page, 't2');
    const g1 = await edgeGeom(page, 's->t1');
    const g2 = await edgeGeom(page, 's->t2');

    // Same Liang-Barsky clip test as index.html's rectIntersectsSegment, computed independently
    // here (not by calling back into the page) — the same test the headline sweep above uses.
    function intersects(rect, x1, y1, x2, y2) {
      const dx = x2 - x1, dy = y2 - y1;
      const p = [-dx, dx, -dy, dy];
      const q = [x1 - rect.x, rect.x + rect.w - x1, y1 - rect.y, rect.y + rect.h - y1];
      let tMin = 0, tMax = 1;
      for (let i = 0; i < 4; i += 1) {
        if (p[i] === 0) { if (q[i] < 0) return false; continue; }
        const t = q[i] / p[i];
        if (p[i] < 0) { if (t > tMax) return false; if (t > tMin) tMin = t; }
        else { if (t < tMin) return false; if (t < tMax) tMax = t; }
      }
      return tMin <= tMax;
    }

    assert.ok(!intersects(s, g1.x1, g1.y1, g1.x2, g1.y2), 's->t1 crosses the source box');
    assert.ok(!intersects(t1, g1.x1, g1.y1, g1.x2, g1.y2), 's->t1 crosses its target box');
    assert.ok(!intersects(s, g2.x1, g2.y1, g2.x2, g2.y2), 's->t2 crosses the source box');
    assert.ok(!intersects(t2, g2.x1, g2.y1, g2.x2, g2.y2), 's->t2 crosses its target box');
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// Two edges sharing the same `from` and `to` are duplicates, not a reciprocal pair (there is no
// edge running the other way), so they take the same face pair — bottom-to-top, both boxes on the
// same x here — and are told apart only by phase 2's slotting. Adjacent slots, not distinct faces:
// the edge-id tie-break in the sort is what keeps two edges between the same pair of boxes from
// landing on the same point.
// ============================================================================================
test("two arrows sharing a from and to land on adjacent, distinct slots at both ends", async ({ page }) => {
  const ctx = await launchInline(faceGraph(
    [faceNode('a', 0, 0), faceNode('b', 0, 140)],
    [faceEdge('a->b1', 'a', 'b'), faceEdge('a->b2', 'a', 'b')],
  ));
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const g1 = await edgeGeom(page, 'a->b1');
    const g2 = await edgeGeom(page, 'a->b2');

    assert.notEqual(g1.x1, g2.x1, 'the two departures from a must land on distinct slots');
    assert.notEqual(g1.x2, g2.x2, 'the two arrivals at b must land on distinct slots');
    // EDGE_FAN_OUT (18) at a, where both ends are departures; EDGE_FAN_IN (32) at b, where both
    // ends are arrivals — an arrowhead needs more room than a bare departure does.
    assert.equal(Math.abs(g1.x1 - g2.x1), 18, 'expected the departure pitch (EDGE_FAN_OUT)');
    assert.equal(Math.abs(g1.x2 - g2.x2), 32, 'expected the arrival pitch (EDGE_FAN_IN)');
    assert.equal(g1.y1, g2.y1, 'both departures stay on the same face, at the same height');
    assert.equal(g1.y2, g2.y2, 'both arrivals stay on the same face, at the same height');
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// The case the deleted perpendicular fan handled worst: two boxes whose rectangles overlap
// outright (a: (0,0)-(200,74), b: (0,-40)-(200,34) — equal x, overlapping y). The fan shifted both
// endpoints perpendicular to a centre-to-centre line that, for an equal-x pair, ran straight
// through both boxes to begin with. Face choice + slotting replaces it: the same-flank pair
// (right-right) clears both boxes because its anchors sit outside their shared right edge, and the
// two duplicate edges still land on distinct, non-fanned slots there.
// ============================================================================================
test('two arrows between boxes whose rectangles overlap land on distinct slots, with no perpendicular fan', async ({ page }) => {
  const ctx = await launchInline(faceGraph(
    [faceNode('a', 0, 0), faceNode('b', 0, -40)],
    [faceEdge('a->b1', 'a', 'b'), faceEdge('a->b2', 'a', 'b')],
  ));
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const g1 = await edgeGeom(page, 'a->b1');
    const g2 = await edgeGeom(page, 'a->b2');
    const a = await nodeBoxGeom(page, 'a');
    const b = await nodeBoxGeom(page, 'b');

    // No perpendicular fan: every anchor sits exactly on the shared right face (x = box right
    // edge + 4), never off it at an angle — the fan's own failure mode on an equal-x pair.
    const rightFace = a.x + a.w + 4;
    assert.equal(rightFace, b.x + b.w + 4, 'the two boxes share a right edge in this fixture');
    for (const [label, v] of [['g1.x1', g1.x1], ['g1.x2', g1.x2], ['g2.x1', g2.x1], ['g2.x2', g2.x2]]) {
      assert.equal(v, rightFace, `expected ${label} on the shared right face, got ${v}`);
    }
    assert.notEqual(g1.y1, g2.y1, 'the two departures from a must land on distinct slots');
    assert.notEqual(g1.y2, g2.y2, 'the two arrivals at b must land on distinct slots');
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// Two more shapes that are not a step forward: p->q sits on one row (a same-row pair, not
// reciprocal), and r->s runs from below back up to a box further along (an upward arrow). Neither
// satisfies the bottom-to-top forward test, so both fall through to the facing sides.
// ============================================================================================
test('a same-row arrow and an upward arrow both use side faces', async ({ page }) => {
  const ctx = await launchInline(faceGraph(
    [faceNode('p', 0, 0), faceNode('q', 400, 0), faceNode('r', 0, 300), faceNode('s', 600, 0)],
    [faceEdge('p->q', 'p', 'q'), faceEdge('r->s', 'r', 's')],
  ));
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    for (const [id, from, to] of [['p->q', 'p', 'q'], ['r->s', 'r', 's']]) {
      const { x1, y1, x2, y2 } = await edgeGeom(page, id);
      const a = await nodeBoxGeom(page, from);
      const b = await nodeBoxGeom(page, to);
      assert.equal(y1, a.y + a.h / 2, `${id}: expected the source anchor on its vertical centre — a side face`);
      assert.equal(y2, b.y + b.h / 2, `${id}: expected the target anchor on its vertical centre — a side face`);
      assert.ok(x1 === a.x - 4 || x1 === a.x + a.w + 4, `${id}: expected the source anchor on a left or right face`);
      assert.ok(x2 === b.x - 4 || x2 === b.x + b.w + 4, `${id}: expected the target anchor on a left or right face`);
    }
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// Three departures from one box's bottom face, to three targets spread left, centre and right on
// the row below. Bundled and ordered by each target's own centre x, so the anchor nearest the
// left-hand target sits left of centre, and the one nearest the right-hand target sits right of
// it — at the fan-out pitch (18), since none of these three ends is an arrival.
// ============================================================================================
test('a bundle of three arrows on one face gets three distinct anchors at the right pitch, in the right order', async ({ page }) => {
  const ctx = await launchInline(faceGraph(
    [faceNode('src', 400, 0), faceNode('t1', 0, 300), faceNode('t2', 400, 300), faceNode('t3', 800, 300)],
    [faceEdge('src->t1', 'src', 't1'), faceEdge('src->t2', 'src', 't2'), faceEdge('src->t3', 'src', 't3')],
  ));
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const src = await nodeBoxGeom(page, 'src');
    const centre = src.x + src.w / 2;
    const g1 = await edgeGeom(page, 'src->t1');
    const g2 = await edgeGeom(page, 'src->t2');
    const g3 = await edgeGeom(page, 'src->t3');

    assert.equal(g1.y1, src.y + src.h + 4);
    assert.equal(g2.y1, src.y + src.h + 4);
    assert.equal(g3.y1, src.y + src.h + 4);
    assert.equal(g1.x1, centre - 18, "t1 is leftmost, so src->t1 takes the leftmost slot");
    assert.equal(g2.x1, centre, "t2 sits under src's own centre, so src->t2 takes the middle slot");
    assert.equal(g3.x1, centre + 18, "t3 is rightmost, so src->t3 takes the rightmost slot");
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// One correction to an earlier draft of the plan, already adjudicated: Decision 34 replaced the
// per-orientation rule with the preference list above and supersedes Decision 18, so a vertically
// stacked reciprocal pair no longer runs "down opposite flanks" — a->b still takes the forward
// bottom-to-top pair (nothing about being part of a reciprocal pair changes candidate 1, only the
// order of candidates 2 and 3), and only b->a, which fails the forward test, falls to the
// same-flank preference reciprocal pairs get and lands on the right. What the test actually
// guards is non-collinearity: two arrows between the same pair of boxes must never draw the one
// double-headed line the deleted perpendicular fan used to prevent by a different, now-removed
// mechanism.
// ============================================================================================
test('a vertically stacked reciprocal pair is drawn on two separate, non-collinear geometries', async ({ page }) => {
  const ctx = await launchInline(faceGraph(
    [faceNode('a', 460, 0), faceNode('b', 460, 140)],
    [faceEdge('a->b', 'a', 'b'), faceEdge('b->a', 'b', 'a')],
  ));
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const ab = await edgeGeom(page, 'a->b');
    const ba = await edgeGeom(page, 'b->a');

    assert.deepEqual(ab, { x1: 560, y1: 78, x2: 560, y2: 136 }, 'a->b: bottom-to-top, down the middle');
    assert.deepEqual(ba, { x1: 664, y1: 177, x2: 664, y2: 37 }, 'b->a: the same-flank preference a reciprocal pair gets, up the right');

    // Non-collinear: the four points cannot all lie on one line, which is the substantive
    // guarantee this test exists for (see the comment above on why "opposite flanks" no longer
    // holds literally).
    const cross = (ba.x1 - ab.x1) * (ab.y2 - ab.y1) - (ba.y1 - ab.y1) * (ab.x2 - ab.x1);
    assert.notEqual(cross, 0, 'expected b->a to fall off a->b\'s own line, not run parallel to or along it');
    assert.notEqual(ab.x1, ba.x1, 'the two arrows must not share a vertical geometry either');
  } finally {
    await ctx.stop();
  }
});
