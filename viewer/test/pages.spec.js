'use strict';

// End-to-end Playwright cases for the graph and document pages against the *real* server —
// render.spec.js exercises the same DOM against page.route mocks; this file starts an actual
// viewer/server.js child process (free port, temp --cache-root, exactly as
// viewer/test/browser.spec.js and viewer/test/helpers/server.js do) and drives it the way an
// agent and a browser actually would: `--open`, `--register-plan`, a fake `tmux` on PATH, and
// real navigation. Rules and DOM are fixed by docs/plans/remote-viewer/PLAN.md's Spec sections
// "Plan documents", "On a phone" and "Validation". The old list page is gone: /wheelchair/ with no
// graph path now redirects to the app's Threads page, and the /list JSON it read is covered in
// routes.test.js.

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { trackChild } = require('../../test-support/run-dir');
const { test, expect } = require('@playwright/test');
const { ROOT, makeDir, freePort } = require('./helpers/server');

const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

// A fake `tmux` put first on a spawned process's PATH. `list-sessions -F '#S'` (server.js's
// tmuxSessions, used to build /list) answers with FAKE_TMUX_LIST, comma-separated; `display-message
// -p -t <pane> '#S'` (server.js's sessionLabel, used by --open/--register-plan to record a session)
// answers with FAKE_SESSION_NAME, or fails when that isn't set.
const TMUX_SCRIPT = `#!/bin/sh
if [ "$1" = "list-sessions" ]; then
  if [ -n "$FAKE_TMUX_LIST" ]; then
    printf '%s\\n' "$FAKE_TMUX_LIST" | tr ',' '\\n'
  fi
  exit 0
fi
if [ "$1" = "display-message" ]; then
  if [ -n "$FAKE_SESSION_NAME" ]; then
    printf '%s\\n' "$FAKE_SESSION_NAME"
    exit 0
  fi
  exit 1
fi
exit 1
`;

// A fake harness binary. Run directly (not via `exec`) so the shell process itself — whose comm
// is this script's own basename, the same trick viewer/test/registration.test.js's harness test
// relies on — stays alive as the parent of the `node` it forks, and server.js's harnessLabel()
// (which walks /proc ancestry) finds it.
const CLAUDE_SCRIPT = `#!/bin/sh
node "$@"
`;

function minimalGraph(title) {
  return JSON.stringify({
    schema: 1, title, source: 'router', source_detail: null, explanation: null,
    groups: [], nodes: [], edges: [],
  });
}

async function makeFakeBin(root) {
  const bin = path.join(root, 'bin');
  await fs.mkdir(bin, { recursive: true });
  await fs.writeFile(path.join(bin, 'tmux'), TMUX_SCRIPT, { mode: 0o755 });
  await fs.writeFile(path.join(bin, 'claude'), CLAUDE_SCRIPT, { mode: 0o755 });
  return bin;
}

function waitForUrl(child) {
  return new Promise((resolve, reject) => {
    let output = '';
    let errors = '';
    const timer = setTimeout(() => reject(new Error(`server did not print its URL: ${errors}`)), 5000);
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const line = output.split(/\r?\n/).find((value) => /^https?:\/\//.test(value));
      if (line) { clearTimeout(timer); resolve(line); }
    });
    child.stderr.on('data', (chunk) => { errors += chunk; });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      reject(new Error(`server exited before ready (${code ?? signal}): ${errors}`));
    });
  });
}

async function startServerEnv({ root, port, env }) {
  const args = ['viewer/server.js', '--port', String(port), '--cache-root', root, '--state-dir', path.join(root, 'hub-state')];
  const child = spawn(process.execPath, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  trackChild(child);
  let token;
  try {
    await waitForUrl(child);
  // A bare start (no --open) prints only the base origin, with no token (server.js's viewerUrl) —
  // read the token it wrote to disk instead of parsing the printed line.
    token = (await fs.readFile(path.join(root, '.token'), 'utf8')).trim();
    assert.ok(token, 'server wrote a token file');
  } catch (error) {
    await stopChild(child);
    throw error;
  }
  return {
    root, port, token, url: `http://127.0.0.1:${port}/wheelchair`, child,
    async stop() {
      await stopChild(child);
      await fs.unlink(path.join(root, '.server')).catch(() => {});
    },
  };
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => child.kill('SIGKILL'), 1500);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill('SIGTERM');
  });
}

