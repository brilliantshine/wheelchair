'use strict';
// Keep service instances independent of the host's WSL and interop setup.
const noWsl = { procRoot: __dirname, etcRoot: __dirname, runRoot: __dirname };
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
const { screenTools, TOOLS } = require('../lib/screen');

async function fixture() {
  const root = await makeTemp('wheelchair-screen-test-'); const bin = path.join(root, 'bin'); await fsp.mkdir(bin);
  const log = path.join(root, 'tools.log'); const settings = path.join(root, 'settings.json');
  const script = `#!/usr/bin/env node
const fs = require('fs'), path = require('path'), cp = require('child_process');
const name = process.env.SCREEN_TOOL || path.basename(process.argv[1]), args = process.argv.slice(2), config = JSON.parse(fs.readFileSync(process.env.SCREEN_SETTINGS));
fs.appendFileSync(process.env.SCREEN_LOG, JSON.stringify({ name, args, display: process.env.DISPLAY, auth: process.env.XAUTHORITY, token: process.env.WHEELCHAIR_SESSION_TOKEN, lane: process.env.WHEELCHAIR_LANE, home: process.env.HOME, xdgHome: process.env.XDG_CONFIG_HOME, xdgDirs: process.env.XDG_CONFIG_DIRS }) + '\\n');
if (name === 'systemctl') {
  if (config.stall && args.includes(config.stall)) return setTimeout(() => {}, 5000);
  if (config.bus === false) process.exit(1);
  if (args.includes('show')) console.log(config.active === false || (config.appExited && args.some(x => /-app[0-9]+\\.scope$/.test(x))) ? 'inactive' : 'active');
  if (args.includes('list-units')) console.log(config.units || '');
} else if (name === 'systemd-run') {
  if (args[0] === '--version') { console.log('systemd ' + (config.version || 254)); process.exit(0); }
  if (config.launch === 'fail') { console.error('Failed to start transient scope unit: boom'); process.exit(1); }
  if (config.launch === 'signal') process.kill(process.pid, 'SIGKILL');
  if (config.launch === 'hang') { console.error('Failed to hang'); const parent = process.ppid; return setInterval(() => { if (process.ppid !== parent) process.exit(0); }, 100); }
  process.exit(0);
} else if (name === 'openbox') { if (config.wmExit) process.exit(0); fs.writeFileSync(path.join(path.dirname(process.env.SCREEN_LOG), 'wm-ready'), 'ready'); setTimeout(() => {}, 30000); }
else if (name === 'xprop') { if (args.includes('_OB_CONFIG_FILE')) { if (config.wmPath !== 'missing' && fs.existsSync(path.join(path.dirname(process.env.SCREEN_LOG), 'wm-ready'))) console.log('_OB_CONFIG_FILE(UTF8_STRING) = "' + (config.wmPath === 'wrong' ? '/wrong' : path.join(process.env.HOME, 'openbox', 'rc.xml')) + '"'); } else console.log('_NET_CLIENT_LIST(WINDOW): window id # ' + (fs.existsSync(path.join(path.dirname(process.env.SCREEN_LOG), 'window')) ? '0x200001' : '')); }
else if (name === 'Xvfb') { setTimeout(() => { fs.writeSync(Number(args[args.indexOf('-displayfd') + 1]), '77\\n'); setTimeout(() => {}, 1200); }, config.displayDelay || 0); }
else if (name === 'mcookie') console.log('0123456789abcdef');
else if (name === 'app' && config.showWindow) fs.writeFileSync(path.join(path.dirname(process.env.SCREEN_LOG), 'window'), 'ready');
else if (name === 'xwininfo') {
  if (!config.showWindow) process.exit(1);
  if (args.includes('-root')) console.log(fs.existsSync(path.join(path.dirname(process.env.SCREEN_LOG), 'window')) ? '1 children:\\n  0x200001 \"App\": () 30x30+0+0' : '0 children.');
  else console.log('xwininfo: Window id: 0x200001 \"App\"\\n  Absolute upper-left X: 0\\n  Absolute upper-left Y: 0\\n  Width: 30\\n  Height: 30\\n  Map State: IsViewable');
}

else if (name === 'xdotool' && config.failFocus && args[0] === 'windowfocus') { console.error('focus failed'); process.exit(1); }
else if (name === 'xdotool' && config.failRelease && args[0] === 'keyup') { console.error('release failed'); process.exit(1); }
else if (name === 'ffmpeg') fs.writeFileSync(args[args.length - 1], Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a1kAAAAASUVORK5CYII=', 'base64'));
else if (name === 'codex') { const i = args.indexOf('--'); if (i >= 0) cp.spawnSync(args[i + 1], args.slice(i + 2), { stdio: 'inherit', env: process.env }); }
`;
  for (const name of ['systemctl', 'tmux', 'git', 'Xvfb', 'mcookie', 'xauth', 'ffmpeg', 'xdotool', 'xwininfo', 'codex', 'app']) await fsp.writeFile(path.join(bin, name), script, { mode: 0o755 });
  const logger = path.join(bin, 'scope-log'); await fsp.writeFile(logger, script, { mode: 0o755 });
  await fsp.writeFile(path.join(bin, 'systemd-run'), '#!/bin/sh\nif [ x$1 = xload-buffer ]; then cat >/dev/null; fi\nSCREEN_TOOL=systemd-run node "$SCREEN_LOGGER" "$@"\nstatus=$?\n[ "$status" = 137 ] && kill -KILL $$\n[ "$status" = 0 ] || exit "$status"\n[ "$1" = --version ] && exit 0\nwhile [ "$1" != -- ] && [ "$#" -gt 0 ]; do shift; done\n[ "$#" -gt 0 ] || exit 1\nshift\nexec "$@"\n', { mode: 0o755 });
  await fsp.writeFile(settings, '{}'); const previous = { PATH: process.env.PATH, SCREEN_LOG: process.env.SCREEN_LOG, SCREEN_SETTINGS: process.env.SCREEN_SETTINGS, SCREEN_LOGGER: process.env.SCREEN_LOGGER };
  process.env.PATH = `${bin}:${previous.PATH}`; process.env.SCREEN_LOG = log; process.env.SCREEN_SETTINGS = settings; process.env.SCREEN_LOGGER = logger;
  const service = new MachineService({ win: noWsl, stateDir: path.join(root, 'state'), host: '127.0.0.1', port: 1 });
  service.screens.allowOpenbox = false;
  service.config = { host: '127.0.0.1', port: 1 }; service.liveTmux = () => new Set(Object.values(service.sessions).filter(s => s.status !== 'stopped').map(s => s.name));
  function session(name, thread = 'thread', cli = 'claude') { return service.sessions[name] = { name, role: 'worker', cli, thread_id: thread, status: 'ready', token: name, worktree: root, account_dir: null }; }
  const a = session('wc-thread-worker'); const server = http.createServer((req, res) => service.handle(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  async function call(op, args = [], who = a) { const res = await fetch(`http://127.0.0.1:${server.address().port}/v1/agent/screen`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-wheelchair-session-token': who.token }, body: JSON.stringify({ op, args }) }); return { status: res.status, body: await res.json() }; }
  return { root, bin, service, a, session, call, settings, async configure(value) { await fsp.writeFile(settings, JSON.stringify(value)); }, async calls() { try { return (await fsp.readFile(log, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse); } catch { return []; } }, async close() { service.screens.stopTimers(); await new Promise(resolve => server.close(resolve)); Object.assign(process.env, previous); } };
}

async function waitForCall(f, predicate, ms = 5000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const call = (await f.calls()).find(predicate);
    if (call) return call;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('call not logged: ' + predicate);
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
    const launcher = await waitForCall(f, c => c.name === 'systemd-run' && c.args.includes('app'));
    assert(launcher.args.includes('--expand-environment=no')); assert(launcher.args.some(x => x.startsWith('--slice=wcscreen-')));
    assert.deepEqual(launcher.args.slice(launcher.args.indexOf('codex')), ['codex', 'sandbox', '-c', 'sandbox_mode="workspace-write"', '-c', 'sandbox_workspace_write.network_access=true', '--', 'env', '--', 'HELLO=$HOME', 'app']);
    assert.equal(launcher.token, undefined); assert.equal(launcher.display, ':77'); assert.equal(launcher.lane, '1'); assert.match(launcher.auth, /xauth$/);
  } finally { await f.close(); }
});
test('systemd versions and executable option-like commands', async () => {
  const f = await fixture(); try {
    await f.configure({ version: 253 }); await fsp.copyFile(path.join(f.bin, 'app'), path.join(f.bin, '--help')); await fsp.chmod(path.join(f.bin, '--help'), 0o755);
    const result = await f.call('run', ['--', '--help']); assert.equal(result.status, 200);
    const launcher = await waitForCall(f, c => c.name === 'systemd-run' && c.args.includes('--help'));
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
test('archive keeps screen files when uploads cannot be removed', async () => {
  const f = await fixture(); try {
    await f.call('start'); const dir = path.join(f.service.stateDir, 'screens', 'thread');
    await fsp.writeFile(path.join(f.service.stateDir, 'uploads'), 'not a directory');
    const result = await f.service.archive('thread'); assert.equal(result.uploads_removed, false); assert.equal(fs.existsSync(dir), true);
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


test('focus failure after a new window opens still returns a successful run', async () => {
  const f = await fixture(); try {
    await f.configure({ showWindow: true, failFocus: true }); const result = await f.call('run', ['--', 'app']);
    assert.equal(result.status, 200); assert.equal(result.body.focused, null);
    await waitForCall(f, c => c.name === 'xdotool' && c.args[0] === 'windowfocus');
  } finally { await f.close(); }
});
test('graceful screen stop escalates after three seconds', async () => {
  const f = await fixture(); try {
    await f.call('start'); const screen = f.service.screens.screens.get(f.a.name); const slice = f.service.screens.slice(screen);
    await f.call('stop'); let calls;
    for (let i = 0; i < 100; i++) { calls = await f.calls(); if (calls.some(c => c.name === 'systemctl' && c.args.includes('stop') && c.args.includes(slice))) break; await new Promise(r => setTimeout(r, 50)); }
    assert(calls.some(c => c.name === 'systemctl' && c.args.includes('--signal=SIGTERM') && c.args.includes(slice)));
    assert(calls.some(c => c.name === 'systemctl' && c.args.includes('--signal=SIGKILL') && c.args.includes(slice)));
    assert(calls.some(c => c.name === 'systemctl' && c.args.includes('stop') && c.args.includes(slice)));
  } finally { await f.close(); }
});


test('screenTools reports missing tools in TOOLS order', async () => {
  const f = await fixture(); try {
    assert.deepEqual(screenTools(f.bin).missing, []);
    const empty = path.join(f.root, 'empty'); await fsp.mkdir(empty);
    assert.deepEqual(screenTools(empty).missing, TOOLS);
  } finally { await f.close(); }
});
test('screen cap refuses second session, permits reuse and releases on stop', async () => {
  const f = await fixture(); try {
    f.service.screens.maxScreens = 1; const b = f.session('wc-thread-worker-2');
    assert.equal((await f.call('start')).status, 200); assert.equal((await f.call('start')).status, 200);
    const refused = await f.call('start', [], b); assert.equal(refused.status, 422); assert.match(refused.body.error, /screen limit reached: 1/);
    assert.equal((await f.call('status')).body.running, true); await f.call('stop'); assert.equal((await f.call('start', [], b)).status, 200);
    assert((await f.calls()).some(c => c.name === 'systemctl' && c.args.includes('--signal=SIGTERM')));
  } finally { await f.close(); }
});
test('simultaneous starts reserve exactly one screen', async () => {
  const f = await fixture(); try {
    f.service.screens.maxScreens = 1; const b = f.session('wc-thread-worker-2');
    const results = await Promise.all([f.call('start'), f.call('start', [], b)]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 422]); assert.equal(f.service.screens.screens.size, 1);
  } finally { await f.close(); }
});
test('first state write failure releases slot without spawning scope', async () => {
  const f = await fixture(); try {
    const m = f.service.screens, save = m.save; let fail = true; m.maxScreens = 1;
    m.save = function(s) { if (fail) { fail = false; throw Error('write failed'); } return save.call(this, s); };
    assert.notEqual((await f.call('start')).status, 200); assert.equal(m.screens.size, 0);
    assert(!(await f.calls()).some(c => c.name === 'systemd-run' && c.args.includes('--scope')));
    assert.equal((await f.call('start')).status, 200);
  } finally { await f.close(); }
});
test('final start write failure still removes cookie and signals slice', async () => {
  const f = await fixture(); try {
    const m = f.service.screens, save = m.save; m.save = function(s) { if (s.state.status === 'running' || s.state.status === 'none') throw Error('write failed'); return save.call(this, s); };
    assert.equal((await f.call('start')).status, 422); assert.equal(m.screens.size, 0);
    assert.equal(fs.existsSync(path.join(m.dir(f.a), 'xauth')), false);
    assert((await f.calls()).some(c => c.name === 'systemctl' && c.args.includes('--signal=SIGTERM')));
  } finally { await f.close(); }
});
test('screenshots prune oldest 50 and preserve other files and numbering', async () => {
  const f = await fixture(); try {
    await f.call('start'); const dir = f.service.screens.dir(f.a); await fsp.writeFile(path.join(dir, 'other'), 'keep');
    for (let i = 1; i <= 52; i++) assert.equal((await f.call('shot')).status, 200);
    assert(!fs.existsSync(path.join(dir, 'shot-1.png'))); assert(!fs.existsSync(path.join(dir, 'shot-2.png')));
    for (let i = 3; i <= 52; i++) assert(fs.existsSync(path.join(dir, `shot-${i}.png`)));
    assert(fs.existsSync(path.join(dir, 'other'))); assert.match((await f.call('shot')).body.path, /shot-53\.png$/);
  } finally { await f.close(); }
});
test('pruning errors do not fail shots', async () => {
  const f = await fixture(); try {
    await f.call('start'); const original = fs.readdirSync; let failed = false;
    fs.readdirSync = function(dir, ...args) { if (dir === f.service.screens.dir(f.a)) { failed = true; throw Error('prune'); } return original.call(this, dir, ...args); };
    try { assert.equal((await f.call('shot')).status, 200); assert(failed); } finally { fs.readdirSync = original; }
  } finally { await f.close(); }
});
test('app pid and pgid are saved and status exposes pid', async () => {
  const f = await fixture(); try {
    assert.equal((await f.call('run', ['--', 'app'])).status, 200); const s = f.service.screens.screens.get(f.a.name);
    const app = JSON.parse(await fsp.readFile(path.join(s.dir, 'state.json'))).apps[0]; assert.equal(typeof app.pid, 'number'); assert.equal(app.pid, app.pgid);
    assert.equal((await f.call('status')).body.apps[0].pid, app.pid);
  } finally { await f.close(); }
});
test('launcher failure uses log reason and failed status ignores active scope', async () => {
  const f = await fixture(); try {
    await f.call('start'); await f.configure({ launch: 'fail' }); const result = await f.call('run', ['--', 'app']);
    assert.equal(result.status, 422); assert.equal(result.body.error, 'app did not start: Failed to start transient scope unit: boom');
    assert.equal((await f.call('status')).body.apps[0].state, 'exited');
  } finally { await f.close(); }
});
test('launcher signal before hand-over fails', async () => {
  const f = await fixture(); try { await f.call('start'); await f.configure({ launch: 'signal' }); assert.equal((await f.call('run', ['--', 'app'])).status, 422); } finally { await f.close(); }
});
test('handover timeout kills launcher and stops scope once with fixed reason', async () => {
  const f = await fixture(); try {
    await f.call('start'); await f.configure({ launch: 'hang' });
    const result = await f.call('run', ['--', 'app']); assert.equal(result.body.error, 'app did not start: no hand-over within 5 s'); assert.equal(result.status, 422);
    const pid = f.service.screens.screens.get(f.a.name).state.apps[0].pid; await new Promise(resolve => setTimeout(resolve, 100)); assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    const calls = await f.calls(); assert.equal(calls.filter(c => c.name === 'systemctl' && c.args.includes('stop') && c.args.some(a => /-app1\.scope$/.test(a))).length, 1);
  } finally { await f.close(); }
});
test('marker mode and app umask preserve service umask', async () => {
  const f = await fixture(); try {
    const output = path.join(f.root, 'umask'); const result = await f.call('run', ['--', 'sh', '-c', `umask > "${output}"`]); assert.equal(result.status, 200);
    const marker = path.join(f.service.screens.dir(f.a), 'app-1.started'); assert.equal((await fsp.stat(marker)).mode & 0o777, 0o600);
    assert.equal(parseInt((await fsp.readFile(output, 'utf8')).trim(), 8), process.umask());
  } finally { await f.close(); }
});
test('missing interpreter and fast failing app after handover succeed', async () => {
  const f = await fixture(); try {
    const bad = path.join(f.root, 'bad'); await fsp.writeFile(bad, '#!/missing/interpreter\n', { mode: 0o755 });
    await f.configure({ appExited: true }); assert.equal((await f.call('run', ['--', bad])).status, 200);
    assert.equal((await f.call('status')).body.apps[0].state, 'exited');
    assert.equal((await f.call('run', ['--', 'sh', '-c', 'echo Failed to x; exit 1'])).status, 200);
  } finally { await f.close(); }
});
test('post-spawn and failed state write errors preserve handover outcome', async () => {
  const f = await fixture(); try {
    await f.call('start'); const m = f.service.screens, save = m.save;
    m.save = function(s) { if (s.state.apps.some(a => a.pid !== null || a.failed)) throw Error('write failed'); return save.call(this, s); };
    assert.equal((await f.call('run', ['--', 'app'])).status, 200); await f.configure({ launch: 'fail' });
    // Allow the pre-spawn write for the second record.
    m.save = function(s) { if (s.state.apps.at(-1)?.pid !== null || s.state.apps.at(-1)?.failed) throw Error('write failed'); return save.call(this, s); };
    assert.equal((await f.call('run', ['--', 'app'])).status, 422);
  } finally { await f.close(); }
});

test('asynchronous spawn error retains null process ids', async () => {
  const f = await fixture(); try {
    await f.call('start'); const m = f.service.screens, scopeArgs = m.scopeArgs;
    const launchEnv = f.service.launchEnv.bind(f.service); f.service.launchEnv = (...args) => [...launchEnv(...args), ['PATH', f.bin]];
    m.scopeArgs = async function(s, suffix) { const args = await scopeArgs.call(this, s, suffix); if (suffix.startsWith('app')) await fsp.rename(path.join(f.bin, 'systemd-run'), path.join(f.bin, 'absent-run')); return args; };
    const result = await f.call('run', ['--', 'app']); assert.equal(result.status, 422);
    const app = m.screens.get(f.a.name).state.apps[0]; assert.equal(app.pid, null); assert.equal(app.pgid, null);
  } finally { await f.close(); }
});
test('active scope followed by launcher exit without marker fails', async () => {
  const f = await fixture(); try { await f.call('start'); await f.configure({ launch: 'fail', active: true }); assert.equal((await f.call('run', ['--', 'app'])).status, 422); } finally { await f.close(); }
});
test('stopping during handover fences failure and stops app scope', async () => {
  const f = await fixture(); try {
    await f.call('start'); await f.configure({ launch: 'hang' }); f.service.screens.handoverMs = 1000;
    const pending = f.call('run', ['--', 'app']); await waitForCall(f, c => c.name === 'systemd-run' && c.args.includes('app'));
    f.a.status = 'stopped'; f.service.screens.killSession(f.a.name); assert.equal((await pending).status, 409);
    assert((await f.calls()).some(c => c.name === 'systemctl' && c.args.includes('stop') && c.args.some(a => /-app1\.scope$/.test(a))));
  } finally { await f.close(); }
});
test('removed failure log falls back and archive does not recreate directory', async () => {
  const f = await fixture(); try {
    await f.call('start'); await f.configure({ launch: 'hang' }); f.service.screens.handoverMs = 1000;
    const pending = f.call('run', ['--', 'app']); await waitForCall(f, c => c.name === 'systemd-run' && c.args.includes('app'));
    await f.service.archive('thread'); assert.equal((await pending).status, 409);
    assert.equal(fs.existsSync(path.join(f.service.screens.root, 'thread')), false);
  } finally { await f.close(); }
});
test('unreadable failure log uses launcher fallback reason', async () => {
  const f = await fixture(); try {
    await f.call('start'); await f.configure({ launch: 'fail' }); const m = f.service.screens, immediate = m.immediate;
    m.immediate = function(unit) { immediate.call(this, unit); fs.unlinkSync(path.join(m.dir(f.a), 'app-1.log')); };
    const result = await f.call('run', ['--', 'app']); assert.equal(result.status, 422); assert.match(result.body.error, /app did not start: systemd-run exited 1/);
  } finally { await f.close(); }
});

async function enableWm(f) {
  for (const name of ['openbox', 'xprop']) await fsp.copyFile(path.join(f.bin, 'app'), path.join(f.bin, name));
  f.service.screens.allowOpenbox = true;
}
test('optional window manager detection requires both tools', async () => {
  const f = await fixture(); try {
    assert.equal(screenTools(f.bin).openboxInstalled, false);
    await fsp.copyFile(path.join(f.bin, 'app'), path.join(f.bin, 'openbox'));
    assert.equal(screenTools(f.bin).openboxInstalled, false);
    await fsp.copyFile(path.join(f.bin, 'app'), path.join(f.bin, 'xprop'));
    assert.equal(screenTools(f.bin).openboxInstalled, true);
    await fsp.unlink(path.join(f.bin, 'openbox')); assert.equal(screenTools(f.bin).openboxInstalled, false);
  } finally { await f.close(); }
});
test('openbox starts with isolated click-only config and drives windows', async () => {
  const f = await fixture(); try {
    await enableWm(f); await f.configure({showWindow:true});
    assert.equal((await f.call('start')).status, 200);
    assert.equal((await f.call('status')).body.window_manager, 'openbox');
    const dir = f.service.screens.dir(f.a), config = path.join(dir, 'openbox', 'rc.xml');
    const xml = await fsp.readFile(config, 'utf8');
    assert.equal((await fsp.stat(path.dirname(config))).mode & 0o777, 0o700); assert.equal((await fsp.stat(config)).mode & 0o777, 0o600);
    assert.match(xml, /<keyboard\/>/); assert.deepEqual([...xml.matchAll(/<context name="([^"]+)"/g)].map(m => m[1]), ['Client', 'Frame']); assert.doesNotMatch(xml, /Execute|ShowMenu|<menu\b|name="Root"/); assert.match(xml, /<application class="\*"><decor>no<\/decor>/);
    assert.deepEqual([...xml.matchAll(/<action name="([^"]+)"/g)].map(m => m[1]), Array(6).fill(['Focus','Raise']).flat());
    const run = await f.call('run', ['--', 'app']); assert.equal(run.status, 200); assert.equal(run.body.focused.id, 0x200001);
    assert.equal((await f.call('windows')).body.windows[0].id, 0x200001); assert.equal((await f.call('focus', ['2097153'])).status, 200);
    const calls = await f.calls(), ob = calls.find(c => c.name === 'openbox');
    assert.deepEqual(ob.args, ['--sm-disable','--config-file',config]); assert.equal(ob.home, dir); assert.equal(ob.xdgHome, dir); assert.equal(ob.xdgDirs, dir);
    assert(calls.some(c => c.name === 'systemd-run' && c.args.some(a => /-wm\.scope$/.test(a))));
    assert(calls.filter(c => c.name === 'xdotool' && c.args[0] === 'windowactivate').length >= 2);
    assert(!calls.some(c => c.name === 'xdotool' && c.args.includes('--sync')));
  } finally { f.service.screens.killSession(f.a.name); await f.close(); }
});
for (const wmPath of ['missing','wrong']) test(`openbox falls back when config path is ${wmPath}`, async () => {
  const f = await fixture(); try { await enableWm(f); await f.configure({wmPath}); const start = Date.now(); assert.equal((await f.call('start')).status, 200); assert(Date.now()-start < 7000); assert.equal((await f.call('status')).body.window_manager, null); assert((await f.calls()).some(c => c.name === 'systemctl' && c.args.some(a => /-wm\.scope$/.test(a)))); } finally { f.service.screens.killSession(f.a.name); await f.close(); }
});
test('exited openbox leaves screen running', async () => { const f = await fixture(); try { await enableWm(f); await f.configure({wmExit:true}); assert.equal((await f.call('start')).status,200); assert.equal((await f.call('status')).body.window_manager,null); } finally { f.service.screens.killSession(f.a.name); await f.close(); } });
test('stopping session during openbox readiness fences the save', async () => { const f = await fixture(); try { await enableWm(f); await f.configure({wmPath:'missing'}); const start = f.call('start'); await waitForCall(f,c=>c.name==='xprop'); f.a.status='stopped'; f.service.screens.killSession(f.a.name); assert.equal((await start).status,409); assert.notEqual(JSON.parse(await fsp.readFile(path.join(f.service.screens.dir(f.a),'state.json'),'utf8')).status,'running'); } finally { await f.close(); } });
test('disabled openbox preserves root listing and direct focus', async () => { const f = await fixture(); try { await enableWm(f); f.service.screens.allowOpenbox=false; await f.configure({showWindow:true}); await f.call('start'); await f.call('run',['--','app']); await f.call('windows'); await f.call('focus',['2097153']); assert.equal((await f.call('status')).body.window_manager,null); const calls=await f.calls(); assert(!calls.some(c=>c.name==='openbox')); assert(calls.some(c=>c.name==='xwininfo' && c.args.includes('-root'))); assert(calls.some(c=>c.name==='xdotool' && c.args[0]==='windowfocus')); } finally { f.service.screens.killSession(f.a.name); await f.close(); } });
test('openbox not on PATH keeps today\'s window handling', async t => {
  const f = await fixture(); try {
    f.service.screens.allowOpenbox = true;
    process.env.PATH = [f.bin, path.dirname(process.execPath), '/usr/bin', '/bin'].join(path.delimiter);
    if (screenTools().openboxInstalled) { t.skip('openbox installed on host'); return; }
    await f.configure({ showWindow: true });
    assert.equal((await f.call('start')).status, 200);
    assert.equal((await f.call('status')).body.window_manager, null);
    await f.call('run', ['--', 'app']); await f.call('focus', ['2097153']);
    const calls = await f.calls();
    assert(!calls.some(c => c.name === 'openbox'));
    assert(!calls.some(c => c.name === 'systemd-run' && c.args.some(a => /-wm\.scope$/.test(a))));
    assert(calls.some(c => c.name === 'xwininfo' && c.args.includes('-root')));
    const runIndex = calls.findIndex(c => c.name === 'systemd-run' && c.args.some(a => /-app[0-9]+\.scope$/.test(a)));
    const focusIndex = calls.findIndex((c, i) => i > runIndex && c.name === 'xdotool' && c.args[0] === 'windowfocus');
    assert(runIndex >= 0 && focusIndex > runIndex);
  } finally { f.service.screens.killSession(f.a.name); await f.close(); }
});
