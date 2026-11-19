#!/usr/bin/env node
'use strict';
const { startupWarning } = require('./lib/startup-warning');
const { createProjectTools } = require('./lib/project-tools');
const { TOOL_ROLES, readProjectMcp } = require('./lib/project-mcp');
const { missingPrograms } = require('./lib/project-programs');
const { projectIdentity, readKeyStore, launchKeys, keyReferences } = require('./lib/project-keys');

/*
 * Wheelchair machine service.  The HTTP API is documented in machine/API.md.
 *
 * Spec citations: configuration, credentials, tmux ownership and readiness are
 * "Machine service on the hub"; transcript copies and worktrees are
 * "Branches and checkouts"; card delivery is "How the app reads and drives a
 * session".  Keep those contracts here instead of teaching callers tmux/git.
 */
const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, spawn, execFile } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const adapters = require('./adapters');
const { limitedUntil } = require('./lib/limits');
const { readLines: readCodexSteps } = require('./lib/codex-steps');
const { AsideTurns } = require('./lib/aside-turns');
const { SudoRequests } = require('./lib/sudo');
const { ScreenManager, screenTools } = require('./lib/screen');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATE = path.join(os.homedir(), '.local', 'state', 'wheelchair');
const HUB_HEADER = 'x-wheelchair-machine-secret';
const TOKEN_HEADER = 'x-wheelchair-session-token';
const UPLOAD_LIMIT = 25 * 1024 * 1024;
const IMAGE_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
function threadName(id) { if (typeof id !== 'string' || !/^[A-Za-z0-9._-]+$/.test(id) || id.includes('..')) die('invalid thread id'); return id; }
function uploadName(name) {
  const clean = String(name || '').replace(/[^A-Za-z0-9._-]/g, '-').replace(/^\.+/, '');
  const match = /^(.*)(\.[^.]{1,10})$/.exec(clean);
  const ext = match ? match[2] : '';
  const stem = (match ? match[1] : clean).slice(0, 100 - ext.length) || 'file';
  return stem + ext;
}

// Canonical identity shared by SSH and HTTPS GitHub origins.
function normalizeGithubOrigin(origin) {
  if (typeof origin !== 'string') return null;
  const match = /^(?:git@github\.com:|https:\/\/github\.com\/|ssh:\/\/git@github\.com\/)([a-z0-9_.-]+)\/([a-z0-9_.-]+?)(?:\.git)?$/i.exec(origin);
  return match ? `github.com/${match[1]}/${match[2]}`.toLowerCase() : null;
}

// A refusal of the request itself: 400, so the hub and agents report it rather than retry.
function die(message) { throw Object.assign(new Error(message), { status: 400 }); }
function safeName(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._/-]+$/.test(value) || value.includes('..')) die(`invalid ${label}`);
  return value;
}
function accountDir(dir, id) {
  if (dir === null || dir === undefined) return null;
  if (typeof dir !== 'string' || !dir.startsWith('~/')) die('invalid account dir');
  const expanded = path.resolve(os.homedir(), dir.slice(2));
  const base = path.join(os.homedir(), '.wheelchair', 'accounts');
  const name = path.basename(expanded);
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(name) || dir !== `~/.wheelchair/accounts/${name}` || expanded !== path.join(base, name) || (id && id !== name)) die('invalid account dir');
  return expanded;
}
function json(value) { return JSON.stringify(value); }
async function mkdir(dir, mode = 0o700) { await fsp.mkdir(dir, { recursive: true, mode }); }
async function atomicWrite(file, body, mode = 0o600) {
  await mkdir(path.dirname(file));
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fsp.writeFile(temporary, body, { mode });
  await fsp.rename(temporary, file);
}
async function readJson(file, fallback) {
  try { return JSON.parse(await fsp.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}
function publicSession(record) {
  const copy = { ...record };
  for (const key of ['kimi_session_id', 'source_transcript', 'transcript_source', 'kimi_log_id', 'kimi_offset', 'kimi_last_turn', 'kimi_missing_since']) delete copy[key];
  return copy;
}
function command(program, args, options = {}) {
  const result = spawnSync(program, args, { encoding: 'utf8', ...options });
  // Optional commands (notably systemd-run and tailscale) may be absent.  Their
  // callers select the documented fallback instead of crashing the service.
  if (result.error) return { ok: false, status: result.status ?? 127, stdout: result.stdout || '', stderr: result.stderr || result.error.message };
  return { ok: result.status === 0, status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}
// The same result as command(), without blocking the event loop: for anything slow (a git
// fetch can take many seconds), so /v1/status, hooks and other sessions keep being answered.
function commandAsync(program, args, options = {}) {
  return new Promise((resolve) => {
    let stdout = ''; let stderr = ''; let settled = false; let timer; let timedOut = false;
    const finish = (value) => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } };
    const { timeout, ...spawnOptions } = options;
    let child;
    try { child = spawn(program, args, { ...spawnOptions, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (error) { return finish({ ok: false, status: 127, stdout: '', stderr: error.message }); }
    if (timeout != null) timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeout);
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => finish({ ok: false, status: 127, stdout, stderr: stderr || error.message }));
    child.on('close', (status) => finish(timedOut ? { ok: false, status: null, stdout, stderr: `${stderr}\ntimed out after ${timeout / 1000}s`, timedOut: true } : { ok: status === 0, status, stdout, stderr }));
  });
}
// A new worktree has no installed packages (node_modules is never committed), so tests that
// read them fail there. Link each node_modules the clone has, next to a tracked package.json,
// into the worktree, and keep the links out of git status. Best effort: a start never fails here.
async function linkInstalledPackages(repo, worktree) {
  try {
    const listed = await commandAsync('git', ['-C', worktree, 'ls-files', '--', 'package.json', '*/package.json']);
    if (!listed.ok) return;
    const linked = [];
    for (const file of listed.stdout.split('\n').filter(Boolean)) {
      const dir = path.dirname(file);
      const source = path.join(repo, dir, 'node_modules'); const target = path.join(worktree, dir, 'node_modules');
      const stat = await fsp.stat(source).catch(() => null);
      if (!stat || !stat.isDirectory() || await fsp.lstat(target).catch(() => null)) continue;
      await fsp.symlink(source, target, 'dir');
      linked.push(dir === '.' ? '/node_modules' : `/${dir}/node_modules`);
    }
    if (!linked.length) return;
    // The ignore pattern `node_modules/` matches only directories, not a link, so name each link.
    const where = await commandAsync('git', ['-C', worktree, 'rev-parse', '--git-common-dir']);
    if (!where.ok) return;
    const exclude = path.join(path.resolve(worktree, where.stdout.trim()), 'info', 'exclude');
    const current = await fsp.readFile(exclude, 'utf8').catch(() => '');
    const lines = new Set(current.split('\n'));
    const missing = linked.filter((line) => !lines.has(line));
    if (!missing.length) return;
    await fsp.mkdir(path.dirname(exclude), { recursive: true });
    await fsp.appendFile(exclude, `${current && !current.endsWith('\n') ? '\n' : ''}${missing.join('\n')}\n`);
  } catch { /* the session still starts; only these tests lack their packages */ }
}
const PERMISSION_MODES = { auto: 'auto', bypass: 'bypassPermissions' };
const CODEX_MODES = ['sandboxed', 'unrestricted'];
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const PREVIEW_TIMEOUT_MS = 60_000;
const ROLE_CARDS = { lead: ['cards.md', 'cards-lead.md'], 'sub-lead': ['cards.md'], worker: ['cards.md'], mapper: ['cards.md'], reviewer: [], verifier: [] };
const ROLE_REALISM = new Set(['lead', 'sub-lead', 'reviewer', 'verifier']);
function composeRolePrompt(input) {
  const first = `Role: ${input.role}`;
  if (input.role_prompt) return `${first}\n${input.role_prompt}`;
  const cards = ROLE_CARDS[input.role] || [];
  const header = cards.length ? 'Your role rules and card rules are below, already loaded: do not read these files again unless this text is no longer in your context.' : 'Your role rules are below, already loaded: do not read these files again unless this text is no longer in your context.';
  const read = file => fs.readFileSync(path.join(ROOT, 'protocol', 'app', file), 'utf8').trimEnd();
  const parts = [`${first}\n${header} \`<root>\` is \`${ROOT}\`.`, read(`${input.role}.md`)];
  if (ROLE_REALISM.has(input.role)) parts.push(`--- realism.md ---\n${read('realism.md')}`);
  for (const file of cards) parts.push(`--- ${file} ---\n${read(file)}`);
  const layers = typeof input.role_layers === 'string' ? input.role_layers.trim() : '';
  if (layers) parts.push(layers);
  return parts.join('\n\n');
}
// Validates the optional start fields; returns the normalised ones.
function startOptions(input) {
  const mode = input.permission_mode === undefined || input.permission_mode === null ? 'auto' : input.permission_mode;
  if (!Object.hasOwn(PERMISSION_MODES, mode)) die('permission_mode must be auto or bypass');
  const codexMode = input.codex_mode === undefined ? 'sandboxed' : input.codex_mode;
  if (!CODEX_MODES.includes(codexMode)) die('codex_mode must be sandboxed or unrestricted');
  if (input.effort !== undefined && input.effort !== null && !EFFORTS.includes(input.effort)) die(`effort must be one of ${EFFORTS.join(', ')}`);
  if (input.role_layers !== undefined && input.role_layers !== null && typeof input.role_layers !== 'string') die('role_layers must be text');
  return { permission_mode: mode, codex_mode: codexMode, effort: input.effort || null };
}
function shellQuote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
function maybeTailscaleIp() {
  let program = 'tailscale';
  if (process.platform === 'darwin') {
    const found = (process.env.PATH || '').split(path.delimiter).some(dir => { try { fs.accessSync(path.join(dir || '.', program), fs.constants.X_OK); return true; } catch { return false; } });
    if (!found) program = '/Applications/Tailscale.app/Contents/MacOS/Tailscale';
  }
  const result = command(program, ['ip', '-4']);
  return result.ok ? result.stdout.trim().split(/\s+/)[0] : '127.0.0.1';
}
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) die(`unknown argument ${key}`);
    out[key.slice(2)] = argv[++i];
  }
  return out;
}
function bodyOf(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(Object.assign(new Error('invalid JSON'), { status: 400 })); }
    });
    request.on('error', reject);
  });
}
function send(response, status, data) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(json(data));
}
function requestJson(urlText, method, headers, payload, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlText);
    const transport = url.protocol === 'https:' ? https : http;
    const data = payload === undefined ? '' : json(payload);
    const request = transport.request(url, { method, timeout, headers: { ...headers, 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } }, response => {
      let answer = '';
      response.on('data', chunk => { answer += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: answer }));
    });
    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', reject);
    request.end(data);
  });
}

class MachineService {
  constructor(options) {
    this.stateDir = path.resolve(options.stateDir || DEFAULT_STATE);
    this.projectTools = createProjectTools({ commandAsync, stateDir: this.stateDir });
    this.projectToolsLocks = new Map();
    this.configPath = path.join(this.stateDir, 'machine.json');
    this.sessionsPath = path.join(this.stateDir, 'sessions.json');
    this.config = {};
    this.asideTurns = new AsideTurns(this.stateDir, atomicWrite, accountDir);
    this.sessions = {};
    this.projectToolsBoot = crypto.randomUUID();
    this.projectToolsState = new Map();
    this.projectToolsWrites = new Map();
    this.platform = process.platform;
    this.startupWarning = null;
    this.startupSamples = new Map();
    this.startupWarningRunning = false;
    this.startupWarningRerun = false;
    this.scanStartupWarning = startupWarning;
    this.stepReads = new Map();
    this.codexStepChunkSize = options.codexStepChunkSize || 8 * 1024 * 1024;
    this.startingWorktrees = new Set();
    this.startingNames = new Map(); // name -> the start in progress, so a repeated start joins it
    this.cancelledStarts = new Set();
    this.startingBranches = new Set(); // worker branches named by a start not yet recorded
    this.repoQueues = new Map(); // repo -> tail of its fetch-and-add chain; one git writer per repo at a time
    this.logins = {};
    this.server = null;
    this.retryWindow = Number(process.env.WHEELCHAIR_RETRY_WINDOW_MS || 90_000);
    this.retryDelay = Number(process.env.WHEELCHAIR_RETRY_DELAY_MS || 1_000);
    this.spoolInterval = Number(process.env.WHEELCHAIR_SPOOL_INTERVAL_MS || 5_000);
    this.previewTimeoutMs = PREVIEW_TIMEOUT_MS; // tests shorten it on the instance
    // Read this once, when this process is made.  A pull changes ROOT's HEAD but not
    // the JavaScript this service is executing.
    this.version = command('git', ['-C', ROOT, 'rev-parse', 'HEAD']).stdout.trim();
    this.drains = new Map();
    this.threadLocks = new Map();
    this.closingThreads = new Map();
    this.archiveMarkersPath = path.join(this.stateDir, 'archive-markers.json');
    this.archivingThreads = new Set();
    this.archivedThreads = new Set();
    this.archiveMarkerWrites = Promise.resolve();
    this.uploadRequests = new Map();
    this.options = options;
    this.sudo = new SudoRequests(this, atomicWrite, readJson, requestJson);
    this.screens = new ScreenManager(this);
  }

  async refreshStartupWarning() {
    if (this.startupWarningRunning) { this.startupWarningRerun = true; return; }
    this.startupWarningRunning = true;
    do {
      this.startupWarningRerun = false;
      try { this.startupWarning = await this.scanStartupWarning(this.stateDir, this.startupSamples); }
      catch (error) { this.startupWarning = null; this.log(error); }
    } while (this.startupWarningRerun);
    this.startupWarningRunning = false;
  }

