'use strict';
const fs = require('node:fs');
const path = require('node:path');
const c = require('./common');
const usual = () => c.home('CODEX_HOME', '.codex');
const loginEnv = dir => dir ? { CODEX_HOME: dir } : {};
const { run } = require('../lib/usage-probe');
function parseUsage(response) {
  if (response?.error || !response?.result?.rateLimits) throw new Error('invalid Codex usage response');
  const limits = response.result.rateLimits; let five_hour = null, week = null;
  for (const w of [limits.primary, limits.secondary]) {
    if (!w || typeof w.usedPercent !== 'number' || !Number.isFinite(w.usedPercent)) continue;
    const value = { used: w.usedPercent, resets_at: w.resetsAt == null ? null : c.iso(w.resetsAt) };
    if (w.resetsAt != null && !value.resets_at) throw new Error('invalid reset time');
    if (w.windowDurationMins === 300) five_hour = value;
    if (w.windowDurationMins === 10080) week = value;
  }
  if (!five_hour && !week) throw new Error('no usage windows');
  return { five_hour, week, ...(limits.planType ? { plan_type: limits.planType } : {}), ...(limits.rateLimitReachedType != null ? { reached: true } : {}) };
}
module.exports = {
  provider: 'gpt', loginEnv, parseUsage,
  usageProbe(dir, options = {}) { return run('codex', ['app-server'], { ...options, env: { ...process.env, ...loginEnv(dir) }, parse: parseUsage, messages: [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: { name: 'wheelchair', version: '1' } } },
    { jsonrpc: '2.0', method: 'initialized' },
    { jsonrpc: '2.0', id: 2, method: 'account/rateLimits/read' },
  ] }); },
  asideArgv(input, context) { return ['codex', 'exec', ...(input.access === 'full' ? ['--dangerously-bypass-approvals-and-sandbox'] : ['-s', 'read-only']), '--json', '-m', input.model, ...(input.effort ? ['-c', `model_reasoning_effort=${input.effort}`] : []), ...context.servers.flatMap(name => ['-c', `mcp_servers.${/^[A-Za-z0-9_-]+$/.test(name) ? name : JSON.stringify(name)}.enabled=false`]), '--disable', 'apps', input.mode, input.from, '-']; },
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
