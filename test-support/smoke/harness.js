'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn, spawnSync, execFileSync } = require('node:child_process');
const { runDir, trackChild, onCleanup, cleanupNow } = require('../run-dir');
const { State, atomicWrite } = require('../../viewer/app/state');
const root = path.resolve(__dirname, '../..');
const header = 'x-wheelchair-machine-secret';
const sleeper = new Int32Array(new SharedArrayBuffer(4));

async function port() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => { const n = server.address().port; server.close(() => resolve(n)); });
  });
}
async function waitFor(fn, timeout = 15000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try { const value = await fn(); if (value) return value; } catch (error) { last = error; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for condition${last ? `: ${last.message}` : ''}`);
}
function run(command, args, env) {
  return execFileSync(command, args, { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function request(url, method = 'GET', body, headers = {}) {
  return fetch(url, { method, headers: { ...headers, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) }).then(async response => {
    const text = await response.text(); let value;
    try { value = JSON.parse(text); } catch { value = text; }
    if (!response.ok) throw new Error(`${method} ${url}: ${response.status} ${text}`);
    return value;
  });
}
function runProcesses(dir, paths, proc = fs) {
  const uid = process.getuid();
  const pids = [];
  for (const entry of proc.readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    const base = `/proc/${entry}`;
    try { if (proc.statSync(base).uid !== uid) continue; } catch { continue; }
    let env = [], cwd;
    try { env = proc.readFileSync(`${base}/environ`, 'utf8').split('\0'); } catch {}
    try { cwd = proc.readlinkSync(`${base}/cwd`); } catch {}
    const relative = cwd && path.relative(dir, cwd);
    if ((paths.home && env.includes(`HOME=${paths.home}`)) || env.includes(`TMUX_TMPDIR=${paths.tmux}`) ||
        (cwd && (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))))) pids.push(Number(entry));
  }
  return pids;
}
function waitForRunProcesses(dir, matchPaths, { proc = fs, now = Date.now, sleep = ms => Atomics.wait(sleeper, 0, 0, ms), kill = process.kill, timeouts = [10000, 2000, 2000] } = {}) {
  const matches = () => runProcesses(dir, matchPaths, proc);
  const poll = ms => {
    const end = now() + ms;
    let pids;
    while ((pids = matches()).length && now() < end) sleep(Math.min(100, end - now()));
    return pids;
  };
  const signal = (pids, name) => {
    for (const pid of pids) {
      if (!matches().includes(pid)) continue;
      try { kill(pid, name); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
  };
  let pids = poll(timeouts[0]);
  if (pids.length) { signal(pids, 'SIGTERM'); pids = poll(timeouts[1]); }
  if (pids.length) { signal(pids, 'SIGKILL'); pids = poll(timeouts[2]); }
  return pids.length;
}
function effectivePaths({ hubArgv, machineArgv, env }) {
  const value = (argv, flag) => {
    const index = argv.lastIndexOf(flag);
    return index < 0 ? undefined : argv[index + 1];
  };
  const defaultState = path.join(env.HOME, '.local', 'state', 'wheelchair');
  const hubState = path.resolve(value(hubArgv, '--state-dir') || defaultState);
  const hubCache = path.resolve(value(hubArgv, '--cache-root') || path.join(env.HOME, '.cache', 'agent-graphs'));
  const machineState = path.resolve(value(machineArgv, '--stateDir') || defaultState);
  return {
    paths: { hubState, hubCache, machineState, spool: path.join(machineState, 'spool'), worktrees: path.join(machineState, 'worktrees'), settings: path.join(machineState, 'settings') },
    ports: { hub: Number(value(hubArgv, '--port') || 7373), machine: Number(value(machineArgv, '--port') || 7374) },
  };
}
function assertIsolated(paths, ports, dir) {
  for (const p of Object.values(paths)) {
    const relative = path.relative(dir, p);
    assert(path.isAbsolute(p) && relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), `unsafe path: ${p}`);
  }
  for (const p of Object.values(ports)) assert(Number.isInteger(p) && p > 0 && p <= 65535 && p !== 7373 && p !== 7374, `unsafe port: ${p}`);
}
async function createHarness({ mode = 'smoke', slowOriginSeconds = 0, hubSettings = null, recordEvents = false, modelPins = null } = {}) {
  assert(['smoke', 'live'].includes(mode));
  assert(Number.isInteger(slowOriginSeconds) && slowOriginSeconds >= 0);
  const dir = runDir();
  const paths = Object.fromEntries(['home', 'hub-state', 'hub-cache', 'machine-state', 'tmux', 'origin.git', 'seed', 'clone'].map(key => [key.replace(/-([a-z])/g, (_, c) => c.toUpperCase()).replace('.git', ''), path.join(dir, key)]));
  const secretFile = path.join(dir, 'secret');
  const ports = [];
  while (ports.length < 4) { const p = await port(); if (![7373, 7374, ...ports].includes(p)) ports.push(p); }
  const [hubPort, machinePort, proxyPort, eventPort] = ports;
  const env = { ...process.env, TMUX_TMPDIR: paths.tmux };
  for (const key of Object.keys(env)) if (key.startsWith('WHEELCHAIR_') || key === 'TMUX' || key === 'TMUX_PANE' || (mode === 'smoke' && ['CLAUDE_CONFIG_DIR', 'CODEX_HOME'].includes(key))) delete env[key];
  if (mode === 'smoke') env.HOME = paths.home;
  if (modelPins !== null) { env.WHEELCHAIR_MODELS = path.join(dir, 'models'); await fsp.writeFile(env.WHEELCHAIR_MODELS, modelPins); }
  const hubUrl = `http://127.0.0.1:${hubPort}/wheelchair`, machineUrl = `http://127.0.0.1:${machinePort}`;
  const hubArgv = ['viewer/server.js', '--port', String(hubPort), '--cache-root', paths.hubCache, '--state-dir', paths.hubState];
  const machineArgv = ['machine/service.js', '--stateDir', paths.machineState, '--port', String(machinePort), '--host', '127.0.0.1', '--hubUrl', recordEvents ? `http://127.0.0.1:${eventPort}/wheelchair` : hubUrl, '--secretFile', secretFile];
  const hubEnv = { ...env, WHEELCHAIR_NO_BROWSER: '1' };
  const resolved = effectivePaths({ hubArgv, machineArgv, env });
  assertIsolated({ ...resolved.paths, tmux: paths.tmux, secretFile, ...(mode === 'smoke' ? { home: paths.home } : {}) }, { ...resolved.ports, proxy: proxyPort, events: eventPort }, dir);
  for (const key of ['hubState', 'hubCache', 'machineState']) assert.equal(resolved.paths[key], paths[key], `${key} differs from intended path`);
  for (const p of [paths.home, paths.hubState, paths.hubCache, paths.machineState, paths.tmux, paths.seed]) await fsp.mkdir(p, { recursive: true });
  await fsp.writeFile(secretFile, 'harness-machine-secret\n', { mode: 0o600 });
  const git = (...args) => run('git', args, env);
  git('init', '--bare', '--initial-branch=main', paths.origin);
  git('init', '--initial-branch=main', paths.seed);
  git('-C', paths.seed, 'config', 'user.name', 'Smoke Harness');
  git('-C', paths.seed, 'config', 'user.email', 'smoke@example.invalid');
  await fsp.mkdir(path.join(paths.seed, '.claude'), { recursive: true });
  await fsp.writeFile(path.join(paths.seed, '.claude/settings.json'), '{"permissions":{"ask":["Bash(touch:*)"]}}\n');
  git('-C', paths.seed, 'add', '.claude/settings.json');
  git('-C', paths.seed, 'commit', '-m', 'seed');
  git('-C', paths.seed, 'remote', 'add', 'origin', paths.origin);
  git('-C', paths.seed, 'push', 'origin', 'main');
  git('clone', paths.origin, paths.clone);
  const threadId = 'smoke', sublead = 'wc-smoke-sub-lead', token = 'harness-sublead-token';
  if (mode === 'live') git('-C', paths.clone, 'branch', `wc/${threadId}`);
  const script = path.join(dir, 'slow-upload-pack');
  function setOriginSlow(slow) {
    assert(!slow || slowOriginSeconds, 'slow origin was not configured');
    git('-C', paths.clone, 'remote', 'set-url', 'origin', slow ? `ext::${script} ${paths.origin}` : paths.origin);
  }
  if (slowOriginSeconds) {
    await fsp.writeFile(script, `#!/bin/sh\nsleep ${slowOriginSeconds}\nexec git-upload-pack "$1"\n`, { mode: 0o755 });
    git('-C', paths.clone, 'config', 'protocol.ext.allow', 'always');
    setOriginSlow(true);
  }
  const state = new State(paths.hubState);
  await state.init();
  // Settings for this private hub only, written before it starts; the hub fills every key not given.
  if (hubSettings) await state.saveSettings(hubSettings);
  await atomicWrite(state.machinesPath, JSON.stringify({ harness: { name: 'harness', address: '127.0.0.1', port: proxyPort, secret_file: secretFile } }));
  if (mode === 'live') await state.save({ id: threadId, project: paths.clone, machine: 'harness', branch: `wc/${threadId}`, cli: 'claude', sessions: [{ name: sublead, token, role: 'sub-lead', live: true, status: 'ready' }], cards: [], asides: [], pinned: {}, queues: {}, sent: [], archived: false, created_at: new Date().toISOString() });
  const counts = Object.create(null), statuses = [];
  const proxy = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const payload = Buffer.concat(chunks);
      if (req.method === 'POST' && req.url === '/v1/sessions') { try { const name = JSON.parse(payload).name; counts[name] = (counts[name] || 0) + 1; } catch {} }
      const upstream = http.request({ host: '127.0.0.1', port: machinePort, path: req.url, method: req.method, headers: req.headers }, response => {
        res.writeHead(response.statusCode, response.headers);
        if (req.url === '/v1/status') { const parts = []; response.on('data', c => parts.push(c)); response.on('end', () => { try { statuses.push(JSON.parse(Buffer.concat(parts))); } catch {} }); }
        response.pipe(res);
      });
      upstream.on('error', error => { if (!res.headersSent) res.writeHead(502); res.end(error.message); });
      upstream.end(payload);
    });
  });
  const events = [];
  const eventProxy = http.createServer((req, res) => {
    const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
      const payload = Buffer.concat(chunks);
      const upstream = http.request({ host: '127.0.0.1', port: hubPort, path: req.url, method: req.method, headers: req.headers }, response => {
        if (req.url === '/wheelchair/api/machine/events' && response.statusCode >= 200 && response.statusCode < 300) {
          try { events.push({ ...JSON.parse(payload), received_at: Date.now() }); } catch {}
        }
        res.writeHead(response.statusCode, response.headers); response.pipe(res);
      });
      upstream.on('error', error => { if (!res.headersSent) res.writeHead(502); res.end(error.message); }); upstream.end(payload);
    });
  });
  const children = [];
  function start(args, childEnv) {
    const child = spawn(process.execPath, args, { cwd: root, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', c => { output += c; }); child.stderr.on('data', c => { output += c; });
    child.output = () => output; children.push(child); trackChild(child); return child;
  }
  const tmux = (...args) => spawnSync('tmux', args, { env, encoding: 'utf8' });
  const matchPaths = { tmux: paths.tmux, ...(mode === 'smoke' ? { home: paths.home } : {}) };
  onCleanup(() => { tmux('kill-server'); proxy.close(); eventProxy.close(); waitForRunProcesses(dir, matchPaths); });
  let teardown;
  try {
    await new Promise((resolve, reject) => { proxy.once('error', reject); proxy.listen(proxyPort, '127.0.0.1', resolve); });
    if (recordEvents) await new Promise((resolve, reject) => { eventProxy.once('error', reject); eventProxy.listen(eventPort, '127.0.0.1', resolve); });
    const hub = start(hubArgv, hubEnv);
    const machine = start(machineArgv, env);
    await waitFor(async () => { if (hub.exitCode !== null || machine.exitCode !== null) throw new Error(`process exited: ${hub.output()} ${machine.output()}`); return (await fetch(`${hubUrl}/whoami`)).ok && (await request(`${machineUrl}/v1/sessions`, 'GET', undefined, { [header]: 'harness-machine-secret' })); });
    const viewerToken = (await fsp.readFile(path.join(resolved.paths.hubCache, '.token'), 'utf8')).trim();
    const callHub = (route, method = 'GET', body) => request(`${hubUrl}${route}${route.includes('?') ? '&' : '?'}token=${viewerToken}`, method, body, method === 'GET' ? {} : { origin: `http://127.0.0.1:${hubPort}`, 'x-graph-token': viewerToken });
    const callMachine = (route, method = 'GET', body) => request(`${machineUrl}${route}`, method, body, { [header]: 'harness-machine-secret' });
    const agent = body => request(`${hubUrl}/api/machine/session`, 'POST', { ...body, calling_session: sublead }, { [header]: 'harness-machine-secret' });
    teardown = async function () {
      try { const sessions = await callMachine('/v1/sessions'); for (const s of sessions) if (s.running) await callMachine(`/v1/sessions/${encodeURIComponent(s.name)}`, 'DELETE').catch(() => {}); } catch {}
      tmux('kill-server');
      const privateTmuxGone = tmux('list-sessions').status !== 0;
      await new Promise(resolve => proxy.close(resolve));
      if (recordEvents) await new Promise(resolve => eventProxy.close(resolve));
      for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
      await Promise.all(children.map(child => child.exitCode !== null || child.signalCode !== null ? null : new Promise(resolve => child.once('exit', resolve))));
      const leftoverProcesses = waitForRunProcesses(dir, matchPaths);
      cleanupNow();
      return { privateTmuxGone, runFolderGone: !fs.existsSync(dir), leftoverProcesses };
    }
    const config = JSON.parse(await fsp.readFile(path.join(resolved.paths.machineState, 'machine.json'), 'utf8'));
    assert.equal(config.port, resolved.ports.machine, `machine.json port: expected ${resolved.ports.machine}, got ${config.port}`);
    assert.equal(config.hub_url, recordEvents ? `http://127.0.0.1:${eventPort}/wheelchair` : hubUrl, `machine.json hub_url: expected ${hubUrl}, got ${config.hub_url}`);
    if (mode === 'live') {
      const list = await agent({ action: 'list' });
      assert(list.sessions.some(s => s.name === sublead && s.role === 'sub-lead' && s.live && s.status === 'ready'), `seeded sub-lead missing from agent list: ${JSON.stringify(list)}`);
    }
    return { dir, paths, ports: { hub: hubPort, machine: machinePort, proxy: proxyPort }, env, threadId, sublead, token, counts, statuses, events, callHub, callMachine, agent, tmux, waitFor, teardown, git, setOriginSlow };
  } catch (error) { if (teardown) await teardown(); else cleanupNow(); throw error; }
}
module.exports = { createHarness, waitFor, effectivePaths, assertIsolated, runProcesses, waitForRunProcesses };

if (require.main === module) (async () => {
  if (!process.argv.includes('--check-live')) throw new Error('Use --check-live');
  const h = await createHarness({ mode: 'live', slowOriginSeconds: 8 });
  try {
    const list = await h.agent({ action: 'list' });
    assert(list.sessions.some(s => s.name === h.sublead && s.role === 'sub-lead' && s.live && s.status === 'ready'));
    console.log(`Seeded session: ${JSON.stringify(list.sessions.find(s => s.name === h.sublead))}`);
    const before = Date.now(); h.git('-C', h.paths.clone, 'fetch', 'origin'); const elapsed = (Date.now() - before) / 1000;
    assert(elapsed >= 8); console.log(`Slow origin fetch: ${elapsed.toFixed(2)} s`);
  } finally { await h.teardown(); }
  console.log(`Run folder removed: ${!fs.existsSync(h.dir)}`);
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
