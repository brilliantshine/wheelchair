'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '../../..');
const FIXTURES = path.join(ROOT, 'viewer/test/fixtures');
const TMP_ROOT = path.join(ROOT, 'viewer/test/.tmp');

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
  await fs.mkdir(TMP_ROOT, { recursive: true });
  return fs.mkdtemp(path.join(TMP_ROOT, prefix));
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
      const line = output.split(/\r?\n/).find((value) => value.startsWith('http://127.0.0.1:'));
      if (line) { clearTimeout(timeout); resolve(line); }
    });
    child.stderr.on('data', (chunk) => { errors += chunk; });
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      reject(new Error(`server exited before ready (${code ?? signal}): ${errors}`));
    });
  });
}

async function startServer({ open, cacheRoot, port } = {}) {
  const root = cacheRoot || await makeDir();
  const graphDir = path.join(root, 'graphs');
  await fs.mkdir(graphDir, { recursive: true });
  const graphPath = open || path.join(graphDir, 'canonical.json');
  const chosenPort = port || await freePort();
  const args = ['viewer/server.js', '--port', String(chosenPort), '--cache-root', root, '--open', graphPath];
  const child = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  const url = await waitForLine(child);
  const parsed = new URL(url);
  const token = parsed.searchParams.get('token');
  assert.ok(token, 'server launch URL includes a token');
  return {
    root, graphDir, graphPath, port: chosenPort, child, url: `http://127.0.0.1:${chosenPort}`,
    token,
    async stop({ leaveLock = false } = {}) {
      if (!child.killed) child.kill('SIGTERM');
      await new Promise((resolve) => {
        const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 1500);
        child.once('exit', () => { clearTimeout(timer); resolve(); });
      });
      if (!leaveLock) await fs.unlink(path.join(root, '.server')).catch(() => {});
    },
  };
}

async function request(ctx, route, { method = 'GET', graphPath = ctx.graphPath, body, token = ctx.token, origin = true } = {}) {
  const url = new URL(`${ctx.url}${route}`);
  if (method === 'GET' && token !== undefined) url.searchParams.set('token', token);
  if (graphPath !== undefined) url.searchParams.set('path', graphPath);
  const headers = {};
  if (method === 'PUT') {
    headers['content-type'] = 'application/json';
    if (token !== undefined) headers['x-graph-token'] = token;
    if (origin) headers.origin = ctx.url;
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

module.exports = { ROOT, FIXTURES, makeDir, fixture, stage, startServer, withServer, request, getGraph, put, copy, sha256, freePort };
