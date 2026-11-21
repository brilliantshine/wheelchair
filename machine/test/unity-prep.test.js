'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createUnityPrep } = require('../lib/unity-prep');
const tick = () => new Promise(resolve => setImmediate(resolve));
test('Unity prep detects platforms and caches Windows lookup while fetching', async () => {
  let calls = 0, finish, time = 0;
  const env = { ps: async (_s, opts) => { calls++; assert.equal(opts.timeoutMs, 10000); return { code: 0, stdout: 'C:\\uvx.exe\n' }; }, toLinux: () => '/mnt/c/uvx.exe' };
  const prep = createUnityPrep({ detected: { kernel: true, interop: true }, winEnv: env, now: () => time, run: () => new Promise(resolve => { finish = resolve; }) });
  assert.deepEqual(await prep({ poll: true }), { command: '/mnt/c/uvx.exe' });
  assert.equal((await prep({})).fetch.state, 'running');
  await tick(); finish(); await tick();
  assert.equal((await prep({ poll: true })).fetch.state, 'ready');
  assert.equal(calls, 1); time = 600001; await prep({ poll: true }); assert.equal(calls, 2);
  assert.deepEqual(await createUnityPrep({ detected: { kernel: false }, winEnv: env })({}), { command: 'uvx' });
  assert.match((await createUnityPrep({ detected: { kernel: true, interop: false }, winEnv: env })({})).message, /interop is off/);
  assert.equal(calls, 2);
});
test('Unity prep reports lookup and fetch failures', async () => {
  const detected = { kernel: true, interop: true };
  assert.match((await createUnityPrep({ detected, winEnv: { ps: async () => { throw Error('missing'); } } })({})).message, /Install uv on Windows/);
  const prep = createUnityPrep({ detected, winEnv: { ps: async () => ({ code: 0, stdout: 'x' }), toLinux: () => '/x.exe' }, run: async () => { throw Error('network'); } });
  assert.equal((await prep({})).fetch.state, 'running'); await tick();
  assert.deepEqual((await prep({ poll: true })).fetch, { state: 'failed', reason: 'network' });
});
