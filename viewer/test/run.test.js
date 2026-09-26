'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const {
  fixture, makeDir, stage, startServer, request, getGraph, put, copy,
} = require('./helpers/server');

async function startRun(name = 'run-basic.json', target = 'run.json') {
  const root = await makeDir('run-'); const graphDir = path.join(root, 'graphs');
  await fs.mkdir(graphDir, { recursive: true });
  const graphPath = await stage({ graphDir }, name, target);
  return startServer({ cacheRoot: root, open: graphPath });
}

async function withRun(work, name, target) {
  const ctx = await startRun(name, target);
  try { return await work(ctx); } finally { await ctx.stop(); }
}

function node(graph, id) { return graph.nodes.find((item) => item.id === id); }
async function graphPut(ctx, graph, hash, graphPath) { return put(ctx, '/graph', graph, hash, graphPath); }
async function viewPut(ctx, graph, hash, graphPath) { return put(ctx, '/view', graph, hash, graphPath); }
function expect(result, code) { assert.equal(result.status, 422, JSON.stringify(result.body)); assert.equal(result.body.error, code); }

test('legacy canonical bytes remain unchanged, while a run graph writes its explicit fields', async () => {
  const legacy = JSON.parse((await fixture('canonical.json')).toString());
  await withRun(async (ctx) => {
    const state = await getGraph(ctx); const next = copy(state.graph);
    const result = await graphPut(ctx, next, state.hash); assert.equal(result.status, 200, JSON.stringify(result.body));
    const bytes = await fs.readFile(ctx.graphPath, 'utf8');
    assert.match(bytes, /"run": true/); assert.match(bytes, /"task": "T1"/);
  });
  assert.equal(legacy.run, undefined);
});

test('run validation refuses each new schema violation', async () => {
  const cases = [
    ['unknown-schema', (graph) => { graph.run = 'yes'; }],
    ['run-field', (graph) => { graph.run = false; }],
    ['run-field-shape', (graph) => { node(graph, 'a').task = ''; }],
    ['bad-status', (graph) => { node(graph, 'a').status = 'waiting'; }],
    ['status-without-task', (graph) => { node(graph, 'a').task = null; }],
    ['needs-missing', (graph) => { Object.assign(node(graph, 'a'), { status: 'needs-you', needs: null }); }],
    ['needs-missing', (graph) => { Object.assign(node(graph, 'a'), { status: 'needs-you', needs: '' }); }],
    ['needs-hidden', (graph) => { node(graph, 'a').needs = 'log in'; }],
    ['needs-hidden', (graph) => { node(graph, 'a').needs = ''; }],
    ['choice-shape', (graph) => { Object.assign(node(graph, 'a'), { kind: 'choice', status: null }); graph.edges = []; }],
    ['container-status', (graph) => { Object.assign(node(graph, 'a'), { graph: 'run-child' }); }],
  ];
  for (const [code, mutate] of cases) await withRun(async (ctx) => {
    const state = await getGraph(ctx); const graph = copy(state.graph); mutate(graph);
    expect(await graphPut(ctx, graph, state.hash), code);
  });
  await withRun(async (ctx) => {
    const state = await getGraph(ctx); const graph = copy(state.graph);
    for (const item of graph.nodes) Object.assign(item, { task: null, status: null, needs: null }); graph.run = false;
    expect(await graphPut(ctx, graph, state.hash), 'run-name');
  });
});

test('agent progress preserves ruled entries and the page may not change it', async () => {
  await withRun(async (ctx) => {
    let state = await getGraph(ctx); let page = copy(state.graph); node(page, 'a').origin = 'agreed';
    assert.equal((await viewPut(ctx, page, state.hash)).status, 200);
    state = await getGraph(ctx); let agent = copy(state.graph); node(agent, 'a').status = 'done';
    assert.equal((await graphPut(ctx, agent, state.hash)).status, 200);
    state = await getGraph(ctx); page = copy(state.graph); node(page, 'b').origin = 'rejected';
    assert.equal((await viewPut(ctx, page, state.hash)).status, 200);
    state = await getGraph(ctx); agent = copy(state.graph); node(agent, 'b').status = 'in-progress';
    assert.equal((await graphPut(ctx, agent, state.hash)).status, 200);
    state = await getGraph(ctx); page = copy(state.graph); node(page, 'a').status = 'in-progress';
    expect(await viewPut(ctx, page, state.hash), 'structural-difference');
  });
});

