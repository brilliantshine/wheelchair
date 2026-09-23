'use strict';

// Touch and the Select toggle (Task 4 of docs/plans/remote-viewer/PLAN.md — "On a phone"). Real
// Chromium and real Firefox, same real-gesture rule as browser.spec.js: a pan, a pinch or a
// box-select has to actually move the picture or the selection, not just report that it did.
//
// Playwright has no API for a multi-finger drag — `page.touchscreen` only taps (Decision Log
// #95) — so every gesture below that needs more than one pointer, or needs a pointer to move at
// all, is driven by dispatching real `PointerEvent`s with `pointerType: 'touch'` and a fixed
// `pointerId` per finger, straight at the element the finger is meant to be touching (this is
// what makes `ev.target` — and so `ev.target.closest('.node')` in index.html's own pointerdown
// handler — resolve exactly as a real touch would). A single tap that needs no movement uses
// `page.touchscreen.tap`, which is the one thing it can do.
//
// Every context here carries `hasTouch: true` — Decision Log #94 records that Playwright's
// Firefox, like its Chromium, matches `(pointer: coarse)` under it, which is what the Select
// toggle's visibility (Decision Log #30) and the touch-vs-mouse gesture branch in index.html both
// key off.

const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test, expect } = require('@playwright/test');
const { makeDir, stage, startServer } = require('./helpers/server');

// ---- server lifecycle (same recipe as browser.spec.js's `launch`) -------------------------------

async function launch(fixtureName, targetName = fixtureName) {
  const root = await makeDir('touch-');
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

// ---- page helpers (a subset of browser.spec.js's — this file owns none of that one) -------------

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

async function center(locator) {
  const box = await locator.boundingBox();
  assert.ok(box, 'element has a layout box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function collectViewResponses(page) {
  const responses = [];
  const listener = (resp) => {
    if (resp.request().method() === 'PUT' && resp.url().includes('/view')) responses.push(resp);
  };
  page.on('response', listener);
  return { responses, stop: () => page.off('response', listener) };
}

// ---- synthetic touch pointers ---------------------------------------------------------------
// Dispatched, not driven through Playwright's input pipeline, so `pointerId` is ours to fix across
// a whole gesture — real multi-touch hardware does the same, handing every finger a stable id for
// as long as it stays down.

async function touchDown(locator, x, y, pointerId, isPrimary = true) {
  await locator.evaluate((el, args) => {
    el.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, cancelable: true, pointerId: args.pointerId, pointerType: 'touch',
      isPrimary: args.isPrimary, clientX: args.x, clientY: args.y, button: 0, buttons: 1,
    }));
  }, { x, y, pointerId, isPrimary });
}

async function touchMove(locator, x, y, pointerId, isPrimary = true) {
  await locator.evaluate((el, args) => {
    el.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, cancelable: true, pointerId: args.pointerId, pointerType: 'touch',
      isPrimary: args.isPrimary, clientX: args.x, clientY: args.y, button: -1, buttons: 1,
    }));
  }, { x, y, pointerId, isPrimary });
}

async function touchUp(locator, x, y, pointerId, isPrimary = true) {
  await locator.evaluate((el, args) => {
    el.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, cancelable: true, pointerId: args.pointerId, pointerType: 'touch',
      isPrimary: args.isPrimary, clientX: args.x, clientY: args.y, button: 0, buttons: 0,
    }));
  }, { x, y, pointerId, isPrimary });
}

async function touchCancel(locator, pointerId, isPrimary = true) {
  await locator.evaluate((el, args) => {
    el.dispatchEvent(new PointerEvent('pointercancel', {
      bubbles: true, cancelable: true, pointerId: args.pointerId, pointerType: 'touch',
      isPrimary: args.isPrimary,
    }));
  }, { pointerId, isPrimary });
}

// A short two-step move so a real drag's own >3px moved-threshold (index.html) is always cleared,
// without pretending to be a smooth many-frame gesture the assertions below don't need.
async function drag(locator, x0, y0, x1, y1, pointerId) {
  await touchDown(locator, x0, y0, pointerId);
  await touchMove(locator, (x0 + x1) / 2, (y0 + y1) / 2, pointerId);
  await touchMove(locator, x1, y1, pointerId);
}

