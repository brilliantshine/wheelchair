'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const fssync = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const test = require('node:test');

const { ROOT, makeDir, freePort, startServer, request } = require('./helpers/server');
const HOOK = path.join(ROOT, 'viewer/test/hooks/lifecycle.js');

function run(args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['viewer/server.js', ...args], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject); child.once('exit', (code) => resolve({ code, stdout, stderr }));
  });
}

function launch(args, env = process.env) {
  const child = spawn(process.execPath, ['--require', HOOK, 'viewer/server.js', ...args], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(stderr)), 5000);
    child.stdout.on('data', () => { if (/^https?:\/\//m.test(stdout)) { clearTimeout(timer); resolve(); } });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`exited ${code}: ${stderr}`)); });
  });
  return { child, ready, output: () => ({ stdout, stderr }) };
}

async function stop(child) {
  if (child.exitCode === null) child.kill('SIGTERM');
  await new Promise((resolve) => { const timer = setTimeout(resolve, 1500); child.once('exit', () => { clearTimeout(timer); resolve(); }); });
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function listen(port, handler) {
  const server = http.createServer(handler);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return server;
}

function registrationHeaders(token, bytes, origin, timestamp = String(Date.now())) {
  return { origin, 'content-type': 'application/json', 'x-graph-timestamp': timestamp,
    'x-graph-signature': crypto.createHmac('sha256', token).update(`${timestamp}\n`).update(bytes).digest('hex') };
}

async function register(ctx, body, headers = {}) {
  const bytes = JSON.stringify(body);
  const response = await fetch(`${ctx.url}/register`, { method: 'POST', body: bytes,
    headers: { ...registrationHeaders(ctx.token, bytes, ctx.url), ...headers } });
  return { status: response.status, body: await response.json() };
}

test('open, show, and register-plan use the server registration writer', async () => {
  const root = await makeDir(); const port = await freePort(); const graph = path.join(root, 'graphs', 'other.json');
  const plan = path.join(root, 'repo', 'docs', 'plans', 'remote-viewer'); await fs.mkdir(path.dirname(graph), { recursive: true }); await fs.mkdir(plan, { recursive: true });
  const ctx = await startServer({ cacheRoot: root, port });
  try {
    assert.equal((await run(['--cache-root', root, '--port', String(port), '--open', graph])).code, 0);
    assert.equal((await run(['--cache-root', root, '--port', String(port), '--show', graph, '--no-browser'])).code, 0);
    assert.equal((await run(['--cache-root', root, '--port', String(port), '--register-plan', plan])).code, 0);
    const graphs = JSON.parse(await fs.readFile(path.join(root, '.registered'))); const plans = JSON.parse(await fs.readFile(path.join(root, '.plans')));
    assert.equal(graphs[graph].opened, true); assert.ok(['other', 'claude', 'codex'].includes(graphs[graph].harness));
    assert.ok(plans[plan]);
    const before = await Promise.all([fs.readFile(path.join(root, '.registered')), fs.readFile(path.join(root, '.plans'))]); const outside = path.join(await makeDir('outside-'), 'outside.json'); await fs.writeFile(outside, '{}');
    assert.equal((await run(['--cache-root', root, '--port', String(port), '--open', outside])).code, 1);
    assert.deepEqual(await Promise.all([fs.readFile(path.join(root, '.registered')), fs.readFile(path.join(root, '.plans'))]), before);
  } finally { await ctx.stop(); }
});

test('register rejects unsigned, stale, foreign-origin, and out-of-scope paths', async () => {
  const root = await makeDir(); const ctx = await startServer({ cacheRoot: root, port: await freePort() });
  const graph = path.join(root, 'graphs', 'allowed.json'); await fs.mkdir(path.dirname(graph), { recursive: true });
  try {
    const unsigned = await register(ctx, { kind: 'graph', path: graph, opened: true, session: null, harness: 'other' }, { 'x-graph-signature': '' });
    assert.equal(unsigned.status, 401);
    const bad = await register(ctx, { kind: 'graph', path: graph, opened: true, session: null, harness: 'other' }, { 'x-graph-signature': '0'.repeat(64) });
    assert.equal(bad.status, 401);
    const stale = await register(ctx, { kind: 'graph', path: graph, opened: true, session: null, harness: 'other' }, { ...registrationHeaders(ctx.token, JSON.stringify({ kind: 'graph', path: graph, opened: true, session: null, harness: 'other' }), ctx.url, String(Date.now() - 61000)) });
    assert.equal(stale.status, 401);
    const foreign = await register(ctx, { kind: 'graph', path: graph, opened: true, session: null, harness: 'other' }, { origin: 'https://foreign.invalid' });
    assert.equal(foreign.status, 403);
    const outside = await register(ctx, { kind: 'graph', path: '/tmp/outside.json', opened: true, session: null, harness: 'other' });
    assert.equal(outside.status, 400); assert.equal(outside.body.error, 'bad-path');
  } finally { await ctx.stop(); }
});

test('a refused POST /register leaves .registered and .plans byte-identical', async () => {
  const root = await makeDir(); const ctx = await startServer({ cacheRoot: root, port: await freePort() });
  const registered = path.join(root, '.registered'); const plans = path.join(root, '.plans');
  try {
    await fs.writeFile(registered, '{}\n'); await fs.writeFile(plans, '{}\n');
    const before = await Promise.all([fs.readFile(registered), fs.readFile(plans)]);
    const result = await register(ctx, { kind: 'graph', path: '/tmp/refused.json', opened: true, session: null, harness: 'other' });
    assert.equal(result.status, 400); assert.equal(result.body.error, 'bad-path');
    assert.deepEqual(await Promise.all([fs.readFile(registered), fs.readFile(plans)]), before);
  } finally { await ctx.stop(); }
});

test('commands reuse a proven server and register without exposing its token', async () => {
  const root = await makeDir(); const port = await freePort(); const graph = path.join(root, 'graphs', 'reused.json'); await fs.mkdir(path.dirname(graph), { recursive: true });
  const plan = path.join(root, 'repo', 'docs', 'plans', 'slug'); await fs.mkdir(plan, { recursive: true });
  const ctx = await startServer({ cacheRoot: root, port });
  try {
    const open = await run(['--cache-root', root, '--port', String(port), '--open', graph]); assert.equal(open.code, 0, open.stderr);
    const planResult = await run(['--cache-root', root, '--port', String(port), '--register-plan', plan]); assert.equal(planResult.code, 0, planResult.stderr);
    const graphs = JSON.parse(await fs.readFile(path.join(root, '.registered'))); const plans = JSON.parse(await fs.readFile(path.join(root, '.plans')));
    assert.equal(graphs[graph].opened, true); assert.ok(plans[plan]);
  } finally { await ctx.stop(); }
});

test('--register-plan is best effort and never starts a server', async () => {
  const root = await makeDir(); const port = await freePort(); const plan = path.join(root, 'repo', 'docs', 'plans', 'slug'); await fs.mkdir(plan, { recursive: true });
  const result = await run(['--cache-root', root, '--port', String(port), '--register-plan', plan]);
  assert.equal(result.code, 0); await assert.rejects(fs.access(path.join(root, '.server')));
});

test('--open records the caller tmux session, while a missing tmux records null', async () => {
  const root = await makeDir(); const port = await freePort(); const graphDir = path.join(root, 'graphs'); await fs.mkdir(graphDir, { recursive: true });
  const bin = path.join(root, 'bin'); await fs.mkdir(bin); const tmux = path.join(bin, 'tmux');
  await fs.writeFile(tmux, "#!/bin/sh\nprintf 'work-session\\n'\n", { mode: 0o755 });
  const ctx = await startServer({ cacheRoot: root, port });
  try {
    const first = path.join(graphDir, 'session.json');
    const firstResult = await run(['--cache-root', root, '--port', String(port), '--open', first], { ...process.env, TMUX: 'yes', TMUX_PANE: '%1', PATH: `${bin}:${process.env.PATH}` });
    assert.equal(firstResult.code, 0, firstResult.stderr);
    let entries = JSON.parse(await fs.readFile(path.join(root, '.registered'))); assert.equal(entries[first].session, 'work-session');
    const second = path.join(graphDir, 'no-session.json');
    const secondResult = await run(['--cache-root', root, '--port', String(port), '--open', second], { ...process.env, TMUX: '', PATH: `${bin}:${process.env.PATH}` });
    assert.equal(secondResult.code, 0, secondResult.stderr);
    entries = JSON.parse(await fs.readFile(path.join(root, '.registered'))); assert.equal(entries[second].session, null);
  } finally { await ctx.stop(); }
});

test('a failing tmux lookup records a null session', async () => {
  const root = await makeDir(); const port = await freePort(); const graph = path.join(root, 'graphs', 'tmux-fails.json'); const bin = path.join(root, 'bin-fail'); await fs.mkdir(path.dirname(graph), { recursive: true }); await fs.mkdir(bin);
  await fs.writeFile(path.join(bin, 'tmux'), '#!/bin/sh\nexit 1\n', { mode: 0o755 }); const ctx = await startServer({ cacheRoot: root, port });
  try {
    const result = await run(['--cache-root', root, '--port', String(port), '--open', graph], { ...process.env, TMUX: 'yes', TMUX_PANE: '%1', PATH: bin }); assert.equal(result.code, 0, result.stderr);
    assert.equal(JSON.parse(await fs.readFile(path.join(root, '.registered')))[graph].session, null);
  } finally { await ctx.stop(); }
});

test('twenty concurrent opens all land in the running server registry', async () => {
  const root = await makeDir(); const port = await freePort(); const graphDir = path.join(root, 'graphs'); await fs.mkdir(graphDir, { recursive: true });
  const ctx = await startServer({ cacheRoot: root, port });
  try {
    const paths = Array.from({ length: 20 }, (_, index) => path.join(graphDir, `parallel-${index}.json`));
    const results = await Promise.all(paths.map((graph) => run(['--cache-root', root, '--port', String(port), '--open', graph])));
    assert.ok(results.every((result) => result.code === 0));
    const entries = JSON.parse(await fs.readFile(path.join(root, '.registered')));
    for (const graph of paths) assert.equal(entries[graph].opened, true);
  } finally { await ctx.stop(); }
});

test('simultaneous first opens register their own paths and a later plan', async () => {
  const root = await makeDir(); const port = await freePort(); const graphDir = path.join(root, 'graphs'); await fs.mkdir(graphDir, { recursive: true });
  const paths = Array.from({ length: 4 }, (_, index) => path.join(graphDir, `first-${index}.json`));
  const starters = paths.map((graph) => launch(['--cache-root', root, '--port', String(port), '--open', graph], { ...process.env, GRAPH_TEST_HOOK: 'delay-listen-callback' }));
  try {
    await Promise.all(starters.map(({ ready }) => ready.catch(() => null)));
    const plan = path.join(root, 'repo', 'docs', 'plans', 'slug'); await fs.mkdir(plan, { recursive: true });
    const planResult = await run(['--cache-root', root, '--port', String(port), '--register-plan', plan]); assert.equal(planResult.code, 0, planResult.stderr);
    const entries = JSON.parse(await fs.readFile(path.join(root, '.registered'))); for (const graph of paths) assert.equal(entries[graph].opened, true);
    assert.ok(JSON.parse(await fs.readFile(path.join(root, '.plans')))[plan]);
  } finally { await Promise.all(starters.map(({ child }) => stop(child))); }
});

test('a failed listener never changes either pre-existing list', async () => {
  const root = await makeDir(); const port = await freePort(); const graph = path.join(root, 'graphs', 'failed.json'); await fs.mkdir(path.dirname(graph), { recursive: true });
  const registered = path.join(root, '.registered'); const plans = path.join(root, '.plans'); await fs.writeFile(registered, '{"kept":true}\n'); await fs.writeFile(plans, '{"kept":true}\n');
  const before = await Promise.all([fs.readFile(registered), fs.readFile(plans), fs.stat(registered), fs.stat(plans)]); const holder = await listen(port, (_request, response) => response.destroy());
  try {
    const result = await run(['--cache-root', root, '--port', String(port), '--open', graph]); assert.equal(result.code, 1);
    const after = await Promise.all([fs.readFile(registered), fs.readFile(plans), fs.stat(registered), fs.stat(plans)]); assert.deepEqual(after.slice(0, 2), before.slice(0, 2)); assert.equal(after[2].mtimeMs, before[2].mtimeMs); assert.equal(after[3].mtimeMs, before[3].mtimeMs);
  } finally { await new Promise((resolve) => holder.close(resolve)); }
});

test('a plan first graph creates its missing graphs directory and registers', async () => {
  const root = await makeDir(); const port = await freePort(); const plan = path.join(root, 'repo', 'docs', 'plans', 'first'); const graph = path.join(plan, 'graphs', 'first.json'); await fs.mkdir(plan, { recursive: true });
  const ctx = await startServer({ cacheRoot: root, port, open: graph });
  try {
    await fs.access(path.join(plan, 'graphs'));
    assert.equal(JSON.parse(await fs.readFile(path.join(root, '.registered')))[graph].opened, true);
  } finally { await ctx.stop(); }
});

test('show signs watching without sending the token', async () => {
  const root = await makeDir(); const port = await freePort(); const token = 'a'.repeat(64); const startId = 'b'.repeat(32); const graph = path.join(root, 'graphs', 'show.json'); await fs.mkdir(path.dirname(graph), { recursive: true });
  await fs.writeFile(path.join(root, '.token'), `${token}\n`); await fs.writeFile(path.join(root, '.server'), JSON.stringify({ pid: process.pid, port, token, start_id: startId }));
  const requests = []; const holder = await listen(port, (request, response) => {
    requests.push({ url: request.url, headers: request.headers });
    if (request.url.startsWith('/whoami')) {
      const nonce = new URL(request.url, 'http://localhost').searchParams.get('nonce');
      response.end(JSON.stringify({ start_id: startId, pid: process.pid, proof: crypto.createHmac('sha256', token).update(nonce).digest('hex') }));
    } else { response.end(JSON.stringify({ ok: true, watched: false })); }
  });
  try {
    const result = await run(['--cache-root', root, '--port', String(port), '--show', graph], { ...process.env, WHEELCHAIR_BROWSER: '/definitely/not/a/browser' }); assert.equal(result.code, 0, result.stderr);
    const watching = requests.find((item) => item.url.startsWith('/watching')); assert.ok(watching); assert.match(watching.headers['x-graph-timestamp'], /^\d+$/); assert.match(watching.headers['x-graph-signature'], /^[0-9a-f]{64}$/);
    assert.equal(watching.url.includes(token), false); assert.equal(Object.values(watching.headers).join('\n').includes(token), false);
  } finally { await new Promise((resolve) => holder.close(resolve)); }
});

test('a port thief after proof receives a signature but never the token', async () => {
  const root = await makeDir(); const port = await freePort(); const graph = path.join(root, 'graphs', 'thief.json'); await fs.mkdir(path.dirname(graph), { recursive: true }); const marker = path.join(root, 'pause');
  const ctx = await startServer({ cacheRoot: root, port }); let stdout = ''; let stderr = '';
  const child = spawn(process.execPath, ['--require', HOOK, 'viewer/server.js', '--cache-root', root, '--port', String(port), '--open', graph], { cwd: ROOT, env: { ...process.env, GRAPH_TEST_HOOK: 'pause-before-register', GRAPH_TEST_MARKER: marker }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
  try {
    const deadline = Date.now() + 3000; while (!fssync.existsSync(marker) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10)); assert.ok(fssync.existsSync(marker), stderr);
    await ctx.stop(); let recorded; const thief = await listen(port, (request, response) => { recorded = { url: request.url, headers: request.headers }; response.end(JSON.stringify({ ok: true })); });
    try {
      await fs.unlink(marker); const code = await new Promise((resolve) => child.once('exit', resolve)); assert.equal(code, 0, `${stdout}\n${stderr}`);
      assert.equal(recorded.url.includes(ctx.token), false); assert.equal(Object.values(recorded.headers).join('\n').includes(ctx.token), false); assert.match(recorded.headers['x-graph-signature'], /^[0-9a-f]{64}$/);
    } finally { await new Promise((resolve) => thief.close(resolve)); }
  } finally { await fs.unlink(marker).catch(() => {}); await stop(child); await ctx.stop(); }
});

test('show overwrites open session and harness metadata with its own environment', async () => {
  const root = await makeDir(); const port = await freePort(); const graph = path.join(root, 'graphs', 'shown.json'); const bin = path.join(root, 'bin'); await fs.mkdir(bin, { recursive: true });
  const tmux = path.join(bin, 'tmux'); await fs.writeFile(tmux, "#!/bin/sh\nprintf '%s\\n' \"$TMUX_LABEL\"\n", { mode: 0o755 });
  const ctx = await startServer({ cacheRoot: root, port });
  try {
    const common = { ...process.env, TMUX: 'yes', TMUX_PANE: '%1', PATH: `${bin}:${process.env.PATH}` };
    assert.equal((await run(['--cache-root', root, '--port', String(port), '--open', graph], { ...common, TMUX_LABEL: 'open-session' })).code, 0);
    assert.equal((await run(['--cache-root', root, '--port', String(port), '--show', graph, '--no-browser'], { ...common, TMUX_LABEL: 'show-session' })).code, 0);
    const entry = JSON.parse(await fs.readFile(path.join(root, '.registered')))[graph]; assert.equal(entry.session, 'show-session'); assert.ok(['other', 'claude', 'codex'].includes(entry.harness));
  } finally { await ctx.stop(); }
});

test('the nearest codex process wins over inherited CLAUDECODE and a claude ancestor', async () => {
  const root = await makeDir(); const port = await freePort(); const graph = path.join(root, 'graphs', 'harness.json'); const bin = path.join(root, 'chain'); await fs.mkdir(path.dirname(graph), { recursive: true }); await fs.mkdir(bin);
  const claude = path.join(bin, 'claude'); const codex = path.join(bin, 'codex');
  await fs.writeFile(claude, '#!/bin/sh\n"$(dirname "$0")/codex" "$@"\n', { mode: 0o755 });
  await fs.writeFile(codex, '#!/bin/sh\nnode "$@"\n', { mode: 0o755 });
  const ctx = await startServer({ cacheRoot: root, port });
  try {
    const child = spawn(claude, ['viewer/server.js', '--cache-root', root, '--port', String(port), '--open', graph], { cwd: ROOT, env: { ...process.env, CLAUDECODE: '1' }, stdio: 'ignore' });
    await new Promise((resolve) => child.once('exit', resolve));
    assert.equal(JSON.parse(await fs.readFile(path.join(root, '.registered')))[graph].harness, 'codex');
  } finally { await ctx.stop(); }
});

test('registration rejects every out-of-scope plan and graph path before open reaches a port', async () => {
  const root = await makeDir(); const ctx = await startServer({ cacheRoot: root, port: await freePort() }); const outside = await makeDir('outside-');
  const markdownDir = path.join(outside, 'markdown'); await fs.mkdir(markdownDir); await fs.writeFile(path.join(markdownDir, 'README.md'), '# no');
  const badPlanLink = path.join(root, 'repo', 'docs', 'plans', 'linked'); await fs.mkdir(path.dirname(badPlanLink), { recursive: true }); await fs.symlink(markdownDir, badPlanLink);
  const plan = path.join(root, 'repo', 'docs', 'plans', 'ok'); const graphs = path.join(plan, 'graphs'); await fs.mkdir(graphs, { recursive: true }); const outsideGraph = path.join(outside, 'outside.json'); await fs.writeFile(outsideGraph, '{}'); const linkedGraph = path.join(graphs, 'linked.json'); await fs.symlink(outsideGraph, linkedGraph);
  try {
    for (const body of [
      { kind: 'plan', path: '/', session: null, harness: 'other' },
      { kind: 'plan', path: markdownDir, session: null, harness: 'other' },
      { kind: 'plan', path: badPlanLink, session: null, harness: 'other' },
      { kind: 'graph', path: linkedGraph, opened: true, session: null, harness: 'other' },
      { kind: 'graph', path: outsideGraph, opened: true, session: null, harness: 'other' },
    ]) { const result = await register(ctx, body); assert.equal(result.status, 400); assert.equal(result.body.error, 'bad-path'); }
  } finally { await ctx.stop(); }
  const port = await freePort(); const refused = await run(['--cache-root', root, '--port', String(port), '--open', outsideGraph]); assert.equal(refused.code, 1);
  await new Promise((resolve) => { const probe = net.connect(port, '127.0.0.1'); probe.once('error', () => resolve()); probe.once('connect', () => { probe.destroy(); assert.fail('bad path started a server'); }); });
});

test('a registered graph replaced by an external symlink is refused on GET and PUT', async () => {
  const root = await makeDir(); const graph = path.join(root, 'graphs', 'replace.json'); await fs.mkdir(path.dirname(graph), { recursive: true }); const ctx = await startServer({ cacheRoot: root, port: await freePort(), open: graph }); const outside = path.join(await makeDir('outside-'), 'outside.json'); await fs.writeFile(outside, '{}');
  try {
    await fs.writeFile(graph, '{}'); await fs.unlink(graph); await fs.symlink(outside, graph);
    assert.equal((await request(ctx, '/graph', { graphPath: graph })).status, 400);
    assert.equal((await request(ctx, '/graph', { method: 'PUT', graphPath: graph, body: { hash: '', graph: {} } })).status, 400);
  } finally { await ctx.stop(); }
});

test('register-plan has a two-second no-server grace and remains zero for bad paths', async () => {
  const root = await makeDir(); const port = await freePort(); const plan = path.join(root, 'repo', 'docs', 'plans', 'quiet'); await fs.mkdir(plan, { recursive: true }); const started = Date.now();
  const result = await run(['--cache-root', root, '--port', String(port), '--register-plan', plan]); assert.equal(result.code, 0); assert.ok(Date.now() - started >= 1800); await assert.rejects(fs.access(path.join(root, '.server')));
  const bad = await run(['--cache-root', root, '--port', String(port), '--register-plan', '/']); assert.equal(bad.code, 0);
});

test('pruning uses the newer graph mtime and added, and the newest plan markdown mtime', async () => {
  const root = await makeDir(); const graphDir = path.join(root, 'graphs'); await fs.mkdir(graphDir, { recursive: true }); const old = path.join(graphDir, 'old.json'); const recent = path.join(graphDir, 'recent.json'); await fs.writeFile(old, '{}'); await fs.writeFile(recent, '{}');
  const oldPlan = path.join(root, 'repo', 'docs', 'plans', 'old'); const recentPlan = path.join(root, 'repo', 'docs', 'plans', 'recent'); await fs.mkdir(oldPlan, { recursive: true }); await fs.mkdir(recentPlan, { recursive: true }); await fs.writeFile(path.join(oldPlan, 'PLAN.md'), '# old'); await fs.writeFile(path.join(recentPlan, 'PLAN.md'), '# recent');
  const stale = new Date(Date.now() - 31 * 86400000); await Promise.all([fs.utimes(old, stale, stale), fs.utimes(path.join(oldPlan, 'PLAN.md'), stale, stale)]);
  await fs.writeFile(path.join(root, '.registered'), JSON.stringify({ [old]: { added: stale.valueOf(), opened: true }, [recent]: { added: stale.valueOf(), opened: true } }));
  await fs.writeFile(path.join(root, '.plans'), JSON.stringify({ [oldPlan]: { added: stale.valueOf() }, [recentPlan]: { added: stale.valueOf() } }));
  const ctx = await startServer({ cacheRoot: root, port: await freePort(), open: path.join(graphDir, 'starter.json') });
  try {
    const graphs = JSON.parse(await fs.readFile(path.join(root, '.registered'))); const plans = JSON.parse(await fs.readFile(path.join(root, '.plans')));
    assert.equal(graphs[old], undefined); assert.ok(graphs[recent]); assert.equal(plans[oldPlan], undefined); assert.ok(plans[recentPlan]);
  } finally { await ctx.stop(); }
});
