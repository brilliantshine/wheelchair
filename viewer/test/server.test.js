'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const {
  ROOT, fixture, makeDir, stage, startServer, request, getGraph, put, copy, sha256, freePort,
} = require('./helpers/server');

async function startFixture(name = 'canonical.json', target = name) {
  const root = await makeDir();
  const graphDir = path.join(root, 'graphs');
  await fs.mkdir(graphDir, { recursive: true });
  const graphPath = await stage({ graphDir }, name, target);
  return startServer({ cacheRoot: root, open: graphPath });
}

async function withFixture(name, work, target) {
  const ctx = await startFixture(name, target);
  try { return await work(ctx); } finally { await ctx.stop(); }
}

async function readFixtureGraph(name) { return JSON.parse((await fixture(name)).toString()); }
function entry(graph, id) { return [...graph.nodes, ...graph.edges].find((item) => item.id === id); }
// The box the viewer draws is 200 wide and up to 116 tall (index.html's NODE_W and nodeHeight,
// at the five-line label cap), so two nodes closer than that would be drawn one on top of the
// other whatever the layout meant. Hardcoded rather than imported: server.js exports nothing and
// this suite spawns it as a child process, so there is nothing to import, and an export added
// only to feed a test would be a module-shape change for one assertion. The browser suite holds
// the other end of this coupling, where a real five-line box is measured against a real layout.
function assertNoOverlap(graph) {
  for (const left of graph.nodes) {
    for (const right of graph.nodes) {
      if (left.id >= right.id) continue;
      const apart = Math.abs(left.x - right.x) >= 200 || Math.abs(left.y - right.y) >= 116;
      assert.ok(apart, `${left.id} and ${right.id} were laid out on top of each other`);
    }
  }
}
const GROUP_PAD = 24;
const GROUP_HEADER = 38;
const GROUP_GAP = 16;
function node(id) {
  return { id, label: id, kind: 'note', origin: 'proposed', was: null, exclusive: false,
    ref: null, note: null, graph: null, x: 0, y: 0 };
}
function visibleGroup(id, nodes) {
  return { id, label: id, note: `${id} is a visible system.`, visible: true, nodes };
}
function inlineGraph(ids, groups = [], edges = []) {
  return { schema: 1, title: 'placement', source: 'router', source_detail: null, explanation: null,
    groups, nodes: ids.map(node), edges: edges.map(([from, to], index) => ({ id: `${from}-${to}-${index}`,
      from, to, label: '', kind: 'sequence', value: null, inferred: false, origin: 'proposed', was: null, note: null })) };
}
function position(graph, id) { return entry(graph, id); }
function groupBox(graph, group) {
  const members = [...new Set(group.nodes)].map((id) => position(graph, id));
  const minX = Math.min(...members.map((item) => item.x)); const maxX = Math.max(...members.map((item) => item.x + 200));
  const minY = Math.min(...members.map((item) => item.y)); const maxY = Math.max(...members.map((item) => item.y + 116));
  return { x: minX - GROUP_PAD, y: minY - GROUP_PAD - GROUP_HEADER,
    w: maxX - minX + 2 * GROUP_PAD, h: maxY - minY + 2 * GROUP_PAD + GROUP_HEADER };
}
function nodeBox(graph, id) { const item = position(graph, id); return { x: item.x, y: item.y, w: 200, h: 116 }; }
function clearsGroupBox(left, right) {
  return left.x >= right.x + right.w + GROUP_GAP || right.x >= left.x + left.w + GROUP_GAP ||
    left.y >= right.y + right.h + GROUP_GAP || right.y >= left.y + left.h + GROUP_GAP;
}
async function createGraph(graph) {
  const root = await makeDir(); const graphDir = path.join(root, 'graphs'); await fs.mkdir(graphDir, { recursive: true });
  const graphPath = path.join(graphDir, 'new.json'); const ctx = await startServer({ cacheRoot: root, open: graphPath });
  try {
    expect(await graphPut(ctx, graph, ''), 200);
    return { ctx, graph: (await getGraph(ctx)).graph };
  } catch (error) { await ctx.stop(); throw error; }
}
async function setPositions(ctx, graph, positions) {
  const moved = copy(graph);
  for (const [id, point] of Object.entries(positions)) Object.assign(position(moved, id), point);
  expect(await viewPut(ctx, moved, (await getGraph(ctx)).hash), 200);
  return (await getGraph(ctx)).graph;
}
function childGraph(id, graph = null) {
  return { schema: 1, title: id, source: 'router', source_detail: null,
    nodes: [{ id: `${id}-node`, label: id, graph }], edges: [] };
}
function expect(result, status, error) {
  assert.equal(result.status, status, JSON.stringify(result.body));
  if (error) assert.equal(result.body.error, error, JSON.stringify(result.body));
}
async function graphPut(ctx, graph, hash, graphPath) { return put(ctx, '/graph', graph, hash, graphPath); }
async function viewPut(ctx, graph, hash, graphPath, options) { return put(ctx, '/view', graph, hash, graphPath, options); }

function waitForServerUrl(child) {
  return new Promise((resolve, reject) => {
    let output = ''; let errors = '';
    const timeout = setTimeout(() => reject(new Error(`hooked server did not print its URL: ${errors}`)), 3000);
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const line = output.split(/\r?\n/).find((value) => value.startsWith('http://127.0.0.1:'));
      if (line) { clearTimeout(timeout); resolve(line); }
    });
    child.stderr.on('data', (chunk) => { errors += chunk; });
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      reject(new Error(`hooked server exited before ready (${code ?? signal}): ${errors}`));
    });
  });
}

