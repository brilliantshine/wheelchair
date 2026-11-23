'use strict';
const fs = require('node:fs');
const path = require('node:path');
const c = require('../common');
const usual = () => c.home('CODEX_HOME', '.codex');
const loginEnv = dir => dir ? { CODEX_HOME: dir } : {};
const { run } = require('../../machine/lib/usage-probe');
const { DUPLICATE_HEADERS, serverLabel } = require('../../machine/lib/project-mcp');
const { isWindowsProgram } = require('../../machine/lib/project-programs');
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
// TOML basic string. JSON.stringify is not enough: TOML forbids raw U+007F and other control
// characters that JSON leaves unescaped, and Codex then rejects the whole configuration.
const tomlString = value => `"${String(value).replace(/[\\"\u0000-\u001f\u007f]/g, ch => ch === '\\' ? '\\\\' : ch === '"' ? '\\"' : `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`)}"`;
// The whole tmux command is one argument; Linux caps one argument at 128 KiB. Shell quoting can
// grow the overrides about fourfold, so they are measured after quoting and dropped as a whole
// when over budget, rather than letting the session fail to start.
const PROJECT_OVERRIDE_BUDGET = 64 * 1024;
const quotedLength = value => Buffer.byteLength(`'${String(value).replace(/'/g, `'\\''`)}'`, 'utf8') + 1;
// Why Codex skips a server, or null. Shared by the launch and the project tools screen.
function codexEntryReason(name, entry) {
  if (!/^[A-Za-z0-9_-]+$/.test(name)) return 'its name must use only letters, digits, _ and -';
  if (entry.type === 'sse') return 'uses sse, which Codex does not support';
  const headers = entry.type === 'http' ? Object.entries(entry.headers || {}) : [];
  if (entry.type === 'http' && (entry[DUPLICATE_HEADERS] || new Set(headers.map(([key]) => key.toLowerCase())).size !== headers.length)) return 'has the same header twice';
  // Only the fields this transport uses are read: the reader validates stdio fields for stdio
  // entries and only `url` and `headers` for http ones, so an entry's other keys may be anything.
  if (entry.type === 'http' ? entry.url.includes('${') :
    [entry.command, ...(entry.args || [])].some(value => value.includes('${')) ||
    Object.entries(entry.env || {}).some(([key, value]) => value.includes('${') &&
      (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || value !== `\${${key}}`))) {
    return 'it uses ${...} that Codex cannot pass through';
  }
  for (const [key, value] of headers) {
    const bearer = key.toLowerCase() === 'authorization' && /^Bearer \$\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(value);
    if (!bearer && !/^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(value) && value.includes('${')) return 'a header uses ${...} that Codex cannot pass through';
  }
  return null;
}
// The -c overrides for every server Codex can take, measured against the budget as a whole.
function codexOverrides(mcp, { wsl = false, mount = '/mnt', replaceEntries = {} } = {}) {
  const args = [], warnings = [], included = [];
  for (const name of Object.keys(mcp?.servers || {})) {
    const original = mcp.servers[name];
    const entry = Object.hasOwn(replaceEntries, name) ? replaceEntries[name] : original;
    if (entry === null) continue;
    const reason = codexEntryReason(name, entry);
    if (reason) { warnings.push({ names: [name], text: `${serverLabel(name)}: skipped on Codex: ${reason}` }); continue; }
    included.push(name);
    const prefix = `mcp_servers.project_${name}`;
    const add = (key, value) => args.push('-c', `${prefix}.${key}=${value}`);
    if (entry.type === 'http') {
      const literalHeaders = [], envHeaders = [];
      let bearer;
      for (const [key, value] of Object.entries(entry.headers || {})) {
        const token = /^Bearer \$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(value);
        const env = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(value);
        if (key.toLowerCase() === 'authorization' && token) bearer = token[1];
        else if (env) envHeaders.push(`${tomlString(key)}=${tomlString(env[1])}`);
        else literalHeaders.push(`${tomlString(key)}=${tomlString(value)}`);
      }
      add('url', tomlString(entry.url));
      if (bearer !== undefined) add('bearer_token_env_var', tomlString(bearer));
      if (literalHeaders.length) add('http_headers', `{${literalHeaders.join(',')}}`);
      if (envHeaders.length) add('env_http_headers', `{${envHeaders.join(',')}}`);
    } else {
      const literal = [], passthrough = [];
      for (const [key, value] of Object.entries(entry.env || {})) {
        if (value === `\${${key}}` && /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) passthrough.push(tomlString(key));
        else literal.push(`${tomlString(key)}=${tomlString(value)}`);
      }
      if (wsl && (original.type === undefined || original.type === 'stdio') && isWindowsProgram(original.command, mount)) {
        for (const name of ['WHEELCHAIR_WINDOWS_PROJECT', 'WSLENV']) {
          const quoted = tomlString(name);
          if (!passthrough.includes(quoted)) passthrough.push(quoted);
        }
      }
      add('command', tomlString(entry.command));
      add('args', `[${(entry.args || []).map(tomlString).join(',')}]`);
      add('env', `{${literal.join(',')}}`);
      add('env_vars', `[${passthrough.join(',')}]`);
    }
    add('default_tools_approval_mode', '"approve"');
    add('enabled', 'true');
  }
  const tooLarge = args.reduce((sum, value) => sum + quotedLength(value), 0) > PROJECT_OVERRIDE_BUDGET;
  if (tooLarge) {
    args.length = 0;
    warnings.push({ names: included, text: `${included.map(serverLabel).join(', ')}: skipped on Codex: .mcp.json is too large to pass on the command line` });
  }
  return { args, tooLarge, warnings };
}
const lastAside = text => text.split('\n').map(x => x.trim()).filter(Boolean).pop();
module.exports = {
  recognizePane: text => text.includes('Codex'),

  asideMessage: (i, prompt, message) => i.mode === 'fork' ? `${prompt}\n\n${message}` : message,
  async asidePrepare(runChild, onSpawn) {
    const list = await runChild(['codex', 'mcp', 'list', '--json'], '', onSpawn);
    if (list.code !== 0) return { error: lastAside(list.err) || `codex mcp list exited ${list.code}` };
    try { const parsed = JSON.parse(list.out); if (!Array.isArray(parsed) || parsed.some(x => typeof x.name !== 'string' || !x.name)) throw Error(); return { servers: parsed.map(x => x.name) }; } catch { return { error: 'invalid codex mcp list output' }; }
  },
  asideModel: /^[A-Za-z0-9._:\[\]-]+$/,
  asideResult(i, r) {
      let reply = null, conversation_id = null, error = null;
      for (const line of r.out.split('\n')) { let e; try { e = JSON.parse(line); } catch { continue; } if (e.type === 'thread.started') conversation_id = e.thread_id; if (e.type === 'item.completed' && e.item?.type === 'agent_message') reply = e.item.text; if (e.type === 'error' || e.type === 'turn.failed') error = e.message || e.error?.message || e.error || error; }
      const limit = /rate_limit_reached_type|usage limit/i.test(r.out + r.err);
      return r.code === 0 && reply ? { state: 'ok', reply, conversation_id, limit } : { state: 'failed', error: error || lastAside(r.err) || `codex exited ${r.code}`, conversation_id, limit };
  },
  readSteps: require('./steps').readLines,
  stepsReady: session => !!session.codex_thread_id,
  sandboxed: session => session.codex_mode !== 'unrestricted',
  sandboxWrap: command => ['codex', 'sandbox', '-c', 'sandbox_mode="workspace-write"', '-c', 'sandbox_workspace_write.network_access=true', '--', ...command],
  projectToolReason(name, entry) { const reason = codexEntryReason(name, entry); return reason ? `on Codex: ${reason}` : null; },
  projectToolFileWarning(servers) { return codexOverrides({ servers }).tooLarge ? 'project tools skipped on Codex: .mcp.json is too large to pass on the command line' : null; },
  stepVocabulary: { card: ['exec_command', 'shell'], agents: ['spawn_agent', 'send_input', 'wait_agent', 'close_agent'], web: ['web_search', 'web_fetch'], files: ['apply_patch', 'view_image'], fileSubstring: true, shellDescription: [] },
  preflightCommand(dir) { return { file: path.join(c.root, 'codex', 'preflight.sh'), args: [], env: dir ? { ...process.env, ...loginEnv(dir) } : undefined }; },
  provider: 'gpt', loginEnv, usual, parseUsage, codexEntryReason, codexOverrides,
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
  command(input, session, worktree, context) {
    const trust = `projects={${JSON.stringify(worktree)}={trust_level="trusted"}}`;
    const notify = `notify=[${JSON.stringify(path.join(c.root, 'machine', 'hook.sh'))},"codex",${JSON.stringify(session.name)}]`;
    const access = input.role === 'reviewer' ? ['-s', 'read-only', '-a', 'never'] : session.codex_mode === 'unrestricted' ? ['--dangerously-bypass-approvals-and-sandbox'] : ['-s', 'workspace-write', '-a', 'never', '-c', 'sandbox_workspace_write.network_access=true'];
    const argv = ['codex', ...access, '-c', notify, '-c', trust, ...(input.model ? ['-m', input.model] : []), ...(session.effort ? ['-c', `model_reasoning_effort=${session.effort}`] : [])];
    const projectStart = argv.length;
    const { args, warnings, tooLarge } = codexOverrides(context?.tools ? context.mcp : null, context);
    argv.push(...args);
    // Every project override is redacted in the stored command (Spec §3): '-c' then 'key=value'.
    const redactions = [];
    for (let i = projectStart + 1; i < argv.length; i += 2) redactions.push(i);
    const names = context?.tools && !tooLarge ? Object.keys(context.mcp?.servers || {}).filter(name => { const entry = Object.hasOwn(context.replaceEntries || {}, name) ? context.replaceEntries[name] : context.mcp.servers[name]; return entry !== null && !codexEntryReason(name, entry); }) : [];
    if (context?.resume) argv.push('resume', session.codex_thread_id);
    return { argv, warnings, redactions, loaded: c.loadedTools(names, context?.mcp, context?.mount, context?.replaceEntries) };
  },
  firstMessage(input, promptPath) { const first = input.brief || input.first_message || ''; return `[wc:role] Role: ${input.role}\nRead ${promptPath} before responding: it holds your role rules and card rules. Read it again only if it is no longer in your context.\n\n${first}`; },
  readyText(session, pane) { return pane.includes('Ask Codex to do anything'); }, answerPrompts() { return null; },
  async findTranscript(session, dir) { if (!session.codex_thread_id) return null; const find = async directory => { for (const entry of await fs.promises.readdir(directory, { withFileTypes: true }).catch(() => [])) { const file = path.join(directory, entry.name); if (entry.isDirectory()) { const hit = await find(file); if (hit) return hit; } else if (entry.name.endsWith(`-${session.codex_thread_id}.jsonl`)) return file; } return null; }; return find(path.join(dir || usual(), 'sessions')); },
  hookEvent(raw) { return raw.type === 'agent-turn-complete' ? { ...raw, type: 'turn-ended' } : null; },
  usageFrom(source) { let raw = source; if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { return null; } } const limits = raw?.payload?.rate_limits; if (!limits) return null; let five_hour = null, week = null; for (const w of [limits.primary, limits.secondary]) { if (!w || typeof w.used_percent !== 'number') continue; const v = { used: w.used_percent, resets_at: c.iso(w.resets_at) }; if (w.window_minutes === 300) five_hour = v; if (w.window_minutes === 10080) week = v; } if (!five_hour && !week) return null; return { at: c.iso(raw.timestamp) || new Date().toISOString(), five_hour, week, ...(limits.plan_type ? { plan_type: limits.plan_type } : {}), ...(limits.rate_limit_reached_type != null ? { reached: true } : {}) }; },
  loginStatus(dir) { return c.status('codex', ['login', 'status'], loginEnv(dir)); },
  seed(dir, id) { c.seed(dir, usual(), 'AGENTS.md', 'codex', id); },
};