// ============================================================================================
// Touch gestures, and the Select toggle, under a touch-capable context.
// ============================================================================================
test.describe('touch pointer gestures', () => {
  test.use({ viewport: { width: 1400, height: 900 }, hasTouch: true });

  test('the Select toggle is shown under a touch-capable context', async ({ page }) => {
    const ctx = await launch('interactive.json');
    try {
      await page.goto(pageUrl(ctx));
      await ready(page);
      await expect(page.locator('#select-toggle')).toBeVisible();
    } finally {
      await ctx.stop();
    }
  });

  test('one-finger drag on empty canvas pans the view', async ({ page }) => {
    const ctx = await launch('interactive.json');
    try {
      await page.goto(pageUrl(ctx));
      await ready(page);

      const canvas = page.locator('svg#canvas');
      const canvasBox = await canvas.boundingBox();
      const before = await nodeBox(page, 'a').boundingBox();

      // Bottom-left corner inside fitToView's 60px margin — guaranteed empty background, the
      // same anchor browser.spec.js's mouse pan test uses.
      const x0 = canvasBox.x + 15, y0 = canvasBox.y + canvasBox.height - 15;
      const dx = 70, dy = -90;
      await drag(canvas, x0, y0, x0 + dx, y0 + dy, 1);
      await touchUp(canvas, x0 + dx, y0 + dy, 1);

      const after = await nodeBox(page, 'a').boundingBox();
      assert.equal(Math.round(after.x - before.x), dx);
      assert.equal(Math.round(after.y - before.y), dy);
      assert.deepEqual(await selection(page), [], 'a pan must never select anything');
    } finally {
      await ctx.stop();
    }
  });

  test('two-finger pinch zooms about the midpoint, clamped to MIN_ZOOM and MAX_ZOOM', async ({ page }) => {
    const ctx = await launch('interactive.json');
    try {
      await page.goto(pageUrl(ctx));
      await ready(page);

      const canvas = page.locator('svg#canvas');
      const canvasBox = await canvas.boundingBox();
      const cx = canvasBox.x + canvasBox.width / 2, cy = canvasBox.y + canvasBox.height / 2;

      // Two fingers close together, straddling the canvas centre — landing the second finger
      // (pointerId 2) is what starts the pinch (index.html's capturing pointerdown listener).
      await touchDown(canvas, cx - 20, cy, 1);
      await touchDown(canvas, cx + 20, cy, 2, false);

      // Spread far apart: the ratio of new to previous distance is huge, so zoom clamps at the
      // ceiling on the very first move already, and further spreading leaves it there.
      await touchMove(canvas, cx - 400, cy, 1);
      await touchMove(canvas, cx + 400, cy, 2, false);
      assert.equal(await pageZoom(page), 2.5, 'zoom should clamp at MAX_ZOOM');

      // Bring them back together, past each other: the ratio collapses, clamping at the floor.
      await touchMove(canvas, cx - 2, cy, 1);
      await touchMove(canvas, cx + 2, cy, 2, false);
      assert.equal(await pageZoom(page), 0.3, 'zoom should clamp at MIN_ZOOM');

      await touchUp(canvas, cx - 2, cy, 1);
      await touchUp(canvas, cx + 2, cy, 2, false);
    } finally {
      await ctx.stop();
    }
  });

  test('a second finger during a box drag switches to pinch, and the box keeps and saves its new position', async ({ page }) => {
    const ctx = await launch('interactive.json');
    try {
      await page.goto(pageUrl(ctx));
      await ready(page);

      const before = entry(await pageGraph(page), 'a');
      const start = await center(nodeBox(page, 'a'));
      const canvas = page.locator('svg#canvas');
      const canvasBox = await canvas.boundingBox();

      const collector = collectViewResponses(page);
      await touchDown(nodeBox(page, 'a'), start.x, start.y, 1);
      await touchMove(canvas, start.x + 40, start.y + 15, 1); // dragState.moved = true

      const zoomBefore = await pageZoom(page);
      // Second finger lands on empty canvas, far from the drag — this ends the drag exactly
      // where it stands (committed, same as a mouse drag saving today) and starts a pinch.
      const secondX = canvasBox.x + 15, secondY = canvasBox.y + canvasBox.height - 15;
      await touchDown(canvas, secondX, secondY, 2, false);

      await expect.poll(() => collector.responses.some((r) => r.status() === 200)).toBe(true);
      collector.stop();

      const onDisk = entry(await diskGraph(ctx), 'a');
      assert.equal(onDisk.x, before.x + 40);
      assert.equal(onDisk.y, before.y + 15);

      // The gesture really did switch to a pinch: moving both fingers apart now zooms.
      await touchMove(canvas, secondX - 200, secondY, 2, false);
      await touchMove(canvas, start.x + 240, start.y + 15, 1);
      assert.ok(await pageZoom(page) > zoomBefore, 'the second finger should have started a pinch, not resumed the drag');

      await touchUp(canvas, secondX - 200, secondY, 2, false);
      await touchUp(canvas, start.x + 240, start.y + 15, 1);
    } finally {
      await ctx.stop();
    }
  });

  test('a pointercancel ends a drag in progress the same way lifting the finger would', async ({ page }) => {
    const ctx = await launch('interactive.json');
    try {
      await page.goto(pageUrl(ctx));
      await ready(page);

      const before = entry(await pageGraph(page), 'b');
      const start = await center(nodeBox(page, 'b'));
      const canvas = page.locator('svg#canvas');

      const collector = collectViewResponses(page);
      await touchDown(nodeBox(page, 'b'), start.x, start.y, 7);
      await touchMove(canvas, start.x + 33, start.y + 21, 7); // dragState.moved = true
      await touchCancel(canvas, 7);

      await expect.poll(() => collector.responses.some((r) => r.status() === 200)).toBe(true);
      collector.stop();

      const onDisk = entry(await diskGraph(ctx), 'b');
      assert.equal(onDisk.x, before.x + 33);
      assert.equal(onDisk.y, before.y + 21);
    } finally {
      await ctx.stop();
    }
  });

  test('the Select toggle turns a one-finger drag into a box-select, and a tap adds or removes a node', async ({ page }) => {
    const ctx = await launch('interactive.json');
    try {
      await page.goto(pageUrl(ctx));
      await ready(page);

      await page.locator('#select-toggle').click();
      await expect(page.locator('#select-toggle')).toHaveAttribute('aria-pressed', 'true');

      const canvas = page.locator('svg#canvas');
      const boxA = await nodeBox(page, 'a').boundingBox();
      const boxB = await nodeBox(page, 'b').boundingBox();
      const x0 = Math.min(boxA.x, boxB.x) - 30, y0 = Math.min(boxA.y, boxB.y) - 30;
      const x1 = Math.max(boxA.x + boxA.width, boxB.x + boxB.width) + 30;
      const y1 = Math.max(boxA.y + boxA.height, boxB.y + boxB.height) + 30;

      await drag(canvas, x0, y0, x1, y1, 3);
      await touchUp(canvas, x1, y1, 3);
      assert.deepEqual(await selection(page), ['a', 'a->b', 'b'].sort(), 'one-finger drag should box-select under the toggle');

      // A tap on an unselected node adds it; the same tap again removes it — additive, the way
      // shift-click is for a mouse (Decision Log #29).
      const cCenter = await center(nodeBox(page, 'c'));
      await page.touchscreen.tap(cCenter.x, cCenter.y);
      assert.deepEqual(await selection(page), ['a', 'a->b', 'b', 'c'].sort(), 'a tap should add the node to the selection');

      await page.touchscreen.tap(cCenter.x, cCenter.y);
      assert.deepEqual(await selection(page), ['a', 'a->b', 'b'].sort(), 'a second tap should remove it again');
    } finally {
      await ctx.stop();
    }
  });
});

