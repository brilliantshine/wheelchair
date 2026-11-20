'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { classify } = require('../lib/steps');
const c = require('./common');
const home = dir => path.resolve(dir || path.join(os.homedir(), '.pi/agent'));
const redact = value => String(value).replace(/sk-or-[A-Za-z0-9_-]+/g, '[redacted key]');
function redactEvent(value) {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map(redactEvent);
  if (value && Object.getPrototypeOf(value) === Object.prototype) return Object.fromEntries(Object.entries(value).map(([key, item]) => [redact(key), redactEvent(item)]));
  return value;
}
function resolveCli() { const result = spawnSync('sh', ['-c', 'command -v pi'], { encoding: 'utf8' }); return result.status === 0 ? result.stdout.trim() || null : null; }
module.exports = {
  provider: 'openrouter', resolveCli, redact, retryStartupEnter: true,
  loginEnv: dir => dir && path.resolve(dir) !== home(null) ? { PI_CODING_AGENT_DIR: dir } : {},
  loginCommand() { const cli = resolveCli(); if (!cli) throw new Error('Pi is not installed'); return [cli, 'auth', 'login', 'openrouter', '--api-key']; },
  loginPrompt: null, codeNeedsPrompt: true,
  parseLogin(pane) { const lines = pane.split(/\r?\n/).filter(line => line.trim()); return !pane.includes('Saved API key for OpenRouter') && !pane.includes('__wc_login_exit') && lines.at(-1)?.trim() === 'Enter OpenRouter API key:' ? { url: null, code: null, wantsCode: true } : null; },
  loginDone: pane => pane.includes('Saved API key for OpenRouter'),
  async spend(dir, now = new Date()) {
    const totals = { today: 0, last_7_days: 0, last_30_days: 0 };
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
    const template = fs.readFileSync(path.join(__dirname, 'pi-extension.js'), 'utf8');
    const extension = template.replace('HOOK_PATH', JSON.stringify(path.join(c.root, 'machine/hook.sh'))).replace('SESSION_NAME', JSON.stringify(session.name));
    fs.mkdirSync(path.dirname(extensionPath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(extensionPath, extension, { mode: 0o600 });
    return { argv: [resolveCli(), '--provider', 'openrouter', '--model', input.model || 'openrouter/auto', '--session-id', session.cli_session_id, '--approve', '-e', extensionPath, '--append-system-prompt', context.promptPath, ...(input.role === 'reviewer' ? ['--tools', 'read,grep,find,ls'] : [])] };
  },
  firstMessage(input) { return input.brief || input.first_message || ''; },
  readyText(session, pane) {
    const lines = pane.split(/\r?\n/);
    if (lines.some((line, index) => {
      const match = line.match(/^\s*(\S+) not found\. Downloading\.\.\.\s*$/);
      return match && !lines.slice(index + 1).some(later => later.includes(`${match[1]} installed to `) || later.includes(`Failed to download ${match[1]}:`));
    })) return false;
    return pane.includes('escape interrupt') && pane.includes('ctrl+c/ctrl+d clear/exit') && !pane.includes('Trust project folder?') && /─{3,}/.test(pane) && /•\s*\S+/.test(pane) && !/Working\s*[─-]/.test(pane); },
  answerPrompts() { return null; }, promptText() { return false; }, usageFrom() { return null; },
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
      return { type: 'step', phase: 'start', step: { id: raw.toolCallId, ...classify('claude', names[raw.toolName] || raw.toolName, raw.args), started_at: new Date().toISOString() } };
    }
    if (raw.hook_event_name !== 'agent_settled') return null;
    if (!raw.aborted && (raw.stopReason === 'error' || raw.entry_id == null)) return { type: 'turn-failed', error: redact(raw.errorMessage || 'Pi ended the turn without a reply') };
    return { type: 'turn-ended', turn_id: raw.turn, entry_id: raw.entry_id ?? null, ...(raw.aborted ? { interrupted: true } : {}) };
    })();
    return redactEvent(event);
  },
};
