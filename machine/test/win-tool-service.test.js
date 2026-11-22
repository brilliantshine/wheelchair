'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { makeTempSync } = require('../../test-support/run-dir');
const { MachineService } = require('../service');
const { createWinEnv } = require('../lib/win-env');
const { PROXY } = require('../lib/win-tool-wrap');
function write(p, data, mode) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data, { mode }); }
function fixture() {
  const root = makeTempSync('ready-service-'), bin = path.join(root, 'bin'), mount = path.join(root, 'mnt'), state = path.join(root, 'state'), procRoot = path.join(root, 'proc'), etcRoot = path.join(root, 'etc');
  write(path.join(procRoot, 'sys/kernel/osrelease'), 'microsoft'); write(path.join(procRoot, 'sys/fs/binfmt_misc/WSLInterop'), 'enabled\n'); write(path.join(etcRoot, 'wsl.conf'), `[automount]\nroot = ${mount}\n`);
  for (const [src, dest] of [['powershell.exe', 'c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'], ['git.exe', 'c/tools/git.exe']]) { const p = path.join(mount, dest); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.copyFileSync(path.join(__dirname, 'fixtures/win', src), p); fs.chmodSync(p, 0o755); }
  const exe = path.join(mount, 'c/tools/tool.exe'); write(exe, '', 0o755);
  const log = path.join(root, 'tmux.log');
  write(path.join(bin, 'tmux'), `#!/bin/sh\nif [ "$1" = new-session ]; then cat "$FAKE_READY" > "$FAKE_LOG"; exit "${'${FAKE_FAIL:-0}'}"; fi\nexit 0\n`, 0o755);
  write(path.join(bin, 'systemd-run'), '#!/bin/sh\nexit 1\n', 0o755);
  const prior = { ...process.env }; Object.assign(process.env, { PATH: `${bin}:${prior.PATH}`, FAKE_LOG: log, FAKE_READY: path.join(state, 'win-ready/wc-test-worker'), WC_FAKE_MOUNT: mount, WC_FAKE_LOCALAPPDATA: 'C:\\Users\\Test', WC_FAKE_GIT_PATH: 'C:\\tools\\git.exe' });
  const worktree = path.join(root, 'work'); fs.mkdirSync(worktree);
  const git = (...args) => { const r = spawnSync('git', args, { cwd: worktree, env: { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 't@t' }, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
  git('init'); write(path.join(worktree, 'file'), 'base'); git('add', '.'); git('commit', '-m', 'base'); write(path.join(worktree, '.mcp.json'), JSON.stringify({ mcpServers: { windows: { command: exe, args: ['serve'] } } }));
  const winEnv = createWinEnv({ mount, env: { ...process.env } });
  const machine = new MachineService({ stateDir: state, win: { procRoot, etcRoot, winEnv, readyTimeoutMs: 10, apps: { killSession: async () => ({ wasRunning: false, copyKeys: [] }) } } });
  machine.config = { host: '127.0.0.1', port: 1 }; machine.checkReady = async () => {}; machine.persistSessions = async () => {}; machine.createWorktree = async () => ({ worktree }); machine.liveTmux = () => new Set(); machine.screens.killSession = () => {};
  const name = 'wc-test-worker', ready = path.join(state, 'win-ready', name), config = path.join(state, 'settings', `${name}.mcp.json`);
  let release; const wait = new Promise(r => { release = r; }); const create = machine.win.create.bind(machine.win); machine.win.create = async (...args) => { await wait; return create(...args); };
  return { machine, name, ready, config, log, worktree, release, restore() { for (const key of Object.keys(process.env)) if (!(key in prior)) delete process.env[key]; Object.assign(process.env, prior); } };
}
async function start(f) { return f.machine.start({ name: f.name, role: 'worker', cli: 'claude', thread_id: 'test', token: 'token', worktree: f.worktree }); }
async function until(check, ms = 5000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try { if (check()) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw Error(`condition not met within ${ms} ms`);
}
async function finish(f) { await until(() => f.machine.win.readying.size > 0); assert.ok(f.machine.win.readying.size > 0); f.release(); await Promise.allSettled([...f.machine.win.readying.values(), ...f.machine.win.stopTasks.values()].map(v => v.task || v)); f.restore(); }
test('WSL Claude writes wrapped config and waiting before tmux; stop removes both', async () => {
  const f = fixture(); try {
    const session = await start(f); assert.equal(JSON.parse(fs.readFileSync(f.log)).state, 'waiting');
    assert.equal(fs.statSync(f.config).mode & 0o777, 0o600); const entry = JSON.parse(fs.readFileSync(f.config)).mcpServers.windows;
    assert.equal(entry.command, process.execPath); assert.equal(entry.args[0], PROXY); assert.ok(session.command.includes('--mcp-config')); assert.ok(session.command.includes(f.config));
    await f.machine.stop(f.name); await f.machine.win.readyQueues.get(f.name); assert.equal(fs.existsSync(f.config), false); assert.equal(fs.existsSync(f.ready), false);
  } finally { await finish(f); }
  assert.equal(fs.existsSync(f.ready), false);
});
for (const mode of ['tmux failure', 'cancelled start']) test(`${mode} removes both files and late readying cannot recreate them`, async () => {
  const f = fixture(); try {
    if (mode === 'tmux failure') process.env.FAKE_FAIL = '1';
    else { const before = f.machine.win.beforeLaunch.bind(f.machine.win); f.machine.win.beforeLaunch = async (...args) => { await before(...args); f.machine.cancelledStarts.add(f.name); }; }
    await assert.rejects(start(f)); assert.equal(fs.existsSync(f.config), false); assert.equal(fs.existsSync(f.ready), false);
    await until(() => f.machine.win.readying.size > 0); assert.ok(f.machine.win.readying.size > 0);
  } finally { await finish(f); }
  assert.equal(fs.existsSync(f.ready), false);
});
