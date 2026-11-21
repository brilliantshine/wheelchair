'use strict';
// Exercises this checkout's service in a real systemd user environment on WSL.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { makeTemp } = require('../../test-support/run-dir');

const root = path.resolve(__dirname, '../..');
const servicePath = path.join(root, 'machine/service.js');
const wc = path.join(root, 'viewer/app/wc.js');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const id = crypto.randomBytes(6).toString('hex');
const unit = `wc-win-live-${id}`;
const token = `live-${id}`, secret = `secret-${id}`, thread = `winlive${id}`;
let dir, copy, child, env;

function command(program, args, options = {}) {
  const r = spawnSync(program, args, { encoding: 'utf8', timeout: 30000, ...options });
  if (r.status !== 0) throw new Error(`${program} ${args.join(' ')}: ${r.stderr || r.stdout || r.error}`);
  return r.stdout.trim();
}
function expect(condition, message, detail = '') {
  if (!condition) throw new Error(`${message}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
  console.log(`ok - ${message}`);
}
async function api(route, body) {
  const res = await fetch(`${env.WHEELCHAIR_MACHINE_ORIGIN}${route}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-wheelchair-machine-secret': secret }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(`${route}: ${res.status} ${JSON.stringify(data)}`);
  return data;
}
async function client(kind, args, timeout = 660000) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [wc, kind, ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = ''; const timer = setTimeout(() => p.kill('SIGKILL'), timeout);
    p.stdout.on('data', b => { out += b; }); p.stderr.on('data', b => { err += b; });
    p.on('error', reject); p.on('close', status => {
      clearTimeout(timer);
      if (status !== 0) return reject(new Error(`${kind} ${args[0]} exit ${status}: ${err || out}`));
      try { resolve(JSON.parse(out)); } catch { reject(new Error(`invalid client output: ${out} ${err}`)); }
    });
  });
}
const win = (...args) => client('win', args);
async function commit(paths, message) {
  const result = await client('git', ['commit', '--paths', paths.join(','), '--message', message]);
  expect(result.ok, `commit ${message}`, result);
}
// Enumerate individual untracked files as well as tracked changes; keep test results out of commits.
function changedPaths(repo) {
  const result = spawnSync('git', ['-C', repo, 'status', '--porcelain', '-z', '--untracked-files=all'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git status failed: ${result.stderr}`);
  return result.stdout.split('\0').filter(Boolean).map(entry => {
    if (/[RC]/.test(entry.slice(0, 2))) throw new Error(`unexpected rename or copy: ${entry}`);
    const name = entry.slice(3);
    if (name.includes(',')) throw new Error(`cannot commit path containing a comma: ${name}`);
    return name;
  }).filter(name => name !== 'wheelchair-live-results.xml');
}
async function commitUnityChanges(repo, label) {
  const paths = changedPaths(repo);
  console.log(`${label} paths: ${JSON.stringify(paths)}`);
  if (paths.length) await commit(paths, label);
}
async function poll(fn, timeout, description) {
  const until = Date.now() + timeout;
  while (Date.now() < until) { const result = await fn(); if (result) return result; await delay(1000); }
  throw new Error(`timed out waiting for ${description}`);
}
// Decode 8-bit, non-interlaced RGB/RGBA PNGs, including all five PNG row filters.
function variedPng(file) {
  const png = fs.readFileSync(file);
  expect(png.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), 'screenshot is PNG');
  let width, height, channels, chunks = [], pos = 8;
  while (pos < png.length) {
    const len = png.readUInt32BE(pos), type = png.toString('ascii', pos + 4, pos + 8), data = png.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); channels = data[9] === 6 ? 4 : data[9] === 2 ? 3 : 0; expect(data[8] === 8 && channels && data[12] === 0, 'PNG is 8-bit RGB/RGBA without interlace'); }
    if (type === 'IDAT') chunks.push(data);
    pos += len + 12;
    if (type === 'IEND') break;
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks)), stride = width * channels;
  expect(width > 0 && height > 0 && raw.length === height * (stride + 1), 'PNG has complete pixel data');
  let previous = Buffer.alloc(stride), first, different = false, offset = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[offset++], row = Buffer.alloc(stride);
    expectFilter(filter);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? row[x - channels] : 0, b = previous[x], c = x >= channels ? previous[x - channels] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const predictor = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      row[x] = (raw[offset++] + predictor) & 255;
    }
    for (let x = 0; x < stride; x += channels) { const color = row.subarray(x, x + 3); if (!first) first = Buffer.from(color); else if (!color.equals(first)) different = true; }
    previous = row;
  }
  expect(different, 'screenshot contains more than one colour');
}
function expectFilter(filter) { if (filter > 4) throw new Error(`unsupported PNG filter ${filter}`); }
async function screenshot(window, label) {
  const result = await win('shot', String(window.handle));
  variedPng(result.path);
  const target = path.join('/tmp', `wheelchair-windows-live-${id}-${label}.png`);
  fs.copyFileSync(result.path, target); console.log(`screenshot: ${target}`);
}
async function windowWith(predicate, description, timeout = 120000) {
  return poll(async () => (await win('windows')).windows.find(predicate), timeout, description);
}
async function waitExit(app, timeout = 1200000) {
  const item = await poll(async () => { const s = await win('status', app); const a = s.apps.find(x => x.id === app); return a && !a.running ? a : null; }, timeout, `app ${app} exit`);
  expect(item.exit_code === 0, `app ${app} exits 0`, item);
}
async function cleanup() {
  if (env) {
    try { await win('stop'); } catch (e) { console.error(`cleanup stop: ${e.message}`); }
    try { await poll(async () => !(await api('/v1/archive', { thread_id: thread })).pending, 120000, 'archive'); } catch (e) { console.error(`cleanup archive: ${e.message}`); }
  }
  spawnSync('systemctl', ['--user', 'stop', `${unit}.service`], { timeout: 15000 });
  if (child) child.kill();
  if (copy && path.basename(path.dirname(copy)) === thread && path.basename(path.dirname(path.dirname(copy))) === 'copies' && path.basename(path.dirname(path.dirname(path.dirname(copy)))) === 'Wheelchair' && fs.existsSync(copy)) { fs.rmSync(copy, { recursive: true, force: true }); }
  if (copy && fs.existsSync(copy)) throw new Error(`Windows copy remains: ${copy}`);
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
}
async function main() {
  dir = await makeTemp('windows-live-');
  const bin = path.join(dir, 'bin'), state = path.join(dir, 'state'), repo = path.join(dir, 'repo'), sessions = path.join(dir, 'sessions');
  fs.mkdirSync(bin); fs.mkdirSync(state); fs.mkdirSync(repo); fs.writeFileSync(sessions, '');
  fs.writeFileSync(path.join(bin, 'tmux'), `#!/bin/sh\ncase "$1" in\n list-sessions) cat '${sessions}' ;;\n capture-pane) printf 'auto mode on\\n❯ Try anything\\n' ;;\nesac\nexit 0\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\ncase "$1" in --version) echo claude-test ;; auth) echo \'{"loggedIn":true}\' ;; esac\n', { mode: 0o755 });
  const secretFile = path.join(dir, 'secret'); fs.writeFileSync(secretFile, secret, { mode: 0o600 });
  command('git', ['init', '-q', repo]); command('git', ['-C', repo, 'config', 'user.name', 'Live Test']); command('git', ['-C', repo, 'config', 'user.email', 'live@example.invalid']);
  const port = await new Promise(resolve => { const server = http.createServer(); server.listen(0, '127.0.0.1', () => { const n = server.address().port; server.close(() => resolve(n)); }); });
  env = { ...process.env, WHEELCHAIR_MACHINE_ORIGIN: `http://127.0.0.1:${port}`, WHEELCHAIR_SESSION_TOKEN: token }; delete env.WHEELCHAIR_MACHINE_URL;
  console.log(`service code: ${servicePath}`);
  child = spawn('systemd-run', ['--user', '--wait', '--pipe', `--unit=${unit}`, `--setenv=PATH=${bin}:${process.env.PATH}`, process.execPath, servicePath, '--stateDir', state, '--host', '127.0.0.1', '--port', String(port), '--secretFile', secretFile], { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', b => process.stdout.write(b)); child.stderr.on('data', b => process.stderr.write(b));
  await poll(async () => { try { return (await fetch(`${env.WHEELCHAIR_MACHINE_ORIGIN}/health`)).status < 500; } catch { return false; } }, 30000, 'service startup');
  const session = await api('/v1/sessions', { role: 'lead', cli: 'claude', thread_id: thread, token, worktree: repo });
  fs.writeFileSync(sessions, `${session.name}\n`);
  fs.writeFileSync(path.join(repo, 'linux.txt'), 'base linux\n'); fs.writeFileSync(path.join(repo, 'windows.txt'), 'base windows\n');
  await commit(['linux.txt', 'windows.txt'], 'base');
  const info = await win('info'); expect(info.ok && info.ready, 'info reports ready', info); copy = info.copy_linux;
  await win('sync'); fs.writeFileSync(path.join(repo, 'linux.txt'), 'linux edit\n'); fs.writeFileSync(path.join(copy, 'windows.txt'), 'windows edit\n'); await win('sync');
  expect(fs.readFileSync(path.join(copy, 'linux.txt'), 'utf8') === 'linux edit\n' && fs.readFileSync(path.join(repo, 'windows.txt'), 'utf8') === 'windows edit\n', 'sync round trip');
  const run = await win('run', '--', 'cmd.exe', '/c', 'echo', 'hi'); expect(run.exit_code === 0 && /^hi\s*$/m.test(run.output), 'cmd.exe echo hi exits 0', run);
  const title = `Wheelchair live ${id}`;
  const script = `Add-Type -AssemblyName System.Windows.Forms; $f=New-Object System.Windows.Forms.Form; $f.Text='${title}'; $f.Width=500; $f.Height=300; $f.BackColor=[System.Drawing.Color]::CornflowerBlue; [void]$f.ShowDialog()`;
  await win('start', '--', 'powershell.exe', '-NoProfile', '-Command', script);
  const window = await windowWith(w => w.title === title, 'WinForms window'); expect(!!window, 'windows lists WinForms title'); await screenshot(window, 'winforms');
  await win('stop'); await poll(async () => !(await win('windows')).windows.some(w => w.title === title), 30000, 'window removal'); expect(true, 'stop removes WinForms window');
  await commit(['linux.txt', 'windows.txt'], 'round trip');
  if (!process.env.WHEELCHAIR_UNITY) { console.log('Unity part skipped'); return 77; }
  fs.cpSync(path.join(__dirname, 'fixtures/unity-min'), repo, { recursive: true });
  await commit(['.gitignore', 'Packages', 'Assets'], 'Unity fixture'); await win('sync');
  const unityInput = process.env.WHEELCHAIR_UNITY;
  const unity = /^\/mnt\//.test(unityInput) ? (await win('path', unityInput)).path : unityInput;
  const project = info.copy_windows;
  const imported = await win('start', '--', unity, '-batchmode', '-quit', '-projectPath', project); await waitExit(imported.id); await win('sync');
  await commitUnityChanges(repo, 'Unity import');
  const tests = await win('run', '--', unity, '-batchmode', '-runTests', '-testPlatform', 'EditMode', '-projectPath', project, '-testResults', `${project}\\wheelchair-live-results.xml`);
  expect(tests.exit_code === 0, 'Unity tests exit 0', tests); const results = fs.readFileSync(path.join(repo, 'wheelchair-live-results.xml'), 'utf8');
  expect(/<test-case\b(?=[^>]*FixtureTest)(?=[^>]*result="Passed")[^>]*>/.test(results), 'Unity results contain passed FixtureTest');
  await win('sync');
  await commitUnityChanges(repo, 'Unity tests');
  fs.unlinkSync(path.join(repo, 'wheelchair-live-results.xml')); await win('sync');
  const status = command('git', ['-C', repo, 'status', '--porcelain']);
  const diff = command('git', ['-C', repo, 'diff', '--stat']);
  expect(status === '', 'Unity worktree is clean', `git status --porcelain:\n${status}\ngit diff --stat:\n${diff}`);
  const editor = await win('start', '--', unity, '-projectPath', project); const editorWindow = await windowWith(w => w.app_id === editor.id && /unity/i.test(w.title), 'Unity Editor window', 300000); expect(!!editorWindow, 'windows lists Unity Editor'); await screenshot(editorWindow, 'unity'); await win('stop');
  return 0;
}
(async () => {
  let code = 1;
  try { code = await main(); } catch (e) { console.error(`not ok - ${e.stack || e}`); }
  try { await cleanup(); } catch (e) { console.error(`not ok - cleanup: ${e.stack || e}`); code = 1; }
  process.exit(code);
})();
