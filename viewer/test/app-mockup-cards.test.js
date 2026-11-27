'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { makeTemp } = require('../../test-support/run-dir');
const { validate } = require('../app/card');
const { acceptCard } = require('../app/cards');

const diagram = { plan: 'p', graph: 'screen', title: 'Screen', format: 'mockup', width: 390, height: 844 };
const image = { path: '/tmp/picture.png', title: 'Built', mockup: { graph: 'screen', width: 390, height: 844 } };
test('mockup fields and roles are validated', () => {
  const ok = (kind, card, role) => validate(kind, card, role).ok;
  assert.ok(ok('diagram', diagram, 'lead'));
  for (const format of ['html', 'graph', 'form', undefined]) assert.equal(ok('diagram', { ...diagram, format }, 'lead'), false);
  for (const key of ['width', 'height']) {
    const missing = { ...diagram }; delete missing[key]; assert.equal(ok('diagram', missing, 'lead'), false);
    for (const value of [199, 2561, 200.5]) assert.equal(ok('diagram', { ...diagram, [key]: value }, 'lead'), false);
  }
  assert.ok(ok('image', image, 'sub-lead'));
  for (const role of ['worker', 'designer']) assert.equal(ok('image', image, role), false);
  for (const mockup of [{ ...image.mockup, extra: true }, { ...image.mockup, width: 199 }, { ...image.mockup, height: 2561 }]) assert.equal(ok('image', { ...image, mockup }, 'lead'), false);
  assert.ok(ok('message', { to: 'lead', text: 'hello' }, 'designer'));
  assert.ok(ok('result', { task: 'T', outcome: 'done', summary: 'done' }, 'designer'));
  assert.ok(ok('lesson', { action: 'add', for: 'designer', text: 'text', why: 'why' }, 'lead'));
});

test('CLI checks mockup files before asking for a token', async () => {
  const dir = await makeTemp('mockup-cli-');
  execFileSync('git', ['init', '-q', dir]);
  const file = path.join(dir, 'card.json'); await fs.writeFile(file, JSON.stringify(diagram));
  const run = () => spawnSync(process.execPath, [path.resolve(__dirname, '../app/card.js'), 'diagram', file], { cwd: dir, env: { ...process.env, WHEELCHAIR_SESSION_TOKEN: '' }, encoding: 'utf8' });
  let result = run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /mockup file does not exist/);
  const graphs = path.join(dir, 'docs/plans/p/graphs'); await fs.mkdir(graphs, { recursive: true });
  await fs.writeFile(path.join(graphs, 'screen.html'), Buffer.alloc(2 * 1024 * 1024 + 1));
  result = run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /exceeds 2 MiB/);
});

test('CLI refuses a graph diagram the viewer would not draw, before asking for a token', async () => {
  const dir = await makeTemp('graph-cli-');
  execFileSync('git', ['init', '-q', dir]);
  const file = path.join(dir, 'card.json');
  await fs.writeFile(file, JSON.stringify({ kind: 'diagram', plan: 'p', graph: 'flow', title: 'Flow' }));
  const run = () => spawnSync(process.execPath, [path.resolve(__dirname, '../app/card.js'), 'diagram', file], { cwd: dir, env: { ...process.env, WHEELCHAIR_SESSION_TOKEN: '' }, encoding: 'utf8' });
  let result = run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /graph file does not exist/);
  const graphs = path.join(dir, 'docs/plans/p/graphs'); await fs.mkdir(graphs, { recursive: true });
  const graph = JSON.parse(await fs.readFile(path.join(__dirname, 'fixtures/canonical.json'), 'utf8'));
  await fs.writeFile(path.join(graphs, 'flow.json'), JSON.stringify(graph));
  result = run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /WHEELCHAIR_SESSION_TOKEN is required/);
  graph.groups = [...(graph.groups || []), { id: 'held', label: 'held back', nodes: [graph.nodes[0].id] }];
  await fs.writeFile(path.join(graphs, 'flow.json'), JSON.stringify(graph));
  result = run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /group-hidden-text \(held\)/);
  await fs.writeFile(path.join(graphs, 'flow.json'), '{');
  result = run(); assert.notEqual(result.status, 0); assert.match(result.stderr, /invalid-json/);
});

test('hub discovers and stores the plan while checking mockup files', { timeout: 5000 }, async () => {
  const dir = await makeTemp('mockup-hub-');
  execFileSync('git', ['init', '-q', dir]);
  const graphs = path.join(dir, 'docs/plans/p/graphs'); await fs.mkdir(graphs, { recursive: true });
  const file = path.join(graphs, 'screen.html'); await fs.writeFile(file, Buffer.alloc(2 * 1024 * 1024 + 1));
  const thread = { id: 'thread', worktree: dir, project: dir, cards: [], pinned: {}, sessions: [] };
  const session = { name: 'sub', role: 'sub-lead' }; thread.sessions.push(session);
  const hub = { updateThread: async (_, fn) => fn(thread), session: () => session, registerPlan: async () => {} };
  const payload = { ...image, kind: 'image', thread_id: thread.id, session: session.name };
  await assert.rejects(acceptCard(hub, payload), /exceeds 2 MiB/);
  thread.slug = undefined; await fs.writeFile(file, '<html></html>');
  const card = await acceptCard(hub, payload); assert.equal(thread.slug, 'p'); assert.deepEqual(card.mockup, image.mockup); assert.equal(thread.cards.length, 1);
});
