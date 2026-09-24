'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const test = require('node:test');

const { ROOT, FIXTURES, makeDir, freePort, startServer } = require('./helpers/server');

function run(args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['viewer/server.js', ...args], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject); child.once('exit', (code) => resolve({ code, stdout, stderr }));
  });
}

async function startServerWithEnv({ root, port, open, env }) {
  const child = spawn(process.execPath, ['viewer/server.js', '--cache-root', root, '--port', String(port), '--open', open],
    { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not start: ${stderr}`)), 5000);
    child.stdout.on('data', () => {
      const line = stdout.split(/\r?\n/).find((value) => /^https?:\/\//.test(value));
      if (line) { clearTimeout(timer); resolve(line); }
    });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`server exited ${code}: ${stderr}`)); });
  });
  const parsed = new URL(url);
  return {
    root, port, graphPath: open, url: `http://127.0.0.1:${port}/wheelchair`, token: (await fs.readFile(path.join(root, '.token'), 'utf8')).trim(), child,
    async stop() {
      if (child.exitCode === null) child.kill('SIGTERM');
      await new Promise((resolve) => { const timer = setTimeout(resolve, 1500); child.once('exit', () => clearTimeout(timer) || resolve()); });
      if (child.exitCode === null) child.kill('SIGKILL');
      await fs.unlink(path.join(root, '.server')).catch(() => {});
    },
  };
}

async function get(ctx, pathname, token = ctx.token) {
  const url = new URL(`${ctx.url}${pathname.startsWith('/wheelchair') ? pathname.slice('/wheelchair'.length) : pathname}`);
  if (token !== null) url.searchParams.set('token', token);
  const response = await fetch(url);
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: response.status, body, headers: response.headers };
}

async function raw(ctx, pathname, { method = 'GET', headers = {}, body, redirect = 'manual' } = {}) {
  const response = await fetch(`${ctx.url}${pathname}`, { method, headers, body, redirect });
  const text = await response.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: response.status, body: parsed, headers: response.headers };
}

async function remember(ctx, pathname = '/') {
  const response = await raw(ctx, `${pathname}${pathname.includes('?') ? '&' : '?'}token=${ctx.token}`);
  assert.equal(response.status, 303); return response.headers.get('set-cookie');
}

async function register(ctx, body) {
  const bytes = JSON.stringify(body); const timestamp = String(Date.now());
  const signature = crypto.createHmac('sha256', ctx.token).update(`${timestamp}\n`).update(bytes).digest('hex');
  const response = await fetch(`${ctx.url}/register`, { method: 'POST', body: bytes, headers: {
    origin: new URL(ctx.url).origin, 'content-type': 'application/json', 'x-graph-timestamp': timestamp, 'x-graph-signature': signature,
  } });
  assert.equal(response.status, 200, await response.text());
}

async function makePlan(root, slug = 'slug') {
  const plan = path.join(root, 'repo', 'docs', 'plans', slug);
  await fs.mkdir(plan, { recursive: true });
  return plan;
}

async function registerPlan(ctx, plan) {
  const result = await run(['--cache-root', ctx.root, '--port', String(ctx.port), '--register-plan', plan]);
  assert.equal(result.code, 0, result.stderr);
}

test('/list groups and orders opened graphs, marks ended sessions, quotes attach commands, and skips absent children', async () => {
  const root = await makeDir(); const port = await freePort(); const graphs = path.join(root, 'graphs'); const bin = path.join(root, 'bin');
  await fs.mkdir(graphs, { recursive: true }); await fs.mkdir(bin);
  await fs.writeFile(path.join(bin, 'tmux'), "#!/bin/sh\nprintf \"live\\nquote's\\n\"\n", { mode: 0o755 });
  const first = path.join(graphs, 'first.json'); const newest = path.join(graphs, 'newest.json'); const ended = path.join(graphs, 'ended.json');
  const outside = path.join(graphs, 'child.json'); const missing = path.join(graphs, 'missing.json');
  await Promise.all([
    fs.writeFile(first, '{"title":"first title"}'), fs.writeFile(newest, '{"title":"new title"}'),
    fs.writeFile(ended, '{"title":"ended title"}'), fs.writeFile(outside, '{"title":"child title"}'),
  ]);
  const now = Date.now(); await Promise.all([
    fs.utimes(first, now / 1000 - 30, now / 1000 - 30), fs.utimes(newest, now / 1000 - 10, now / 1000 - 10),
    fs.utimes(ended, now / 1000 - 20, now / 1000 - 20), fs.utimes(outside, now / 1000 - 1, now / 1000 - 1),
  ]);
  const ctx = await startServerWithEnv({ root, port, open: first, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } });
  try {
    await register(ctx, { kind: 'graph', path: first, opened: true, session: 'live', harness: 'claude' });
    await register(ctx, { kind: 'graph', path: newest, opened: true, session: "quote's", harness: 'codex' });
    await register(ctx, { kind: 'graph', path: ended, opened: true, session: 'ended', harness: 'other' });
    await register(ctx, { kind: 'graph', path: outside, opened: false, session: 'live', harness: 'other' });
    await register(ctx, { kind: 'graph', path: missing, opened: true, session: 'live', harness: 'other' });
    const response = await get(ctx, '/list'); assert.equal(response.status, 200);
    assert.deepEqual(response.body.sessions.map((group) => group.name), ["quote's", 'ended', 'live']);
    assert.equal(response.body.sessions[0].running, true);
    assert.equal(response.body.sessions[0].attach, "tmux attach -t 'quote'\\''s'");
    assert.equal(response.body.sessions[1].running, false); assert.equal(response.body.sessions[1].attach, null);
    assert.deepEqual(response.body.sessions.flatMap((group) => group.graphs.map((graph) => graph.path)).sort(), [ended, first, newest].sort());
    assert.equal(response.body.sessions[0].graphs[0].title, 'new title');
  } finally { await ctx.stop(); }
});

