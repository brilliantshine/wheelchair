'use strict';

// Browser cases for the page side of run pictures (docs/plans/implementation-view/PLAN.md's
// Spec, "Sockets and wires", "Statuses and needs-you on the page" and "The list page"), in the
// style of viewer/test/browser.spec.js and viewer/test/pages.spec.js: a real server (helpers/
// server.js), real navigation, window.__viewer read back only to check state, never to drive the
// page. Every graph here is written straight to disk (never through PUT /graph, which would lay
// it out fresh) so the fixed x/y positions below are exactly what the page draws — the same
// technique browser.spec.js's launchInline uses for the same reason. A run picture still goes
// through GET /graph's own validateGraph on every read, so every object below is schema-valid on
// its own, not merely something a PUT would have accepted.

const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test, expect } = require('@playwright/test');
const { makeDir, startServer } = require('./helpers/server');

test.use({ viewport: { width: 2200, height: 1200 } });

async function launchRun(graphObj, target = 'run.json') {
  const root = await makeDir('run-page-');
  const graphDir = path.join(root, 'graphs');
  await fs.mkdir(graphDir, { recursive: true });
  const graphPath = path.join(graphDir, target);
  await fs.writeFile(graphPath, JSON.stringify(graphObj));
  return startServer({ cacheRoot: root, open: graphPath });
}

function pageUrl(ctx) {
  return `${ctx.url}/?path=${encodeURIComponent(ctx.graphPath)}&token=${encodeURIComponent(ctx.token)}`;
}

function listUrl(ctx) {
  return `${ctx.url}/?token=${encodeURIComponent(ctx.token)}`;
}

async function ready(page) {
  await page.waitForFunction(() => window.__viewer && !!window.__viewer.graph());
}

function nodeGroup(page, id) { return page.locator(`svg#canvas g.node[data-id="${id}"]`); }

// A stub that never touches the real Notification API — installed before navigation so the page's
// own module-scope code sees it as soon as it runs. `permission` is a plain string, not a getter,
// which is enough for `typeof Notification !== 'undefined' && Notification.permission ===
// 'granted'` to read true every time the page checks it.
async function stubNotifications(page) {
  await page.addInitScript(() => {
    window.__notifications = [];
    window.Notification = function Notification(title, opts) {
      window.__notifications.push({ title, body: (opts && opts.body) || null });
    };
    window.Notification.permission = 'granted';
    window.Notification.requestPermission = () => Promise.resolve('granted');
  });
}

const LONG_SOCKET = 'a-quite-unreasonably-long-socket-name-for-a-box';

function socketsGraph() {
  return {
    schema: 1, title: 'sockets and statuses', source: 'plan-proposal', source_detail: 'the plan',
    explanation: null, run: true, groups: [],
    nodes: [
      { id: 'start', label: 'start the run', kind: 'step', task: 'T1', status: 'not-started', needs: null, graph: null, x: 0, y: 0 },
      { id: 'choice1', label: 'used a cache instead', kind: 'choice', task: 'T1', status: null, needs: null, graph: null, x: 0, y: 300 },
      { id: 'worker', label: 'do the work', kind: 'step', task: 'T2', status: 'in-progress', needs: null, graph: null, x: 500, y: 0 },
      { id: 'finish', label: 'finish and report', kind: 'step', task: 'T3', status: 'needs-you', needs: 'log in again', graph: null, x: 1000, y: 0 },
      { id: 'db', label: 'the results cache', kind: 'store', task: null, status: null, needs: null, graph: null, x: 500, y: 450 },
      { id: 'done1', label: 'already finished part', kind: 'step', task: 'prior', status: 'done', needs: null, graph: null, x: 1000, y: 450 },
    ],
    edges: [
      { id: 'e-seq', from: 'start', to: 'worker', kind: 'sequence', value: null, label: '' },
      { id: 'e-config', from: 'start', to: 'worker', kind: 'data', value: 'config', label: '' },
      { id: 'e-choice', from: 'choice1', to: 'worker', kind: 'sequence', value: null, label: 'chosen while building this' },
      { id: 'e-result', from: 'worker', to: 'finish', kind: 'data', value: 'result', label: '' },
      { id: 'e-cache', from: 'worker', to: 'db', kind: 'data', value: LONG_SOCKET, label: '' },
    ],
  };
}

