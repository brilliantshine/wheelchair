'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempSync } = require('../../test-support/run-dir');
const { WinBridge } = require('../lib/win');
function fixture(kernel, interop, probe) {
  const root = makeTempSync('win-health-'), procRoot = path.join(root, 'proc');
  fs.mkdirSync(path.join(procRoot, 'sys/kernel'), { recursive: true });
  fs.mkdirSync(path.join(procRoot, 'sys/fs/binfmt_misc'), { recursive: true });
  fs.writeFileSync(path.join(procRoot, 'sys/kernel/osrelease'), kernel ? 'microsoft' : 'linux');
  if (interop) fs.writeFileSync(path.join(procRoot, 'sys/fs/binfmt_misc/WSLInterop'), 'enabled\n');
  const service = { stateDir: root, log() {} };
  const bridge = new WinBridge(service, { procRoot, etcRoot: root, winEnv: { probe }, apps: { async startup() {} }, healthDeadlineMs: 25 });
  bridge.sweep = async () => {};
  return bridge;
}
test('health detects kernel and interop and never waits', async () => {
  let calls = 0;
  const probe = () => { calls++; return new Promise(() => {}); };
  const off = fixture(false, true, probe); await off.startup(); assert.deepEqual(off.bridgeHealth(), { ok: true });
  const disabled = fixture(true, false, probe); await disabled.startup();
  assert.deepEqual(disabled.bridgeHealth(), { ok: false, reason: "Windows interop is off in WSL, so Windows programs can't run" });
  const on = fixture(true, true, probe); await on.startup();
  assert.deepEqual(on.bridgeHealth(), { ok: null });
  assert.deepEqual(await on.bridgeHealthWait(1), { ok: null });
  assert.deepEqual(await on.bridgeHealthWait(100), { ok: false, reason: "Windows didn't answer within 15 seconds" });
  assert.equal(calls, 1);
  clearInterval(disabled.healthTimer); clearInterval(on.healthTimer);
});
