'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { detectWsl, createWinEnv, worktreeKey, copyPaths } = require('./win-env');
const { ensureCopy, reconcile, readState, writeState, deleteCopy } = require('./win-sync');
const { parseWinOp } = require('./win-args');
const { TOOL_ROLES } = require('./project-mcp');

const error = (status, message) => Object.assign(new Error(message), { status });
const NOT_WSL = 'the Windows bridge only works when Wheelchair runs in WSL';
const SANDBOX = "Windows programs would run outside your sandbox; the bridge can't run them in this session";

class WinBridge {
  constructor(service, options = {}) {
    this.service = service;
    this.stateDir = service.stateDir;
    this.options = options;
    this.detected = detectWsl(options);
    this.winEnv = options.winEnv || createWinEnv({ mount: this.detected.mount, runRoot: options.runRoot, log: service.log });
    this.readying = new Map();
    this.readyErrors = new Map();
    this.running = new Map();
    this.toolSessions = new Set();
    this.stopped = new Set();
    this.usage = new Map();
    this.readyTimeoutMs = options.readyTimeoutMs ?? 45000;
    const onAppClosed = app => this.markKey(app.copyKey);
    this.apps = options.apps || new (require('./win-apps').AppTracker)({ winEnv: this.winEnv, stateDir: this.stateDir, log: service.log, onAppClosed });
  }

  check(session, checkTmux = true) {
    const current = this.service.sessions[session.name];
    if (!current || current !== session || current.status === 'stopped' || this.service.archivingThreads.has(session.thread_id) || this.service.archivedThreads?.has(session.thread_id) || this.service.closingThreads.has(session.thread_id)) throw error(409, 'session stopped or thread archived');
    if (checkTmux) {
      const live = this.service.liveTmux();
      if (live === null) throw error(422, 'could not check the session; try again');
      if (!live.has(session.name)) {
        this.killSession(session.name);
        throw error(409, 'session is not running');
      }
    }
  }

  async context(session) {
    const key = worktreeKey(session.worktree);
    const copy = await copyPaths(this.winEnv, session.thread_id, key);
    return { key, copy, worktree: session.worktree, threadId: session.thread_id, stateDir: this.stateDir, winEnv: this.winEnv };
  }

  exists(ctx) {
    return fs.existsSync(path.join(ctx.copy.linux, '.git'));
  }

  register(ctx, session) {
    const state = readState(this.stateDir, ctx.key);
    Object.assign(state, { thread_id: ctx.threadId, worktree: ctx.worktree, copy: ctx.copy, last_session: session.name, role: session.role });
    writeState(this.stateDir, ctx.key, state);
    return state;
  }

  markKey(key) {
    if (!key) return;
    const file = path.join(this.stateDir, 'win', 'copies', key, 'state.json');
    if (!fs.existsSync(file)) return;
    const state = readState(this.stateDir, key);
    state.used_since_ok = true;
    this.usage.set(key, (this.usage.get(key) || 0) + 1);
    writeState(this.stateDir, key, state);
  }

  registry() {
    let entries;
    try { entries = fs.readdirSync(path.join(this.stateDir, 'win', 'copies'), { withFileTypes: true }); } catch (err) { if (err.code === 'ENOENT') return []; throw err; }
    return entries.filter(entry => entry.isDirectory()).map(entry => {
      const state = readState(this.stateDir, entry.name);
      if (!state.thread_id || !state.worktree || !state.copy) return null;
      return { key: entry.name, copy: state.copy, worktree: state.worktree, threadId: state.thread_id, stateDir: this.stateDir, winEnv: this.winEnv, state };
    }).filter(Boolean);
  }

  async create(ctx, session) {
    const sources = this.registry().filter(other => other.threadId === ctx.threadId && other.key !== ctx.key && other.state.last_ok && this.exists(other)).map(other => ({ copy: other.copy, last_ok: other.state.last_ok }));
    this.register(ctx, session);
    this.markKey(ctx.key);
    await ensureCopy({ ...ctx, sources });
  }

