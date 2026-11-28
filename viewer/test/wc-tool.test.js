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

test('keyed lists report session status, unavailable sessions, failure and scratch checkout', async () => {
  const dir = repo();
  tool(dir, 'keyed', { kind: 'script', inputs: {}, run: ['node'], keys: ['ALPHA', 'BETA', 'GAMMA'] });
  tool(dir, 'plain', { kind: 'script', inputs: {}, run: ['node'] });
  const entry = { name: 'keyed', source: 'project', store: 'project', keys: [{ name: 'ALPHA', set: true, reason: null }, { name: 'BETA', set: false, reason: 'not set on this machine' }, { name: 'GAMMA', set: false, reason: 'value too short' }] };
  let unavailable = null, fail = false;
  const server = http.createServer((req, res) => {
    assert.equal(req.headers['x-wheelchair-session-token'], 'secret');
    if (req.url === '/v1/agent/tools') res.end(JSON.stringify({ worktree: dir, shared_copy: null, keyed_unavailable: unavailable }));
    else if (req.url === '/v1/agent/tool-keys') { if (fail) { res.statusCode = 503; res.end('offline'); } else res.end(JSON.stringify({ tools: [entry] })); }
    else { res.statusCode = 404; res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const extra = { WHEELCHAIR_SESSION_TOKEN: 'secret', WHEELCHAIR_MACHINE_URL: `http://127.0.0.1:${server.address().port}/v1/agent` };
  const list = async (...args) => { const result = await done(child(dir, ['list', ...args], extra)); assert.equal(result.code, 0, result.stderr); return result.stdout; };
  try {
    assert.equal(await list(), 'keyed\tscript\tproject\tok\tkeys: ALPHA set, BETA not set, GAMMA value too short\nplain\tscript\tproject\tok\n');
    let rows = JSON.parse(await list('--json')); assert.deepEqual(rows[0].key_status, entry); assert.equal(rows[0].keyed_unavailable, null); assert.equal(rows[1].key_status, null); assert.equal('keyed_unavailable' in rows[1], false);
    unavailable = "sandboxed Codex can't use; set Codex to unrestricted in Settings to use it";
    assert.match(await list(), /needs keys, which sandboxed Codex can't use; set Codex to unrestricted in Settings to use it/);
    rows = JSON.parse(await list('--json')); assert.equal(rows[0].keyed_unavailable, unavailable);
    unavailable = null; fail = true;
    assert.match(await list(), /key status unavailable: offline/);
    rows = JSON.parse(await list('--json')); assert.equal(rows[0].key_status, null);
  } finally { server.close(); }
  assert.equal(run(dir, ['list']).stdout, 'keyed\tscript\tproject\tok\tkeys: ALPHA, BETA, GAMMA (key status unknown outside a session)\nplain\tscript\tproject\tok\n');
});

test('keyed server lists report key status', async () => {
  const dir = repo();
  tool(dir, 'keyed', { kind: 'server', start: ['node'], keys: ['ALPHA', 'BETA', 'GAMMA'] });
  tool(dir, 'plain', { kind: 'script', inputs: {}, run: ['node'] });
  const entry = { name: 'keyed', source: 'project', store: 'project', keys: [{ name: 'ALPHA', set: true, reason: null }, { name: 'BETA', set: false, reason: 'not set on this machine' }, { name: 'GAMMA', set: false, reason: 'value too short' }] };
  let unavailable = null, fail = false;
  const server = http.createServer((req, res) => {
    assert.equal(req.headers['x-wheelchair-session-token'], 'secret');
    if (req.url === '/v1/agent/tools') res.end(JSON.stringify({ worktree: dir, shared_copy: null, keyed_unavailable: unavailable }));
    else if (req.url === '/v1/agent/tool-keys') { if (fail) { res.statusCode = 503; res.end('offline'); } else res.end(JSON.stringify({ tools: [entry] })); }
    else { res.statusCode = 404; res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const extra = { WHEELCHAIR_SESSION_TOKEN: 'secret', WHEELCHAIR_MACHINE_URL: `http://127.0.0.1:${server.address().port}/v1/agent` };
  const list = async (...args) => { const result = await done(child(dir, ['list', ...args], extra)); assert.equal(result.code, 0, result.stderr); return result.stdout; };
  try {
    assert.equal(await list(), 'keyed\tserver\tproject\tok\tkeys: ALPHA set, BETA not set, GAMMA value too short\nplain\tscript\tproject\tok\n');
    let rows = JSON.parse(await list('--json')); assert.deepEqual(rows[0].key_status, entry); assert.equal(rows[0].keyed_unavailable, null); assert.equal(rows[1].key_status, null); assert.equal('keyed_unavailable' in rows[1], false);
    unavailable = "sandboxed Codex can't use; set Codex to unrestricted in Settings to use it";
    assert.match(await list(), /needs keys, which sandboxed Codex can't use; set Codex to unrestricted in Settings to use it/);
    rows = JSON.parse(await list('--json')); assert.equal(rows[0].keyed_unavailable, unavailable);
    unavailable = null; fail = true;
    assert.match(await list(), /key status unavailable: offline/);
    rows = JSON.parse(await list('--json')); assert.equal(rows[0].key_status, null);
  } finally { server.close(); }
  assert.equal(run(dir, ['list']).stdout, 'keyed\tserver\tproject\tok\tkeys: ALPHA, BETA, GAMMA (key status unknown outside a session)\nplain\tscript\tproject\tok\n');
});

test('keyed check and run describe key handling while preserving caller environment', () => {
  const dir = repo();
  tool(dir, 'keyed', { kind: 'script', inputs: {}, run: ['./run.sh'], keys: ['WC_TEST_ABSENT_KEY'] }, { 'run.sh': '#!/bin/sh\nprintf "%s|%s" "${WC_TEST_ABSENT_KEY-unset}" "$WC_TEST_PRESENT"' });
  tool(dir, 'server', { kind: 'server', start: ['node', 'server.js'], keys: ['WC_TEST_ABSENT_KEY'] }, { 'server.js': `require(${JSON.stringify(path.resolve(__dirname, '../../machine/lib/mcp-stdio.js'))}).serve({name:process.env.WC_TEST_ABSENT_KEY || 'unset',version:'1',tools:[{name:'hello',description:'Hi',inputSchema:{type:'object'}}]});` });
  tool(dir, 'broken', { kind: 'server', start: ['node', '-e', 'process.exit(1)'], keys: ['WC_TEST_ABSENT_KEY'] });
  assert.equal(run(dir, ['check', 'keyed']).stdout, 'keyed: ok (validated without using keys)\n');
  assert.equal(run(dir, ['check', 'server'], { WC_TEST_ABSENT_KEY: 'secretvalue' }).stdout, 'server: unset tools: hello (checked without its keys)\n');
  assert.match(run(dir, ['check', 'broken']).stdout, /it ran without its keys; that may be why/);
  const result = run(dir, ['run', 'keyed'], { WC_TEST_ABSENT_KEY: undefined, WC_TEST_PRESENT: 'present' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'Ran without folder-tool keys; variables already in your environment were passed as usual. Keyed tools get their keys through MCP, from the next call in a session that offered them.\nunset|present');
});

test('bridge reports keys added after the tool was offered', async () => {
  const dir = repo(); const data = { kind: 'script', inputs: {}, run: ['node'] };
  const folder = tool(dir, 'example', data);
  const p = spawn(process.execPath, [path.resolve(__dirname, '../../machine/lib/tool-bridge.js'), '--project-dir', dir, '--tool', folder], { stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = require('node:readline').createInterface({ input: p.stdout });
  function rpc(id, method, params = {}) { return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('RPC deadline')), 5000); const onLine = line => { const message = JSON.parse(line); if (message.id === id) { clearTimeout(timer); lines.removeListener('line', onLine); resolve(message); } }; lines.on('line', onLine); p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); }); }
  try {
    assert.equal((await rpc(1, 'tools/list')).result.tools[0].name, 'example');
    fs.writeFileSync(path.join(folder, 'tool.json'), JSON.stringify({ name: 'example', description: 'Example', ...data, keys: ['TOKEN'] }));
    const result = (await rpc(2, 'tools/call', { name: 'example' })).result;
    assert.equal(result.isError, true); assert.match(result.content[0].text, /keys are used from the next agent start/); assert.match(result.content[0].text, /wc\.js tool run runs it now without keys/);
  } finally { p.stdin.end(); lines.close(); }
});

test('machine keyed runs handle results, transport failures, and local fallback', async () => {
  const dir = repo();
  tool(dir, 'keyed', { kind: 'script', inputs: {}, run: ['./run.sh'], keys: ['TOKEN'] }, { 'run.sh': '#!/bin/sh\nprintf local' });
  let mode = 'success', keyedRun = 'machine', calls = 0;
  const resultBody = { ok: true, text: 'hello 🌍', stderr: '', code: 0, signal: null, timed_out: false, truncated: false };
  const server = http.createServer((req, res) => {
    if (req.url === '/v1/agent/tools') { res.end(JSON.stringify({ worktree: dir, shared_copy: null, keyed_run: keyedRun })); return; }
    assert.equal(req.url, '/v1/agent/tools/run'); calls++;
    const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks)); assert.equal(body.name, 'keyed'); assert.deepEqual(body.input, { x: 1 }); assert.equal(body.env.WC_TEST_PRESENT, 'present');
      if (mode === 'refuse') { res.writeHead(422); res.end(JSON.stringify({ error: 'missing key' })); }
      else if (mode === 'cut') { res.writeHead(200, { 'content-length': 100 }); res.write('{"text":"partial'); res.socket.destroy(); }
      else if (mode === 'invalid') res.end('{"text":"partial');
      else if (mode === 'failure') res.end(JSON.stringify({ ...resultBody, ok: false, code: 7, stderr: 'bad', timed_out: true }));
      else { const bytes = Buffer.from(JSON.stringify(resultBody)); const split = bytes.indexOf(Buffer.from('🌍')) + 2; res.write(bytes.subarray(0, split)); setImmediate(() => res.end(bytes.subarray(split))); }
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const extra = { WHEELCHAIR_SESSION_TOKEN: 'secret', WHEELCHAIR_MACHINE_URL: `http://127.0.0.1:${server.address().port}/v1/agent`, WC_TEST_PRESENT: 'present' };
  const invoke = () => done(child(dir, ['run', 'keyed', '--input', '{"x":1}'], extra));
  try {
    let result = await invoke(); assert.equal(result.code, 0, result.stderr); assert.equal(result.stdout, 'hello 🌍');
    mode = 'failure'; result = await invoke(); assert.notEqual(result.code, 0); assert.match(result.stderr, /tool failed \(exit code 7, signal null, timed out\): bad/); assert.equal(result.stdout, '');
    mode = 'refuse'; result = await invoke(); assert.notEqual(result.code, 0); assert.match(result.stderr, /missing key/); assert.equal(result.stdout, '');
    for (mode of ['cut', 'invalid']) { result = await invoke(); assert.notEqual(result.code, 0); assert.match(result.stderr, /may already have run/); assert.equal(result.stdout, ''); }
    for (keyedRun of ['local', undefined]) { result = await invoke(); assert.equal(result.code, 0, result.stderr); assert.match(result.stdout, /^Ran without folder-tool keys;.*\nlocal$/); }
    assert.equal(calls, 5);
  } finally { await new Promise(r => server.close(r)); }
  const result = await invoke(); assert.notEqual(result.code, 0); assert.match(result.stderr, /couldn't reach the machine service; the tool did not run/); assert.equal(result.stdout, '');
});

test('machine run reports refusal after successful discovery', async () => {
  const dir = repo(); tool(dir, 'keyed', { kind: 'script', inputs: {}, run: ['node'], keys: ['TOKEN'] });
  const server = http.createServer((req, res) => { res.setHeader('Connection', 'close'); res.end(JSON.stringify({ worktree: dir, shared_copy: null, keyed_run: 'machine' })); server.close(); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const result = await done(child(dir, ['run', 'keyed'], { WHEELCHAIR_SESSION_TOKEN: 'secret', WHEELCHAIR_MACHINE_URL: `http://127.0.0.1:${server.address().port}/v1/agent` }));
  assert.notEqual(result.code, 0); assert.match(result.stderr, /couldn't reach the machine service; the tool did not run/); assert.equal(result.stdout, '');
});