test('/plan lists Markdown at every depth in byte order and refuses an unregistered directory', async () => {
  const root = await makeDir(); const plan = await makePlan(root, 'registered'); const unregistered = await makePlan(root, 'unregistered');
  await Promise.all([fs.writeFile(path.join(plan, 'z.md'), '# z'), fs.writeFile(path.join(plan, 'A.md'), '# A'),
    fs.mkdir(path.join(plan, 'notes'), { recursive: true }).then(() => fs.writeFile(path.join(plan, 'notes', 'b.md'), '# b'))]);
  const ctx = await startServer({ cacheRoot: root, port: await freePort() });
  try {
    await registerPlan(ctx, plan);
    const listed = await get(ctx, `/plan?dir=${encodeURIComponent(plan)}`); assert.equal(listed.status, 200);
    assert.deepEqual(listed.body, { dir: plan, slug: 'registered', files: ['A.md', 'notes/b.md', 'z.md'] });
    const denied = await get(ctx, `/plan?dir=${encodeURIComponent(unregistered)}`); assert.equal(denied.status, 403); assert.equal(denied.body.error, 'not-registered');
  } finally { await ctx.stop(); }
});

test('/doc returns 404 for non-Markdown files, parent paths, and a symlink leading outside its plan', async () => {
  const root = await makeDir(); const plan = await makePlan(root); const outside = path.join(root, 'outside.md');
  await Promise.all([fs.writeFile(path.join(plan, 'plain.txt'), 'no'), fs.writeFile(path.join(plan, 'inside.md'), '# yes'), fs.writeFile(outside, '# outside')]);
  await fs.symlink(outside, path.join(plan, 'linked.md'));
  const ctx = await startServer({ cacheRoot: root, port: await freePort() });
  try {
    await registerPlan(ctx, plan);
    for (const file of ['plain.txt', '../outside.md', 'linked.md']) {
      const response = await get(ctx, `/doc?plan=${encodeURIComponent(plan)}&file=${encodeURIComponent(file)}`);
      assert.equal(response.status, 404, file); assert.equal(response.body.error, 'not-found');
    }
    const good = await get(ctx, `/doc?plan=${encodeURIComponent(plan)}&file=inside.md`); assert.equal(good.status, 200); assert.equal(good.body, '# yes');
  } finally { await ctx.stop(); }
});

test('/wheelchair/docs and list have CSP while a graph page keeps the index page header-free', async () => {
  const root = await makeDir(); const plan = await makePlan(root); const graph = path.join(root, 'graphs', 'main.json');
  await fs.mkdir(path.dirname(graph), { recursive: true }); await fs.writeFile(graph, '{"title":"main"}');
  const ctx = await startServer({ cacheRoot: root, port: await freePort(), open: graph });
  try {
    await registerPlan(ctx, plan);
    const tokenPage = await fetch(`${ctx.url}/?token=${ctx.token}`, { redirect: 'manual' });
    const cookie = tokenPage.headers.get('set-cookie');
    const fetchPage = async (pathname) => {
      const url = new URL(`${ctx.url}${pathname}`); const response = await fetch(url, { headers: { cookie } });
      return { status: response.status, body: await response.text(), headers: response.headers };
    };
    const docs = await fetchPage(`/docs?plan=${encodeURIComponent(plan)}`); const list = await fetchPage('/');
    const index = await fetchPage(`/?path=${encodeURIComponent(graph)}`);
    const csp = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
    assert.equal(docs.status, 200); assert.equal(list.status, 200); assert.equal(index.status, 200);
    assert.equal(docs.headers.get('content-security-policy'), csp); assert.equal(list.headers.get('content-security-policy'), csp);
    assert.equal(index.headers.get('content-security-policy'), null); assert.match(index.body, /graph viewer/i);
  } finally { await ctx.stop(); }
});

