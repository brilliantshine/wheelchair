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
test('screen launch wraps only sandboxed Codex for every CLI', async () => {
  const f = await fixture();
  try {
    for (const [cli, mode, wrapped] of [['claude', undefined, false], ['codex', 'sandboxed', true], ['codex', 'unrestricted', false], ['agy', undefined, false], ['kimi', undefined, false], ['pi', undefined, false]]) {
      f.a.cli = cli; f.a.codex_mode = mode;
      const value = `${cli}-${mode || 'default'}`;
      const result = await f.call('run', ['--env', `CASE=${value}`, '--', 'app']);
      assert.equal(result.status, 200, JSON.stringify(result));
      const call = await waitForCall(f, c => c.name === 'systemd-run' && c.args.includes(`CASE=${value}`));
      const suffix = call.args.slice(call.args.indexOf(`CASE=${value}`) - 2);
      assert.deepEqual(suffix, ['env', '--', `CASE=${value}`, 'app']);
      const index = call.args.indexOf('codex');
      if (wrapped) assert.deepEqual(call.args.slice(index, -4), ['codex', 'sandbox', '-c', 'sandbox_mode="workspace-write"', '-c', 'sandbox_workspace_write.network_access=true', '--']);
      else assert.equal(index, -1, value);
    }
  } finally { f.service.screens.killSession(f.a.name); await f.close(); }
});
