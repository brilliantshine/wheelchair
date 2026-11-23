'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync, execFile } = require('node:child_process');
const { classify } = require('../../machine/lib/steps');
const c = require('../common');
const home = dir => path.resolve(dir || path.join(os.homedir(), '.pi/agent'));
const redact = value => String(value).replace(/sk-or-[A-Za-z0-9_-]+/g, '[redacted key]');
function redactEvent(value) {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map(redactEvent);
  if (value && Object.getPrototypeOf(value) === Object.prototype) return Object.fromEntries(Object.entries(value).map(([key, item]) => [redact(key), redactEvent(item)]));
  return value;
}
function resolveCli() { const result = spawnSync('sh', ['-c', 'command -v pi'], { encoding: 'utf8' }); return result.status === 0 ? result.stdout.trim() || null : null; }
const lastAside = text => text.split('\n').map(x => x.trim()).filter(Boolean).pop();
module.exports = {
  checkVersion: (service, executable) => service.checkPiVersion(executable),
  versionStatus(service, login) { const executable = resolveCli(); if (!executable) return { installed: false, logged_in: false }; let mtime; try { mtime = fs.statSync(executable).mtimeMs; } catch { return { installed: false, logged_in: false }; } service.checkVersion('pi', executable); return service.piVersionStatus(service.piVersions.get(JSON.stringify([executable, mtime]))?.version || null, login); },
  async beforeTurnEvent(service, session, event) {
    if (['turn-ended', 'turn-failed'].includes(event.type)) {
      try { session.source_transcript ||= await module.exports.findTranscript(session, session.account_dir); if (session.source_transcript) await service.copyTranscript(session, session.source_transcript); } catch (error) { service.log(error); }
    }
    if (event.type === 'turn-failed') event = { ...event, error: (event.error || '') + module.exports.failureNote(session) };
    if (event.transcript_path) { event = { ...event }; delete event.transcript_path; }
    return event;
  },
  startupCheck(session) {
    if (!['starting', 'stuck'].includes(session.status) || session.end_reason) return null;
    return 'Pi exited before it was ready' + module.exports.failureNote(session);
  },
  failureNote(session) {
    const version = session.pi_version, status = module.exports.piVersionStatus(version, { logged_in: true });
    if (!status.warning) return '';
    return version ? ` Pi ${version} is newer than the version wheelchair was tested with (1.5.2); that may be the cause.` : " Pi's version couldn't be read; that may be the cause.";
  },
  recordLaunch(session, status) { session.pi_version = status.version || null; },
  checkPiVersion(executable = resolveCli()) {
    if (!executable) return Promise.resolve();
    let mtime; try { mtime = fs.statSync(executable).mtimeMs; } catch { return Promise.resolve(); }
    this.piVersions ||= new Map();
    const key = JSON.stringify([executable, mtime]);
    if (!this.piVersions.has(key)) {
      const entry = {};
      entry.promise = new Promise(resolve => execFile(executable, ['--version'], { timeout: this.options?.piVersionTimeoutMs ?? 5000 }, (error, stdout) => {
        const output = stdout.trim();
        entry.version = !error && /^v?\d+\.\d+\.\d+$/.test(output) ? output.replace(/^v/, '') : null;
        resolve(entry);
      }));
      this.piVersions.set(key, entry);
    }
    return this.piVersions.get(key).promise;
  },
  piVersionStatus(version, login) {
    const match = typeof version === 'string' && version.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) return { installed: true, logged_in: login.logged_in, version: null, warning: "Pi's version couldn't be read. If OpenRouter agents fail, this may be why." };
    const [major, minor, patch] = match.slice(1).map(Number);
    const old = major < 1 || major === 1 && (minor < 5 || minor === 5 && patch < 2);
    const newer = major > 1 || major === 1 && minor > 5;
    return { installed: true, logged_in: !old && login.logged_in, version, ...(old ? { problem: `Pi 1.5.2 or newer is needed (found ${version})` } : newer ? { warning: `Pi ${version} is newer than the version wheelchair was tested with (1.5.2). If OpenRouter agents fail, this may be why.` } : {}) };
  },
  recognizePane: text => text.includes('escape interrupt') && text.includes('ctrl+c/ctrl+d clear/exit') || /openrouter\/\S+\s*•\s*\S+/.test(text),
  restartLossReason: () => 'Lost track of this Pi session after a machine restart; restart it',

  asideProblem: (problem, cli) => problem(cli),
  asideModel: /^(?=.{1,128}$)[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*(:[a-z0-9][a-z0-9._-]*)?$/,
  asideNewId: true,
  asideResult(i, r) {
        const records = r.out.split('\n').filter(line => line.trim()).map(line => { try { return JSON.parse(line); } catch { return null; } });
        const expected = i.mode === 'fork' ? i.new_id : i.from;
        const header = records[0];
        const validHeader = header?.type === 'session' && header.id === expected && !(i.mode === 'fork' && header.id === i.from);
        let message = null;
        for (const event of records) if (event?.type === 'message_end' && event.message?.role === 'assistant') message = event.message;
        const reply = (Array.isArray(message?.content) ? message.content.filter(x => x.type === 'text').map(x => x.text || '').join('') : '').trim();
        const error = redact(message?.errorMessage || lastAside(redact(r.err)) || `Pi exited ${r.code}`);
        if (!validHeader && r.code === 0 && !r.err.trim()) return { state: 'failed', error: 'invalid Pi session header' };
        const failed = !validHeader || r.code !== 0 || !reply || ['error', 'aborted'].includes(message?.stopReason);
        const limit = failed && /(?:\b(?:402|429)\b|credit|rate[ _-]?limit)/i.test(error);
        return failed ? { state: 'failed', error, limit } : { state: 'ok', reply: redact(reply), conversation_id: expected, limit: false };
  },
  stepVocabulary: require('../codex/machine').stepVocabulary,
  provider: 'openrouter', resolveCli, redact, retryStartupEnter: true,
  loginEnv: dir => dir && path.resolve(dir) !== home(null) ? { PI_CODING_AGENT_DIR: dir } : {},
  loginState(record, pane, captured, { kill }) {
    const marker = pane.match(/__wc_login_exit (\d+)/);
    if (module.exports.loginDone(pane) || marker || !captured) {
      if (module.exports.loginDone(pane)) kill();
      const logged_in = module.exports.loginStatus(record.dir).logged_in;
      return { state: logged_in && (module.exports.loginDone(pane) || !marker || marker[1] === '0') ? 'done' : 'failed', url: null, code: null, wantsCode: false, logged_in };
    }
    return null;
  },
  loginCommand() { const cli = resolveCli(); if (!cli) throw new Error('Pi is not installed'); return [cli, 'auth', 'login', 'openrouter', '--api-key']; },
  loginPrompt: null, codeNeedsPrompt: true,
  parseLogin(pane) { const lines = pane.split(/\r?\n/).filter(line => line.trim()); return !pane.includes('Saved API key for OpenRouter') && !pane.includes('__wc_login_exit') && lines.at(-1)?.trim() === 'Enter OpenRouter API key:' ? { url: null, code: null, wantsCode: true } : null; },
  loginDone: pane => pane.includes('Saved API key for OpenRouter'),
  async spend(dir, now = new Date()) {
    const totals = { today: 0, last_7_days: 0, last_30_days: 0 };
    const seen = new Set();
    const start = days => new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1).getTime();
    const walk = async root => {
      let entries; try { entries = await fs.promises.readdir(root, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        const file = path.join(root, entry.name);
        if (entry.isDirectory()) { await walk(file); continue; }
        if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
        let text; try { text = await fs.promises.readFile(file, 'utf8'); } catch { continue; }
        for (const line of text.split('\n')) {
          let row; try { row = JSON.parse(line); } catch { continue; }
          if (row?.type !== 'message' || row.message?.role !== 'assistant' || row.message?.provider !== 'openrouter') continue;
          const at = Date.parse(row.timestamp), raw = row.message?.usage?.cost?.total;
          const cost = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : 0;
          if (!Number.isFinite(at) || at > now.getTime() || typeof cost !== 'number' || !Number.isFinite(cost)) continue;
          if (row.id != null) { const key = JSON.stringify([row.id, row.timestamp]); if (seen.has(key)) continue; seen.add(key); }
          if (at >= start(1)) totals.today += cost;
          if (at >= start(7)) totals.last_7_days += cost;
          if (at >= start(30)) totals.last_30_days += cost;
        }
      }
    };
    await walk(path.join(home(dir), 'sessions')); return totals;
  },
  seed(dir, id) { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); fs.writeFileSync(path.join(dir, 'wheelchair-account.json'), JSON.stringify({ id, cli: 'pi' }) + '\n', { mode: 0o600 }); }, prepare() {},
  loginStatus(dir) {
    try { const auth = JSON.parse(fs.readFileSync(path.join(home(dir), 'auth.json'), 'utf8')); const logged_in = !!auth && Object.hasOwn(auth, 'openrouter'); return { logged_in, authenticated: logged_in }; }
    catch (error) { return { logged_in: false, authenticated: false, ...(error.code !== 'ENOENT' ? { problem: "Pi's auth.json can't be read" } : {}) }; }
  },
  command(input, session, worktree, context) {
    const extensionPath = path.join(context.stateDir, 'settings', `${session.name}-pi.js`);
    const template = fs.readFileSync(path.join(__dirname, 'extension.js'), 'utf8');
    const extension = template.replace('HOOK_PATH', JSON.stringify(path.join(c.root, 'machine/hook.sh'))).replace('SESSION_NAME', JSON.stringify(session.name));
    fs.mkdirSync(path.dirname(extensionPath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(extensionPath, extension, { mode: 0o600 });
    return { loaded: [], ...(context.tools && context.mcp?.names.length ? { warnings: [{ names: [...context.mcp.names], text: "project tools aren't supported on Pi yet; this agent runs without them" }] } : {}), argv: [resolveCli(), '--provider', 'openrouter', '--model', input.model || 'openrouter/auto', '--session-id', session.cli_session_id, '--approve', ...(session.effort ? ['--thinking', session.effort] : []), '-e', extensionPath, '--append-system-prompt', context.promptPath, ...(input.role === 'reviewer' ? ['--tools', 'read,grep,find,ls'] : [])] };
  },
  asideArgv(i, { prompt }) {
    return [resolveCli(), '--provider', 'openrouter', '--model', i.model, '--mode', 'json', '-p', ...(i.mode === 'fork' ? ['--fork', i.from, '--session-id', i.new_id] : ['--session', i.from]), '--append-system-prompt', prompt, '--no-extensions', ...(i.effort ? ['--thinking', i.effort] : []), '--tools', i.access === 'full' ? 'read,bash,edit,write,grep,find,ls' : 'read,grep,find,ls', ...(i.access === 'full' ? [] : ['-e', path.join(__dirname, 'guard.js')])];
  },
  firstMessage(input) { return input.brief || input.first_message || ''; },
  readyText(session, pane) {
    const lines = pane.split(/\r?\n/);
    if (lines.some((line, index) => {
      const match = line.match(/^\s*(\S+) not found\. Downloading\.\.\.\s*$/);
      return match && !lines.slice(index + 1).some(later => later.includes(`${match[1]} installed to `) || later.includes(`Failed to download ${match[1]}:`));
    })) return false;
    return pane.includes('escape interrupt') && pane.includes('ctrl+c/ctrl+d clear/exit') && !pane.includes('Trust project folder?') && /─{3,}/.test(pane) && /•\s*\S+/.test(pane) && !/Working\s*[─-]/.test(pane); },
  answerPrompts() { return null; }, promptText() { return false; },
  async findTranscript(session, dir) {
    const walk = async root => { for (const entry of await fs.promises.readdir(root, { withFileTypes: true }).catch(() => [])) { const file = path.join(root, entry.name); if (entry.isDirectory()) { const found = await walk(file); if (found) return found; } else if (entry.isFile() && entry.name.endsWith(`_${session.cli_session_id}.jsonl`)) return file; } return null; };
    return walk(path.join(home(dir), 'sessions'));
  },
  hookEvent(raw) {
    const event = (() => {
    if (raw.hook_event_name === 'tool_execution_start' || raw.hook_event_name === 'tool_execution_end') {
      if (!raw.toolCallId) return null;
      if (raw.hook_event_name === 'tool_execution_end') return { type: 'step', phase: 'end', step: { id: raw.toolCallId, ended_at: new Date().toISOString(), failed: !!raw.isError, clean: true } };
      const names = { bash: 'Bash', read: 'Read', edit: 'Edit', write: 'Write', grep: 'Grep', find: 'Glob', ls: 'LS' };
      return { type: 'step', phase: 'start', step: { id: raw.toolCallId, ...classify(require('../claude/machine').stepVocabulary, names[raw.toolName] || raw.toolName, raw.args), started_at: new Date().toISOString() } };
    }
    if (raw.hook_event_name !== 'agent_settled') return null;
    if (!raw.aborted && (raw.stopReason === 'error' || raw.entry_id == null)) return { type: 'turn-failed', error: redact(raw.errorMessage || 'Pi ended the turn without a reply') };
    return { type: 'turn-ended', turn_id: raw.turn, entry_id: raw.entry_id ?? null, ...(raw.aborted ? { interrupted: true } : {}) };
    })();
    return redactEvent(event);
  },
};
