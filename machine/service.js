#!/usr/bin/env node
'use strict';

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
const { spawnSync, spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_STATE = path.join(os.homedir(), '.local', 'state', 'wheelchair');
const HUB_HEADER = 'x-wheelchair-machine-secret';
const TOKEN_HEADER = 'x-wheelchair-session-token';

// A refusal of the request itself: 400, so the hub and agents report it rather than retry.
function die(message) { throw Object.assign(new Error(message), { status: 400 }); }
function safeName(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._/-]+$/.test(value) || value.includes('..')) die(`invalid ${label}`);
  return value;
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
function command(program, args, options = {}) {
  const result = spawnSync(program, args, { encoding: 'utf8', ...options });
  // Optional commands (notably systemd-run and tailscale) may be absent.  Their
  // callers select the documented fallback instead of crashing the service.
  if (result.error) return { ok: false, status: result.status ?? 127, stdout: result.stdout || '', stderr: result.stderr || result.error.message };
  return { ok: result.status === 0, status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}
const PERMISSION_MODES = { auto: 'auto', bypass: 'bypassPermissions' };
const CODEX_MODES = ['sandboxed', 'unrestricted'];
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const PREVIEW_TIMEOUT_MS = 60_000;
// The one place the starting instructions are composed, so the Claude system prompt and the
// Codex [wc:role] message cannot drift. role_prompt wins and role_layers is then ignored.
function composeRolePrompt(input) {
  if (input.role_prompt) return input.role_prompt;
  const roleFile = path.join(ROOT, 'protocol', 'app', `${input.role}.md`);
  const pointer = `Read ${roleFile} before responding. It is wheelchair's built-in rules for your role.`;
  const layers = typeof input.role_layers === 'string' ? input.role_layers.trim() : '';
  return layers ? `${pointer}\n\n${layers}` : pointer;
}
// Validates the optional start fields; returns the normalised ones.
function startOptions(input) {
  const mode = input.permission_mode === undefined || input.permission_mode === null ? 'auto' : input.permission_mode;
  if (!Object.hasOwn(PERMISSION_MODES, mode)) die('permission_mode must be auto or bypass');
  const codexMode = input.codex_mode === undefined || input.codex_mode === null ? 'sandboxed' : input.codex_mode;
  if (!CODEX_MODES.includes(codexMode)) die('codex_mode must be sandboxed or unrestricted');
  if (input.effort !== undefined && input.effort !== null && !EFFORTS.includes(input.effort)) die(`effort must be one of ${EFFORTS.join(', ')}`);
  if (input.role_layers !== undefined && input.role_layers !== null && typeof input.role_layers !== 'string') die('role_layers must be text');
  return { permission_mode: mode, codex_mode: codexMode, effort: input.effort || null };
}
function shellQuote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
function maybeTailscaleIp() {
  const result = command('tailscale', ['ip', '-4']);
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
    this.configPath = path.join(this.stateDir, 'machine.json');
    this.sessionsPath = path.join(this.stateDir, 'sessions.json');
    this.config = {};
    this.sessions = {};
    this.server = null;
    this.retryWindow = Number(process.env.WHEELCHAIR_RETRY_WINDOW_MS || 90_000);
    this.retryDelay = Number(process.env.WHEELCHAIR_RETRY_DELAY_MS || 1_000);
    this.spoolInterval = Number(process.env.WHEELCHAIR_SPOOL_INTERVAL_MS || 5_000);
    this.previewTimeoutMs = PREVIEW_TIMEOUT_MS; // tests shorten it on the instance
    // Read this once, when this process is made.  A pull changes ROOT's HEAD but not
    // the JavaScript this service is executing.
    this.version = command('git', ['-C', ROOT, 'rev-parse', 'HEAD']).stdout.trim();
    this.drains = new Map();
    this.options = options;
  }

  async init() {
    await mkdir(this.stateDir);
    this.config = await readJson(this.configPath, {});
    this.config.host = this.options.host || this.config.host || maybeTailscaleIp();
    this.config.port = Number(this.options.port || this.config.port || 7374);
    if (this.options.hubUrl) this.config.hub_url = this.options.hubUrl;
    if (this.options.secretFile) this.config.secret_file = this.options.secretFile;
    await atomicWrite(this.configPath, `${json(this.config)}\n`);
    this.sessions = await readJson(this.sessionsPath, {});
    await this.recoverFromTmux();
    await mkdir(path.join(this.stateDir, 'spool', 'cards'));
    await mkdir(path.join(this.stateDir, 'spool', 'events'));
    this.pollTimer = setInterval(() => this.pollReadiness().catch(error => this.log(error)), 2000);
    this.pollTimer.unref();
    // Trust is the one startup screen where waiting two seconds makes a newly-created
    // worktree feel stalled. Stuck sessions and open prompts remain on pollTimer.
    this.trustTimer = setInterval(() => this.pollTrust().catch(error => this.log(error)), 500);
    this.trustTimer.unref();
  }
  liveTmux() {
    const ls = this.tmux(['list-sessions', '-F', '#S']);
    return new Set(ls.ok ? ls.stdout.trim().split('\n').filter(Boolean) : []);
  }
  // Spec "Machine service on the hub": a live wc-* tmux session missing from sessions.json (a lost or
  // stale file) is adopted again, so it can still be read, typed into and stopped.  It has no token.
  async recoverFromTmux() {
    let changed = false;
    for (const name of this.liveTmux()) {
      if (!name.startsWith('wc-') || this.sessions[name]) continue;
      const parsed = /^wc-(.+?)-(sub-lead|lead|worker|reviewer|verifier|[a-z]+)(?:-\d+)?$/.exec(name);
      if (!parsed) continue;
      const pane = this.tmux(['capture-pane', '-p', '-t', name]);
      const where = this.tmux(['display-message', '-p', '-t', name, '#{pane_current_path}']);
      this.sessions[name] = { name, thread_id: parsed[1], role: parsed[2], status: 'ready', recovered: true,
        cli: pane.ok && pane.stdout.includes('Codex') ? 'codex' : 'claude',
        worktree: where.ok ? where.stdout.trim() : '', created_worktree: false, token: '', created_at: new Date().toISOString() };
      changed = true;
    }
    if (changed) await this.persistSessions();
  }
  async persistSessions() { await atomicWrite(this.sessionsPath, `${json(this.sessions)}\n`); }
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
  pane(name) {
    this.managed(name);
    const result = this.tmux(['capture-pane', '-p', '-t', name]);
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
  async createWorktree(input, sessionName) {
    if (input.worktree) {
      const worktree = path.resolve(input.worktree);
      if (input.role === 'worker' && input.branch) {
        let stat;
        try { stat = await fsp.stat(worktree); } catch { die(`worker worktree does not exist: ${worktree}`); }
        if (!stat.isDirectory()) die(`worker worktree is not a directory: ${worktree}`);
        const current = command('git', ['-C', worktree, 'rev-parse', '--abbrev-ref', 'HEAD']);
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
      const workers = Object.values(this.sessions).filter(s => s.thread_id === thread && s.role === 'worker').length + 1;
      branch = `wc-${thread}-w${workers}`;
    }
    safeName(branch, 'branch');
    // A verifier checks out the thread's branch detached, so it needs a directory of its own
    // rather than the branch's, which the lead's worktree already holds.
    const destination = input.role === 'verifier'
      ? path.join(this.stateDir, 'worktrees', project, safeName(sessionName, 'session name'))
      : path.join(this.stateDir, 'worktrees', project, branch);
    const fetch = command('git', ['-C', repo, 'fetch', 'origin']);
    if (!fetch.ok) die(fetch.stderr.trim() || 'git fetch failed');
    const defaultBranch = this.defaultBranch(repo);
    const base = input.base || `origin/${defaultBranch}`;
    const args = input.role === 'verifier'
      ? ['-C', repo, 'worktree', 'add', '--detach', destination, input.verify_ref || base]
      // --no-track: a branch made from origin/main would otherwise track main, and a plain
      // push of the thread's branch is then refused.
      : ['-C', repo, 'worktree', 'add', '--no-track', '-b', branch, destination, base];
    const added = command('git', args);
    if (!added.ok) die(added.stderr.trim() || 'git worktree add failed');
    return { worktree: destination, defaultBranch, branch };
  }
  defaultBranch(repo) {
    const symbolic = command('git', ['-C', repo, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
    const remote = symbolic.stdout.trim();
    if (symbolic.ok && remote.startsWith('origin/') && remote.length > 'origin/'.length) return remote.slice('origin/'.length);
    const shown = command('git', ['-C', repo, 'remote', 'show', 'origin']);
    const match = shown.stdout.match(/^\s*HEAD branch:\s*(\S+)\s*$/m);
    return match ? match[1] : 'main';
  }
  commandFor(input, session, worktree) {
    // Spec "Machine service on the hub": exact interactive CLI permissions and hooks.
    const rolePrompt = composeRolePrompt(input);
    if (input.cli === 'claude') {
      const settingsPath = path.join(this.stateDir, 'settings', `${session.name}.json`);
      const hook = path.join(ROOT, 'machine', 'hook.sh');
      // No suggested next prompt: one Enter in a terminal would send it as if Collin typed it.
      const settings = { cleanupPeriodDays: 30, promptSuggestionEnabled: false, ...(session.permission_mode === 'bypass' ? { skipDangerousModePermissionPrompt: true } : {}), hooks: {
        Stop: [{ hooks: [{ type: 'command', command: `${shellQuote(hook)} claude ${shellQuote(session.name)}` }] }],
        Notification: [{ hooks: [{ type: 'command', command: `${shellQuote(hook)} claude ${shellQuote(session.name)}` }] }],
      } };
      return { settingsPath, settings, argv: ['claude', '--session-id', session.cli_session_id, '--settings', settingsPath, '--permission-mode', PERMISSION_MODES[session.permission_mode], ...(input.model ? ['--model', input.model] : []), ...(session.effort ? ['--effort', session.effort] : []), '--append-system-prompt', rolePrompt] };
    }
    if (input.cli === 'codex') {
      const trust = `projects={${json(worktree)}={trust_level="trusted"}}`;
      const notify = `notify=[${json(path.join(ROOT, 'machine', 'hook.sh'))},"codex",${json(session.name)}]`;
      // A reviewer stays read-only whatever the mode: it only reads. Unrestricted drops
      // the sandbox and approvals entirely (Codex's --yolo); sandboxed confines writes to the worktree.
      const access = input.role === 'reviewer' ? ['-s', 'read-only', '-a', 'never']
        : session.codex_mode === 'unrestricted' ? ['--dangerously-bypass-approvals-and-sandbox']
          : ['-s', 'workspace-write', '-a', 'never', '-c', 'sandbox_workspace_write.network_access=true'];
      return { argv: ['codex', ...access, '-c', notify, '-c', trust, ...(input.model ? ['-m', input.model] : [])] };
    }
    die('cli must be claude or codex');
  }
  async start(input) {
    for (const key of ['role', 'cli', 'thread_id', 'token']) if (!input[key]) die(`missing ${key}`);
    const name = input.name || this.sessionName(input.thread_id, input.role);
    safeName(name, 'session name');
    if (!name.startsWith('wc-')) die('session name must begin wc-');
    if (this.sessions[name]) return this.sessions[name];
    const options = startOptions(input);
    const createdWorktree = !input.worktree;
    const created = await this.createWorktree(input, name);
    const worktree = created.worktree;
    const session = { name, role: input.role, cli: input.cli, permission_mode: options.permission_mode, codex_mode: options.codex_mode, effort: options.effort, thread_id: input.thread_id, token: input.token,
      worktree, created_worktree: createdWorktree, attempt_id: input.attempt_id || null, started_by: input.started_by || null,
      branch: created.branch || input.branch || null, default_branch: created.defaultBranch || input.default_branch || input.defaultBranch || null,
      cli_session_id: input.cli_session_id || crypto.randomUUID(), status: 'starting', created_at: new Date().toISOString() };
    const built = this.commandFor(input, session, worktree);
    if (built.settingsPath) await atomicWrite(built.settingsPath, `${json(built.settings)}\n`);
    const commandText = ['env', 'WHEELCHAIR_LANE=1', `WHEELCHAIR_SESSION_TOKEN=${session.token}`, `WHEELCHAIR_STATE_DIR=${this.stateDir}`, `WHEELCHAIR_MACHINE_ORIGIN=http://${this.config.host}:${this.config.port}`, ...built.argv].map(shellQuote).join(' ');
    session.command = built.argv;
    // Spec "Machine service on the hub": Codex's first, binding message always
    // uses the literal marker [wc:role], regardless of the selected role.
    const rolePrompt = composeRolePrompt(input);
    const firstMessage = input.brief || input.first_message || '';
    session.pending_initial = input.cli === 'codex'
      ? `[wc:role] ${rolePrompt}${firstMessage ? `\n\n${firstMessage}` : ''}`
      : firstMessage;
    const tmuxArgs = ['new-session', '-d', '-s', name, '-x', '200', '-y', '50', '-c', worktree, commandText];
    // systemd-run scope prevents service restarts killing tmux; installer sets KillMode=process too.
    const scoped = command('systemd-run', ['--user', '--scope', 'tmux', ...tmuxArgs]);
    const result = scoped.ok ? scoped : this.tmux(tmuxArgs);
    if (!result.ok) die(result.stderr.trim() || 'tmux session failed to start');
    this.sessions[name] = session;
    await this.persistSessions();
    await this.checkReady(session);
    return session;
  }
  readyText(session, pane) {
    // A session without a recorded mode (recovered, or started before the field) is auto.
    if (session.cli === 'claude') return !pane.includes('Yes, I trust this folder') && !pane.includes('No, exit') && !pane.includes('Yes, I accept') && pane.includes(session.permission_mode === 'bypass' ? 'bypass permissions on' : 'auto mode on') && /(^|\n).*❯\s/m.test(pane);
    return pane.includes('Ask Codex to do anything');
  }
  async emitEvent(event) {
    const spool = await this.spool('events', event);
    await this.drainSpool('events');
    return spool;
  }
  async checkReady(session) {
    if (session.status === 'ready') return true;
    let pane;
    try { pane = this.pane(session.name); } catch { return false; }
    if (session.cli === 'claude' && pane.includes('Yes, I trust this folder')) {
      this.tmux(['send-keys', '-t', session.name, 'Down']);
      this.tmux(['send-keys', '-t', session.name, 'Enter']);
      session.trust_answered = true;
      await this.persistSessions();
      return false;
    }
    // Bypass: the CLI's one-time "Bypass Permissions mode" warning (1. No, exit / 2. Yes, I accept).
    // The per-session settings file normally suppresses it; this answers it if it still appears.
    if (session.cli === 'claude' && session.permission_mode === 'bypass' && pane.includes('Yes, I accept')) {
      this.tmux(['send-keys', '-t', session.name, 'Down']);
      this.tmux(['send-keys', '-t', session.name, 'Enter']);
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
    ]);
  }
  async pollTrust() {
    const now = Date.now();
    await Promise.all(Object.values(this.sessions)
      .filter(session => session.cli === 'claude' && session.status === 'starting'
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
    if (session.status !== 'ready') throw Object.assign(new Error('session is not ready'), { status: 409 });
    const buffer = `wc-${crypto.randomUUID()}`;
    const loaded = this.tmux(['load-buffer', '-b', buffer, '-'], { input: text });
    if (!loaded.ok) throw Object.assign(new Error('tmux buffer failed'), { status: 409 });
    const pasted = this.tmux(['paste-buffer', '-p', '-b', buffer, '-t', name]);
    const enter = this.tmux(['send-keys', '-t', name, 'Enter']);
    if (!pasted.ok || !enter.ok) throw Object.assign(new Error('tmux submit failed'), { status: 409 });
  }
  raw(name, keys) {
    this.managed(name);
    const result = this.tmux(['send-keys', '-t', name, keys]);
    if (!result.ok) throw Object.assign(new Error('tmux keys failed'), { status: 409 });
  }
  async stop(name) {
    const session = this.managed(name);
    this.tmux(['kill-session', '-t', name]);
    session.prompt_open = false;
    session.status = 'stopped'; session.stopped_at = new Date().toISOString();
    await this.persistSessions();
    if (session.role === 'verifier' && session.created_worktree) command('git', ['-C', session.worktree, 'worktree', 'remove', '--force', session.worktree]);
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
    safeName(threadId, 'thread id');
    const sessions = Object.values(this.sessions).filter(session => session.thread_id === threadId);
    const stopped = [];
    for (const session of sessions) {
      if (session.archived_pending) continue;
      await this.stop(session.name);
      stopped.push(session.name);
    }
    const worktrees = [...new Map(sessions
      .filter(session => session.created_worktree && session.role !== 'verifier')
      .map(session => [path.resolve(session.worktree), session])).values()];
    const committed = []; const removed = []; const kept = [];
    for (const session of worktrees) {
      const worktree = path.resolve(session.worktree);
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
    return { stopped, committed, removed, kept };
  }
  async copyTranscript(session, source) {
    if (!source) return { offset: 0, lines: [] };
    const stat = await fsp.stat(source);
    const current = session.transcript_source;
    const changed = current && (current.path !== source || stat.size < current.offset || stat.ino !== current.ino);
    let begin = changed ? 0 : (current?.offset || 0);
    const file = await fsp.open(source, 'r'); let text;
    try { const size = stat.size - begin; const buffer = Buffer.alloc(Math.max(size, 0)); await file.read(buffer, 0, buffer.length, begin); text = buffer.toString('utf8'); } finally { await file.close(); }
    // A JSONL record isn't durable until its newline arrives.  Leave an unfinished
    // tail for the next read instead of copying a fragment and advancing past it.
    const newline = text.lastIndexOf('\n');
    const complete = newline < 0 ? '' : text.slice(0, newline + 1);
    const lines = complete ? complete.slice(0, -1).split('\n') : [];
    const nextOffset = begin + Buffer.byteLength(complete);
    const target = path.join(this.stateDir, 'transcripts', session.thread_id, `${session.name}.jsonl`);
    let copied = '';
    try { copied = await fsp.readFile(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const hashes = new Set(copied.split('\n').filter(Boolean).map(line => crypto.createHash('sha256').update(line).digest('hex')));
    const additions = lines.filter(line => { const hash = crypto.createHash('sha256').update(line).digest('hex'); if (hashes.has(hash)) return false; hashes.add(hash); return true; });
    if (additions.length) { await mkdir(path.dirname(target)); await fsp.appendFile(target, `${additions.join('\n')}\n`, { mode: 0o600 }); }
    session.transcript_path = target;
    session.transcript_source = { path: source, offset: nextOffset, ino: stat.ino };
    await this.persistSessions();
    return { offset: nextOffset, lines: additions };
  }
  async transcript(name, offset = 0) {
    let session;
    try { session = this.managed(name); } catch (error) {
      // An archived thread's sessions are forgotten, but their transcript copies are kept so
      // the thread's chat still opens (Spec "Archive").
      const thread = /^wc-([A-Za-z0-9]+)-[a-z]/.exec(safeName(name, 'session name'))?.[1];
      const kept = thread && await fsp.readFile(path.join(this.stateDir, 'transcripts', thread, `${name}.jsonl`), 'utf8').catch(() => null);
      if (kept === null || kept === undefined || kept === false) throw error;
      return { offset: Buffer.byteLength(kept), data: Buffer.from(kept).subarray(Number(offset)).toString('utf8') };
    }
    // Spec "Branches and checkouts": before the first Stop hook, find Claude's file by session id.
    if (!session.source_transcript && session.cli === 'claude' && session.cli_session_id) {
      const found = await this.claudeTranscript(session.cli_session_id);
      if (found) session.source_transcript = found;
    }
    if (session.source_transcript) {
      try { await this.copyTranscript(session, session.source_transcript); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const data = session.transcript_path ? await fsp.readFile(session.transcript_path, 'utf8').catch(() => '') : '';
    const byte = Buffer.byteLength(data);
    return { offset: byte, data: Buffer.from(data).subarray(Number(offset)).toString('utf8') };
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
      if (kind === 'events') {
        try {
          const prepared = await this.hook(payload.session, payload, { spooled: true });
          if (prepared.ignored) { await this.rejectSpool(kind, file, 'event ignored by the live hook handler'); continue; }
          payload = { ...prepared.event, delivery_id: payload.delivery_id };
        } catch (error) { await this.rejectSpool(kind, file, error.message || String(error)); continue; }
      }
      try {
        const response = await requestJson(`${this.config.hub_url.replace(/\/$/, '')}/api/machine/${kind}`, 'POST', { [HUB_HEADER]: await this.secret() }, payload);
        if (response.status >= 200 && response.status < 300) { await fsp.unlink(path.join(dir, file)); continue; }
        if (response.status >= 400 && response.status < 500) {
          let reason = `hub refused (${response.status})`;
          try { reason = JSON.parse(response.body || '{}').error || reason; } catch { /* keep status */ }
          await this.rejectSpool(kind, file, reason);
          continue;
        }
        break;
      } catch { break; }
    }
  }
  async hook(session, event, { spooled = false } = {}) {
    const current = this.managed(session);
    if (event.transcript_path) { current.source_transcript = event.transcript_path; await this.copyTranscript(current, event.transcript_path); }
    if (current.cli === 'codex' && event.type === 'turn-ended' && !current.codex_thread_id) {
      const first = event['input-messages']?.[0] || event.input_messages?.[0] || '';
      const threadId = event['thread-id'] || event.thread_id;
      if (!first.startsWith('[wc:role]') || !threadId || !await this.codexRollout(threadId)) return { ignored: true };
      current.codex_thread_id = threadId; current.source_transcript = await this.codexRollout(threadId); await this.persistSessions();
    }
    if (current.cli === 'codex' && event['thread-id'] && current.codex_thread_id !== event['thread-id']) return { ignored: true };
    if (event.type === 'prompt' && event.notification_type !== 'permission_prompt') return { ignored: true };
    const { session: ignoredSession, thread_id: ignoredThread, delivery_id: ignoredDelivery, ...rest } = event;
    const forwarded = { ...rest, session, thread_id: current.thread_id };
    if (event.type === 'prompt') { current.prompt_open = true; await this.persistSessions(); }
    if (spooled) return { ok: true, event: forwarded };
    await this.emitEvent(forwarded);
    return { ok: true };
  }
  async claudeTranscript(cliSessionId) {
    const root = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'projects');
    for (const entry of await fsp.readdir(root, { withFileTypes: true }).catch(() => [])) {
      const candidate = path.join(root, entry.name, `${cliSessionId}.jsonl`);
      if (entry.isDirectory() && fs.existsSync(candidate)) return candidate;
    }
    return null;
  }
  async codexRollout(threadId) {
    const root = path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'sessions');
    const find = async directory => {
      let entries; try { entries = await fsp.readdir(directory, { withFileTypes: true }); } catch { return null; }
      for (const entry of entries) { const next = path.join(directory, entry.name); if (entry.isDirectory()) { const hit = await find(next); if (hit) return hit; } else if (entry.name.endsWith(`-${threadId}.jsonl`)) return next; }
      return null;
    };
    return find(root);
  }
  // Spec "Branches and checkouts": a sub-lead removes a worker's worktree once that worker is done and merged.
  async removeWorkerWorktree(caller, workerName, cwd) {
    if (caller.role !== 'sub-lead') die('only a sub-lead may remove a worker worktree');
    const worker = this.sessions[workerName];
    if (!worker || worker.role !== 'worker' || worker.thread_id !== caller.thread_id) die('args[0] must name a worker session of this thread');
    if (!worker.created_worktree || worker.worktree_removed) die('worker has no removable worktree');
    if (worker.status !== 'stopped' && this.liveTmux().has(worker.name)) die('worker is still running');
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
    if (operation === 'commit' && result.ok) result = run('git', ['commit', '-m', input.message, '--', ...input.paths]);
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
          try { reason = JSON.parse(response.body || '{}').error || reason; } catch { /* keep the generic reason */ }
          throw Object.assign(new Error(reason), { status: response.status, refused: true });
        }
      } catch (error) { if (error.refused) throw error; /* otherwise retry */ }
      if (Date.now() >= until) throw Object.assign(new Error('hub unavailable'), { status: 503 });
      await new Promise(resolve => setTimeout(resolve, this.retryDelay));
    }
  }
  status() {
    const live = this.liveTmux();
    const others = [...live].filter(name => !this.sessions[name]).map(name => ({ name, managed: false, running: true }));
    return { version: this.version,
      claude: this.cliStatus('claude'), codex: this.cliStatus('codex'), sessions: [...Object.values(this.sessions).map(s => ({ ...s, managed: true, running: live.has(s.name) })), ...others] };
  }
  cliStatus(cli) {
    const version = command('sh', ['-c', `command -v ${cli}`]);
    if (!version.ok) return { installed: false, logged_in: false };
    const check = command(cli, ['--version']);
    // Claude reports its login itself; Codex's login is the preflight's job (/v1/preflight).
    let loggedIn = check.ok;
    if (cli === 'claude') {
      const auth = command('claude', ['auth', 'status'], { timeout: 15_000 });
      try { loggedIn = auth.ok && JSON.parse(auth.stdout).loggedIn === true; } catch { loggedIn = false; }
    }
    return { installed: true, logged_in: loggedIn, version: check.stdout.trim() || check.stderr.trim() };
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
  async handle(request, response) {
    const url = new URL(request.url, 'http://machine.local');
    const pathBits = url.pathname.split('/').filter(Boolean);
    try {
      if (request.method === 'GET' && url.pathname === '/health') return send(response, 200, { ok: true });
      if (request.method === 'GET' && url.pathname === '/v1/status') { await this.authorize(request, 'hub'); return send(response, 200, this.status()); }
      if (request.method === 'POST' && url.pathname === '/v1/preflight') { await this.authorize(request, 'hub'); const result = command(path.join(ROOT, 'codex', 'preflight.sh'), []); return send(response, result.ok ? 200 : 409, result); }
      if (request.method === 'POST' && url.pathname === '/v1/preview') { await this.authorize(request, 'hub'); const result = await this.preview(await bodyOf(request)); return send(response, result.status, result.body); }
      if (request.method === 'POST' && url.pathname === '/v1/sessions') { await this.authorize(request, 'hub'); return send(response, 201, await this.start(await bodyOf(request))); }
      if (request.method === 'GET' && url.pathname === '/v1/sessions') { await this.authorize(request, 'hub'); return send(response, 200, this.status().sessions); }
      if (request.method === 'POST' && url.pathname === '/v1/archive') { await this.authorize(request, 'hub'); return send(response, 200, await this.archive((await bodyOf(request)).thread_id)); }
      if (pathBits[0] === 'v1' && pathBits[1] === 'sessions' && pathBits[2]) {
        const name = decodeURIComponent(pathBits[2]); await this.authorize(request, 'hub');
        if (request.method === 'DELETE' && pathBits.length === 3) { await this.stop(name); return send(response, 200, { ok: true }); }
        if (request.method === 'GET' && pathBits[3] === 'pane') return send(response, 200, { pane: this.pane(name) });
        if (request.method === 'GET' && pathBits[3] === 'transcript') return send(response, 200, await this.transcript(name, url.searchParams.get('offset') || 0));
        if (request.method === 'POST' && pathBits[3] === 'submit') { const input = await bodyOf(request); await this.submit(name, String(input.text || '')); return send(response, 200, { ok: true }); }
        if (request.method === 'POST' && pathBits[3] === 'keys') { const input = await bodyOf(request); this.raw(name, String(input.keys || '')); return send(response, 200, { ok: true }); }
      }
      if (request.method === 'POST' && url.pathname === '/v1/agent/cards') {
        const agent = await this.authorize(request, 'agent');
        // Cards keep their order: anything still spooled from a hub outage goes first.
        const waiting = (await fsp.readdir(path.join(this.stateDir, 'spool', 'cards')).catch(() => [])).filter(f => f.endsWith('.json'));
        if (waiting.length && this.config.hub_url) await this.drainSpool('cards');
        const behind = (await fsp.readdir(path.join(this.stateDir, 'spool', 'cards')).catch(() => [])).some(f => f.endsWith('.json'));
        if (behind) { await this.spool('cards', { ...(await bodyOf(request)), session: agent.name, thread_id: agent.thread_id }); return send(response, 202, { ok: true, spooled: true }); }
        const queued = await this.spool('cards', { ...(await bodyOf(request)), session: agent.name, thread_id: agent.thread_id });
        if (!this.config.hub_url) return send(response, 202, { ok: true, spooled: true });
        try {
          const relay = await requestJson(`${this.config.hub_url.replace(/\/$/, '')}/api/machine/cards`, 'POST', { [HUB_HEADER]: await this.secret() }, queued.payload);
          let body; try { body = JSON.parse(relay.body || '{}'); } catch { body = { error: relay.body || 'hub returned invalid JSON' }; }
          if (relay.status >= 200 && relay.status < 300) { await fsp.unlink(queued.file); return send(response, relay.status, body); }
          if ([502, 503, 504].includes(relay.status)) return send(response, 202, { ok: true, spooled: true });
          if (relay.status >= 400 && relay.status < 500) await this.rejectSpool('cards', path.basename(queued.file), body.error || `hub refused (${relay.status})`);
          return send(response, relay.status, body);
        } catch {
          return send(response, 202, { ok: true, spooled: true });
        }
      }
      if (request.method === 'POST' && url.pathname === '/v1/agent/hooks') { const agent = await this.authorize(request, 'agent'); const input = await bodyOf(request); return send(response, 202, await this.hook(agent.name, input)); }
      if (request.method === 'POST' && url.pathname === '/v1/agent/git') { const agent = await this.authorize(request, 'agent'); return send(response, 200, await this.git(agent, await bodyOf(request))); }
      if (request.method === 'POST' && url.pathname === '/v1/agent/session') { const agent = await this.authorize(request, 'agent'); return send(response, 200, await this.forwardSession(agent, await bodyOf(request))); }
      throw Object.assign(new Error('not found'), { status: 404 });
    } catch (error) { send(response, error.status || 500, { error: error.message || String(error) }); }
  }
  async listen() {
    await this.init();
    this.server = http.createServer((request, response) => this.handle(request, response));
    await new Promise((resolve, reject) => { this.server.once('error', reject); this.server.listen(this.config.port, this.config.host, resolve); });
    // Spec "Machine service on the hub": spools are retried until the hub acknowledges them.
    this.spoolTimer = setInterval(() => { for (const kind of ['events', 'cards']) this.drainSpool(kind).catch(error => this.log(error)); }, this.spoolInterval);
    this.spoolTimer.unref();
    this.server.once('close', () => { clearInterval(this.spoolTimer); clearInterval(this.pollTimer); clearInterval(this.trustTimer); });
    process.stdout.write(`machine service listening on ${this.config.host}:${this.config.port}\n`);
    await this.drainSpool('events'); await this.drainSpool('cards');
  }
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  new MachineService(options).listen().catch(error => { process.stderr.write(`machine: ${error.message}\n`); process.exitCode = 1; });
}
module.exports = { MachineService, command, DEFAULT_STATE };