test('/assets/list.js needs no token and other asset names are 404', async () => {
  const ctx = await startServer({ cacheRoot: await makeDir(), port: await freePort() });
  try {
    const script = await get(ctx, '/assets/list.js', null); const other = await get(ctx, '/assets/other.js', null);
    assert.equal(script.status, 200); assert.equal(script.headers.get('content-type'), 'text/javascript; charset=utf-8'); assert.match(script.body, /POLL_MS/);
    assert.equal(other.status, 404); assert.equal(other.body.error, 'no-route');
  } finally { await ctx.stop(); }
});

test('every other route requires a token while /whoami remains available', async () => {
  const root = await makeDir(); const plan = await makePlan(root); const ctx = await startServer({ cacheRoot: root, port: await freePort() });
  try {
    for (const route of ['/', '/list', `/plan?dir=${encodeURIComponent(plan)}`, `/docs?plan=${encodeURIComponent(plan)}`,
      `/doc?plan=${encodeURIComponent(plan)}&file=PLAN.md`, '/graph', '/not-a-route']) {
      const response = await get(ctx, route, null); assert.equal(response.status, 401, route);
    }
    const whoami = await get(ctx, '/whoami', null); assert.equal(whoami.status, 200); assert.equal(typeof whoami.body.start_id, 'string');
  } finally { await ctx.stop(); }
});

test('a page changed on disk is served changed without restarting the server', async () => {
  const page = path.join(ROOT, 'viewer', 'list.html'); const original = await fs.readFile(page, 'utf8'); const marker = `<!-- routes-test-${Date.now()} -->`;
  const ctx = await startServer({ cacheRoot: await makeDir(), port: await freePort() });
  try {
    await fs.writeFile(page, `${original}${marker}`);
    const first = await fetch(`${ctx.url}/?token=${ctx.token}`, { redirect: 'manual' }); const response = await fetch(`${ctx.url}/`, { headers: { cookie: first.headers.get('set-cookie') } });
    assert.equal(response.status, 200); assert.match(await response.text(), new RegExp(marker));
  } finally { await fs.writeFile(page, original); await ctx.stop(); }
});

test('list-build pruning writes only when it removes entries and never rewrites again within an hour', async () => {
  const root = await makeDir(); const graph = path.join(root, 'graphs', 'fresh.json'); const marker = path.join(root, 'clock'); const stale = path.join(root, 'graphs', 'gone.json');
  await fs.mkdir(path.dirname(graph), { recursive: true }); await fs.writeFile(graph, '{}'); await fs.writeFile(marker, '0');
  const ctx = await startServerWithEnv({ root, port: await freePort(), open: graph,
    env: { ...process.env, ROUTES_DATE_MARKER: marker, NODE_OPTIONS: `--require=${path.join(FIXTURES, 'date-hook.js')}` } });
  try {
    const registry = path.join(root, '.registered'); const entries = JSON.parse(await fs.readFile(registry));
    entries[stale] = { added: 0, opened: true, session: null, harness: 'other' }; await fs.writeFile(registry, JSON.stringify(entries));
    const before = await fs.stat(registry); await fs.writeFile(marker, String(Date.now()));
    await new Promise((resolve) => setTimeout(resolve, 20)); assert.equal((await get(ctx, '/list')).status, 200); const once = await fs.stat(registry);
    assert.ok(once.mtimeMs > before.mtimeMs, 'removing a stale entry rewrites the registry');
    assert.equal(JSON.parse(await fs.readFile(registry))[stale], undefined);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal((await get(ctx, '/list')).status, 200); const twice = await fs.stat(registry);
    assert.equal(twice.mtimeMs, once.mtimeMs, 'the hourly guard prevents a second rewrite');
  } finally { await ctx.stop(); }
});

