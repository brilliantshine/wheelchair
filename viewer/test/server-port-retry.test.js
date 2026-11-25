'use strict';

const assert = require('node:assert/strict');
const net = require('node:net');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');
const { freePort, makeDir, startServer } = require('./helpers/server');

async function heldPort() {
  const listener = net.createServer((socket) => socket.destroy());
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  return listener;
}

test('retries a port held by an unidentified process', async () => {
  const listener = await heldPort();
  const held = listener.address().port;
  const next = await freePort();
  let calls = 0;
  try {
    const ctx = await startServer({ nextPort: async () => { calls++; return calls === 1 ? held : next; } });
    try { assert.equal(ctx.port, next); assert.equal(calls, 2); } finally { await ctx.stop(); }
  } finally { await new Promise((resolve) => listener.close(resolve)); }
});

test('does not retry an explicit held port', async () => {
  const listener = await heldPort();
  let calls = 0;
  const dir = await makeDir();
  const marker = path.join(dir, 'starts');
  const hook = path.join(dir, 'hook.js');
  await fs.writeFile(hook, `require('node:fs').appendFileSync(${JSON.stringify(marker)}, 'start\\n');`);
  try {
    await assert.rejects(startServer({ port: listener.address().port, env: { NODE_OPTIONS: `--require=${hook}` }, nextPort: async () => { calls++; return freePort(); } }), /Refused to use a port held by a process it cannot identify|EADDRINUSE/);
    assert.equal(calls, 0);
    assert.equal((await fs.readFile(marker, 'utf8')).trim().split('\n').length, 1);
  } finally { await new Promise((resolve) => listener.close(resolve)); }
});

test('does not retry other startup failures', async () => {
  let calls = 0;
  await assert.rejects(startServer({ cwd: await makeDir(), nextPort: async () => { calls++; return freePort(); } }), /server exited before ready/);
  assert.equal(calls, 1);
});

test('stops after five clashes', async () => {
  const listener = await heldPort();
  let calls = 0;
  try {
    await assert.rejects(startServer({ nextPort: async () => { calls++; return listener.address().port; } }), /Refused to use a port held by a process it cannot identify|EADDRINUSE/);
    assert.equal(calls, 5);
  } finally { await new Promise((resolve) => listener.close(resolve)); }
});
