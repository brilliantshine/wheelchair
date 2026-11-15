'use strict';
const fs = require('node:fs');
const path = require('node:path');
const c = require('./common');
const usual = () => c.home('CODEX_HOME', '.codex');
const loginEnv = dir => dir ? { CODEX_HOME: dir } : {};
module.exports = {
  provider: 'gpt', loginEnv,
  loginCommand() { return ['codex', 'login', '--device-auth']; },
  parseLogin(pane) { const url = pane.match(/https:\/\/auth\.openai\.com\/[^\s]+/)?.[0] || null; const code = pane.match(/\b[A-Z0-9]{4}-[A-Z0-9]{4,}\b/)?.[0] || null; return url && code ? { url, code, wantsCode: false } : null; },
  async onTurnEnded(session, event) {
    const threadId = event['thread-id'] || event.thread_id;
    if (!session.codex_thread_id) {
      const first = event['input-messages']?.[0] || event.input_messages?.[0] || '';
      if (!first.startsWith('[wc:role]') || !threadId) return { ignored: true };
      session.codex_thread_id = threadId;
      session.source_transcript = await this.findTranscript(session, session.account_dir);
      if (!session.source_transcript) { delete session.codex_thread_id; return { ignored: true }; }
    }
    if (threadId && session.codex_thread_id !== threadId) return { ignored: true };
    const file = session.source_transcript || await this.findTranscript(session, session.account_dir);
    if (!file) return {};
    const data = await fs.promises.readFile(file).catch(() => Buffer.alloc(0));
    const start = Math.min(session.usage_offset || 0, data.length), chunk = data.subarray(start).toString('utf8'), end = chunk.lastIndexOf('\n');
    if (end < 0) return {};
    const complete = chunk.slice(0, end + 1); session.usage_offset = start + Buffer.byteLength(complete);
    let reading = null; for (const line of complete.trimEnd().split('\n')) reading = this.usageFrom(line) || reading;
    return { reading };
  },
  command(input, session, worktree) { const trust = `projects={${JSON.stringify(worktree)}={trust_level="trusted"}}`; const notify = `notify=[${JSON.stringify(path.join(c.root, 'machine', 'hook.sh'))},"codex",${JSON.stringify(session.name)}]`; const access = input.role === 'reviewer' ? ['-s', 'read-only', '-a', 'never'] : session.codex_mode === 'unrestricted' ? ['--dangerously-bypass-approvals-and-sandbox'] : ['-s', 'workspace-write', '-a', 'never', '-c', 'sandbox_workspace_write.network_access=true']; return { argv: ['codex', ...access, '-c', notify, '-c', trust, ...(input.model ? ['-m', input.model] : []), ...(session.effort ? ['-c', `model_reasoning_effort=${session.effort}`] : [])] }; },
  firstMessage(input, rolePrompt) { const first = input.brief || input.first_message || ''; return `[wc:role] ${rolePrompt}${first ? `\n\n${first}` : ''}`; },
  readyText(session, pane) { return pane.includes('Ask Codex to do anything'); }, answerPrompts() { return null; },
  async findTranscript(session, dir) { if (!session.codex_thread_id) return null; const find = async directory => { for (const entry of await fs.promises.readdir(directory, { withFileTypes: true }).catch(() => [])) { const file = path.join(directory, entry.name); if (entry.isDirectory()) { const hit = await find(file); if (hit) return hit; } else if (entry.name.endsWith(`-${session.codex_thread_id}.jsonl`)) return file; } return null; }; return find(path.join(dir || usual(), 'sessions')); },
  hookEvent(raw) { return raw.type === 'agent-turn-complete' ? { ...raw, type: 'turn-ended' } : null; },
  usageFrom(source) { let raw = source; if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { return null; } } const limits = raw?.payload?.rate_limits; if (!limits) return null; let five_hour = null, week = null; for (const w of [limits.primary, limits.secondary]) { if (!w || typeof w.used_percent !== 'number') continue; const v = { used: w.used_percent, resets_at: c.iso(w.resets_at) }; if (w.window_minutes === 300) five_hour = v; if (w.window_minutes === 10080) week = v; } if (!five_hour && !week) return null; return { at: c.iso(raw.timestamp) || new Date().toISOString(), five_hour, week, ...(limits.plan_type ? { plan_type: limits.plan_type } : {}), ...(limits.rate_limit_reached_type != null ? { reached: true } : {}) }; },
  loginStatus(dir) { return c.status('codex', ['login', 'status'], loginEnv(dir)); },
  seed(dir, id) { c.seed(dir, usual(), 'AGENTS.md', 'codex', id); },
};
