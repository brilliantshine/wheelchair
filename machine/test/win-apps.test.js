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

test('windows and shots are restricted to the session and reject minimized windows', async () => {
  const { tracker } = setup();
  const one = await tracker.start(session, opts({ duration: 10000, windows: [{ handle: '101', title: 'one', minimized: false }, { handle: '102', title: 'min', minimized: true }] }));
  await tracker.start({ name: 'wc-two' }, opts({ duration: 10000, windows: [{ handle: '201', title: 'two', minimized: false }] }));
  assert.deepEqual((await tracker.windows(session)).windows.map(w => w.handle), ['101', '102']);
  assert.equal((await tracker.windows(session)).windows[0].app_id, one.id);
  await assert.rejects(tracker.shot(session, '201'), e => e.status === 400);
  await assert.rejects(tracker.shot(session, '999'), e => e.status === 400);
  await assert.rejects(tracker.shot(session, '102'), e => e.status === 422 && e.message === 'window is minimized');
  const shot = await tracker.shot(session, '101');
  assert.equal(fs.readFileSync(shot.path, 'utf8'), 'fake png');
  await tracker.killSession(session.name);
  await tracker.killSession('wc-two');
});
test('shots retain only the newest 50', async () => {
  const { tracker, stateDir } = setup();
  await tracker.start(session, opts({ duration: 10000, windows: [{ handle: '101', title: 'one', minimized: false }] }));
  const dir = path.join(stateDir, 'win', session.name, 'shots');
  fs.mkdirSync(dir, { recursive: true });
  for (let n = 1; n <= 50; n++) fs.writeFileSync(path.join(dir, `${n}.png`), 'old');
  const shot = await tracker.shot(session, '101');
  const files = fs.readdirSync(dir);
  assert.equal(files.length, 50);
  assert.equal(files.includes('1.png'), false);
  assert.equal(files.includes(path.basename(shot.path)), true);
  await tracker.killSession(session.name);
});

test('startup kills a matching wrapper first and never kills reused PIDs', async () => {
  const { tracker, stateDir, fakeDir, winEnv } = setup();
  const started = await tracker.start(session, opts({ duration: 10000 }));
  const data = JSON.parse(fs.readFileSync(path.join(stateDir, 'win/apps.json'), 'utf8'));
  const app = data[0];
  fs.writeFileSync(path.join(fakeDir, 'processes.json'), JSON.stringify({ [app.wrapper_pid]: '133000000000000002', [app.pid]: '133000000000000099' }));
  const recovered = new AppTracker({ winEnv, stateDir });
  await recovered.startup();
  const calls = fs.readFileSync(path.join(fakeDir, 'cleanup.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(calls, [{ pid: app.wrapper_pid, matched: true }, { pid: app.pid, matched: false }]);
  assert.equal(recovered.status(session, started.id).apps[0].running, false);
  assert.equal(recovered.status(session, started.id).apps[0].exit_code, null);
});
test('sweep terminates dead sessions and returns their copy keys', async () => {
  const { tracker } = setup();
  const dead = await tracker.start(session, { ...opts({ duration: 10000 }), copyKey: 'dead-copy' });
  const live = await tracker.start({ name: 'wc-live' }, { ...opts({ duration: 10000 }), copyKey: 'live-copy' });
  assert.deepEqual(await tracker.sweep(new Set(['wc-live'])), { copyKeys: ['dead-copy'] });
  await wait(100);
  assert.equal(tracker.status(session, dead.id).apps[0].running, false);
  assert.equal(tracker.status({ name: 'wc-live' }, live.id).apps[0].running, true);
  await tracker.killSession('wc-live');
});
