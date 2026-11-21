'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempSync } = require('../../test-support/run-dir');
const { WinBridge } = require('../lib/win');

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
  fs.writeFileSync(path.join(session.worktree, 'file'), 'linux\n');
  fs.writeFileSync(path.join(info.copy_linux, 'file'), 'windows\n');
  const status = await bridge.handle(session, { op: 'status', args: [] });
  assert.equal(status.sync.conflicts.length, 1);
  assert.equal('exited' in status, false);
});
