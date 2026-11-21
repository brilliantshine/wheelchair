'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempSync } = require('../../test-support/run-dir');
const { WinBridge } = require('../lib/win');
const { readState, writeState } = require('../lib/win-sync');

function fixture(wsl = true) {
  const root = makeTempSync('win-bridge-');
  const procRoot = path.join(root, 'proc');
  const etcRoot = path.join(root, 'etc');
  fs.mkdirSync(path.join(procRoot, 'sys/kernel'), { recursive: true });
  fs.mkdirSync(path.join(procRoot, 'sys/fs/binfmt_misc'), { recursive: true });
  fs.mkdirSync(etcRoot);
  fs.writeFileSync(path.join(procRoot, 'sys/kernel/osrelease'), wsl ? 'microsoft' : 'linux');
  if (wsl) fs.writeFileSync(path.join(procRoot, 'sys/fs/binfmt_misc/WSLInterop'), '');
  const session = { name: 'wc-test-lead', thread_id: 'test', role: 'lead', cli: 'claude', worktree: path.join(root, 'work'), status: 'ready' };
  const service = { stateDir: path.join(root, 'state'), sessions: { [session.name]: session }, liveTmux: () => new Set([session.name]), archivingThreads: new Set(), archivedThreads: new Set(), closingThreads: new Set(), log() {} };
  const winEnv = { localAppData: async () => 'C:\\Users\\Test', toLinux: p => path.join(root, 'drive', p.replace(/[:\\]/g, '/')), toWindows: p => `W:${p}`, versions: async () => ({ ok: true }) };
  const bridge = new WinBridge(service, { procRoot, etcRoot, winEnv, apps: {} });
  return { root, session, service, bridge };
}

test('availability, role, session and argument checks are ordered', async () => {
  const off = fixture(false);
  await assert.rejects(off.bridge.handle(off.session, { op: 'info', args: [] }), { status: 422, message: 'the Windows bridge only works when Wheelchair runs in WSL' });
  const { bridge, session } = fixture();
  session.role = 'reviewer';
  await assert.rejects(bridge.handle(session, { op: 'info', args: [] }), { status: 403 });
  session.role = 'mapper';
  await assert.rejects(bridge.handle(session, { op: 'info', args: [] }), { status: 403 });
  session.role = 'lead';
  session.status = 'stopped';
  await assert.rejects(bridge.handle(session, { op: 'bogus', args: [] }), { status: 409 });
  session.status = 'ready';
  await assert.rejects(bridge.handle(session, { op: 'bogus', args: [] }), { status: 400 });
  session.cli = 'codex';
  await assert.rejects(bridge.handle(session, { op: 'run', args: ['--', 'cmd.exe'] }), { status: 403 });
  await assert.rejects(bridge.handle(session, { op: 'start', args: ['--', 'cmd.exe'] }), { status: 403 });
  assert.equal((await bridge.handle(session, { op: 'info', args: [] })).sandboxed, true);
});

test('session environment applies to tool roles without creating state', async () => {
  const { bridge, session, root } = fixture();
  const env = await bridge.sessionEnv(session, { WSLENV: 'OTHER/p' });
  assert.match(env.WHEELCHAIR_WINDOWS_PROJECT, /Wheelchair/);
  assert.equal(env.WSLENV, 'OTHER/p:WHEELCHAIR_WINDOWS_PROJECT');
  assert.equal(fs.existsSync(path.join(root, 'state')), false);
  session.role = 'mapper';
  assert.deepEqual(await bridge.sessionEnv(session), {});
  assert.deepEqual(await fixture(false).bridge.sessionEnv(session), {});
});

