'use strict';
const fs = require('node:fs');
const path = require('node:path');
const c = require('./common');
const usual = () => c.home('CLAUDE_CONFIG_DIR', '.claude');
const loginEnv = dir => dir ? { CLAUDE_CONFIG_DIR: dir } : {};
module.exports = {
  provider: 'claude', loginEnv,
  loginCommand() { return ['claude', 'auth', 'login']; },
  parseLogin(pane) {
    const joined = pane.replace(/\r/g, '').replace(/\n(?=\S)(?!Paste code)/gi, '');
    const url = joined.match(/https:\/\/(?:claude\.(?:ai|com)|console\.anthropic\.com)\/[^\s]+/)?.[0] || null;
    return url ? { url, code: null, wantsCode: /paste code here if prompted/i.test(pane) } : null;
  },
  loginPrompt(pane) { return /(?:login method|account type)/i.test(pane) && /(?:Claude (?:Pro|subscription)|subscription)/i.test(pane) ? ['Enter'] : null; },
  command(input, session, worktree, context) {
    const settingsPath = path.join(context.stateDir, 'settings', `${session.name}.json`);
    const hook = `${c.quote(path.join(c.root, 'machine', 'hook.sh'))} claude ${c.quote(session.name)}`;
    const entry = () => [{ hooks: [{ type: 'command', command: hook }] }];
    const settings = { cleanupPeriodDays: 30, promptSuggestionEnabled: false, ...(session.permission_mode === 'bypass' ? { skipDangerousModePermissionPrompt: true } : {}), hooks: { Stop: entry(), Notification: entry(), StopFailure: entry() }, statusLine: { type: 'command', command: `${c.quote(path.join(c.root, 'machine', 'statusline.sh'))} claude ${c.quote(session.name)}` } };
    return { settingsPath, settings, argv: ['claude', '--session-id', session.cli_session_id, '--settings', settingsPath, '--permission-mode', session.permission_mode === 'bypass' ? 'bypassPermissions' : 'auto', ...(input.model ? ['--model', input.model] : []), ...(session.effort ? ['--effort', session.effort] : []), '--append-system-prompt', context.rolePrompt] };
  },
  firstMessage(input) { return input.brief || input.first_message || ''; },
  readyText(session, pane) { return !pane.includes('Yes, I trust this folder') && !pane.includes('No, exit') && !pane.includes('Yes, I accept') && pane.includes(session.permission_mode === 'bypass' ? 'bypass permissions on' : 'auto mode on') && /(^|\n).*❯\s/m.test(pane); },
  answerPrompts(session, pane) { if (pane.includes('Yes, I trust this folder')) return 'trust'; if (session.permission_mode === 'bypass' && pane.includes('Yes, I accept')) return 'bypass'; return null; },
  async findTranscript(session, dir) { const root = path.join(dir || usual(), 'projects'); for (const entry of await fs.promises.readdir(root, { withFileTypes: true }).catch(() => [])) { const file = path.join(root, entry.name, `${session.cli_session_id}.jsonl`); if (entry.isDirectory() && fs.existsSync(file)) return file; } return null; },
  hookEvent(raw) { if (raw.hook_event_name === 'Stop') return { type: 'turn-ended', transcript_path: raw.transcript_path, payload: raw }; if (raw.hook_event_name === 'Notification' && raw.notification_type === 'permission_prompt') return { type: 'prompt', notification_type: raw.notification_type, payload: raw }; if (raw.hook_event_name === 'StopFailure') return { type: raw.error === 'rate_limit' || raw.error_type === 'rate_limit' ? 'limit-hit' : 'turn-failed', error: raw.error || raw.error_type || 'unknown' }; if (raw.rate_limits) return { type: 'usage-source', payload: raw }; return null; },
  usageFrom(raw) { if (!raw?.rate_limits) return null; const window = w => w && typeof w.used_percentage === 'number' ? { used: w.used_percentage, resets_at: c.iso(w.resets_at) } : null; const five_hour = window(raw.rate_limits.five_hour), week = window(raw.rate_limits.seven_day); return five_hour || week ? { at: new Date().toISOString(), five_hour, week } : null; },
  loginStatus(dir) { return c.status('claude', ['auth', 'status'], loginEnv(dir), out => JSON.parse(out).loggedIn === true); },
  seed(dir, id) { c.seed(dir, usual(), 'CLAUDE.md', 'claude', id); },
};
