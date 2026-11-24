'use strict';
const { test, afterEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { makeTempSync } = require('../../test-support/run-dir');
const proxy = path.join(__dirname, '../lib/win-tool-proxy.js');
const server = path.join(__dirname, 'fixtures/win-tool/server.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Every spawned child is tracked so a failed test cannot leave one running and hold the file open.
const children = new Set();
function track(child) { children.add(child); child.on('close', () => children.delete(child)); return child; }
function cleanup() {
  for (const child of children) {
    try { child.kill('SIGKILL'); } catch {}
    for (const stream of [child.stdin, child.stdout, child.stderr]) stream?.destroy();
  }
  children.clear();
}
afterEach(cleanup);
after(cleanup);
const TEST_TIMEOUT = { timeout: 20000 };
const waitFor = async (predicate, timeout = 3000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const value = predicate(); if (value) return value; await sleep(10); }
  throw new Error('timed out waiting for condition');
};
function launch({ ready = false, env = {}, cache, command = process.execPath, args, pause = false, probeMs = 2000, preload, holdMs = 100, initMs = 200 } = {}) {
  const dir = makeTempSync('proxy-'), readyFile = path.join(dir, 'ready'), list = path.join(dir, 'cache', 'list'), record = path.join(dir, 'record');
  if (ready) fs.writeFileSync(readyFile, JSON.stringify({ state: 'ready', copy: 'C:\\copy' }));
  if (cache) { fs.mkdirSync(path.dirname(list)); fs.writeFileSync(list, JSON.stringify({ tools: cache })); }
  const child = track(spawn(process.execPath, [...(preload ? ['--require', preload] : []), proxy, '--probe-ms', String(probeMs), '--ready-file', readyFile, '--list-cache', list, '--name', 'example', '--hold-ms', String(holdMs), '--poll-ms', '10', '--init-ms', String(initMs), '--stop-ms', '20,30,20', '--', command, ...(args || (command === process.execPath ? [server] : []))], { env: { ...process.env, WHEELCHAIR_SESSION_TOKEN: 'secret', RECORD: record, ...env } }));
  let text = '', stderr = ''; const lines = [];
  child.stdout.on('data', b => { text += b; let n; while ((n = text.indexOf('\n')) >= 0) { lines.push(JSON.parse(text.slice(0, n))); text = text.slice(n + 1); } });
  if (pause) child.stdout.pause();
  child.stderr.on('data', b => { stderr += b; });
  const exit = new Promise(r => child.on('close', (code, signal) => r({ code, signal, stderr })));
  const send = (method, id, params = {}) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, ...(id === undefined ? {} : { id }), params }) + '\n');
  const wait = async pred => { for (const end = Date.now() + 10000; Date.now() < end;) { const result = lines.find(pred); if (result) return result; await sleep(10); } throw new Error('missing message: ' + JSON.stringify(lines)); };
  const setReady = value => fs.writeFileSync(readyFile, JSON.stringify(value));
  const records = () => { try { return fs.readFileSync(record, 'utf8').trim().split('\n').map(JSON.parse); } catch { return []; } };
  return { child, lines, send, wait, setReady, records, exit, list };
}
test('stand-in hands held calls to tool, caches paginated list and sets environment', TEST_TIMEOUT, async () => {
  const p = launch({ cache: [{ name: 'old' }], env: { PAGES: '1', WSLENV: 'OTHER/u' }, holdMs: 5000, initMs: 5000 });
  p.send('initialize', 1, { protocolVersion: 'v' }); assert.equal((await p.wait(x => x.id === 1)).result.serverInfo.name, 'example');
  p.send('tools/list', 2); assert.equal((await p.wait(x => x.id === 2)).result.tools[0].name, 'old');
  p.send('tools/call', 3); p.send('notifications/initialized'); p.setReady({ state: 'ready', copy: 'C:\\copy' });
  assert.equal((await p.wait(x => x.id === 3)).result.ok, true); await p.wait(x => x.method === 'notifications/tools/list_changed');
  for (let i = 0; i < 100 && !fs.existsSync(p.list); i++) await sleep(10);
  await sleep(30); assert.deepEqual(JSON.parse(fs.readFileSync(p.list)).tools.map(x => x.name), ['first', 'second']);
  const rec = p.records(); assert.equal(rec[0].env.token, undefined); assert.equal(rec[0].env.copy, 'C:\\copy'); assert.match(rec[0].env.wslenv, /WHEELCHAIR_WINDOWS_PROJECT/);
  assert.equal(rec.filter(x => x.method === 'notifications/initialized').length, 1); assert.equal(p.lines.filter(x => x.method === 'notifications/tools/list_changed').length, 1);
  p.child.stdin.end(); assert.equal((await p.exit).code, 0);
});
test('ready at start pipes messages and returns final exit status with stdin open', TEST_TIMEOUT, async () => {
  const p = launch({ ready: true }); p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1); p.send('notifications/initialized');
  p.send('exit', 2); await p.wait(x => x.id === 2); assert.equal((await p.exit).code, 7);
});
test('timeouts, cancellation and failed state resolve stand-in calls', TEST_TIMEOUT, async () => {
  const p = launch({ initMs: 5000 }); p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1); p.send('tools/list', 2); assert.deepEqual((await p.wait(x => x.id === 2)).result.tools, []);
  p.send('tools/call', 3); p.send('tools/call', 4); p.send('notifications/cancelled', undefined, { requestId: 4 }); assert.match((await p.wait(x => x.id === 3)).error.message, /not ready yet/);
  p.setReady({ state: 'failed', reason: 'disk' }); await sleep(40); p.send('tools/call', 5); assert.match((await p.wait(x => x.id === 5)).error.message, /disk/);
  p.setReady({ state: 'ready', copy: 'C:' }); await p.wait(x => x.method === 'notifications/tools/list_changed'); await sleep(30); assert.ok(!p.records().some(x => x.id === 3 || x.id === 4)); p.child.stdin.end(); await p.exit;
});
test('handoff failure replies and exits with stdin open', TEST_TIMEOUT, async () => {
  const p = launch({ env: { INIT: 'fail' } }); p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1); p.send('tools/call', 2); p.setReady({ state: 'ready', copy: 'C:' }); assert.ok((await p.wait(x => x.id === 2)).error); assert.equal((await p.exit).code, 1);
});
test('missing executable reports failure, before or after readiness', TEST_TIMEOUT, async () => {
  for (const ready of [true, false]) { const p = launch({ ready, command: '/missing/wc-tool' }); if (!ready) p.setReady({ state: 'ready', copy: 'C:' }); const result = await p.exit; assert.equal(result.code, 1); assert.match(result.stderr, /ENOENT/); }
});
test('handoff timeout covers calls queued during initialization', TEST_TIMEOUT, async () => {
  const p = launch({ env: { INIT: 'absent' } }); p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1); p.setReady({ state: 'ready', copy: 'C:' }); await sleep(50); p.send('tools/call', 2); assert.match((await p.wait(x => x.id === 2)).error.message, /not ready yet/); assert.equal((await p.exit).code, 1); assert.ok(!p.records().some(x => x.id === 2));
});
test('exiting during handoff fails queued requests', TEST_TIMEOUT, async () => {
  const p = launch({ env: { INIT: 'exit' } }); p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1); p.send('tools/call', 2); p.setReady({ state: 'ready', copy: 'C:' }); assert.ok((await p.wait(x => x.id === 2)).error); assert.equal((await p.exit).code, 1);
});
test('failed probe does not replace cache and client list is not cached', TEST_TIMEOUT, async () => {
  const p = launch({ ready: true, env: { PAGES: '1', FAIL_PAGE: '1' } }); p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1); p.send('tools/list', 2); await p.wait(x => x.id === 2); await sleep(30); assert.equal(fs.existsSync(p.list), false); p.send('notifications/initialized'); await sleep(70); assert.equal(fs.existsSync(p.list), false); p.child.stdin.end(); await p.exit;
});
test('3a starts without synthetic messages and signals stop the tool', TEST_TIMEOUT, async () => {
  for (const signal of ['SIGTERM', 'SIGHUP']) { const p = launch(); p.setReady({ state: 'ready', copy: 'C:' }); await sleep(50); p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1); assert.equal(p.lines.some(x => x.method === 'notifications/tools/list_changed'), false); p.child.kill(signal); assert.equal((await p.exit).code, 0); }
});
test('large final response is flushed with client stdin open', TEST_TIMEOUT, async () => {
  const p = launch({ ready: true, pause: true }); p.send('large', 1); await sleep(150); p.child.stdout.resume(); assert.equal((await p.wait(x => x.id === 1)).result.length, 1024 * 1024); assert.equal((await p.exit).code, 7);
});
test('stdin close before ready exits without spawning', TEST_TIMEOUT, async () => {
  const p = launch(); p.child.stdin.end(); assert.equal((await p.exit).code, 0); assert.deepEqual(p.records(), []);
});
test('tool signal status is propagated', TEST_TIMEOUT, async () => {
  const p = launch({ ready: true }); p.send('signal', 1); assert.equal((await p.exit).code, 143);
});
test('held calls fail immediately when readiness changes to failed', TEST_TIMEOUT, async () => {
  const p = launch(); p.send('tools/call', 1); p.setReady({ state: 'failed', reason: 'offline' }); assert.match((await p.wait(x => x.id === 1)).error.message, /offline/); p.child.stdin.end(); await p.exit;
});