// ============================================================================================
// Sockets: named input/output ("config"/"result"), the shared unnamed socket (the sequence
// arrows from `start` and `choice1` into `worker`'s one unnamed input row), and a name long
// enough to be cut at 22 characters, with the untruncated value in a hover title (Spec, "Sockets
// and wires" and "Box contents and height").
// ============================================================================================
test('sockets render named, unnamed and shared, with a long name cut and its full text in a hover title', async ({ page }) => {
  const ctx = await launchRun(socketsGraph());
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const worker = nodeGroup(page, 'worker');
    // Two input rows (the shared unnamed socket both `start` and `choice1` feed, plus `config`)
    // and two output rows (`result` and the long name).
    await expect(worker.locator('.socket-dot.socket-in')).toHaveCount(2);
    await expect(worker.locator('.socket-dot.socket-in[data-socket="unnamed"]')).toHaveCount(1);
    await expect(worker.locator('.socket-in-name')).toHaveText(['config']);
    await expect(worker.locator('.socket-dot.socket-out')).toHaveCount(2);
    await expect(worker.locator('.socket-out-name')).toHaveCount(2);

    // `textContent()` on the element itself would also pick up the nested <title> tooltip's own
    // text (SVG text content is recursive); read the element's own text node directly instead.
    const longNameEl = worker.locator(`.socket-out-name[data-value="${LONG_SOCKET}"]`);
    const shown = await longNameEl.evaluate((el) => el.childNodes[0].textContent);
    assert.ok(shown.length <= 22, `expected the cut name to be at most 22 characters, got ${JSON.stringify(shown)}`);
    assert.ok(shown.endsWith('…'), 'a cut socket name ends in an ellipsis');
    await expect(longNameEl.locator('title')).toHaveText(LONG_SOCKET);

    // `db` (a store no task builds) has one named input and no output — a single socket row.
    const db = nodeGroup(page, 'db');
    await expect(db.locator('.socket-dot.socket-in')).toHaveCount(1);
    const dbShown = await db.locator('.socket-in-name').evaluate((el) => el.childNodes[0].textContent);
    assert.equal(dbShown, LONG_SOCKET.slice(0, 21) + '…');
    await expect(db.locator('.socket-dot.socket-out')).toHaveCount(0);
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// Status tags and needs text (Spec, "Statuses and needs-you on the page"): all four statuses show
// their own tag text, a `needs-you` box also shows its needs text on the face, and a `choice` box
// carries no status tag at all.
// ============================================================================================
test('status tags and needs text render, and a choice box carries no status', async ({ page }) => {
  const ctx = await launchRun(socketsGraph());
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    await expect(nodeGroup(page, 'start').locator('.status-tag')).toHaveText('not started');
    await expect(nodeGroup(page, 'worker').locator('.status-tag')).toHaveText('in progress');
    await expect(nodeGroup(page, 'done1').locator('.status-tag')).toHaveText('done');
    const finish = nodeGroup(page, 'finish');
    await expect(finish.locator('.status-tag')).toHaveText('needs you');
    await expect(finish.locator('.needs-text')).toHaveCount(1);
    assert.equal(await finish.locator('.needs-text').textContent(), 'log in again');

    await expect(nodeGroup(page, 'choice1').locator('.status-tag')).toHaveCount(0);
    await expect(nodeGroup(page, 'choice1').locator('.needs-text')).toHaveCount(0);
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// A container shows its rollup as its own status tag and needs text ("+N more" past the first
// entry), never its own `status` (always null and unrendered), and a cut child says so in the
// detail panel (Spec, "Statuses and needs-you on the page", D19/D33/D37).
// ============================================================================================
test('a container shows its rollup status and needs, and a cut child explains itself in the detail panel', async ({ page }) => {
  const ctx = await launchRun({
    schema: 1, title: 'container rollups', source: 'plan-proposal', source_detail: null,
    explanation: null, run: true, groups: [],
    nodes: [
      { id: 'c-done', label: 'the finished piece', kind: 'step', task: null, status: null, needs: null, graph: 'run-child-done', x: 0, y: 0 },
      { id: 'c-needs', label: 'the piece needing you', kind: 'step', task: null, status: null, needs: null, graph: 'run-child-needs', x: 500, y: 0 },
    ],
    edges: [],
  });
  try {
    await fs.writeFile(path.join(ctx.graphDir, 'run-child-done.json'), JSON.stringify({
      schema: 1, title: 'child done', source: 'plan-proposal', source_detail: null, explanation: null,
      run: true, groups: [],
      nodes: [{ id: 'x', label: 'work', kind: 'step', task: 'T1', status: 'done', needs: null, graph: null, x: 0, y: 0 }],
      edges: [],
    }));
    await fs.writeFile(path.join(ctx.graphDir, 'run-child-needs.json'), JSON.stringify({
      schema: 1, title: 'child needs', source: 'plan-proposal', source_detail: null, explanation: null,
      run: true, groups: [],
      nodes: [
        { id: 'n1', label: 'first thing', kind: 'step', task: 'T1', status: 'needs-you', needs: 'renew the token', graph: null, x: 0, y: 0 },
        { id: 'n2', label: 'second thing', kind: 'step', task: 'T2', status: 'needs-you', needs: 'confirm it', graph: null, x: 300, y: 0 },
      ],
      edges: [],
    }));

    await page.goto(pageUrl(ctx));
    await ready(page);

    const cDone = nodeGroup(page, 'c-done');
    await expect(cDone.locator('.status-tag')).toHaveText('done');

    const cNeeds = nodeGroup(page, 'c-needs');
    await expect(cNeeds.locator('.status-tag')).toHaveText('needs you');
    assert.equal(await cNeeds.locator('.needs-text').textContent(), 'renew the token +1 more');

    await cNeeds.locator('.node-box').click();
    await expect(page.locator('g.detail[data-for="c-needs"] .detail-note')).toHaveCount(2);
    const noteTexts = await page.locator('g.detail[data-for="c-needs"] .detail-note').allTextContents();
    assert.ok(noteTexts.some((t) => t.includes('first thing') && t.includes('renew the token')));
    assert.ok(noteTexts.some((t) => t.includes('second thing') && t.includes('confirm it')));

    // The child stops being a readable run picture — the same "cut" rollup a missing or
    // unparseable file gets (server.js's rollupForChild) — and the container's detail panel says
    // so instead of showing a stale status.
    await fs.writeFile(path.join(ctx.graphDir, 'run-child-done.json'), JSON.stringify({ run: false }));
    await page.waitForTimeout(1300);
    await expect(cDone.locator('.status-tag')).toHaveCount(0);
    await cDone.locator('.node-box').click();
    // The message wraps across several tspans in the panel; join them the way an existing
    // browser.spec.js detail-panel case does (its `.detail-label tspan` check) rather than reading
    // the parent's own concatenated textContent, which runs adjacent lines together with no space.
    const cutLines = await page.locator('g.detail[data-for="c-done"] .detail-note tspan').allTextContents();
    assert.ok(cutLines.join(' ').includes('missing, unreadable, or not a run picture'), cutLines.join(' '));
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// The tab title carries `needs you · ` while any needs-you exists in the shown picture, and it
// clears once none remain — updated on the poll, not only on load (Spec, "Tab signal").
// ============================================================================================
test('the title prefix appears and clears across polls', async ({ page }) => {
  const ctx = await launchRun(socketsGraph());
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);
    // `finish` is already needs-you on load, so the prefix is there from the start.
    await expect(page).toHaveTitle(/^needs you · /);

    const graph = JSON.parse(await fs.readFile(ctx.graphPath, 'utf8'));
    const finish = graph.nodes.find((n) => n.id === 'finish');
    Object.assign(finish, { status: 'done', needs: null });
    await fs.writeFile(ctx.graphPath, JSON.stringify(graph));
    await page.waitForTimeout(1300);
    await expect(page).toHaveTitle((graph.title));

    Object.assign(finish, { status: 'needs-you', needs: 'sign in again' });
    await fs.writeFile(ctx.graphPath, JSON.stringify(graph));
    await page.waitForTimeout(1300);
    await expect(page).toHaveTitle(/^needs you · /);
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// With a stubbed Notification, exactly one notification fires per node that newly turns
// needs-you on a poll — including two nodes that share an id in two different files, which stay
// distinct because a node's identity is its file and its id together (Spec, D40). Nothing fires
// for the initial load (there is no earlier poll to have "newly turned" against), and a node that
// stays needs-you across a later poll does not notify again.
// ============================================================================================
test('exactly one notification per node newly needs-you, including two nodes sharing an id in different files', async ({ page }) => {
  const ctx = await launchRun({
    schema: 1, title: 'notifications', source: 'plan-proposal', source_detail: null,
    explanation: null, run: true, groups: [],
    nodes: [
      { id: 'shared', label: 'root piece', kind: 'step', task: 'T1', status: 'in-progress', needs: null, graph: null, x: 0, y: 0 },
      { id: 'c', label: 'the child piece', kind: 'step', task: null, status: null, needs: null, graph: 'run-child-shared', x: 500, y: 0 },
    ],
    edges: [],
  });
  try {
    await fs.writeFile(path.join(ctx.graphDir, 'run-child-shared.json'), JSON.stringify({
      schema: 1, title: 'child', source: 'plan-proposal', source_detail: null, explanation: null,
      run: true, groups: [],
      nodes: [{ id: 'shared', label: 'child piece', kind: 'step', task: 'T1', status: 'in-progress', needs: null, graph: null, x: 0, y: 0 }],
      edges: [],
    }));

    await stubNotifications(page);
    await page.goto(pageUrl(ctx));
    await ready(page);
    await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(() => window.__notifications), []);

    const rootGraph = JSON.parse(await fs.readFile(ctx.graphPath, 'utf8'));
    Object.assign(rootGraph.nodes.find((n) => n.id === 'shared'), { status: 'needs-you', needs: 'root needs this' });
    await fs.writeFile(ctx.graphPath, JSON.stringify(rootGraph));
    const childPath = path.join(ctx.graphDir, 'run-child-shared.json');
    const childGraph = JSON.parse(await fs.readFile(childPath, 'utf8'));
    Object.assign(childGraph.nodes[0], { status: 'needs-you', needs: 'child needs this' });
    await fs.writeFile(childPath, JSON.stringify(childGraph));

    await page.waitForTimeout(1400);
    let sent = await page.evaluate(() => window.__notifications);
    assert.equal(sent.length, 2, JSON.stringify(sent));
    assert.ok(sent.some((n) => n.title === 'root piece' && n.body === 'root needs this'));
    assert.ok(sent.some((n) => n.title === 'child piece' && n.body === 'child needs this'));

    // Neither node's needs-you state changed on this next poll, so nothing new fires.
    await page.waitForTimeout(1400);
    sent = await page.evaluate(() => window.__notifications);
    assert.equal(sent.length, 2, JSON.stringify(sent));
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// D39: a child file's own status change redraws the open root — because `rollups` differs from
// the previous poll — with no write to the root file at all, so the root's own hash is unchanged.
// ============================================================================================
test("a child file's status change redraws the open root without the root file changing", async ({ page }) => {
  const ctx = await launchRun({
    schema: 1, title: 'root', source: 'plan-proposal', source_detail: null, explanation: null,
    run: true, groups: [],
    nodes: [{ id: 'c', label: 'the child piece', kind: 'step', task: null, status: null, needs: null, graph: 'run-child-x', x: 0, y: 0 }],
    edges: [],
  });
  try {
    const childPath = path.join(ctx.graphDir, 'run-child-x.json');
    await fs.writeFile(childPath, JSON.stringify({
      schema: 1, title: 'child', source: 'plan-proposal', source_detail: null, explanation: null,
      run: true, groups: [],
      nodes: [{ id: 'y', label: 'child work', kind: 'step', task: 'T1', status: 'not-started', needs: null, graph: null, x: 0, y: 0 }],
      edges: [],
    }));

    await page.goto(pageUrl(ctx));
    await ready(page);
    await expect(nodeGroup(page, 'c').locator('.status-tag')).toHaveText('not started');
    const hashBefore = await page.evaluate(() => window.__viewer.hash);

    const child = JSON.parse(await fs.readFile(childPath, 'utf8'));
    child.nodes[0].status = 'in-progress';
    await fs.writeFile(childPath, JSON.stringify(child));
    await page.waitForTimeout(1300);

    await expect(nodeGroup(page, 'c').locator('.status-tag')).toHaveText('in progress');
    const hashAfter = await page.evaluate(() => window.__viewer.hash);
    assert.equal(hashAfter, hashBefore, "the root file itself was never written, so its hash must not change");
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// The list page shows a "run picture" link exactly when a plan's `run` is non-null
// (server.js's planSummaries / GET /wheelchair/list), pointing at the graph page for that path
// (Spec, "The list page", D10).
// ============================================================================================
test('the list page shows a run picture link for a plan with a run, and none for one without', async ({ page }) => {
  const ctx = await launchRun(socketsGraph());
  try {
    const withRun = path.join(ctx.root, 'repo', 'docs', 'plans', 'has-run');
    await fs.mkdir(path.join(withRun, 'graphs'), { recursive: true });
    await fs.writeFile(path.join(withRun, 'PLAN.md'), '---\nstatus: implementing\n---\n');
    await fs.writeFile(path.join(withRun, 'graphs', 'run.json'), JSON.stringify(socketsGraph()));

    const withoutRun = path.join(ctx.root, 'repo', 'docs', 'plans', 'no-run');
    await fs.mkdir(path.join(withoutRun, 'graphs'), { recursive: true });
    await fs.writeFile(path.join(withoutRun, 'PLAN.md'), '---\nstatus: planning\n---\n');

    await fs.writeFile(path.join(ctx.root, '.plans'), JSON.stringify({
      [withRun]: { added: 2, session: null, harness: 'other' },
      [withoutRun]: { added: 1, session: null, harness: 'other' },
    }));

    await page.goto(listUrl(ctx));
    await expect(page.locator('table.plans tbody tr')).toHaveCount(2);

    const hasRunRow = page.locator('table.plans tbody tr').filter({ hasText: 'has-run' });
    const runLink = hasRunRow.locator('a', { hasText: 'run picture' });
    await expect(runLink).toHaveCount(1);
    await expect(runLink).toHaveAttribute('href',
      '/wheelchair/?path=' + encodeURIComponent(path.join(withRun, 'graphs', 'run.json')));

    const noRunRow = page.locator('table.plans tbody tr').filter({ hasText: 'no-run' });
    await expect(noRunRow.locator('a', { hasText: 'run picture' })).toHaveCount(0);
  } finally {
    await ctx.stop();
  }
});

// ============================================================================================
// On a reserved name (`run.json`/`run-*.json`, D43), a poll answered with 404 (the file removed)
// or 422 (the file no longer validates) shows the fatal screen with the error, and a later poll
// that succeeds clears it (Spec, "Polling on a run picture").
// ============================================================================================
test('on a reserved-name path a removed file shows the fatal screen, and its reappearance clears it', async ({ page }) => {
  const ctx = await launchRun(socketsGraph());
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);
    await expect(page.locator('#fatal')).toBeHidden();

    const bytes = await fs.readFile(ctx.graphPath);
    await fs.unlink(ctx.graphPath);
    await expect.poll(() => page.locator('#fatal').isVisible(), { timeout: 6000 }).toBe(true);

    await fs.writeFile(ctx.graphPath, bytes);
    await expect.poll(() => page.locator('#fatal').isVisible(), { timeout: 6000 }).toBe(false);
    await expect(page.locator('svg#canvas')).toBeVisible();
  } finally {
    await ctx.stop();
  }
});

test('a reserved-name file that no longer validates shows the fatal screen with its error', async ({ page }) => {
  const ctx = await launchRun(socketsGraph());
  try {
    await page.goto(pageUrl(ctx));
    await ready(page);

    const graph = JSON.parse(await fs.readFile(ctx.graphPath, 'utf8'));
    graph.nodes.find((n) => n.id === 'start').status = 'not-a-real-status';
    await fs.writeFile(ctx.graphPath, JSON.stringify(graph));

    await expect.poll(() => page.locator('#fatal').isVisible(), { timeout: 6000 }).toBe(true);
    await expect(page.locator('#fatal')).toContainText('bad-status');
  } finally {
    await ctx.stop();
  }
});
