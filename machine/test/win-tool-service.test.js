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
  write(path.join(bin, 'tmux'), `#!/bin/sh\nif [ x$1 = xload-buffer ]; then cat >/dev/null; fi\nif [ "$1" = new-session ]; then cat "$FAKE_READY" > "$FAKE_LOG"; exit "${'${FAKE_FAIL:-0}'}"; fi\nexit 0\n`, 0o755);
  write(path.join(bin, 'systemd-run'), '#!/bin/sh\nif [ x$1 = xload-buffer ]; then cat >/dev/null; fi\nexit 1\n', 0o755);
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

test('folder entries detect symlinked Windows programs and carry proxy options', () => {
  const f = fixture(); try {
    const folder = require('../lib/folder-tools');
    const exe = path.join(process.env.WC_FAKE_MOUNT, 'c/tools/tool.exe');
    const dir = path.join(f.worktree, 'tools'); fs.mkdirSync(dir); fs.symlinkSync(exe, path.join(dir, 'alias'));
    const row = { name: 'example', dir, tool: { kind: 'server', transport: 'stdio', start: ['alias', 'serve'], keys: [] } };
    assert.equal(folder.resolveProgram('alias', dir, dir), exe);
    assert.equal(folder.isWindowsExecutable(row, dir, process.env.WC_FAKE_MOUNT), true);
    assert.equal(folder.shouldWrapWindowsProxy(row, dir, process.env.WC_FAKE_MOUNT), true);
    const wrapped = folder.serverEntry(f.worktree, row, { win: true, winReadyFile: f.ready, winListCache: '/cache' });
    assert.equal(wrapped.windows, true); assert.equal(wrapped.wrapped, true); assert.ok(wrapped.entry.args.includes('--win-list-cache'));
    row.tool.start.push('mcp-for-unity'); assert.equal(folder.shouldWrapWindowsProxy(row, dir, process.env.WC_FAKE_MOUNT), false);
    const unity = folder.serverEntry(f.worktree, row, { win: true, unity: true });
    assert.equal(unity.wrapped, false); assert.equal(unity.unity, true);
    assert.match(require('../lib/win-prompt').promptLines({ wsl: true, loaded: [unity], cli: 'claude' }).join('\n'), /Unity/);
    const script = { ...row, windows: true, tool: { kind: 'script', run: ['alias'], keys: [] } };
    const bridge = folder.bridgeEntry(f.worktree, [script], { winReadyFile: f.ready });
    assert.equal(bridge.windows, true); assert.deepEqual(bridge.entry.args.slice(-3), ['--tool', dir, '--win']);
  } finally { f.restore(); }
});

test('folder servers and scripts receive Windows wiring at service launch', async () => {
  const f = fixture(); try {
    const exe = path.join(process.env.WC_FAKE_MOUNT, 'c/tools/tool.exe');
    for (const [name, details] of Object.entries({ normal: { kind: 'server', start: [exe, 'serve'] }, unity: { kind: 'server', start: [exe, 'mcp-for-unity'] }, script: { kind: 'script', run: [exe], inputs: {} } })) write(path.join(f.worktree, '.wheelchair/tools', name, 'tool.json'), JSON.stringify({ name, description: name, ...details }));
    await start(f);
    const entries = JSON.parse(fs.readFileSync(f.config)).mcpServers;
    assert.ok(entries.normal.args.includes('--win-list-cache')); assert.ok(entries.normal.args.includes('--win-ready-file'));
    assert.ok(entries.unity.args.includes('--win')); assert.ok(!entries.unity.args.includes('--win-ready-file'));
    assert.ok(entries['wheelchair-tools'].args.includes('--win-ready-file')); assert.ok(entries['wheelchair-tools'].args.includes('--win'));
    await f.machine.stop(f.name);
  } finally { await finish(f); }
});

test('Windows HTTP folder tools forward without WSL interop', async () => {
  const f = fixture(); try {
    f.machine.win.detected.wsl = false;
    f.machine.win.forwards.get = async port => { assert.equal(port, 3210); return 4321; };
    write(path.join(f.worktree, '.wheelchair/tools/http/tool.json'), JSON.stringify({ name: 'http', description: 'http', kind: 'server', url: 'http://localhost:3210/mcp', windows: true }));
    await start(f);
    const entry = JSON.parse(fs.readFileSync(f.config)).mcpServers.http;
    assert.equal(entry.url, 'http://127.0.0.1:4321/mcp');
    await f.machine.stop(f.name);
  } finally { f.release(); f.restore(); }
});

