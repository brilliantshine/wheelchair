'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
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
    this.stopTasks = new Map();
    this.usage = new Map();
    this.archiveAttempted = new Set();
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
    const gitDir = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: ctx.worktree, encoding: 'utf8' });
    Object.assign(state, { thread_id: ctx.threadId, worktree: ctx.worktree, copy: ctx.copy, last_session: session.name, role: session.role });
    if (session.role === 'lead' || session.role === 'sub-lead') state.thread_worktree = true;
    if (gitDir.status === 0) state.git_dir = gitDir.stdout.trim();
    writeState(this.stateDir, ctx.key, state);
    return state;
  }

  markKey(key) {
    if (!key) return;
    const file = path.join(this.stateDir, 'win', 'copies', key, 'state.json');
    if (!fs.existsSync(file)) return;
    const state = readState(this.stateDir, key);
    state.used_since_ok = true;
    const now = Date.now();
    const failedAt = state.last_failed ? Date.parse(state.last_failed.at) : 0;
    state.used_at = new Date(Math.max(now, failedAt + 1)).toISOString();
    const prior = this.usage.get(key);
    this.usage.set(key, { count: (prior?.count || 0) + 1, at: state.used_at });
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
      const usage = this.usage.get(ctx.key)?.count || 0;
      let succeeded = false;
      try {
        const result = await reconcile(ctx);
        succeeded = true;
        return result;
      } finally {
        const latest = this.usage.get(ctx.key);
        if (latest && latest.count !== usage) {
          const state = readState(this.stateDir, ctx.key);
          state.used_since_ok = true;
          state.used_at = latest.at;
          writeState(this.stateDir, ctx.key, state);
        }
        if (succeeded && this.hasLiveTools(ctx)) this.markKey(ctx.key);
      }
    });
    this.running.set(ctx.key, task);
    try { return await task; } finally { if (this.running.get(ctx.key) === task) this.running.delete(ctx.key); }
  }

  async beforeLaunch(session, options = {}) {
    let timer;
    try {
      await Promise.race([this.prepareLaunch(session, options), new Promise(resolve => {
        timer = setTimeout(() => {
          this.readyErrors.set(worktreeKey(session.worktree), 'Windows copy is still being readied');
          resolve();
        }, this.readyTimeoutMs);
      })]);
    } finally { clearTimeout(timer); }
  }

  async prepareLaunch(session, { windowsTools } = {}) {
    try {
      if (!this.detected.wsl || !TOOL_ROLES.has(session.role)) return;
      const ctx = await this.context(session);
      if (!windowsTools && !this.exists(ctx) && !this.readying.has(ctx.key)) return;
      if (windowsTools) this.toolSessions.add(session.name);
      if (this.exists(ctx)) {
        this.register(ctx, session);
        this.markKey(ctx.key);
      } else if (this.readying.has(ctx.key) && !windowsTools) {
        this.readying.get(ctx.key).then(() => {
          if (this.exists(ctx)) {
            this.register(ctx, session);
            this.markKey(ctx.key);
          }
        }).catch(err => this.service.log(err));
      }
      if (!windowsTools) return;
      let task = this.readying.get(ctx.key);
      if (!task) {
        task = (async () => {
          try {
            await this.create(ctx, session);
            await this.sync(ctx);
            this.readyErrors.delete(ctx.key);
          } catch (err) {
            this.readyErrors.set(ctx.key, err.message);
            this.service.log(err);
          } finally {
            this.readying.delete(ctx.key);
          }
        })();
        this.readying.set(ctx.key, task);
      }
      let timer;
      await Promise.race([task, new Promise(resolve => {
        timer = setTimeout(() => {
          this.readyErrors.set(ctx.key, 'Windows copy is still being readied');
          resolve();
        }, this.readyTimeoutMs);
      })]);
      clearTimeout(timer);
    } catch (err) {
      this.service.log(err);
    }
  }

  liveSharing(ctx, excluded) {
    const live = this.service.liveTmux();
    if (live === null) return true;
    return Object.values(this.service.sessions).some(session => session.name !== excluded && session.worktree && session.status !== 'stopped' && live.has(session.name) && worktreeKey(session.worktree) === ctx.key);
  }

  async remove(ctx, saveUnresolved) {
    const state = readState(this.stateDir, ctx.key);
    const worktree = fs.existsSync(ctx.worktree) ? ctx.worktree : state.git_dir;
    if (!worktree || !fs.existsSync(worktree)) {
      this.service.log(`cannot delete Windows copy ${ctx.copy.linux}: repository is unavailable`);
      return;
    }
    await deleteCopy({ ...ctx, worktree }, { saveUnresolved });
  }

  async killSession(name) {
    const result = await this.apps.killSession(name);
    if (result.wasRunning) for (const key of result.copyKeys) this.markKey(key);
    return result;
  }

  // T4 calls this once per stop, possibly after setting session.status to stopped.
  onStop(session) {
    if (!this.detected.wsl || this.stopped.has(session.name)) return;
    this.stopped.add(session.name);
    this.toolSessions.delete(session.name);
    const termination = this.killSession(session.name);
    const task = Promise.resolve(termination).then(async () => {
      const ctx = await this.context(session);
      if (this.readying.has(ctx.key)) await this.readying.get(ctx.key);
      if (!this.exists(ctx)) return;
      if (session.role === 'verifier') await this.remove(ctx, false);
      else if ((session.role === 'lead' || session.role === 'sub-lead') && !this.liveSharing(ctx, session.name) && readState(this.stateDir, ctx.key).used_since_ok && fs.existsSync(ctx.worktree)) await this.sync(ctx);
    }).catch(err => this.service.log(err)).finally(() => this.stopTasks.delete(session.name));
    this.stopTasks.set(session.name, { task, session });
  }

  async onWorktreeRemoved(session, { kind }) {
    if (!this.detected.wsl) return;
    const stopping = this.stopTasks.get(session.name);
    if (stopping) await stopping.task;
    const ctx = await this.context(session);
    if (this.readying.has(ctx.key)) await this.readying.get(ctx.key);
    if (!this.exists(ctx)) return;
    if (this.running.has(ctx.key)) await this.running.get(ctx.key).catch(() => {});
    const state = readState(this.stateDir, ctx.key);
    if (kind === 'verifier' || kind === 'merge') return this.remove(ctx, false);
    if (state.last_failed) {
      this.service.log(`keeping Windows copy ${ctx.copy.linux}: last reconcile failed`);
      return;
    }
    await this.remove(ctx, true);
  }

  needsFinal(ctx) {
    const state = readState(this.stateDir, ctx.key);
    if (!fs.existsSync(ctx.worktree) || !state.used_since_ok) return false;
    return !state.last_failed || (state.used_at && state.used_at > state.last_failed.at);
  }

  archiveCheck(threadId) {
    const pending = [];
    for (const ctx of this.registry().filter(item => item.threadId === threadId)) {
      const stopping = [...this.stopTasks.values()].find(item => item.session.worktree && worktreeKey(item.session.worktree) === ctx.key);
      const running = stopping?.task || this.readying.get(ctx.key) || this.running.get(ctx.key);
      if (running) {
        if (!stopping) this.archiveAttempted.add(ctx.key);
        pending.push(ctx.state.last_session);
      } else if (!this.archiveAttempted.has(ctx.key) && this.needsFinal(ctx)) {
        this.archiveAttempted.add(ctx.key);
        this.sync(ctx).catch(err => this.service.log(err));
        pending.push(ctx.state.last_session);
      }
    }
    return { pending };
  }

  async archiveFinish(threadId) {
    const threadDirs = new Set();
    for (const ctx of this.registry().filter(item => item.threadId === threadId)) {
      threadDirs.add(path.dirname(ctx.copy.linux));
      if (this.running.has(ctx.key)) await this.running.get(ctx.key).catch(() => {});
      const state = readState(this.stateDir, ctx.key);
      if (state.last_failed) {
        this.service.log(`keeping Windows copy ${ctx.copy.linux}: last reconcile failed`);
        continue;
      }
      try { await this.remove(ctx, true); } catch (err) { this.service.log(err); }
      this.archiveAttempted.delete(ctx.key);
    }
    // D14: archive removes the thread's copies folder; a kept copy keeps it (rmdir refuses a non-empty folder).
    for (const dir of threadDirs) {
      try { fs.rmdirSync(dir); } catch (err) { if (err.code !== 'ENOENT' && err.code !== 'ENOTEMPTY' && err.code !== 'EEXIST') this.service.log(err); }
    }
  }

  async sweep() {
    const live = this.service.liveTmux();
    if (live === null) return;
    const result = await this.apps.sweep(live);
    for (const key of result.copyKeys) this.markKey(key);
    for (const ctx of this.registry()) {
      if (ctx.state.thread_worktree && !this.liveSharing(ctx) && this.needsFinal(ctx) && !this.running.has(ctx.key)) {
        try { await this.sync(ctx); } catch (err) { this.service.log(err); }
      }
    }
  }

  async startup() {
    await this.apps.startup();
    if (this.detected.wsl) await this.sweep();
  }

  async sessionEnv(session, baseEnv = {}) {
    if (!this.detected.wsl || !TOOL_ROLES.has(session.role)) return {};
    try {
      const ctx = await this.context(session);
      return { WHEELCHAIR_WINDOWS_PROJECT: ctx.copy.windows, WSLENV: [baseEnv.WSLENV, 'WHEELCHAIR_WINDOWS_PROJECT'].filter(Boolean).join(':') };
    } catch (err) {
      this.service.log(err);
      return {};
    }
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
    if (args.env?.some(([key]) => key.toUpperCase() === 'WHEELCHAIR_SESSION_TOKEN')) throw error(400, 'invalid environment variable');
    if ((op === 'run' || op === 'start') && session.cli === 'codex' && session.codex_mode !== 'unrestricted') throw error(403, SANDBOX);
    try {
      let ctx;
      try {
        ctx = await this.context(session);
      } catch (err) {
        if (op !== 'info') throw err;
        return { wsl: true, ok: false, ready: false, reason: err.message, copy_windows: null, copy_linux: null, sandboxed: session.cli === 'codex' && session.codex_mode !== 'unrestricted' };
      }
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