async function waitForFile(filePath, timeoutMs = 1500) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try { await fs.access(filePath); return; }
    catch (error) {
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${path.basename(filePath)}.`);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
}

function waitForExit(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve();
    else child.once('exit', resolve);
  });
}

async function writeFaultHook(root) {
  const hookPath = path.join(root, 'fault-hook.js');
  await fs.writeFile(hookPath, `'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const marker = process.env.GRAPH_TEST_MARKER;
const mode = process.env.GRAPH_TEST_HOOK;
function mark() { fs.writeFileSync(marker, 'ready'); }
function pause() { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000); }
function pauseForRelease() {
  const release = marker + '.release'; const deadline = Date.now() + 3000;
  while (!fs.existsSync(release) && Date.now() < deadline) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
  }
}
if (mode === 'lock-claim-window') {
  const openSync = fs.openSync;
  let paused = false;
  fs.openSync = function(...args) {
    const result = openSync.apply(this, args);
    if (!paused && path.basename(String(args[0])) === '.server' && args[1] === 'wx') {
      paused = true; mark(); pauseForRelease();
    }
    return result;
  };
  const linkSync = fs.linkSync;
  fs.linkSync = function(...args) {
    if (!paused && path.basename(String(args[1])) === '.server') {
      paused = true; mark(); pauseForRelease();
    }
    return linkSync.apply(this, args);
  };
}
if (mode === 'before-rename') {
  const rename = fsp.rename;
  fsp.rename = async function(...args) { mark(); pause(); return rename.apply(this, args); };
}
`);
  return hookPath;
}

function spawnHookedServer({ root, graphPath, port, hookPath, marker, mode }) {
  return spawn(process.execPath, [
    '--require', hookPath, 'viewer/server.js', '--port', String(port), '--cache-root', root, '--open', graphPath,
  ], {
    cwd: ROOT,
    env: { ...process.env, GRAPH_TEST_MARKER: marker, GRAPH_TEST_HOOK: mode },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

test('canonical round-trip canonicalizes byte-for-byte', async () => {
  await withFixture('canonical.json', async (ctx) => {
    const before = await fs.readFile(ctx.graphPath);
    const state = await getGraph(ctx);
    expect(await graphPut(ctx, state.graph, state.hash), 200);
    assert.deepEqual(await fs.readFile(ctx.graphPath), before);
  });
  await withFixture('noncanonical.json', async (ctx) => {
    const state = await getGraph(ctx);
    expect(await graphPut(ctx, state.graph, state.hash), 200);
    assert.deepEqual(await fs.readFile(ctx.graphPath), await fixture('canonical.json'));
  });
});

test('explanation written through /graph is retained on disk in canonical order', async () => {
  await withFixture('canonical.json', async (ctx) => {
    const state = await getGraph(ctx); const graph = copy(state.graph);
    graph.explanation = 'This write verifies that the graph account survives canonicalization.';
    expect(await graphPut(ctx, graph, state.hash), 200);
    const stored = JSON.parse(await fs.readFile(ctx.graphPath, 'utf8'));
    assert.equal(stored.explanation, graph.explanation);
    assert.deepEqual(Object.keys(stored), ['schema', 'title', 'source', 'source_detail', 'explanation', 'groups', 'nodes', 'edges']);
  });
});

test('groups canonicalize member lists, order, and byte round-trip', async () => {
  await withFixture('canonical.json', async (ctx) => {
    let state = await getGraph(ctx); const graph = copy(state.graph);
    graph.explanation = 'See [the right branch](#right) and [the left branch](#left).';
    graph.groups = [
      { id: 'right', nodes: ['store', 'report', 'store'] },
      { id: 'left', nodes: ['inspect', 'gather'] },
    ];
    expect(await graphPut(ctx, graph, state.hash), 200);
    state = await getGraph(ctx);
    assert.deepEqual(state.graph.groups, [
      { id: 'left', label: null, note: null, visible: false, nodes: ['gather', 'inspect'] },
      { id: 'right', label: null, note: null, visible: false, nodes: ['report', 'store'] },
    ]);
    const before = await fs.readFile(ctx.graphPath);
    expect(await graphPut(ctx, state.graph, state.hash), 200);
    assert.deepEqual(await fs.readFile(ctx.graphPath), before);
    const parsed = JSON.parse(before);
    assert.deepEqual(Object.keys(parsed.groups[0]), ['id', 'label', 'note', 'visible', 'nodes']);
    assert.deepEqual(Object.keys(parsed),
      ['schema', 'title', 'source', 'source_detail', 'explanation', 'groups', 'nodes', 'edges']);
  });
});

test('visible groups round-trip without explanation references', async () => {
  await withFixture('canonical.json', async (ctx) => {
    let state = await getGraph(ctx); const graph = copy(state.graph);
    graph.groups = [{
      id: 'left', label: 'The left branch', note: 'Gathers the input and inspects it.',
      visible: true, nodes: ['gather', 'inspect'],
    }];
    expect(await graphPut(ctx, graph, state.hash), 200);
    state = await getGraph(ctx);
    assert.deepEqual(state.graph.groups, [{
      id: 'left', label: 'The left branch', note: 'Gathers the input and inspects it.',
      visible: true, nodes: ['gather', 'inspect'],
    }]);
    const before = await fs.readFile(ctx.graphPath);
    expect(await graphPut(ctx, state.graph, state.hash), 200);
    assert.deepEqual(await fs.readFile(ctx.graphPath), before);
  });
});

test('groups default on writes and reads of legacy disk files', async () => {
  await withFixture('canonical.json', async (ctx) => {
    let state = await getGraph(ctx); const omitted = copy(state.graph); delete omitted.groups;
    expect(await graphPut(ctx, omitted, state.hash), 200);
    assert.deepEqual((await getGraph(ctx)).graph.groups, []);

    const legacy = JSON.parse(await fs.readFile(ctx.graphPath, 'utf8')); delete legacy.groups;
    await fs.writeFile(ctx.graphPath, JSON.stringify(legacy));
    state = await getGraph(ctx);
    assert.deepEqual(state.graph.groups, []);
  });
});

test('groups refuse malformed claims and unmatched explanation references', async () => {
  await withFixture('canonical.json', async (ctx) => {
    const state = await getGraph(ctx);
    for (const [code, change] of [
      ['unknown-schema', (graph) => { graph.groups = {}; }],
      ['bad-id', (graph) => { graph.groups = [{ id: 'left', nodes: ['gather'] }, { id: 'left', nodes: ['inspect'] }]; }],
      ['group-bad-name', (graph) => { graph.groups = [{ id: 'left.branch', nodes: ['gather'] }]; }],
      ['group-missing-node', (graph) => { graph.groups = [{ id: 'left', nodes: [] }]; }],
      ['group-missing-node', (graph) => { graph.groups = [{ id: 'left', nodes: ['gather', 'nobody'] }]; }],
      ['group-missing-node', (graph) => { graph.groups = [{ id: 'left', nodes: [7] }]; }],
      ['group-missing-node', (graph) => { graph.groups = [{ id: 'left' }]; }],
      ['bad-id', (graph) => { graph.groups = ['left']; }],
      ['explanation-missing-group', (graph) => { graph.explanation = 'See [the left branch](#left).'; }],
      ['group-unreferenced', (graph) => { graph.groups = [{ id: 'left', nodes: ['gather'] }]; }],
      ['group-bad-shape', (graph) => {
        graph.explanation = 'See [the left branch](#left).';
        graph.groups = [{ id: 'left', visible: 'yes', nodes: ['gather'] }];
      }],
      ['group-bad-shape', (graph) => {
        graph.explanation = 'See [the left branch](#left).';
        graph.groups = [{ id: 'left', label: 7, nodes: ['gather'] }];
      }],
      // An explicit null is a non-boolean, not an omission: the only key in this schema where the
      // two differ, so it is the only one that needs saying out loud.
      ['group-bad-shape', (graph) => {
        graph.explanation = 'See [the left branch](#left).';
        graph.groups = [{ id: 'left', visible: null, nodes: ['gather'] }];
      }],
      ['group-missing-label', (graph) => { graph.groups = [{ id: 'left', visible: true, note: 'Points to the branch.', nodes: ['gather'] }]; }],
      ['group-missing-note', (graph) => { graph.groups = [{ id: 'left', visible: true, label: 'The left branch', nodes: ['gather'] }]; }],
      ['group-hidden-text', (graph) => {
        graph.explanation = 'See [the left branch](#left).';
        graph.groups = [{ id: 'left', visible: false, label: 'The left branch', nodes: ['gather'] }];
      }],
      ['group-overlap', (graph) => {
        graph.groups = [
          { id: 'left', label: 'The left branch', note: 'Gathers the input.', visible: true, nodes: ['gather'] },
          { id: 'right', label: 'The right branch', note: 'Also gathers the input.', visible: true, nodes: ['gather'] },
        ];
      }],
    ]) {
      const graph = copy(state.graph); change(graph);
      expect(await graphPut(ctx, graph, state.hash), 422, code);
    }
    const invisibleOverlap = copy(state.graph);
    invisibleOverlap.explanation = 'See [the left branch](#left) and [the right branch](#right).';
    invisibleOverlap.groups = [
      { id: 'left', nodes: ['gather'] },
      { id: 'right', nodes: ['gather'] },
    ];
    expect(await graphPut(ctx, invisibleOverlap, state.hash), 200);
  });
});

test('ordinary markdown links in explanations do not require groups', async () => {
  await withFixture('canonical.json', async (ctx) => {
    const state = await getGraph(ctx); const graph = copy(state.graph);
    graph.explanation = 'Read [the router](protocol/routers.md) or [the site](https://example.com).';
    expect(await graphPut(ctx, graph, state.hash), 200);
  });
});

test('explanation accepts only strings or null', async () => {
  await withFixture('canonical.json', async (ctx) => {
    const state = await getGraph(ctx);
    for (const value of [42, { account: 'not a string' }]) {
      const graph = copy(state.graph); graph.explanation = value;
      expect(await graphPut(ctx, graph, state.hash), 422, 'unknown-schema');
    }
  });
});

test('both write routes enforce their distinct authority', async () => {
  await withFixture('canonical.json', async (ctx) => {
    let state = await getGraph(ctx);
    const view = copy(state.graph); entry(view, 'gather').x = 99.6; entry(view, 'gather').y = -0.5; entry(view, 'gather').origin = 'agreed';
    expect(await viewPut(ctx, view, state.hash), 200);
    state = await getGraph(ctx);
    assert.equal(entry(state.graph, 'gather').x, 100);
    assert.equal(entry(state.graph, 'gather').y, 0);
    for (const mutate of [
      (g) => g.nodes.push({ ...copy(g.nodes[0]), id: 'added-by-the-page' }),
      (g) => g.nodes.pop(),
      (g) => { g.nodes[0].label = 'changed'; },
      (g) => { g.edges[0].value = 'retyped'; },
    ]) {
      const changed = copy(state.graph); mutate(changed);
      expect(await viewPut(ctx, changed, state.hash), 422, 'structural-difference');
    }
    const badOrigin = copy(state.graph); entry(badOrigin, 'inspect').origin = 'mine';
    expect(await viewPut(ctx, badOrigin, state.hash), 422, 'bad-origin-value');
    const agent = copy(state.graph); entry(agent, 'inspect').x = 999; entry(agent, 'inspect').y = 888;
    expect(await graphPut(ctx, agent, state.hash), 200);
    const after = await getGraph(ctx);
    assert.equal(entry(after.graph, 'inspect').x, entry(state.graph, 'inspect').x);
    assert.equal(entry(after.graph, 'inspect').y, entry(state.graph, 'inspect').y);
  });
});

test('/view cannot alter explanation', async () => {
  await withFixture('canonical.json', async (ctx) => {
    const before = await fs.readFile(ctx.graphPath);
    const state = await getGraph(ctx); const graph = copy(state.graph);
    graph.explanation = 'The page must not replace the agent account.';
    expect(await viewPut(ctx, graph, state.hash), 422, 'structural-difference');
    assert.deepEqual(await fs.readFile(ctx.graphPath), before);
  });
});

test('/view cannot alter groups and accepts an untouched deep clone', async () => {
  await withFixture('canonical.json', async (ctx) => {
    let state = await getGraph(ctx); const grouped = copy(state.graph);
    grouped.explanation = 'See [the left branch](#left).';
    grouped.groups = [{ id: 'left', nodes: ['gather'] }];
    expect(await graphPut(ctx, grouped, state.hash), 200);

    state = await getGraph(ctx);
    expect(await viewPut(ctx, copy(state.graph), state.hash), 200);
    state = await getGraph(ctx);
    const changed = copy(state.graph); changed.groups[0].nodes = ['inspect'];
    expect(await viewPut(ctx, changed, state.hash), 422, 'structural-difference');
  });
});

test('optimistic concurrency returns and accepts the current hash, including create', async () => {
  await withFixture('canonical.json', async (ctx) => {
    const state = await getGraph(ctx); const first = copy(state.graph); entry(first, 'gather').note = 'agent change';
    const accepted = await graphPut(ctx, first, state.hash); expect(accepted, 200);
    const stale = await graphPut(ctx, state.graph, state.hash); expect(stale, 409, 'stale');
    assert.equal(stale.body.hash, accepted.body.hash);
    const retry = copy(first); entry(retry, 'inspect').note = 'retry';
    const retried = await graphPut(ctx, retry, stale.body.hash); expect(retried, 200);
    assert.equal((await getGraph(ctx)).hash, retried.body.hash);
  });
  const root = await makeDir(); const graphDir = path.join(root, 'graphs'); await fs.mkdir(graphDir, { recursive: true });
  const missing = path.join(graphDir, 'new.json'); const ctx = await startServer({ cacheRoot: root, open: missing });
  try {
    const graph = await readFixtureGraph('cycle-layout.json');
    expect(await graphPut(ctx, graph, ''), 200);
    expect(await graphPut(ctx, graph, ''), 409, 'stale');
  } finally { await ctx.stop(); }
});

test('an agent create cannot pre-rule entries or claim a reset record', async () => {
  const root = await makeDir(); const graphDir = path.join(root, 'graphs'); await fs.mkdir(graphDir, { recursive: true });
  const missing = path.join(graphDir, 'new.json'); const ctx = await startServer({ cacheRoot: root, open: missing });
  try {
    const graph = await readFixtureGraph('cycle-layout.json');
    const verdict = copy(graph); verdict.nodes[0].origin = 'agreed';
    expect(await graphPut(ctx, verdict, ''), 422, 'agent-verdict');
    const reset = copy(graph); reset.edges[0].was = 'agreed';
    expect(await graphPut(ctx, reset, ''), 422, 'bad-was');
    expect(await graphPut(ctx, graph, ''), 200);
  } finally { await ctx.stop(); }
});

test('node and edge kinds are closed sets while omitted kinds default', async () => {
  await withFixture('canonical.json', async (ctx) => {
    const state = await getGraph(ctx);
    const badNode = copy(state.graph); entry(badNode, 'gather').kind = 'action';
    const nodeResult = await graphPut(ctx, badNode, state.hash); expect(nodeResult, 422, 'bad-kind');
    assert.deepEqual(nodeResult.body.ids, ['gather']);
    const badEdge = copy(state.graph); entry(badEdge, 'gather->inspect').kind = 'reference';
    const edgeResult = await graphPut(ctx, badEdge, state.hash); expect(edgeResult, 422, 'bad-kind');
    assert.deepEqual(edgeResult.body.ids, ['gather->inspect']);
  });
  await withFixture('cycle-layout.json', async (ctx) => {
    const state = await getGraph(ctx);
    assert.equal(entry(state.graph, 'a').kind, 'note');
    assert.equal(entry(state.graph, 'a->b').kind, 'sequence');
  });
});

test('the global write lock serializes concurrent writes and retry retains both changes', async () => {
  await withFixture('canonical.json', async (ctx) => {
    const initial = await getGraph(ctx);
    const left = copy(initial.graph); entry(left, 'gather').note = 'left';
    const right = copy(initial.graph); entry(right, 'inspect').note = 'right';
    let reading = true; let reads = 0;
    const reader = (async () => {
      while (reading) {
        assert.doesNotThrow(() => JSON.parse(require('node:fs').readFileSync(ctx.graphPath, 'utf8')));
        reads += 1;
        await new Promise((resolve) => setImmediate(resolve));
      }
    })();
    const [a, b] = await Promise.all([graphPut(ctx, left, initial.hash), graphPut(ctx, right, initial.hash)]);
    reading = false; await reader; assert.ok(reads > 0);
    assert.equal([a.status, b.status].filter((status) => status === 200).length, 1);
    const stale = a.status === 409 ? a : b;
    const retry = copy((await getGraph(ctx)).graph); entry(retry, 'inspect').note = 'right';
    expect(await graphPut(ctx, retry, stale.body.hash), 200);
    const bytes = await fs.readFile(ctx.graphPath); assert.doesNotThrow(() => JSON.parse(bytes));
    assert.equal(entry((await getGraph(ctx)).graph, 'gather').note, 'left');
    assert.equal(entry((await getGraph(ctx)).graph, 'inspect').note, 'right');
  });
});

// Removing a node means removing the edges that named it: a graph that keeps them is malformed for
// a more basic reason, and the server refuses `edge-missing-node` before it reaches preservation.
function drop(graph, id) {
  graph.nodes = graph.nodes.filter((node) => node.id !== id);
  graph.edges = graph.edges.filter((edge) => edge.from !== id && edge.to !== id);
}

test('agent preservation protects agreed and rejected entries', async () => {
  await withFixture('verdicts.json', async (ctx) => {
    const state = await getGraph(ctx);
    for (const [id, code, change] of [
      ['agree', 'preservation-agreed', (g) => { drop(g, 'agree'); }],
      ['reject', 'preservation-rejected', (g) => { drop(g, 'reject'); }],
      ['reject', 'preservation-rejected', (g) => { entry(g, 'reject').origin = 'proposed'; }],
    ]) {
      const graph = copy(state.graph); change(graph); const result = await graphPut(ctx, graph, state.hash);
      expect(result, 422, code); assert.deepEqual(result.body.ids, [id]);
    }
    const allowed = copy(state.graph); entry(allowed, 'propose').note = 'agent may rewrite this';
    expect(await graphPut(ctx, allowed, state.hash), 200);
  });
});

test('PUT /graph ignores known positions and lays out new nodes', async () => {
  await withFixture('canonical.json', async (ctx) => {
    const state = await getGraph(ctx); const graph = copy(state.graph);
    entry(graph, 'gather').x = 12345; entry(graph, 'gather').y = -99;
    graph.nodes.push({ id: 'new', label: 'New', kind: 'note', origin: 'proposed', was: null, exclusive: false, ref: null, note: null, graph: null, x: 8, y: 9 });
    expect(await graphPut(ctx, graph, state.hash), 200);
    const stored = await getGraph(ctx);
    assert.deepEqual({ x: entry(stored.graph, 'gather').x, y: entry(stored.graph, 'gather').y }, { x: entry(state.graph, 'gather').x, y: entry(state.graph, 'gather').y });
    // Not `x !== 8`, and not Number.isInteger either: a layout that placed nothing leaves every
    // node on the 0 the validator defaults it to, which passes both. What no empty layout can pass
    // is a box actually standing clear of every other box.
    assert.notDeepEqual({ x: entry(stored.graph, 'new').x, y: entry(stored.graph, 'new').y },
      { x: 8, y: 9 }, 'a new id takes the position the layout assigns, not the one it was sent');
    assertNoOverlap(stored.graph);
  });
});

test('an all-new rewrite group moves itself clear instead of moving the picture on disk', async () => {
  await withFixture('canonical.json', async (ctx) => {
    let graph = await setPositions(ctx, (await getGraph(ctx)).graph,
      { gather: { x: 0, y: 0 }, inspect: { x: 1000, y: 0 }, report: { x: 2000, y: 0 }, store: { x: 3000, y: 0 } });
    const before = new Map(graph.nodes.map((item) => [item.id, { x: item.x, y: item.y }]));
    const next = copy(graph); next.nodes.push(node('new-a'), node('new-b'));
    next.edges.push({ id: 'new-a-gather', from: 'new-a', to: 'gather', label: '', kind: 'sequence', value: null,
      inferred: false, origin: 'proposed', was: null, note: null });
    next.groups = [visibleGroup('new-group', ['new-a', 'new-b'])];
    expect(await graphPut(ctx, next, (await getGraph(ctx)).hash), 200);
    graph = (await getGraph(ctx)).graph;
    for (const [id, point] of before) assert.deepEqual(position(graph, id), { ...position(graph, id), ...point });
    // gather's centre packs this two-member block first at (-130, 0) and (130, 0). Its box
    // crowds gather, so newcomer mode has to translate the block itself.
    assert.notDeepEqual({ x: position(graph, 'new-a').x, y: position(graph, 'new-a').y }, { x: -130, y: 0 });
    assert.notDeepEqual({ x: position(graph, 'new-b').x, y: position(graph, 'new-b').y }, { x: 130, y: 0 });
  });
});

test('a changed resident group evicts residents once and leaves its disk members still', async () => {
  await withFixture('canonical.json', async (ctx) => {
    let graph = await setPositions(ctx, (await getGraph(ctx)).graph,
      { gather: { x: 0, y: 0 }, inspect: { x: 260, y: 0 }, report: { x: 100, y: 0 }, store: { x: 900, y: 0 } });
    const next = copy(graph); next.groups = [visibleGroup('system', ['gather', 'inspect'])];
    expect(await graphPut(ctx, next, (await getGraph(ctx)).hash), 200);
    graph = (await getGraph(ctx)).graph;
    assert.deepEqual({ x: position(graph, 'gather').x, y: position(graph, 'gather').y }, { x: 0, y: 0 });
    assert.deepEqual({ x: position(graph, 'inspect').x, y: position(graph, 'inspect').y }, { x: 260, y: 0 });
    assert.notDeepEqual({ x: position(graph, 'report').x, y: position(graph, 'report').y }, { x: 100, y: 0 });
    assert.ok(clearsGroupBox(groupBox(graph, graph.groups[0]), nodeBox(graph, 'report')));
    const once = graph.nodes.map((item) => ({ id: item.id, x: item.x, y: item.y }));
    expect(await graphPut(ctx, graph, (await getGraph(ctx)).hash), 200);
    assert.deepEqual((await getGraph(ctx)).graph.nodes.map((item) => ({ id: item.id, x: item.x, y: item.y })), once);
  });
});

test('placement separates overlapping group rectangles and translates a visible-group victim whole', async () => {
  await withFixture('canonical.json', async (ctx) => {
    let graph = await setPositions(ctx, (await getGraph(ctx)).graph,
      { gather: { x: 0, y: 0 }, inspect: { x: 260, y: 0 }, report: { x: 230, y: 0 }, store: { x: 490, y: 0 } });
    const first = copy(graph); first.groups = [visibleGroup('later', ['report', 'store'])];
    expect(await graphPut(ctx, first, (await getGraph(ctx)).hash), 200);
    graph = (await getGraph(ctx)).graph;
    const initialDelta = { x: position(graph, 'store').x - position(graph, 'report').x,
      y: position(graph, 'store').y - position(graph, 'report').y };
    const next = copy(graph); next.groups.push(visibleGroup('anchor', ['gather', 'inspect']));
    expect(await graphPut(ctx, next, (await getGraph(ctx)).hash), 200);
    graph = (await getGraph(ctx)).graph;
    const anchor = graph.groups.find((group) => group.id === 'anchor'); const later = graph.groups.find((group) => group.id === 'later');
    assert.ok(clearsGroupBox(groupBox(graph, anchor), groupBox(graph, later)));
    assert.deepEqual({ x: position(graph, 'store').x - position(graph, 'report').x,
      y: position(graph, 'store').y - position(graph, 'report').y }, initialDelta);
  });
});

test('placement sees padding-only overlap between two group boxes', async () => {
  await withFixture('canonical.json', async (ctx) => {
    let graph = await setPositions(ctx, (await getGraph(ctx)).graph,
      { gather: { x: 0, y: 0 }, inspect: { x: 220, y: 0 }, report: { x: 1000, y: 0 }, store: { x: 2000, y: 0 } });
    const first = copy(graph); first.groups = [visibleGroup('later', ['inspect'])];
    expect(await graphPut(ctx, first, (await getGraph(ctx)).hash), 200);
    graph = await setPositions(ctx, (await getGraph(ctx)).graph, { gather: { x: 0, y: 0 }, inspect: { x: 220, y: 0 } });
    const later = graph.groups[0]; const anchor = visibleGroup('anchor', ['gather']);
    const anchorBox = groupBox(graph, anchor); const laterBox = groupBox(graph, later);
    // At 220px apart, the 24px padding overlaps by 28px. Neither 200px-wide member box is
    // wholly inside the other group box, so a pass that notices nodes rather than units misses it.
    assert.ok(anchorBox.x < laterBox.x + laterBox.w && laterBox.x < anchorBox.x + anchorBox.w);
    const contains = (outer, inner) => outer.x <= inner.x && outer.y <= inner.y &&
      outer.x + outer.w >= inner.x + inner.w && outer.y + outer.h >= inner.y + inner.h;
    assert.equal(contains(anchorBox, nodeBox(graph, 'inspect')), false);
    assert.equal(contains(laterBox, nodeBox(graph, 'gather')), false);
    const next = copy(graph); next.groups.push(anchor);
    expect(await graphPut(ctx, next, (await getGraph(ctx)).hash), 200);
    graph = (await getGraph(ctx)).graph;
    assert.ok(clearsGroupBox(groupBox(graph, graph.groups.find((group) => group.id === 'anchor')),
      groupBox(graph, graph.groups.find((group) => group.id === 'later'))));
  });
});

test('making a persisted invisible group visible starts placement without a membership change', async () => {
  await withFixture('canonical.json', async (ctx) => {
    let graph = await setPositions(ctx, (await getGraph(ctx)).graph,
      { gather: { x: 0, y: 0 }, inspect: { x: 260, y: 0 }, report: { x: 100, y: 0 }, store: { x: 1000, y: 0 } });
    const hidden = copy(graph); hidden.groups = [{ id: 'system', label: null, note: null, visible: false, nodes: ['gather', 'inspect'] }];
    hidden.explanation = 'The [system](#system) is present but hidden.';
    expect(await graphPut(ctx, hidden, (await getGraph(ctx)).hash), 200);
    graph = (await getGraph(ctx)).graph;
    const shown = copy(graph); Object.assign(shown.groups[0], { visible: true, label: 'system', note: 'system is visible.' });
    expect(await graphPut(ctx, shown, (await getGraph(ctx)).hash), 200);
    graph = (await getGraph(ctx)).graph;
    assert.notDeepEqual({ x: position(graph, 'report').x, y: position(graph, 'report').y }, { x: 100, y: 0 },
      'a false-to-true visibility transition is a changed group and evicts its intruder');
  });
});

test('when two resident groups arrive together, the earlier id is the anchor', async () => {
  await withFixture('canonical.json', async (ctx) => {
    let graph = await setPositions(ctx, (await getGraph(ctx)).graph,
      { gather: { x: 0, y: 0 }, inspect: { x: 220, y: 0 }, report: { x: 1000, y: 0 }, store: { x: 2000, y: 0 } });
    const next = copy(graph); next.groups = [visibleGroup('early', ['gather']), visibleGroup('later', ['inspect'])];
    expect(await graphPut(ctx, next, (await getGraph(ctx)).hash), 200);
    graph = (await getGraph(ctx)).graph;
    assert.deepEqual({ x: position(graph, 'gather').x, y: position(graph, 'gather').y }, { x: 0, y: 0 });
    assert.notDeepEqual({ x: position(graph, 'inspect').x, y: position(graph, 'inspect').y }, { x: 220, y: 0 });
  });
});

test('equal displacement directions prefer left before right, up, and down', async () => {
  await withFixture('canonical.json', async (ctx) => {
    let graph = await setPositions(ctx, (await getGraph(ctx)).graph,
      { gather: { x: 0, y: 0 }, inspect: { x: 0, y: 0 }, report: { x: 0, y: -194 }, store: { x: 0, y: 156 } });
    const next = copy(graph); next.groups = [visibleGroup('anchor', ['gather'])];
    expect(await graphPut(ctx, next, (await getGraph(ctx)).hash), 200);
    graph = (await getGraph(ctx)).graph;
    assert.deepEqual({ x: position(graph, 'inspect').x, y: position(graph, 'inspect').y }, { x: -240, y: 0 },
      'the vertical exits are blocked and left wins the equal horizontal displacement tie');
  });
});

test('ring-zero lattice cells enumerate by row and then column', async () => {
  await withFixture('canonical.json', async (ctx) => {
    let graph = await setPositions(ctx, (await getGraph(ctx)).graph,
      { gather: { x: 100, y: 100 }, inspect: { x: 360, y: 240 }, report: { x: 1000, y: 0 }, store: { x: 2000, y: 0 } });
    const first = copy(graph); first.groups = [visibleGroup('system', ['gather', 'inspect'])];
    expect(await graphPut(ctx, first, (await getGraph(ctx)).hash), 200);
    graph = await setPositions(ctx, (await getGraph(ctx)).graph,
      { gather: { x: 100, y: 100 }, inspect: { x: 360, y: 240 } });
    const expanded = copy(graph); expanded.nodes.push(node('new-member')); expanded.groups[0].nodes.push('new-member');
    expect(await graphPut(ctx, expanded, (await getGraph(ctx)).hash), 200);
    graph = (await getGraph(ctx)).graph;
    assert.deepEqual({ x: position(graph, 'new-member').x, y: position(graph, 'new-member').y }, { x: 360, y: 100 },
      'the first empty ring-zero cell is row 0, column 1 rather than row 1, column 0');
  });
});

test('a disk free node crowding an unchanged group stays put when another node is added', async () => {
  await withFixture('canonical.json', async (ctx) => {
    let graph = await setPositions(ctx, (await getGraph(ctx)).graph,
      { gather: { x: 0, y: 0 }, inspect: { x: 260, y: 0 }, report: { x: 1000, y: 0 }, store: { x: 2000, y: 0 } });
    const grouped = copy(graph); grouped.groups = [visibleGroup('system', ['gather', 'inspect'])];
    expect(await graphPut(ctx, grouped, (await getGraph(ctx)).hash), 200);
    graph = await setPositions(ctx, (await getGraph(ctx)).graph, { report: { x: 100, y: 0 } });
    const next = copy(graph); next.nodes.push(node('elsewhere'));
    expect(await graphPut(ctx, next, (await getGraph(ctx)).hash), 200);
    graph = (await getGraph(ctx)).graph;
    assert.deepEqual({ x: position(graph, 'report').x, y: position(graph, 'report').y }, { x: 100, y: 0 },
      'the pass ran for the new id but did not correct a free node already on disk');
  });
});

test('mixed-membership groups tuck a new member beside their disk members', async () => {
  await withFixture('canonical.json', async (ctx) => {
    let graph = await setPositions(ctx, (await getGraph(ctx)).graph,
      { gather: { x: 100, y: 100 }, inspect: { x: 360, y: 100 }, report: { x: 900, y: 0 }, store: { x: 1200, y: 0 } });
    const next = copy(graph); next.groups = [visibleGroup('system', ['gather', 'inspect'])];
    expect(await graphPut(ctx, next, (await getGraph(ctx)).hash), 200);
    graph = (await getGraph(ctx)).graph;
    const old = new Map(['gather', 'inspect'].map((id) => [id, { x: position(graph, id).x, y: position(graph, id).y }]));
    const expanded = copy(graph); expanded.nodes.push(node('new-member')); expanded.groups[0].nodes.push('new-member');
    expect(await graphPut(ctx, expanded, (await getGraph(ctx)).hash), 200);
    graph = (await getGraph(ctx)).graph;
    for (const [id, point] of old) assert.deepEqual({ x: position(graph, id).x, y: position(graph, id).y }, point);
    const newcomer = position(graph, 'new-member');
    assert.deepEqual({ x: newcomer.x, y: newcomer.y }, { x: -160, y: 100 },
      'above ring 0, the chosen empty cell adds the least area to the group box');
  });
});

test('all-new group packing uses its edge-neighbour anchor, not its pre-pack centroid', async () => {
  await withFixture('canonical.json', async (ctx) => {
    let graph = await setPositions(ctx, (await getGraph(ctx)).graph,
      { gather: { x: 10000, y: 500 }, inspect: { x: 0, y: 0 }, report: { x: 500, y: 0 }, store: { x: 800, y: 0 } });
    const next = copy(graph); next.nodes.push(node('new-a'), node('new-b'));
    next.edges.push({ id: 'new-a-gather', from: 'new-a', to: 'gather', label: '', kind: 'sequence', value: null,
      inferred: false, origin: 'proposed', was: null, note: null });
    next.groups = [visibleGroup('pair', ['new-a', 'new-b'])];
    expect(await graphPut(ctx, next, (await getGraph(ctx)).hash), 200);
    graph = (await getGraph(ctx)).graph;
    assert.equal(position(graph, 'new-b').x - position(graph, 'new-a').x, 260);
    assert.equal(position(graph, 'new-b').y, position(graph, 'new-a').y);
    const packedX = (position(graph, 'new-a').x + position(graph, 'new-b').x) / 2;
    // The centred block initially crowds its neighbour and newcomer mode moves it upward, but
    // not sideways. The members' pre-pack centroid is near the other component, not gather.x.
    assert.equal(packedX, position(graph, 'gather').x,
      'the packed block keeps the horizontal landing derived from its edge neighbour');
  });
});

test('a create keeps an all-new group anchored and moves a free node that crowds it', async () => {
  const created = await createGraph(inlineGraph(['a', 'b', 'free'], [visibleGroup('pair', ['a', 'b'])], [['a', 'free']]));
  try {
    const pair = created.graph.groups[0];
    assert.deepEqual({ x: position(created.graph, 'a').x, y: position(created.graph, 'a').y }, { x: 100, y: 0 },
      'resident mode keeps the create-time packed block at its anchor');
    assert.equal(position(created.graph, 'b').x - position(created.graph, 'a').x, 260);
    assert.equal(position(created.graph, 'b').y, position(created.graph, 'a').y);
    assert.deepEqual({ x: position(created.graph, 'free').x, y: position(created.graph, 'free').y }, { x: 0, y: 156 },
      'the free node starts at y=140, crowds the packed block, and is the unit that gives way');
    assert.ok(clearsGroupBox(groupBox(created.graph, pair), nodeBox(created.graph, 'free')));
  } finally { await created.ctx.stop(); }
});

test('a create is deterministic, keeps group-less layout intact, and permits matching group and node ids', async () => {
  const source = inlineGraph(['same', 'member', 'free'], [visibleGroup('same', ['member'])]);
  const first = await createGraph(copy(source)); const second = await createGraph(copy(source));
  try {
    assert.deepEqual(first.graph.nodes.map((item) => ({ id: item.id, x: item.x, y: item.y })),
      second.graph.nodes.map((item) => ({ id: item.id, x: item.x, y: item.y })));
  } finally { await first.ctx.stop(); await second.ctx.stop(); }
  const plain = inlineGraph(['a', 'b', 'c']); const noGroups = await createGraph(copy(plain));
  // The pass filters on `visible`, so the group-less bound above says nothing about an invisible
  // one — which every graph in the repo today has, and which must still lay out untouched.
  const invisible = inlineGraph(['a', 'b', 'c'], [{ id: 'pair', label: null, note: null, visible: false, nodes: ['a', 'b'] }]);
  invisible.explanation = 'The [first pair](#pair) leads.';
  const other = await createGraph(invisible);
  try {
    const expected = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 460, y: 0 }, { id: 'c', x: 920, y: 0 }];
    assert.deepEqual(noGroups.graph.nodes.map((item) => ({ id: item.id, x: item.x, y: item.y })), expected);
    assert.deepEqual(other.graph.nodes.map((item) => ({ id: item.id, x: item.x, y: item.y })), expected);
  } finally { await noGroups.ctx.stop(); await other.ctx.stop(); }
});

test('the movement search rejects a short blocked exit and lands exactly at the group gap', async () => {
  await withFixture('canonical.json', async (ctx) => {
    let graph = await setPositions(ctx, (await getGraph(ctx)).graph,
      { gather: { x: 0, y: 0 }, inspect: { x: 230, y: 0 }, report: { x: 450, y: 0 }, store: { x: 230, y: 250 } });
    const next = copy(graph); next.groups = [visibleGroup('anchor', ['gather'])];
    expect(await graphPut(ctx, next, (await getGraph(ctx)).hash), 200);
    graph = (await getGraph(ctx)).graph;
    const anchor = groupBox(graph, graph.groups[0]); const moved = nodeBox(graph, 'inspect');
    assert.equal(moved.y + moved.h + GROUP_GAP, anchor.y,
      'the short right exit is blocked, so the clear upward landing wins at exactly GROUP_GAP');
  });
});

test('an unchanged redraw preserves a dragged intruder, while a later resident evicts an earlier unchanged group', async () => {
  await withFixture('canonical.json', async (ctx) => {
    let graph = await setPositions(ctx, (await getGraph(ctx)).graph,
      { gather: { x: 0, y: 0 }, inspect: { x: 260, y: 0 }, report: { x: 900, y: 0 }, store: { x: 1200, y: 0 } });
    const grouped = copy(graph); grouped.groups = [visibleGroup('system', ['gather', 'inspect'])];
    expect(await graphPut(ctx, grouped, (await getGraph(ctx)).hash), 200);
    graph = await setPositions(ctx, (await getGraph(ctx)).graph, { report: { x: 100, y: 0 } });
    const dragged = { x: position(graph, 'report').x, y: position(graph, 'report').y };
    expect(await graphPut(ctx, graph, (await getGraph(ctx)).hash), 200);
    graph = (await getGraph(ctx)).graph;
    assert.deepEqual({ x: position(graph, 'report').x, y: position(graph, 'report').y }, dragged);
  });
  await withFixture('canonical.json', async (ctx) => {
    let graph = await setPositions(ctx, (await getGraph(ctx)).graph,
      { gather: { x: 230, y: 0 }, inspect: { x: 0, y: 0 }, report: { x: 260, y: 0 }, store: { x: 900, y: 0 } });
    const initial = copy(graph); initial.groups = [visibleGroup('early', ['gather']), visibleGroup('later', ['inspect'])];
    expect(await graphPut(ctx, initial, (await getGraph(ctx)).hash), 200);
    graph = await setPositions(ctx, (await getGraph(ctx)).graph,
      { gather: { x: 230, y: 0 }, inspect: { x: 0, y: 0 }, report: { x: 260, y: 0 } });
    const grown = copy(graph); grown.groups.find((group) => group.id === 'later').nodes.push('report');
    expect(await graphPut(ctx, grown, (await getGraph(ctx)).hash), 200);
    graph = (await getGraph(ctx)).graph;
    const early = graph.groups.find((group) => group.id === 'early'); const later = graph.groups.find((group) => group.id === 'later');
    assert.deepEqual({ x: position(graph, 'inspect').x, y: position(graph, 'inspect').y }, { x: 0, y: 0 });
    assert.deepEqual({ x: position(graph, 'report').x, y: position(graph, 'report').y }, { x: 260, y: 0 });
    assert.ok(clearsGroupBox(groupBox(graph, early), groupBox(graph, later)),
      'the changed later group evicts the unchanged earlier group instead of leaving boundaries overlapping');
  });
});

test('verdict reversal is page-only and agents reset agreed entries explicitly', async () => {
  await withFixture('verdicts.json', async (ctx) => {
    let state = await getGraph(ctx);
    const rejectedChange = copy(state.graph); entry(rejectedChange, 'reject').note = 'agent edit';
    expect(await graphPut(ctx, rejectedChange, state.hash), 422, 'preservation-rejected');
    const agreedChange = copy(state.graph); entry(agreedChange, 'agree').note = 'agent edit';
    expect(await graphPut(ctx, agreedChange, state.hash), 422, 'preservation-agreed');
    const reset = copy(state.graph); Object.assign(entry(reset, 'agree'), { origin: 'proposed', was: 'agreed', note: 'replacement' });
    expect(await graphPut(ctx, reset, state.hash), 200);
    // Only a person reverses a verdict, and only through the page's own route. Do it last: once
    // `reject` is agreed, an agent altering it is refused `preservation-agreed`, not
    // `preservation-rejected`, and asserting that first is what the reversal would invalidate.
    state = await getGraph(ctx); const page = copy(state.graph); entry(page, 'reject').origin = 'agreed';
    expect(await viewPut(ctx, page, state.hash), 200);
    assert.equal(entry((await getGraph(ctx)).graph, 'reject').origin, 'agreed');
  });
});

test('bulk verdicts are additive and one reversal is permitted', async () => {
  await withFixture('verdicts.json', async (ctx) => {
    let state = await getGraph(ctx); const approve = copy(state.graph);
    for (const item of [...approve.nodes, ...approve.edges]) if (item.origin === 'proposed') item.origin = 'agreed';
    expect(await viewPut(ctx, approve, state.hash), 200);
    state = await getGraph(ctx); const two = copy(state.graph);
    entry(two, 'agree').origin = 'rejected'; entry(two, 'reject').origin = 'agreed';
    expect(await viewPut(ctx, two, state.hash), 422, 'bulk-not-additive');
    const one = copy(state.graph); entry(one, 'agree').origin = 'rejected';
    expect(await viewPut(ctx, one, state.hash), 200);
  });
});

test('retargeting and dropping a container preserve verdict-bearing children', async () => {
  await withFixture('parent.json', async (ctx) => {
    await stage(ctx, 'child.json'); await stage(ctx, 'grandchild.json');
    const state = await getGraph(ctx); const other = copy(state.graph); entry(other, 'child-box').graph = 'other';
    expect(await graphPut(ctx, other, state.hash), 422, 'container-orphan');
    const none = copy(state.graph); entry(none, 'child-box').graph = null;
    expect(await graphPut(ctx, none, state.hash), 422, 'container-orphan');
    const dropped = copy(state.graph); dropped.nodes = dropped.nodes.filter((node) => node.id !== 'child-box');
    expect(await graphPut(ctx, dropped, state.hash), 422, 'container-orphan');
  });
});

test('container removal accepts proposed-only child and recursively finds grandchild verdicts', async () => {
  await withFixture('parent.json', async (ctx) => {
    const child = await readFixtureGraph('child.json'); child.nodes[0].graph = null;
    await fs.writeFile(path.join(ctx.graphDir, 'child.json'), JSON.stringify(child));
    let state = await getGraph(ctx); const drop = copy(state.graph); drop.nodes = drop.nodes.filter((node) => node.id !== 'child-box');
    expect(await graphPut(ctx, drop, state.hash), 200);
  });
  await withFixture('parent.json', async (ctx) => {
    await stage(ctx, 'child.json'); await stage(ctx, 'grandchild.json');
    const state = await getGraph(ctx); const drop = copy(state.graph); drop.nodes = drop.nodes.filter((node) => node.id !== 'child-box');
    expect(await graphPut(ctx, drop, state.hash), 422, 'container-orphan');
  });
});

test('all containment retarget cases, cycles, deep acyclic writes, and missing children follow the contract', async () => {
  await withFixture('parent.json', async (ctx) => {
    let state = await getGraph(ctx); const missing = copy(state.graph); entry(missing, 'child-box').graph = 'ghost';
    expect(await graphPut(ctx, missing, state.hash), 200);
    const served = await getGraph(ctx); assert.equal(served.children.ghost, false);
    const invalid = copy(served.graph); entry(invalid, 'child-box').graph = '../bad';
    expect(await graphPut(ctx, invalid, served.hash), 422, 'container-bad-name');
  });
  await withFixture('parent.json', async (ctx) => {
    let state = await getGraph(ctx); const detach = copy(state.graph); entry(detach, 'child-box').graph = null;
    expect(await graphPut(ctx, detach, state.hash), 200);
    state = await getGraph(ctx); const attach = copy(state.graph); entry(attach, 'child-box').graph = 'new-child';
    expect(await graphPut(ctx, attach, state.hash), 200);
  });
  await withFixture('parent.json', async (ctx) => {
    const state = await getGraph(ctx); const self = copy(state.graph); entry(self, 'child-box').graph = 'parent';
    expect(await graphPut(ctx, self, state.hash), 422, 'container-cycle');
  });
  await withFixture('parent.json', async (ctx) => {
    for (let number = 1; number <= 7; number += 1) {
      await fs.writeFile(path.join(ctx.graphDir, `deep-${number}.json`), JSON.stringify(childGraph(`deep-${number}`, number === 7 ? null : `deep-${number + 1}`)));
    }
    const state = await getGraph(ctx); const deep = copy(state.graph); entry(deep, 'child-box').graph = 'deep-1';
    expect(await graphPut(ctx, deep, state.hash), 200);
  });
});

test('retargeting away unregisters a derivable child and unreadable children block removal', async () => {
  await withFixture('parent.json', async (ctx) => {
    const childPath = await stage(ctx, 'child.json'); const child = await getGraph(ctx, childPath); assert.ok(child.hash);
    let parent = await getGraph(ctx); const graph = copy(parent.graph); entry(graph, 'child-box').graph = null;
    expect(await graphPut(ctx, graph, parent.hash), 200);
    expect(await viewPut(ctx, child.graph, child.hash, childPath), 403, 'not-registered');
  });
  await withFixture('parent.json', async (ctx) => {
    await stage(ctx, 'child.json'); await fs.writeFile(path.join(ctx.graphDir, 'child.json'), '{ broken');
    const parent = await getGraph(ctx); const graph = copy(parent.graph); entry(graph, 'child-box').graph = null;
    expect(await graphPut(ctx, graph, parent.hash), 422, 'container-unreadable-child');
  });
});

test('whoami is unauthenticated identity, never a mutation credential', async () => {
  await withFixture('canonical.json', async (ctx) => {
    const who = await request(ctx, '/whoami', { graphPath: undefined, token: undefined }); expect(who, 200);
    assert.match(who.body.start_id, /^[0-9a-f]{32}$/); assert.notEqual(who.body.start_id, ctx.token);
    const graph = (await getGraph(ctx)).graph;
    expect(await viewPut(ctx, graph, (await getGraph(ctx)).hash, ctx.graphPath, { token: who.body.start_id }), 401, 'bad-token');
  });
});

test('--show opens a browser once, and never while a tab is already on that graph', async () => {
  // The whole point of the not-while-watched rule: an agent redrawing a graph every turn must not
  // stack up browser windows. An open tab picks the new version up on its own poll within a second.
  const first = await startFixture('canonical.json');
  const repoRoot = path.resolve(__dirname, '..', '..');
  const record = path.join(first.root, 'launched.txt');
  const opener = path.join(first.root, 'fake-browser.sh');
  await fs.writeFile(opener, `#!/usr/bin/env bash\necho "$1" >> ${record}\n`, { mode: 0o755 });

  const show = (extraArgs = [], env = {}) => new Promise((resolve) => {
    const child = spawn(process.execPath,
      ['viewer/server.js', '--cache-root', first.root, '--port', String(first.port),
       '--show', first.graphPath, ...extraArgs],
      { cwd: repoRoot, stdio: 'ignore', env: { ...process.env, WHEELCHAIR_BROWSER: opener, ...env } });
    child.once('exit', resolve);
  });
  const launches = async () => {
    try { return (await fs.readFile(record, 'utf8')).trim().split('\n').filter(Boolean); }
    catch { return []; }
  };

  try {
    await show();
    await new Promise((resolve) => setTimeout(resolve, 400));
    const opened = await launches();
    assert.equal(opened.length, 1, '--show on an unwatched graph opens exactly one window');
    assert.ok(opened[0].includes(encodeURIComponent(first.graphPath)), 'the URL names the graph');
    assert.ok(opened[0].includes(first.token), 'the URL carries the token the page needs');

    // A page polling GET /graph is what marks the graph as watched.
    await getGraph(first);
    await show();
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal((await launches()).length, 1, 'a second --show must not open a window over a live tab');

    // And the escape hatch, for anyone on a headless box.
    await fs.rm(record, { force: true });
    await show(['--no-browser']);
    await show([], { WHEELCHAIR_NO_BROWSER: '1' });
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.deepEqual(await launches(), [], '--no-browser and WHEELCHAIR_NO_BROWSER both suppress it');
  } finally { await first.stop(); }
});

