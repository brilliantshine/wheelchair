'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { makeTempSync } = require('../../test-support/run-dir');
const { createWinForward } = require('../lib/win-forward');
const fixture = path.join(__dirname, 'fixtures/fake-relay.js');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, ms = 3000) { const end = Date.now() + ms; while (!fn()) { if (Date.now() > end) throw Error('timed out'); await delay(10); } }
function setup(t, options = {}) {
  const dir = makeTempSync('forward-'); const children = []; let config = {}; let isReady = true;
  const f = createWinForward({ stateDir: dir, ready: () => isReady, relayScript: 'fixture', timeouts: { header: 2000, check: 1000 }, spawnRelay: text => {
    if (config.throw) throw Error('spawn failed');
    const c = config.failStart ? spawn('/no-such-relay', []) : spawn(process.execPath, [fixture, text, JSON.stringify(config)]);
    children.push({ child: c, text }); return c;
  }, ...options });
  t.after(() => { for (const { child } of children) child.kill(); });
  return { f, dir, children, set: x => { config = x; }, ready: x => { isReady = x; }, record: () => JSON.parse(fs.readFileSync(path.join(dir, 'win/forwards.json'))) };
}
async function server(t, handler = s => s.pipe(s)) {
  const s = net.createServer(handler); await new Promise(r => s.listen(0, '127.0.0.1', r));
  t.after(() => { s.close(); s.closeAllConnections?.(); }); return s;
}
function connect(port) { return net.connect(port, '127.0.0.1'); }
function collect(s) { return new Promise((resolve, reject) => { const chunks = []; s.on('data', x => chunks.push(x)); s.on('error', reject); s.on('close', () => resolve(Buffer.concat(chunks))); }); }
async function roundtrip(port, text) { const s = connect(port); let data = ''; return new Promise((resolve, reject) => { s.on('error', reject); s.on('data', c => { data += c; if (data.length >= text.length) { s.destroy(); resolve(data); } }); s.write(text); }); }
async function putRecord(dir, forwards) { await fs.promises.mkdir(path.join(dir, 'win'), { recursive: true }); await fs.promises.writeFile(path.join(dir, 'win/forwards.json'), JSON.stringify({ forwards })); }

test('shared forward and serialized concurrent records; retry a failed record', async t => {
  const a = setup(t); const [p, p2] = await Promise.all([a.f.get(101), a.f.get(101)]); assert.equal(p, p2);
  const [x, y] = await Promise.all([a.f.get(102).then(port => { assert(a.record().forwards.some(f => f.private_port === port)); return port; }), a.f.get(103).then(port => { assert(a.record().forwards.some(f => f.private_port === port)); return port; })]);
  assert.notEqual(x, y); assert.equal(a.record().forwards.length, 3); assert.equal(fs.statSync(path.join(a.dir, 'win/forwards.json')).mode & 0o777, 0o600);
  const b = setup(t); fs.writeFileSync(path.join(b.dir, 'win'), 'block'); await assert.rejects(b.f.get(104), { message: "couldn't save the port record" }); fs.unlinkSync(path.join(b.dir, 'win')); const retry = await b.f.get(104); assert.equal(b.record().forwards[0].private_port, retry);
  a.ready(false); await assert.rejects(a.f.get(101), { message: 'Windows bridge not available' });
  await assert.rejects(a.f.get(0), RangeError);
});

test('restart restores while unavailable, pipes, marks occupied port stale and replaces record', async t => {
  const dest = await server(t); const port = dest.address().port; const a = setup(t); const temp = await server(t); const privatePort = temp.address().port; await new Promise(r => temp.close(r));
  await putRecord(a.dir, [{ tool_port: port, private_port: privatePort }]); a.ready(false); await a.f.restore(null); await assert.rejects(a.f.get(port), { message: 'Windows bridge not available' }); assert.equal(await roundtrip(privatePort, 'restored'), 'restored');
  const b = setup(t); await putRecord(b.dir, [{ tool_port: port, private_port: privatePort }]); await b.f.restore(new Set(['wc-live'])); assert.match(b.f.status(port).note, new RegExp(String(privatePort))); const replacement = await b.f.get(port); assert.notEqual(replacement, privatePort); assert.deepEqual(b.record().forwards, [{ tool_port: port, private_port: replacement }]);
});