test('handoff suppresses cancelled requests and duplicate initialized notifications', TEST_TIMEOUT, async () => {
  // The tool answers initialize after 1 s, so the cancellations below reliably arrive mid-handoff.
  const p = launch({ env: { DELAY: '1000' }, holdMs: 5000, initMs: 5000 });
  p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1);
  p.send('tools/call', 2); p.setReady({ state: 'ready', copy: 'C:' });
  await waitFor(() => p.records().some(x => x.method === 'initialize'), 10000);
  p.send('tools/call', 3); p.send('notifications/cancelled', undefined, { requestId: 2 });
  p.send('notifications/cancelled', undefined, { requestId: 3 });
  p.send('notifications/cancelled', undefined, { requestId: 99 });
  await p.wait(x => x.method === 'notifications/tools/list_changed');
  p.send('notifications/initialized'); await sleep(60);
  const rec = p.records();
  assert.deepEqual(rec.filter(x => x.method === 'notifications/cancelled').map(x => x.params.requestId), [99]);
  assert.ok(!rec.some(x => x.id === 2 || x.id === 3));
  assert.equal(rec.filter(x => x.method === 'notifications/initialized').length, 1);
  assert.equal(rec.filter(x => x.method === 'tools/list').length, 1);
  assert.equal(p.lines.filter(x => x.method === 'notifications/tools/list_changed').length, 1);
  assert.ok(!p.lines.some(x => typeof x.id === 'string' && x.id.startsWith('wc-go-between-list-')));
  p.child.stdin.end(); await p.exit;
});
test('missing or empty copy is absent from tool environment', TEST_TIMEOUT, async () => {
  for (const copy of [undefined, '']) {
    const p = launch({ env: { WHEELCHAIR_WINDOWS_PROJECT: 'stale' } });
    p.setReady({ state: 'ready', copy }); p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1);
    assert.equal(p.records()[0].env.copy, undefined); p.child.stdin.end(); await p.exit;
  }
});
test('signals close tool stdin and escalate through TERM and KILL', TEST_TIMEOUT, async () => {
  for (const [signal, ignoreTerm] of [['SIGTERM', false], ['SIGHUP', true]]) {
    const p = launch({ ready: true, env: { IGNORE_END: '1', ...(ignoreTerm ? { IGNORE_TERM: '1' } : {}) } });
    p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1);
    p.child.kill(signal); assert.equal((await p.exit).code, 0);
    const rec = p.records(); assert.ok(rec.some(x => x.event === 'stdin-end'));
    if (ignoreTerm) assert.ok(rec.some(x => x.signal === 'SIGTERM'));
  }
});
test('closed client read end during tool output shuts down without crashing', TEST_TIMEOUT, async () => {
  const p = launch({ ready: true }); p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1);
  p.child.stdout.destroy(); p.send('ping', 2); const result = await p.exit;
  assert.equal(result.code, 0); assert.doesNotMatch(result.stderr, /Error:|\n\s+at /);
});
test('closed client read end during large final response does not crash', TEST_TIMEOUT, async () => {
  const p = launch({ ready: true, pause: true }); p.send('large', 1); await sleep(100); p.child.stdout.destroy();
  const result = await p.exit; assert.ok([0, 7].includes(result.code)); assert.doesNotMatch(result.stderr, /Error:|\n\s+at /);
});
test('tool exiting while receiving input does not crash proxy', TEST_TIMEOUT, async () => {
  const p = launch({ ready: true }); p.send('die', 1);
  p.child.stdin.on('error', () => {}); for (let i = 0; i < 100; i++) p.send('ping', i, { data: 'x'.repeat(4096) });
  const result = await p.exit; assert.equal(result.code, 9); assert.doesNotMatch(result.stderr, /Error:|\n\s+at /);
});
test('command-only entry launches', TEST_TIMEOUT, async () => {
  const p = launch({ ready: true, command: '/bin/cat' }); p.send('ping', 1); assert.equal((await p.wait(x => x.id === 1)).method, 'ping'); p.child.stdin.end(); assert.equal((await p.exit).code, 0);
});