function run(args, env) {
  return runExec(process.execPath, ['viewer/server.js', ...args], env);
}

function runExec(execPath, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(execPath, args, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
    trackChild(child);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => resolve({ code, stdout, stderr }));
  });
}

// Builds the shared world for cases 1, 2, 4, 5, 6 and the narrow-viewport case 7: one server,
// three graphs opened under three different session conditions, and one registered plan.
async function buildWorld(prefix = 'pages-') {
  const root = await makeDir(prefix);
  const bin = await makeFakeBin(root);
  const graphDir = path.join(root, 'graphs');
  await fs.mkdir(graphDir, { recursive: true });

  const runningGraph = path.join(graphDir, 'running.json');
  const endedGraph = path.join(graphDir, 'ended.json');
  const noTmuxGraph = path.join(graphDir, 'no-tmux.json');
  await Promise.all([
    fs.writeFile(runningGraph, minimalGraph('Running graph')),
    fs.writeFile(endedGraph, minimalGraph('Ended graph')),
    fs.writeFile(noTmuxGraph, minimalGraph('No tmux graph')),
  ]);

  const planDir = path.join(root, 'repo', 'docs', 'plans', 'demo');
  await fs.mkdir(path.join(planDir, 'notes'), { recursive: true });
  await fs.writeFile(path.join(planDir, 'PLAN.md'), [
    '---',
    'slug: demo',
    'status: approved   # planning | ready-for-review | approved',
    '---',
    '',
    '# Demo plan',
    '',
    'Body text.',
    '',
  ].join('\n'));
  await fs.writeFile(path.join(planDir, 'IDEA.md'), '# Demo idea\n\nBody.\n');
  await fs.writeFile(path.join(planDir, 'notes', 'a.md'), '# Note a\n\nSee [b](b.md) for details.\n');
  await fs.writeFile(path.join(planDir, 'notes', 'b.md'), '# Note b\n\nArrived.\n');

  const port = await freePort();
  const baseEnv = { ...process.env, PATH: `${bin}:${process.env.PATH}` };

  const serverEnv = { ...baseEnv, FAKE_TMUX_LIST: 'wheelchair' };
  delete serverEnv.TMUX;
  delete serverEnv.TMUX_PANE;
  const server = await startServerEnv({ root, port, env: serverEnv });

  const runningEnv = { ...baseEnv, TMUX: 'yes', TMUX_PANE: '%1', FAKE_SESSION_NAME: 'wheelchair' };
  const openRunning = await runExec(path.join(bin, 'claude'),
    ['viewer/server.js', '--cache-root', root, '--state-dir', path.join(root, 'hub-state'), '--port', String(port), '--open', runningGraph], runningEnv);
  assert.equal(openRunning.code, 0, openRunning.stderr);

  const endedEnv = { ...baseEnv, TMUX: 'yes', TMUX_PANE: '%1', FAKE_SESSION_NAME: 'ghost' };
  const openEnded = await run(['--cache-root', root, '--state-dir', path.join(root, 'hub-state'), '--port', String(port), '--open', endedGraph], endedEnv);
  assert.equal(openEnded.code, 0, openEnded.stderr);

  const noTmuxEnv = { ...baseEnv };
  delete noTmuxEnv.TMUX;
  delete noTmuxEnv.TMUX_PANE;
  const openNoTmux = await run(['--cache-root', root, '--state-dir', path.join(root, 'hub-state'), '--port', String(port), '--open', noTmuxGraph], noTmuxEnv);
  assert.equal(openNoTmux.code, 0, openNoTmux.stderr);

  const planEnv = { ...baseEnv, TMUX: 'yes', TMUX_PANE: '%1', FAKE_SESSION_NAME: 'wheelchair' };
  const registerPlan = await run(['--cache-root', root, '--state-dir', path.join(root, 'hub-state'), '--port', String(port), '--register-plan', planDir], planEnv);
  assert.equal(registerPlan.code, 0, registerPlan.stderr);

  return {
    root, bin, port, url: server.url, token: server.token,
    runningGraph, endedGraph, noTmuxGraph, planDir,
    async stop() { await server.stop(); },
  };
}

// ---------------------------------------------------------------------------
// One shared world, default viewport.
// ---------------------------------------------------------------------------