test('run and plain chain layouts keep their respective axes and spacing', async () => {
  const chain = JSON.parse((await fixture('run-basic.json')).toString());
  chain.nodes.push({ ...copy(node(chain, 'b')), id: 'c', label: 'third', task: 'T3' });
  chain.edges.push({ ...copy(chain.edges[0]), id: 'b-c', from: 'b', to: 'c' });
  await withRun(async (ctx) => {
    await fs.unlink(ctx.graphPath);
    assert.equal((await graphPut(ctx, chain, '')).status, 200);
    const graph = (await getGraph(ctx)).graph;
    for (const [from, to] of [['a', 'b'], ['b', 'c']]) {
      assert.equal(node(graph, to).x - node(graph, from).x, 320);
      assert.equal(node(graph, from).y, node(graph, to).y);
    }
  });
  await withRun(async (ctx) => {
    const plain = copy(chain); plain.run = false;
    for (const item of plain.nodes) Object.assign(item, { task: null, status: null, needs: null });
    await fs.unlink(ctx.graphPath);
    assert.equal((await graphPut(ctx, plain, '')).status, 200);
    const graph = (await getGraph(ctx)).graph;
    for (const [from, to] of [['a', 'b'], ['b', 'c']]) {
      assert.equal(node(graph, from).x, node(graph, to).x);
      assert.equal(node(graph, to).y - node(graph, from).y, 140);
    }
  }, 'run-basic.json', 'plain-chain.json');
});

test('a task-only run update keeps every position, including a drag', async () => {
  await withRun(async (ctx) => {
    const initialBody = JSON.parse((await fixture('run-basic.json')).toString()); await fs.unlink(ctx.graphPath);
    assert.equal((await graphPut(ctx, initialBody, '')).status, 200);
    let state = await getGraph(ctx); const initial = state.graph;
    const page = copy(initial); node(page, 'a').x = 901; node(page, 'a').y = 337;
    assert.equal((await viewPut(ctx, page, state.hash)).status, 200);
    state = await getGraph(ctx); const before = Object.fromEntries(state.graph.nodes.map((item) => [item.id, { x: item.x, y: item.y }]));
    const progress = copy(state.graph); node(progress, 'a').task = 'T99';
    assert.equal((await graphPut(ctx, progress, state.hash)).status, 200);
    state = await getGraph(ctx);
    assert.deepEqual(Object.fromEntries(state.graph.nodes.map((item) => [item.id, { x: item.x, y: item.y }])), before);
  });
});

test('a progress-only write keeps a dragged position, and an added edge lays the picture out again', async () => {
  await withRun(async (ctx) => {
    const initialBody = JSON.parse((await fixture('run-basic.json')).toString()); await fs.unlink(ctx.graphPath);
    assert.equal((await graphPut(ctx, initialBody, '')).status, 200);
    let state = await getGraph(ctx); const initial = state.graph;
    const page = copy(initial); node(page, 'a').x = 901; node(page, 'a').y = 337;
    assert.equal((await viewPut(ctx, page, state.hash)).status, 200);
    state = await getGraph(ctx); const progress = copy(state.graph); Object.assign(node(progress, 'a'), { label: 'start after login', status: 'needs-you', needs: 'log in again' });
    assert.equal((await graphPut(ctx, progress, state.hash)).status, 200);
    state = await getGraph(ctx); assert.deepEqual({ x: node(state.graph, 'a').x, y: node(state.graph, 'a').y }, { x: 901, y: 337 });
    const relayout = copy(state.graph); relayout.edges.push({ id: 'b-a', from: 'b', to: 'a', label: '', kind: 'sequence', value: null, inferred: false, origin: 'proposed', was: null, note: null });
    assert.equal((await graphPut(ctx, relayout, state.hash)).status, 200);
    state = await getGraph(ctx); assert.notDeepEqual({ x: node(state.graph, 'a').x, y: node(state.graph, 'a').y }, { x: 901, y: 337 });
  });
});