test('restart without wheelchair tmux empties record; missing record is harmless', async t => {
  const a = setup(t); await a.f.restore(null); await putRecord(a.dir, [{ tool_port: 42, private_port: 12345 }]); await a.f.restore(new Set(['other'])); assert.deepEqual(a.record(), { forwards: [] });
});

test('byte pipe preserves Host redirect and streams response pieces', async t => {
  const chunks = []; const dest = http.createServer((req, res) => { chunks.push(req.headers.host); if (req.url === '/') { res.writeHead(307, { Location: `http://${req.headers.host}/next` }); res.end(); } else { res.write('one'); setTimeout(() => res.end('two'), 80); } });
  await new Promise(r => dest.listen(0, '127.0.0.1', r)); t.after(() => dest.close()); const a = setup(t); const p = await a.f.get(dest.address().port);
  const first = await fetch(`http://127.0.0.1:${p}/`, { redirect: 'manual' }); assert.equal(first.status, 307); assert.equal(first.headers.get('location'), `http://127.0.0.1:${p}/next`);
  const response = await fetch(first.headers.get('location')); const reader = response.body.getReader(); assert.equal(Buffer.from((await reader.read()).value).toString(), 'one'); assert.equal(Buffer.from((await reader.read()).value).toString(), 'two'); assert.deepEqual(chunks, [`127.0.0.1:${p}`, `127.0.0.1:${p}`]);
});

test('pre-OK client bytes arrive in order and header leftovers are delivered', async t => {
  const dest = await server(t); const a = setup(t); a.set({ delay: 100, withBytes: true }); const p = await a.f.get(dest.address().port); const s = connect(p); let text = ''; const result = new Promise((resolve, reject) => { s.on('error', reject); s.on('data', c => { text += c; if (text.length >= 11) { s.destroy(); resolve(text); } }); }); s.write('abc'); s.write('def'); assert.equal(await result, 'firstabcdef');
});

test('refusal closes without bytes, status last clears on next OK', async t => {
  const dest = await server(t); const a = setup(t); a.set({ refuse: 'blocked here' }); const p = await a.f.get(dest.address().port); assert.equal((await collect(connect(p))).length, 0); assert.equal(a.f.status(dest.address().port).last.reason, 'blocked here'); assert(!Number.isNaN(Date.parse(a.f.status(dest.address().port).last.at))); a.set({}); assert.equal(await roundtrip(p, 'ok'), 'ok'); assert.equal(a.f.status(dest.address().port).last, undefined);
});

test('client FIN and reset before OK kill relay without changing last refusal', async t => {
  const a = setup(t); const p = await a.f.get(99); a.set({ refuse: 'old' }); await collect(connect(p));
  for (const reset of [false, true]) { a.set({ never: true }); const s = connect(p); await until(() => a.children.length >= (reset ? 3 : 2)); if (reset) s.resetAndDestroy(); else s.end(); await until(() => a.children.at(-1).child.exitCode !== null || a.children.at(-1).child.signalCode !== null); assert.equal(a.f.status(99).last.reason, 'old'); }
});