const { spawnSync } = require('node:child_process');
const { createWinEnv } = require('../lib/win-env');
function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com' } });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function realFixture(role = 'lead') {
  const f = fixture();
  const mount = path.join(f.root, 'mnt');
  const drive = path.join(mount, 'c');
  const powershell = path.join(drive, 'Windows/System32/WindowsPowerShell/v1.0/powershell.exe');
  const gitExe = path.join(drive, 'tools/git.exe');
  fs.mkdirSync(path.dirname(powershell), { recursive: true });
  fs.mkdirSync(path.dirname(gitExe), { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'fixtures/win/powershell.exe'), powershell);
  fs.copyFileSync(path.join(__dirname, 'fixtures/win/git.exe'), gitExe);
  fs.mkdirSync(f.session.worktree);
  git(f.session.worktree, 'init');
  fs.writeFileSync(path.join(f.session.worktree, 'file'), 'base\n');
  git(f.session.worktree, 'add', '.');
  git(f.session.worktree, 'commit', '-m', 'base');
  f.session.role = role;
  const winEnv = createWinEnv({ mount, env: { ...process.env, WC_FAKE_MOUNT: mount, WC_FAKE_LOCALAPPDATA: 'C:\\Users\\Test', WC_FAKE_GIT_PATH: 'C:\\tools\\git.exe' } });
  const calls = [];
  const apps = {
    async run(session, args) { calls.push(args); return { exit_code: null, timed_out: true, output: '', log: 'log' }; },
    async start(session, args) { calls.push(args); return { id: '1', pid: 1, log: 'log' }; },
    status() { return { apps: [], exited: ['1'] }; },
    async stop() { return { stopped: 1, wasRunning: true, copyKeys: [] }; },
    async windows() { return { windows: [] }; },
    async shot() { return { path: 'shot' }; }
  };
  f.bridge = new WinBridge(f.service, { procRoot: path.join(f.root, 'proc'), etcRoot: path.join(f.root, 'etc'), winEnv, apps });
  return { ...f, apps, calls };
}

test('run timeout syncs, status syncs an exit and launch environment excludes the token', async () => {
  const { bridge, session, calls } = realFixture();
  await bridge.handle(session, { op: 'sync', args: [] });
  const info = await bridge.handle(session, { op: 'info', args: [] });
  fs.writeFileSync(path.join(info.copy_linux, 'win-file'), 'windows');
  const result = await bridge.handle(session, { op: 'run', args: ['--env', 'SAFE=yes', '--', 'test.exe'] });
  assert.equal(result.timed_out, true);
  assert.equal(fs.readFileSync(path.join(session.worktree, 'win-file'), 'utf8'), 'windows');
  assert.deepEqual(calls[0].env, [['SAFE', 'yes']]);
  const originalToken = process.env.WHEELCHAIR_SESSION_TOKEN;
  process.env.WHEELCHAIR_SESSION_TOKEN = 'session-secret';
  try {
    await bridge.handle(session, { op: 'start', args: ['--env', 'SAFE=yes', '--', 'test.exe'] });
    assert.deepEqual(calls[1].env, [['SAFE', 'yes']]);
  } finally {
    if (originalToken === undefined) delete process.env.WHEELCHAIR_SESSION_TOKEN;
    else process.env.WHEELCHAIR_SESSION_TOKEN = originalToken;
  }
  await assert.rejects(bridge.handle(session, { op: 'start', args: ['--env', 'WHEELCHAIR_SESSION_TOKEN=secret', '--', 'test.exe'] }), { status: 400 });
  fs.writeFileSync(path.join(session.worktree, 'file'), 'linux\n');
  fs.writeFileSync(path.join(info.copy_linux, 'file'), 'windows\n');
  const status = await bridge.handle(session, { op: 'status', args: [] });
  assert.equal(status.sync.conflicts.length, 1);
  assert.equal('exited' in status, false);
});

