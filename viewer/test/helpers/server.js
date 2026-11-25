'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { makeTemp, trackChild } = require('../../../test-support/run-dir');

const ROOT = path.resolve(__dirname, '../../..');
const FIXTURES = path.join(ROOT, 'viewer/test/fixtures');

async function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function makeDir(prefix = 'server-') {
  return makeTemp(prefix);
}

async function fixture(name) {
  return fs.readFile(path.join(FIXTURES, name));
}

async function stage(ctx, name, target = name) {
  const destination = path.join(ctx.graphDir, target);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, await fixture(name));
  return destination;
}

function waitForLine(child) {
  return new Promise((resolve, reject) => {
    let output = '';
    let errors = '';
    const timeout = setTimeout(() => reject(new Error(`server did not print its URL: ${errors}`)), 5000);
    child.stdout.on('data', (chunk) => {
      output += chunk;
      const line = output.split(/\r?\n/).find((value) => /^https?:\/\//.test(value));
      if (line) { clearTimeout(timeout); resolve(line); }
    });
    child.stderr.on('data', (chunk) => { errors += chunk; });
    // 'close' waits for stderr to drain, so the clash message is in `errors` when we decide.
    child.once('close', (code, signal) => {
      clearTimeout(timeout);
      const error = new Error(`server exited before ready (${code ?? signal}): ${errors}`);
      error.startupStderr = errors;
      reject(error);
    });
  });
}

function waitForExit(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve();
    else child.once('exit', resolve);
  });
}

async function startServer({ open, cacheRoot, stateDir, port, env, cwd = ROOT, nextPort = freePort } = {}) {
  const root = cacheRoot || await makeDir();
  // One writer per state directory. Explicit reuse is for sequential restart tests only.
  const chosenStateDir = stateDir || await makeDir('server-state-');
  const graphDir = path.join(root, 'graphs');
  await fs.mkdir(graphDir, { recursive: true });
  const graphPath = open || path.join(graphDir, 'canonical.json');
  let chosenPort; let child; let token;
  for (let attempt = 0; attempt < 5; attempt++) {
    chosenPort = port === undefined ? await nextPort() : port;
    const args = ['viewer/server.js', '--port', String(chosenPort), '--cache-root', root, '--open', graphPath];
    args.push('--state-dir', chosenStateDir);
    child = spawn(process.execPath, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    trackChild(child);
    try {
      await waitForLine(child);
      token = (await fs.readFile(path.join(root, '.token'), 'utf8')).trim();
      assert.ok(token, 'server writes a token');
      break;
    } catch (error) {
      child.kill('SIGKILL');
      await waitForExit(child);
      if (port !== undefined || attempt === 4 || !/Refused to use a port held by a process it cannot identify|EADDRINUSE/.test(error.startupStderr || '')) throw error;
    }
  }
  return {
    root, stateDir: chosenStateDir, graphDir, graphPath, port: chosenPort, child, url: `http://127.0.0.1:${chosenPort}/wheelchair`,
    token,
    async stop({ leaveLock = false } = {}) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 1500);
      await waitForExit(child);
      clearTimeout(timer);
      if (!leaveLock) await fs.unlink(path.join(root, '.server')).catch(() => {});
    },
  };
}

async function request(
  ctx,
  route,
  { method = 'GET', graphPath = ctx.graphPath, body, token = ctx.token, origin = true } = {},
) {
  const url = new URL(`${ctx.url}${route.startsWith('/wheelchair') ? route.slice('/wheelchair'.length) : route}`);
  if (method === 'GET' && token !== undefined) url.searchParams.set('token', token);
  if (graphPath !== undefined) url.searchParams.set('path', graphPath);
  const headers = {};
  if (method === 'PUT') {
    headers['content-type'] = 'application/json';
    if (token !== undefined) headers['x-graph-token'] = token;
    if (origin) headers.origin = typeof origin === 'string' ? origin : new URL(ctx.url).origin;
  }
  const response = await fetch(url, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: response.status, body: json, headers: response.headers };
}

async function getGraph(ctx, graphPath = ctx.graphPath) {
  const result = await request(ctx, '/graph', { graphPath });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body;
}

async function put(ctx, route, graph, hash, graphPath = ctx.graphPath, options = {}) {
  return request(ctx, route, { method: 'PUT', graphPath, body: { hash, graph }, ...options });
}

function copy(value) { return structuredClone(value); }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

async function withServer(options, work) {
  const ctx = await startServer(options);
  try { return await work(ctx); } finally { await ctx.stop(); }
}

module.exports = {
  ROOT,
  FIXTURES,
  copy,
  fixture,
  freePort,
  getGraph,
  makeDir,
  put,
  request,
  sha256,
  stage,
  startServer,
  withServer,
};
