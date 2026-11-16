'use strict';

// Fixture for the Features, Agents and Terminal page specs: a real server, two live fake
// machine services (hub and node-2), one dead machine (node-3), and seeded thread files.
const fs = require('node:fs/promises');
const path = require('node:path');
const { freePort, makeDir, startServer } = require('./server.js');
const { startMachine } = require('./app-machine.js');

async function seedThreads(context) {
  const origin = new URL(context.server.url).origin;
  const headers = { 'content-type': 'application/json', 'x-graph-token': context.server.token, origin };
  const post = async (route, secret, body) => {
    const response = await fetch(`${context.server.url}/api${route}`, {
      method: 'POST',
      headers: secret ? { 'content-type': 'application/json', 'x-wheelchair-machine-secret': secret } : headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`${route} ${response.status} ${await response.text()}`);
    return response.json();
  };
  const features = [
    ['idea-one', null, 'hub'],
    ['plan-one', 'planning', 'hub'],
    ['review-one', 'ready-for-review', 'hub'],
    ['build-one', 'implementing', 'hub'],
    ['verify-one', 'verifying', 'hub'],
    ['done-one', 'done', 'node-2'],
  ];
  const made = {};
  for (const [slug, status, machine] of features) {
    const thread = await post('/threads', null, { project: '/tmp/proj-alpha', cli: 'codex', machine });
    const worktree = path.join(context.state, 'worktrees', slug);
    await fs.mkdir(path.join(worktree, 'docs', 'plans', slug), { recursive: true });
    if (status) {
      await fs.writeFile(path.join(worktree, 'docs', 'plans', slug, 'PLAN.md'), `---\nstatus: ${status}\n---\n`);
    }
    const file = path.join(context.state, 'threads', `${thread.id}.json`);
    const stored = JSON.parse(await fs.readFile(file, 'utf8'));
    Object.assign(stored, { worktree, slug });
    await fs.writeFile(file, JSON.stringify(stored));
    made[slug] = stored;
  }
  const lead = (slug) => made[slug].sessions[0].name;
  const question = await post('/machine/cards', context.hub.secret, {
    thread_id: made['plan-one'].id,
    session: lead('plan-one'),
    kind: 'question',
    fits: 'Planning',
    question: 'Who does a stuck worker ask?',
    options: [
      { id: 'a', label: 'The lead', consequence: 'Fast' },
      { id: 'b', label: 'Collin', consequence: 'Slow' },
    ],
    leaning: 'a',
    why: 'Fewer interruptions.',
  });
  const approval = await post('/machine/cards', context.hub.secret, {
    thread_id: made['review-one'].id,
    session: lead('review-one'),
    kind: 'approval',
    objections: [],
    ready: { ok: true, missing: [] },
  });
  return { made, question, approval };
}

async function setupViews() {
  const state = await makeDir('app-views-state-');
  const hub = await startMachine();
  const second = await startMachine();
  const deadPort = await freePort();
  const machine = (name, port, secret) => ({ name, address: '127.0.0.1', port, secret });
  await fs.writeFile(path.join(state, 'machines.json'), JSON.stringify({
    hub: machine('hub', hub.port, hub.secret),
    'node-2': machine('node-2', second.port, second.secret),
    'node-3': { ...machine('node-3', deadPort, 'unused'), last_seen: '2030-06-15T12:00:00.000Z' },
  }));
  const server = await startServer({ stateDir: state });
  const context = { state, hub, second, server };
  context.seed = await seedThreads(context);
  return context;
}

async function closeViews(context) {
  await context.server.stop();
  await context.hub.stop();
  await context.second.stop();
}

// The app pages need the remember cookie; the list page sets it when opened with the token.
async function openPage(page, context, route) {
  const signIn = new URL(`${context.server.url}/`);
  signIn.searchParams.set('token', context.server.token);
  await page.goto(signIn.toString());
  await page.goto(`${context.server.url}${route}`);
}

module.exports = { closeViews, openPage, setupViews };