// ============================================================================================
// Mouse and keyboard are unchanged (Objective 4) — a plain mouse context, no touch ever seen.
// ============================================================================================
test.describe('mouse behaviour is unchanged', () => {
  test.use({ viewport: { width: 1400, height: 900 } });

  test('the Select toggle is not shown for a plain mouse context', async ({ page }) => {
    const ctx = await launch('interactive.json');
    try {
      await page.goto(pageUrl(ctx));
      await ready(page);
      await expect(page.locator('#select-toggle')).toBeHidden();
    } finally {
      await ctx.stop();
    }
  });

  test('a plain mouse drag on empty canvas still box-selects', async ({ page }) => {
    const ctx = await launch('interactive.json');
    try {
      await page.goto(pageUrl(ctx));
      await ready(page);

      const boxA = await nodeBox(page, 'a').boundingBox();
      const boxB = await nodeBox(page, 'b').boundingBox();
      const x0 = Math.min(boxA.x, boxB.x) - 30, y0 = Math.min(boxA.y, boxB.y) - 30;
      const x1 = Math.max(boxA.x + boxA.width, boxB.x + boxB.width) + 30;
      const y1 = Math.max(boxA.y + boxA.height, boxB.y + boxB.height) + 30;

      await page.mouse.move(x0, y0);
      await page.mouse.down();
      await page.mouse.move(x1, y1, { steps: 6 });
      await page.mouse.up();

      assert.deepEqual(await selection(page), ['a', 'a->b', 'b'].sort());
    } finally {
      await ctx.stop();
    }
  });
});

// ============================================================================================
// Decision Log #35: below 600px the legend and source are dropped, and the controls scroll
// sideways inside the topbar rather than being clipped — the page itself never scrolls sideways.
// ============================================================================================
test.describe('narrow viewport', () => {
  test.use({ viewport: { width: 390, height: 700 }, hasTouch: true });

  test('no horizontal page scroll at 390px wide, with the controls reachable', async ({ page }) => {
    const ctx = await launch('interactive.json');
    try {
      await page.goto(pageUrl(ctx));
      await ready(page);

      const overflow = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        win: window.innerWidth,
      }));
      assert.ok(overflow.doc <= overflow.win + 1,
        `the page itself must never scroll sideways: scrollWidth=${overflow.doc}, innerWidth=${overflow.win}`);

      await expect(page.locator('#legend')).toBeHidden();
      await expect(page.locator('#source')).toBeHidden();

      // The controls overflow their own box rather than being invisibly clipped by #topbar's
      // overflow:hidden — scrolling to the end brings the last button on-screen.
      const metrics = await page.locator('#controls').evaluate((el) => ({
        scrollWidth: el.scrollWidth, clientWidth: el.clientWidth,
      }));
      assert.ok(metrics.scrollWidth > metrics.clientWidth, 'the controls should overflow at 390px, not fit');

      await page.locator('#controls').evaluate((el) => { el.scrollLeft = el.scrollWidth; });
      const zoomInBox = await page.locator('#zoom-in').boundingBox();
      assert.ok(zoomInBox.x >= 0 && zoomInBox.x + zoomInBox.width <= 390 + 1,
        `zoom-in should be reachable inside the 390px viewport once scrolled, got x=${zoomInBox.x}`);
    } finally {
      await ctx.stop();
    }
  });
});