test.describe('graph and document pages against a real server', () => {
  let world;

  test.beforeAll(async () => { world = await buildWorld(); });
  test.afterAll(async () => { await world.stop(); });

  test('a graph opened by an agent opens in the graph viewer by its path', async ({ page }) => {
    await page.goto(`${world.url}/?token=${world.token}`);
    await page.goto(`${world.url}/?path=${encodeURIComponent(world.runningGraph)}`);
    await expect(page).toHaveTitle('Running graph');
    await expect(page.locator('svg#canvas')).toBeVisible();
  });

  test('a registered plan\'s document page navigates files and a same-plan link', async ({ page }) => {
    await page.goto(`${world.url}/docs?plan=${encodeURIComponent(world.planDir)}&token=${world.token}`);
    await expect(page.locator('#doc-title')).toHaveText('demo');
    await expect(page.locator('#content h1')).toHaveText('Demo plan');
    await expect(page.locator('nav#files a.current')).toHaveText('PLAN.md');

    await page.locator('nav#files a', { hasText: 'IDEA.md' }).click();
    await expect(page.locator('#content h1')).toHaveText('Demo idea');
    await expect(page.locator('nav#files a.current')).toHaveText('IDEA.md');

    await page.locator('nav#files a', { hasText: 'notes/a.md' }).click();
    await expect(page.locator('#content h1')).toHaveText('Note a');
    const link = page.locator('#content a');
    await expect(link).toHaveText('b');

    await link.click();
    await expect(page.locator('#content h1')).toHaveText('Note b');
    expect(new URL(page.url()).searchParams.get('file')).toBe('notes/b.md');
  });

  test('the document page response carries the CSP header and renders with no console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (error) => { consoleErrors.push(String(error)); });

    const response = await page.goto(`${world.url}/docs?plan=${encodeURIComponent(world.planDir)}&token=${world.token}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-security-policy']).toBe(CSP);

    await expect(page.locator('#content h1')).toHaveText('Demo plan');
    await expect.poll(() => page.evaluate(() => window.wcBackground.current().metadata !== null)).toBe(true);
    expect((await fs.stat(path.join(world.root, 'hub-state', 'backgrounds'))).isDirectory()).toBe(true);
    expect(consoleErrors).toEqual([]);
  });

  test('a wrong token on / and on /docs gives an error, not the page', async ({ page }) => {
    const rootResponse = await page.goto(`${world.url}/?token=wrong-token`);
    expect(rootResponse.status()).toBe(401);
    await expect(page.locator('#topbar')).toHaveCount(0);

    const docsResponse = await page.goto(`${world.url}/docs?plan=${encodeURIComponent(world.planDir)}&token=wrong-token`);
    expect(docsResponse.status()).toBe(401);
    await expect(page.locator('#doc')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Case 7: 390px wide with a touch-capable context.
// ---------------------------------------------------------------------------

test.describe('narrow touch viewport', () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true });

  test('the document page does not scroll sideways at 390px', async ({ page }) => {
    const world = await buildWorld('pages-narrow-');
    try {
      await page.goto(`${world.url}/docs?plan=${encodeURIComponent(world.planDir)}&token=${world.token}`);
      await expect(page.locator('#content h1')).toHaveText('Demo plan');
      const docOverflow = await page.evaluate(() => (
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      ));
      expect(docOverflow).toBeLessThanOrEqual(1);
    } finally {
      await world.stop();
    }
  });
});

// ---------------------------------------------------------------------------
// docs/plans/remember-me/PLAN.md — the first-visit cookie flow. One dedicated world: a graph with
// real, positioned nodes (so a drag has something to move) and a registered plan (so a document
// can open), opened against a running server exactly the way buildWorld's own graphs are.
// ---------------------------------------------------------------------------

async function buildRememberWorld() {
  const root = await makeDir('remember-');
  const graphDir = path.join(root, 'graphs');
  await fs.mkdir(graphDir, { recursive: true });
  const graphPath = path.join(graphDir, 'draggable.json');
  await fs.copyFile(path.join(ROOT, 'viewer', 'test', 'fixtures', 'interactive.json'), graphPath);

  const planDir = path.join(root, 'repo', 'docs', 'plans', 'demo');
  await fs.mkdir(planDir, { recursive: true });
  await fs.writeFile(path.join(planDir, 'PLAN.md'), [
    '---',
    'slug: demo',
    'status: approved',
    '---',
    '',
    '# Demo plan',
    '',
    'Body text.',
    '',
  ].join('\n'));

  const port = await freePort();
  const env = { ...process.env };
  delete env.TMUX;
  delete env.TMUX_PANE;
  const server = await startServerEnv({ root, port, env });

  const opened = await run(['--cache-root', root, '--state-dir', path.join(root, 'hub-state'), '--port', String(port), '--open', graphPath], env);
  assert.equal(opened.code, 0, opened.stderr);
  const registered = await run(['--cache-root', root, '--state-dir', path.join(root, 'hub-state'), '--port', String(port), '--register-plan', planDir], env);
  assert.equal(registered.code, 0, registered.stderr);

  return {
    root, port, url: server.url, token: server.token, graphPath, planDir,
    async stop() { await server.stop(); },
  };
}

test.describe('remember-me: the first visit and after', () => {
  let world;

  test.beforeAll(async () => { world = await buildRememberWorld(); });
  test.afterAll(async () => { await world.stop(); });

  test('opening the ?token= URL lands on the app\'s Threads page with no token in page.url()', async ({ page }) => {
    await page.goto(`${world.url}/?token=${world.token}`);
    const landed = new URL(page.url());
    expect(landed.pathname).toBe('/wheelchair/app/threads');
    expect(landed.searchParams.has('token')).toBe(false);
  });

  test('opening /wheelchair/ again in the same context goes straight to the app', async ({ page }) => {
    await page.goto(`${world.url}/?token=${world.token}`);
    const response = await page.goto(`${world.url}/`);
    expect(response.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe('/wheelchair/app/threads');
    await expect(page).toHaveTitle('Threads');
  });

  test('a fresh context opening /wheelchair/ gets the sign-in page (both sentences visible)', async ({ page }) => {
    const response = await page.goto(`${world.url}/`);
    expect(response.status()).toBe(401);
    await expect(page.locator('body')).toContainText("This browser isn't signed in to the viewer.");
    await expect(page.locator('body')).toContainText(
      'Open your bookmark link once; if the token was rotated, get the new link with'
    );
  });

  test('after sign-in, a graph and a plan document open, and a drag saves, with no token in any request URL', async ({ page }) => {
    // The first visit legitimately carries the token; only requests issued after the page is
    // already signed in are checked below.
    await page.goto(`${world.url}/?token=${world.token}`);

    const seenUrls = [];
    page.on('request', (req) => seenUrls.push(req.url()));

    await page.goto(`${world.url}/?path=${encodeURIComponent(world.graphPath)}`);
    await page.waitForFunction(() => window.__viewer && !!window.__viewer.graph());
    await expect(page).toHaveTitle('Browser interaction fixture');

    const before = JSON.parse(await fs.readFile(world.graphPath, 'utf8'));
    const beforeNode = before.nodes.find((n) => n.id === 'a');
    const nodeBox = page.locator('svg#canvas g.node[data-id="a"] rect.node-box');
    const box = await nodeBox.boundingBox();
    assert.ok(box, 'the dragged node has a layout box');
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

    const savedResponses = [];
    const onResponse = (resp) => {
      if (resp.request().method() === 'PUT' && resp.url().includes('/view')) savedResponses.push(resp);
    };
    page.on('response', onResponse);
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 40, cy + 20, { steps: 4 });
    await page.mouse.up();
    await expect.poll(() => savedResponses.some((r) => r.status() === 200)).toBe(true);
    page.off('response', onResponse);

    const after = JSON.parse(await fs.readFile(world.graphPath, 'utf8'));
    const afterNode = after.nodes.find((n) => n.id === 'a');
    assert.equal(afterNode.x, beforeNode.x + 40);
    assert.equal(afterNode.y, beforeNode.y + 20);

    await page.goto(`${world.url}/docs?plan=${encodeURIComponent(world.planDir)}`);
    await expect(page.locator('#content h1')).toHaveText('Demo plan');

    for (const url of seenUrls) {
      assert.ok(!/[?&]token=/.test(url), `a request after sign-in carried a token: ${url}`);
    }
  });

  test('an old root bookmark /?token=… ends on the app\'s Threads page with the cookie set', async ({ page, context }) => {
    const origin = new URL(world.url).origin;
    await page.goto(`${origin}/?token=${world.token}`);
    const landed = new URL(page.url());
    expect(landed.pathname).toBe('/wheelchair/app/threads');
    expect(landed.searchParams.has('token')).toBe(false);

    const cookies = await context.cookies();
    const remember = cookies.find((c) => c.name === 'wheelchair_remember');
    assert.ok(remember, 'the remember cookie should be set');
  });
});
