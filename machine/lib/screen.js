'use strict';
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const connectors = require('../../connectors');
const adapters = Object.fromEntries(connectors.list().map(m => [m.cli, connectors.machine(m.cli)]));
const { parseOp } = require('./screen-args');

// Keep in step with the screen tool list in install.sh.
const TOOLS = ['Xvfb', 'xauth', 'mcookie', 'ffmpeg', 'xdotool', 'xwininfo', 'systemd-run', 'systemctl'];
const KEEP_SHOTS = 50;
const LOCKED = 'keys may still be held; run wc.js screen stop';
const error = (status, message) => Object.assign(new Error(message), { status });
const hash = value => crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function executable(file) {
  try { return fs.statSync(file).isFile() && (fs.accessSync(file, fs.constants.X_OK), true); } catch { return false; }
}
function findCommand(word, cwd, searchPath) {
  if (word.includes('/')) return executable(path.resolve(cwd, word));
  return (searchPath || '').split(path.delimiter).some(dir => executable(path.resolve(cwd, dir || '.', word)));
}
function screenTools(searchPath = process.env.PATH) {
  return { missing: TOOLS.filter(name => !findCommand(name, process.cwd(), searchPath)), openboxInstalled: ['openbox', 'xprop'].every(name => findCommand(name, process.cwd(), searchPath)) };
}
function run(cmd, args, { env = process.env, timeout = 10000 } = {}) {
  return new Promise(resolve => {
    let child, stdout = '', stderr = '', done = false, timedOut = false;
    const finish = (code) => { if (done) return; done = true; clearTimeout(timer); resolve({ ok: code === 0 && !timedOut, code, stdout, stderr, timedOut }); };
    try { child = spawn(cmd, args, { env, stdio: ['ignore', 'pipe', 'pipe'] }); } catch { return resolve({ ok: false, stdout: '', stderr: '' }); }
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); finish(null); }, timeout);
    child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', e => { stderr += e.message; finish(null); }); child.on('close', finish);
  });
}
class ScreenManager {
  constructor(service) {
    this.service = service; this.root = path.join(service.stateDir, 'screens'); this.prefix = `wcscreen-${hash(service.stateDir)}`;
    this.maxScreens = 8; this.handoverMs = 5000; this.allowOpenbox = true;
    this.screens = new Map(); this.queues = new Map(); this.timers = new Set(); this.version = null;
  }
  dir(session) { return path.join(this.root, session.thread_id, session.name); }
  slice(screen) { return `${screen.base}.slice`; }
  unit(screen, suffix) { return `${screen.base}-${suffix}.scope`; }
  save(screen) {
    fs.mkdirSync(screen.dir, { recursive: true, mode: 0o700 });
    const file = path.join(screen.dir, 'state.json'); const tmp = `${file}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(screen.state)}\n`, { mode: 0o600 }); fs.renameSync(tmp, file);
  }
  trySave(screen) { try { this.save(screen); } catch (e) { this.service.log(e); } }
  load(session) {
    const dir = this.dir(session); let state = {};
    try { state = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    let files = []; try { files = fs.readdirSync(dir); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    const next = kind => Math.max(1, ...files.map(f => Number(new RegExp(`^${kind}-(\\d+)\\.${kind === 'shot' ? 'png' : 'log'}$`).exec(f)?.[1] || 0) + 1));
    state = { generation: 0, status: 'none', display: null, size: null, xvfb_pid: null, next_shot: 1, next_app: 1, apps: [], input_locked: false, window_manager: null, ...state };
    state.next_shot = Math.max(state.next_shot, next('shot')); state.next_app = Math.max(state.next_app, next('app'));
    return { name: session.name, thread: session.thread_id, dir, state, base: `${this.prefix}-${session.thread_id}-${hash(session.name)}g${state.generation}` };
  }
  reset(screen) {
    screen.state.generation++; screen.state.status = 'none'; screen.state.display = null; screen.state.size = null; screen.state.xvfb_pid = null; screen.state.apps = []; screen.state.input_locked = false; screen.state.window_manager = null;
    try { this.trySave(screen); try { fs.unlinkSync(path.join(screen.dir, 'xauth')); } catch (e) { if (e.code !== 'ENOENT') this.service.log(e); } }
    finally { if (this.screens.get(screen.name) === screen) this.screens.delete(screen.name); }
  }
  immediate(slice) {
    const end = Date.now() + 1000;
    for (const args of [['kill', '--signal=SIGKILL', slice], ['stop', '--no-block', slice]]) {
      const left = end - Date.now(); if (left <= 0) { this.service.log(`screen teardown timed out: ${slice}`); break; }
      const result = spawnSync('systemctl', ['--user', ...args], { timeout: left, stdio: 'ignore' });
      if (result.error || result.status !== 0) this.service.log(`screen teardown failed: ${slice}`);
    }
  }
  killSession(name) { const screen = this.screens.get(name); if (!screen) return; this.immediate(this.slice(screen)); try { this.reset(screen); } catch (e) { this.service.log(e); } }
  killThread(thread) {
    this.immediate(`${this.prefix}-${thread}.slice`);
    for (const screen of [...this.screens.values()]) if (screen.thread === thread) { try { this.reset(screen); } catch (e) { this.service.log(e); } }
  }
  async removeThreadDir(thread) { try { await fsp.rm(path.join(this.root, thread), { recursive: true, force: true }); } catch (e) { this.service.log(e); } }
  async ctl(args, timeout = 1000) { return run('systemctl', ['--user', ...args], { timeout }); }
  async startup() {
    try {
      const end = Date.now() + 2000;
      for (const args of [['kill', '--signal=SIGKILL', `${this.prefix}.slice`], ['stop', '--no-block', `${this.prefix}.slice`]]) {
        const left = end - Date.now(); if (left <= 0) break;
        const result = await this.ctl(args, left); if (!result.ok) this.service.log(`screen startup cleanup failed: ${this.prefix}.slice`);
      }
      let threads = []; try { threads = await fsp.readdir(this.root, { withFileTypes: true }); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      for (const thread of threads) if (thread.isDirectory()) {
        const entries = await fsp.readdir(path.join(this.root, thread.name), { withFileTypes: true });
        for (const entry of entries) if (entry.isDirectory()) {
          const session = { name: entry.name, thread_id: thread.name };
          if (!fs.existsSync(path.join(this.dir(session), 'state.json'))) continue;
          try { const s = this.load(session); this.reset(s); } catch (e) { this.service.log(e); }
        }
      }
    } catch (e) { this.service.log(e); }
  }
  stopTimers() { for (const timer of this.timers) clearTimeout(timer); this.timers.clear(); }
  async gracefulSlice(slice) {
    const term = await this.ctl(['kill', '--signal=SIGTERM', slice]); if (!term.ok) this.service.log(`screen SIGTERM failed: ${slice}`);
    const timer = setTimeout(async () => { this.timers.delete(timer); await this.ctl(['kill', '--signal=SIGKILL', slice]); await this.ctl(['stop', slice]); }, 3000);
    timer.unref(); this.timers.add(timer);
  }
  async teardown(screen) { const slice = this.slice(screen); this.reset(screen); await this.gracefulSlice(slice); }
  async sweep() {
    const live = this.service.liveTmux();
    if (live !== null) for (const screen of [...this.screens.values()]) if (!live.has(screen.name)) await this.teardown(screen);
    const result = await this.ctl(['list-units', '--all', `${this.prefix}-*`]); if (!result.ok) return;
    const held = new Set([...this.screens.values()].map(s => this.slice(s)));
    const names = new Set((result.stdout.match(/wcscreen-[A-Za-z0-9_.-]+\.slice/g) || []).filter(n => n.startsWith(`${this.prefix}-`) && /g\d+\.slice$/.test(n)));
    for (const name of names) if (!held.has(name)) await this.gracefulSlice(name);
  }
  check(session, checkTmux = false) {
    const current = this.service.sessions[session.name];
    if (!current || current !== session || current.status === 'stopped' || this.service.archivingThreads.has(session.thread_id) || this.service.archivedThreads?.has(session.thread_id) || this.service.closingThreads.has(session.thread_id)) throw error(409, 'session stopped or thread archived');
    if (checkTmux) {
      const live = this.service.liveTmux(); if (live === null) throw error(422, 'could not check the session; try again');
      if (!live.has(session.name)) { this.killSession(session.name); throw error(409, 'session is not running'); }
    }
  }
  fence(session, screen, generation) {
    this.check(session); if (this.screens.get(session.name) !== screen || screen.state.generation !== generation) throw error(409, 'session stopped or thread archived');
  }
  async scopeActive(unit) { const result = await this.ctl(['show', '--property=ActiveState', '--value', unit]); return result.ok && result.stdout.trim() === 'active'; }
  async versionFlag() {
    if (!this.version) this.version = run('systemd-run', ['--version'], { timeout: 1000 }).then(r => Number(/\d+/.exec(r.stdout)?.[0] || 0) >= 254);
    return await this.version ? ['--expand-environment=no'] : [];
  }
  async scopeArgs(screen, suffix) { return ['--user', '--scope', '--quiet', ...await this.versionFlag(), `--slice=${this.slice(screen)}`, `--unit=${this.unit(screen, suffix)}`, '--']; }
  async registered(child, unit, displayPromise) {
    let exited = false; child.once('exit', () => { exited = true; }); child.once('error', () => { exited = true; });
    const end = Date.now() + 3000;
    while (Date.now() < end && !exited) {
      if (displayPromise?.received || await this.scopeActive(unit)) return;
      await delay(50);
    }
  }
  async start(session, size) {
    let existing = this.screens.get(session.name);
    if (existing && existing.state.status === 'running') { if (await this.scopeActive(this.unit(existing, 'x'))) return existing; await this.teardown(existing); }
    const { missing } = screenTools();
    if (missing.length) throw error(422, `missing on this machine: ${missing.join(', ')}`);
    const reachable = await this.ctl(['list-units', '--all', `${this.prefix}-*`]);
    if (!reachable.ok) throw error(422, 'screens need a systemd user session on this machine');
    this.check(session, true);
    if (this.screens.size >= this.maxScreens) throw error(422, `screen limit reached: ${this.screens.size} screens running on this machine (limit ${this.maxScreens}); try again later`);
    const screen = this.load(session); screen.state.generation++; screen.state.status = 'starting'; screen.state.size = size; screen.state.display = null; screen.state.apps = []; screen.state.input_locked = false; screen.state.window_manager = null;
    screen.base = `${this.prefix}-${session.thread_id}-${hash(session.name)}g${screen.state.generation}`; this.screens.set(session.name, screen);
    try { this.save(screen); } catch (e) { if (this.screens.get(session.name) === screen) this.screens.delete(session.name); throw e; }
    const generation = screen.state.generation, cookieFile = path.join(screen.dir, 'xauth'); let child, wm;
    try {
      const cookie = await run('mcookie', [], { timeout: 10000 }); if (!cookie.ok || !cookie.stdout.trim()) throw error(422, 'screen did not start');
      this.fence(session, screen, generation);
      fs.writeFileSync(cookieFile, '', { mode: 0o600 }); fs.chmodSync(cookieFile, 0o600);
      let result = await run('xauth', ['-f', cookieFile, 'add', ':0', '.', cookie.stdout.trim()]); if (!result.ok) throw error(422, 'screen did not start');
      this.fence(session, screen, generation);
      const args = [...await this.scopeArgs(screen, 'x'), 'Xvfb', '-displayfd', '3', '-auth', cookieFile, '-screen', '0', `${size.width}x${size.height}x24`, '-nolisten', 'tcp'];
      this.fence(session, screen, generation);
      child = spawn('systemd-run', args, { stdio: ['ignore', 'ignore', 'ignore', 'pipe'] });
      let received = false;
      const display = new Promise(resolve => {
        let data = '', done = false; const finish = value => { if (done) return; done = true; clearTimeout(timer); resolve(value); };
        const timer = setTimeout(() => finish(null), 10000);
        child.stdio[3].on('data', b => { data += b; if (/^\d+\s/.test(data)) { received = true; finish(data.trim()); } });
        child.on('error', () => finish(null)); child.on('exit', () => finish(null));
      });
      const marker = { get received() { return received; } };
      await this.registered(child, this.unit(screen, 'x'), marker);
      try { this.fence(session, screen, generation); } catch (e) { this.immediate(this.unit(screen, 'x')); throw e; }
      const number = await display;
      this.fence(session, screen, generation);
      if (number === null || !/^\d+$/.test(number)) throw error(422, 'screen did not start');
      result = await run('xauth', ['-f', cookieFile, 'add', `:${number}`, '.', cookie.stdout.trim()]); if (!result.ok) throw error(422, 'screen did not start');
      this.fence(session, screen, generation);
      screen.state.display = `:${number}`;
      if (this.allowOpenbox && screenTools().openboxInstalled) {
        const configDir = path.join(screen.dir, 'openbox'), config = path.join(configDir, 'rc.xml');
        try {
          fs.mkdirSync(configDir, { recursive: true, mode: 0o700 }); fs.chmodSync(configDir, 0o700);
          const bindings = ['Client', 'Frame'].map(context => `<context name="${context}">${['Left', 'Middle', 'Right'].map(button => `<mousebind button="${button}" action="Press"><action name="Focus"/><action name="Raise"/></mousebind>`).join('')}</context>`).join('');
          fs.writeFileSync(config, `<?xml version="1.0" encoding="UTF-8"?><openbox_config xmlns="http://openbox.org/3.4/rc"><keyboard/><mouse>${bindings}</mouse><applications><application class="*"><decor>no</decor></application></applications></openbox_config>`, { mode: 0o600 }); fs.chmodSync(config, 0o600);
          const args = [...await this.scopeArgs(screen, 'wm'), 'openbox', '--sm-disable', '--config-file', config];
          this.fence(session, screen, generation);
          const fd = fs.openSync(path.join(screen.dir, 'wm.log'), 'a', 0o600); let exited = false;
          const env = { ...process.env, DISPLAY: screen.state.display, XAUTHORITY: cookieFile, XDG_CONFIG_HOME: screen.dir, XDG_CONFIG_DIRS: screen.dir, HOME: screen.dir };
          try { wm = spawn('systemd-run', args, { env, stdio: ['ignore', fd, fd] }); wm.once('exit', () => { exited = true; }); wm.once('error', () => { exited = true; }); } finally { fs.closeSync(fd); }
          const end = Date.now() + 5000; let ready = false;
          while (!exited && Date.now() < end) {
            const probe = await run('xprop', ['-root', '_OB_CONFIG_FILE'], { env, timeout: Math.min(1000, end - Date.now()) });
            if (!exited && probe.ok && probe.stdout.trim() === `_OB_CONFIG_FILE(UTF8_STRING) = "${config}"`) { ready = true; break; }
            if (!exited && Date.now() < end) await delay(Math.min(100, end - Date.now()));
          }
          if (ready) screen.state.window_manager = 'openbox';
          else { if (!exited) wm.kill('SIGKILL'); this.immediate(this.unit(screen, 'wm')); this.service.log('screen openbox did not become ready'); }
        } catch (e) {
          if (wm) { wm.kill('SIGKILL'); this.immediate(this.unit(screen, 'wm')); }
          this.service.log(`screen openbox failed: ${e.message}`);
        }
      }
      this.fence(session, screen, generation);
      screen.state.xvfb_pid = child.pid; screen.state.status = 'running'; this.save(screen); return screen;
    } catch (e) {
      if (this.screens.get(session.name) === screen) await this.teardown(screen);
      else {
        if (child) this.immediate(this.unit(screen, 'x'));
        if (wm) this.immediate(this.unit(screen, 'wm'));
        throw error(409, 'session stopped or thread archived');
      }
      throw e.status ? e : error(422, 'screen did not start');
    }
  }
  async launch(session, screen, parsed) {
    const generation = screen.state.generation;
    const env = { ...process.env, ...Object.fromEntries(this.service.launchEnv(session, adapters[session.cli])) }; delete env.WHEELCHAIR_SESSION_TOKEN;
    env.DISPLAY = screen.state.display; env.XAUTHORITY = path.join(screen.dir, 'xauth');
    const appEnv = { ...env, ...Object.fromEntries(parsed.env) };
    if (!findCommand(parsed.command[0], session.worktree, appEnv.PATH)) throw error(422, `command not found: ${parsed.command[0]}`);
    const input = require('./screen-input'); const ctx = { env, openbox: screen.state.window_manager === 'openbox' }; const phaseStart = Date.now(); const baseline = await input.windowIds(ctx, { probeTimeoutMs: 1000, deadline: phaseStart + 6000 });
    this.fence(session, screen, generation);
    const n = screen.state.next_app++; const log = path.join(screen.dir, `app-${n}.log`); const unit = this.unit(screen, `app${n}`);
    const command = ['env', '--', ...parsed.env.map(([k, v]) => `${k}=${v}`), ...parsed.command];
    const inner = session.cli === 'codex' && session.codex_mode !== 'unrestricted' ? ['codex', 'sandbox', '-c', 'sandbox_mode="workspace-write"', '-c', 'sandbox_workspace_write.network_access=true', '--', ...command] : command;
    const marker = path.join(screen.dir, `app-${n}.started`);
    const args = [...await this.scopeArgs(screen, `app${n}`), 'sh', '-c', '(umask 077; : > "$0") || exit 127; exec "$@"', marker, ...inner]; this.fence(session, screen, generation);
    const app = { n, unit, log, command: parsed.command, pid: null, pgid: null }; screen.state.apps.push(app); this.save(screen);
    const fd = fs.openSync(log, 'a', 0o600); const logSize = fs.fstatSync(fd).size; let child, failure, exited = false;
    const deadline = Date.now() + this.handoverMs;
    try {
      child = spawn('systemd-run', args, { env, cwd: session.worktree, detached: true, stdio: ['ignore', fd, fd] });
      child.once('exit', (code, signal) => { exited = true; failure = `systemd-run exited ${signal || code}`; });
      child.once('error', e => { exited = true; failure = e.message; });
      // For Codex sessions this top process is the codex sandbox wrapper.
      app.pid = app.pgid = child.pid ?? null; this.trySave(screen); child.unref();
    } catch (e) { failure = e.message; exited = true; } finally { fs.closeSync(fd); }
    let handed = false, timedOut = false;
    for (;;) {
      if (fs.existsSync(marker)) { handed = true; break; }
      if (exited) break;
      if (Date.now() >= deadline) { timedOut = true; child.kill('SIGKILL'); break; }
      await delay(Math.min(50, Math.max(0, deadline - Date.now())));
    }
    if (!handed) {
      this.immediate(unit);
      this.fence(session, screen, generation);
      let reason = failure;
      if (timedOut) reason = `no hand-over within ${Math.round(this.handoverMs / 1000)} s`;
      else {
        try {
          const lines = fs.readFileSync(log).subarray(logSize).toString().split(/\r?\n/).filter(line => line.trim());
          reason = lines.filter(line => line.startsWith('Failed to')).at(-1) || lines.at(-1) || reason;
        } catch { /* The log may have been removed. */ }
      }
      app.failed = true; this.trySave(screen); throw error(422, `app did not start: ${reason}`);
    }
    try { this.fence(session, screen, generation); } catch (e) { this.immediate(unit); throw e; }
    const focused = await input.autoFocus(ctx, baseline, { startedAt: phaseStart }); this.fence(session, screen, generation);
    return { ok: true, app: n, log, focused };
  }
  async handle(session, body) {
    if (session.role === 'reviewer') throw error(403, 'reviewers cannot use screens');
    if (process.platform !== 'linux') throw error(422, 'screens only work on Linux machines for now');
    const op = body?.op, parsed = parseOp(op, body?.args);
    const prior = this.queues.get(session.name) || Promise.resolve();
    const task = prior.catch(() => {}).then(() => this.execute(session, op, parsed)); this.queues.set(session.name, task);
    try { return await task; } finally { if (this.queues.get(session.name) === task) this.queues.delete(session.name); }
  }
  async execute(session, op, parsed) {
    this.check(session, op === 'start' || op === 'run');
    let screen = this.screens.get(session.name);
    if (screen && screen.state.status === 'running' && !(await this.scopeActive(this.unit(screen, 'x')))) { await this.teardown(screen); screen = null; }
    if (op === 'start' || op === 'run') {
      screen = await this.start(session, op === 'start' ? parsed.size : { width: 1280, height: 800 });
      return op === 'start' ? { ok: true, display: screen.state.display, size: screen.state.size } : this.launch(session, screen, parsed);
    }
    if (op === 'stop') { if (screen) await this.teardown(screen); return { ok: true }; }
    if (op === 'status') {
      if (!screen) return { ok: true, running: false, window_manager: null };
      const apps = await Promise.all(screen.state.apps.map(async app => ({ n: app.n, state: !app.failed && await this.scopeActive(app.unit) ? 'running' : 'exited', log: app.log, pid: app.pid ?? null })));
      return { ok: true, running: true, display: screen.state.display, size: screen.state.size, apps, window_manager: screen.state.window_manager };
    }
    if (!screen) throw error(422, 'no screen; run wc.js screen start first');
    if (screen.state.input_locked && ['move', 'click', 'drag', 'type', 'key', 'focus'].includes(op)) throw error(422, LOCKED);
    const input = require('./screen-input'); const ctx = { env: { ...process.env, DISPLAY: screen.state.display, XAUTHORITY: path.join(screen.dir, 'xauth') }, openbox: screen.state.window_manager === 'openbox' }; const generation = screen.state.generation;
    let result;
    try {
      if (op === 'shot') { const n = screen.state.next_shot++; this.save(screen); result = { ok: true, ...await input.shot(ctx, { size: screen.state.size, window: parsed.window, outPath: path.join(screen.dir, `shot-${n}.png`) }) };
        try { const shots = fs.readdirSync(screen.dir).map(name => ({ name, match: /^shot-(\d+)\.png$/.exec(name) })).filter(item => item.match).sort((a, b) => Number(b.match[1]) - Number(a.match[1])); for (const item of shots.slice(KEEP_SHOTS)) fs.unlinkSync(path.join(screen.dir, item.name)); } catch (e) { this.service.log(e); }
      }
      else if (op === 'windows') result = { ok: true, windows: await input.listWindows(ctx) };
      else if (['move', 'click', 'drag'].includes(op)) result = await input.pointer(ctx, op, parsed);
      else if (op === 'type') result = await input.typeText(ctx, parsed.text);
      else if (op === 'key') result = await input.pressKeys(ctx, parsed);
      else if (op === 'focus') result = await input.focusWindow(ctx, parsed.window);
    } catch (e) { if (e.lockInput && this.screens.get(session.name) === screen) { screen.state.input_locked = true; this.save(screen); } throw e; }
    this.fence(session, screen, generation); return result;
  }
}
module.exports = { ScreenManager, screenTools, TOOLS };
