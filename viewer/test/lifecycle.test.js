'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const test = require('node:test');

const { ROOT, makeDir, startServer, request, freePort } = require('./helpers/server');

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['viewer/server.js', ...args], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code, stdout, stderr }));
  });
}

const HOOK = path.join(ROOT, 'viewer/test/hooks/lifecycle.js');
function launch(args, mode, extraEnv = {}) {
  const child = spawn(process.execPath, [...(mode ? ['--require', HOOK] : []), 'viewer/server.js', ...args], {
    cwd: ROOT, env: { ...process.env, GRAPH_TEST_HOOK: mode, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server was not ready: ${stderr}`)), 5000);
    child.stdout.on('data', () => { const line = stdout.split(/\r?\n/).find((line) => /^https?:\/\//.test(line)); if (line) { clearTimeout(timer); resolve(line); } });
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`server exited ${code}: ${stderr}`)); });
  });
  return { child, ready, output: () => ({ stdout, stderr }) };
}
function launchFile(file, args, cwd = ROOT) {
  const child = spawn(process.execPath, [file, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = ''; child.stdout.on('data', (chunk) => { stdout += chunk; }); child.stderr.on('data', (chunk) => { stderr += chunk; });
  const ready = new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error(stderr)), 5000); child.stdout.on('data', () => { const line = stdout.split(/\r?\n/).find((line) => /^https?:\/\//.test(line)); if (line) { clearTimeout(timer); resolve(line); } }); child.once('exit', () => { clearTimeout(timer); reject(new Error(stderr)); }); });
  return { child, ready };
}
function exit(child) { return new Promise((resolve) => (child.exitCode === null && child.signalCode === null) ? child.once('exit', resolve) : resolve(child.exitCode)); }
async function stop(child) { if (child.exitCode === null) child.kill('SIGTERM'); await Promise.race([exit(child), new Promise((resolve) => setTimeout(resolve, 1500))]); if (child.exitCode === null) child.kill('SIGKILL'); await exit(child); }
async function fakeServer(port, response) {
  const server = net.createServer((socket) => {
    socket.once('data', () => socket.end(`HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: ${Buffer.byteLength(JSON.stringify(response))}\r\n\r\n${JSON.stringify(response)}`));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return server;
}

async function prePrefixHolder(root, port, token, startId, { proof = true, pid = true } = {}) {
  const fixture = path.join(root, `pre-prefix-${proof ? 'proof' : 'no-proof'}-${pid ? 'pid' : 'no-pid'}.js`);
  const requests = path.join(root, `pre-prefix-${proof ? 'proof' : 'no-proof'}-${pid ? 'pid' : 'no-pid'}.jsonl`);
  await fs.writeFile(fixture, `'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),http=require('node:http');
const [port,file,token,startId,proof,pid]=process.argv.slice(2);
http.createServer((request,response)=>{
  fs.appendFileSync(file,JSON.stringify({url:request.url,headers:request.headers})+'\\n');
  if(request.url.startsWith('/wheelchair/whoami')) { response.writeHead(401,{'content-type':'application/json'}); response.end(JSON.stringify({error:'bad-token'})); return; }
  if(request.url.startsWith('/whoami')) { const nonce=new URL(request.url,'http://localhost').searchParams.get('nonce'); const body={start_id:startId,code:'preprefix000'}; if(pid==='yes') body.pid=process.pid; if(proof==='yes') body.proof=crypto.createHmac('sha256',token).update(nonce).digest('hex'); response.end(JSON.stringify(body)); return; }
  response.writeHead(404,{'content-type':'application/json'}); response.end(JSON.stringify({error:'no-route'}));
}).listen(Number(port),'127.0.0.1',()=>console.log('ready'));
`);
  const child = spawn(process.execPath, [fixture, String(port), requests, token, startId, proof ? 'yes' : 'no', pid ? 'yes' : 'no'], { stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('pre-prefix holder did not start')), 2000);
    child.stdout.once('data', () => { clearTimeout(timer); resolve(); }); child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`pre-prefix holder exited ${code}`)); });
  });
  await fs.writeFile(path.join(root, '.token'), `${token}\n`);
  await fs.writeFile(path.join(root, '.server'), JSON.stringify({ pid: child.pid, port, token, start_id: startId }));
  return { child, requests };
}

test('the token lasts across a restart, rotates only explicitly, and whoami proves a nonce', async () => {
  const root = await makeDir(); const port = await freePort();
  const first = await startServer({ cacheRoot: root, port });
  try {
    const token = await fs.readFile(path.join(root, '.token'), 'utf8');
    const nonce = crypto.randomBytes(16).toString('hex');
    const who = await request(first, `/whoami?nonce=${nonce}`, { graphPath: undefined, token: undefined });
    assert.equal(who.status, 200);
    assert.equal(who.body.pid, first.child.pid);
    assert.match(who.body.code, /^[0-9a-f]{12}$/);
    assert.equal(who.body.proof, crypto.createHmac('sha256', token.trim()).update(nonce).digest('hex'));
    await first.stop();
    const second = await startServer({ cacheRoot: root, port });
    try { assert.equal((await fs.readFile(path.join(root, '.token'), 'utf8')), token); } finally { await second.stop(); }
    const rotated = await run(['--cache-root', root, '--port', String(port), '--rotate-token']);
    assert.equal(rotated.code, 0); assert.match(rotated.stdout, /\/?\?token=[0-9a-f]{64}/);
    assert.notEqual(await fs.readFile(path.join(root, '.token'), 'utf8'), token);
  } finally { await first.stop(); }
});

test('a stale .server never blocks listen and a live server repairs a deleted record before whoami', async () => {
  const root = await makeDir(); const port = await freePort();
  await fs.writeFile(path.join(root, '.server'), JSON.stringify({ pid: 1, port, token: '0'.repeat(64), start_id: '0'.repeat(32) }));
  const ctx = await startServer({ cacheRoot: root, port });
  try {
    await fs.unlink(path.join(root, '.server'));
    const who = await request(ctx, '/whoami', { graphPath: undefined, token: undefined });
    assert.equal(who.status, 200);
    const record = JSON.parse(await fs.readFile(path.join(root, '.server'), 'utf8'));
    assert.equal(record.start_id, who.body.start_id);
    assert.equal(record.pid, who.body.pid);
  } finally { await ctx.stop(); }
});

test('stop treats a refused connection as no viewer even when stale information remains', async () => {
  const root = await makeDir(); const port = await freePort();
  await fs.writeFile(path.join(root, '.server'), JSON.stringify({ pid: 1, port, token: '0'.repeat(64), start_id: '0'.repeat(32) }));
  const started = Date.now();
  const result = await run(['--cache-root', root, '--port', String(port), '--stop']);
  assert.equal(result.code, 0); assert.match(result.stdout, /No viewer running\./);
  assert.ok(Date.now() - started < 1000, 'a closed port does not wait through silent-holder grace');
});

test('serving origin is accepted for PUT and drives the bookmark URL', async () => {
  const root = await makeDir(); const port = await freePort(); const origin = 'https://viewer.example.ts.net';
  await fs.writeFile(path.join(root, '.serving'), JSON.stringify({ serve: true, origin }));
  const ctx = await startServer({ cacheRoot: root, port });
  try {
    const printed = await run(['--cache-root', root, '--port', String(port), '--url']);
    assert.equal(printed.code, 0); assert.match(printed.stdout, new RegExp(`^${origin.replace(/[.]/g, '\\.')}/wheelchair/\\?token=`));
    const acceptedOrigin = await request(ctx, '/view', { method: 'PUT', body: { hash: 'x', graph: {} }, origin });
    assert.notEqual(acceptedOrigin.status, 403, 'the served origin clears origin auth before route handling');
    const rejected = await request(ctx, '/view', { method: 'PUT', body: { hash: 'x', graph: {} }, origin: 'https://other.example' });
    assert.equal(rejected.status, 403);
  } finally { await ctx.stop(); }
});

test('two simultaneous first starts end with one .token', async () => {
  const root = await makeDir(); const port = await freePort(); const graph = path.join(root, 'graphs', 'one.json');
  const starts = [launch(['--cache-root', root, '--port', String(port), '--open', graph]), launch(['--cache-root', root, '--port', String(port), '--open', graph])];
  try {
    await Promise.all(starts.map(({ ready }) => ready.catch(() => null)));
    const token = (await fs.readFile(path.join(root, '.token'), 'utf8')).trim();
    assert.match(token, /^[0-9a-f]{64}$/);
    assert.equal((await fs.readdir(root)).filter((name) => name === '.token').length, 1);
  } finally { await Promise.all(starts.map(({ child }) => stop(child))); }
});

test('simultaneous delayed listeners elect one server and print one token', async () => {
  const root = await makeDir(); const port = await freePort(); const graph = path.join(root, 'graphs', 'race.json');
  const starts = Array.from({ length: 4 }, () => launch(['--cache-root', root, '--port', String(port), '--open', graph], 'delay-listen-callback'));
  try {
    await Promise.all(starts.map(({ ready }) => ready.catch(() => null)));
    await new Promise((resolve) => setTimeout(resolve, 300));
    const token = (await fs.readFile(path.join(root, '.token'), 'utf8')).trim();
    const printed = starts.flatMap(({ output }) => output().stdout.match(/http:\/\/127\.0\.0\.1:\d+\/wheelchair\/\?path=[^\s]+/g) || []);
    assert.ok(printed.length >= 1);
    assert.equal(starts.filter(({ child }) => child.exitCode === null).length, 1);
  } finally { await Promise.all(starts.map(({ child }) => stop(child))); }
});

test('SIGKILL leaves stale .server and the next start listens immediately', async () => {
  const root = await makeDir(); const port = await freePort(); const first = await startServer({ cacheRoot: root, port });
  first.child.kill('SIGKILL'); await exit(first.child);
  const began = Date.now(); const replacement = await startServer({ cacheRoot: root, port });
  try { assert.ok(Date.now() - began < 1000); } finally { await replacement.stop(); }
});

test('a plain foreign listener makes --open refuse without signalling it', async () => {
  const root = await makeDir(); const port = await freePort(); let connections = 0;
  const foreign = net.createServer((socket) => { connections += 1; socket.destroy(); });
  await new Promise((resolve) => foreign.listen(port, '127.0.0.1', resolve));
  try {
    const result = await run(['--cache-root', root, '--port', String(port), '--open', path.join(root, 'graphs', 'x.json')]);
    assert.equal(result.code, 1); assert.ok(connections > 0); assert.equal(foreign.listening, true);
  } finally { await new Promise((resolve) => foreign.close(resolve)); }
});

test('a copied start id with a made-up pid and no proof is foreign', async () => {
  const root = await makeDir(); const port = await freePort(); const startId = 'a'.repeat(32);
  await fs.writeFile(path.join(root, '.server'), JSON.stringify({ pid: 999999, port, token: 'b'.repeat(64), start_id: startId }));
  const foreign = await fakeServer(port, { start_id: startId, pid: 12345, code: 'deadbeef0000' });
  try {
    const result = await run(['--cache-root', root, '--port', String(port), '--open', path.join(root, 'graphs', 'x.json')]);
    assert.equal(result.code, 1); assert.equal(foreign.listening, true);
  } finally { await new Promise((resolve) => foreign.close(resolve)); }
});

test('/whoami supplies pid and code, and proof only for a nonce', async () => {
  const ctx = await startServer({ port: await freePort() });
  try {
    const plain = await request(ctx, '/whoami', { graphPath: undefined, token: undefined }); const nonce = 'c'.repeat(32);
    const signed = await request(ctx, `/whoami?nonce=${nonce}`, { graphPath: undefined, token: undefined });
    assert.equal(plain.body.pid, ctx.child.pid); assert.match(plain.body.code, /^[0-9a-f]{12}$/); assert.equal(plain.body.proof, undefined);
    assert.equal(signed.body.proof, crypto.createHmac('sha256', ctx.token).update(nonce).digest('hex'));
  } finally { await ctx.stop(); }
});

test('stopping refuses a mismatched .server pid', async () => {
  const ctx = await startServer({ port: await freePort() });
  try {
    const recordPath = path.join(ctx.root, '.server'); const record = JSON.parse(await fs.readFile(recordPath)); record.pid += 1; await fs.writeFile(recordPath, JSON.stringify(record));
    const result = await run(['--cache-root', ctx.root, '--port', String(ctx.port), '--stop']); assert.equal(result.code, 1); assert.equal(ctx.child.exitCode, null);
  } finally { await ctx.stop(); }
});

test('--stop exits 1 against a foreign listener', async () => {
  const root = await makeDir(); const port = await freePort(); const foreign = net.createServer((socket) => socket.destroy());
  await new Promise((resolve) => foreign.listen(port, '127.0.0.1', resolve));
  try { assert.equal((await run(['--cache-root', root, '--port', String(port), '--stop'])).code, 1); } finally { await new Promise((resolve) => foreign.close(resolve)); }
});

test('--stop waits five seconds then fails when the server ignores SIGTERM', async () => {
  const root = await makeDir(); const port = await freePort(); const started = launch(['--cache-root', root, '--port', String(port)], 'ignore-sigterm'); await started.ready;
  await new Promise((resolve) => setTimeout(resolve, 300));
  try { const began = Date.now(); const result = await run(['--cache-root', root, '--port', String(port), '--stop']); assert.equal(result.code, 1); assert.ok(Date.now() - began >= 4900); } finally { await stop(started.child); }
});

test('--stop --if-stale keeps current code and stops a changed server copy', async () => {
  const root = await makeDir(); const port = await freePort(); const current = await startServer({ cacheRoot: root, port });
  try {
    const unchanged = await run(['--cache-root', root, '--port', String(port), '--stop', '--if-stale']);
    assert.equal(unchanged.code, 0); assert.match(unchanged.stdout, /Viewer is current\./); assert.equal(current.child.exitCode, null);
    await current.stop();
    const copy = path.join(root, 'old-server.js'); await fs.copyFile(path.join(ROOT, 'viewer/server.js'), copy); await fs.appendFile(copy, '\n// old byte\n');
    const old = launchFile(copy, ['--cache-root', root, '--port', String(port)], root); await old.ready;
    const stale = await run(['--cache-root', root, '--port', String(port), '--stop', '--if-stale']);
    assert.equal(stale.code, 0); await exit(old.child);
  } finally { await current.stop(); }
});

test('an older server is stopped only by --stop and every other command gives the upgrade message', async () => {
  const root = await makeDir(); const port = await freePort(); const startId = 'c'.repeat(32);
  const fixture = path.join(root, 'old.js'); const record = path.join(root, 'requests.jsonl'); const serverToken = 'd'.repeat(64); const diskToken = 'e'.repeat(64);
  const plan = path.join(root, 'repo', 'docs', 'plans', 'old'); await fs.mkdir(plan, { recursive: true });
  await fs.writeFile(fixture, `const fs=require('node:fs'),http=require('node:http');const [p,file]=process.argv.slice(2);http.createServer((q,s)=>{fs.appendFileSync(file,JSON.stringify({method:q.method,url:q.url,headers:q.headers})+'\\n');s.statusCode=q.url==='/register'?404:200;s.end(JSON.stringify({start_id:'${startId}'}))}).listen(Number(p),'127.0.0.1');`);
  const old = spawn(process.execPath, [fixture, String(port), record]); await new Promise((resolve) => setTimeout(resolve, 100));
  await fs.writeFile(path.join(root, '.token'), `${diskToken}\n`); await fs.writeFile(path.join(root, '.server'), JSON.stringify({ pid: old.pid, port, token: serverToken, start_id: startId }));
  try {
    for (const command of [['--open', path.join(root, 'graphs', 'x.json')], ['--show', path.join(root, 'graphs', 'x.json')], ['--service']]) {
      const result = await run(['--cache-root', root, '--port', String(port), ...command]);
      assert.equal(result.code, 1); assert.match(result.stderr, /a viewer from an older version is running; run \.\/install\.sh/);
    }
    const registered = await run(['--cache-root', root, '--port', String(port), '--register-plan', plan]); assert.equal(registered.code, 0); assert.match(registered.stderr, /older version/);
    const stopped = await run(['--cache-root', root, '--port', String(port), '--stop', '--if-stale']); assert.equal(stopped.code, 0); await exit(old);
    const requests = (await fs.readFile(record, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
    assert.ok(requests.length > 0);
    for (const item of requests) {
      const values = [item.url, ...Object.values(item.headers)];
      assert.equal(values.some((value) => String(value).includes(diskToken) || String(value).includes(serverToken)), false);
      assert.equal(Object.hasOwn(item.headers, 'x-graph-token'), false);
    }
  } finally { await stop(old); }
});

test('a proof-valid pre-prefix holder is stopped only by stop and every other command reports the upgrade', async () => {
  const root = await makeDir(); const port = await freePort(); const token = 'a'.repeat(64); const startId = 'b'.repeat(32);
  const plan = path.join(root, 'repo', 'docs', 'plans', 'pre-prefix'); await fs.mkdir(plan, { recursive: true });
  const holder = await prePrefixHolder(root, port, token, startId);
  try {
    for (const command of [['--open', path.join(root, 'graphs', 'pre-prefix.json')], ['--show', path.join(root, 'graphs', 'pre-prefix.json'), '--no-browser'], ['--service']]) {
      const result = await run(['--cache-root', root, '--port', String(port), ...command]);
      assert.equal(result.code, 1); assert.match(result.stderr, /a viewer from an older version is running; run \.\/install\.sh/);
    }
    const registered = await run(['--cache-root', root, '--port', String(port), '--register-plan', plan]);
    assert.equal(registered.code, 0); assert.match(registered.stderr, /a viewer from an older version is running; run \.\/install\.sh/);
    const beforeRotate = await fs.readFile(path.join(root, '.token'), 'utf8'); const rotated = await run(['--cache-root', root, '--port', String(port), '--rotate-token']);
    assert.equal(rotated.code, 1); assert.match(rotated.stderr, /a viewer from an older version is running; run \.\/install\.sh/); assert.equal(holder.child.exitCode, null); assert.equal(await fs.readFile(path.join(root, '.token'), 'utf8'), beforeRotate);
    const url = await run(['--cache-root', root, '--port', String(port), '--url']);
    assert.equal(url.code, 0); assert.equal(url.stdout, `http://127.0.0.1:${port}/wheelchair/?token=${token}\n`); assert.match(url.stderr, /a viewer from an older version is running; run \.\/install\.sh/);
    const requests = (await fs.readFile(holder.requests, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
    for (const request of requests) {
      assert.equal(request.url.includes(token), false); assert.equal(Object.hasOwn(request.headers, 'x-graph-token'), false);
    }
    const stopped = await run(['--cache-root', root, '--port', String(port), '--stop', '--if-stale']);
    assert.equal(stopped.code, 0, stopped.stderr); await exit(holder.child);
    // A process ended by SIGTERM reports no exit code, only the signal.
    assert.ok(holder.child.exitCode !== null || holder.child.signalCode !== null, 'the pre-prefix holder exited');
  } finally { await stop(holder.child); }
});

test('a no-proof pre-prefix holder stops only with its matching server start id and open refuses it', async () => {
  const root = await makeDir(); const port = await freePort(); const token = 'c'.repeat(64); const startId = 'd'.repeat(32);
  const holder = await prePrefixHolder(root, port, token, startId, { proof: false });
  try {
    const open = await run(['--cache-root', root, '--port', String(port), '--open', path.join(root, 'graphs', 'no-proof.json')]);
    assert.equal(open.code, 1); assert.match(open.stderr, /a viewer from an older version is running; run \.\/install\.sh/);
    await fs.writeFile(path.join(root, '.server'), JSON.stringify({ pid: holder.child.pid, port, token, start_id: 'e'.repeat(32) }));
    const mismatch = await run(['--cache-root', root, '--port', String(port), '--stop']); assert.equal(mismatch.code, 1); assert.equal(holder.child.exitCode, null);
    await fs.writeFile(path.join(root, '.server'), JSON.stringify({ pid: holder.child.pid, port, token, start_id: startId }));
    const stopped = await run(['--cache-root', root, '--port', String(port), '--stop']); assert.equal(stopped.code, 0, stopped.stderr); await exit(holder.child);
  } finally { await stop(holder.child); }
});

test('a proof-valid pre-prefix holder without a pid is not ours and open does not signal it', async () => {
  const root = await makeDir(); const port = await freePort(); const token = 'f'.repeat(64); const startId = '0'.repeat(32);
  const holder = await prePrefixHolder(root, port, token, startId, { pid: false });
  try {
    const result = await run(['--cache-root', root, '--port', String(port), '--open', path.join(root, 'graphs', 'missing-pid.json')]);
    assert.equal(result.code, 1); assert.match(result.stderr, /Refused to use a port held by a process it cannot identify\./);
    assert.equal(holder.child.exitCode, null); assert.equal(holder.child.signalCode, null);
  } finally { await stop(holder.child); }
});

test('--service takes over an open server without changing port or token', async () => {
  const root = await makeDir(); const port = await freePort(); const opened = await startServer({ cacheRoot: root, port }); const token = opened.token;
  const service = launch(['--cache-root', root, '--port', String(port), '--service']);
  try {
    await service.ready; assert.equal((await fs.readFile(path.join(root, '.token'), 'utf8')).trim(), token);
    const record = JSON.parse(await fs.readFile(path.join(root, '.server'))); assert.equal(record.port, port); assert.equal(record.pid, service.child.pid);
  } finally { await stop(service.child); await opened.stop(); }
});

test('--service gives up after three takeovers', { timeout: 30000 }, async () => {
  const root = await makeDir(); const port = await freePort(); const marker = path.join(root, 'service-pause'); const holders = [await startServer({ cacheRoot: root, port })];
  const service = launch(['--cache-root', root, '--port', String(port), '--service'], 'delay-relisten-after-stop', { GRAPH_TEST_MARKER: marker });
  service.ready.catch(() => {});
  try {
    for (let takeover = 0; takeover < 3; takeover += 1) {
      const deadline = Date.now() + 6000;
      while (!require('node:fs').existsSync(marker) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
      assert.equal(require('node:fs').existsSync(marker), true, `takeover ${takeover + 1} paused`);
      holders.push(await startServer({ cacheRoot: root, port }));
      await fs.unlink(marker);
    }
    const result = await exit(service.child); assert.equal(result, 1); assert.match(service.output().stderr, /gave up after three takeovers/);
    assert.equal(holders[3].child.exitCode, null);
  } finally { await fs.unlink(marker).catch(() => {}); await stop(service.child); await Promise.all(holders.map((holder) => holder.stop())); }
});

test('a post-bind .server rename failure rolls back listener and record', async () => {
  const root = await makeDir(); const port = await freePort(); const child = launch(['--cache-root', root, '--port', String(port)], 'fail-server-rename');
  child.ready.catch(() => {});
  const code = await exit(child.child);
  assert.equal(code, 1); await assert.rejects(() => new Promise((resolve, reject) => { const socket = net.connect(port, '127.0.0.1'); socket.once('connect', resolve); socket.once('error', reject); }));
  await assert.rejects(fs.access(path.join(root, '.server')));
});

test('--open waits a closing server out and succeeds', async () => {
  const root = await makeDir(); const port = await freePort(); const old = await startServer({ cacheRoot: root, port });
  old.child.kill('SIGTERM');
  const next = launch(['--cache-root', root, '--port', String(port), '--open', path.join(root, 'graphs', 'next.json')]);
  try { await next.ready; assert.equal(next.child.exitCode, null); } finally { await stop(next.child); await old.stop(); }
});

test('only localhost and served origins write, and serve false prints localhost', async () => {
  const root = await makeDir(); const port = await freePort(); await fs.writeFile(path.join(root, '.serving'), JSON.stringify({ serve: false })); const ctx = await startServer({ cacheRoot: root, port });
  try {
    const bad = await request(ctx, '/view', { method: 'PUT', body: { hash: 'x', graph: {} }, origin: 'https://bad.example' }); assert.equal(bad.status, 403); assert.equal(bad.body.error, 'bad-origin');
    const url = await run(['--cache-root', root, '--port', String(port), '--url']); assert.match(url.stdout, new RegExp(`^http://127\\.0\\.0\\.1:${port}/wheelchair/\\?token=`));
  } finally { await ctx.stop(); }
});

test('--url never listens and reports the running token after a timed-out rotation', async () => {
  const root = await makeDir(); const port = await freePort(); const ignored = launch(['--cache-root', root, '--port', String(port)], 'ignore-sigterm'); await ignored.ready;
  await new Promise((resolve) => setTimeout(resolve, 300));
  try {
    const record = JSON.parse(await fs.readFile(path.join(root, '.server'))); const rotate = await run(['--cache-root', root, '--port', String(port), '--rotate-token']); assert.equal(rotate.code, 1);
    const url = await run(['--cache-root', root, '--port', String(port), '--url']); assert.match(url.stdout, new RegExp(record.token)); assert.match(url.stderr, /Warning: token rotation is waiting/);
    const open = await run(['--cache-root', root, '--port', String(port), '--open', path.join(root, 'graphs', 'after-rotation.json')]); assert.equal(open.code, 0, open.stderr);
    const closed = await freePort(); const noStart = await run(['--cache-root', await makeDir(), '--port', String(closed), '--url']); assert.equal(noStart.code, 0);
  } finally { await stop(ignored.child); }
});

test('--rotate-token refuses an old-version holder and leaves it running', async () => {
  const root = await makeDir(); const port = await freePort(); const id = 'e'.repeat(32); const old = await fakeServer(port, { start_id: id });
  await fs.writeFile(path.join(root, '.server'), JSON.stringify({ pid: process.pid, port, token: 'f'.repeat(64), start_id: id }));
  try {
    const result = await run(['--cache-root', root, '--port', String(port), '--rotate-token']);
    assert.equal(result.code, 1); assert.match(result.stderr, /a viewer from an older version is running; run \.\/install\.sh/); assert.equal(old.listening, true);
  } finally { await new Promise((resolve) => old.close(resolve)); }
});

test('--register-plan retries a silent holder until it registers through it', async () => {
  const root = await makeDir(); const port = await freePort(); const token = '1'.repeat(64); const id = '2'.repeat(32); const plan = path.join(root, 'repo', 'docs', 'plans', 'retry'); await fs.mkdir(plan, { recursive: true });
  await fs.writeFile(path.join(root, '.token'), `${token}\n`); await fs.writeFile(path.join(root, '.server'), JSON.stringify({ pid: process.pid, port, token, start_id: id }));
  const started = Date.now(); let registered = false;
  const holder = await new Promise((resolve, reject) => {
    const server = require('node:http').createServer((request, response) => {
      if (request.url.startsWith('/wheelchair/whoami')) {
        const nonce = new URL(request.url, 'http://localhost').searchParams.get('nonce');
        if (Date.now() - started < 650) return;
        response.end(JSON.stringify({ start_id: id, pid: process.pid, code: 'abcdef123456', proof: crypto.createHmac('sha256', token).update(nonce).digest('hex') })); return;
      }
      if (request.url === '/wheelchair/register') { registered = true; response.end(JSON.stringify({ ok: true })); return; }
      response.statusCode = 404; response.end();
    });
    server.once('error', reject); server.listen(port, '127.0.0.1', () => resolve(server));
  });
  try { const result = await run(['--cache-root', root, '--port', String(port), '--register-plan', plan]); assert.equal(result.code, 0); assert.equal(registered, true); } finally { await new Promise((resolve) => holder.close(resolve)); }
});

test('--rotate-token waits for shutdown and leaves .server removal to the server', async () => {
  const root = await makeDir(); const port = await freePort(); const ctx = await startServer({ cacheRoot: root, port });
  const record = await fs.readFile(path.join(root, '.server'));
  const result = await run(['--cache-root', root, '--port', String(port), '--rotate-token']);
  assert.equal(result.code, 0); assert.notEqual(await fs.readFile(path.join(root, '.token'), 'utf8'), `${ctx.token}\n`);
  await assert.rejects(fs.access(path.join(root, '.server'))); assert.notEqual(record.length, 0);
});

test('--rotate-token prints the new prefixed bookmark for a current server', async () => {
  const root = await makeDir(); const port = await freePort(); const ctx = await startServer({ cacheRoot: root, port });
  try {
    const rotated = await run(['--cache-root', root, '--port', String(port), '--rotate-token']); const token = (await fs.readFile(path.join(root, '.token'), 'utf8')).trim();
    assert.equal(rotated.code, 0, rotated.stderr); assert.match(rotated.stdout, new RegExp(`http://127\\.0\\.0\\.1:${port}/wheelchair/\\?token=${token}\\n$`));
  } finally { await ctx.stop(); }
});

test('shutdown releases the port before it removes only its own .server record', async () => {
  const root = await makeDir(); const port = await freePort(); const ctx = await startServer({ cacheRoot: root, port });
  const replacement = { pid: 1, port, token: '3'.repeat(64), start_id: '4'.repeat(32) };
  await fs.writeFile(path.join(root, '.server'), JSON.stringify(replacement)); ctx.child.kill('SIGTERM'); await exit(ctx.child);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, '.server'))), replacement);
  const probe = await new Promise((resolve, reject) => { const server = net.createServer(); server.once('error', reject); server.listen(port, '127.0.0.1', () => resolve(server)); });
  await new Promise((resolve) => probe.close(resolve));
});

