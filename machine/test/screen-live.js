'use strict';
// Live screen check. Started by screen-live.sh with the Chromium path as argv[2].
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { makeTemp } = require('../../test-support/run-dir');
const { MachineService } = require('../service');

const chrome = process.argv[2];
const wc = path.join(__dirname, '..', '..', 'viewer', 'app', 'wc.js');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let ok = 0, bad = 0;
function check(name, pass, detail) {
  if (pass) { ok++; console.log(`ok - ${name}`); } else { bad++; console.log(`not ok - ${name}${detail === undefined ? '' : `: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`); }
}
const ctl = (...args) => spawnSync('systemctl', ['--user', ...args], { encoding: 'utf8', timeout: 10000 });

let ctx = null; // { root, stateDir, service, server, env, slicePrefix }
// The service runs in this process, so every call that waits on it must be async.
function client(args, timeout = 60000) {
  return new Promise(resolve => {
    const child = spawn('node', [wc, 'screen', ...args], { env: ctx.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.stdout.on('data', c => { out += c; }); child.stderr.on('data', c => { err += c; });
    child.on('close', status => { clearTimeout(timer); let body = null; try { body = JSON.parse(out); } catch { /* not json */ } resolve({ status, out, err, body }); });
  });
}
function cgroupPids(unit) {
  const cg = ctl('show', '-p', 'ControlGroup', '--value', unit).stdout.trim();
  if (!cg) return [];
  try { return fs.readFileSync(`/sys/fs/cgroup${cg}/cgroup.procs`, 'utf8').split('\n').filter(Boolean).map(Number); } catch { return []; }
}
function cmdline(pid) { try { return fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean); } catch { return []; }
}
function leftovers() { return ctl('list-units', '--all', '--no-legend', `${ctx.slicePrefix}*`).stdout.trim(); }

let cleaned = false;
async function cleanup() {
  if (cleaned || !ctx) return; cleaned = true;
  try { await client(['stop'], 15000); } catch { /* backstop below */ }
  try { ctx.service.screens.stopTimers(); await new Promise(resolve => ctx.server.close(resolve)); } catch { /* backstop below */ }
  cleanupSync();
}
function cleanupSync() {
  if (!ctx) return;
  // Backstop: only slices of this test's own state dir, found by its hash.
  const units = ctl('list-units', '--all', '--no-legend', '--plain', `${ctx.slicePrefix}*`).stdout.split('\n').map(l => l.trim().split(/\s+/)[0]).filter(u => u && u.startsWith(ctx.slicePrefix));
  for (const unit of units) { if (unit.endsWith('.slice')) { ctl('kill', '--signal=SIGKILL', unit); ctl('stop', unit); } }
  for (const unit of units) if (unit.endsWith('.scope')) { ctl('kill', '--signal=SIGKILL', unit); ctl('stop', unit); }
}
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { try { cleanupSync(); } finally { process.exit(130); } });
process.on('exit', () => { try { cleanupSync(); } catch { /* nothing more to do */ } });

async function main() {
  const root = await makeTemp('wheelchair-screen-live-'); const bin = path.join(root, 'bin'); await fsp.mkdir(bin);
  const stateDir = path.join(root, 'state'); await fsp.mkdir(stateDir, { recursive: true });
  const pane = path.join(root, 'pane'); const sessions = path.join(root, 'sessions');
  await fsp.writeFile(pane, 'auto mode on\n❯ Try anything\n'); await fsp.writeFile(sessions, '');
  // Only tmux and the agent CLI are fake; every screen tool is the real one.
  const fake = `#!/usr/bin/env bash
case "$(basename "$0"):$1" in
  tmux:capture-pane) cat "$LIVE_PANE" ;;
  tmux:list-sessions) cat "$LIVE_SESSIONS" ;;
  claude:--version) echo claude-test ;;
  claude:auth) echo '{"loggedIn":true}' ;;
