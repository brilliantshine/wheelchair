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
const { spawnSync } = require('node:child_process');

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
    await mkdir(path.join(this.stateDir, 'spool', 'cards'));
    await mkdir(path.join(this.stateDir, 'spool', 'events'));
    this.pollTimer = setInterval(() => this.pollReadiness().catch(error => this.log(error)), 2000);
    this.pollTimer.unref();
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
    if (input.worktree) return path.resolve(input.worktree);
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
    const base = input.base || `origin/${input.default_branch || input.defaultBranch || 'main'}`;
    const args = input.role === 'verifier'
      ? ['-C', repo, 'worktree', 'add', '--detach', destination, input.verify_ref || base]
      // --no-track: a branch made from origin/main would otherwise track main, and a plain
      // push of the thread's branch is then refused.
      : ['-C', repo, 'worktree', 'add', '--no-track', '-b', branch, destination, base];
    const added = command('git', args);
    if (!added.ok) die(added.stderr.trim() || 'git worktree add failed');
    return destination;
  }
  commandFor(input, session, worktree) {
    // Spec "Machine service on the hub": exact interactive CLI permissions and hooks.
    const roleFile = path.join(ROOT, 'protocol', 'app', `${input.role}.md`);
    const rolePrompt = input.role_prompt || `Read ${roleFile} before responding.`;
    if (input.cli === 'claude') {
      const settingsPath = path.join(this.stateDir, 'settings', `${session.name}.json`);
      const hook = path.join(ROOT, 'machine', 'hook.sh');
      // No suggested next prompt: one Enter in a terminal would send it as if Collin typed it.
      const settings = { cleanupPeriodDays: 30, promptSuggestionEnabled: false, hooks: {
        Stop: [{ hooks: [{ type: 'command', command: `${shellQuote(hook)} claude ${shellQuote(session.name)}` }] }],
        Notification: [{ hooks: [{ type: 'command', command: `${shellQuote(hook)} claude ${shellQuote(session.name)}` }] }],
      } };
      return { settingsPath, settings, argv: ['claude', '--session-id', session.cli_session_id, '--settings', settingsPath, '--permission-mode', 'auto', '--append-system-prompt', rolePrompt] };
    }
    if (input.cli === 'codex') {
      const trust = `projects={${json(worktree)}={trust_level="trusted"}}`;
      const notify = `notify=[${json(path.join(ROOT, 'machine', 'hook.sh'))},"codex",${json(session.name)}]`;
      return { argv: ['codex', '-s', input.role === 'reviewer' ? 'read-only' : 'workspace-write', '-a', 'never', '-c', 'sandbox_workspace_write.network_access=true', '-c', notify, '-c', trust, ...(input.model ? ['-m', input.model] : [])] };
    }
    die('cli must be claude or codex');
  }
  async start(input) {
    for (const key of ['role', 'cli', 'thread_id', 'token']) if (!input[key]) die(`missing ${key}`);
    const name = input.name || this.sessionName(input.thread_id, input.role);
    safeName(name, 'session name');
    if (!name.startsWith('wc-')) die('session name must begin wc-');
    if (this.sessions[name]) return this.sessions[name];
    const createdWorktree = !input.worktree;
    const worktree = await this.createWorktree(input, name);
    const session = { name, role: input.role, cli: input.cli, thread_id: input.thread_id, token: input.token,
      worktree, created_worktree: createdWorktree, attempt_id: input.attempt_id || null, started_by: input.started_by || null,
      cli_session_id: input.cli_session_id || crypto.randomUUID(), status: 'starting', created_at: new Date().toISOString() };
    const built = this.commandFor(input, session, worktree);
    if (built.settingsPath) await atomicWrite(built.settingsPath, `${json(built.settings)}\n`);
    const commandText = ['env', 'WHEELCHAIR_LANE=1', `WHEELCHAIR_SESSION_TOKEN=${session.token}`, `WHEELCHAIR_STATE_DIR=${this.stateDir}`, `WHEELCHAIR_MACHINE_ORIGIN=http://${this.config.host}:${this.config.port}`, ...built.argv].map(shellQuote).join(' ');
    session.command = built.argv;
    // Spec "Machine service on the hub": Codex's first, binding message always
    // uses the literal marker [wc:role], regardless of the selected role.
    const rolePrompt = input.role_prompt || `Read ${path.join(ROOT, 'protocol', 'app', `${input.role}.md`)} before responding.`;
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
    if (session.cli === 'claude') return !pane.includes('Yes, I trust this folder') && !pane.includes('No, exit') && pane.includes('auto mode on') && /(^|\n).*❯\s/m.test(pane);
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
  async pollReadiness() { await Promise.all(Object.values(this.sessions).filter(s => s.status !== 'ready').map(s => this.checkReady(s))); }
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
    session.status = 'stopped'; session.stopped_at = new Date().toISOString();
    await this.persistSessions();
    if (session.role === 'verifier' && session.created_worktree) command('git', ['-C', session.worktree, 'worktree', 'remove', session.worktree]);
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
    for (const session of sessions) delete this.sessions[session.name];
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
    const lines = text.split('\n'); if (lines.at(-1) === '') lines.pop();
    const target = path.join(this.stateDir, 'transcripts', session.thread_id, `${session.name}.jsonl`);
    let copied = '';
    try { copied = await fsp.readFile(target, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const hashes = new Set(copied.split('\n').filter(Boolean).map(line => crypto.createHash('sha256').update(line).digest('hex')));
    const additions = lines.filter(line => { const hash = crypto.createHash('sha256').update(line).digest('hex'); if (hashes.has(hash)) return false; hashes.add(hash); return true; });
    if (additions.length) { await mkdir(path.dirname(target)); await fsp.appendFile(target, `${additions.join('\n')}\n`, { mode: 0o600 }); }
    session.transcript_path = target;
    session.transcript_source = { path: source, offset: stat.size, ino: stat.ino };
    await this.persistSessions();
    return { offset: stat.size, lines: additions };
  }
  async transcript(name, offset = 0) {
    const session = this.managed(name);
    if (session.source_transcript) await this.copyTranscript(session, session.source_transcript);
    const data = session.transcript_path ? await fsp.readFile(session.transcript_path, 'utf8').catch(() => '') : '';
    const byte = Buffer.byteLength(data);
    return { offset: byte, data: Buffer.from(data).subarray(Number(offset)).toString('utf8') };
  }
  async spool(kind, payload) {
    const dir = path.join(this.stateDir, 'spool', kind);
    await mkdir(dir);
    const name = `${String(Date.now()).padStart(15, '0')}-${crypto.randomUUID()}.json`;
    const file = path.join(dir, name);
    await atomicWrite(file, `${json(payload)}\n`);
    return file;
  }
  async drainSpool(kind) {
    if (!this.config.hub_url) return;
    const dir = path.join(this.stateDir, 'spool', kind);
    const files = (await fsp.readdir(dir).catch(() => [])).filter(f => f.endsWith('.json')).sort();
    for (const file of files) {
      const payload = await readJson(path.join(dir, file), null); if (!payload) continue;
      try {
        const response = await requestJson(`${this.config.hub_url.replace(/\/$/, '')}/api/machine/${kind}`, 'POST', { [HUB_HEADER]: await this.secret() }, payload);
        if (response.status < 200 || response.status >= 300) break;
        await fsp.unlink(path.join(dir, file));
      } catch { break; }
    }
  }
  async hook(session, event) {
    const current = this.managed(session);
    if (event.transcript_path) { current.source_transcript = event.transcript_path; await this.copyTranscript(current, event.transcript_path); }
    if (current.cli === 'codex' && !current.codex_thread_id) {
      const first = event['input-messages']?.[0] || event.input_messages?.[0] || '';
      const threadId = event['thread-id'] || event.thread_id;
      if (!first.startsWith('[wc:role]') || !threadId || !await this.codexRollout(threadId)) return { ignored: true };
      current.codex_thread_id = threadId; current.source_transcript = await this.codexRollout(threadId); await this.persistSessions();
    }
    if (current.cli === 'codex' && event['thread-id'] && current.codex_thread_id !== event['thread-id']) return { ignored: true };
    if (event.type === 'prompt' && event.notification_type !== 'permission_prompt') return { ignored: true };
    await this.emitEvent({ ...event, session, thread_id: current.thread_id });
    return { ok: true };
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
  async git(session, input) {
    const operation = input.operation; const args = Array.isArray(input.args) ? input.args.map(String) : [];
    const allowed = new Set(['fetch', 'commit', 'merge', 'cherry-pick', 'revert', 'push', 'pr']);
    if (!allowed.has(operation)) die('unsupported git operation');
    if (operation === 'commit' && (!Array.isArray(input.paths) || input.paths.length === 0)) throw Object.assign(new Error('commit requires explicit paths'), { status: 400 });
    if (operation === 'commit' && !String(input.message || '').trim()) throw Object.assign(new Error('commit requires a message'), { status: 400 });
    const cwd = path.resolve(session.worktree);
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
    const ls = this.tmux(['list-sessions', '-F', '#S']);
    const live = new Set(ls.ok ? ls.stdout.trim().split('\n').filter(Boolean) : []);
    return { version: command('git', ['-C', ROOT, 'rev-parse', 'HEAD']).stdout.trim(),
      claude: this.cliStatus('claude'), codex: this.cliStatus('codex'), sessions: Object.values(this.sessions).map(s => ({ ...s, running: live.has(s.name) })) };
  }
  cliStatus(cli) {
    const version = command('sh', ['-c', `command -v ${cli}`]);
    if (!version.ok) return { installed: false, logged_in: false };
    const check = command(cli, ['--version']);
    return { installed: true, logged_in: check.ok, version: check.stdout.trim() || check.stderr.trim() };
  }
  async handle(request, response) {
    const url = new URL(request.url, 'http://machine.local');
    const pathBits = url.pathname.split('/').filter(Boolean);
    try {
      if (request.method === 'GET' && url.pathname === '/health') return send(response, 200, { ok: true });
      if (request.method === 'GET' && url.pathname === '/v1/status') { await this.authorize(request, 'hub'); return send(response, 200, this.status()); }
      if (request.method === 'POST' && url.pathname === '/v1/preflight') { await this.authorize(request, 'hub'); const result = command(path.join(ROOT, 'codex', 'preflight.sh'), []); return send(response, result.ok ? 200 : 409, result); }
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
      if (request.method === 'POST' && url.pathname === '/v1/agent/cards') { const agent = await this.authorize(request, 'agent'); await this.spool('cards', { ...(await bodyOf(request)), session: agent.name, thread_id: agent.thread_id }); await this.drainSpool('cards'); return send(response, 202, { ok: true }); }
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
    process.stdout.write(`machine service listening on ${this.config.host}:${this.config.port}\n`);
    await this.drainSpool('events'); await this.drainSpool('cards');
  }
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  new MachineService(options).listen().catch(error => { process.stderr.write(`machine: ${error.message}\n`); process.exitCode = 1; });
}
module.exports = { MachineService, command, DEFAULT_STATE };
