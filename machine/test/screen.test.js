'use strict';
// Spec validation map: start/idempotence, stop/restart, isolation and liveness:
// "screen lifecycle and isolation"; reviewer and validation: "route rejects...";
// environment, sandbox, command and version: "run rebuilds..." and "systemd versions...";
// generation reservation/fencing/sweep: "generation fencing and sweep";
// archive timing and generation: "archive tears down..."; startup: "startup...";
// missing tools and user bus: "missing tools and unavailable user bus";
// screenshots/counters/restart: "screenshot numbers survive...";
// focus failure, lock handling, and quick exit: "run focus..." and "failed key release...".
// X-tool argv, argument grammar, polling and deadlines are covered by screen-input.test.js
// and screen-args.test.js, owned by T1c and T1a respectively.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { makeTemp } = require('../../test-support/run-dir');
const { MachineService } = require('../service');

async function fixture() {
  const root = await makeTemp('wheelchair-screen-test-'); const bin = path.join(root, 'bin'); await fsp.mkdir(bin);
  const log = path.join(root, 'tools.log'); const settings = path.join(root, 'settings.json');
  const script = `#!/usr/bin/env node
const fs = require('fs'), path = require('path'), cp = require('child_process');
const name = process.env.SCREEN_TOOL || path.basename(process.argv[1]), args = process.argv.slice(2), config = JSON.parse(fs.readFileSync(process.env.SCREEN_SETTINGS));
fs.appendFileSync(process.env.SCREEN_LOG, JSON.stringify({ name, args, display: process.env.DISPLAY, auth: process.env.XAUTHORITY, token: process.env.WHEELCHAIR_SESSION_TOKEN, lane: process.env.WHEELCHAIR_LANE, home: process.env.HOME }) + '\\n');
if (name === 'systemctl') {
  if (config.stall && args.includes(config.stall)) return setTimeout(() => {}, 5000);
  if (config.bus === false) process.exit(1);
  if (args.includes('show')) console.log(config.active === false || (config.appExited && args.some(x => /-app[0-9]+\\.scope$/.test(x))) ? 'inactive' : 'active');
  if (args.includes('list-units')) console.log(config.units || '');
} else if (name === 'systemd-run') {
  if (args[0] === '--version') { console.log('systemd ' + (config.version || 254)); process.exit(0); }
  process.exit(0);
} else if (name === 'Xvfb') { setTimeout(() => { fs.writeSync(Number(args[args.indexOf('-displayfd') + 1]), '77\\n'); setTimeout(() => {}, 1200); }, config.displayDelay || 0); }
else if (name === 'mcookie') console.log('0123456789abcdef');
else if (name === 'xwininfo') process.exit(1);
else if (name === 'xdotool' && config.failRelease && args[0] === 'keyup') { console.error('release failed'); process.exit(1); }
else if (name === 'ffmpeg') fs.writeFileSync(args[args.length - 1], Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a1kAAAAASUVORK5CYII=', 'base64'));
else if (name === 'codex') { const i = args.indexOf('--'); if (i >= 0) cp.spawnSync(args[i + 1], args.slice(i + 2), { stdio: 'inherit', env: process.env }); }
`;
  for (const name of ['systemctl', 'tmux', 'git', 'Xvfb', 'mcookie', 'xauth', 'ffmpeg', 'xdotool', 'xwininfo', 'codex', 'app']) await fsp.writeFile(path.join(bin, name), script, { mode: 0o755 });
  const logger = path.join(bin, 'scope-log'); await fsp.writeFile(logger, script, { mode: 0o755 });
  await fsp.writeFile(path.join(bin, 'systemd-run'), '#!/bin/sh\nSCREEN_TOOL=systemd-run node "$SCREEN_LOGGER" "$@"\n[ "$1" = --version ] && exit 0\nwhile [ "$1" != -- ] && [ "$#" -gt 0 ]; do shift; done\n[ "$#" -gt 0 ] || exit 1\nshift\nexec "$@"\n', { mode: 0o755 });
  await fsp.writeFile(settings, '{}'); const previous = { PATH: process.env.PATH, SCREEN_LOG: process.env.SCREEN_LOG, SCREEN_SETTINGS: process.env.SCREEN_SETTINGS, SCREEN_LOGGER: process.env.SCREEN_LOGGER };
  process.env.PATH = `${bin}:${previous.PATH}`; process.env.SCREEN_LOG = log; process.env.SCREEN_SETTINGS = settings; process.env.SCREEN_LOGGER = logger;
  const service = new MachineService({ stateDir: path.join(root, 'state'), host: '127.0.0.1', port: 1 });
  service.config = { host: '127.0.0.1', port: 1 }; service.liveTmux = () => new Set(Object.values(service.sessions).filter(s => s.status !== 'stopped').map(s => s.name));
  function session(name, thread = 'thread', cli = 'claude') { return service.sessions[name] = { name, role: 'worker', cli, thread_id: thread, status: 'ready', token: name, worktree: root, account_dir: null }; }
  const a = session('wc-thread-worker'); const server = http.createServer((req, res) => service.handle(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  async function call(op, args = [], who = a) { const res = await fetch(`http://127.0.0.1:${server.address().port}/v1/agent/screen`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-wheelchair-session-token': who.token }, body: JSON.stringify({ op, args }) }); return { status: res.status, body: await res.json() }; }
  return { root, bin, service, a, session, call, settings, async configure(value) { await fsp.writeFile(settings, JSON.stringify(value)); }, async calls() { try { return (await fsp.readFile(log, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse); } catch { return []; } }, async close() { service.screens.stopTimers(); await new Promise(resolve => server.close(resolve)); Object.assign(process.env, previous); } };
}

test('screen lifecycle and isolation', async () => {
  const f = await fixture(); try {
    assert.equal((await f.call('shot')).status, 422);
    const first = await f.call('start', ['--size', '300x400']); assert.deepEqual(first.body, { ok: true, display: ':77', size: { width: 300, height: 400 } });
    assert.deepEqual((await f.call('start', ['--size', '600x700'])).body, first.body);
    const b = f.session('wc-thread-worker-2'); assert.equal((await f.call('status', [], b)).body.running, false);
    assert.equal((await f.call('stop')).status, 200); assert.equal((await f.call('status')).body.running, false);
    assert.equal((await f.call('start')).status, 200);
    f.a.status = 'stopped'; f.service.screens.killSession(f.a.name); assert.equal((await f.call('start')).status, 409);
    const calls = await f.calls(); assert(calls.some(c => c.name === 'systemctl' && c.args.includes('--signal=SIGTERM'))); assert(calls.some(c => c.name === 'systemctl' && c.args.includes('--signal=SIGKILL')));
  } finally { await f.close(); }
});
test('route rejects reviewer, invalid size and unavailable tmux', async () => {
  const f = await fixture(); try {
    f.a.role = 'reviewer'; assert.equal((await f.call('bad', ['bad'])).status, 403); f.a.role = 'worker';
    assert.equal((await f.call('start', ['--size', '2561x300'])).status, 400);
    f.service.liveTmux = () => null; assert.equal((await f.call('start')).status, 422);
    f.service.liveTmux = () => new Set(); assert.equal((await f.call('start')).status, 409);
  } finally { await f.close(); }
});
test('run rebuilds environment, sandbox and command validation', async () => {
  const f = await fixture(); try {
    f.a.cli = 'codex'; f.a.codex_mode = 'workspace-write';
    const missing = await f.call('run', ['--', 'absent-command-123']); assert.equal(missing.status, 422); assert.match(missing.body.error, /command not found/);
    assert.equal((await f.call('run', ['--', '-'])).status, 400); assert.equal((await f.call('run', ['--', 'A=B'])).status, 400);
    const result = await f.call('run', ['--env', 'HELLO=$HOME', '--', 'app']); assert.equal(result.status, 200); assert.equal(result.body.focused, null);
    const calls = await f.calls(); const launcher = calls.find(c => c.name === 'systemd-run' && c.args.includes('app'));
    assert(launcher.args.includes('--expand-environment=no')); assert(launcher.args.some(x => x.startsWith('--slice=wcscreen-')));
    assert.deepEqual(launcher.args.slice(launcher.args.indexOf('codex')), ['codex', 'sandbox', '-c', 'sandbox_mode="workspace-write"', '-c', 'sandbox_workspace_write.network_access=true', '--', 'env', '--', 'HELLO=$HOME', 'app']);
    assert.equal(launcher.token, undefined); assert.equal(launcher.display, ':77'); assert.equal(launcher.lane, '1'); assert.match(launcher.auth, /xauth$/);
  } finally { await f.close(); }
});
test('systemd versions and executable option-like commands', async () => {
  const f = await fixture(); try {
    await f.configure({ version: 253 }); await fsp.copyFile(path.join(f.bin, 'app'), path.join(f.bin, '--help')); await fsp.chmod(path.join(f.bin, '--help'), 0o755);
    const result = await f.call('run', ['--', '--help']); assert.equal(result.status, 200);
    const calls = await f.calls(); const launcher = calls.find(c => c.name === 'systemd-run' && c.args.includes('--help'));
    assert(!launcher.args.includes('--expand-environment=no')); assert.deepEqual(launcher.args.slice(-3), ['env', '--', '--help']);
  } finally { await f.close(); }
});
test('generation reservation and sweep preserve current slice', async () => {
  const f = await fixture(); try {
    const started = await f.call('start'); assert.equal(started.status, 200);
    const s = f.service.screens.screens.get(f.a.name); const state = JSON.parse(await fsp.readFile(path.join(s.dir, 'state.json'))); assert.equal(state.status, 'running'); assert(state.generation > 0);
    const current = f.service.screens.slice(s); const old = current.replace(/g\d+\.slice$/, 'g0.slice');
    await f.configure({ units: `${old} loaded active active\n${current} loaded active active` }); await f.service.screens.sweep();
    const calls = await f.calls(); const terms = calls.filter(c => c.name === 'systemctl' && c.args.includes('--signal=SIGTERM')); assert(terms.some(c => c.args.includes(old))); assert(!terms.some(c => c.args.includes(current)));
  } finally { await f.close(); }
});
test('archive tears down one thread slice and bumps each generation', async () => {
  const f = await fixture(); try {
    const b = f.session('wc-thread-worker-2'); await f.call('start'); await f.call('start', [], b);
    const screens = [...f.service.screens.screens.values()]; const generations = screens.map(s => s.state.generation);
    f.service.screens.killThread('thread'); assert.deepEqual(screens.map(s => s.state.generation), generations.map(n => n + 1));
    const calls = await f.calls(); const kills = calls.filter(c => c.name === 'systemctl' && c.args.includes('--signal=SIGKILL') && c.args.some(a => a.endsWith('-thread.slice'))); assert.equal(kills.length, 1);
    await f.configure({ stall: 'kill' }); const before = Date.now(); f.service.screens.killThread('thread'); assert(Date.now() - before < 1800);
  } finally { await f.close(); }
});
test('startup clears its own parent and retains counters', async () => {
  const f = await fixture(); try {
    await f.call('start'); const s = f.service.screens.screens.get(f.a.name); s.state.next_shot = 9; f.service.screens.save(s); f.service.screens.screens.clear();
    await f.service.screens.startup(); const state = JSON.parse(await fsp.readFile(path.join(s.dir, 'state.json'))); assert.equal(state.status, 'none'); assert.equal(state.next_shot, 9); assert.equal(state.generation, s.state.generation + 1);
    const calls = await f.calls(); assert(calls.some(c => c.name === 'systemctl' && c.args.includes(`${f.service.screens.prefix}.slice`)));
  } finally { await f.close(); }
});
test('missing tools and unavailable user bus', async () => {
  const f = await fixture(); try {
    await f.configure({ bus: false }); const bus = await f.call('start'); assert.equal(bus.status, 422); assert.match(bus.body.error, /systemd user session/);
    process.env.PATH = f.bin; await fsp.rename(path.join(f.bin, 'Xvfb'), path.join(f.bin, 'x-absent'));
    const missing = await f.call('start'); assert.equal(missing.status, 422); assert.match(missing.body.error, /missing on this machine: Xvfb/);
    process.env.PATH = ''; const all = await f.call('start'); assert.equal(all.body.error, 'missing on this machine: Xvfb, xauth, mcookie, ffmpeg, xdotool, xwininfo, systemd-run, systemctl');
  } finally { await f.close(); }
});
test('screenshot numbers survive stop and startup', async () => {
  const f = await fixture(); try {
    await f.call('start'); const one = await f.call('shot'); assert.equal(one.status, 200); await f.call('stop'); await f.call('start');
    const two = await f.call('shot'); assert.equal(two.status, 200); assert.notEqual(one.body.path, two.body.path);
    f.service.screens.screens.clear(); await f.service.screens.startup(); await f.call('start'); const three = await f.call('shot'); assert.equal(three.status, 200); assert.notEqual(two.body.path, three.body.path);
  } finally { await f.close(); }
});


test('starting generation survives sweep and late registration is fenced', async () => {
  const f = await fixture(); try {
    await f.configure({ active: false, displayDelay: 800 });
    const pending = f.call('start');
    let screen;
    for (let i = 0; i < 100; i++) { screen = f.service.screens.screens.get(f.a.name); if (screen && (await f.calls()).some(c => c.name === 'Xvfb')) break; await new Promise(r => setTimeout(r, 20)); }
    assert(screen); const stateFile = path.join(screen.dir, 'state.json');
    assert.equal(JSON.parse(await fsp.readFile(stateFile)).status, 'starting');
    const slice = f.service.screens.slice(screen); await f.configure({ active: false, displayDelay: 800, units: slice }); await f.service.screens.sweep();
    let calls = await f.calls(); assert(!calls.some(c => c.name === 'systemctl' && c.args.includes('--signal=SIGTERM') && c.args.includes(slice)));
    f.a.status = 'stopped'; f.service.screens.killSession(f.a.name);
    const result = await pending; assert.equal(result.status, 409);
    calls = await f.calls(); assert(calls.some(c => c.name === 'systemctl' && c.args.includes('--signal=SIGKILL') && c.args.includes(slice.replace('.slice', '-x.scope'))));
    assert.equal(JSON.parse(await fsp.readFile(stateFile)).generation, screen.state.generation);
  } finally { await f.close(); }
});
test('immediate teardown shares its deadline when stop stalls', async () => {
  const f = await fixture(); try {
    await f.configure({ stall: 'stop' }); const before = Date.now(); f.service.screens.killThread('thread'); assert(Date.now() - before < 1800);
    const calls = await f.calls(); assert(calls.some(c => c.name === 'systemctl' && c.args.includes('--signal=SIGKILL'))); assert(calls.some(c => c.name === 'systemctl' && c.args.includes('stop')));
  } finally { await f.close(); }
});
test('run focus failure succeeds and a finished app is reported exited', async () => {
  const f = await fixture(); try {
    await f.configure({ appExited: true }); const result = await f.call('run', ['--', 'app']); assert.equal(result.status, 200); assert.equal(result.body.focused, null);
    const status = await f.call('status'); assert.equal(status.body.apps[0].state, 'exited');
  } finally { await f.close(); }
});


test('archive removes screen files and keeps them with an unfinished rebase', async () => {
  const f = await fixture(); try {
    await f.call('start'); const dir = path.join(f.service.stateDir, 'screens', 'thread');
    const result = await f.service.archive('thread'); assert.equal(result.uploads_removed, true); assert.equal(fs.existsSync(dir), false);
    const b = f.session('wc-other-worker', 'other'); b.created_worktree = true;
    await f.call('start', [], b); const otherDir = path.join(f.service.stateDir, 'screens', 'other');
    f.service.mergeInProgress = () => false; f.service.rebaseInProgress = () => true;
    const kept = await f.service.archive('other'); assert.equal(kept.uploads_removed, null); assert.equal(kept.kept[0].reason, 'rebase in progress'); assert.equal(fs.existsSync(otherDir), true);
  } finally { await f.close(); }
});
test('session stop kills the screen before removing a verifier worktree', async () => {
  const f = await fixture(); try {
    f.a.role = 'verifier'; f.a.created_worktree = true; await f.call('start'); await f.service.stop(f.a.name);
    const calls = await f.calls(); const kill = calls.findIndex(c => c.name === 'systemctl' && c.args.includes('--signal=SIGKILL')); const remove = calls.findIndex(c => c.name === 'git' && c.args.includes('worktree'));
    assert(kill >= 0 && remove > kill);
  } finally { await f.close(); }
});
test('failed key release locks input until screen stop', async () => {
  const f = await fixture(); try {
    await f.call('start'); await f.configure({ failRelease: true });
    const fail = await f.call('key', ['--hold', '50', 'ctrl']); assert.equal(fail.status, 422); assert.match(fail.body.error, /keys may still be held/);
    assert.equal((await f.call('move', ['1', '2'])).status, 422); await f.call('stop'); await f.configure({}); await f.call('start'); assert.equal((await f.call('move', ['1', '2'])).status, 200);
  } finally { await f.close(); }
});


test('tmux disappearance kills the screen and dead Xvfb is treated as absent', async () => {
  const f = await fixture(); try {
    await f.call('start'); f.service.liveTmux = () => new Set(); assert.equal((await f.call('start')).status, 409);
    assert.equal(f.service.screens.screens.size, 0); assert((await f.calls()).some(c => c.name === 'systemctl' && c.args.includes('--signal=SIGKILL')));
    f.service.liveTmux = () => new Set([f.a.name]); await f.call('start'); await f.configure({ active: false });
    const result = await f.call('windows'); assert.equal(result.status, 422); assert.match(result.body.error, /no screen/);
  } finally { await f.close(); }
});
test('startup bounds stalled systemctl and still clears durable state', async () => {
  const f = await fixture(); try {
    await f.call('start'); const screen = f.service.screens.screens.get(f.a.name); f.service.screens.screens.clear();
    await f.configure({ stall: 'kill' }); const before = Date.now(); await f.service.screens.startup(); assert(Date.now() - before < 2700);
    assert.equal(JSON.parse(await fsp.readFile(path.join(screen.dir, 'state.json'))).status, 'none');
  } finally { await f.close(); }
});
