'use strict';
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const os = require('node:os');
const { spawnSync, execFile } = require('node:child_process');
const c = require('../common');
const home = dir => path.resolve(dir || c.home('KIMI_CODE_HOME', '.kimi-code'));
function resolveCli() {
  const found = spawnSync('sh', ['-c', 'command -v kimi'], { encoding: 'utf8' });
  const candidate = found.status === 0 ? found.stdout.trim() : path.join(os.homedir(), '.kimi-code/bin/kimi');
  try { fs.accessSync(candidate, fs.constants.X_OK); return path.resolve(candidate); } catch { return null; }
}
function readConfig(dir) {
  let text;
  try { text = fs.readFileSync(path.join(home(dir), 'config.toml'), 'utf8'); }
  catch (e) { return e.code === 'ENOENT' ? {} : { problem: "Kimi Code's config.toml can't be read" }; }
  if (text.includes('"""') || text.includes("'''")) return { problem: "Kimi Code's config.toml has multi-line strings wheelchair can't read" };
  const result = {}; let table = '', depth = 0;
  // TOML basic strings ("…", with \ escapes) and literal strings ('…', no escapes) hide brackets and #.
  const scan = (raw, onChar) => {
    let quote = '', escaped = false;
    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];
      if (quote === '"' && escaped) { escaped = false; continue; }
      if (quote === '"' && char === '\\') { escaped = true; continue; }
      if (quote) { if (char === quote) quote = ''; continue; }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (onChar(char, i) === false) return;
    }
  };
  const bracketDelta = raw => {
    let delta = 0;
    scan(raw, char => { if (char === '#') return false; if (char === '[') delta++; else if (char === ']') delta--; });
    return delta;
  };
  for (const line of text.split(/\r?\n/)) {
    if (depth > 0) { depth += bracketDelta(line); continue; }
    const header = line.match(/^\s*\[([^\[\]]+)\]\s*(?:#.*)?$/);
    if (header) { table = header[1].trim(); continue; }
    if (/^\s*\[\[/.test(line)) { table = null; continue; }
    const kv = line.match(/^\s*([\w-]+)\s*=\s*(.*)$/); if (!kv) continue;
    let raw = kv[2];
    scan(kv[2], (char, i) => { if (char === '#') { raw = kv[2].slice(0, i); return false; } });
    const valueDepth = bracketDelta(raw);
    if (valueDepth > 0) { depth = valueDepth; continue; }
    let value; try { value = JSON.parse(raw.trim()); } catch { continue; }
    if (!table && table !== null && kv[1] === 'default_model' && typeof value === 'string') result.default_model = value;
    if (table === 'providers."managed:kimi-code".oauth' && ['key', 'oauth_host'].includes(kv[1]) && typeof value === 'string') result[kv[1]] = value;
  }
  return result;
}
function loginStatus(dir) {
  const isFile = p => { try { return fs.statSync(p).isFile(); } catch { return false; } };
  const config = readConfig(dir), credentials = path.join(home(dir), 'credentials'); let authenticated = false;
  if (config.problem) { try { authenticated = fs.readdirSync(credentials).some(f => f.endsWith('.json') && isFile(path.join(credentials, f))); } catch {} }
  else if (/^oauth\/[A-Za-z0-9._-]+$/.test(config.key || '')) authenticated = isFile(path.join(credentials, `${config.key.slice(6)}.json`));
  if (config.problem) return { logged_in: false, authenticated, problem: config.problem };
  let global = false; try { global = new URL(config.oauth_host).hostname === 'auth.kimi.ai'; } catch {}
  return { logged_in: authenticated && global, authenticated, ...(authenticated && !global ? { problem: "signed in to Kimi's China region; log in again" } : {}) };
}
const USAGE_URL = 'https://api.kimi.ai/coding/v1/usages';
async function usageProbe(dir, { timeout = 10000, url = USAGE_URL } = {}) {
  if (!loginStatus(dir).logged_in) throw new Error('Kimi Code is not signed in');
  let token, expires;
  try {
    const key = readConfig(dir).key;
    if (!/^oauth\/[A-Za-z0-9._-]+$/.test(key || '')) throw new Error();
    const credential = JSON.parse(fs.readFileSync(path.join(home(dir), 'credentials', `${key.slice(6)}.json`), 'utf8'));
    token = credential.access_token; expires = credential.expires_at;
    if (typeof token !== 'string' || !token.trim() || typeof expires !== 'number' || !Number.isFinite(expires)) throw new Error();
  } catch { throw new Error("Kimi Code's login can't be read"); }
  if (expires * 1000 <= Date.now() + 30000) throw new Error("Kimi Code's login key has expired; it renews the next time Kimi Code runs");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(timeout, 10000));
  let response, body;
  try {
    response = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, redirect: 'error', signal: controller.signal });
    if (!response.ok) throw new Error(`Kimi usage request failed (HTTP ${response.status})`);
    body = await response.text();
  } catch (error) {
    if (response && !response.ok) throw new Error(`Kimi usage request failed (HTTP ${response.status})`);
    throw new Error('Kimi usage request failed');
  } finally { clearTimeout(timer); }
  let data;
  try { data = JSON.parse(body); } catch { throw new Error('invalid usage response'); }
  if (!data?.usages || typeof data.usages !== 'object' || Array.isArray(data.usages)) throw new Error('invalid usage response');
  const window = entry => {
    if (!entry || !['number', 'string'].includes(typeof entry.used_ratio) || (typeof entry.used_ratio === 'string' && !entry.used_ratio.trim())) return null;
    const ratio = Number(entry.used_ratio);
    if (!Number.isFinite(ratio) || typeof entry.reset_time !== 'string' || !entry.reset_time.trim()) return null;
    const reset = Date.parse(entry.reset_time);
    if (!Number.isFinite(reset)) return null;
    return { used: Math.min(ratio * 100, 100), resets_at: new Date(reset).toISOString() };
  };
  const five_hour = window(data.usages.limit_5h), week = window(data.usages.limit_7d);
  if (!five_hour && !week) throw new Error('no usage windows');
  return { five_hour, week, ...([five_hour, week].some(w => w && w.used >= 100) ? { reached: true } : {}) };
}
const bindings = new Map();
function marker(value, name) {
  if (typeof value === 'string') return value.startsWith('[wc:role]') && value.split(/\r?\n/).includes(`Session: ${name}`);
  return value && typeof value === 'object' && Object.values(value).some(v => marker(v, name));
}
function userPromptText(input) {
  if (typeof input === 'string') return input;
  if (Array.isArray(input)) return input.filter(part => part?.type === 'text').map(part => part.text).join('');
  return '';
}
async function findTranscript(session, dir) {
  if (session.source_transcript) return session.source_transcript;
  if (bindings.has(session)) return bindings.get(session);
  const run = (async () => {
    const root = path.join(home(dir), 'sessions');
    const dirs = async p => fs.promises.readdir(p, { withFileTypes: true }).catch(() => []);
    for (const work of await dirs(root)) {
      if (!work.isDirectory()) continue;
      for (const id of await dirs(path.join(root, work.name))) {
        if (!id.isDirectory()) continue;
        const file = path.join(root, work.name, id.name, 'agents/main/wire.jsonl');
        let handle;
        try {
          handle = await fs.promises.open(file, 'r');
          const stat = await handle.stat();
          if (stat.mtimeMs < Date.parse(session.created_at)) continue;
          const text = await handle.readFile('utf8');
          const rows = text.split('\n').map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
          const meta = rows.find(row => row.type === 'metadata');
          if (!meta) continue;
          const parseVersion = value => typeof value === 'string' && /^\d+(?:\.\d+)*$/.test(value) ? value.split('.').map(BigInt) : null;
          const parts = parseVersion(meta.protocol_version);
          const min = meta.min_protocol_version === undefined ? [1n, 0n] : parseVersion(meta.min_protocol_version);
          const ceiling = [1n, 5n];
          let comparison = 0;
          if (min) for (let i = 0; i < Math.max(min.length, ceiling.length); i++) {
            const left = min[i] ?? 0n, right = ceiling[i] ?? 0n;
            if (left !== right) { comparison = left < right ? -1 : 1; break; }
          }
          const compatible = parts && parts[0] === 1n && min && comparison <= 0;
          if (!compatible) {
            if (rows.some(row => marker(row, session.name))) throw Object.assign(new Error(`Kimi Code's log format changed (protocol ${meta.protocol_version}); update wheelchair`), { kimiFatal: true });
            continue;
          }
          const prompt = rows.find(row => row.type === 'turn.prompt' && row.origin?.kind === 'user');
          const userText = prompt && userPromptText(prompt.input);
          if (prompt && userText.startsWith('[wc:role]') && userText.split(/\r?\n/).includes(`Session: ${session.name}`) && !session.source_transcript) {
            Object.assign(session, { source_transcript: file, kimi_session_id: id.name, kimi_log_id: { dev: stat.dev, ino: stat.ino } });
            return file;
          }
        } catch (error) { if (error.kimiFatal) throw error; }
        finally { if (handle) await handle.close(); }
      }
    }
    return session.source_transcript || null;
  })();
  bindings.set(session, run);
  try { return await run; } finally { bindings.delete(session); }
}
const poller = {
  async kimiBinding(session) {
    try {
      const had = session.source_transcript;
      const file = await findTranscript(session, session.account_dir);
      if (!had && file) await this.persistSessions();
      return file;
    } catch (error) {
      if (!error.kimiFatal) throw error;
      await this.fatalKimi(session, error.message); return null;
    }
  },
  async kimiSpoolWaiting(session) {
    const dir = path.join(this.stateDir, 'spool', 'events');
    for (const file of await fsp.readdir(dir).catch(() => [])) {
      if (!file.endsWith('.json')) continue;
      const item = await fs.promises.readFile(path.join(dir, file), 'utf8').then(JSON.parse).catch(() => ({}));
      if (item.session === session.name) return true;
    }
    return false;
  },
  async turnPoller(cli) {
    if (this.kimiPolling) return;
    this.kimiPolling = true;
    try {
      for (const session of Object.values(this.sessions)) {
        if (session.cli !== cli || session.status === 'stopped') continue;
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
};
module.exports = {
  checkVersion: (service, executable) => service.checkKimiVersion(executable),
  versionStatus(service, login) { const executable = resolveCli(); if (!executable) return { installed: false, logged_in: false }; let mtime; try { mtime = fs.statSync(executable).mtimeMs; } catch { return { installed: false, logged_in: false }; } service.checkVersion('kimi'); return service.kimiVersionStatus(service.kimiVersions.get(JSON.stringify([executable, mtime])), login); },
  launchPath: service => module.exports.kimiLaunchPath.call(service),
  checkKimiVersion(executable = resolveCli()) {
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
  },
  async kimiLaunchPath() {
    const executable = resolveCli();
    if (!executable) (() => { throw new Error('Kimi Code is not installed'); })();
    let mtime; try { mtime = fs.statSync(executable).mtimeMs; } catch { (() => { throw new Error('Kimi Code is not installed'); })(); }
    await this.checkKimiVersion(executable);
    const entry = this.kimiVersions?.get(JSON.stringify([executable, mtime]));
    if (!entry || entry.output === undefined) (() => { throw new Error('Kimi Code is not installed'); })();
    const status = this.kimiVersionStatus(entry, { logged_in: false });
    if (status.problem) (() => { throw new Error(status.problem); })();
    return { executable };
  },
  kimiVersionStatus(entry, login) {
    if (!entry || entry.output === undefined) return { installed: true, logged_in: false, problem: "Checking Kimi Code's version" };
    const output = entry.output;
    const firstLine = output.split(/\r?\n/, 1)[0].replace(/^(?:kimi-code|kimi code|kimi)(?:\s+|,\s*)/i, '').replace(/^version\s+/i, '');
    const match = (firstLine.split(/\s+/)[0] || '').match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
    const valid = !entry.failed && match && (Number(match[1]) > 2 || Number(match[1]) === 2 && (Number(match[2]) > 6 || Number(match[2]) === 6 && (Number(match[3]) > 3 || Number(match[3]) === 3 && !match[4])));
    return { installed: true, logged_in: !!valid && login.logged_in, version: output, ...(!valid ? { problem: `Kimi Code 2.6.3 or newer is needed (found ${output})` } : {}) };
  },
  validTranscript: (session, stat, offset) => stat.dev === session.kimi_log_id?.dev && stat.ino === session.kimi_log_id?.ino && stat.size >= offset && !session.end_reason,
  turnPoller: poller.turnPoller, bindTranscript: poller.kimiBinding, spoolWaiting: poller.kimiSpoolWaiting,
  recognizePane(text) { const lines = text.split(/\r?\n/).map(line => line.trim()); return (/^\s*(?:Ask When Needed|Never Ask)\b/im.test(text) && /^\s*context:\s*\d+%/im.test(text)) || (lines.includes('Trust this folder?') && lines.some(line => /^(?:❯\s*)?Trust and continue$/.test(line)) && lines.some(line => /^(?:❯\s*)?Exit$/.test(line))); },
  restartLossReason: () => 'Lost track of this Kimi Code session after a machine restart; restart it',

  stepVocabulary: require('../codex/machine').stepVocabulary,
  provider: 'kimi', resolveCli, readConfig, loginStatus, usageProbe,
  loginEnv: dir => ({ KIMI_CODE_HOME: home(dir) }),
  seed(dir, id) { c.seed(dir, home(), 'AGENTS.md', 'kimi', id); }, prepare() {},
  loginCommand() { const cli = resolveCli(); if (!cli) throw new Error('Kimi Code is not installed'); return [cli, 'login', '--region', 'global']; }, loginPrompt: null,
  parseLogin(pane) { const url = pane.match(/Opening browser for Kimi device login:\s*(https?:\/\/\S+)/)?.[1]; const code = pane.match(/paste the URL above and enter code:\s*(\S+)/i)?.[1]; return url && code ? { url, code, wantsCode: false } : null; },
  loginDone() { return false; },
  command(input, session, worktree, context) {
    return { loaded: [], ...(context.tools && context.mcp?.names.length ? { warnings: [{ names: [...context.mcp.names], text: "project tools aren't supported on Kimi Code yet; this agent runs without them" }] } : {}), argv: [context.kimiExecutable || resolveCli(), session.permission_mode === 'bypass' ? '--auto' : '--yolo', ...(input.model ? ['--model', input.model] : [])] };
  },
  firstMessage(input, promptPath, name) { return `[wc:role] Role: ${input.role}\nSession: ${name}\nRead ${promptPath} before responding: it holds your role rules and card rules. Read it again only if it is no longer in your context.\n\n${input.brief || input.first_message || ''}`; },
  readyText(session, pane) { return /│\s*>/.test(pane) && pane.includes('context:') && !pane.includes('Trust this folder?'); },
  answerPrompts(session, pane) { if (!pane.includes('Trust this folder?')) return null; if (/❯\s*Trust and continue/.test(pane)) return { step: 'trust', keys: ['Enter'] }; if (/❯\s*Exit/.test(pane)) return { step: 'trust-select', keys: ['Up'] }; return null; },
  promptText(pane) {
    if (/│\s*>/.test(pane)) return false;
    const lines = pane.split('\n').filter(line => line.trim()).slice(-15)
      .map(line => line.trim().replace(/^[│\s]+|[│\s]+$/g, ''));
    for (let i = 0; i < lines.length; i++) {
      const title = lines[i].replace(/^[▶❯]\s*/, '');
      const plan = title.startsWith('Ready to build with this plan?');
      if (!plan && !/^(?:Run this command\?|Write this file\?|Apply these edits\?|Stop this task\?)/.test(title) && !/^Approve [^\n?]+\?$/.test(title)) continue;
      const choice = plan ? /^Approve/ : /^Approve once/;
      if (lines.slice(i + 1).some(line => choice.test(line.replace(/^(?:[▶❯]\s*)?(?:\d+\.\s*)?/, '')))) return true;
    }
    return false;
  },
  async findTranscript(session, dir) { return findTranscript(session, dir); },
};