test('GET /wheelchair/?token redirects without the token and sets the remember cookie attributes', async () => {
  const ctx = await startServer({ cacheRoot: await makeDir(), port: await freePort() });
  try {
    const response = await raw(ctx, `/?path=kept&token=${ctx.token}`);
    assert.equal(response.status, 303); assert.equal(response.headers.get('location'), '/wheelchair/?path=kept');
    assert.equal(response.headers.get('set-cookie'), /^wheelchair_remember=[0-9a-f]{64}; Path=\/wheelchair; HttpOnly; Secure; SameSite=Lax; Max-Age=34560000$/.exec(response.headers.get('set-cookie'))?.[0]);
  } finally { await ctx.stop(); }
});

test('a remember cookie reads the page, list, plan, document, and graph', async () => {
  const root = await makeDir(); const graph = path.join(root, 'graphs', 'main.json'); const plan = await makePlan(root);
  await fs.mkdir(path.dirname(graph), { recursive: true }); await fs.writeFile(graph, await fs.readFile(path.join(FIXTURES, 'canonical.json'))); await fs.writeFile(path.join(plan, 'PLAN.md'), '# plan');
  const ctx = await startServer({ cacheRoot: root, port: await freePort(), open: graph });
  try {
    await registerPlan(ctx, plan); const cookie = await remember(ctx);
    for (const route of ['/', '/list', `/plan?dir=${encodeURIComponent(plan)}`, `/doc?plan=${encodeURIComponent(plan)}&file=PLAN.md`, `/graph?path=${encodeURIComponent(graph)}`]) {
      assert.equal((await raw(ctx, route, { headers: { cookie } })).status, 200, route);
    }
  } finally { await ctx.stop(); }
});

test('JSON reads accept token directly and never set a remember cookie', async () => {
  const root = await makeDir(); const graph = path.join(root, 'graphs', 'main.json'); const plan = await makePlan(root);
  await fs.mkdir(path.dirname(graph), { recursive: true }); await fs.writeFile(graph, await fs.readFile(path.join(FIXTURES, 'canonical.json'))); await fs.writeFile(path.join(plan, 'PLAN.md'), '# plan');
  const ctx = await startServer({ cacheRoot: root, port: await freePort(), open: graph });
  try {
    await registerPlan(ctx, plan);
    for (const route of ['/list', `/plan?dir=${encodeURIComponent(plan)}`, `/doc?plan=${encodeURIComponent(plan)}&file=PLAN.md`, `/graph?path=${encodeURIComponent(graph)}`]) {
      const join = route.includes('?') ? '&' : '?'; const response = await raw(ctx, `${route}${join}token=${ctx.token}`);
      assert.equal(response.status, 200, route); assert.equal(response.headers.get('set-cookie'), null, route);
    }
  } finally { await ctx.stop(); }
});