test('readying times out without blocking launch and does not create copies for ordinary sessions', async () => {
  const { bridge, session, root } = realFixture();
  const ctx = await bridge.context(session);
  assert.equal(fs.existsSync(ctx.copy.linux), false);
  await bridge.beforeLaunch(session, { windowsTools: false });
  assert.equal(fs.existsSync(path.join(root, 'state')), false);
  assert.equal(fs.existsSync(ctx.copy.linux), false);
  bridge.readyTimeoutMs = 5;
  let release;
  const original = bridge.create.bind(bridge);
  const gate = new Promise(resolve => { release = resolve; });
  bridge.create = async (...args) => { await gate; return original(...args); };
  await bridge.beforeLaunch(session, { windowsTools: true });
  const info = await bridge.handle(session, { op: 'info', args: [] });
  assert.equal(info.ready, false);
  assert.match(info.reason, /still being readied/);
  const ready = [...bridge.readying.values()][0];
  release();
  await ready;
  assert.equal((await bridge.handle(session, { op: 'info', args: [] })).ready, true);
});

test('worker merge cleanup deletes its copy and stop does not reconcile', async () => {
  const { bridge, session, apps } = realFixture('worker');
  apps.killSession = async () => ({ wasRunning: false, copyKeys: [] });
  await bridge.handle(session, { op: 'sync', args: [] });
  const info = await bridge.handle(session, { op: 'info', args: [] });
  fs.writeFileSync(path.join(info.copy_linux, 'new-file'), 'windows');
  const ctx = await bridge.context(session);
  const state = readState(bridge.stateDir, ctx.key);
  state.used_since_ok = true;
  writeState(bridge.stateDir, ctx.key, state);
  assert.equal(readState(bridge.stateDir, ctx.key).used_since_ok, true);
  let reconciles = 0;
  const originalSync = bridge.sync.bind(bridge);
  bridge.sync = async (...args) => { reconciles++; return originalSync(...args); };
  bridge.onStop(session);
  await bridge.onWorktreeRemoved(session, { kind: 'merge' });
  assert.equal(reconciles, 0);
  assert.equal(fs.existsSync(path.join(session.worktree, 'new-file')), false);
  assert.equal(fs.existsSync(info.copy_linux), false);
});

