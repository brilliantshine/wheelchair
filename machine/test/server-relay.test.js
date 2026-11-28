'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough, Writable } = require('node:stream');
const { EventEmitter, once } = require('node:events');
const { relay } = require('../lib/server-relay');

function harness(serverInput, destination, observe) {
  const child = new EventEmitter(); child.stdin = serverInput; child.stdout = new PassThrough(); child.stderr = new PassThrough();
  const stdin = new PassThrough(), stderr = new PassThrough(); stderr.resume();
  let killed = 0, finish;
  const exited = new Promise(resolve => { finish = resolve; });
  relay({ child, name: 'test', values: ['secretvalue123'], stdin, stdout: destination, stderr, observe, kill: () => killed++, exit: finish });
  return { child, stdin, exited, killed: () => killed };
}

test('client input backpressure bounds the queued bytes for a 20 MiB request', { timeout: 15000 }, async () => {
  let bytes = 0, max = 0, release;
  const serverInput = new Writable({ highWaterMark: 65536, write(chunk, enc, cb) { bytes += chunk.length; if (!release) release = cb; else cb(); } });
  const write = serverInput.write.bind(serverInput); serverInput.write = (...args) => { const ok = write(...args); max = Math.max(max, serverInput.writableLength); return ok; };
  const output = new PassThrough(); output.resume(); const h = harness(serverInput, output);
  const chunk = Buffer.alloc(65536, 120), writing = (async () => { for (let i = 0; i < 320; i++) { if (!h.stdin.write(chunk)) await once(h.stdin, 'drain'); } h.stdin.end(); })();
  await new Promise(resolve => setTimeout(resolve, 1200)); assert(max <= 65536, `queued ${max}`); release();
  await writing; await once(serverInput, 'finish'); assert.equal(bytes, 20 * 1024 * 1024); assert(max <= 65536, `queued ${max}`);
  h.child.stdout.end(); h.child.stderr.end(); h.child.emit('exit', 0, null); assert.equal(await h.exited, 0);
});

test('paused destination holds at most one checked reply in writable queue', { timeout: 20000 }, async () => {
  let release;
  const output = new Writable({ highWaterMark: 65536, write(chunk, enc, cb) { if (!release) release = cb; else cb(); } });
  const input = new PassThrough(); input.resume(); const h = harness(input, output);
  const line = Buffer.from(JSON.stringify({id:1,result:'x'.repeat(20 * 1024 * 1024)})+'\n');
  const initial = process.memoryUsage().external;
  for (let i = 0; i < 5; i++) h.child.stdout.write(line);
  await new Promise(resolve => setTimeout(resolve, 1200));
  assert(h.child.stdout.isPaused()); assert(output.writableLength <= line.length); assert(process.memoryUsage().external - initial < 100 * 1024 * 1024);
  release(); h.child.stdout.end(); h.child.stderr.end(); h.child.emit('exit', 0, null); h.stdin.end(); assert.equal(await h.exited, 0);
});

test('hard deadline expires while server stdout remains paused', { timeout: 70000 }, async () => {
  const output = new Writable({ highWaterMark: 1, write(chunk, enc, cb) {} });
  const input = new PassThrough(); input.resume(); const h = harness(input, output);
  h.child.stdout.write(Buffer.from('{"id":1,"result":"ok"}\n'));
  assert(h.child.stdout.isPaused()); h.stdin.end(); const start = Date.now();
  let stayedPaused = true; const probe = setInterval(() => { stayedPaused &&= h.child.stdout.isPaused(); }, 1000);
  const code = await h.exited; clearInterval(probe); const elapsed = Date.now() - start;
  assert(stayedPaused); assert.equal(code, 1); assert(h.killed() > 0); assert(elapsed >= 59000 && elapsed < 65000, `elapsed ${elapsed}`);
});


test('oversized stdout never holds more than 32 MiB of a line', { timeout: 15000 }, async () => {
  let max = 0; const input = new PassThrough(); input.resume(); const output = new PassThrough(); output.resume();
  const h = harness(input, output, n => { max = Math.max(max, n); });
  const header = Buffer.from('{"id":7,"result":"'); h.child.stdout.write(header);
  const chunk = Buffer.alloc(65536, 120); for (let i = 0; i < 529; i++) h.child.stdout.write(chunk);
  h.child.stdout.end('"}\n'); h.child.stderr.end(); h.child.emit('exit', 0, null);
  assert.equal(await h.exited, 0); assert.equal(max, 32 * 1024 * 1024);
});

test('post-exit deadline excludes time stdout is paused', { timeout: 10000 }, async () => {
  let release, received = ''; const output = new Writable({ highWaterMark: 1, write(chunk, enc, cb) { received += chunk; if (!release) release = cb; else cb(); } });
  const input = new PassThrough(); input.resume(); const h = harness(input, output);
  h.child.stdout.write('{"id":1,"result":"one"}\n'); h.child.stdout.end('{"id":2,"result":"two"}\n'); h.child.stderr.end(); h.child.emit('exit', 0, null);
  await new Promise(resolve => setTimeout(resolve, 3000)); assert(h.child.stdout.isPaused()); assert.equal(h.killed(), 0);
  release(); assert.equal(await h.exited, 0); assert.deepEqual(received.trim().split('\n').map(s => JSON.parse(s).id), [1,2]);
});
