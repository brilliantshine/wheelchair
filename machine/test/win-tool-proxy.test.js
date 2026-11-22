'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { makeTempSync } = require('../../test-support/run-dir');
const proxy = path.join(__dirname, '../lib/win-tool-proxy.js');
const server = path.join(__dirname, 'fixtures/win-tool/server.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));
function launch({ ready = false, env = {}, cache, command = process.execPath, args, pause = false } = {}) {
  const dir = makeTempSync('proxy-'), readyFile = path.join(dir, 'ready'), list = path.join(dir, 'cache', 'list'), record = path.join(dir, 'record');
  if (ready) fs.writeFileSync(readyFile, JSON.stringify({ state: 'ready', copy: 'C:\\copy' }));
  if (cache) { fs.mkdirSync(path.dirname(list)); fs.writeFileSync(list, JSON.stringify({ tools: cache })); }
  const child = spawn(process.execPath, [proxy, '--ready-file', readyFile, '--list-cache', list, '--name', 'example', '--hold-ms', '100', '--poll-ms', '10', '--init-ms', '200', '--stop-ms', '20,30,20', '--', command, ...(args || (command === process.execPath ? [server] : []))], { env: { ...process.env, WHEELCHAIR_SESSION_TOKEN: 'secret', RECORD: record, ...env } });
  let text = '', stderr = ''; const lines = [];
  child.stdout.on('data', b => { text += b; let n; while ((n = text.indexOf('\n')) >= 0) { lines.push(JSON.parse(text.slice(0, n))); text = text.slice(n + 1); } });
  if (pause) child.stdout.pause();
  child.stderr.on('data', b => { stderr += b; });
  const exit = new Promise(r => child.on('close', (code, signal) => r({ code, signal, stderr })));
  const send = (method, id, params = {}) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, ...(id === undefined ? {} : { id }), params }) + '\n');
  const wait = async pred => { for (let i = 0; i < 200; i++) { const result = lines.find(pred); if (result) return result; await sleep(10); } throw new Error('missing message: ' + JSON.stringify(lines)); };
  const setReady = value => fs.writeFileSync(readyFile, JSON.stringify(value));
  const records = () => { try { return fs.readFileSync(record, 'utf8').trim().split('\n').map(JSON.parse); } catch { return []; } };
  return { child, lines, send, wait, setReady, records, exit, list };
}
test('stand-in hands held calls to tool, caches paginated list and sets environment', async () => {
  const p = launch({ cache: [{ name: 'old' }], env: { PAGES: '1', WSLENV: 'OTHER/u' } });
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
test('ready at start pipes messages and returns final exit status with stdin open', async () => {
  const p = launch({ ready: true }); p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1); p.send('notifications/initialized');
  p.send('exit', 2); await p.wait(x => x.id === 2); assert.equal((await p.exit).code, 7);
});
test('timeouts, cancellation and failed state resolve stand-in calls', async () => {
  const p = launch(); p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1); p.send('tools/list', 2); assert.deepEqual((await p.wait(x => x.id === 2)).result.tools, []);
  p.send('tools/call', 3); p.send('tools/call', 4); p.send('notifications/cancelled', undefined, { requestId: 4 }); assert.match((await p.wait(x => x.id === 3)).error.message, /not ready yet/);
  p.setReady({ state: 'failed', reason: 'disk' }); await sleep(40); p.send('tools/call', 5); assert.match((await p.wait(x => x.id === 5)).error.message, /disk/);
  p.setReady({ state: 'ready', copy: 'C:' }); await p.wait(x => x.method === 'notifications/tools/list_changed'); await sleep(30); assert.ok(!p.records().some(x => x.id === 3 || x.id === 4)); p.child.stdin.end(); await p.exit;
});
test('handoff failure replies and exits with stdin open', async () => {
  const p = launch({ env: { INIT: 'fail' } }); p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1); p.send('tools/call', 2); p.setReady({ state: 'ready', copy: 'C:' }); assert.ok((await p.wait(x => x.id === 2)).error); assert.equal((await p.exit).code, 1);
});
test('missing executable reports failure, before or after readiness', async () => {
  for (const ready of [true, false]) { const p = launch({ ready, command: '/missing/wc-tool' }); if (!ready) p.setReady({ state: 'ready', copy: 'C:' }); const result = await p.exit; assert.equal(result.code, 1); assert.match(result.stderr, /ENOENT/); }
});
test('handoff timeout covers calls queued during initialization', async () => {
  const p = launch({ env: { INIT: 'absent' } }); p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1); p.setReady({ state: 'ready', copy: 'C:' }); await sleep(50); p.send('tools/call', 2); assert.match((await p.wait(x => x.id === 2)).error.message, /not ready yet/); assert.equal((await p.exit).code, 1); assert.ok(!p.records().some(x => x.id === 2));
});
test('exiting during handoff fails queued requests', async () => {
  const p = launch({ env: { INIT: 'exit' } }); p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1); p.send('tools/call', 2); p.setReady({ state: 'ready', copy: 'C:' }); assert.ok((await p.wait(x => x.id === 2)).error); assert.equal((await p.exit).code, 1);
});
test('failed probe does not replace cache and client list is not cached', async () => {
  const p = launch({ ready: true, env: { PAGES: '1', FAIL_PAGE: '1' } }); p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1); p.send('tools/list', 2); await p.wait(x => x.id === 2); await sleep(30); assert.equal(fs.existsSync(p.list), false); p.send('notifications/initialized'); await sleep(70); assert.equal(fs.existsSync(p.list), false); p.child.stdin.end(); await p.exit;
});
test('3a starts without synthetic messages and signals stop the tool', async () => {
  for (const signal of ['SIGTERM', 'SIGHUP']) { const p = launch(); p.setReady({ state: 'ready', copy: 'C:' }); await sleep(50); p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1); assert.equal(p.lines.some(x => x.method === 'notifications/tools/list_changed'), false); p.child.kill(signal); assert.equal((await p.exit).code, 0); }
});
test('large final response is flushed with client stdin open', async () => {
  const p = launch({ ready: true, pause: true }); p.send('large', 1); await sleep(150); p.child.stdout.resume(); assert.equal((await p.wait(x => x.id === 1)).result.length, 1024 * 1024); assert.equal((await p.exit).code, 7);
});
test('stdin close before ready exits without spawning', async () => {
  const p = launch(); p.child.stdin.end(); assert.equal((await p.exit).code, 0); assert.deepEqual(p.records(), []);
});
test('tool signal status is propagated', async () => {
  const p = launch({ ready: true }); p.send('signal', 1); assert.equal((await p.exit).code, 143);
});
test('held calls fail immediately when readiness changes to failed', async () => {
  const p = launch(); p.send('tools/call', 1); p.setReady({ state: 'failed', reason: 'offline' }); assert.match((await p.wait(x => x.id === 1)).error.message, /offline/); p.child.stdin.end(); await p.exit;
});