test('handoff with empty list forwards held call after readiness', TEST_TIMEOUT, async () => {
  const p = launch({ holdMs: 5000, initMs: 5000 }); p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1);
  p.send('tools/list', 2); assert.deepEqual((await p.wait(x => x.id === 2)).result.tools, []);
  p.send('tools/call', 3); p.setReady({ state: 'ready', copy: 'C:' });
  assert.equal((await p.wait(x => x.id === 3)).result.ok, true); await p.wait(x => x.method === 'notifications/tools/list_changed');
  await sleep(30); assert.equal(p.records().filter(x => x.method === 'notifications/initialized').length, 1);
  assert.equal(p.lines.filter(x => x.method === 'notifications/tools/list_changed').length, 1);
  p.child.stdin.end(); await p.exit;
});

const readRecords = file => { try { return fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse); } catch { return []; } };
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { if (e.code === 'ESRCH') return false; throw e; } };

test('idle socket reader closure shuts down within the probe and stop budgets', TEST_TIMEOUT, async () => {
  const p = launch({ ready: true, probeMs: 200 });
  try {
    await waitFor(() => p.records().length);
    const start = Date.now(); p.child.stdout.destroy();
    await waitFor(() => p.records().some(x => x.event === 'stdin-end'), 700);
    assert.ok(Date.now() - start <= 700);
    const stopped = Date.now(); assert.equal((await p.exit).code, 0); assert.ok(Date.now() - stopped <= 370);
  } finally { p.child.kill('SIGKILL'); }
});