test('a wrong page token redirects with a valid cookie, but otherwise gets the sign-in page', async () => {
  const ctx = await startServer({ cacheRoot: await makeDir(), port: await freePort() });
  try {
    const cookie = await remember(ctx); const redirect = await raw(ctx, '/?token=wrong', { headers: { cookie } });
    assert.equal(redirect.status, 303); assert.equal(redirect.headers.get('location'), '/wheelchair/'); assert.equal(redirect.headers.get('set-cookie'), null);
    const denied = await raw(ctx, '/?token=wrong'); assert.equal(denied.status, 401); assert.match(denied.body, /This browser isn't signed in/);
  } finally { await ctx.stop(); }
});

test('wrong cookies and cookies from before a rotation are refused', async () => {
  const root = await makeDir(); const port = await freePort(); const ctx = await startServer({ cacheRoot: root, port });
  let replacement;
  try {
    assert.equal((await raw(ctx, '/', { headers: { cookie: 'wheelchair_remember=wrong' } })).status, 401);
    const old = await remember(ctx); const rotated = await run(['--cache-root', root, '--port', String(port), '--rotate-token']); assert.equal(rotated.code, 0, rotated.stderr);
    replacement = await startServer({ cacheRoot: root, port }); assert.equal((await raw(replacement, '/', { headers: { cookie: old } })).status, 401);
  } finally { await replacement?.stop(); await ctx.stop(); }
});

test('a remember cookie is not a token, header token, or registration key', async () => {
  const ctx = await startServer({ cacheRoot: await makeDir(), port: await freePort() });
  try {
    const cookie = await remember(ctx); const value = cookie.match(/wheelchair_remember=([^;]+)/)[1];
    assert.equal((await raw(ctx, `/list?token=${value}`)).status, 401);
    assert.equal((await raw(ctx, '/graph', { method: 'PUT', headers: { 'x-graph-token': value, origin: new URL(ctx.url).origin } })).status, 401);
    assert.equal((await raw(ctx, '/register', { method: 'POST', headers: { cookie }, body: '{}' })).status, 401);
  } finally { await ctx.stop(); }
});

test('PUT graph and view accept a remember cookie only from a permitted origin', async () => {
  const root = await makeDir(); const graph = path.join(root, 'graphs', 'main.json'); await fs.mkdir(path.dirname(graph), { recursive: true }); await fs.writeFile(graph, await fs.readFile(path.join(FIXTURES, 'canonical.json')));
  const ctx = await startServer({ cacheRoot: root, port: await freePort(), open: graph });
  try {
    const cookie = await remember(ctx); const current = await raw(ctx, `/graph?path=${encodeURIComponent(graph)}&token=${ctx.token}`);
    const body = JSON.stringify({ hash: current.body.hash, graph: current.body.graph }); const headers = { cookie, origin: new URL(ctx.url).origin, 'content-type': 'application/json' };
    assert.equal((await raw(ctx, `/view?path=${encodeURIComponent(graph)}`, { method: 'PUT', headers, body })).status, 200);
    assert.equal((await raw(ctx, `/view?path=${encodeURIComponent(graph)}`, { method: 'PUT', headers: { ...headers, origin: 'https://foreign.invalid' }, body })).status, 403);
  } finally { await ctx.stop(); }
});

test('PUT /wheelchair/graph accepts a remember cookie only from a permitted origin', async () => {
  const root = await makeDir(); const graph = path.join(root, 'graphs', 'main.json');
  await fs.mkdir(path.dirname(graph), { recursive: true }); await fs.writeFile(graph, await fs.readFile(path.join(FIXTURES, 'canonical.json')));
  const ctx = await startServer({ cacheRoot: root, port: await freePort(), open: graph });
  try {
    const cookie = await remember(ctx); const current = await raw(ctx, `/graph?path=${encodeURIComponent(graph)}&token=${ctx.token}`);
    const body = JSON.stringify({ hash: current.body.hash, graph: current.body.graph }); const headers = { cookie, origin: new URL(ctx.url).origin, 'content-type': 'application/json' };
    assert.equal((await raw(ctx, `/graph?path=${encodeURIComponent(graph)}`, { method: 'PUT', headers, body })).status, 200);
    assert.equal((await raw(ctx, `/graph?path=${encodeURIComponent(graph)}`, { method: 'PUT', headers: { ...headers, origin: 'https://foreign.invalid' }, body })).status, 403);
  } finally { await ctx.stop(); }
});

test('root routes move to /wheelchair and /wheelchair gains its trailing slash', async () => {
  const ctx = await startServer({ cacheRoot: await makeDir(), port: await freePort() });
  try {
    const origin = new URL(ctx.url).origin;
    for (const route of ['/whoami?x=1', '/graph?x=1', '/list?x=1', '/wheelchairish?x=1']) {
      const response = await fetch(`${origin}${route}`, { redirect: 'manual' }); assert.equal(response.status, 308);
      assert.equal(response.headers.get('location'), `/wheelchair${route}`); assert.deepEqual(await response.json(), { error: 'moved', detail: 'The viewer moved under /wheelchair.', location: `/wheelchair${route}` });
    }
    const bare = await fetch(ctx.url, { redirect: 'manual' }); assert.equal(bare.status, 308); assert.equal(bare.headers.get('location'), '/wheelchair/');
  } finally { await ctx.stop(); }
});

test('page responses renew the Lax cookie while JSON responses do not, and anonymous pages explain sign-in', async () => {
  const ctx = await startServer({ cacheRoot: await makeDir(), port: await freePort() });
  try {
    const cookie = await remember(ctx); const page = await raw(ctx, '/', { headers: { cookie } });
    assert.match(page.headers.get('set-cookie'), /SameSite=Lax/); const list = await raw(ctx, `/list?token=${ctx.token}`); assert.equal(list.headers.get('set-cookie'), null);
    const anonymous = await raw(ctx, '/'); assert.equal(anonymous.status, 401); assert.match(anonymous.body, /Open your bookmark link once/); assert.match(anonymous.body, /<code>node viewer\/server\.js --url<\/code>/); assert.equal(anonymous.headers.get('content-security-policy'), "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    assert.equal((await raw(ctx, '/list')).status, 401);
  } finally { await ctx.stop(); }
});

test('an anonymous JSON route returns a JSON 401 error', async () => {
  const ctx = await startServer({ cacheRoot: await makeDir(), port: await freePort() });
  try {
    const response = await raw(ctx, '/list');
    assert.equal(response.status, 401); assert.match(response.headers.get('content-type'), /^application\/json(?:;|$)/); assert.equal(typeof response.body.error, 'string');
  } finally { await ctx.stop(); }
});