test('handoff suppresses cancelled requests and duplicate initialized notifications', async () => {
  const p = launch({ env: { DELAY: '70' } });
  p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1);
  p.send('tools/call', 2); p.setReady({ state: 'ready', copy: 'C:' });
  while (!p.records().some(x => x.method === 'initialize')) await sleep(5);
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
test('missing or empty copy is absent from tool environment', async () => {
  for (const copy of [undefined, '']) {
    const p = launch({ env: { WHEELCHAIR_WINDOWS_PROJECT: 'stale' } });
    p.setReady({ state: 'ready', copy }); p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1);
    assert.equal(p.records()[0].env.copy, undefined); p.child.stdin.end(); await p.exit;
  }
});
test('signals close tool stdin and escalate through TERM and KILL', async () => {
  for (const [signal, ignoreTerm] of [['SIGTERM', false], ['SIGHUP', true]]) {
    const p = launch({ ready: true, env: { IGNORE_END: '1', ...(ignoreTerm ? { IGNORE_TERM: '1' } : {}) } });
    p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1);
    p.child.kill(signal); assert.equal((await p.exit).code, 0);
    const rec = p.records(); assert.ok(rec.some(x => x.event === 'stdin-end'));
    if (ignoreTerm) assert.ok(rec.some(x => x.signal === 'SIGTERM'));
  }
});
test('closed client read end during tool output shuts down without crashing', async () => {
  const p = launch({ ready: true }); p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1);
  p.child.stdout.destroy(); p.send('ping', 2); const result = await p.exit;
  assert.equal(result.code, 0); assert.doesNotMatch(result.stderr, /Error:|\n\s+at /);
});
test('closed client read end during large final response does not crash', async () => {
  const p = launch({ ready: true, pause: true }); p.send('large', 1); await sleep(100); p.child.stdout.destroy();
  const result = await p.exit; assert.ok([0, 7].includes(result.code)); assert.doesNotMatch(result.stderr, /Error:|\n\s+at /);
});
test('tool exiting while receiving input does not crash proxy', async () => {
  const p = launch({ ready: true }); p.send('die', 1);
  p.child.stdin.on('error', () => {}); for (let i = 0; i < 100; i++) p.send('ping', i, { data: 'x'.repeat(4096) });
  const result = await p.exit; assert.equal(result.code, 9); assert.doesNotMatch(result.stderr, /Error:|\n\s+at /);
});
test('command-only entry launches', async () => {
  const p = launch({ ready: true, command: '/bin/cat' }); p.send('ping', 1); assert.equal((await p.wait(x => x.id === 1)).method, 'ping'); p.child.stdin.end(); assert.equal((await p.exit).code, 0);
});

test('handoff with empty list forwards held call after readiness', async () => {
  const p = launch(); p.send('initialize', 1, { protocolVersion: 'v' }); await p.wait(x => x.id === 1);
  p.send('tools/list', 2); assert.deepEqual((await p.wait(x => x.id === 2)).result.tools, []);
  p.send('tools/call', 3); p.setReady({ state: 'ready', copy: 'C:' });
  assert.equal((await p.wait(x => x.id === 3)).result.ok, true); await p.wait(x => x.method === 'notifications/tools/list_changed');
  await sleep(30); assert.equal(p.records().filter(x => x.method === 'notifications/initialized').length, 1);
  assert.equal(p.lines.filter(x => x.method === 'notifications/tools/list_changed').length, 1);
  p.child.stdin.end(); await p.exit;
});
