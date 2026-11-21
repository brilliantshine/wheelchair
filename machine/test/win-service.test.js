'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawnSync } = require('node:child_process');
const { makeTempSync } = require('../../test-support/run-dir');
const { MachineService } = require('../service');
const { createWinEnv } = require('../lib/win-env');

function write(file, data, mode) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data, { mode }); }
function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com' } });
  assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
}
async function port() { const s = http.createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r)); const p = s.address().port; await new Promise(r => s.close(r)); return p; }
async function service(wsl = true, options = {}) {
  const root = makeTempSync('win-service-'), bin = path.join(root, 'bin'), mount = path.join(root, 'mnt'), state = path.join(mount, 'c/state');
  const procRoot = path.join(root, 'proc'), etcRoot = path.join(root, 'etc'), runRoot = path.join(root, 'run');
  write(path.join(procRoot, 'sys/kernel/osrelease'), wsl ? 'microsoft' : 'linux');
  if (wsl) write(path.join(procRoot, 'sys/fs/binfmt_misc/WSLInterop'), '');
  write(path.join(etcRoot, 'wsl.conf'), `[automount]\nroot = ${mount}\n`);
  write(path.join(runRoot, 'WSL/1_interop'), '');
  const powershell = path.join(mount, 'c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe');
  const exe = path.join(mount, 'c/tools/git.exe');
  for (const [src, dest] of [['powershell.exe', powershell], ['git.exe', exe]]) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(path.join(__dirname, 'fixtures/win', src), dest); fs.chmodSync(dest, 0o755); }
  const log = path.join(root, 'tmux.log');
  write(path.join(bin, 'tmux'), `#!/bin/sh\nprintf '%s\\n' "$*" >> "$FAKE_LOG"\ncase "$1" in\n capture-pane) printf 'auto mode on\\n❯ Try anything\\n';;\n list-sessions) printf '%s\\n' $FAKE_SESSIONS;;\nesac\n`, 0o755);
  write(path.join(bin, 'systemd-run'), '#!/bin/sh\nexit 1\n', 0o755);
  const prior = { ...process.env };
  Object.assign(process.env, { PATH: `${bin}:${prior.PATH}`, FAKE_LOG: log, FAKE_SESSIONS: '', WC_FAKE_MOUNT: mount, WC_FAKE_LOCALAPPDATA: 'C:\\Users\\Test', WC_FAKE_GIT_PATH: 'C:\\tools\\git.exe', WC_FAKE_APP_DIR: path.join(root, 'apps'), WHEELCHAIR_SESSION_TOKEN: 'secret-not-for-windows' });
  const secret = path.join(root, 'secret'); write(secret, 'correct-secret\n');
  const listen = await port();
  const winEnv = createWinEnv({ mount, runRoot, env: { ...process.env } });
  const instance = new MachineService({ stateDir: state, host: '127.0.0.1', port: listen, secretFile: secret, win: { procRoot, etcRoot, runRoot, winEnv, ...options } });
  await instance.listen();
  return { root, state, mount, exe, log, instance, base: `http://127.0.0.1:${listen}`, async close() { await Promise.allSettled([...instance.win.stopTasks.values()].map(v => v.task)); await Promise.allSettled([...instance.win.readying.values(), ...instance.win.running.values()]); await new Promise(r => instance.server.close(r)); for (const key of Object.keys(process.env)) if (!(key in prior)) delete process.env[key]; Object.assign(process.env, prior); } };
}
async function api(e, route, body, token = 'correct-secret', hub = false) {
  const r = await fetch(e.base + route, { method: 'POST', headers: { 'content-type': 'application/json', [hub ? 'x-wheelchair-machine-secret' : 'x-wheelchair-session-token']: token }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
}
function repo(root, name = 'repo') { const dir = path.join(root, name); fs.mkdirSync(dir); git(dir, 'init'); write(path.join(dir, 'file'), 'base\n'); git(dir, 'add', '.'); git(dir, 'commit', '-m', 'base'); return dir; }
async function start(e, role, worktree, extra = {}) {
  const token = `${role}-token`; const thread_id = extra.thread_id || 'test';
  const r = await api(e, '/v1/sessions', { role, cli: 'claude', thread_id, token, worktree, ...extra }, 'correct-secret', true);
  assert.equal(r.status, 201, JSON.stringify(r.body)); process.env.FAKE_SESSIONS += ` ${r.body.name}`; return r.body;
}
async function win(e, token, op, args = []) { return api(e, '/v1/agent/win', { op, args }, token); }

test('route authentication, role restrictions and non-WSL tool filtering', async () => {
  for (const wsl of [true, false]) {
    const e = await service(wsl); try {
      const dir = repo(e.root); write(path.join(dir, '.mcp.json'), JSON.stringify({ mcpServers: { windows: { command: '/mnt/c/tool.exe' }, linux: { command: 'node' } } }));
      const lead = await start(e, 'lead', dir); const reviewer = await start(e, 'reviewer', dir);
      assert.equal((await win(e, 'wrong', 'info')).status, 401);
      assert.equal((await win(e, 'lead-token', 'info')).status, wsl ? 200 : 422);
      if (wsl) assert.equal((await win(e, 'reviewer-token', 'info')).status, 403);
      const log = fs.readFileSync(e.log, 'utf8'); const leadLine = log.split('\n').find(line => line.includes('new-session') && line.includes(lead.name));
      const reviewerLine = log.split('\n').find(line => line.includes('new-session') && line.includes(reviewer.name));
      assert.equal(leadLine.includes('WHEELCHAIR_WINDOWS_PROJECT='), wsl); assert.equal(leadLine.includes('WSLENV='), wsl);
      assert.doesNotMatch(reviewerLine, /WHEELCHAIR_WINDOWS_PROJECT=|WSLENV=/);
      if (!wsl) { const settings = JSON.parse(fs.readFileSync(path.join(e.state, 'settings', `${lead.name}.json`))); assert.deepEqual(settings.disabledMcpjsonServers, ['windows']); assert.equal(settings.enableAllProjectMcpServers, true); }
    } finally { await e.close(); }
  }
});

test('Windows tools ready before launch, timeout remains bounded, and program environment excludes token', async () => {
  const e = await service(); try {
    const dir = repo(e.root); write(path.join(dir, '.mcp.json'), JSON.stringify({ mcpServers: { windows: { command: e.exe } } }));
    await start(e, 'lead', dir); const info = await win(e, 'lead-token', 'info'); assert.equal(info.body.ready, true); assert.ok(fs.existsSync(path.join(info.body.copy_linux, '.git')));
    const run = await win(e, 'lead-token', 'run', ['--', 'fake.exe', JSON.stringify({ echoEnv: true })]); assert.equal(run.status, 200, JSON.stringify(run.body)); assert.match(run.body.output, /"wrapper":null,"program":null/);
    const dir2 = repo(e.root, 'second'); write(path.join(dir2, '.mcp.json'), JSON.stringify({ mcpServers: { windows: { command: e.exe } } }));
    e.instance.win.readyTimeoutMs = 10;
    let release; const gate = new Promise(r => { release = r; }); const original = e.instance.win.create.bind(e.instance.win); e.instance.win.create = async (...args) => { await gate; return original(...args); };
    await start(e, 'worker', dir2); assert.equal((await win(e, 'worker-token', 'info')).body.ready, false); release(); await Promise.all([...e.instance.win.readying.values()]);
  } finally { await e.close(); }
});

test('stop and merge remove copies and archive waits for final reconciliation', async () => {
  const e = await service(); try {
    const main = repo(e.root); git(main, 'config', 'user.name', 'Test'); git(main, 'config', 'user.email', 'test@example.com');
    const verifierDir = path.join(e.root, 'verifier'); git(main, 'worktree', 'add', '-b', 'verify', verifierDir);
    const verifier = await start(e, 'verifier', verifierDir); e.instance.sessions[verifier.name].created_worktree = true;
    const vi = await win(e, 'verifier-token', 'sync'); assert.equal(vi.status, 200, JSON.stringify(vi.body)); const vc = (await win(e, 'verifier-token', 'info')).body.copy_linux;
    let release; const gate = new Promise(r => { release = r; }); const kill = e.instance.win.apps.killSession.bind(e.instance.win.apps); e.instance.win.apps.killSession = async n => { if (n === verifier.name) await gate; return kill(n); };
    await e.instance.stop(verifier.name); assert.ok(fs.existsSync(vc)); release(); await e.instance.win.stopTasks.get(verifier.name).task; assert.equal(fs.existsSync(vc), false);
    const workerDir = path.join(e.root, 'worker'); git(main, 'worktree', 'add', '-b', 'worker', workerDir);
    const sub = await start(e, 'sub-lead', main); const worker = await start(e, 'worker', workerDir); e.instance.sessions[worker.name].created_worktree = true;
    assert.equal((await win(e, 'worker-token', 'sync')).status, 200); const copy = (await win(e, 'worker-token', 'info')).body.copy_linux;
    e.instance.sessions[worker.name].status = 'stopped'; const removed = await e.instance.removeWorkerWorktree(sub, worker.name, main); assert.equal(removed.ok, true); assert.equal(fs.existsSync(copy), false);
    assert.equal((await win(e, 'sub-lead-token', 'sync')).status, 200); const leadCopy = (await win(e, 'sub-lead-token', 'info')).body.copy_linux;
    let done; const syncGate = new Promise(r => { done = r; }); const original = e.instance.win.sync.bind(e.instance.win); e.instance.win.sync = async ctx => { await syncGate; return original(ctx); };
    const first = await e.instance.archive('test'); assert.equal(first.pending, true); assert.ok(first.pending_sessions.includes(sub.name)); done(); await Promise.all([...e.instance.win.stopTasks.values()].map(v => v.task));
    const second = await e.instance.archive('test'); assert.notEqual(second.pending, true); assert.equal(fs.existsSync(leadCopy), false);
  } finally { await e.close(); }
});