test('rollups, nesting, updated, and the list run path follow run-picture rules', async () => {
  await withRun(async (ctx) => {
    let state = await getGraph(ctx); const root = copy(state.graph);
    Object.assign(node(root, 'b'), { graph: 'run-child', task: null, status: null, needs: null });
    assert.equal((await graphPut(ctx, root, state.hash)).status, 200);
    const childPath = path.join(ctx.graphDir, 'run-child.json');
    const child = JSON.parse((await fixture('run-child.json')).toString());
    Object.assign(child.nodes[0], { task: null, status: null, needs: null });
    await fs.writeFile(childPath, JSON.stringify(child));
    state = await getGraph(ctx); assert.deepEqual(state.rollups['run-child'], { status: null, needs: [], cut: false });
    Object.assign(child.nodes[0], { task: 'T1', status: 'needs-you', needs: 'renew access' });
    child.nodes.push({ ...copy(child.nodes[0]), id: 'done', label: 'completed work', task: 'T2', status: 'done', needs: null });
    await fs.writeFile(childPath, JSON.stringify(child));
    state = await getGraph(ctx); assert.deepEqual(state.rollups['run-child'], { status: 'needs-you', needs: [{ id: 'child', label: 'child work', needs: 'renew access' }], cut: false });
    const before = state.updated; await new Promise((resolve) => setTimeout(resolve, 15)); await fs.utimes(path.join(ctx.graphDir, 'run-child.json'), new Date(), new Date());
    state = await getGraph(ctx); assert.ok(state.updated > before);
    child.nodes = [child.nodes[0]];
    Object.assign(child.nodes[0], { status: 'not-started', needs: null });
    await fs.writeFile(path.join(ctx.graphDir, 'run-child.json'), JSON.stringify(child));
    state = await getGraph(ctx); assert.equal(state.rollups['run-child'].status, 'not-started');
    child.nodes[0].status = 'in-progress'; await fs.writeFile(path.join(ctx.graphDir, 'run-child.json'), JSON.stringify(child));
    state = await getGraph(ctx); assert.equal(state.rollups['run-child'].status, 'in-progress');
    child.nodes[0].status = 'needs-you'; child.nodes[0].needs = 'renew access';
    await fs.writeFile(path.join(ctx.graphDir, 'run-child.json'), JSON.stringify(child));
    state = await getGraph(ctx); assert.deepEqual(state.rollups['run-child'], { status: 'needs-you', needs: [{ id: 'child', label: 'child work', needs: 'renew access' }], cut: false });
    await fs.rm(path.join(ctx.graphDir, 'run-child.json')); state = await getGraph(ctx); assert.equal(state.rollups['run-child'].cut, true);
    await fs.mkdir(path.join(ctx.graphDir, 'run-child.json')); state = await getGraph(ctx); assert.equal(state.rollups['run-child'].cut, true);
    await fs.rm(path.join(ctx.graphDir, 'run-child.json'), { recursive: true });
    const plain = JSON.parse((await fixture('canonical.json')).toString());
    root.nodes.find((item) => item.id === 'b').graph = 'run-x';
    state = await getGraph(ctx);
    assert.equal((await graphPut(ctx, root, state.hash)).status, 200);
    await fs.writeFile(path.join(ctx.graphDir, 'run-x.json'), JSON.stringify(plain));
    state = await getGraph(ctx); assert.deepEqual(state.rollups['run-x'], { status: null, needs: [], cut: true });

    const plan = path.join(ctx.root, 'repo', 'docs', 'plans', 'example'); await fs.mkdir(path.join(plan, 'graphs'), { recursive: true });
    await fs.writeFile(path.join(plan, 'PLAN.md'), '---\nstatus: implementing\n---\n');
    await fs.writeFile(path.join(plan, 'graphs', 'run.json'), JSON.stringify({ run: true }));
    await fs.writeFile(path.join(ctx.root, '.plans'), JSON.stringify({ [plan]: { added: 1, session: null, harness: 'other' } }));
    let list = await request(ctx, '/list', { graphPath: undefined }); assert.equal(list.status, 200); assert.equal(list.body.plans[0].run, path.join(plan, 'graphs', 'run.json'));
    await fs.writeFile(path.join(plan, 'graphs', 'run.json'), '{ broken'); list = await request(ctx, '/list', { graphPath: undefined }); assert.equal(list.body.plans[0].run, null);
    await fs.writeFile(path.join(plan, 'graphs', 'run.json'), JSON.stringify({ run: false })); list = await request(ctx, '/list', { graphPath: undefined }); assert.equal(list.body.plans[0].run, null);
  });
});

test('run nesting and reserved names are refused on registered paths', async () => {
  await withRun(async (ctx) => {
    let state = await getGraph(ctx); const graph = copy(state.graph); Object.assign(node(graph, 'a'), { graph: 'run-child', task: null, status: null, needs: null });
    expect(await graphPut(ctx, graph, state.hash), 'run-nesting');
  }, 'run-basic.json', 'run-a.json');
  await withRun(async (ctx) => {
    const state = await getGraph(ctx); const graph = copy(state.graph); Object.assign(node(graph, 'a'), { graph: 'other', task: null, status: null, needs: null });
    expect(await graphPut(ctx, graph, state.hash), 'run-nesting');
  });
  await withRun(async (ctx) => {
    const state = await getGraph(ctx); const graph = copy(state.graph);
    for (const item of graph.nodes) Object.assign(item, { task: null, status: null, needs: null }); graph.run = false;
    expect(await graphPut(ctx, graph, state.hash), 'run-name');
  }, 'run-basic.json', 'run-A.json');
});