esac
exit 0
`;
  for (const name of ['tmux', 'claude']) await fsp.writeFile(path.join(bin, name), fake, { mode: 0o755 });
  const secret = path.join(root, 'secret'); await fsp.writeFile(secret, 'live-secret\n', { mode: 0o600 });
  const worktree = path.join(root, 'work'); await fsp.mkdir(worktree);
  const profile = path.join(root, 'chrome-profile'); await fsp.mkdir(profile);
  const listen = await new Promise(resolve => { const s = http.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
  await fsp.writeFile(path.join(stateDir, 'machine.json'), JSON.stringify({ secret_file: secret, host: '127.0.0.1', port: listen }));
  process.env.PATH = `${bin}:${process.env.PATH}`; process.env.LIVE_PANE = pane; process.env.LIVE_SESSIONS = sessions;
  const service = new MachineService({ stateDir, host: '127.0.0.1', port: listen });
  await service.listen();
  const slicePrefix = `wcscreen-${crypto.createHash('sha256').update(service.stateDir).digest('hex').slice(0, 12)}`;
  ctx = { root, stateDir, service, server: service.server, slicePrefix, env: null };
  const base = `http://127.0.0.1:${listen}`;
  const res = await fetch(`${base}/v1/sessions`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-wheelchair-machine-secret': 'live-secret' }, body: JSON.stringify({ role: 'worker', cli: 'claude', thread_id: 'live', token: 'live-token', worktree }) });
  const made = await res.json(); if (res.status !== 201) throw new Error(`session start ${res.status} ${JSON.stringify(made)}`);
  await fsp.writeFile(sessions, `${made.name || made.session?.name || 'wc-live-worker'}\n`);
  ctx.env = { ...process.env, WHEELCHAIR_MACHINE_URL: `${base}/v1/agent`, WHEELCHAIR_SESSION_TOKEN: 'live-token' };
  console.log(`# state dir ${stateDir}; slice prefix ${slicePrefix}`);

  const page = '<title>clicks=0 len=0</title><body style="margin:0"><button id=b style="position:fixed;left:0;top:0;width:100%;height:70%;font-size:40px">go</button><input id=t autofocus style="position:fixed;left:0;bottom:0;width:100%;height:20%"><script>var c=0;function u(){document.title="clicks="+c+" len="+document.getElementById("t").value.length}document.getElementById("b").onclick=function(){c++;u();document.getElementById("t").focus()};document.getElementById("t").oninput=u</script></body>';
  const shotDir = path.join(stateDir, 'screens', 'live');

  const started = await client(['start', '--size', '1280x800']); check('start succeeds', started.status === 0 && started.body?.ok, started.err || started.out);
  const t0 = Date.now();
  const run1 = await client(['run', '--', chrome, `--app=data:text/html,${encodeURIComponent(page)}`, `--user-data-dir=${profile}`, '--window-position=0,0', '--window-size=900,600', '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--no-sandbox']);
  check('run chromium succeeds', run1.status === 0 && run1.body?.ok, run1.err || run1.out);
  const win1 = run1.body?.focused?.id; const t1 = Date.now() - t0;
  async function windows() { const r = await client(['windows']); return r.body?.windows || []; }
  let first = null; for (let i = 0; i < 30 && !first; i++) { first = (await windows()).find(w => w.id === win1 && /clicks=/.test(w.name)); if (!first) await delay(500); }
  check('run chromium reports focused as its own window', typeof win1 === 'number' && !!first, { focused: run1.body?.focused, elapsedMs: t1, windows: await windows() });
  const run2 = await client(['run', '--', 'xmessage', '-name', 'wcmsg', 'literal $HOME here']);
  check('run xmessage succeeds', run2.status === 0 && run2.body?.ok, run2.err || run2.out);
  const win2 = run2.body?.focused?.id;
  check('run xmessage reports focused as its own window, not the first', typeof win2 === 'number' && win2 !== win1, run2.body);

  // Clear the second window's name directly, with the screen's own display and cookie.
  const dirs = fs.readdirSync(shotDir); const sdir = path.join(shotDir, dirs[0]);
  const xenv = { ...process.env, DISPLAY: started.body?.display, XAUTHORITY: path.join(sdir, 'xauth') };
  const cleared = spawnSync('xdotool', ['set_window', '--name', '', String(win2)], { env: xenv, encoding: 'utf8', timeout: 10000 });
  check('xdotool clears the xmessage window name', cleared.status === 0, cleared.stderr);
  await delay(300);
  const listed = await windows();
  check('windows lists exactly the two top-level windows by id', listed.length === 2 && listed.some(w => w.id === win1) && listed.some(w => w.id === win2), listed);
  check('the second window has name ""', listed.find(w => w.id === win2)?.name === '', listed);

  // $HOME stays literal: read the xmessage process argv from the app scope.
  const apps = (await client(['status'])).body?.apps || [];
  const state = JSON.parse(fs.readFileSync(path.join(sdir, 'state.json'), 'utf8'));
  const unit2 = state.apps.find(a => a.n === run2.body?.app)?.unit;
  const argvs = cgroupPids(unit2).map(cmdline);
  check('xmessage argument with $HOME arrived unexpanded', argvs.some(a => a.includes('literal $HOME here')), { unit2, argvs, apps });

  // Pointer and keyboard on the Chromium window.
  const g = listed.find(w => w.id === win1);
  const click = await client(['click', String(g.x + Math.floor(g.width / 2)), String(g.y + Math.floor(g.height / 3))]);
  let title = ''; for (let i = 0; i < 20; i++) { title = (await windows()).find(w => w.id === win1)?.name || ''; if (/clicks=1/.test(title)) break; await delay(250); }
  check('click on the button changes the first window title', click.status === 0 && /clicks=1/.test(title), { click: click.out || click.err, title });
  const text = 'abcdefghij'.repeat(40);
  const typed = await client(['type', text], 90000);
  for (let i = 0; i < 40; i++) { title = (await windows()).find(w => w.id === win1)?.name || ''; if (/len=400/.test(title)) break; await delay(500); }
  check('type of 400 characters arrives whole', typed.status === 0 && /len=400\b/.test(title), { typed: typed.out || typed.err, title });

  // Full-screen shot showing both windows, copied to a stable path.
  const shot = await client(['shot']); const shotPath = shot.body?.path;
  const png = shotPath && fs.existsSync(shotPath) ? fs.readFileSync(shotPath) : Buffer.alloc(0);
  check('shot PNG exists, is non-empty and is a PNG', png.length > 100 && png.subarray(1, 4).toString() === 'PNG', shot.body || shot.err);
  const keep = process.env.LIVE_SHOT || path.join(process.env.TMPDIR || '/tmp', 'screen-live-shot.png');
  if (png.length) { fs.mkdirSync(path.dirname(keep), { recursive: true }); fs.writeFileSync(keep, png); console.log(`screenshot: ${keep}`); }

  // A client without the cookie is refused.
  const noCookie = spawnSync('xwininfo', ['-root'], { env: { ...process.env, DISPLAY: started.body?.display, XAUTHORITY: '/dev/null' }, encoding: 'utf8', timeout: 10000 });
  check('an X client without the cookie is refused', noCookie.status !== 0 && /unable to open display|No protocol|authorization/i.test(noCookie.stderr), { status: noCookie.status, stderr: noCookie.stderr });
  const withCookie = spawnSync('xwininfo', ['-root'], { env: xenv, encoding: 'utf8', timeout: 10000 });
  check('the same client with the cookie is accepted', withCookie.status === 0, withCookie.stderr);

  // A child that clears its environment and outlives its parent.
  const run3 = await client(['run', '--', 'sh', '-c', 'env -i sleep 300 & exit 0']);
  check('run of the env-clearing child launcher succeeds', run3.status === 0 && run3.body?.ok, run3.err || run3.out);
  await delay(500);
  const state3 = JSON.parse(fs.readFileSync(path.join(sdir, 'state.json'), 'utf8'));
  const unit3 = state3.apps.find(a => a.n === run3.body?.app)?.unit;
  const sleepers = cgroupPids(unit3).filter(p => cmdline(p)[0] === 'sleep' && cmdline(p)[1] === '300');
  check('the env-clearing child is alive before stop', sleepers.length === 1, { unit3, sleepers });
  const slice = `${path.basename(unit3 || '').replace(/-app\d+\.scope$/, '')}.slice`;
  const allPids = [...new Set([...cgroupPids(slice), ...(state3.apps || []).flatMap(a => cgroupPids(a.unit))])];
  check('the slice holds processes before stop', allPids.length > 0, { slice });

  const stop = await client(['stop']); check('stop succeeds', stop.status === 0, stop.err || stop.out);
  let gone = false; for (let i = 0; i < 30 && !gone; i++) { gone = !sleepers.some(p => fs.existsSync(`/proc/${p}`) && !/^Z/.test((fs.readFileSync(`/proc/${p}/stat`, 'utf8').split(') ')[1] || ''))); if (!gone) await delay(250); }
  check('the env-clearing child is gone after stop', gone, sleepers);
  let empty = false; for (let i = 0; i < 30 && !empty; i++) { empty = cgroupPids(slice).length === 0; if (!empty) await delay(250); }
  check('after stop the screen slice has no processes', empty, cgroupPids(slice));
  const chromeLeft = allPids.filter(p => fs.existsSync(`/proc/${p}`) && !/^Z/.test((fs.readFileSync(`/proc/${p}/stat`, 'utf8').split(') ')[1] || '')));
  check('no process from the screen survives stop', chromeLeft.length === 0, chromeLeft.map(p => [p, cmdline(p).slice(0, 2)]));
}

(async () => {
  try { await main(); } catch (e) { check('script ran to the end', false, e.stack || String(e)); }
  await cleanup();
  await delay(1500);
  cleanupSync(); await delay(500);
  if (ctx) check('no wcscreen unit of this test is left', leftovers() === '', leftovers());
  console.log(`live: ${ok} ok, ${bad} failed`);
  process.exit(bad ? 1 : 0);
})();