test('two starts at the same instant leave one server, and the loser reuses it rather than dying', async () => {
  // The winner claims the lockfile, then prunes the registered set and binds — a window of
  // milliseconds in which its pid is alive and /whoami is silent, which is exactly what an
  // unrelated live process looks like. Treating the loser's view as foreign killed it outright,
  // and two agent lanes drawing graphs in one turn is an ordinary thing in this workflow.
  const root = await makeDir(); const graphDir = path.join(root, 'graphs');
  await fs.mkdir(graphDir, { recursive: true });
  const repoRoot = path.resolve(__dirname, '..', '..');
  // Both racers share one port and one cache root — that is the race. It must be a *free* port,
  // not the default: a viewer the person left running on 7373 would otherwise fail this test with
  // EADDRINUSE and look like the regression it is written to catch.
  const racePort = await freePort();
  const spawnStart = (name) => spawn(process.execPath,
    ['viewer/server.js', '--cache-root', root, '--port', String(racePort), '--open', path.join(graphDir, name)],
    { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });

  const racers = [spawnStart('one.json'), spawnStart('two.json')];
  const errors = racers.map(() => '');
  racers.forEach((child, index) => {
    child.stdout.resume();
    child.stderr.on('data', (chunk) => { errors[index] += chunk.toString(); });
  });
  try {
    await new Promise((resolve) => setTimeout(resolve, 4500));
    const died = racers.filter((child) => child.exitCode !== null && child.exitCode !== 0);
    assert.deepEqual(died.map((child) => errors[racers.indexOf(child)]), [],
      'neither starter may die; one becomes the server and the other reuses it');
    assert.equal(racers.filter((child) => child.exitCode === null).length, 1,
      'exactly one process stays up as the server');
    assert.equal(racers.filter((child) => child.exitCode === 0).length, 1,
      'the other exits cleanly, having reused it');
  } finally {
    for (const child of racers) {
      if (child.exitCode === null) { child.kill('SIGKILL'); await waitForExit(child); }
    }
  }
});

