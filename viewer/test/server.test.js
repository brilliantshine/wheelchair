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
const marker = process.env.GRAPH_TEST_MARKER;
const mode = process.env.GRAPH_TEST_HOOK;
function mark() { fs.writeFileSync(marker, 'ready'); }
function pause() { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000); }
if (mode === 'lock-close') {
  const closeSync = fs.closeSync;
  let paused = false;
  fs.closeSync = function(fd) {
    const result = closeSync.call(this, fd);
    if (!paused) { paused = true; mark(); pause(); }
    return result;
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

test('both write routes enforce their distinct authority', async () => {
  await withFixture('canonical.json', async (ctx) => {
    let state = await getGraph(ctx);
    const view = copy(state.graph); entry(view, 'gather').x = 99.6; entry(view, 'gather').origin = 'agreed';
    expect(await viewPut(ctx, view, state.hash), 200);
    state = await getGraph(ctx);
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
    assert.ok(Number.isInteger(entry(stored.graph, 'new').x)); assert.ok(Number.isInteger(entry(stored.graph, 'new').y));
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

test('the exclusive lock claim is never observable without its identity payload', async () => {
  const root = await makeDir(); const graphDir = path.join(root, 'graphs'); await fs.mkdir(graphDir, { recursive: true });
  const graphPath = await stage({ graphDir }, 'canonical.json'); const marker = path.join(root, 'lock-closed');
  const hookPath = await writeFaultHook(root); const port = await freePort();
  const first = spawnHookedServer({ root, graphPath, port, hookPath, marker, mode: 'lock-close' });
  try {
    await waitForFile(marker);
    await assert.rejects(startServer({ cacheRoot: root, open: graphPath, port: await freePort() }));
    const firstUrl = await waitForServerUrl(first);
    const lock = JSON.parse(await fs.readFile(path.join(root, '.server'), 'utf8'));
    assert.equal(lock.pid, first.pid);
    assert.equal(lock.port, port);
    assert.match(lock.token, /^[0-9a-f]{64}$/);
    assert.match(lock.start_id, /^[0-9a-f]{32}$/);
    assert.match(firstUrl, new RegExp(`^http://127\\.0\\.0\\.1:${port}/\\?`));
  } finally {
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

test('layout places every component, including a disconnected two-cycle', async () => {
  const root = await makeDir(); const graphDir = path.join(root, 'graphs'); await fs.mkdir(graphDir, { recursive: true }); const target = path.join(graphDir, 'layout.json');
  const ctx = await startServer({ cacheRoot: root, open: target });
  try {
    const graph = await readFixtureGraph('cycle-layout.json'); expect(await graphPut(ctx, graph, ''), 200);
    const stored = await getGraph(ctx); for (const node of stored.graph.nodes) { assert.ok(Number.isInteger(node.x), node.id); assert.ok(Number.isInteger(node.y), node.id); }
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