function pipeParent(mode) {
  const dir = makeTempSync('proxy-pipe-'), ready = path.join(dir, 'ready'), record = path.join(dir, 'record');
  fs.writeFileSync(ready, JSON.stringify({ state: 'ready' }));
  const child = track(spawn('python3', [path.join(__dirname, 'fixtures/win-tool/pipe-parent.py'), mode, process.execPath, proxy, server, ready, path.join(dir, 'cache'), record]));
  let buf = '', stderr = ''; const lines = [];
  child.stdout.on('data', b => { buf += b; let n; while ((n = buf.indexOf('\n')) >= 0) { lines.push(JSON.parse(buf.slice(0, n))); buf = buf.slice(n + 1); } });
  child.stderr.on('data', b => { stderr += b; });
  return { child, lines, record, stderr: () => stderr };
}
function killPid(pid) { if (pid) try { process.kill(pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') throw e; } }

test('OS pipe reader closure is detected and the tool stops within its budget', TEST_TIMEOUT, async () => {
  const p = pipeParent('pipe'); let ids;
  try {
    ids = await waitFor(() => p.lines[0]); await waitFor(() => readRecords(p.record).length);
    const start = Date.now(); p.child.stdin.write('\n');
    await waitFor(() => readRecords(p.record).some(x => x.event === 'stdin-end'), 700);
    assert.ok(Date.now() - start <= 700);
    const stopped = Date.now(); await waitFor(() => p.lines.find(x => x.exit !== undefined), 600);
    assert.ok(Date.now() - stopped <= 600); assert.equal(p.lines.find(x => x.exit !== undefined).exit, 0);
  } finally { killPid(ids?.proxy); p.child.kill('SIGKILL'); }
});

test('pipe reader check stays disabled if parent has no reader initially', TEST_TIMEOUT, async () => {
  const p = pipeParent('off'); let ids;
  try {
    ids = await waitFor(() => p.lines[0]); await waitFor(() => readRecords(p.record).length);
    await sleep(900); assert.ok(alive(ids.proxy)); assert.ok(!readRecords(p.record).some(x => x.event === 'stdin-end'));
    p.child.stdin.write('\n'); await waitFor(() => !alive(ids.proxy));
  } finally { killPid(ids?.holder); killPid(ids?.proxy); p.child.kill('SIGKILL'); }
});

test('parent loss ends proxy with held pipes, pending output, and a writing tool', TEST_TIMEOUT, async () => {
  for (const mode of ['gone', 'pending', 'writing']) {
    const p = pipeParent(mode); let ids;
    try {
      ids = await waitFor(() => p.lines[0]); await waitFor(() => readRecords(p.record).length);
      if (mode === 'pending') await waitFor(() => readRecords(p.record).some(x => x.method === 'large'));
      await new Promise(resolve => p.child.once('exit', resolve));
      await waitFor(() => readRecords(p.record).some(x => x.event === 'stdin-end'), 700);
      await waitFor(() => !alive(ids.proxy), 1500);
    } finally { killPid(ids?.holder); killPid(ids?.proxy); p.child.kill('SIGKILL'); }
  }
});

test('socket probe skips pending stdout writes', TEST_TIMEOUT, async () => {
  const dir = makeTempSync('proxy-probe-'), log = path.join(dir, 'probe');
  const p = launch({ ready: true, probeMs: 200, pause: true, preload: path.join(__dirname, 'fixtures/win-tool/probe-preload.js'), env: { PROBE_LOG: log, KEEP_LARGE: '1' } });
  try {
    await waitFor(() => fs.existsSync(log)); p.send('large', 1);
    await waitFor(() => p.records().some(x => x.method === 'large')); await sleep(650);
    assert.ok(fs.readFileSync(log, 'utf8').trim().split('\n').every(x => Number(x) === 0));
    const before = fs.readFileSync(log, 'utf8'); await sleep(450); assert.equal(fs.readFileSync(log, 'utf8'), before);
    p.child.stdout.resume(); await p.wait(x => x.id === 1);
    await waitFor(() => fs.readFileSync(log, 'utf8') !== before); p.child.stdin.end(); await p.exit;
  } finally { p.child.kill('SIGKILL'); }
});

test('probe interval must be a positive integer', TEST_TIMEOUT, async () => {
  for (const probeMs of ['0', '01', '-1', 'abc']) { const p = launch({ probeMs }); const result = await p.exit; assert.equal(result.code, 2); assert.match(result.stderr, /Invalid proxy arguments/); }
});