test('discovery reuses matching locks, reclaims dead locks, and rejects foreign live locks', async () => {
  const first = await startFixture('canonical.json');
  try {
    const second = await startServer({ cacheRoot: first.root, open: first.graphPath, port: first.port });
    assert.equal(second.port, first.port); assert.equal(second.token, first.token);
    if (second.child.exitCode === null) await new Promise((resolve) => second.child.once('exit', resolve));
    first.child.kill('SIGKILL'); await new Promise((resolve) => first.child.once('exit', resolve));
    const replacement = await startServer({ cacheRoot: first.root, open: first.graphPath, port: await freePort() });
    await replacement.stop();
  } finally { await first.stop(); }
  const root = await makeDir(); await fs.mkdir(path.join(root, 'graphs'), { recursive: true });
  const sleeper = spawn('sleep', ['10']); const foreignPort = await freePort();
  await fs.writeFile(path.join(root, '.server'), JSON.stringify({ pid: sleeper.pid, port: foreignPort, token: '0'.repeat(64), start_id: '1'.repeat(32) }));
  const candidate = spawn(process.execPath, ['viewer/server.js', '--port', String(await freePort()), '--cache-root', root], { cwd: path.resolve(__dirname, '../..') });
  const code = await new Promise((resolve) => candidate.once('exit', resolve)); sleeper.kill('SIGKILL');
  assert.notEqual(code, 0);
});