test('verifier stop returns immediately and deletes after its apps stop', async () => {
  const { bridge, session, apps } = realFixture('verifier');
  let release;
  let calls = 0;
  apps.killSession = () => { calls++; return new Promise(resolve => { release = () => resolve({ wasRunning: false, copyKeys: [] }); }); };
  await bridge.handle(session, { op: 'sync', args: [] });
  const info = await bridge.handle(session, { op: 'info', args: [] });
  session.status = 'stopped';
  assert.equal(bridge.onStop(session), undefined);
  assert.equal(bridge.onStop(session), undefined);
  assert.equal(calls, 1);
  assert.equal(fs.existsSync(info.copy_linux), true);
  release();
  for (let i = 0; i < 100 && fs.existsSync(info.copy_linux); i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(fs.existsSync(info.copy_linux), false);
});

test('failed copies survive ordinary removal and archive, but verifier and merge removal delete them', async () => {
  for (const kind of ['other', 'archive', 'verifier', 'merge']) {
    const { bridge, session } = realFixture();
    await bridge.handle(session, { op: 'sync', args: [] });
    const info = await bridge.handle(session, { op: 'info', args: [] });
    fs.writeFileSync(path.join(session.worktree, 'Case'), 'a');
    fs.writeFileSync(path.join(session.worktree, 'case'), 'b');
    await assert.rejects(bridge.handle(session, { op: 'sync', args: [] }));
    if (kind === 'archive') await bridge.archiveFinish(session.thread_id);
    else await bridge.onWorktreeRemoved(session, { kind });
    assert.equal(fs.existsSync(info.copy_linux), kind === 'other' || kind === 'archive', kind);
  }
});

test('archive waits for successful final sync then deletes the copy', async () => {
  const { bridge, session } = realFixture();
  await bridge.handle(session, { op: 'sync', args: [] });
  const info = await bridge.handle(session, { op: 'info', args: [] });
  fs.writeFileSync(path.join(info.copy_linux, 'final'), 'windows');
  assert.deepEqual(bridge.archiveCheck(session.thread_id).pending, [session.name]);
  assert.deepEqual(bridge.archiveCheck(session.thread_id).pending, [session.name]);
  await Promise.all([...bridge.running.values()]);
  assert.deepEqual(bridge.archiveCheck(session.thread_id).pending, []);
  assert.equal(fs.readFileSync(path.join(session.worktree, 'final'), 'utf8'), 'windows');
  await bridge.archiveFinish(session.thread_id);
  assert.equal(fs.existsSync(info.copy_linux), false);
});

test('archive waits once for a final sync and retains a failed copy', async () => {
  const { bridge, session } = realFixture();
  await bridge.handle(session, { op: 'sync', args: [] });
  const info = await bridge.handle(session, { op: 'info', args: [] });
  fs.writeFileSync(path.join(session.worktree, 'Case'), 'a');
  fs.writeFileSync(path.join(session.worktree, 'case'), 'b');
  assert.deepEqual(bridge.archiveCheck(session.thread_id).pending, [session.name]);
  await Promise.allSettled([...bridge.running.values()]);
  assert.deepEqual(bridge.archiveCheck(session.thread_id).pending, []);
  await bridge.archiveFinish(session.thread_id);
  assert.equal(fs.existsSync(info.copy_linux), true);
});

test('sweep reconciles a dead lead with no apps', async () => {
  const { bridge, session, service, apps } = realFixture();
  apps.sweep = async () => ({ copyKeys: [] });
  await bridge.handle(session, { op: 'sync', args: [] });
  const info = await bridge.handle(session, { op: 'info', args: [] });
  fs.writeFileSync(path.join(info.copy_linux, 'new-file'), 'windows');
  service.liveTmux = () => new Set();
  await bridge.sweep();
  assert.equal(fs.readFileSync(path.join(session.worktree, 'new-file'), 'utf8'), 'windows');
});

test('sweep marks dead app copies and reconciles a shared thread worktree after a worker registered', async () => {
  const { bridge, session, service, apps } = realFixture('sub-lead');
  await bridge.handle(session, { op: 'sync', args: [] });
  const ctx = await bridge.context(session);
  const worker = { ...session, name: 'wc-test-worker', role: 'worker' };
  service.sessions[worker.name] = worker;
  service.liveTmux = () => new Set([session.name, worker.name]);
  await bridge.handle(worker, { op: 'info', args: [] });
  await bridge.sync(ctx);
  const { readState } = require('../lib/win-sync');
  assert.equal(readState(service.stateDir, ctx.key).thread_worktree, true);
  assert.equal(readState(service.stateDir, ctx.key).used_since_ok, false);
  fs.writeFileSync(path.join(ctx.copy.linux, 'dead-app'), 'windows');
  service.liveTmux = () => new Set();
  apps.sweep = async live => { assert.equal(live.size, 0); return { copyKeys: [ctx.key] }; };
  const originalSync = bridge.sync.bind(bridge);
  bridge.sync = async copy => {
    assert.equal(readState(service.stateDir, ctx.key).used_since_ok, true);
    return originalSync(copy);
  };
  await bridge.sweep();
  assert.equal(fs.readFileSync(path.join(session.worktree, 'dead-app'), 'utf8'), 'windows');
});

test('tracker close callback marks the copy used', async () => {
  const f = realFixture();
  const Module = require('node:module');
  const originalLoad = Module._load;
  let onAppClosed;
  try {
    Module._load = function (request, ...args) {
      if (request === './win-apps') return { AppTracker: class { constructor(options) { onAppClosed = options.onAppClosed; } } };
      return originalLoad.call(this, request, ...args);
    };
    const bridge = new WinBridge(f.service, { procRoot: path.join(f.root, 'proc'), etcRoot: path.join(f.root, 'etc'), winEnv: f.bridge.winEnv });
    await f.bridge.handle(f.session, { op: 'sync', args: [] });
    const ctx = await bridge.context(f.session);
    const { readState } = require('../lib/win-sync');
    assert.equal(readState(f.service.stateDir, ctx.key).used_since_ok, false);
    onAppClosed({ copyKey: ctx.key });
    assert.equal(readState(f.service.stateDir, ctx.key).used_since_ok, true);
  } finally { Module._load = originalLoad; }
});

test('sessions sharing a worktree share the copy and Windows tool use triggers stop sync', async () => {
  const { bridge, session, service, apps } = realFixture();
  apps.killSession = async () => ({ wasRunning: false, copyKeys: [] });
  await bridge.beforeLaunch(session, { windowsTools: true });
  const info = await bridge.handle(session, { op: 'info', args: [] });
  const other = { ...session, name: 'wc-other-worker', role: 'worker' };
  service.sessions[other.name] = other;
  service.liveTmux = () => new Set([session.name, other.name]);
  assert.equal((await bridge.handle(other, { op: 'info', args: [] })).copy_linux, info.copy_linux);
  fs.writeFileSync(path.join(info.copy_linux, 'tool-edit'), 'tool');
  service.liveTmux = () => new Set([session.name]);
  bridge.onStop(session);
  for (let i = 0; i < 500 && !fs.existsSync(path.join(session.worktree, 'tool-edit')); i++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(fs.readFileSync(path.join(session.worktree, 'tool-edit'), 'utf8'), 'tool');
});

test('archive deletes copies while retaining conflict refs', async () => {
  const { bridge, session } = realFixture();
  await bridge.handle(session, { op: 'sync', args: [] });
  const info = await bridge.handle(session, { op: 'info', args: [] });
  fs.writeFileSync(path.join(session.worktree, 'file'), 'linux\n');
  fs.writeFileSync(path.join(info.copy_linux, 'file'), 'windows\n');
  const conflict = await bridge.handle(session, { op: 'sync', args: [] });
  const ref = conflict.conflicts[0].ref;
  assert.deepEqual(conflict.unresolved, ['file']);
  const before = git(session.worktree, 'for-each-ref', '--format=%(refname)', 'refs/wheelchair/conflicts').split('\n');
  await bridge.archiveFinish(session.thread_id);
  assert.equal(fs.existsSync(info.copy_linux), false);
  assert.equal(git(session.worktree, 'show', `${ref}:file`), 'windows');
  const after = git(session.worktree, 'for-each-ref', '--format=%(refname)', 'refs/wheelchair/conflicts').split('\n');
  const saved = after.filter(item => !before.includes(item));
  assert.equal(saved.length, 1);
  assert.equal(git(session.worktree, 'show', `${saved[0]}:file`), 'windows');
});

test('cleanup removes a vanished linked worktree copy without a reconcile', async () => {
  const { bridge, session } = realFixture();
  const main = session.worktree;
  const linked = `${main}-linked`;
  git(main, 'worktree', 'add', '-b', 'linked', linked);
  session.worktree = linked;
  await bridge.handle(session, { op: 'sync', args: [] });
  const info = await bridge.handle(session, { op: 'info', args: [] });
  git(main, 'worktree', 'remove', '--force', linked);
  await bridge.onWorktreeRemoved(session, { kind: 'other' });
  assert.equal(fs.existsSync(info.copy_linux), false);
});

test('info reports a PowerShell startup failure and environment names are case insensitive', async () => {
  const { bridge, session } = fixture();
  bridge.winEnv.localAppData = async () => { throw new Error('PowerShell unavailable'); };
  const info = await bridge.handle(session, { op: 'info', args: [] });
  assert.equal(info.ok, false);
  assert.equal(info.ready, false);
  assert.equal(info.reason, 'PowerShell unavailable');
  await assert.rejects(bridge.handle(session, { op: 'run', args: ['--env', 'wheelchair_session_token=secret', '--', 'cmd.exe'] }), { status: 400 });
});