  async withThreadLock(id, fn) {
    const previous = this.threadLocks.get(id) || Promise.resolve();
    let release;
    const current = new Promise(resolve => { release = resolve; });
    this.threadLocks.set(id, current);
    await previous;
    try { return await fn(); } finally {
      release();
      if (this.threadLocks.get(id) === current) this.threadLocks.delete(id);
    }
  }
  async persistArchiveMarkers() {
    const write = () => atomicWrite(this.archiveMarkersPath, `${json({ archiving: [...this.archivingThreads], archived: [...this.archivedThreads] })}\n`);
    const pending = this.archiveMarkerWrites.then(write, write);
    this.archiveMarkerWrites = pending.catch(() => {});
    return pending;
  }
  async reserveUpload(id, name) {
    const dir = path.join(this.stateDir, 'uploads', threadName(id));
    await mkdir(dir);
    const entries = await fsp.readdir(dir);
    let n = entries.reduce((max, entry) => Math.max(max, Number(/^(\d+)-/.exec(entry)?.[1] || 0)), 0) + 1;
    for (;;) {
      const target = path.join(dir, `${n}-${uploadName(name)}`);
      try {
        // Reserve both the final name and its temporary name against existing files.
        const file = await fsp.open(`${target}.part`, 'wx', 0o600);
        try { await fsp.access(target); await file.close(); await fsp.unlink(`${target}.part`); n++; continue; }
        catch (error) { if (error.code !== 'ENOENT') { await file.close(); await fsp.unlink(`${target}.part`); throw error; } }
        return { target, file };
      } catch (error) { if (error.code !== 'EEXIST') throw error; n++; }
    }
  }
  // vouched: the hub has checked the thread is open with a live lead (which may still be waiting
  // for room or starting, with no session here yet), so only closing or archived threads are
  // refused. Archive removes the files like any other.
  async upload(id, name, request, vouched) {
    threadName(id);
    const requests = this.uploadRequests.get(id) || new Set();
    this.uploadRequests.set(id, requests);
    requests.add(request);
    try {
      return await this.withThreadLock(id, async () => {
        const lead = Object.values(this.sessions).some(s => s.thread_id === id && s.role === 'lead' && !s.archived_pending && s.status !== 'stopped');
        if (this.closingThreads.has(id) || this.archivedThreads.has(id) || !(vouched || lead)) throw Object.assign(new Error('thread is not writable'), { status: 409 });
        const { target, file } = await this.reserveUpload(id, name);
        try {
          let size = 0;
          for await (const chunk of request.iterator({ destroyOnReturn: false })) {
            if (this.closingThreads.has(id)) throw Object.assign(new Error('thread is closing'), { status: 409 });
            size += chunk.length;
            if (size > UPLOAD_LIMIT) { request.pause(); throw Object.assign(new Error('file exceeds 25 MB'), { status: 413 }); }
            await file.writeFile(chunk);
          }
          if (this.closingThreads.has(id)) throw Object.assign(new Error('thread is closing'), { status: 409 });
          await file.close();
          await fsp.rename(`${target}.part`, target);
          return target;
        } catch (error) {
          await file.close().catch(() => {});
          await fsp.unlink(`${target}.part`).catch(() => {});
          if (this.closingThreads.has(id)) throw Object.assign(new Error('thread is closing'), { status: 409 });
          throw error;
        }
      });
    } finally {
      requests.delete(request);
      if (!requests.size) this.uploadRequests.delete(id);
    }
  }
  async copyImage(agent, input) {
    if (this.options.beforeImageLock) await this.options.beforeImageLock();
    return this.withThreadLock(agent.thread_id, async () => {
      const current = this.sessions[agent.name];
      if (!current || current.archived_pending || current.status === 'stopped') throw Object.assign(new Error('session is not writable'), { status: 409 });
      if (typeof input.path !== 'string' || !path.isAbsolute(input.path)) throw Object.assign(new Error('image path must be absolute'), { status: 422 });
      const ext = path.extname(typeof input.path === 'string' ? input.path : '').toLowerCase();
      if (!IMAGE_TYPES[ext]) throw Object.assign(new Error('unsupported image extension'), { status: 422 });
      let stat;
      try { stat = await fsp.stat(input.path); } catch { throw Object.assign(new Error('image does not exist'), { status: 422 }); }
      if (!stat.isFile()) throw Object.assign(new Error('image is not a regular file'), { status: 422 });
      if (stat.size > UPLOAD_LIMIT) throw Object.assign(new Error('image exceeds 25 MB'), { status: 422 });
      const { target, file } = await this.reserveUpload(agent.thread_id, path.basename(input.path));
      try {
        await pipeline(fs.createReadStream(input.path), file.createWriteStream());
      } catch (error) { await file.close().catch(() => {}); await fsp.unlink(`${target}.part`).catch(() => {}); throw error; }
      await fsp.rename(`${target}.part`, target);
      return { ...input, path: target };
    });
  }
  async init() {
    await mkdir(this.stateDir);
    const toolsDir = path.join(this.stateDir, 'project-tools');
    try { for (const name of await fsp.readdir(toolsDir)) if (name.endsWith('.tmp')) await fsp.unlink(path.join(toolsDir, name)).catch(error => this.log(error)); } catch (error) { if (error.code !== 'ENOENT') this.log(error); }
    this.config = await readJson(this.configPath, {});
    this.config.host = this.options.host || this.config.host || maybeTailscaleIp();
    this.config.port = Number(this.options.port || this.config.port || 7374);
    if (this.options.hubUrl) this.config.hub_url = this.options.hubUrl;
    if (this.options.secretFile) this.config.secret_file = this.options.secretFile;
    await atomicWrite(this.configPath, `${json(this.config)}\n`);
    await this.asideTurns.load();
    await this.sudo.load();
    this.sessions = await readJson(this.sessionsPath, {});
    const markers = await readJson(this.archiveMarkersPath, { archiving: [], archived: [] });
    this.archivingThreads = new Set(markers.archiving || []);
    this.archivedThreads = new Set(markers.archived || []);
    this.checkKimiVersion();
    await this.recoverFromTmux();
    await this.screens.startup();
    this.screenTimer = setInterval(() => this.screens.sweep().catch(error => this.log(error)), Number(process.env.WHEELCHAIR_SCREEN_SWEEP_MS || 60000));
    this.screenTimer.unref();
    await mkdir(path.join(this.stateDir, 'spool', 'cards'));
    await mkdir(path.join(this.stateDir, 'spool', 'events'));
    this.pollTimer = setInterval(() => this.pollReadiness().catch(error => this.log(error)), 2000);
    this.pollTimer.unref();
    this.stepsTimer = setInterval(() => this.pollCodexSteps().catch(error => this.log(error)), 2000);
    this.stepsTimer.unref();
    this.kimiTimer = setInterval(() => this.pollKimiTurns().catch(error => this.log(error)), 1000);
    this.kimiTimer.unref();
    // Trust is the one startup screen where waiting two seconds makes a newly-created
    // worktree feel stalled. Stuck sessions and open prompts remain on pollTimer.
    this.trustTimer = setInterval(() => this.pollTrust().catch(error => this.log(error)), 500);
    this.trustTimer.unref();
    this.agyToolsTimer = setInterval(() => this.sweepAgyTools(), 60000);
    this.agyToolsTimer.unref();
  }
  // The names of the running tmux sessions, or null when tmux could not be asked. "No server" is
  // a real empty answer; any other failure is unknown, and must not read as "every session ended".
  liveTmux() {
    const ls = this.tmux(['list-sessions', '-F', '#S']);
    if (ls.ok) return new Set(ls.stdout.trim().split('\n').filter(Boolean));
    if (/no server running|error connecting to .*\(No such file or directory\)/.test(ls.stderr)) return new Set();
    this.log(`tmux list-sessions failed: ${ls.stderr.trim() || `exit ${ls.status}`}`);
    return null;
  }
  sweepAgyTools() {
    if (!this.stateDir) return;
    const dir = path.join(this.stateDir, 'agy-tools');
    let entries;
    // Read the directory first so a machine with no Antigravity tool files never asks tmux.
    try { entries = fs.readdirSync(dir); } catch (error) { if (error.code !== 'ENOENT') this.log(error); return; }
    if (!entries.length) return;
    const starting = new Set(this.startingNames.keys());
    const live = this.liveTmux();
    if (!live) return;
    const groups = new Map();
    const decoded = entries.map(entry => {
      let name;
      try { name = decodeURIComponent(entry); safeName(name, 'session name'); if (!name.startsWith('wc-')) name = null; } catch { name = null; }
      const item = { entry, name };
      if (name) {
        const tmuxName = name.replace(/[.:]/g, '_');
        if (!groups.has(tmuxName)) groups.set(tmuxName, []);
        groups.get(tmuxName).push(item);
      }
      return item;
    });
    const protectedEntries = new Set();
    const mtime = item => {
      if (!('mtime' in item)) {
        try { item.mtime = fs.lstatSync(path.join(dir, item.entry)).mtimeMs; }
        catch (error) { this.log(error); item.mtime = null; }
      }
      return item.mtime;
    };
    const byName = (a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : a.entry < b.entry ? -1 : a.entry > b.entry ? 1 : 0;
    // tmux rewrites `.` and `:` to `_`, so several dirs can map to one live name.
    // The machine's record identifies the running session; a refused start has no record.
    for (const [tmuxName, group] of groups) {
      if (!live.has(tmuxName)) continue;
      const recorded = group.filter(item => this.sessions[item.name] && this.sessions[item.name].status !== 'stopped');
      let chosen;
      if (recorded.length) {
        recorded.sort((a, b) => (Date.parse(this.sessions[b.name].created_at) - Date.parse(this.sessions[a.name].created_at)) ||
          Number(b.name === tmuxName) - Number(a.name === tmuxName) || byName(a, b));
        chosen = recorded[0];
      } else {
        chosen = group.find(item => item.name === tmuxName);
        if (!chosen) {
          const readable = group.filter(item => mtime(item) !== null);
          readable.sort((a, b) => mtime(b) - mtime(a) || byName(a, b));
          chosen = readable[0];
        }
      }
      if (chosen) protectedEntries.add(chosen);
    }
    for (const item of decoded) {
      if (protectedEntries.has(item) || (item.name && starting.has(item.name))) continue;
      const age = mtime(item);
      if (age === null || Date.now() - age < 60000) continue;
      try { fs.rmSync(path.join(dir, item.entry), { recursive: true, force: true }); }
      catch (error) { this.log(error); }
    }
  }
  // Spec "Machine service on the hub": a live wc-* tmux session missing from sessions.json (a lost or
  // stale file) is adopted again, so it can still be read, typed into and stopped.  It has no token.
  async recoverFromTmux() {
    let changed = false;
    for (const name of this.liveTmux() || []) {
      if (!name.startsWith('wc-') || name.startsWith('wc-login-') || this.sessions[name]) continue;
      const parsed = /^wc-(.+?)-(sub-lead|lead|worker|reviewer|verifier|[a-z]+)(?:-\d+)?$/.exec(name);
      if (!parsed) continue;
      const pane = this.tmux(['capture-pane', '-p', '-t', name]);
      const where = this.tmux(['display-message', '-p', '-t', name, '#{pane_current_path}']);
      this.sessions[name] = { name, thread_id: parsed[1], role: parsed[2], status: 'ready', recovered: true,
        cli: pane.ok && ((/^\s*(?:Ask When Needed|Never Ask)\b/im.test(pane.stdout) && /^\s*context:\s*\d+%/im.test(pane.stdout)) || (() => { const lines = pane.stdout.split(/\r?\n/).map(line => line.trim()); return lines.includes('Trust this folder?') && lines.some(line => /^(?:❯\s*)?Trust and continue$/.test(line)) && lines.some(line => /^(?:❯\s*)?Exit$/.test(line)); })()) ? 'kimi' : pane.ok && pane.stdout.includes('Antigravity CLI') ? 'agy' : pane.ok && pane.stdout.includes('Codex') ? 'codex' : 'claude',
        worktree: where.ok ? where.stdout.trim() : '', created_worktree: false, token: '', created_at: new Date().toISOString() };
      if (this.sessions[name].cli === 'kimi') this.sessions[name].end_reason = 'Lost track of this Kimi Code session after a machine restart; restart it';
      changed = true;
    }
    if (changed) await this.persistSessions();
  }
  async persistSessions() { await atomicWrite(this.sessionsPath, `${JSON.stringify(this.sessions, (key, value) => key === 'transcript_unsaved' ? undefined : value)}\n`); }
  log(error) { process.stderr.write(`machine: ${error.message || error}\n`); }
  async secret() {
    if (!this.config.secret_file) return '';
    return (await fsp.readFile(this.config.secret_file, 'utf8')).trim();
  }
  async authorize(request, kind, sessionName) {
    if (kind === 'hub') {
      const expected = await this.secret();
      if (!expected || request.headers[HUB_HEADER] !== expected) throw Object.assign(new Error('machine secret required'), { status: 401 });
      return null;
    }
    const token = request.headers[TOKEN_HEADER] || (request.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const found = Object.values(this.sessions).find(session => {
      if (!session.token) return false; // a recovered session has no token and must not match an empty one
      const got = Buffer.from(token || ''); const expected = Buffer.from(session.token || '');
      return got.length === expected.length && crypto.timingSafeEqual(got, expected);
    });
    if (!found || (sessionName && found.name !== sessionName)) throw Object.assign(new Error('session token required'), { status: 401 });
    return found;
  }
  tmux(args, options) { return command('tmux', args, options); }
  managed(name) {
    const session = this.sessions[name];
    if (!session || !name.startsWith('wc-')) throw Object.assign(new Error('unknown managed session'), { status: 404 });
    return session;
  }
  // `color` keeps the escape codes (capture-pane -e) for the terminal page; the internal
  // checks that match pane text read it plain.
  pane(name, color = false, history = 0) {
    this.managed(name);
    const result = this.tmux(['capture-pane', '-p', ...(color ? ['-e'] : []), ...(history > 0 ? ['-S', `-${history}`] : []), '-t', name]);
    if (!result.ok) throw Object.assign(new Error(result.stderr.trim() || 'tmux pane unavailable'), { status: 409 });
    return result.stdout;
  }
  sessionName(threadId, role) {
    safeName(threadId, 'thread id'); safeName(role, 'role');
    const base = `wc-${threadId}-${role}`;
    let n = 1; let candidate = base;
    while (this.sessions[candidate]) candidate = `${base}-${++n}`;
    return candidate;
  }
  // A replacement worker reuses a dead worker's worktree. It must be alone there: the hub's record
  // of who is dead can be wrong or missing (a queued start, a lost response), so this service, which
  // sees every session, has the final say. A worker still in tmux, or tmux unknown, refuses.
  refuseSharedWorktree(worktree, sessionName) {
    // A worker recorded as stopped still counts: a failed kill-session records stopped too, so only
    // tmux can say it is gone.
    const others = Object.values(this.sessions).filter(other => other.role === 'worker' && other.name !== sessionName
      && other.worktree && path.resolve(other.worktree) === worktree);
    const conflict = (this.startingWorktrees.has(worktree) && 'another start') || (() => {
      if (!others.length) return null;
      const live = this.liveTmux();
      if (!live) return 'tmux could not be checked';
      return others.find(other => live.has(other.name))?.name || null;
    })();
    if (conflict) throw Object.assign(new Error(`worker worktree is in use (${conflict}): ${worktree}`), { status: 409 });
    this.startingWorktrees.add(worktree); // released by start() once this session is recorded or failed
  }
  async createWorktree(input, sessionName) {
    if (input.worktree) {
      const worktree = path.resolve(input.worktree);
      if (input.role === 'worker' && input.branch) {
        let stat;
        try { stat = await fsp.stat(worktree); } catch { die(`worker worktree does not exist: ${worktree}`); }
        if (!stat.isDirectory()) die(`worker worktree is not a directory: ${worktree}`);
        const current = await commandAsync('git', ['-C', worktree, 'rev-parse', '--abbrev-ref', 'HEAD']);
        if (!current.ok || current.stdout.trim() !== input.branch) die(`worker worktree is not on branch ${input.branch}`);
      }
      return { worktree, defaultBranch: input.default_branch || input.defaultBranch || null, branch: input.branch || null };
    }
    const repo = input.project_dir || input.projectDir || input.repo;
    if (!repo) die('worktree or project_dir required');
    const project = safeName(input.project || path.basename(repo), 'project');
    const thread = safeName(input.thread_id || input.threadId, 'thread id');
    let branch = input.branch || `wc/${thread}`;
    if (input.role === 'worker') {
      // Starts overlap while git runs, so the count alone can land on a branch already in use
      // (an earlier start failed, a later one took the next number). Skip any branch a recorded
      // worker holds or a start in progress has named.
      const workers = Object.values(this.sessions).filter(s => s.thread_id === thread && s.role === 'worker');
      const taken = new Set([...workers.map(s => s.branch), ...this.startingBranches]);
      let n = workers.length + 1;
      while (taken.has(`wc-${thread}-w${n}`)) n += 1;
      branch = `wc-${thread}-w${n}`;
    }
    safeName(branch, 'branch');
    if (input.role === 'worker') this.startingBranches.add(branch); // released by startNamed
    // A verifier checks out the thread's branch detached, so it needs a directory of its own
    // rather than the branch's, which the lead's worktree already holds.
    const destination = input.role === 'verifier'
      ? path.join(this.stateDir, 'worktrees', project, safeName(sessionName, 'session name'))
      : path.join(this.stateDir, 'worktrees', project, branch);
    // Two fetches into one repo at once can fail on ref locks, so starts in the same repo take
    // turns here; starts in other repos, and every other request, carry on meanwhile.
    const queued = this.inRepoQueue(path.resolve(repo), async () => {
      if (input.from_remote_branch !== undefined) {
        const sha = input.from_remote_branch?.sha;
        if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/.test(sha) || !/^wc\/[0-9a-f]{12}$/.test(branch)) die('invalid remote branch checkout');
        const remote = await this.fetchHandoffBranch(repo, branch);
        const ancestor = async (a, b) => (await commandAsync('git', ['-C', repo, 'merge-base', '--is-ancestor', a, b])).ok;
        if (!remote.remote_has_branch || !await ancestor(sha, remote.remote_tip)) die('requested commit is not on the remote branch');
        const run = async (...args) => {
          const result = await commandAsync('git', ['-C', repo, ...args]);
          if (!result.ok) die(result.stderr.trim() || 'git command failed');
          return result.stdout.trim();
        };
        const exists = await fsp.lstat(destination).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
        if (exists) {
          const symbolic = await commandAsync('git', ['-C', destination, 'symbolic-ref', '--quiet', '--short', 'HEAD']);
          const current = await commandAsync('git', ['-C', destination, 'rev-parse', '--verify', 'HEAD']);
          const top = await commandAsync('git', ['-C', destination, 'rev-parse', '--show-toplevel']);
          const worktrees = await run('worktree', 'list', '--porcelain');
          const registered = worktrees.split('\n').includes(`worktree ${path.resolve(destination)}`);
          if (!registered || !symbolic.ok || symbolic.stdout.trim() !== branch || !current.ok || !top.ok || path.resolve(top.stdout.trim()) !== path.resolve(destination) || !await ancestor(current.stdout.trim(), sha)) die(`the checkout folder for ${branch} is in an unexpected state`);
          await run('-C', destination, 'merge', '--ff-only', sha);
        } else {
          const local = await commandAsync('git', ['-C', repo, 'rev-parse', '--verify', `refs/heads/${branch}`]);
          if (!local.ok) await run('worktree', 'add', '-b', branch, destination, sha);
          else if (await ancestor(local.stdout.trim(), sha)) {
            await run('worktree', 'add', destination, branch);
            await run('-C', destination, 'merge', '--ff-only', sha);
          } else die(`a local branch ${branch} already exists and differs`);
        }
        await run('-C', destination, 'config', `branch.${branch}.remote`, 'origin');
        await run('-C', destination, 'config', `branch.${branch}.merge`, `refs/heads/${branch}`);
        await linkInstalledPackages(repo, destination);
        return { worktree: destination, defaultBranch: await this.defaultBranch(repo), branch };
      }
      const fetch = await commandAsync('git', ['-C', repo, 'fetch', 'origin']);
      if (!fetch.ok) die(fetch.stderr.trim() || 'git fetch failed');
      const defaultBranch = await this.defaultBranch(repo);
      const base = input.base || `origin/${defaultBranch}`;
      const args = input.role === 'verifier'
        ? ['-C', repo, 'worktree', 'add', '--detach', destination, input.verify_ref || base]
        // --no-track: a branch made from origin/main would otherwise track main, and a plain
        // push of the thread's branch is then refused.
        : ['-C', repo, 'worktree', 'add', '--no-track', '-b', branch, destination, base];
      const added = await commandAsync('git', args);
      if (!added.ok) die(added.stderr.trim() || 'git worktree add failed');
      await linkInstalledPackages(repo, destination);
      return { worktree: destination, defaultBranch, branch };
    });
    // A failed start never reaches startNamed's release, so it lets its branch name go here.
    return queued.catch((error) => { if (input.role === 'worker') this.startingBranches.delete(branch); throw error; });
  }
  async inRepoQueue(repo, work) {
    const previous = this.repoQueues.get(repo) || Promise.resolve();
    const run = previous.then(work, work);
    const tail = run.catch(() => {});
    this.repoQueues.set(repo, tail);
    try { return await run; } finally { if (this.repoQueues.get(repo) === tail) this.repoQueues.delete(repo); }
  }
  async defaultBranch(repo) {
    const symbolic = await commandAsync('git', ['-C', repo, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
    const remote = symbolic.stdout.trim();
    if (symbolic.ok && remote.startsWith('origin/') && remote.length > 'origin/'.length) return remote.slice('origin/'.length);
    const shown = await commandAsync('git', ['-C', repo, 'remote', 'show', 'origin']);
    const match = shown.stdout.match(/^\s*HEAD branch:\s*(\S+)\s*$/m);
    return match ? match[1] : 'main';
  }
  commandFor(input, session, worktree, promptPath, rolePrompt, mcp, context = {}) {
    const adapter = adapters[input.cli];
    if (!adapter) die('cli must be claude, codex, agy or kimi');
    return adapter.command(input, session, worktree, { stateDir: this.stateDir, promptPath, rolePrompt, mcp, tools: TOOL_ROLES.has(input.role), accountDir: session.account_dir, kimiExecutable: context.kimiExecutable });
  }

  threadWorktree(input, worktree) {
    try {
      const repo = input.project_dir || input.projectDir || input.repo;
      const project = safeName(input.project || (repo && path.basename(repo)), 'project');
      const thread = safeName(input.thread_id, 'thread id');
      return fs.realpathSync(worktree) === fs.realpathSync(path.join(this.stateDir, 'worktrees', project, 'wc', thread));
    } catch { return false; }
  }
  async tmuxPath() {
    return new Promise(resolve => {
      let stdout = '', done = false;
      const finish = value => { if (!done) { done = true; clearTimeout(timer); resolve(value); } };
      let child;
      try { child = spawn('tmux', ['show-environment', '-g', 'PATH'], { stdio: ['ignore', 'pipe', 'ignore'] }); }
      catch { return resolve(process.env.PATH || ''); }
      const timer = setTimeout(() => { child.kill('SIGKILL'); finish(process.env.PATH || ''); }, 2000);
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.on('error', () => finish(process.env.PATH || ''));
      child.on('close', code => finish(code === 0 && stdout.startsWith('PATH=') ? stdout.slice(5).replace(/\r?\n$/, '') : (process.env.PATH || '')));
    });
  }
  validProjectToolsState(value) {
    const plain = v => v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
    const lines = v => Array.isArray(v) && v.every(line => plain(line) && Array.isArray(line.names) && line.names.every(name => typeof name === 'string') && typeof line.text === 'string');
    return plain(value) && Number.isSafeInteger(value.seq) && value.seq >= 0 && lines(value.file) && lines(value.programs) && plain(value.clis) && Object.values(value.clis).every(cli => plain(cli) && lines(cli.lines) && typeof cli.thread === 'boolean' && (typeof cli.hash === 'string' || cli.hash === null));
  }
  updateProjectTools(input, session, worktree, promptPath, rolePrompt, read, built, thread, programs) {
    // Machines built without the constructor (some tests) get the maps on first use.
    this.projectToolsBoot ||= crypto.randomUUID(); this.projectToolsState ||= new Map(); this.projectToolsWrites ||= new Map();
    const id = encodeURIComponent(safeName(input.thread_id, 'thread id'));
    let state = this.projectToolsState.get(id);
    if (!state) {
      try { state = JSON.parse(fs.readFileSync(path.join(this.stateDir, 'project-tools', `${id}.json`), 'utf8')); }
      catch { state = null; }
      if (!this.validProjectToolsState(state)) state = { seq: 0, file: [], programs: [], clis: {} };
      this.projectToolsState.set(id, state);
    }
    const { mcp, warnings, hash } = read;
    if (mcp === null && warnings.length) {
      if (thread) state.file = warnings;
    } else if (mcp === null || mcp.names.length === 0) {
      if (thread) { state.file = []; state.programs = []; state.clis = {}; }
    } else {
      state.clis[input.cli] = { hash, thread, lines: built.warnings || [] };
      if (thread) { state.file = warnings; state.programs = programs; }
      for (const [cli, prior] of Object.entries(state.clis)) {
        if (cli === input.cli || !prior.lines.length || !(prior.hash === hash || (thread && prior.thread))) continue;
        const other = adapters[cli];
        if (!other) continue;
        const result = other.command({ ...input, cli, role: 'worker' }, { ...session }, worktree, { stateDir: this.stateDir, promptPath, rolePrompt, mcp, tools: true });
        state.clis[cli] = { hash, thread, lines: result.warnings || [] };
      }
    }
    state.seq += 1;
    const previous = this.projectToolsWrites.get(id) || Promise.resolve();
    const write = previous.then(async () => {
      const file = path.join(this.stateDir, 'project-tools', `${id}.json`), temp = `${file}.tmp`;
      try { await mkdir(path.dirname(file)); await fsp.writeFile(temp, `${json(this.projectToolsState.get(id))}\n`, { mode: 0o600 }); await fsp.rename(temp, file); }
      catch (error) { await fsp.unlink(temp).catch(() => {}); this.log(error); }
    });
    this.projectToolsWrites.set(id, write);
    session.project_tools = JSON.parse(json({ boot: this.projectToolsBoot, ...state }));
  }

  async start(input) {
    for (const key of ['role', 'cli', 'thread_id', 'token']) if (!input[key]) die(`missing ${key}`);
    const name = input.name || this.sessionName(input.thread_id, input.role);
    safeName(name, 'session name');
    if (!name.startsWith('wc-') || name.startsWith('wc-login-')) die('invalid session name');
    if (this.sessions[name]) return publicSession(this.sessions[name]);
    // The hub repeats a start it got no answer to, under the same name. Join the one still
    // running rather than create a second worktree and tmux session for it.
    if (this.startingNames.has(name)) return publicSession(await this.startingNames.get(name));
    const starting = this.startNamed(input, name);
    this.startingNames.set(name, starting);
    try { return publicSession(await starting); } finally { this.startingNames.delete(name); this.sweepAgyTools(); this.cancelledStarts.delete(name); }
  }
  async startNamed(input, name) {
    const adapter = adapters[input.cli];
    if (!adapter) die('cli must be claude, codex, agy or kimi');
    if (input.cli === 'kimi') { await this.checkKimiVersion(); const status = this.cliStatus('kimi'); if (!status.installed) die('Kimi Code is not installed'); if (status.problem) die(status.problem); }
    const account = input.account || { id: `default-${adapter.provider}`, dir: null };
    if (!account || typeof account.id !== 'string') die('invalid account');
    const dir = accountDir(account.dir, account.id);
    if (!dir && account.id !== `default-${adapter.provider}`) die('invalid default account');
    if (dir) adapter.seed(dir, account.id);
    await adapter.prepare?.(dir);
    const options = startOptions(input);
    if (input.cli === 'kimi') options.effort = null;
    const createdWorktree = !input.worktree;
    const reserved = input.role === 'worker' && input.worktree ? path.resolve(input.worktree) : null;
    if (reserved) this.refuseSharedWorktree(reserved, name);
    let created = null;
    try {
      const rolePrompt = composeRolePrompt(input);
      const promptPath = path.join(this.stateDir, 'prompts', `${name}.md`);
      await atomicWrite(promptPath, rolePrompt);
      created = await this.createWorktree(input, name);
      return await this.startIn(input, name, adapter, account, dir, options, createdWorktree, created, promptPath, rolePrompt);
    } finally {
      if (reserved) this.startingWorktrees.delete(reserved);
      if (created?.branch && input.role === 'worker') this.startingBranches.delete(created.branch);
    }
  }
  launchEnv(session, adapter) {
    return [['WHEELCHAIR_LANE', '1'], ...(adapter.sessionNameEnv ? [['WHEELCHAIR_SESSION_NAME', session.name]] : []), ['WHEELCHAIR_STATE_DIR', this.stateDir], ['WHEELCHAIR_MACHINE_ORIGIN', `http://${this.config.host}:${this.config.port}`], ...Object.entries(adapter.loginEnv(session.account_dir))];
  }
  async startIn(input, name, adapter, account, dir, options, createdWorktree, created, promptPath, rolePrompt) {
    const worktree = created.worktree;
    const session = { name, role: input.role, cli: input.cli, account: account.id, account_dir: dir, permission_mode: options.permission_mode, codex_mode: options.codex_mode, effort: options.effort, thread_id: input.thread_id, token: input.token,
      worktree, created_worktree: createdWorktree, attempt_id: input.attempt_id || null, started_by: input.started_by || null,
      branch: created.branch || input.branch || null, default_branch: created.defaultBranch || input.default_branch || input.defaultBranch || null,
      cli_session_id: input.cli_session_id || crypto.randomUUID(), status: 'starting', created_at: new Date().toISOString() };
    const read = await readProjectMcp(worktree);
    const { mcp, warnings } = read;
    const tools = TOOL_ROLES.has(input.role);
    const thread = tools && this.threadWorktree(input, worktree);
    let programs = [];
    if (thread && mcp && Object.keys(mcp.servers).length) programs = missingPrograms({ worktree, mcp, path: await this.tmuxPath() });
    const context = input.cli === 'kimi' ? { kimiExecutable: (await this.kimiLaunchPath()).executable } : {};
    const built = this.commandFor(input, session, worktree, promptPath, rolePrompt, mcp, context);
    if (TOOL_ROLES.has(input.role)) for (const warning of [...warnings, ...(built.warnings || [])]) console.error(`${session.name}: project tools: ${warning.text}`);
    if (tools) this.updateProjectTools(input, session, worktree, promptPath, rolePrompt, read, built, thread, programs);
    if (built.settingsPath) await atomicWrite(built.settingsPath, `${json(built.settings)}\n`);
    if (built.toolFiles) {
      const root = path.join(this.stateDir, 'agy-tools');
      for (const file of built.toolFiles.files) {
        const relative = path.relative(root, path.dirname(file.path));
        let dir = root;
        for (const part of ['', ...relative.split(path.sep)]) {
          if (part) dir = path.join(dir, part);
          await fsp.mkdir(dir, { recursive: true, mode: 0o700 });
          await fsp.chmod(dir, 0o700);
        }
        const temp = `${file.path}.${crypto.randomUUID()}.tmp`;
        await fsp.writeFile(temp, file.text, { mode: 0o600 });
        await fsp.chmod(temp, 0o600);
        await fsp.rename(temp, file.path);
      }
      const now = new Date();
      await fsp.utimes(built.toolFiles.dir, now, now);
    }
    let wrapper = [];
    if (mcp && TOOL_ROLES.has(input.role) && (input.cli === 'claude' || input.cli === 'codex') && Object.keys(keyReferences(mcp.rawServers).references).length) {
      try {
        const identity = await projectIdentity(worktree, commandAsync);
        const store = await readKeyStore(this.stateDir, identity);
        const { env, heldBack } = launchKeys(mcp.rawServers, store);
        if (heldBack.length) console.error(`${session.name}: project tools: held back ${heldBack.join(', ')}: also used in a command, args or URL`);
        if (Object.keys(env).length) {
          const envDir = path.join(this.stateDir, 'session-env');
          await mkdir(envDir);
          const file = path.join(envDir, `${name}.json`);
          await fsp.writeFile(file, JSON.stringify(env), { mode: 0o600 });
          await fsp.chmod(file, 0o600);
          wrapper = [process.execPath, path.join(__dirname, 'lib', 'env-launch.js'), file];
        }
      } catch (error) { console.error("the key store on this machine can't be read"); }
    }
    const env = this.launchEnv(session, adapter);
    env.splice(adapter.sessionNameEnv ? 2 : 1, 0, ['WHEELCHAIR_SESSION_TOKEN', session.token]);
    const commandText = ['env', ...env.map(([key, value]) => `${key}=${value}`), ...Object.entries(built.env || {}).map(([key, value]) => `${key}=${value}`), ...wrapper, ...built.argv].map(shellQuote).join(' ');
    const redactions = new Set(built.redactions || []);
    session.command = built.argv.map((arg, index) => redactions.has(index) ? `${arg.slice(0, arg.indexOf('=') + 1)}<redacted>` : arg);
    session.pending_initial = adapter.firstMessage(input, promptPath, name);
    const tmuxArgs = ['new-session', '-d', '-s', name, '-x', '200', '-y', '50', '-c', worktree, commandText];
    // systemd-run scope prevents service restarts killing tmux; installer sets KillMode=process too.
    // Both asynchronous, like the git above: a slow systemd-run must not hold up the service.
    if (this.cancelledStarts.has(name)) die('session start was cancelled');
    const scoped = process.platform === 'darwin' ? { ok: false } : await commandAsync('systemd-run', ['--user', '--scope', `--description=wheelchair ${name}`, 'tmux', ...tmuxArgs]);
    if (this.cancelledStarts.has(name)) { if (scoped.ok) this.tmux(['kill-session', '-t', `=${name}`]); die('session start was cancelled'); }
    const result = scoped.ok ? scoped : await commandAsync('tmux', tmuxArgs);
    if (this.cancelledStarts.has(name)) { if (result.ok) this.tmux(['kill-session', '-t', `=${name}`]); die('session start was cancelled'); }
    if (!result.ok) die(result.stderr.trim() || 'tmux session failed to start');
    this.sessions[name] = session;
    await this.persistSessions();
    try {
      await fsp.appendFile(path.join(this.stateDir, 'session-ledger.jsonl'), `${json({ at: new Date().toISOString(), name, role: input.role, provider: adapter.provider, model: input.model || null, account_dir: dir, cli_session_id: session.cli_session_id, thread_id: input.thread_id })}\n`);
    } catch (error) { console.error('session ledger append failed:', error.message); }
    await this.checkReady(session);
    return session;
  }
  readyText(session, pane) {
    return adapters[session.cli]?.readyText(session, pane) || false;
  }

  async emitEvent(event) {
    const spool = await this.spool('events', event);
    await this.drainSpool('events');
    return spool;
  }
  async fatalKimi(session, reason) {
    if (!session.end_reason) { session.end_reason = reason; await this.persistSessions(); }
    return this.stopFatal(session);
  }
  async stopFatal(session) {
    this.tmux(['kill-session', '-t', `=${session.name}`]);
    const live = this.liveTmux();
    if (!live || live.has(session.name)) return { pending: true, end_reason: session.end_reason };
    session.status = 'stopped'; session.prompt_open = false; session.stopped_at = new Date().toISOString();
    await this.persistSessions();
    if (session.role === 'verifier' && session.created_worktree) command('git', ['-C', session.worktree, 'worktree', 'remove', '--force', session.worktree]);
    return { ok: true, end_reason: session.end_reason };
  }
  async kimiBinding(session) {
    try {
      const had = session.source_transcript;
      const file = await adapters.kimi.findTranscript(session, session.account_dir);
      if (!had && file) await this.persistSessions();
      return file;
    } catch (error) {
      if (!error.kimiFatal) throw error;
      await this.fatalKimi(session, error.message); return null;
    }
  }
  async kimiSpoolWaiting(session) {
    const dir = path.join(this.stateDir, 'spool', 'events');
    for (const file of await fsp.readdir(dir).catch(() => [])) {
      if (!file.endsWith('.json')) continue;
      const item = await readJson(path.join(dir, file), {});
      if (item.session === session.name) return true;
    }
    return false;
  }
  async pollKimiTurns() {
    if (this.kimiPolling) return;
    this.kimiPolling = true;
    try {
      for (const session of Object.values(this.sessions)) {
        if (session.cli !== 'kimi' || session.status === 'stopped') continue;
        if (session.end_reason) { await this.stopFatal(session); continue; }
        if (session.status !== 'ready') continue;
        const file = await this.kimiBinding(session);
        if (session.end_reason) continue;
        if (!file) {
          if (Date.now() - Date.parse(session.ready_at) >= 120000) await this.fatalKimi(session, "Couldn't find Kimi Code's log for this session");
          continue;
        }
        let data, stat, handle, ioError, otherError;
        const offset = session.kimi_offset || 0;
        try { handle = await fsp.open(file, 'r'); } catch (error) { ioError = error; }
        if (handle) {
          try {
            try { stat = await handle.stat(); } catch (error) { ioError = error; }
            if (!ioError && stat.dev === session.kimi_log_id?.dev && stat.ino === session.kimi_log_id?.ino && stat.size >= offset) {
              let buffer;
              try { buffer = Buffer.alloc(stat.size - offset); } catch (error) { otherError = error; }
              if (buffer) {
                try { const { bytesRead } = await handle.read(buffer, 0, buffer.length, offset); data = buffer.subarray(0, bytesRead); }
                catch (error) { ioError = error; }
              }
            }
          } finally { await handle.close().catch(error => this.log(error)); }
        }
        if (otherError) { this.log(otherError); continue; }
        if (ioError) {
          if (session.kimi_missing_since === undefined) { session.kimi_missing_since = Date.now(); await this.persistSessions(); }
          if (Date.now() - session.kimi_missing_since >= 30000) await this.fatalKimi(session, "Kimi Code's log for this session disappeared or was replaced");
          continue;
        }
        try {
          if (!data) {
            await this.fatalKimi(session, "Kimi Code's log for this session disappeared or was replaced"); continue;
          }
          if (session.kimi_missing_since !== undefined) { delete session.kimi_missing_since; await this.persistSessions(); }
          const end = data.lastIndexOf(10);
          if (end < 0 || await this.kimiSpoolWaiting(session)) continue;
          const rows = data.subarray(0, end + 1).toString('utf8').split('\n').map(line => { try { return JSON.parse(line); } catch { return null; } });
          const turns = rows.filter(row => row?.type === 'turn.ended' && row.agentId === 'main' && Number.isInteger(row.turnId) && (session.kimi_last_turn === undefined || row.turnId > session.kimi_last_turn)).sort((a,b) => a.turnId-b.turnId);
          let handedOffAll = true;
          for (const row of turns) {
            if (session.kimi_last_turn !== undefined && row.turnId <= session.kimi_last_turn) continue;
            if (await this.kimiSpoolWaiting(session)) { handedOffAll = false; break; }
            let event = { type: 'turn-ended', turn_id: row.turnId, transcript_path: file };
            if (row.reason === 'cancelled') event.interrupted = true;
            else if (row.reason === 'failed') {
              let error = row.error, messages = [], codes = [];
              if (typeof error === 'string') messages.push(error);
              else for (let e = error; e && typeof e === 'object'; e = e.cause) { if (e.message) messages.push(String(e.message)); if (e.code) codes.push(String(e.code)); if (typeof e.cause === 'string') messages.push(e.cause); }
              const message = (typeof error === 'object' && error?.code ? `[${error.code}] ` : '') + (messages.join(': ') || 'Kimi Code turn failed');
              event = { ...event, type: codes.some(code => /rate_limit|quota/i.test(code)) || /quota|rate.?limit|429|too many requests/i.test(message) ? 'limit-hit' : 'turn-failed', error: message };
            } else if (row.reason !== 'completed') event = { ...event, type: 'turn-failed', error: `Kimi Code turn ended (${row.reason})` };
            await this.hook(session.name, event);
            session.kimi_last_turn = row.turnId;
            await this.persistSessions();
          }
          if (handedOffAll && !await this.kimiSpoolWaiting(session)) { session.kimi_offset = offset + end + 1; await this.persistSessions(); }
        } catch (error) { this.log(error); }
      }
    } finally { this.kimiPolling = false; }
  }
  async pollCodexSteps() {
    const live = this.liveTmux();
    if (!live) return;
    await Promise.all(Object.values(this.sessions).filter(s => s.cli === 'codex' && s.codex_thread_id && live.has(s.name)).map(s => this.readCodexSteps(s)));
  }
  async readCodexSteps(session, { spoolOnly = false, flush = false } = {}) {
    const previous = this.stepReads.get(session.name) || Promise.resolve();
    const reading = previous.catch(() => {}).then(async () => {
      if (!session.codex_thread_id) return;
      const file = session.source_transcript || await adapters.codex.findTranscript(session, session.account_dir);
      if (!file) return;
      session.source_transcript = file;
      let handle;
      try {
        handle = await fsp.open(file, 'r');
      } catch (error) { if (error.code === 'ENOENT') return; throw error; }
      try {
        const size = (await handle.stat()).size;
        let start = session.steps_offset || 0;
        if (size < start) { start = 0; session.steps_offset = 0; session.steps_state = {}; }
        while (start < size) {
          const length = Math.min(size - start, this.codexStepChunkSize);
          const data = Buffer.alloc(length);
          const { bytesRead } = await handle.read(data, 0, length, start);
          if (!bytesRead) break;
          const end = data.subarray(0, bytesRead).lastIndexOf(10);
          const state = JSON.parse(JSON.stringify(session.steps_state || {}));
          if (end < 0) {
            if (bytesRead === this.codexStepChunkSize) {
              session.steps_offset = start + bytesRead;
              await this.persistSessions();
            } else break; // Leave an incomplete trailing line for the next read.
          } else {
            const complete = data.subarray(0, end + 1);
            const events = readCodexSteps(state, complete.toString('utf8').split('\n'), { cwd: session.worktree });
            for (const event of events) await this.spool('events', { ...event, session: session.name, thread_id: session.thread_id, prepared: true });
            session.steps_offset = start + end + 1; session.steps_state = state;
            await this.persistSessions();
          }
          start = session.steps_offset;
          if (!flush) break;
        }
      } finally { await handle.close(); }
    });
    this.stepReads.set(session.name, reading);
    try { await reading; } finally { if (this.stepReads.get(session.name) === reading) this.stepReads.delete(session.name); }
    if (!spoolOnly) await this.drainSpool('events');
  }
  async checkReady(session) {
    if (session.status === 'ready') return true;
    let pane;
    try { pane = this.pane(session.name); } catch { return false; }
    const prompt = adapters[session.cli]?.answerPrompts(session, pane);
    if (prompt) {
      for (const key of prompt.keys) this.tmux(['send-keys', '-t', session.name, key]);
      if (prompt.step === 'trust') { session.trust_answered = true; await this.persistSessions(); }
      return false;
    }
    if (this.readyText(session, pane)) {
      const changed = session.status !== 'ready';
      session.status = 'ready'; session.ready_at = new Date().toISOString();
      await this.persistSessions();
      if (session.pending_initial) {
        const initial = session.pending_initial;
        session.pending_initial = '';
        await this.persistSessions();
        await this.submit(session.name, initial);
      }
      if (changed) await this.emitEvent({ type: 'ready', session: session.name, thread_id: session.thread_id });
      return true;
    }
    const age = Date.now() - new Date(session.created_at).getTime();
    if (age >= 30_000 && session.status !== 'stuck') {
      session.status = 'stuck'; await this.persistSessions();
      await this.emitEvent({ type: 'stuck', session: session.name, thread_id: session.thread_id });
    }
    return false;
  }
  // Only a session still coming up (or stuck coming up) is watched: a stopped one shutting down
  // never shows the ready screen and would otherwise be reported stuck.
  async pollReadiness() {
    const watched = Object.values(this.sessions);
    await Promise.all([
      ...watched.filter(s => s.status === 'starting' || s.status === 'stuck').map(s => this.checkReady(s)),
      ...watched.filter(s => s.prompt_open && s.status === 'ready').map(s => this.checkPrompt(s)),
      ...watched.filter(s => s.status === 'ready' && !s.prompt_open && adapters[s.cli]?.promptText).map(async s => {
        let pane; try { pane = this.pane(s.name); } catch { return; }
        if (adapters[s.cli].promptText(pane)) await this.hook(s.name, { type: 'prompt', notification_type: 'permission_prompt' });
      }),
    ]);
  }
  async pollTrust() {
    const now = Date.now();
    await Promise.all(Object.values(this.sessions)
      .filter(session => adapters[session.cli]?.answerPrompts && session.status === 'starting'
        && now - new Date(session.created_at).getTime() < 30_000)
      .map(session => this.checkReady(session)));
  }
  // A permission prompt the service relayed is cleared once the pane shows the input screen again.
  async checkPrompt(session) {
    let pane;
    try { pane = this.pane(session.name); } catch { return false; }
    if (!this.readyText(session, pane)) return false;
    session.prompt_open = false; await this.persistSessions();
    await this.emitEvent({ type: 'prompt-cleared', session: session.name, thread_id: session.thread_id });
    return true;
  }
  async submit(name, text) {
    const session = this.managed(name);
    if (session.end_reason) throw Object.assign(new Error(session.end_reason), { status: 409 });
    if (session.status !== 'ready') throw Object.assign(new Error('session is not ready'), { status: 409 });
    const buffer = `wc-${crypto.randomUUID()}`;
    const loaded = this.tmux(['load-buffer', '-b', buffer, '-'], { input: text });
    if (!loaded.ok) throw Object.assign(new Error('tmux buffer failed'), { status: 409 });
    const pasted = this.tmux(['paste-buffer', '-p', '-b', buffer, '-t', name]);
    const enter = this.tmux(['send-keys', '-t', name, 'Enter']);
    if (!pasted.ok || !enter.ok) throw Object.assign(new Error('tmux submit failed'), { status: 409 });
  }
  raw(name, keys) {
    const session = this.managed(name);
    if (session.end_reason) throw Object.assign(new Error(session.end_reason), { status: 409 });
    const result = this.tmux(['send-keys', '-t', name, keys]);
    if (!result.ok) throw Object.assign(new Error('tmux keys failed'), { status: 409 });
  }
  async stop(name) {
    const session = this.managed(name);
    if (session.end_reason) return this.stopFatal(session);
    this.tmux(['kill-session', '-t', name]);
    session.prompt_open = false;
    session.status = 'stopped'; session.stopped_at = new Date().toISOString();
    this.screens.killSession(name);
    await this.persistSessions();
    if (session.role === 'verifier' && session.created_worktree) command('git', ['-C', session.worktree, 'worktree', 'remove', '--force', session.worktree]);
    this.sweepAgyTools();
  }
  gitPath(worktree, name) {
    const result = command('git', ['-C', worktree, 'rev-parse', '--git-path', name]);
    return result.ok ? result.stdout.trim() : null;
  }
  mergeInProgress(worktree) {
    const marker = this.gitPath(worktree, 'MERGE_HEAD');
    return Boolean(marker && fs.existsSync(marker));
  }
  rebaseInProgress(worktree) {
    return ['rebase-merge', 'rebase-apply'].some(name => {
      const marker = this.gitPath(worktree, name);
      return marker && fs.existsSync(marker);
    });
  }
  archiveCommit(worktree, message) {
    const added = command('git', ['-C', worktree, 'add', '-A']);
    if (!added.ok) return { ok: false, reason: added.stderr.trim() || 'git add failed' };
    const committed = command('git', ['-C', worktree, 'commit', '-m', message]);
    if (!committed.ok) return { ok: false, reason: committed.stderr.trim() || 'git commit failed' };
    const head = command('git', ['-C', worktree, 'rev-parse', 'HEAD']);
    return head.ok ? { ok: true, commit: head.stdout.trim() } : { ok: false, reason: head.stderr.trim() || 'git rev-parse failed' };
  }
  async archive(threadId) {
    if (typeof threadId !== 'string' || !threadId) throw Object.assign(new Error('thread_id required'), { status: 400 });
    threadName(threadId);
    this.closingThreads.set(threadId, (this.closingThreads.get(threadId) || 0) + 1);
    for (const request of this.uploadRequests.get(threadId) || []) request.destroy();
    try { return await this.withThreadLock(threadId, async () => {
    this.archivingThreads.add(threadId);
    try {
    await this.persistArchiveMarkers();
    this.screens.killThread(threadId);
    const sessions = Object.values(this.sessions).filter(session => !session.name.startsWith('wc-login-') && session.thread_id === threadId);
    const stopped = []; const pending = [];
    // Confirm fatal stops before touching any other session or worktree. A retry can
    // then archive the entire thread without a partially processed checkout.
    for (const session of sessions.filter(session => session.end_reason && !session.archived_pending)) {
      const result = await this.stop(session.name);
      if (result?.pending) pending.push(session);
      else stopped.push(session.name);
    }
    if (pending.length) return { pending: true, pending_sessions: pending.map(session => session.name), stopped, committed: [], removed: [], kept: pending.map(session => ({ worktree: session.worktree, reason: session.end_reason })) };
    for (const session of sessions) {
      if (session.archived_pending || session.end_reason) continue;
      await this.stop(session.name);
      stopped.push(session.name);
    }
    const worktrees = [...new Map(sessions
      .filter(session => session.created_worktree && session.role !== 'verifier')
      .map(session => [path.resolve(session.worktree), session])).values()];
    const committed = []; const removed = []; const kept = [];
    for (const session of worktrees) {
      const worktree = path.resolve(session.worktree);
      // A worker checkout the sub-lead already merged and removed has nothing left to keep.
      // Only a confirmed ENOENT counts: an unreadable path (EACCES) may still hold work.
      try { fs.statSync(worktree); } catch (error) { if (error.code === 'ENOENT') continue; }
      if (this.mergeInProgress(worktree)) {
        const result = this.archiveCommit(worktree, 'WIP: archived (mid-merge)');
        if (!result.ok) { kept.push({ worktree, reason: result.reason }); continue; }
        committed.push({ worktree, commit: result.commit });
      } else if (this.rebaseInProgress(worktree)) {
        kept.push({ worktree, reason: 'rebase in progress' });
        continue;
      } else {
        const status = command('git', ['-C', worktree, 'status', '--porcelain']);
        if (!status.ok) { kept.push({ worktree, reason: status.stderr.trim() || 'git status failed' }); continue; }
        if (status.stdout.trim()) {
          const result = this.archiveCommit(worktree, 'WIP: archived');
          if (!result.ok) { kept.push({ worktree, reason: result.reason }); continue; }
          committed.push({ worktree, commit: result.commit });
        }
      }
      const clean = command('git', ['-C', worktree, 'status', '--porcelain']);
      if (!clean.ok) { kept.push({ worktree, reason: clean.stderr.trim() || 'git status failed' }); continue; }
      if (clean.stdout.trim()) { kept.push({ worktree, reason: 'worktree has uncommitted changes' }); continue; }
      const result = command('git', ['-C', worktree, 'worktree', 'remove', worktree]);
      if (!result.ok) { kept.push({ worktree, reason: result.stderr.trim() || 'git worktree remove failed' }); continue; }
      removed.push(worktree);
    }
    const keptWorktrees = new Set(kept.map(item => path.resolve(item.worktree)));
    for (const session of sessions) {
      const worktree = typeof session.worktree === 'string' ? path.resolve(session.worktree) : null;
      if (worktree && keptWorktrees.has(worktree)) {
        // A rebase cannot be safely archived. Keep enough ownership information for a later
        // archive after it is resolved, while making clear that this session is no longer live.
        session.archived_pending = true;
        session.status = 'stopped';
        session.running = false;
      } else {
        delete this.sessions[session.name];
      }
    }
    await this.persistSessions();
    let uploads_removed = null; let uploads_error;
    if (!kept.some(item => item.reason === 'rebase in progress')) {
      // Only a finished archive counts: the hub reopens a thread whose archive kept a rebase or
      // could not remove its uploads, and that thread takes uploads again. Still inside the lock,
      // so an upload queued behind it sees this.
      try { await fsp.rm(path.join(this.stateDir, 'uploads', threadId), { recursive: true, force: true }); uploads_removed = true; this.archivedThreads.add(threadId); await this.screens.removeThreadDir(threadId); }
      catch (error) { uploads_removed = false; uploads_error = error.message; }
    }
    return { stopped, committed, removed, kept, uploads_removed, ...(uploads_error ? { uploads_error } : {}) };
    } finally {
      this.archivingThreads.delete(threadId);
      await this.persistArchiveMarkers();
    }
    }); } finally {
      const remaining = this.closingThreads.get(threadId) - 1;
      if (remaining) this.closingThreads.set(threadId, remaining); else this.closingThreads.delete(threadId);
    }
  }
  // One copy at a time per session: two overlapping copies read the same offset and the
  // same copied file, so both would append the same new lines.
  copyTranscript(session, source, followup) {
    this.copying ??= new Map();
    const before = this.copying.get(session.name) || Promise.resolve();
    const run = before.catch(() => {}).then(async () => { let result; try { result = await this.copyTranscriptNow(session, source); } catch (error) { if (!followup || error.code !== 'ENOENT') throw error; } return followup ? followup() : result; });
    const settled = run.catch(() => {});
    this.copying.set(session.name, settled);
    settled.then(() => { if (this.copying.get(session.name) === settled) this.copying.delete(session.name); });
    return run;
  }
  async copyTranscriptNow(session, source) {
    if (!source || (session.cli === 'kimi' && session.end_reason)) return { offset: 0, lines: [] };
    let stat = session.cli === 'kimi' ? null : await fsp.stat(source);
    const current = session.transcript_source;
    let begin = session.cli === 'kimi' ? (current?.offset || 0) : (current && (current.path !== source || stat.size < current.offset || stat.ino !== current.ino) ? 0 : (current?.offset || 0));
    if (session.cli !== 'kimi' && current?.path === source && current.ino === stat.ino && stat.size === current.offset && session.transcript_path && !session.transcript_unsaved) return { offset: current.offset, lines: [] };
    const file = await fsp.open(source, 'r'); let text;
    try { if (session.cli === 'kimi') { stat = await file.stat(); if (stat.dev !== session.kimi_log_id?.dev || stat.ino !== session.kimi_log_id?.ino || stat.size < begin || session.end_reason) return { offset: begin, lines: [] }; if (stat.size === begin && current?.path === source && current.ino === stat.ino && session.transcript_path && !session.transcript_unsaved) return { offset: begin, lines: [] }; } const size = stat.size - begin; const buffer = Buffer.alloc(Math.max(size, 0)); await file.read(buffer, 0, buffer.length, begin); text = buffer.toString('utf8'); } finally { await file.close(); }
    // A JSONL record isn't durable until its newline arrives.  Leave an unfinished
    // tail for the next read instead of copying a fragment and advancing past it.
    const newline = text.lastIndexOf('\n');
    const complete = newline < 0 ? '' : text.slice(0, newline + 1);
    const lines = complete ? complete.slice(0, -1).split('\n') : [];
    const nextOffset = begin + Buffer.byteLength(complete);
    const target = path.join(this.stateDir, 'transcripts', session.thread_id, `${session.name}.jsonl`);
    let additions = [];
    if (lines.length) {
      let copied = '';
      try { copied = await fsp.readFile(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (copied && !copied.endsWith('\n')) { copied = copied.slice(0, copied.lastIndexOf('\n') + 1); await fsp.truncate(target, Buffer.byteLength(copied)); }
      const hashes = new Set(copied.split('\n').filter(Boolean).map(line => crypto.createHash('sha256').update(line).digest('hex')));
      additions = lines.filter(line => { const hash = crypto.createHash('sha256').update(line).digest('hex'); if (hashes.has(hash)) return false; hashes.add(hash); return true; });
      if (additions.length) { await mkdir(path.dirname(target)); await fsp.appendFile(target, `${additions.join('\n')}\n`, { mode: 0o600 }); }
    }
    const changed = session.transcript_path !== target || !current || current.path !== source || current.offset !== nextOffset || current.ino !== stat.ino;
    session.transcript_path = target;
    session.transcript_source = { path: source, offset: nextOffset, ino: stat.ino };
    if (changed || session.transcript_unsaved) {
      try { await this.persistSessions(); delete session.transcript_unsaved; }
      catch (error) { session.transcript_unsaved = true; throw error; }
    }
    return { offset: nextOffset, lines: additions };
  }
  async readTranscript(file, offset, known) {
    if (!file) return { offset: 0, data: '' };
    let handle;
    try { handle = await fsp.open(file, 'r'); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    try {
      const stat = await handle.stat(); const gen = `${stat.dev}-${stat.ino}-${stat.birthtimeMs}`; const end = stat.size;
      const split = typeof known === 'string' ? known.lastIndexOf(':') : -1;
      if (split > 0 && /^(0|[1-9]\d*)$/.test(known.slice(split + 1)) && known === `${gen}:${end}`) return { unchanged: true, gen, end };
      const buffer = Buffer.alloc(end); let read = 0;
      while (read < end) { const result = await handle.read(buffer, read, end - read, read); if (!result.bytesRead) throw new Error('transcript truncated during read'); read += result.bytesRead; }
      return { offset: end, data: buffer.subarray(Number(offset)).toString('utf8'), gen, end };
    } finally { await handle.close(); }
  }
  async transcript(name, offset = 0, known) {
    let session;
    try { session = this.managed(name); } catch (error) {
      // Forgotten archived sessions have no copier, but retain their transcript.
      const thread = /^wc-([A-Za-z0-9]+)-[a-z]/.exec(safeName(name, 'session name'))?.[1];
      const kept = thread && await this.readTranscript(path.join(this.stateDir, 'transcripts', thread, `${name}.jsonl`), offset, known);
      if (!kept) throw error;
      return kept;
    }
    if (!session.source_transcript && !session.end_reason) { if (session.cli === 'kimi') await this.kimiBinding(session); else session.source_transcript = await adapters[session.cli]?.findTranscript(session, session.account_dir); }
    return this.copyTranscript(session, session.source_transcript, async () => await this.readTranscript(session.transcript_path, offset, known) || { offset: 0, data: '' });
  }
  async spool(kind, payload) {
    const dir = path.join(this.stateDir, 'spool', kind);
    await mkdir(dir);
    const deliveryId = payload.delivery_id || crypto.randomUUID();
    const name = `${String(Date.now()).padStart(15, '0')}-${deliveryId}.json`;
    const file = path.join(dir, name);
    const stored = { ...payload, delivery_id: deliveryId };
    await atomicWrite(file, `${json(stored)}\n`);
    return { file, payload: stored };
  }
  deliveryId(file) {
    const match = /-([0-9a-f-]{36})\.json$/i.exec(file);
    return match ? match[1] : crypto.randomUUID();
  }
  async rejectSpool(kind, file, reason) {
    const from = path.join(this.stateDir, 'spool', kind, file);
    const toDir = path.join(this.stateDir, 'spool', 'rejected', kind);
    await mkdir(toDir);
    await fsp.rename(from, path.join(toDir, file));
    this.log(`rejected ${kind} spool ${file}: ${reason}`);
  }
  async drainSpool(kind) {
    if (this.drains.has(kind)) return this.drains.get(kind);
    const running = this.drainSpoolNow(kind).finally(() => this.drains.delete(kind));
    this.drains.set(kind, running);
    return running;
  }
  async drainSpoolNow(kind) {
    if (!this.config.hub_url) return;
    const dir = path.join(this.stateDir, 'spool', kind);
    const files = (await fsp.readdir(dir).catch(() => [])).filter(f => f.endsWith('.json')).sort();
    for (const file of files) {
      let payload = await readJson(path.join(dir, file), null); if (!payload) continue;
      payload.delivery_id ||= this.deliveryId(file);
      if (kind === 'events' && payload.prepared !== true) {
        try {
          const prepared = await this.hook(payload.session, payload, { spooled: true });
          if (prepared.ignored) { await this.rejectSpool(kind, file, 'event ignored by the live hook handler'); continue; }
          payload = { ...prepared.event, delivery_id: payload.delivery_id };
        } catch (error) { await this.rejectSpool(kind, file, error.message || String(error)); continue; }
        await atomicWrite(path.join(dir, file), `${json(payload)}\n`);
      }
      try {
        const { prepared: ignoredPrepared, ...eventBody } = payload;
        const response = await requestJson(`${this.config.hub_url.replace(/\/$/, '')}/api/machine/${kind}`, 'POST', { [HUB_HEADER]: await this.secret() }, kind === 'events' ? eventBody : payload);
        if (response.status >= 200 && response.status < 300) { if (kind === 'cards') await this.sudo.accepted(payload); await fsp.unlink(path.join(dir, file)); continue; }
        if (response.status >= 400 && response.status < 500) {
          let reason = `hub refused (${response.status})`;
          try { reason = JSON.parse(response.body || '{}').error || reason; } catch { /* keep status */ }
          if (kind === 'cards') await this.sudo.dropped(payload);
          await this.rejectSpool(kind, file, reason);
          continue;
        }
        break;
      } catch { break; }
    }
  }
  async hook(session, event, { spooled = false } = {}) {
    const current = this.managed(session);
    const adapter = adapters[current.cli];
    if (event.transcript_path) { current.source_transcript = event.transcript_path; await this.copyTranscript(current, event.transcript_path); }
    if (event.type === 'turn-ended' && adapter.onTurnEnded) {
      const result = await adapter.onTurnEnded(current, event);
      if (result.ignored) return { ignored: true };
      if (current.cli === 'codex') {
        await this.readCodexSteps(current, { spoolOnly: spooled, flush: true });
        // The hub closes any still-running steps at the turn boundary.
        current.steps_state = { open: {}, yielded: null };
      }
      if (result.reading) {
        const { reached, ...reading } = result.reading;
        reading.account = current.account || `default-${adapter.provider}`;
        if (reached) reading.limited_until = limitedUntil(reading);
        current.last_reading = reading;
        event = { ...event, reading };
      }
      await this.persistSessions();
    }
    if (event.type === 'usage-source') {
      const reading = adapter.usageFrom(event.payload);
      if (!reading) return { ignored: true };
      reading.account = current.account || `default-${adapter.provider}`;
      current.last_reading = reading; await this.persistSessions();
      event = { type: 'usage', reading };
    }
    if (event.type === 'limit-hit') event = { ...event, limited_until: limitedUntil(current.last_reading) };
    if (event.type === 'prompt' && event.notification_type !== 'permission_prompt') return { ignored: true };
    const { session: ignoredSession, thread_id: ignoredThread, delivery_id: ignoredDelivery, ...rest } = event;
    const forwarded = { ...rest, session, thread_id: current.thread_id, prepared: true };
    if (event.type === 'prompt') { current.prompt_open = true; await this.persistSessions(); }
    if (spooled) return { ok: true, event: forwarded };
    await this.emitEvent(forwarded);
    return { ok: true };
  }
  // Spec "Branches and checkouts": a sub-lead removes a worker's worktree once that worker is done and merged.
  async removeWorkerWorktree(caller, workerName, cwd) {
    if (caller.role !== 'sub-lead') die('only a sub-lead may remove a worker worktree');
    const worker = this.sessions[workerName];
    if (!worker || worker.role !== 'worker' || worker.thread_id !== caller.thread_id) die('args[0] must name a worker session of this thread');
    if (!worker.created_worktree || worker.worktree_removed) die('worker has no removable worktree');
    const live = worker.status === 'stopped' ? new Set() : this.liveTmux();
    if (!live) die('tmux could not be checked; try again');
    if (live.has(worker.name)) die('worker is still running');
    const branch = command('git', ['-C', worker.worktree, 'rev-parse', '--abbrev-ref', 'HEAD']);
    if (!branch.ok || !branch.stdout.trim() || branch.stdout.trim() === 'HEAD') die('worker branch cannot be determined');
    if (!command('git', ['merge-base', '--is-ancestor', branch.stdout.trim(), 'HEAD'], { cwd }).ok) die('worker branch is not fully merged into yours');
    const result = command('git', ['worktree', 'remove', path.resolve(worker.worktree)], { cwd });
    if (result.ok) { worker.worktree_removed = true; await this.persistSessions(); }
    return { ok: result.ok, status: result.status, stdout: result.stdout, stderr: result.stderr };
  }
  async git(session, input) {
    const operation = input.operation; const args = Array.isArray(input.args) ? input.args.map(String) : [];
    const allowed = new Set(['fetch', 'commit', 'merge', 'cherry-pick', 'revert', 'push', 'pr', 'worktree-remove']);
    if (!allowed.has(operation)) die('unsupported git operation');
    if (operation === 'commit' && (!Array.isArray(input.paths) || input.paths.length === 0)) throw Object.assign(new Error('commit requires explicit paths'), { status: 400 });
    if (operation === 'commit' && !String(input.message || '').trim()) throw Object.assign(new Error('commit requires a message'), { status: 400 });
    const cwd = path.resolve(session.worktree);
    if (operation === 'worktree-remove') return this.removeWorkerWorktree(session, args[0], cwd);
    if (operation === 'commit' && input.paths.some(item => {
      const candidate = path.resolve(cwd, String(item));
      return candidate !== cwd && !candidate.startsWith(`${cwd}${path.sep}`);
    })) throw Object.assign(new Error('path is outside the calling session worktree'), { status: 403 });
    const run = (program, argv) => command(program, argv, { cwd });
    let result;
    if (operation === 'commit') result = run('git', ['add', '--', ...input.paths,]);
    if (operation === 'commit' && result.ok) {
      const merging = run('git', ['rev-parse', '-q', '--verify', 'MERGE_HEAD']).ok;
      result = run('git', ['commit', '-m', input.message, ...(merging ? [] : ['--', ...input.paths])]);
    }
    if (operation === 'fetch') result = run('git', ['fetch', ...args]);
    if (operation === 'merge') result = run('git', ['merge', ...args]);
    if (operation === 'cherry-pick') result = run('git', ['cherry-pick', ...args]);
    if (operation === 'revert') result = run('git', ['revert', ...args]);
    if (operation === 'push') result = run('git', ['push', ...args]);
    if (operation === 'pr') result = run('gh', ['pr', 'create', ...args]);
    return { ok: result.ok, status: result.status, stdout: result.stdout, stderr: result.stderr };
  }
  async forwardSession(agent, input) {
    if (!this.config.hub_url) throw Object.assign(new Error('hub unavailable'), { status: 503 });
    const until = Date.now() + this.retryWindow;
    while (true) {
      try {
        const response = await requestJson(`${this.config.hub_url.replace(/\/$/, '')}/api/machine/session`, 'POST', { [HUB_HEADER]: await this.secret() }, { ...input, calling_session: agent.name });
        if (response.status >= 200 && response.status < 300) return JSON.parse(response.body || '{}');
        // The hub answered and refused: retrying repeats the refusal and, for a start, records
        // another failed session each time. Hand the agent the hub's own reason instead.
        // Only an unreachable or overloaded hub (502-504, or no answer) is worth retrying.
        if (response.status < 502 || response.status > 504) {
          let reason = 'hub refused the request';
          try { const body = JSON.parse(response.body || '{}'); reason = (typeof body.detail === 'string' && body.detail ? body.detail : body.error) || reason; } catch { /* keep the generic reason */ }
          throw Object.assign(new Error(reason), { status: response.status, refused: true });
        }
      } catch (error) { if (error.refused) throw error; /* otherwise retry */ }
      if (Date.now() >= until) throw Object.assign(new Error('hub unavailable'), { status: 503 });
      await new Promise(resolve => setTimeout(resolve, this.retryDelay));
    }
  }
  loginRecord(account) {
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(account)) die('invalid account');
    let record = this.logins[account];
    if (!record && this.liveTmux()?.has(`wc-login-${account}`)) {
      const defaultEntry = Object.entries(adapters).find(([, adapter]) => account === `default-${adapter.provider}`);
      if (defaultEntry) record = { cli: defaultEntry[0], dir: null };
      else {
        const dir = accountDir(`~/.wheelchair/accounts/${account}`, account);
        try { const meta = JSON.parse(fs.readFileSync(path.join(dir, 'wheelchair-account.json'), 'utf8')); if (meta.id === account && adapters[meta.cli]) record = { cli: meta.cli, dir }; } catch {}
      }
      if (record) this.logins[account] = record;
    }
    if (!record) throw Object.assign(new Error('login not found'), { status: 404 });
    return record;
  }
  async startLogin(input) {
    const { account, cli } = input, adapter = adapters[cli];
    if (typeof account !== 'string' || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(account) || !adapter) die('invalid account or cli');
    const dir = accountDir(input.dir, account);
    if ((!dir && account !== `default-${adapter.provider}`) || (dir && Object.values(adapters).some(a => account === `default-${a.provider}`))) die('invalid default account');
    if (cli === 'kimi' && !adapter.resolveCli()) throw Object.assign(new Error('Kimi Code is not installed'), { status: 409 });
    if (dir) adapter.seed(dir, account);
    await adapter.prepare?.(dir);
    const name = `wc-login-${account}`;
    this.tmux(['kill-session', '-t', cli === 'kimi' ? `=${name}` : name]);
    const cmd = ['env', ...Object.entries(adapter.loginEnv(dir)).map(([k, v]) => `${k}=${v}`), ...adapter.loginCommand(dir)].map(shellQuote).join(' ');
    const script = `${cmd}; printf '\n__wc_login_exit %s\n' "$?"; sleep 600`;
    const cwd = adapter.loginCwd?.(this.stateDir);
    const result = this.tmux(['new-session', '-d', '-s', name, '-x', '200', '-y', '50', ...(cwd ? ['-c', cwd] : []), ['sh', '-c', script].map(shellQuote).join(' ')]);
    if (!result.ok) die(result.stderr.trim() || 'login session failed to start');
    this.logins[account] = { cli, dir };
    return { state: 'starting' };
  }
  loginPane(account) {
    const record = this.loginRecord(account);
    const result = this.tmux(['capture-pane', '-p', '-e', '-t', record.cli === 'kimi' ? `=wc-login-${account}:` : `wc-login-${account}`]);
    if (!result.ok) throw Object.assign(new Error('login pane unavailable'), { status: 409 });
    return result.stdout;
  }
  loginState(account) {
    const record = this.loginRecord(account), adapter = adapters[record.cli];
    if (record.cli === 'kimi' && record.result) return record.result;
    const captured = this.tmux(['capture-pane', '-p', '-t', record.cli === 'kimi' ? `=wc-login-${account}:` : `wc-login-${account}`]);
    const pane = captured.ok ? captured.stdout : '';
    if (record.cli === 'kimi') {
      const authenticated = adapter.loginStatus(record.dir).authenticated;
      const marker = pane.match(/__wc_login_exit (\d+)/);
      if (marker) return record.result = { state: marker[1] === '0' && authenticated ? 'done' : 'failed', url: null, code: null, wantsCode: false, logged_in: authenticated };
      if (!captured.ok) { const live = this.liveTmux(); if (live && !live.has(`wc-login-${account}`)) return record.result = { state: 'failed', url: null, code: null, wantsCode: false, logged_in: authenticated }; return { state: 'waiting', url: null, code: null, wantsCode: false, logged_in: authenticated }; }
      const parsed = adapter.parseLogin(pane); return { state: parsed ? 'waiting' : 'starting', url: parsed?.url || null, code: parsed?.code || null, wantsCode: false, logged_in: authenticated };
    }
    if (!captured.ok || /__wc_login_exit \d+/.test(pane)) {
      const logged_in = adapter.loginStatus(record.dir).logged_in;
      return { state: logged_in ? 'done' : 'failed', url: null, code: null, wantsCode: false, logged_in };
    }
    if (adapter.loginDone?.(pane)) {
      this.tmux(['kill-session', '-t', `wc-login-${account}`]);
      const logged_in = adapter.loginStatus(record.dir).logged_in;
      return { state: logged_in ? 'done' : 'failed', url: null, code: null, wantsCode: false, logged_in };
    }
    const prompt = adapter.loginPrompt?.(pane);
    if (prompt) {
      const { step, keys } = Array.isArray(prompt) ? { step: 'default', keys: prompt } : prompt;
      record.answered_steps ||= new Set();
      if (!record.answered_steps.has(step)) { for (const key of keys) this.tmux(['send-keys', '-t', `wc-login-${account}`, key]); record.answered_steps.add(step); }
    }
    const parsed = adapter.parseLogin(pane);
    return { state: parsed ? 'waiting' : 'starting', url: parsed?.url || null, code: parsed?.code || null, wantsCode: parsed?.wantsCode || false, logged_in: false };
  }
  // The session list alone: tmux only, no CLI checks. /v1/sessions is polled every few
  // seconds, and the login checks status() runs are synchronous and take over a second.
  sessionList() {
    const live = this.liveTmux();
    const others = [...(live || [])].filter(name => !name.startsWith('wc-login-') && !this.sessions[name]).map(name => ({ name, managed: false, running: true }));
    return [...Object.values(this.sessions).filter(s => !s.name.startsWith('wc-login-')).map(({ project_tools, ...s }) => ({ ...publicSession(s), codex_thread_id: s.codex_thread_id || null, managed: true, ...(live ? { running: live.has(s.name) } : {}) })), ...others];
  }
  status() {
    const defaults = Object.fromEntries(Object.entries(adapters).map(([cli, adapter]) => [cli, adapter.loginStatus(null)]));
    const claude = this.cliStatus('claude', defaults.claude), codex = this.cliStatus('codex', defaults.codex), agy = this.cliStatus('agy', defaults.agy), kimi = this.cliStatus('kimi', defaults.kimi);
    const accounts = Object.entries(adapters).map(([cli, adapter]) => ({ id: `default-${adapter.provider}`, cli, ...defaults[cli] }));
    const root = path.join(os.homedir(), '.wheelchair', 'accounts');
    let folders = []; try { folders = fs.readdirSync(root, { withFileTypes: true }); } catch {}
    for (const folder of folders.filter(e => e.isDirectory())) {
      try { const record = JSON.parse(fs.readFileSync(path.join(root, folder.name, 'wheelchair-account.json'), 'utf8')); if (record.id !== folder.name || !adapters[record.cli] || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(record.id)) continue; accounts.push({ id: record.id, cli: record.cli, ...adapters[record.cli].loginStatus(path.join(root, folder.name)) }); } catch {}
    }
    for (const entry of accounts) delete entry.authenticated;
    if (kimi.problem) for (const entry of accounts) if (entry.cli === 'kimi') { entry.logged_in = false; delete entry.problem; }
    return { version: this.version, claude, codex, agy, kimi, accounts, sessions: this.sessionList() };
  }
  checkKimiVersion(executable = adapters.kimi.resolveCli()) {
    if (!executable) return Promise.resolve();
    let mtime; try { mtime = fs.statSync(executable).mtimeMs; } catch { return Promise.resolve(); }
    this.kimiVersions ||= new Map();
    const key = JSON.stringify([executable, mtime]);
    if (!this.kimiVersions.has(key)) {
      const entry = {};
      entry.promise = new Promise(resolve => execFile(executable, ['--version'], { timeout: this.options?.kimiVersionTimeoutMs ?? 5000 }, (error, stdout, stderr) => {
        entry.output = stdout.trim() || stderr.trim() || 'no output';
        entry.failed = !!error;
        resolve(entry);
      }));
      this.kimiVersions.set(key, entry);
    }
    return this.kimiVersions.get(key).promise;
  }
  async kimiLaunchPath() {
    const executable = adapters.kimi.resolveCli();
    if (!executable) die('Kimi Code is not installed');
    let mtime; try { mtime = fs.statSync(executable).mtimeMs; } catch { die('Kimi Code is not installed'); }
    await this.checkKimiVersion(executable);
    const entry = this.kimiVersions?.get(JSON.stringify([executable, mtime]));
    if (!entry || entry.output === undefined) die('Kimi Code is not installed');
    const status = this.kimiVersionStatus(entry, { logged_in: false });
    if (status.problem) die(status.problem);
    return { executable };
  }
  kimiVersionStatus(entry, login) {
    if (!entry || entry.output === undefined) return { installed: true, logged_in: false, problem: "Checking Kimi Code's version" };
    const output = entry.output;
    const firstLine = output.split(/\r?\n/, 1)[0].replace(/^(?:kimi-code|kimi code|kimi)(?:\s+|,\s*)/i, '').replace(/^version\s+/i, '');
    const match = (firstLine.split(/\s+/)[0] || '').match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
    const valid = !entry.failed && match && (Number(match[1]) > 2 || Number(match[1]) === 2 && (Number(match[2]) > 6 || Number(match[2]) === 6 && (Number(match[3]) > 3 || Number(match[3]) === 3 && !match[4])));
    return { installed: true, logged_in: !!valid && login.logged_in, version: output, ...(!valid ? { problem: `Kimi Code 2.6.3 or newer is needed (found ${output})` } : {}) };
  }
  cliStatus(cli, login = adapters[cli].loginStatus(null)) {
    if (cli === 'kimi') {
      const executable = adapters.kimi.resolveCli(); if (!executable) return { installed: false, logged_in: false };
      let mtime; try { mtime = fs.statSync(executable).mtimeMs; } catch { return { installed: false, logged_in: false }; }
      this.checkKimiVersion();
      const entry = this.kimiVersions.get(JSON.stringify([executable, mtime]));
      return this.kimiVersionStatus(entry, login);
    }
    const version = command('sh', ['-c', `command -v ${cli}`]);
    if (!version.ok) return { installed: false, logged_in: false };
    const check = command(cli, ['--version']);
    return { installed: true, logged_in: login.logged_in, version: check.stdout.trim() || check.stderr.trim() };
  }
  // Runs claude -p for the hub's style preview. Asynchronous on purpose: up to a minute of
  // waiting must not block the service's event loop. Never answers with a throw: the
  // status and body come back together.
  preview(input) {
    const model = input.model; const prompt = input.prompt;
    if (typeof model !== 'string' || !/^[A-Za-z0-9._:\[\]-]+$/.test(model)) die('model is required');
    if (typeof prompt !== 'string' || !prompt.trim()) die('prompt is required');
    return new Promise(resolve => {
      let child; let out = ''; let err = ''; let done = false;
      const finish = (status, body) => { if (done) return; done = true; clearTimeout(timer); resolve({ status, body }); };
      const timer = setTimeout(() => { finish(504, { error: 'preview timed out after 60 s' }); if (child) child.kill('SIGKILL'); }, this.previewTimeoutMs);
      try { child = spawn('claude', ['-p', '--model', model, '--permission-mode', 'dontAsk'], { env: { ...process.env, WHEELCHAIR_LANE: '1' }, stdio: ['pipe', 'pipe', 'pipe'] }); }
      catch (error) { return finish(503, { error: 'claude is not installed' }); }
      child.on('error', error => finish(error.code === 'ENOENT' ? 503 : 502, { error: error.code === 'ENOENT' ? 'claude is not installed' : error.message }));
      child.stdout.on('data', chunk => { out += chunk; });
      child.stderr.on('data', chunk => { err += chunk; });
      child.stdin.on('error', () => {});
      child.on('close', code => {
        if (code === 0) return finish(200, { text: out.trim() });
        const last = err.split('\n').map(l => l.trim()).filter(Boolean).pop();
        finish(502, { error: last || `claude exited ${code}` });
      });
      child.stdin.end(prompt);
    });
  }
  // GET /v1/projects: reads only. `folder` lists git repos one level down; `check` vets one path.
  async projects(params) {
    const folder = params.get('folder'); const check = params.get('check');
    if (folder === null && check === null) die('folder or check is required');
    const expand = value => (value === '~' ? os.homedir() : value.startsWith('~/') ? path.join(os.homedir(), value.slice(2)) : value);
    const nameOk = name => /^[A-Za-z0-9._-]+$/.test(name) && !name.includes('..');
    const kind = async target => { try { return (await fsp.stat(target)).isDirectory() ? 'dir' : 'file'; } catch { return null; } };
    const hasGit = target => fsp.lstat(path.join(target, '.git')).then(() => true, () => false);
    const out = {};
    if (folder !== null) {
      const dir = expand(folder);
      if (!path.isAbsolute(dir)) die('folder must be an absolute path');
      const found = []; let error;
      const type = await kind(dir);
      if (!type) error = 'does not exist'; else if (type !== 'dir') error = 'is not a directory';
      else {
        let names = []; try { names = await fsp.readdir(dir); } catch (e) { error = e.code === 'EACCES' ? 'cannot be read' : 'does not exist'; }
        for (const name of names.sort()) {
          if (name.startsWith('.') || !nameOk(name)) continue;
          const full = path.join(dir, name);
          if (await kind(full) === 'dir' && await hasGit(full)) found.push({ name, path: full });
        }
      }
      out.found = found; if (error) out.folder_error = error;
    }
    if (check !== null) {
      const target = expand(check);
      if (!path.isAbsolute(target)) out.checked = { path: target, ok: false, reason: 'must be an absolute path' };
      else {
        const type = await kind(target); let reason;
        if (!type) reason = 'does not exist'; else if (type !== 'dir') reason = 'is not a directory';
        else if (!nameOk(path.basename(target))) reason = "has characters a thread can't use in its name";
        else if (!await hasGit(target)) reason = 'is not a git repository';
        out.checked = reason ? { path: target, ok: false, reason } : { path: target, ok: true };
      }
    }
    return out;
  }
  async fetchHandoffBranch(repo, branch) {
    const ref = `refs/heads/${branch}`;
    const listed = await commandAsync('git', ['-C', repo, 'ls-remote', 'origin', ref]);
    if (!listed.ok) throw new Error(listed.stderr.trim() || 'git ls-remote failed');
    const line = listed.stdout.split('\n').map(row => row.split(/\s+/)).find(parts => parts[1] === ref);
    if (!line) return { remote_has_branch: false, remote_tip: null };
    const fetched = await commandAsync('git', ['-C', repo, 'fetch', 'origin', `+${ref}:refs/remotes/origin/${branch}`]);
    if (!fetched.ok) throw new Error(fetched.stderr.trim() || 'git fetch failed');
    const tip = await commandAsync('git', ['-C', repo, 'rev-parse', 'FETCH_HEAD']);
    if (!tip.ok) throw new Error(tip.stderr.trim() || 'git rev-parse failed');
    return { remote_has_branch: true, remote_tip: tip.stdout.trim() };
  }
  async handoff(input) {
    const invalid = message => { throw Object.assign(new Error(message), { status: 422, handoff: true }); };
    if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('invalid request');
    const { action, thread_id: id } = input;
    if (typeof id !== 'string' || !/^[0-9a-f]{12}$/.test(id)) invalid('invalid thread_id');
    const fields = {
      status: ['worktree', 'slug'], push: ['worktree', 'branch', 'sha'],
      inspect: ['branch', 'head', 'slug'], 'claim-commit': ['parent', 'message'],
      'claim-state': ['branch', 'parent', 'sha'], 'claim-push': ['branch', 'parent', 'sha'],
      'claim-revoke': ['branch', 'parent', 'sha'], reopen: [],
      'fast-forward': ['worktree', 'branch', 'head'], 'set-branch': ['branch', 'sha'],
      running: [], kill: ['names'], known: ['head'],
    };
    if (!Object.hasOwn(fields, action)) invalid('invalid action');
    for (const field of fields[action]) if (input[field] === undefined || input[field] === null) invalid(`${field} required`);
    for (const field of ['branch']) if (input[field] !== undefined && (typeof input[field] !== 'string' || !/^wc\/[0-9a-f]{12}$/.test(input[field]))) invalid(`invalid ${field}`);
    for (const field of ['sha', 'parent', 'head', 'fallback_head']) if (input[field] !== undefined && (typeof input[field] !== 'string' || !/^[0-9a-f]{40}$/.test(input[field]))) invalid(`invalid ${field}`);
    if (input.slug !== undefined && (typeof input.slug !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(input.slug))) invalid('invalid slug');
    if (input.message !== undefined && (typeof input.message !== 'string' || !input.message.trim())) invalid('invalid message');
    if (input.pr_url !== undefined && (typeof input.pr_url !== 'string' || !/^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/[0-9]+$/.test(input.pr_url))) invalid('invalid pr_url');
    if (action === 'kill' && (!Array.isArray(input.names) || input.names.some(name => typeof name !== 'string' || !name.startsWith(`wc-${id}-`)))) invalid('invalid names');
    const gitAction = !['reopen', 'running', 'kill'].includes(action);
    let repo;
    if (gitAction) {
      if (typeof input.project !== 'string' || !path.isAbsolute(input.project)) invalid('invalid project');
      const checked = await this.projects(new URLSearchParams({ check: input.project }));
      if (!checked.checked.ok) invalid('invalid project');
      repo = path.resolve(input.project);
    }
    if (input.worktree !== undefined) {
      if (typeof input.worktree !== 'string' || !path.isAbsolute(input.worktree)) invalid('invalid worktree');
      const target = path.resolve(input.worktree);
      const recorded = Object.values(this.sessions).some(s => s.thread_id === id && s.created_worktree && s.worktree && path.resolve(s.worktree) === target);
      const expected = repo && path.join(this.stateDir, 'worktrees', path.basename(repo), 'wc', id);
      if (!recorded && !(['inspect', 'known'].includes(action) && target === expected)) invalid('invalid worktree');
    }
    try {
      return await this.withThreadLock(id, () => gitAction
        ? this.inRepoQueue(repo, () => this.handoffAction(input, repo))
        : this.handoffAction(input, repo));
    } catch (error) { return { result: 'failed', error: error.message }; }
  }
  async handoffAction(input, repo) {
    const git = (...args) => commandAsync('git', ['-C', repo, ...args]);
    const run = async (...args) => {
      const result = await git(...args);
      if (!result.ok) throw new Error((result.stderr || result.stdout).trim().split('\n').pop() || 'git command failed');
      return result.stdout.trim();
    };
    const ancestor = async (a, b) => (await git('merge-base', '--is-ancestor', a, b)).ok;
    const repository = async () => normalizeGithubOrigin(await run('remote', 'get-url', 'origin'));
    const statuses = async (ref, slug) => {
      const show = async name => git('show', `${ref}:docs/plans/${slug}/${name}.md`);
      const [idea, plan, map] = await Promise.all(['IDEA', 'PLAN', 'MAP'].map(show));
      const status = result => result.ok ? (result.stdout.match(/^status:\s*([^\s#]+)/m)?.[1] || null) : null;
      return { idea_status: status(idea), plan_status: status(plan), map_committed: map.ok };
    };
    const { action, branch, head, worktree, slug } = input;
    const claimState = async () => {
      let remote;
      try { remote = await this.fetchHandoffBranch(repo, branch); }
      catch (error) { return { result: 'unknown', error: error.message }; }
      const tip = remote.remote_tip;
      if (!remote.remote_has_branch) return { result: 'unknown' };
      if (tip === input.sha || await ancestor(input.sha, tip)) return { result: 'landed', remote_tip: tip };
      if (tip === input.parent) return { result: 'parent', remote_tip: tip };
      let picked_up_at = null;
      if (await ancestor(input.parent, tip)) {
        const commits = await run('rev-list', '--reverse', '--ancestry-path', `${input.parent}..${tip}`);
        if (commits) picked_up_at = await run('show', '-s', '--format=%cI', commits.split('\n')[0]);
      }
      return { result: 'moved', remote_tip: tip, picked_up_at };
    };
    if (action === 'claim-commit') return { sha: await run('commit-tree', `${input.parent}^{tree}`, '-p', input.parent, '-m', input.message) };
    if (action === 'claim-state') return claimState();
    if (action === 'claim-push') {
      let state = await claimState(); let pushed;
      if (state.result === 'parent') {
        pushed = await git('push', `--force-with-lease=refs/heads/${branch}:${input.parent}`, 'origin', `${input.sha}:refs/heads/${branch}`);
        state = await claimState();
      }
      if (state.result === 'parent' || state.result === 'unknown') {
        const error = pushed && !pushed.ok ? (pushed.stderr || pushed.stdout).trim().split('\n').pop() : state.error;
        return { result: 'unknown', ...(error ? { error } : {}) };
      }
      return state;
    }
    if (action === 'claim-revoke') {
      let state = await claimState();
      if (state.result === 'unknown' || state.remote_tip === input.parent) return { result: 'waiting' };
      if (state.remote_tip !== input.sha) return { result: 'gone' };
      const pushed = await git('push', `--force-with-lease=refs/heads/${branch}:${input.sha}`, 'origin', `${input.parent}:refs/heads/${branch}`);
      if (pushed.ok) return { result: 'revoked' };
      state = await claimState();
      if (state.result === 'unknown' || state.remote_tip === input.parent) return { result: 'waiting' };
      if (state.remote_tip !== input.sha) return { result: 'gone' };
      return { result: 'failed', error: (pushed.stderr || pushed.stdout).trim().split('\n').pop() || 'git push failed' };
    }
    const setUpstream = async target => {
      await run('-C', target, 'config', `branch.${branch}.remote`, 'origin');
      await run('-C', target, 'config', `branch.${branch}.merge`, `refs/heads/${branch}`);
    };
    if (action === 'fast-forward') {
      if (await run('-C', worktree, 'status', '--porcelain')) return { result: 'failed', error: 'The worktree has uncommitted changes.' };
      const current = await git('-C', worktree, 'symbolic-ref', '--quiet', '--short', 'HEAD');
      if (!current.ok || current.stdout.trim() !== branch) return { result: 'failed', error: `The worktree is not on ${branch}.` };
      const old = await run('-C', worktree, 'rev-parse', 'HEAD');
      if (!await ancestor(old, head)) return { result: 'failed', error: 'The worktree has diverged.' };
      await run('-C', worktree, 'merge', '--ff-only', head);
      if (await run('-C', worktree, 'rev-parse', 'HEAD') !== head) return { result: 'failed', error: 'The worktree did not reach the requested head.' };
      await setUpstream(worktree);
      return { result: 'ok' };
    }
    if (action === 'set-branch') {
      const local = await git('rev-parse', '--verify', `refs/heads/${branch}`);
      if (local.ok && !await ancestor(local.stdout.trim(), input.sha)) return { result: 'failed', error: `a local branch ${branch} already exists and differs` };
      await run('branch', '-f', branch, input.sha);
      return { result: 'ok' };
    }
    if (action === 'known') {
      const name = `wc/${input.thread_id}`;
      const local = await git('rev-parse', '--verify', `refs/heads/${name}`);
      const listed = await run('worktree', 'list', '--porcelain', '-z');
      const checked_out = []; let current = null;
      for (const line of listed.split('\0')) {
        if (line.startsWith('worktree ')) current = line.slice(9);
        else if (current !== null && line === `branch refs/heads/${name}`) checked_out.push(current);
      }
      const dirs = await fsp.readdir(path.join(this.stateDir, 'worktrees')).catch(() => []);
      let worktreeKnown = false;
      for (const project of dirs) {
        const projectDir = path.join(this.stateDir, 'worktrees', project);
        if (await fsp.stat(path.join(projectDir, 'wc', input.thread_id)).catch(() => null)) { worktreeKnown = true; break; }
        const names = await fsp.readdir(projectDir).catch(() => []);
        if (names.some(name => name.startsWith(`wc-${input.thread_id}-`))) { worktreeKnown = true; break; }
      }
      const known = worktreeKnown || Object.values(this.sessions).some(session => session.thread_id === input.thread_id) || this.archivedThreads.has(input.thread_id) || !!this.archivingThreads?.has(input.thread_id);
      return { known, local_branch: local.ok, local_ancestor: local.ok ? await ancestor(local.stdout.trim(), head) : null, checked_out };
    }
    if (action === 'reopen') {
      this.archivingThreads.delete(input.thread_id);
      this.archivedThreads.delete(input.thread_id);
      await this.persistArchiveMarkers();
      return { ok: true };
    }
    if (action === 'running' || action === 'kill') {
      const prefix = `wc-${input.thread_id}-`;
      const running = () => {
        const live = this.liveTmux();
        if (!live) throw new Error('Could not list tmux sessions.');
        return [...new Set([...this.startingNames.keys(), ...live].filter(name => name.startsWith(prefix)))];
      };
      if (action === 'kill') {
        for (const name of input.names) {
          if (this.startingNames.has(name)) this.cancelledStarts.add(name);
          if (running().includes(name)) this.tmux(['kill-session', '-t', `=${name}`]);
        }
      }
      return { names: running() };
    }
    if (action === 'status') {
      const symbolic = await git('-C', worktree, 'symbolic-ref', '--quiet', '--short', 'HEAD');
      const current = symbolic.ok ? symbolic.stdout.trim() : null;
      const actualHead = await run('-C', worktree, 'rev-parse', 'HEAD');
      const dirty = !!(await run('-C', worktree, 'status', '--porcelain'));
      const remote = await this.fetchHandoffBranch(repo, `wc/${input.thread_id}`);
      let pr_state = null; let pr_error;
      if (input.pr_url) {
        const gh = await commandAsync('gh', ['pr', 'view', '--json', 'state', '--', input.pr_url], { cwd: repo });
        if (gh.ok) { try { pr_state = JSON.parse(gh.stdout).state || null; } catch { pr_error = 'Invalid pull request response.'; } }
        else pr_error = gh.stderr.trim() || 'Could not check pull request.';
      }
      return { dirty, branch: current, head: actualHead, ...remote, ...await statuses(actualHead, slug), repository: await repository(), pr_state, ...(pr_error ? { pr_error } : {}) };
    }
    if (action === 'push') {
      await run('-C', worktree, 'push', 'origin', `${input.sha}:refs/heads/${branch}`);
      return { head: input.sha, repository: await repository() };
    }
    if (action === 'inspect') {
      const remote = await this.fetchHandoffBranch(repo, branch);
      const contains = remote.remote_has_branch && await ancestor(head, remote.remote_tip);
      let picked_up_at = null;
      if (contains && remote.remote_tip !== head) {
        const commits = await run('rev-list', '--reverse', '--ancestry-path', `${head}..${remote.remote_tip}`);
        if (commits) picked_up_at = await run('show', '-s', '--format=%cI', commits.split('\n')[0]);
      }
      let local_head = null; let worktree_exists = false;
      if (worktree) {
        const top = await git('-C', worktree, 'rev-parse', '--show-toplevel');
        const actual = await git('-C', worktree, 'rev-parse', '--verify', 'HEAD');
        if (top.ok && path.resolve(top.stdout.trim()) === path.resolve(worktree) && actual.ok) { worktree_exists = true; local_head = actual.stdout.trim(); }
      }
      if (!local_head) { const local = await git('rev-parse', '--verify', `refs/heads/${branch}`); if (local.ok) local_head = local.stdout.trim(); }
      if (!local_head) local_head = input.fallback_head || null;
      let relation = null;
      if (local_head) relation = local_head === head ? 'same' : await ancestor(head, local_head) ? 'behind' : await ancestor(local_head, head) ? 'ahead' : 'diverged';
      return { repository: await repository(), ...remote, remote_contains_head: !!contains, picked_up_at, local_head, worktree_exists, relation, ...await statuses(head, slug) };
    }
    return { result: 'failed', error: 'Action is not implemented.' };
  }
  async handle(request, response) {
    const url = new URL(request.url, 'http://machine.local');
    const pathBits = url.pathname.split('/').filter(Boolean);
    try {
      if (request.method === 'GET' && url.pathname === '/health') return send(response, 200, { ok: true });
      if (url.pathname === '/v1/diagram-sensitivity' && ['GET', 'POST'].includes(request.method)) {
        await this.authorize(request, 'hub');
        const script = this.options.sensitivityScript || path.join(ROOT, 'sensitivity', 'set.sh');
        const failure = result => ({ error: result.stderr.trim().split(/\r?\n/).filter(Boolean).pop() || `writer exited ${result.status}` });
        if (request.method === 'GET') {
          const data = await commandAsync(script, ['--json'], { timeout: 30000 });
          if (!data.ok) return send(response, 422, failure(data));
          let report;
          try { report = JSON.parse(data.stdout); } catch { return send(response, 422, { error: 'invalid sensitivity report' }); }
          const plain = await commandAsync(script, ['--report'], { timeout: 30000 });
          // A disagreement is a successful structured report, but the plain report exits 1.
          if (!plain.ok && !(report.level === null && new Set(report.files.map(f => f.level).filter(Boolean)).size > 1)) return send(response, 422, failure(plain));
          return send(response, 200, { ...report, text: plain.stdout + plain.stderr });
        }
        const input = await bodyOf(request);
        if (!['ask', 'default', 'high'].includes(input.level)) return send(response, 400, { error: 'level must be ask, default, or high' });
        if (this.sensitivityWriting) return send(response, 409, { error: 'diagram sensitivity update already running' });
        this.sensitivityWriting = true;
        try {
          const result = await commandAsync(script, [input.level], { timeout: 30000 });
          return result.ok ? send(response, 200, { level: input.level, text: result.stdout }) : send(response, 422, failure(result));
        } finally { this.sensitivityWriting = false; }
      }
      if (request.method === 'GET' && url.pathname === '/v1/status') { await this.authorize(request, 'hub'); return send(response, 200, this.status()); }
      if (request.method === 'POST' && ['/v1/project-tools/read', '/v1/project-tools/save', '/v1/project-tools/remove-key'].includes(url.pathname)) {
        await this.authorize(request, 'hub');
        const input = await bodyOf(request);
        const action = url.pathname.endsWith('/read') ? 'read' : url.pathname.endsWith('/save') ? 'save' : 'removeKey';
        if (action === 'read') { const result = await this.projectTools.read(input); return send(response, result.status, result.body); }
        let identity;
        try { identity = await this.projectTools.identity(input.path); } catch { const result = await this.projectTools[action](input); return send(response, result.status, result.body); }
        const previous = this.projectToolsLocks.get(identity) || Promise.resolve();
        let release; const current = new Promise(resolve => { release = resolve; });
        this.projectToolsLocks.set(identity, current);
        await previous;
        try { const result = await this.projectTools[action](input); return send(response, result.status, result.body); }
        finally { if (this.projectToolsLocks.get(identity) === current) this.projectToolsLocks.delete(identity); release(); }
      }
      if (request.method === 'GET' && url.pathname === '/v1/projects') { await this.authorize(request, 'hub'); return send(response, 200, await this.projects(url.searchParams)); }
      if (request.method === 'POST' && url.pathname === '/v1/usage') {
        await this.authorize(request, 'hub');
        const input = await bodyOf(request);
        if (!input || typeof input !== 'object' || Array.isArray(input)) die('invalid usage request');
        const { account, cli } = input;
        if (typeof account !== 'string' || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(account) || !['claude', 'codex'].includes(cli) || !Object.hasOwn(input, 'dir')) die('invalid account or cli');
        const adapter = adapters[cli], dir = accountDir(input.dir, account);
        if ((!dir && account !== `default-${adapter.provider}`) || (dir && Object.values(adapters).some(a => account === `default-${a.provider}`))) die('invalid default account');
        try {
          const parsed = await adapter.usageProbe(dir, { cwd: this.stateDir, timeout: this.options.usageProbeTimeout ?? 30000 });
          const { reached, ...windows } = parsed;
          const reading = { account, at: new Date().toISOString(), ...windows };
          if (reached) reading.limited_until = limitedUntil(reading);
          return send(response, 200, { reading });
        } catch (error) { return send(response, 502, { error: error.message || 'usage probe failed' }); }
      }
      if (request.method === 'POST' && url.pathname === '/v1/preflight') { await this.authorize(request, 'hub'); const input = await bodyOf(request); const dir = accountDir(input.dir); const result = command(path.join(ROOT, 'codex', 'preflight.sh'), [], dir ? { env: { ...process.env, ...adapters.codex.loginEnv(dir) } } : {}); return send(response, result.ok ? 200 : 409, result); }
      if (request.method === 'POST' && url.pathname === '/v1/preview') { await this.authorize(request, 'hub'); const result = await this.preview(await bodyOf(request)); return send(response, result.status, result.body); }
      if (pathBits[0] === 'v1' && pathBits[1] === 'aside-turns') {
        await this.authorize(request, 'hub');
        if (request.method === 'POST' && pathBits.length === 2) { const result = await this.asideTurns.start(await bodyOf(request)); return send(response, result.status, result.body); }
        if (pathBits.length === 3 && request.method === 'GET') return send(response, 200, this.asideTurns.result(this.asideTurns.get(pathBits[2])));
        if (pathBits.length === 3 && request.method === 'DELETE') { await this.asideTurns.stop(pathBits[2]); return send(response, 200, { ok: true }); }
        if (pathBits.length === 4 && pathBits[3] === 'ack' && request.method === 'POST') { await this.asideTurns.ack(pathBits[2]); return send(response, 200, { ok: true }); }
      }
      if (request.method === 'POST' && url.pathname === '/v1/logins') { await this.authorize(request, 'hub'); return send(response, 201, await this.startLogin(await bodyOf(request))); }
      if (pathBits[0] === 'v1' && pathBits[1] === 'logins' && pathBits[2]) {
        await this.authorize(request, 'hub'); const account = decodeURIComponent(pathBits[2]); const loginRecord = this.loginRecord(account); const loginTarget = loginRecord.cli === 'kimi' ? `=wc-login-${account}:` : `wc-login-${account}`;
        if (request.method === 'GET' && pathBits.length === 3) return send(response, 200, this.loginState(account));
        if (request.method === 'GET' && pathBits[3] === 'pane') return send(response, 200, { text: this.loginPane(account) });
        if (request.method === 'POST' && pathBits[3] === 'keys') { const input = await bodyOf(request); const r = this.tmux(['send-keys', '-t', loginTarget, String(input.keys || '')]); if (!r.ok) throw Object.assign(new Error('tmux keys failed'), { status: 409 }); return send(response, 200, { ok: true }); }
        if (request.method === 'POST' && pathBits[3] === 'code') { const input = await bodyOf(request); if (typeof input.code !== 'string' || !input.code) die('code required'); const buffer = `wc-${crypto.randomUUID()}`; const a = this.tmux(['load-buffer', '-b', buffer, '-'], { input: input.code }); const b = this.tmux(['paste-buffer', '-p', '-b', buffer, '-t', loginTarget]); const c = this.tmux(['send-keys', '-t', loginTarget, 'Enter']); if (!a.ok || !b.ok || !c.ok) throw Object.assign(new Error('tmux submit failed'), { status: 409 }); return send(response, 200, { ok: true }); }
      }
      if (request.method === 'POST' && url.pathname === '/v1/sessions') { await this.authorize(request, 'hub'); return send(response, 201, await this.start(await bodyOf(request))); }
      if (request.method === 'GET' && url.pathname === '/v1/sessions') { await this.authorize(request, 'hub'); return send(response, 200, this.sessionList()); }
      if (request.method === 'POST' && url.pathname === '/v1/uploads') {
        await this.authorize(request, 'hub');
        const stored = await this.upload(url.searchParams.get('thread_id'), url.searchParams.get('name'), request, url.searchParams.get('vouched') === '1');
        return send(response, 201, { path: stored });
      }
      if (request.method === 'GET' && pathBits[0] === 'v1' && pathBits[1] === 'uploads' && pathBits.length === 4) {
        await this.authorize(request, 'hub');
        const id = threadName(decodeURIComponent(pathBits[2])); const name = decodeURIComponent(pathBits[3]);
        if (!/^[0-9]+-[A-Za-z0-9._-]+$/.test(name)) die('invalid file name');
        const target = path.join(this.stateDir, 'uploads', id, name);
        let file; try { file = await fsp.open(target, 'r'); } catch (error) { if (error.code === 'ENOENT') throw Object.assign(new Error('not found'), { status: 404 }); throw error; }
        const type = IMAGE_TYPES[path.extname(name).toLowerCase()];
        response.writeHead(200, { 'content-type': type || 'application/octet-stream', 'x-content-type-options': 'nosniff', ...(!type ? { 'content-disposition': 'attachment' } : {}) });
        file.createReadStream().on('error', () => response.destroy()).pipe(response); return;
      }
      if (request.method === 'POST' && url.pathname === '/v1/handoff') {
        await this.authorize(request, 'hub');
        let input;
        try { input = await bodyOf(request); } catch (error) { if (error.status === 400) throw Object.assign(error, { status: 422, handoff: true }); throw error; }
        return send(response, 200, await this.handoff(input));
      }
      if (request.method === 'POST' && url.pathname === '/v1/archive') { await this.authorize(request, 'hub'); return send(response, 200, await this.archive((await bodyOf(request)).thread_id)); }
      if (pathBits[0] === 'v1' && pathBits[1] === 'sessions' && pathBits[2]) {
        const name = decodeURIComponent(pathBits[2]); await this.authorize(request, 'hub');
        if (request.method === 'DELETE' && pathBits.length === 3) { const result = await this.stop(name); return send(response, result?.pending ? 202 : 200, result || { ok: true }); }
        if (request.method === 'GET' && pathBits[3] === 'pane') {
          const value = url.searchParams.get('history');
          let history = 0;
          if (value !== null) {
            if (!/^\d+$/.test(value) || Number(value) > 2000) throw Object.assign(new Error('history must be 0-2000'), { status: 400 });
            history = Number(value);
          }
          return send(response, 200, { pane: this.pane(name, true, history) });
        }
        if (request.method === 'GET' && pathBits[3] === 'transcript') return send(response, 200, await this.transcript(name, url.searchParams.get('offset') || 0, url.searchParams.get('known')));
        if (request.method === 'POST' && pathBits[3] === 'submit') { const input = await bodyOf(request); await this.submit(name, String(input.text || '')); return send(response, 200, { ok: true }); }
        if (request.method === 'POST' && pathBits[3] === 'keys') { const input = await bodyOf(request); this.raw(name, String(input.keys || '')); return send(response, 200, { ok: true }); }
      }
      if (request.method === 'POST' && pathBits[0] === 'v1' && pathBits[1] === 'sudo' && pathBits.length === 4 && pathBits[3] === 'cancel' && /^[0-9a-f]{32}$/.test(pathBits[2])) {
        await this.authorize(request, 'hub');
        try { return send(response, 200, await this.sudo.cancel(pathBits[2])); }
        catch (error) { if (!error.status) throw Object.assign(new Error('sudo helper unavailable'), { status: 503 }); throw error; }
      }
      if (request.method === 'POST' && url.pathname === '/v1/agent/cards') {
        const agent = await this.authorize(request, 'agent');
        let input = await bodyOf(request);
        delete input.warnings;
        if (input.kind === 'approval' && agent.role === 'lead') {
          const warnings = [];
          if (typeof this.startupWarning === 'string') warnings.push(this.startupWarning);
          if (this.platform === 'linux') {
            const { missing } = screenTools();
            if (missing.length) warnings.push(`Screens won't work on ${os.hostname()}: missing ${missing.join(', ')}. Builds that don't use a screen are unaffected.`);
          }
          if (warnings.length) input.warnings = warnings.slice(0, 10);
          this.refreshStartupWarning();
        }
        if (input.kind === 'image') input = await this.copyImage(agent, input);
        if (input.kind === 'sudo') {
          if (agent.role !== 'lead') throw Object.assign(new Error('only a lead may post a sudo card'), { status: 403 });
          try { input = { ...input, ...await this.sudo.register(input) }; }
          catch (error) {
            if (error.status) throw error;
            throw Object.assign(new Error(`sudo helper not installed on ${os.hostname()}; the user installs it once with: sudo ${ROOT}/sudo-helper/install.sh`), { status: 503 });
          }
        }
        // Cards keep their order: anything still spooled from a hub outage goes first.
        const waiting = (await fsp.readdir(path.join(this.stateDir, 'spool', 'cards')).catch(() => [])).filter(f => f.endsWith('.json'));
        if (waiting.length && this.config.hub_url) await this.drainSpool('cards');
        const behind = (await fsp.readdir(path.join(this.stateDir, 'spool', 'cards')).catch(() => [])).some(f => f.endsWith('.json'));
        if (input.kind === 'done') {
          const unavailable = { error: 'the app is unreachable; the done card was not recorded; try again in a minute' };
          if (behind || !this.config.hub_url) return send(response, 503, unavailable);
          try {
            const payload = { ...input, session: agent.name, thread_id: agent.thread_id, delivery_id: input.delivery_id || crypto.randomUUID() };
            const relay = await requestJson(`${this.config.hub_url.replace(/\/$/, '')}/api/machine/cards`, 'POST', { [HUB_HEADER]: await this.secret() }, payload, 30000);
            if (relay.status >= 500) return send(response, 503, unavailable);
            let body; try { body = JSON.parse(relay.body || '{}'); } catch { body = { error: relay.body || 'hub returned invalid JSON' }; }
            return send(response, relay.status, body);
          } catch { return send(response, 503, unavailable); }
        }
        if (behind) { await this.spool('cards', { ...input, session: agent.name, thread_id: agent.thread_id }); return send(response, 202, { ok: true, spooled: true }); }
        const queued = await this.spool('cards', { ...input, session: agent.name, thread_id: agent.thread_id });
        if (!this.config.hub_url) return send(response, 202, { ok: true, spooled: true });
        try {
          const relay = await requestJson(`${this.config.hub_url.replace(/\/$/, '')}/api/machine/cards`, 'POST', { [HUB_HEADER]: await this.secret() }, queued.payload);
          let body; try { body = JSON.parse(relay.body || '{}'); } catch { body = { error: relay.body || 'hub returned invalid JSON' }; }
          if (relay.status >= 200 && relay.status < 300) { await this.sudo.accepted(queued.payload); await fsp.unlink(queued.file); return send(response, relay.status, body); }
          if ([500, 502, 503, 504].includes(relay.status)) return send(response, 202, { ok: true, spooled: true });
          if (relay.status >= 400 && relay.status < 500) { await this.sudo.dropped(queued.payload); await this.rejectSpool('cards', path.basename(queued.file), body.error || `hub refused (${relay.status})`); }
          return send(response, relay.status, body);
        } catch {
          return send(response, 202, { ok: true, spooled: true });
        }
      }
      if (request.method === 'POST' && url.pathname === '/v1/agent/hooks') { const agent = await this.authorize(request, 'agent'); const input = await bodyOf(request); return send(response, 202, agent.cli === 'kimi' ? { ignored: true } : await this.hook(agent.name, input)); }
      if (request.method === 'POST' && url.pathname === '/v1/agent/screen') { const agent = await this.authorize(request, 'agent'); return send(response, 200, await this.screens.handle(agent, await bodyOf(request))); }
      if (request.method === 'POST' && url.pathname === '/v1/agent/git') { const agent = await this.authorize(request, 'agent'); return send(response, 200, await this.git(agent, await bodyOf(request))); }
      if (request.method === 'POST' && url.pathname === '/v1/agent/session') { const agent = await this.authorize(request, 'agent'); return send(response, 200, await this.forwardSession(agent, await bodyOf(request))); }
      throw Object.assign(new Error('not found'), { status: 404 });
    } catch (error) { if (!response.destroyed && !response.headersSent) send(response, error.status || 500, { ...(error.handoff ? { result: 'failed' } : {}), error: error.message || String(error) }); }
  }
  async listen() {
    await this.init();
    this.server = http.createServer((request, response) => this.handle(request, response));
    await new Promise((resolve, reject) => { this.server.once('error', reject); this.server.listen(this.config.port, this.config.host, resolve); });
    // Spec "Machine service on the hub": spools are retried until the hub acknowledges them.
    this.spoolTimer = setInterval(() => { for (const kind of ['events', 'cards']) this.drainSpool(kind).catch(error => this.log(error)); }, this.spoolInterval);
    this.spoolTimer.unref();
    this.refreshStartupWarning();
    this.startupWarningTimer = setInterval(() => this.refreshStartupWarning(), 10 * 60 * 1000);
    this.startupWarningTimer.unref();
    this.sudoTimer = setInterval(() => this.sudo.tick().catch(error => this.log(error)), Number(process.env.WHEELCHAIR_SUDO_POLL_MS || 2000));
    this.sudoTimer.unref();
    this.server.once('close', () => { clearInterval(this.spoolTimer); clearInterval(this.startupWarningTimer); clearInterval(this.pollTimer); clearInterval(this.stepsTimer); clearInterval(this.kimiTimer); clearInterval(this.trustTimer); clearInterval(this.sudoTimer); clearInterval(this.screenTimer); clearInterval(this.agyToolsTimer); this.screens.stopTimers(); });
    process.stdout.write(`machine service listening on ${this.config.host}:${this.config.port}\n`);
    await this.drainSpool('events'); await this.drainSpool('cards');
  }
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  new MachineService(options).listen().catch(error => { process.stderr.write(`machine: ${error.message}\n`); process.exitCode = 1; });
}
module.exports = { MachineService, command, commandAsync, DEFAULT_STATE, normalizeGithubOrigin };