test('a second starter sees a complete lock or no lock during an atomic claim', async () => {
  const root = await makeDir(); const graphDir = path.join(root, 'graphs'); await fs.mkdir(graphDir, { recursive: true });
  const graphPath = await stage({ graphDir }, 'canonical.json'); const marker = path.join(root, 'lock-claim-window');
  const hookPath = await writeFaultHook(root); const firstPort = await freePort(); const secondPort = await freePort();
  const first = spawnHookedServer({ root, graphPath, port: firstPort, hookPath, marker, mode: 'lock-claim-window' });
  let second;
  try {
    await waitForFile(marker);
    let observation;
    try {
      const lock = JSON.parse(await fs.readFile(path.join(root, '.server'), 'utf8'));
      observation = { kind: 'complete', lock };
    } catch (error) { observation = { kind: error.code === 'ENOENT' ? 'absent' : 'corrupt' }; }
    assert.ok(observation.kind === 'absent' || observation.kind === 'complete',
      `the claim window exposed ${observation.kind}, not a usable lock or no lock`);
    if (observation.kind === 'complete') {
      assert.match(observation.lock.token, /^[0-9a-f]{64}$/);
      assert.match(observation.lock.start_id, /^[0-9a-f]{32}$/);
    }
    second = await startServer({ cacheRoot: root, open: graphPath, port: secondPort });
    const firstUrl = waitForServerUrl(first);
    await fs.writeFile(`${marker}.release`, 'continue');
    const lock = JSON.parse(await fs.readFile(path.join(root, '.server'), 'utf8'));
    assert.equal(lock.pid, second.child.pid);
    assert.equal(lock.port, secondPort);
    assert.match(lock.token, /^[0-9a-f]{64}$/);
    assert.match(lock.start_id, /^[0-9a-f]{32}$/);
    assert.match(await firstUrl, new RegExp(`^http://127\\.0\\.0\\.1:${secondPort}/\\?`));
  } finally {
    if (second) await second.stop();
    if (first.exitCode === null) first.kill('SIGKILL');
    await waitForExit(first);
    await fs.unlink(path.join(root, '.server')).catch(() => {});
  }
});

