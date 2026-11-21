'use strict';
const fs = require('node:fs');
const path = require('node:path');
const c = require('./common');
const usual = () => c.home('CLAUDE_CONFIG_DIR', '.claude');
const loginEnv = dir => dir ? { CLAUDE_CONFIG_DIR: dir } : {};
const { run } = require('../lib/usage-probe');
const { classify } = require('../lib/steps');
const closedPort = 'http://127.0.0.1:9';
function resetTime(text, now) {
  const match = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{1,2})(?::(\d{2}))?(am|pm) \(([^)]+)\)$/.exec(text);
  if (!match) throw new Error('invalid reset time');
  const month = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(match[1]);
  const day = +match[2], hour = +match[3] % 12 + (match[5] === 'pm' ? 12 : 0), minute = +(match[4] || 0);
  if (+match[3] < 1 || +match[3] > 12 || minute > 59) throw new Error('invalid reset time');
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: match[6], year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
  const start = new Date(now).getTime();
  if (!Number.isFinite(start)) throw new Error('invalid current time');
  for (const year of [new Date(start).getUTCFullYear() - 1, new Date(start).getUTCFullYear(), new Date(start).getUTCFullYear() + 1]) {
    const target = Date.UTC(year, month, day, hour, minute);
    if (new Date(target).getUTCMonth() !== month) continue;
    let instant = target;
    for (let i = 0; i < 3; i++) {
      const parts = Object.fromEntries(fmt.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
      instant += target - Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    }
    const parts = Object.fromEntries(fmt.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
    if (+parts.year === year && +parts.month === month + 1 && +parts.day === day && +parts.hour === hour && +parts.minute === minute && instant >= start && instant - start <= 8 * 86400000) return new Date(instant).toISOString();
  }
  throw new Error('reset time outside expected range');
}
function parseUsage(raw, now = Date.now()) {
  if (typeof raw === 'string') raw = JSON.parse(raw);
  if (raw?.num_turns !== 0 || typeof raw.result !== 'string') throw new Error('invalid Claude usage response');
  let five_hour = null, week = null;
  for (const line of raw.result.split(/\r?\n/)) {
    const match = /^\s*(Current session|Current week \(all models\)): (\d+(?:\.\d+)?)% used(?:\s*·\s*resets (.+))?\s*$/.exec(line);
    if (!match) continue;
    const window = { used: +match[2], resets_at: match[3] ? resetTime(match[3].trim(), now) : null };
    if (match[1] === 'Current session') five_hour = window; else week = window;
  }
  if (!five_hour && !week) throw new Error('no usage windows');
  return { five_hour, week, ...([five_hour, week].some(w => w && w.used >= 100) ? { reached: true } : {}) };
}
const DISALLOWED_TOOLS = ['Artifact', 'Workflow', 'ScheduleWakeup', 'SendFeedback', 'ShareOnboardingGuide', 'ReportFindings', 'ListAgents', 'ArtifactComments', 'ArtifactData', 'CronCreate', 'CronDelete', 'CronList', 'RemoteTrigger', 'PushNotification', 'PublishPlugin', 'DesignSync', 'EnterWorktree', 'ExitWorktree', 'EnterPlanMode', 'ExitPlanMode', 'AskUserQuestion', 'EndConversation'];
module.exports = {
  provider: 'claude', loginEnv, parseUsage,
  usageProbe(dir, options = {}) { return run('claude', ['-p', '/usage', '--output-format', 'json', '--no-session-persistence', '--strict-mcp-config', '--setting-sources', '', '--settings', JSON.stringify({ env: { ANTHROPIC_BASE_URL: closedPort } })], { ...options, env: { ...process.env, ...loginEnv(dir), ANTHROPIC_BASE_URL: closedPort }, parse: parseUsage }); },
  asideArgv(input, context) { return ['claude', '-p', '--output-format', 'json', '--model', input.model, ...(input.effort ? ['--effort', input.effort] : []), ...(input.access === 'full' ? ['--permission-mode', 'bypassPermissions'] : ['--permission-mode', 'dontAsk', '--tools', 'Read,Grep,Glob']), '--strict-mcp-config', '--system-prompt-snapshot', 'off', '--append-system-prompt', context.prompt, '--resume', input.from, ...(input.mode === 'fork' ? ['--fork-session', '--session-id', input.new_id] : [])]; },
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
    const toolEntry = () => [{ matcher: '*', hooks: [{ type: 'command', command: hook, async: true }] }];
    const settings = { cleanupPeriodDays: 30, promptSuggestionEnabled: false, ...(session.permission_mode === 'bypass' ? { skipDangerousModePermissionPrompt: true } : {}), hooks: { Stop: entry(), Notification: entry(), StopFailure: entry(), PreToolUse: toolEntry(), PostToolUse: toolEntry(), PostToolUseFailure: toolEntry() }, statusLine: { type: 'command', command: `${c.quote(path.join(c.root, 'machine', 'statusline.sh'))} claude ${c.quote(session.name)}` } };
    if (context.mcp?.names.length) {
      const rejected = context.tools ? context.mcp.names.filter(name => !Object.hasOwn(context.mcp.servers, name)) : context.mcp.names;
      if (rejected.length) settings.disabledMcpjsonServers = rejected;
      if (context.tools && Object.keys(context.mcp.servers).length) settings.enableAllProjectMcpServers = true;
    }
    return { loaded: context.tools && context.mcp ? c.loadedTools(Object.keys(context.mcp.servers), context.mcp, context.mount) : [], settingsPath, settings, argv: ['claude', '--session-id', session.cli_session_id, '--settings', settingsPath, '--permission-mode', session.permission_mode === 'bypass' ? 'bypassPermissions' : 'auto', ...(input.model ? ['--model', input.model] : []), ...(session.effort ? ['--effort', session.effort] : []), '--append-system-prompt-file', context.promptPath, '--disallowedTools', DISALLOWED_TOOLS.join(',')] };
  },
  firstMessage(input) { return input.brief || input.first_message || ''; },
  readyText(session, pane) { return !pane.includes('Choose the text style that looks best with your terminal') && !pane.includes('Press Enter to continue') && !pane.includes('Yes, I trust this folder') && !pane.includes('No, exit') && !pane.includes('Yes, I accept') && pane.includes(session.permission_mode === 'bypass' ? 'bypass permissions on' : 'auto mode on') && /(^|\n).*❯\s/m.test(pane); },
  // First-run screens on an account whose config lost its onboarding flag: the theme picker
  // and the security notes take Enter (the default); trust and bypass default to "No, exit".
  answerPrompts(session, pane) {
    if (pane.includes('Choose the text style that looks best with your terminal')) return { step: 'theme', keys: ['Enter'] };
    if (pane.includes('Security notes:') && pane.includes('Press Enter to continue')) return { step: 'notes', keys: ['Enter'] };
    if (pane.includes('Yes, I trust this folder')) return { step: 'trust', keys: ['Down', 'Enter'] };
    if (session.permission_mode === 'bypass' && pane.includes('Yes, I accept')) return { step: 'bypass', keys: ['Down', 'Enter'] };
    return null;
  },
  async findTranscript(session, dir) { const root = path.join(dir || usual(), 'projects'); for (const entry of await fs.promises.readdir(root, { withFileTypes: true }).catch(() => [])) { const file = path.join(root, entry.name, `${session.cli_session_id}.jsonl`); if (entry.isDirectory() && fs.existsSync(file)) return file; } return null; },
  hookEvent(raw) {
    if (['PreToolUse', 'PostToolUse', 'PostToolUseFailure'].includes(raw.hook_event_name)) {
      if (!raw.tool_use_id) return null;
      const id = raw.tool_use_id, now = new Date().toISOString();
      if (raw.hook_event_name === 'PreToolUse') return { type: 'step', phase: 'start', step: { id, ...classify('claude', raw.tool_name, raw.tool_input, { cwd: raw.cwd }), started_at: now } };
      return { type: 'step', phase: 'end', step: { id, ended_at: now, failed: raw.hook_event_name === 'PostToolUseFailure', clean: true } };
    }
    if (raw.hook_event_name === 'Stop') return { type: 'turn-ended', transcript_path: raw.transcript_path, payload: raw };
    if (raw.hook_event_name === 'Notification' && raw.notification_type === 'permission_prompt') return { type: 'prompt', notification_type: raw.notification_type, payload: raw };
    if (raw.hook_event_name === 'StopFailure') return { type: raw.error === 'rate_limit' || raw.error_type === 'rate_limit' ? 'limit-hit' : 'turn-failed', error: raw.error || raw.error_type || 'unknown' };
    const events = [];
    if (raw.rate_limits) events.push({ type: 'usage-source', payload: { rate_limits: raw.rate_limits } });
    if (typeof raw.context_window?.used_percentage === 'number') events.push({ type: 'context', context: { percent: raw.context_window.used_percentage, at: new Date().toISOString() } });
    return events.length ? events : null;
  },
  usageFrom(raw) { if (!raw?.rate_limits) return null; const window = w => w && typeof w.used_percentage === 'number' ? { used: w.used_percentage, resets_at: c.iso(w.resets_at) } : null; const five_hour = window(raw.rate_limits.five_hour), week = window(raw.rate_limits.seven_day); return five_hour || week ? { at: new Date().toISOString(), five_hour, week } : null; },
  loginStatus(dir) { return c.status('claude', ['auth', 'status'], loginEnv(dir), out => JSON.parse(out).loggedIn === true); },
  seed(dir, id) { c.seed(dir, usual(), 'CLAUDE.md', 'claude', id); },
};
