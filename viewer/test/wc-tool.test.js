'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { makeTempSync } = require('../../test-support/run-dir');
const cli = path.resolve(__dirname, '../app/wc.js');
const env = { ...process.env }; delete env.WHEELCHAIR_SESSION_TOKEN; delete env.WHEELCHAIR_MACHINE_URL;
function repo() { const dir = makeTempSync('tool-cli-'); assert.equal(spawnSync('git', ['init', '-q', dir]).status, 0); return dir; }
function run(dir, args, extra = {}) { return spawnSync(process.execPath, [cli, 'tool', ...args], { cwd: dir, env: { ...env, ...extra }, encoding: 'utf8' }); }
function tool(root, name, data, files = {}) { const dir = path.join(root, '.wheelchair/tools', name); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'tool.json'), JSON.stringify({ name, description: 'Example', ...data })); for (const [file, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, file), content, { mode: 0o755 }); return dir; }
function alive(pid) { try { const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8'); return stat.slice(stat.lastIndexOf(')') + 2)[0] !== 'Z'; } catch { return false; } }
async function until(fn, ms = 5000) { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return; await new Promise(r => setTimeout(r, 50)); } assert.fail('condition did not become true before deadline'); }
function child(dir, args, extra = {}) { return spawn(process.execPath, [cli, 'tool', ...args], { cwd: dir, env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] }); }
function done(p) { return new Promise(resolve => { let stdout = '', stderr = ''; p.stdout.on('data', x => stdout += x); p.stderr.on('data', x => stderr += x); p.on('close', (code, signal) => resolve({ code, signal, stdout, stderr })); }); }

test('templates work, reject existing folders and names, and use checkout top', () => {
  const dir = repo(); fs.mkdirSync(path.join(dir, 'sub'));
  for (const kind of ['script', 'server']) assert.equal(run(path.join(dir, 'sub'), ['new', kind, '--kind', kind]).status, 0);
  const check = run(dir, ['check', 'server']); assert.equal(check.status, 0, check.stderr); assert.match(check.stdout, /server.*echo/);
  const result = run(dir, ['run', 'script', '--input', '{"text":"hello"}']); assert.equal(result.status, 0); assert.match(result.stdout, /hello/);
  const folder = path.join(dir, '.wheelchair/tools/existing'); fs.mkdirSync(folder); fs.writeFileSync(path.join(folder, 'keep'), 'unchanged');
  assert.notEqual(run(dir, ['new', 'existing', '--kind', 'script']).status, 0); assert.deepEqual(fs.readdirSync(folder), ['keep']); assert.equal(fs.readFileSync(path.join(folder, 'keep'), 'utf8'), 'unchanged');
  for (const name of ['bad.name', 'wheelchair-tools']) assert.notEqual(run(dir, ['new', name, '--kind', 'script']).status, 0);
  assert.notEqual(run(makeTempSync('outside-'), ['list']).status, 0);
});

test('session list reads pinned shared tools and hides collisions', async () => {
  const dir = repo(), shared = makeTempSync('shared-');
  for (const [root, name] of [[dir, 'same'], [shared, 'same'], [shared, 'other']]) tool(root, name, { kind: 'script', inputs: {}, run: ['node'] });
  const server = http.createServer((req, res) => { assert.equal(req.url, '/v1/agent/tools'); assert.equal(req.headers['x-wheelchair-session-token'], 'secret'); res.end(JSON.stringify({ worktree: dir, shared_copy: shared })); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try { const p = child(dir, ['list', '--json'], { WHEELCHAIR_SESSION_TOKEN: 'secret', WHEELCHAIR_MACHINE_ORIGIN: `http://127.0.0.1:${server.address().port}` }); const result = await done(p); assert.equal(result.code, 0, result.stderr); const rows = JSON.parse(result.stdout); assert.equal(rows.find(x => x.name === 'same' && x.source === 'shared').status, 'hidden'); assert.equal(rows.find(x => x.name === 'same' && x.source === 'project').status, 'ok'); assert.equal(rows.find(x => x.name === 'other').status, 'ok'); } finally { server.close(); }
});

test('run and check sanitize environment and report failures', async () => {
  const dir = repo();
  tool(dir, 'env', { kind: 'script', inputs: {}, run: ['./run.sh'] }, { 'run.sh': '#!/bin/sh\nprintf "%s|%s" "${WHEELCHAIR_SESSION_TOKEN-unset}" "$WHEELCHAIR_PROJECT_DIR"' });
  tool(dir, 'fail', { kind: 'script', inputs: {}, run: ['./run.sh'] }, { 'run.sh': '#!/bin/sh\necho tail-message >&2\nexit 7\n' });
  tool(dir, 'server', { kind: 'server', start: ['node', 'server.js'] }, { 'server.js': `const {serve}=require(${JSON.stringify(path.resolve(__dirname, '../../machine/lib/mcp-stdio.js'))}); serve({name: (process.env.WHEELCHAIR_SESSION_TOKEN || 'unset')+'|'+process.env.WHEELCHAIR_PROJECT_DIR, version:'1', tools:[]});` });
  const server = http.createServer((req, res) => res.end(JSON.stringify({ worktree: dir, shared_copy: null }))); await new Promise(r => server.listen(0, '127.0.0.1', r));
  const extra = { WHEELCHAIR_SESSION_TOKEN: 'secret', WHEELCHAIR_MACHINE_ORIGIN: `http://127.0.0.1:${server.address().port}` };
  try { for (const args of [['run','env'], ['check','server']]) { const result = await done(child(dir, args, extra)); assert.equal(result.code, 0, result.stderr); assert.match(result.stdout, new RegExp(`unset\\|${dir}`)); } } finally { server.close(); }
  const fail = run(dir, ['run', 'fail']); assert.notEqual(fail.status, 0); assert.match(fail.stderr, /exit code 7.*tail-message/s);
  assert.match(run(dir, ['run', 'server']).stderr, /MCP or check/);
});

test('check deadline and SIGTERM kill stalled server and grandchild', async () => {
  const dir = repo(); const pidfile = path.join(dir, 'pids');
  tool(dir, 'stall', { kind: 'server', start: ['node', 'server.js'] }, { 'server.js': `const fs=require('fs'), {spawn}=require('child_process'); const p=spawn(process.execPath,['-e','setInterval(()=>{},1000)']); fs.writeFileSync(${JSON.stringify(pidfile)}, process.pid+' '+p.pid); setInterval(()=>{},1000);` });
  for (const signal of [false, true]) {
    try { fs.unlinkSync(pidfile); } catch {}
    const p = child(dir, ['check', 'stall'], { WHEELCHAIR_TOOL_CHECK_DEADLINE_MS: signal ? '10000' : '1200' }); const finished = done(p);
    await until(() => fs.existsSync(pidfile)); const pids = fs.readFileSync(pidfile, 'utf8').split(' ').map(Number);
    try {
      if (signal) p.kill('SIGTERM');
      const result = await finished; assert.ok(result.code !== 0 || result.signal); await until(() => pids.every(pid => !alive(pid)), 7000);
    } finally { try { process.kill(-pids[0], 'SIGKILL'); } catch {} } 
  }
});