test('timeout, no header, long header and failed start settle once', async t => {
  const a = setup(t, { timeouts: { header: 800, check: 700 } }); const p = await a.f.get(99);
  a.set({ never: true }); await collect(connect(p)); await delay(50); assert.equal(a.f.status(99).last.reason, "Windows didn't answer in time");
  for (const knob of [{ noHeader: true }, { longHeader: true }, { failStart: true }, { throw: true }]) { a.set(knob); await collect(connect(p)); assert.match(a.f.status(99).last.reason, /^couldn't start the Windows helper:/); }
});

test('immediate OK and REFUSED headers beat process close', async t => {
  const a = setup(t); const p = await a.f.get(99); a.set({ immediate: 'REFUSED immediate\n' }); await collect(connect(p)); assert.equal(a.f.status(99).last.reason, 'immediate'); a.set({ immediate: 'OK\nlast bytes' }); assert.equal((await collect(connect(p))).toString(), 'last bytes'); assert.equal(a.f.status(99).last, undefined);
});

test('upload relay failure stays local and later connection succeeds', async t => {
  const dest = await server(t); const a = setup(t); const p = await a.f.get(dest.address().port); a.set({ exitUpload: true }); const s = connect(p); s.on('error', () => {}); s.write(Buffer.alloc(4 * 1024 * 1024)); await new Promise(r => s.on('close', r)); a.set({}); assert.equal(await roundtrip(p, 'still alive'), 'still alive');
});

test('last server bytes are delivered before close', async t => {
  const data = Buffer.alloc(500000, 77); const dest = await server(t, s => s.end(data)); const a = setup(t); const p = await a.f.get(dest.address().port); assert.deepEqual(await collect(connect(p)), data);
});

test('check uses check mode, reports headers and timeout without records or forwards', async t => {
  const dest = await server(t); const a = setup(t); const port = dest.address().port; assert.deepEqual(await a.f.check(port), { ok: true }); assert.match(a.children[0].text, /^\$Mode = 'check'\n/); a.set({ refuse: 'nope' }); assert.deepEqual(await a.f.check(port), { ok: false, reason: 'nope' }); a.set({ never: true }); assert.deepEqual(await a.f.check(port), { ok: false, reason: `couldn't check Windows for port ${port}` }); await until(() => a.children.at(-1).child.signalCode !== null); a.set({ failStart: true }); assert.deepEqual(await a.f.check(port), { ok: false, reason: `couldn't check Windows for port ${port}` }); assert.equal(fs.existsSync(path.join(a.dir, 'win/forwards.json')), false); assert.deepEqual(a.f.status(port), {});
});

test('pre-header buffering pauses a large upload and resumes in order', async t => {
  const dest = await server(t); const a = setup(t, { timeouts: { header: 2000, check: 500 } }); a.set({ delay: 150 }); const p = await a.f.get(dest.address().port); const payload = Buffer.alloc(256 * 1024); for (let i = 0; i < payload.length; i++) payload[i] = i % 251; const s = connect(p); const chunks = []; let size = 0; const received = new Promise((resolve, reject) => { s.on('error', reject); s.on('data', c => { chunks.push(c); size += c.length; if (size === payload.length) { s.destroy(); resolve(Buffer.concat(chunks)); } }); }); s.write(payload); assert.deepEqual(await received, payload);
});

test('stalled response applies backpressure while another connection works', async t => {
  const sockets = new Set(); let written = 0; let stalled = false; let count = 0;
  const dest = await server(t, s => {
    sockets.add(s); s.on('close', () => sockets.delete(s));
    if (++count !== 1) { s.pipe(s); return; }
    const block = Buffer.alloc(65536, 65);
    function send() { while (written < 64 * 1024 * 1024) { written += block.length; if (!s.write(block)) { stalled = true; s.once('drain', send); return; } } }
    send();
  });
  t.after(() => { for (const s of sockets) s.destroy(); });
  const a = setup(t, { timeouts: { header: 2000, check: 500 } }); const p = await a.f.get(dest.address().port); const slow = connect(p); slow.pause(); await until(() => stalled); await delay(400); const at = written; await delay(200); assert.equal(written, at, 'writer must stay stalled while the client does not read'); assert(at < 64 * 1024 * 1024); assert.equal(await roundtrip(p, 'other'), 'other'); slow.destroy();
});

test('stand-in relay exits on stdin closure', async t => {
  const dest = await server(t); const text = `$Mode = 'connect'\n$ToolPort = ${dest.address().port}\nfixture`; const c = spawn(process.execPath, [fixture, text, '{}']); t.after(() => c.kill()); await new Promise((resolve, reject) => { c.stdout.once('data', resolve); c.once('error', reject); }); const closed = new Promise(resolve => c.once('close', resolve)); c.stdin.end(); await closed;
});
