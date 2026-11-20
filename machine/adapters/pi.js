'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { classify } = require('../lib/steps');
const c = require('./common');
const home = dir => path.resolve(dir || path.join(os.homedir(), '.pi/agent'));
const redact = value => String(value).replace(/sk-or-[A-Za-z0-9_-]+/g, '[redacted key]');
function resolveCli() { const result = spawnSync('sh', ['-c', 'command -v pi'], { encoding: 'utf8' }); return result.status === 0 ? result.stdout.trim() || null : null; }
module.exports = {
  provider: 'openrouter', resolveCli, redact,
  loginEnv: dir => dir ? { PI_CODING_AGENT_DIR: dir } : {},
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
  readyText(session, pane) { return pane.includes('escape interrupt') && pane.includes('ctrl+c/ctrl+d clear/exit') && !pane.includes('Trust project folder?') && /─{3,}/.test(pane) && /•\s*\S+/.test(pane) && !/Working\s*[─-]/.test(pane); },
  answerPrompts() { return null; }, promptText() { return false; }, usageFrom() { return null; },
  async findTranscript(session, dir) {
    const walk = async root => { for (const entry of await fs.promises.readdir(root, { withFileTypes: true }).catch(() => [])) { const file = path.join(root, entry.name); if (entry.isDirectory()) { const found = await walk(file); if (found) return found; } else if (entry.isFile() && entry.name.endsWith(`_${session.cli_session_id}.jsonl`)) return file; } return null; };
    return walk(path.join(home(dir), 'sessions'));
  },
  hookEvent(raw) {
    if (raw.hook_event_name === 'tool_execution_start' || raw.hook_event_name === 'tool_execution_end') {
      if (!raw.toolCallId) return null;
      if (raw.hook_event_name === 'tool_execution_end') return { type: 'step', phase: 'end', step: { id: raw.toolCallId, ended_at: new Date().toISOString(), failed: !!raw.isError, clean: true } };
      const names = { bash: 'Bash', read: 'Read', edit: 'Edit', write: 'Write', grep: 'Grep', find: 'Glob', ls: 'LS' };
      return { type: 'step', phase: 'start', step: { id: raw.toolCallId, ...classify('claude', names[raw.toolName] || raw.toolName, raw.args), started_at: new Date().toISOString() } };
    }
    if (raw.hook_event_name !== 'agent_settled') return null;
    if (!raw.aborted && (raw.stopReason === 'error' || raw.entry_id == null)) return { type: 'turn-failed', error: redact(raw.errorMessage || 'Pi ended the turn without a reply') };
    return { type: 'turn-ended', turn_id: raw.turn, entry_id: raw.entry_id ?? null, ...(raw.aborted ? { interrupted: true } : {}) };
  },
};