test('GET change detection exposes agent hashes and preserves the page write hash', async () => {
  await withFixture('canonical.json', async (ctx) => {
    let state = await getGraph(ctx); const agent = copy(state.graph); entry(agent, 'gather').note = 'agent';
    const agentWrite = await graphPut(ctx, agent, state.hash); expect(agentWrite, 200);
    state = await getGraph(ctx); assert.equal(state.hash, agentWrite.body.hash);
    const page = copy(state.graph); entry(page, 'inspect').origin = 'agreed';
    const pageWrite = await viewPut(ctx, page, state.hash); expect(pageWrite, 200);
    assert.equal((await getGraph(ctx)).hash, pageWrite.body.hash);
  });
});

test('a kill before rename leaves the committed graph as either whole version, never a partial write', async () => {
  const oldBytes = await fixture('canonical.json');
  let newBytes;
  await withFixture('canonical.json', async (ctx) => {
    const state = await getGraph(ctx); const graph = copy(state.graph); entry(graph, 'gather').note = 'atomic candidate';
    expect(await graphPut(ctx, graph, state.hash), 200);
    newBytes = await fs.readFile(ctx.graphPath);
  });
  for (const delay of [0, 3, 9]) {
    const root = await makeDir(); const graphDir = path.join(root, 'graphs'); await fs.mkdir(graphDir, { recursive: true });
    const graphPath = await stage({ graphDir }, 'canonical.json'); const marker = path.join(root, 'before-rename');
    const hookPath = await writeFaultHook(root); const port = await freePort();
    const child = spawnHookedServer({ root, graphPath, port, hookPath, marker, mode: 'before-rename' });
    try {
      const parsed = new URL(await waitForServerUrl(child));
      const ctx = { root, graphDir, graphPath, port, child, url: `http://127.0.0.1:${port}`,
        token: parsed.searchParams.get('token') };
      const state = await getGraph(ctx); const graph = copy(state.graph); entry(graph, 'gather').note = 'atomic candidate';
      const write = graphPut(ctx, graph, state.hash).catch((error) => error);
      await waitForFile(marker);
      await new Promise((resolve) => setTimeout(resolve, delay));
      child.kill('SIGKILL'); await waitForExit(child);
      const outcome = await write;
      assert.ok(outcome instanceof Error || outcome.status !== 200, 'the injected kill must interrupt the write');
      const bytes = await fs.readFile(graphPath);
      assert.doesNotThrow(() => JSON.parse(bytes.toString('utf8')));
      assert.ok(bytes.equals(oldBytes) || bytes.equals(newBytes), 'the committed graph is an exact old or new version');
      assert.equal(path.basename(graphPath), 'canonical.json', 'a temporary name is never the committed graph');
      const recovery = await startServer({ cacheRoot: root, open: graphPath, port: await freePort() });
      try {
        const recovered = await getGraph(recovery); const successful = copy(recovered.graph);
        entry(successful, 'gather').note = 'post-kill cleanup';
        expect(await graphPut(recovery, successful, recovered.hash), 200);
        const leftovers = (await fs.readdir(graphDir)).filter((name) =>
          /^\.canonical\.json\.[0-9a-f]{8}\.tmp$/.test(name));
        assert.deepEqual(leftovers, [], 'a successful write must sweep a killed write\'s stale sibling');
      } finally { await recovery.stop(); }
    } finally {
      if (child.exitCode === null) child.kill('SIGKILL');
      await waitForExit(child);
      await fs.unlink(path.join(root, '.server')).catch(() => {});
    }
  }
});

