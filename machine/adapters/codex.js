'use strict';
const fs = require('node:fs');
const path = require('node:path');
const c = require('./common');
const usual = () => c.home('CODEX_HOME', '.codex');
const loginEnv = dir => dir ? { CODEX_HOME: dir } : {};
module.exports = {
  provider: 'gpt', loginEnv,
  command(input, session, worktree) { const trust = `projects={${JSON.stringify(worktree)}={trust_level="trusted"}}`; const notify = `notify=[${JSON.stringify(path.join(c.root, 'machine', 'hook.sh'))},"codex",${JSON.stringify(session.name)}]`; const access = input.role === 'reviewer' ? ['-s', 'read-only', '-a', 'never'] : session.codex_mode === 'unrestricted' ? ['--dangerously-bypass-approvals-and-sandbox'] : ['-s', 'workspace-write', '-a', 'never', '-c', 'sandbox_workspace_write.network_access=true']; return { argv: ['codex', ...access, '-c', notify, '-c', trust, ...(input.model ? ['-m', input.model] : [])] }; },
  firstMessage(input, rolePrompt) { const first = input.brief || input.first_message || ''; return `[wc:role] ${rolePrompt}${first ? `\n\n${first}` : ''}`; },
  readyText(session, pane) { return pane.includes('Ask Codex to do anything'); }, answerPrompts() { return null; },
  async findTranscript(session, dir) { if (!session.codex_thread_id) return null; const find = async directory => { for (const entry of await fs.promises.readdir(directory, { withFileTypes: true }).catch(() => [])) { const file = path.join(directory, entry.name); if (entry.isDirectory()) { const hit = await find(file); if (hit) return hit; } else if (entry.name.endsWith(`-${session.codex_thread_id}.jsonl`)) return file; } return null; }; return find(path.join(dir || usual(), 'sessions')); },
  hookEvent(raw) { return raw.type === 'agent-turn-complete' ? { ...raw, type: 'turn-ended' } : null; },
  usageFrom(source) { let raw = source; if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { return null; } } const limits = raw?.payload?.rate_limits; if (!limits) return null; let five_hour = null, week = null; for (const w of [limits.primary, limits.secondary]) { if (!w || typeof w.used_percent !== 'number') continue; const v = { used: w.used_percent, resets_at: c.iso(w.resets_at) }; if (w.window_minutes === 300) five_hour = v; if (w.window_minutes === 10080) week = v; } if (!five_hour && !week) return null; return { at: c.iso(raw.timestamp) || new Date().toISOString(), five_hour, week, ...(limits.plan_type ? { plan_type: limits.plan_type } : {}) }; },
  loginStatus(dir) { return c.status('codex', ['login', 'status'], loginEnv(dir)); },
  seed(dir, id) { c.seed(dir, usual(), 'AGENTS.md', 'codex', id); },
};