test('keyed Windows bridge waits for readiness and forwards environment names', async () => {
  const { spawn } = require('node:child_process');
  const readline = require('node:readline');
  const { writeSharedKeys } = require('../lib/shared-keys');
  const root = makeTempSync('win-bridge-'), dir = path.join(root, 'demo'), state = path.join(root, 'state'), ready = path.join(root, 'ready');
  write(path.join(dir, 'tool.json'), JSON.stringify({ name: 'demo', description: 'demo', kind: 'script', run: [process.execPath, 'run.js'], inputs: {}, keys: ['TOKEN'], timeout_seconds: 5 }));
  write(path.join(dir, 'run.js'), "console.log(JSON.stringify({ project: process.env.WHEELCHAIR_WINDOWS_PROJECT, wslenv: process.env.WSLENV, hasKey: !!process.env.TOKEN }))");
  await writeSharedKeys(state, { set: { TOKEN: 'secretvalue' } });
  const child = spawn(process.execPath, [path.join(__dirname, '../lib/tool-bridge.js'), '--project-dir', root, '--state-dir', state, '--win-ready-file', ready, '--tool', dir, '--win', '--key-store', 'shared', '--key', 'TOKEN'], { env: { ...process.env, WSLENV: 'OTHER/u' } });
  const lines = readline.createInterface({ input: child.stdout });
  try {
    const response = new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('bridge response timed out')), 5000); lines.once('line', line => { clearTimeout(timer); resolve(JSON.parse(line)); }); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'demo', arguments: {} } }) + '\n');
    await new Promise(resolve => setTimeout(resolve, 150));
    write(ready, JSON.stringify({ state: 'ready', copy: 'C:\\project' }));
    const result = await response; assert.equal(result.result.isError, false);
    assert.deepEqual(JSON.parse(result.result.content[0].text), { project: 'C:\\project', wslenv: 'OTHER/u:WHEELCHAIR_WINDOWS_PROJECT:TOKEN', hasKey: true });
  } finally { child.stdin.end(); lines.close(); }
});

test('keyed folder entries forward Windows variables and omit the tool-list cache', async () => {
  const f = fixture(); try {
    const { writeSharedKeys } = require('../lib/shared-keys');
    await writeSharedKeys(f.machine.stateDir, { set: { TOKEN: 'secretvalue' } });
    f.machine.sessions = f.machine.sessions || {};
    const exe = path.join(process.env.WC_FAKE_MOUNT, 'c/tools/tool.exe');
    const dir = path.join(f.worktree, '.wheelchair/tools/keyed');
    write(path.join(dir, 'tool.json'), JSON.stringify({ name: 'keyed', description: 'keyed', kind: 'server', start: [exe], keys: ['TOKEN'] }));
    const folder = require('../lib/folder-tools');
    const row = { name: 'keyed', dir, key_store: 'shared', tool: { kind: 'server', transport: 'stdio', start: [exe], keys: ['TOKEN'] } };
    const extra = folder.serverEntry(f.worktree, row, { stateDir: f.machine.stateDir, win: true, winReadyFile: f.ready });
    assert.ok(!extra.entry.args.includes('--win-list-cache'));
    const codex = require('../../connectors/codex/machine');
    const built = codex.command({ role: 'worker' }, { name: f.name, codex_mode: 'unrestricted' }, f.worktree, { tools: true, extraServers: [extra], wsl: true });
    assert.ok(built.argv.some(arg => arg.includes('env_vars=["WHEELCHAIR_WINDOWS_PROJECT","WSLENV"]')));
    assert.deepEqual(built.loaded.find(e => e.name === 'keyed'), { name: 'keyed', windows: true, wrapped: true, unity: false });
  } finally { f.restore(); }
});

test('keyed unwrapped Windows launcher forwards declared names through WSLENV', async () => {
  const { spawn } = require('node:child_process');
  const { writeSharedKeys } = require('../lib/shared-keys');
  const root = makeTempSync('win-launch-'), dir = path.join(root, 'unity'), state = path.join(root, 'state');
  write(path.join(dir, 'tool.json'), JSON.stringify({ name: 'unity', description: 'unity', kind: 'server', start: [process.execPath, 'run.js', 'mcp-for-unity'], keys: ['TOKEN'] }));
  write(path.join(dir, 'run.js'), "console.log(JSON.stringify({wslenv:process.env.WSLENV,hasKey:!!process.env.TOKEN})); setInterval(()=>{},1000)");
  await writeSharedKeys(state, { set: { TOKEN: 'secretvalue' } });
  const child = spawn(process.execPath, [path.join(__dirname, '../lib/tool-launch.js'), '--project-dir', root, '--tool', dir, '--win', '--state-dir', state, '--key-store', 'shared', '--key', 'TOKEN'], { env: { ...process.env, WSLENV: 'OTHER/u:TOKEN/u' } });
  const readline = require('node:readline').createInterface({ input: child.stdout });
  try {
    const result = await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('launcher response timed out')), 5000); readline.once('line', line => { clearTimeout(timer); resolve(JSON.parse(line)); }); });
    assert.deepEqual(result, { wslenv: 'OTHER/u:TOKEN/u', hasKey: true });
  } finally { child.stdin.end(); readline.close(); }
});

test('keyed HTTP folder entry carries the forwarded URL', () => {
  const { serverEntry } = require('../lib/folder-tools');
  const entry = serverEntry('/project', { name: 'http', dir: '/tool', key_store: 'shared', tool: { transport: 'http', keys: ['TOKEN'], url: 'http://localhost:3210/mcp' } }, { stateDir: '/state', urlOverride: 'http://127.0.0.1:4321/mcp' });
  assert.equal(entry.windows, false); assert.equal(entry.wrapped, false);
  assert.deepEqual(entry.entry.args.slice(-2), ['--url-override', 'http://127.0.0.1:4321/mcp']);
});