test('--stop leaves .server removal to the exiting server', async () => {
  const root = await makeDir(); const port = await freePort(); const ctx = await startServer({ cacheRoot: root, port });
  const result = await run(['--cache-root', root, '--port', String(port), '--stop']); assert.equal(result.code, 0);
  await assert.rejects(fs.access(path.join(root, '.server'))); assert.equal(ctx.child.exitCode === null, false);
});

test('a starter that loses the freed port registers through the new holder', async () => {
  const root = await makeDir(); const port = await freePort(); const graph = path.join(root, 'graphs', 'loser.json'); const marker = path.join(root, 'delayed-retries'); const release = path.join(root, 'release-old');
  await fs.writeFile(release, 'hold');
  const old = launch(['--cache-root', root, '--port', String(port)], 'hang-on-sigterm', { GRAPH_TEST_RELEASE: release }); let winner; let loser;
  try {
    await old.ready;
    // Wait until the hook has really replaced A's SIGTERM handling; a fixed delay was flaky under load.
    const armedBy = Date.now() + 5000;
    while (Date.now() < armedBy && !(await fs.stat(`${release}.armed`).catch(() => null))) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.ok(await fs.stat(`${release}.armed`).catch(() => null), 'the hang-on-sigterm hook armed');
    old.child.kill('SIGTERM');
    loser = launch(['--cache-root', root, '--port', String(port), '--open', graph], 'delay-listen-retry', { GRAPH_TEST_MARKER: marker });
    const deadline = Date.now() + 5000;
    let observed = '';
    while (Date.now() < deadline) {
      observed = await fs.readFile(marker, 'utf8').catch(() => '');
      if (observed.includes('first')) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.match(observed, /first/, 'C attempted its first listen while A held the port');
    await new Promise((resolve) => setTimeout(resolve, 300));
    await fs.unlink(release);
    await exit(old.child);
    winner = await startServer({ cacheRoot: root, port });
    const code = await exit(loser.child); const output = loser.output();
    assert.equal(code, 0, output.stderr);
    assert.doesNotMatch(`${output.stdout}\n${output.stderr}`, /refused/i);
    assert.match(await fs.readFile(marker, 'utf8'), /delayed/, 'C retried after the silent holder');
    assert.equal(JSON.parse(await fs.readFile(path.join(root, '.server'))).pid, winner.child.pid);
    assert.equal(JSON.parse(await fs.readFile(path.join(root, '.registered')))[graph].opened, true);
  } finally { await fs.unlink(release).catch(() => {}); await stop(loser?.child); await winner?.stop(); await stop(old.child); }
});