test('registered paths are pruned by age at startup', async () => {
  const root = await makeDir(); const graphDir = path.join(root, 'graphs'); await fs.mkdir(graphDir, { recursive: true });
  const old = await stage({ graphDir }, 'canonical.json', 'old.json'); const recent = await stage({ graphDir }, 'canonical.json', 'recent.json'); const opened = await stage({ graphDir }, 'canonical.json', 'opened.json');
  await fs.writeFile(path.join(root, '.registered'), JSON.stringify({ [old]: { added: Date.now() - 31 * 86400000, opened: false }, [recent]: { added: Date.now(), opened: false } }));
  const ctx = await startServer({ cacheRoot: root, open: opened });
  try { const entries = JSON.parse(await fs.readFile(path.join(root, '.registered'))); assert.ok(!entries[old]); assert.ok(entries[recent]); } finally { await ctx.stop(); }
});

test('agent reset records are durable and page verdicts clear them only while changing origin', async () => {
  await withFixture('verdicts.json', async (ctx) => {
    let state = await getGraph(ctx); const reset = copy(state.graph); Object.assign(entry(reset, 'agree'), { origin: 'proposed', was: 'agreed' });
    expect(await graphPut(ctx, reset, state.hash), 200); state = await getGraph(ctx); assert.equal(entry(state.graph, 'agree').was, 'agreed');
    const badSet = copy(state.graph); entry(badSet, 'propose').was = 'agreed'; expect(await viewPut(ctx, badSet, state.hash), 422, 'bad-was');
    const badClear = copy(state.graph); entry(badClear, 'agree').was = null; expect(await viewPut(ctx, badClear, state.hash), 422, 'bad-was');
    const person = copy(state.graph); Object.assign(entry(person, 'agree'), { origin: 'agreed', was: null }); expect(await viewPut(ctx, person, state.hash), 200);
    assert.equal(entry((await getGraph(ctx)).graph, 'agree').was, null);
  });
});

