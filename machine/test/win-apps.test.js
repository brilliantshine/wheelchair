'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempSync } = require('../../test-support/run-dir');
const { createWinEnv } = require('../lib/win-env');
const { AppTracker } = require('../lib/win-apps');

function setup(onAppClosed = () => {}) {
  const root = makeTempSync('win-apps-');
  const mount = path.join(root, 'mnt');
  const exe = path.join(mount, 'c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe');
  fs.mkdirSync(path.dirname(exe), { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'fixtures/win/powershell.exe'), exe);
  const stateDir = path.join(mount, 'c/state');
  const fakeDir = path.join(root, 'fake');
  const winEnv = createWinEnv({ mount, env: { ...process.env, WC_FAKE_MOUNT: mount, WC_FAKE_APP_DIR: fakeDir, WHEELCHAIR_SESSION_TOKEN: 'secret' } });
  return { tracker: new AppTracker({ winEnv, stateDir, onAppClosed }), stateDir, fakeDir, winEnv };
}
const session = { name: 'wc-one' };
const opts = settings => ({ program: 'fake.exe', argv: [JSON.stringify(settings)], env: [], cwd: 'C:\\copy', copyKey: 'copy', timeout: 2 });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('run reads the done code, caps output, and does not leak the token', async () => {
  const { tracker } = setup();
  const result = await tracker.run(session, opts({ exitCode: 256, outputBytes: 70000, echoEnv: true }));
  assert.equal(result.exit_code, 256);
  assert.equal(Buffer.byteLength(result.output), 65536);
  const log = fs.readFileSync(result.log, 'utf8');
  assert.equal(log.length > 70000, true);
  assert.match(log, /"wrapper":null,"program":null/);
});
test('wrapper exit without done has null code, and closure is reported', async () => {
  const closed = [];
  const { tracker } = setup(a => closed.push(a));
  const result = await tracker.run(session, opts({ noDone: true }));
  assert.equal(result.exit_code, null);
  assert.equal(closed.length, 1);
  assert.equal(closed[0].copyKey, 'copy');
});
test('job remains running until the wrapper closes; timeout terminates it', async () => {
  const { tracker } = setup();
  const app = await tracker.start(session, opts({ duration: 400 }));
  await wait(100);
  assert.equal(tracker.status(session, app.id).apps[0].running, true);
  await wait(450);
  const status = tracker.status(session, app.id);
  assert.equal(status.apps[0].running, false);
  assert.deepEqual(status.exited, [app.id]);
  assert.deepEqual(tracker.status(session, app.id).exited, []);
  const result = await tracker.run(session, { ...opts({ duration: 10000 }), timeout: 0.1 });
  assert.equal(result.timed_out, true);
  assert.equal(result.exit_code, null);
});
test('four started jobs are allowed and stop returns their copy keys', async () => {
  const { tracker } = setup();
  const apps = [];
  for (let i = 0; i < 4; i++) apps.push(await tracker.start(session, opts({ duration: 10000 })));
  await assert.rejects(tracker.start(session, opts({})), e => e.status === 422);
  const stopped = await tracker.stop(session, null);
  assert.equal(stopped.wasRunning, true);
  assert.equal(stopped.stopped.length, 4);
  assert.deepEqual(stopped.copyKeys, ['copy']);
});