  hasLiveTools(ctx) {
    const live = this.service.liveTmux();
    if (live === null) return false;
    return Object.values(this.service.sessions).some(session => this.toolSessions.has(session.name) && live.has(session.name) && session.status !== 'stopped' && worktreeKey(session.worktree) === ctx.key);
  }

  async sync(ctx) {
    const prior = this.running.get(ctx.key) || Promise.resolve();
    const task = prior.catch(() => {}).then(async () => {
      const usage = this.usage.get(ctx.key) || 0;
      try {
        return await reconcile(ctx);
      } finally {
        if ((this.usage.get(ctx.key) || 0) !== usage || this.hasLiveTools(ctx)) this.markKey(ctx.key);
      }
    });
    this.running.set(ctx.key, task);
    try { return await task; } finally { if (this.running.get(ctx.key) === task) this.running.delete(ctx.key); }
  }

  async sessionEnv(session, baseEnv = {}) {
    if (!this.detected.wsl || !TOOL_ROLES.has(session.role)) return {};
    const ctx = await this.context(session);
    return { WHEELCHAIR_WINDOWS_PROJECT: ctx.copy.windows, WSLENV: [baseEnv.WSLENV, 'WHEELCHAIR_WINDOWS_PROJECT'].filter(Boolean).join(':') };
  }

  async info(session, ctx) {
    const sandboxed = session.cli === 'codex' && session.codex_mode !== 'unrestricted';
    const versions = await this.winEnv.versions();
    const reason = this.readyErrors.get(ctx.key) || versions.reason;
    const ready = !this.readying.has(ctx.key) && !reason;
    return { wsl: true, ok: versions.ok, ready, ...(reason ? { reason } : {}), copy_windows: ctx.copy.windows, copy_linux: ctx.copy.linux, sandboxed };
  }

  async handle(session, body) {
    if (!this.detected.wsl) throw error(422, NOT_WSL);
    if (session.role === 'reviewer' || session.role === 'mapper') throw error(403, 'reviewers and mappers cannot use the Windows bridge');
    this.check(session);
    const op = body?.op;
    const args = parseWinOp(op, body?.args);
    if ((op === 'run' || op === 'start') && session.cli === 'codex' && session.codex_mode !== 'unrestricted') throw error(403, SANDBOX);
    try {
      const ctx = await this.context(session);
      if (this.exists(ctx)) {
        this.register(ctx, session);
        this.markKey(ctx.key);
      }
      if (op === 'info') return await this.info(session, ctx);
      if (this.readying.has(ctx.key)) await this.readying.get(ctx.key).catch(() => {});
      this.check(session);
      if (op === 'path') return { path: /^[a-z]:[\\/]|^\\\\/i.test(args.path) ? this.winEnv.toLinux(args.path) : this.winEnv.toWindows(args.path) };
      if (['sync', 'run', 'start'].includes(op)) {
        await this.create(ctx, session);
        const sync = await this.sync(ctx);
        this.check(session);
        if (op === 'sync') return sync;
        const launch = { ...args, cwd: ctx.copy.windows, copyKey: ctx.key };
        const result = await this.apps[op](session, launch);
        if (op === 'run') {
          this.markKey(ctx.key);
          return { ...result, sync: await this.sync(ctx) };
        }
        return { ...result, sync };
      }
      if (op === 'status') {
        const { exited, ...result } = await this.apps.status(session, args.id);
        if (exited.length && this.exists(ctx)) {
          this.markKey(ctx.key);
          result.sync = await this.sync(ctx);
        }
        return result;
      }
      if (op === 'stop') {
        const { wasRunning, copyKeys, ...result } = await this.apps.stop(session, args.id);
        if (wasRunning) for (const key of copyKeys) this.markKey(key);
        if (this.exists(ctx)) result.sync = await this.sync(ctx);
        return result;
      }
      if (op === 'windows') return await this.apps.windows(session);
      if (op === 'shot') return await this.apps.shot(session, args.handle);
      throw error(400, 'unknown operation');
    } catch (err) {
      if (!err.status) err.status = 422;
      throw err;
    }
  }
}

module.exports = { WinBridge };