test('malformed on-disk graphs refuse without repair', async () => {
  for (const [name, code, extra] of [
    ['bad-json.json', 'invalid-json', 'position'], ['bad-schema.json', 'unknown-schema', 'schema'],
    ['dangling-edge.json', 'edge-missing-node', null], ['no-label.json', 'missing-label', null],
  ]) await withFixture(name, async (ctx) => {
    const bytes = await fs.readFile(ctx.graphPath); const result = await request(ctx, '/graph'); expect(result, 422, code);
    if (extra) assert.ok(Object.hasOwn(result.body, extra)); assert.deepEqual(await fs.readFile(ctx.graphPath), bytes);
  });
});

// Every arrow pointing the same way is most of what makes a first render readable: a layout that
// puts a node on the first row it is reached on, rather than one below its deepest parent, leaves
// arrows running back up the page and reads as a tangle before anything has been dragged.
test('layout runs downhill: an arrow never points back up the page', async () => {
  const root = await makeDir(); const graphDir = path.join(root, 'graphs'); await fs.mkdir(graphDir, { recursive: true });
  const ctx = await startServer({ cacheRoot: root, open: path.join(graphDir, 'downhill.json') });
  try {
    // Shaped to catch exactly that: `end` is one hop from `start` and also three hops around
    // through the branch, so a layout that takes the first row it reaches `end` on puts it above
    // `far`, and the arrow from `far` runs backwards into it.
    const graph = {
      schema: 1, title: 'Downhill', source: 'code-read', source_detail: null, explanation: null,
      nodes: [{ id: 'start', label: 'Start' }, { id: 'near', label: 'Near' },
        { id: 'far', label: 'Far' }, { id: 'end', label: 'End' }],
      edges: [
        { id: 'start->end', from: 'start', to: 'end', label: 'straight there' },
        { id: 'start->near', from: 'start', to: 'near', label: 'the long way' },
        { id: 'near->far', from: 'near', to: 'far', label: 'onward' },
        { id: 'far->end', from: 'far', to: 'end', label: 'and in' },
      ],
    };
    expect(await graphPut(ctx, graph, ''), 200);
    const stored = (await getGraph(ctx)).graph;
    const at = new Map(stored.nodes.map((node) => [node.id, node]));
    for (const edge of stored.edges) {
      assert.ok(at.get(edge.to).y > at.get(edge.from).y,
        `${edge.id} points from row ${at.get(edge.from).y} to row ${at.get(edge.to).y}`);
    }
    assertNoOverlap(stored);
  } finally { await ctx.stop(); }
});

test('a fresh layout keeps consecutive rows 140 pixels apart', async () => {
  const root = await makeDir(); const graphDir = path.join(root, 'graphs'); await fs.mkdir(graphDir, { recursive: true });
  const ctx = await startServer({ cacheRoot: root, open: path.join(graphDir, 'pitch.json') });
  try {
    const graph = {
      schema: 1, title: 'Pitch', source: 'code-read', source_detail: null, explanation: null,
      nodes: [{ id: 'first', label: 'First' }, { id: 'second', label: 'Second' }, { id: 'third', label: 'Third' }],
      edges: [
        { id: 'first->second', from: 'first', to: 'second', label: 'then' },
        { id: 'second->third', from: 'second', to: 'third', label: 'then' },
      ],
    };
    expect(await graphPut(ctx, graph, ''), 200);
    const at = new Map((await getGraph(ctx)).graph.nodes.map((node) => [node.id, node]));
    assert.equal(at.get('second').y - at.get('first').y, 140);
    assert.equal(at.get('third').y - at.get('second').y, 140);
  } finally { await ctx.stop(); }
});

test('layout places every component, including a disconnected two-cycle', async () => {
  const root = await makeDir(); const graphDir = path.join(root, 'graphs'); await fs.mkdir(graphDir, { recursive: true }); const target = path.join(graphDir, 'layout.json');
  const ctx = await startServer({ cacheRoot: root, open: target });
  try {
    const graph = await readFixtureGraph('cycle-layout.json'); expect(await graphPut(ctx, graph, ''), 200);
    const stored = await getGraph(ctx);
    const at = new Map(stored.graph.nodes.map((node) => [node.id, { x: node.x, y: node.y }]));
    assert.deepEqual([...at.keys()].sort(), ['a', 'b', 'c', 'x', 'y']);
    assertNoOverlap(stored.graph);
    // a->b->c is a chain, so it reads top to bottom one row apart.
    assert.ok(at.get('a').y < at.get('b').y && at.get('b').y < at.get('c').y, 'a chain runs downward');
    // x and y are a two-cycle sharing no edge with the chain. Side by side, not stacked under it:
    // stacked reads as a flow from c into x, which is not what the graph says.
    const chainRight = Math.max(at.get('a').x, at.get('b').x, at.get('c').x);
    const cycleLeft = Math.min(at.get('x').x, at.get('y').x);
    assert.ok(cycleLeft > chainRight, 'a disconnected component stands beside the rest, not below it');
    assert.equal(at.get('x').y, 0, 'and starts at the top row of its own');
  } finally { await ctx.stop(); }
});

test('cache-root isolation never changes the live default cache', async () => {
  const live = path.join(os.homedir(), '.cache', 'agent-graphs');
  async function snapshot(dir, relative = '') {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const result = {};
      for (const item of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        const target = path.join(dir, item.name); const key = path.join(relative, item.name);
        if (item.isDirectory()) Object.assign(result, await snapshot(target, key));
        else result[key] = sha256(await fs.readFile(target));
      }
      return result;
    } catch (error) { return error.code === 'ENOENT' ? null : { error: error.code || String(error) }; }
  }
  const before = await snapshot(live);
  await withFixture('canonical.json', async (ctx) => { assert.notEqual(ctx.root, live); await getGraph(ctx); });
  const after = await snapshot(live);
  assert.deepEqual(after, before);
});
