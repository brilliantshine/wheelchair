'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { makeTempSync } = require('../../test-support/run-dir');
const { WinBridge } = require('../lib/win');
const { createWinEnv } = require('../lib/win-env');

function fixture() {
  const root = makeTempSync('ready-'), stateDir = path.join(root, 'state'), procRoot = path.join(root, 'proc'), etcRoot = path.join(root, 'etc'), mount = path.join(root, 'mnt');
  const write = (p, data) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); };
  write(path.join(procRoot, 'sys/kernel/osrelease'), 'microsoft'); write(path.join(procRoot, 'sys/fs/binfmt_misc/WSLInterop'), 'enabled\n');
  for (const [src, dest] of [['powershell.exe', 'c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'], ['git.exe', 'c/tools/git.exe']]) { const p = path.join(mount, dest); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.copyFileSync(path.join(__dirname, 'fixtures/win', src), p); fs.chmodSync(p, 0o755); }
  const worktree = path.join(root, 'work'); fs.mkdirSync(worktree);
  const git = (...args) => { const r = spawnSync('git', args, { cwd: worktree, env: { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 't@t' }, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
  git('init'); write(path.join(worktree, 'file'), 'base'); git('add', '.'); git('commit', '-m', 'base');
  const session = { name: 'wc-test-worker', role: 'worker', thread_id: 'test', worktree, status: 'ready' };
  const service = { stateDir, sessions: { [session.name]: session }, liveTmux: () => new Set(), archivingThreads: new Set(), closingThreads: new Set(), log() {} };
  const winEnv = createWinEnv({ mount, env: { ...process.env, WC_FAKE_MOUNT: mount, WC_FAKE_LOCALAPPDATA: 'C:\\Users\\Test', WC_FAKE_GIT_PATH: 'C:\\tools\\git.exe' } });
  const bridge = new WinBridge(service, { procRoot, etcRoot, winEnv, readyTimeoutMs: 10, apps: { killSession: async () => ({ wasRunning: false, copyKeys: [] }) } });
  const file = path.join(stateDir, 'win-ready', session.name);
  const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));
  return { root, session, bridge, file, read };
}
function gate() { let release; const wait = new Promise(r => { release = r; }); return { wait, release }; }

test('existing copy remains waiting until a post-start reconcile completes', async () => {
  const f = fixture(), ctx = await f.bridge.context(f.session);
  await f.bridge.create(ctx, f.session); await f.bridge.sync(ctx);
  const g = gate(), original = f.bridge.create.bind(f.bridge); f.bridge.create = async (...args) => { await g.wait; return original(...args); };
  await f.bridge.beforeLaunch(f.session, { windowsTools: true, wrappedTools: true });
  assert.equal(f.read().state, 'waiting'); assert.equal(fs.statSync(f.file).mode & 0o777, 0o600); assert.equal(fs.statSync(path.dirname(f.file)).mode & 0o777, 0o700);
  const task = f.bridge.readying.get(ctx.key); g.release(); await task;
  assert.equal(f.read().state, 'ready'); assert.equal(f.read().copy, ctx.copy.windows);
});

test('failed readying becomes ready after a later successful sync', async () => {
  const f = fixture(), original = f.bridge.create.bind(f.bridge); f.bridge.create = async () => { throw Error('copy failed'); };
  await f.bridge.beforeLaunch(f.session, { windowsTools: true, wrappedTools: true });
  await Promise.all([...f.bridge.readying.values()]);
  assert.equal(f.read().state, 'failed'); assert.equal(f.read().reason, 'copy failed');
  const ctx = await f.bridge.context(f.session); await original(ctx, f.session); await f.bridge.sync(ctx);
  assert.equal(f.read().state, 'ready'); assert.equal('reason' in f.read(), false);
});

test('context errors before a readying task write failed', async () => {
  const f = fixture(); f.bridge.context = async () => { throw Error('context failed'); };
  await f.bridge.beforeLaunch(f.session, { windowsTools: true, wrappedTools: true });
  assert.equal(f.read().state, 'failed'); assert.equal(f.read().reason, 'context failed');
});

test('stop removes ready file and a late readying result cannot recreate it', async () => {
  const f = fixture(), g = gate(), original = f.bridge.create.bind(f.bridge); f.bridge.create = async (...args) => { await g.wait; return original(...args); };
  await f.bridge.beforeLaunch(f.session, { windowsTools: true, wrappedTools: true });
  const task = [...f.bridge.readying.values()][0]; assert.equal(f.bridge.onStop(f.session), undefined); await f.bridge.readyQueues.get(f.session.name);
  assert.equal(fs.existsSync(f.file), false); g.release(); await task; await f.bridge.stopTasks.get(f.session.name)?.task;
  assert.equal(fs.existsSync(f.file), false);
});

test('stop serializes behind an in-progress temporary ready write and removes it', async () => {
  const f = fixture(); await f.bridge.beforeLaunch(f.session, { windowsTools: true, wrappedTools: true });
  await Promise.all([...f.bridge.readying.values()]);
  const token = f.bridge.readyTokens.get(f.session.name).token, g = gate(), entered = gate(), original = fsp.writeFile;
  fsp.writeFile = async (file, ...args) => { const r = await original(file, ...args); if (String(file).includes('/win-ready/.')) { entered.release(); await g.wait; } return r; };
  try {
    const writing = f.bridge.writeReady(f.session.name, token, 'ready', { copy: 'C:\\copy' }); await entered.wait;
    f.bridge.onStop(f.session); g.release(); await writing; await f.bridge.readyQueues.get(f.session.name);
    assert.deepEqual(fs.readdirSync(path.dirname(f.file)), []);
  } finally { fsp.writeFile = original; }
});
