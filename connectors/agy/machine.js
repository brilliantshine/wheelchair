'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const c = require('../common');
const { run } = require('../../machine/lib/usage-probe');
const { DUPLICATE_HEADERS, serverLabel } = require('../../machine/lib/project-mcp');
const onboarding = ['Choose your color scheme', 'Terms of Service & Data Use', 'Do you trust the contents of this project?', 'Requesting permission for:'];
function parseUsage(raw) {
  if (typeof raw === 'string') raw = JSON.parse(raw);
  if (raw?.status !== 'SUCCESS' || raw?.command?.name !== 'usage' || !Array.isArray(raw.command?.data?.groups)) throw new Error('invalid Antigravity usage response');
  const group = raw.command.data.groups.find(g => g?.name === 'Gemini Models');
  const buckets = Array.isArray(group?.buckets) ? group.buckets : [];
  const window = pred => {
    const b = buckets.find(pred);
    if (!b || typeof b.remaining_fraction !== 'number' || !Number.isFinite(b.remaining_fraction)) return null;
    const used = Math.min(Math.max((1 - b.remaining_fraction) * 100, 0), 100);
    const reset = typeof b.reset_time === 'string' && b.reset_time.trim() ? Date.parse(b.reset_time) : NaN;
    return { used, resets_at: Number.isFinite(reset) && reset > 0 ? new Date(reset).toISOString() : null };
  };
  const five_hour = window(b => b?.window === '5h' || b?.id === 'gemini-5h');
  const week = window(b => b?.window === 'weekly' || b?.id === 'gemini-weekly');
  if (!five_hour && !week) throw new Error('no usage windows');
  return { five_hour, week, ...([five_hour, week].some(w => w && w.used >= 100) ? { reached: true } : {}) };
}
module.exports = {
  recognizePane: text => text.includes('Antigravity CLI'),

  stepVocabulary: c.stepVocabularies.codexStyle,
  loginEnv: () => ({}), sessionNameEnv: true, parseUsage,
  usageProbe(dir, options = {}) { return run('agy', ['-p', '/usage', '--output-format', 'json'], { ...options, env: { ...process.env }, parse: parseUsage }); },
  prepare() {
    const file = path.join(os.homedir(), '.gemini', 'config', 'hooks.json');
    const wanted = { Stop: [{ type: 'command', command: `${c.quote(path.join(c.root, 'machine', 'hook.sh'))} agy` }] };
    let data = {}, mode = 0o644;
    try {
      const text = fs.readFileSync(file, 'utf8');
      mode = fs.statSync(file).mode & 0o7777;
      data = JSON.parse(text);
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid');
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error("Couldn't update Antigravity's hooks file");
    }
    if (JSON.stringify(data.wheelchair) === JSON.stringify(wanted)) return;
    data.wheelchair = wanted;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`, { mode });
    fs.chmodSync(temp, mode);
    fs.renameSync(temp, file);
  },
  async launchContext(service, input, session) {
    if (!input.model) return {};
    const fallback = { agyLaunchModel: input.model, agyLaunchEffort: session.effort };
    const script = process.env.WHEELCHAIR_AGY_MODEL_SCRIPT || path.join(c.root, 'codex', 'model.sh');
    const timeout = Number(process.env.WHEELCHAIR_AGY_LAUNCH_TIMEOUT_MS) || 15000;
    return new Promise(resolve => {
      execFile(script, ['agy-launch', input.model, ...(session.effort ? [session.effort] : [])], { timeout }, (error, stdout) => {
        const match = !error && /^([^\t\r\n]+)\t([^\t\r\n]*)\n$/.exec(stdout);
        resolve(match ? { agyLaunchModel: match[1], agyLaunchEffort: match[2] } : fallback);
      });
    });
  },
  command(input, session, worktree, context) {
    const model = context.agyLaunchModel ?? input.model;
    const effort = context.agyLaunchEffort ?? session.effort;
    const settingsPath = path.join(context.stateDir, 'settings', `${session.name}.json`);
    const servers = {}, warnings = [];
    const extras = context.tools ? context.extraServers || [] : [];
    if (context.tools && (context.mcp || extras.length)) {
      for (const [name, original] of [...Object.entries(context.mcp?.servers || {}), ...extras.map(({ name, entry }) => [name, entry])]) {
        const entry = Object.hasOwn(context.replaceEntries || {}, name) ? context.replaceEntries[name] : original;
        if (entry === null) continue;
        let reason, translated;
        if (!/^[A-Za-z0-9_-]+$/.test(name)) reason = 'its name must use only letters, digits, _ and -';
        else if (entry.type === 'sse') reason = 'uses sse, which Antigravity does not support here';
        else if (entry.type === 'http') {
          const headers = entry.headers || {}, names = Object.keys(headers);
          if (entry[DUPLICATE_HEADERS] || new Set(names.map(key => key.toLowerCase())).size !== names.length) reason = 'has the same header twice';
          else if ([entry.url, ...names, ...Object.values(headers)].some(value => value.includes('${'))) reason = 'uses ${...} that Antigravity cannot pass through';
          else translated = { type: 'http', url: entry.url, headers };
        } else {
          const env = {}, fields = [entry.command, ...(entry.args || [])];
          for (const [key, value] of Object.entries(entry.env || {})) {
            if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && value === '${' + key + '}') continue;
            fields.push(key, value);
            Object.defineProperty(env, key, { value, enumerable: true, writable: true, configurable: true });
          }
          if (fields.some(value => value.includes('${'))) reason = 'uses ${...} that Antigravity cannot pass through';
          else translated = { command: entry.command, args: entry.args || [], env };
        }
        if (!reason && name === 'wheelchair-tools' && extras.some(extra => extra.name === name && extra.folder === 'bridge')) translated.timeoutSeconds = 260;
        if (reason) warnings.push({ names: [name], text: `${serverLabel(name)}: skipped on Antigravity: ${reason}` });
        else Object.defineProperty(servers, name, { value: translated, enumerable: true, writable: true, configurable: true });
      }
    }
    let toolFiles;
    if (Object.keys(servers).length) {
      const dir = path.join(context.stateDir, 'agy-tools', encodeURIComponent(session.name));
      const plugin = path.join(dir, '.agents', 'plugins', 'wheelchair-project');
      toolFiles = { dir, files: [
        { path: path.join(plugin, 'plugin.json'), text: JSON.stringify({ name: 'wheelchair-project', version: '1' }, null, 2) + '\n' },
        { path: path.join(plugin, 'mcp_config.json'), text: JSON.stringify({ mcpServers: servers }, null, 2) + '\n' },
      ] };
    }
    return { loaded: [...c.loadedTools(Object.keys(servers).filter(name => !extras.some(extra => extra.name === name)), context.mcp, context.mount, context.replaceEntries), ...extras.filter(extra => Object.hasOwn(servers, extra.name)).map(({ name }) => ({ name, windows: false, wrapped: false }))], ...(warnings.length ? { warnings } : {}), ...(toolFiles ? { toolFiles } : {}), settingsPath, settings: { trustedWorkspaces: [worktree] }, argv: ['agy', '--settings', settingsPath, ...(toolFiles ? ['--add-dir', toolFiles.dir] : []), '--dangerously-skip-permissions', ...(model ? ['--model', model] : []), ...(effort ? ['--effort', effort] : [])] };
  },
  firstMessage(input, promptPath) { const first = input.brief || input.first_message || ''; return `[wc:role] Role: ${input.role}\nRead ${promptPath} before responding: it holds your role rules and card rules. Read it again only if it is no longer in your context.\n\n${first}`; },
  readyText(session, pane) { return pane.includes('? for shortcuts') && !onboarding.some(s => pane.includes(s)); },
  answerPrompts() { return null; },
  promptText(pane) { return pane.includes('Requesting permission for:') && pane.includes('Run this command?'); },
  findTranscript(session) { return session.source_transcript || null; },
  hookEvent(raw) {
    if (raw.hookEventName !== 'Stop') return null;
    const error = typeof raw.error === 'string' ? raw.error : '';
    if (raw.terminationReason === 'error' || error) return { type: /quota|rate.?limit|resource.?exhausted|429/i.test(error) ? 'limit-hit' : 'turn-failed', error: error || 'unknown' };
    return { type: 'turn-ended', conversation_id: raw.conversationId, agy_transcript: raw.transcriptPath, last_user_input: raw.lastUserInput, payload: raw };
  },
  onTurnEnded(session, event) {
    if (!session.agy_conversation_id) {
      if (!event.last_user_input?.startsWith('[wc:role]') || !event.conversation_id || !event.agy_transcript) return { ignored: true };
      session.agy_conversation_id = event.conversation_id; session.source_transcript = event.agy_transcript;
    }
    if (session.agy_conversation_id !== event.conversation_id) return { ignored: true };
    return {};
  },
  loginCommand() { return ['agy']; },
  loginCwd(stateDir) { const dir = path.join(stateDir, 'agy-login'); fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); return dir; },
  loginPrompt(pane) {
    if (pane.includes('Select login method') && pane.includes('> 1. Google OAuth')) return { step: 'method', keys: ['Enter'] };
    if (pane.includes('Choose your color scheme')) return { step: 'theme', keys: ['Enter'] };
    if (pane.includes('Terms of Service & Data Use')) return { step: 'data', keys: ['Enter', 'Down', 'Right', 'Enter'] };
    if (pane.includes('Do you trust the contents of this project?')) return { step: 'trust', keys: ['Enter'] };
    return null;
  },
  parseLogin(pane) { const joined = pane.replace(/\r/g, '').replace(/\n(?=\S)/g, ''); const url = joined.match(/https:\/\/accounts\.google\.com\/[^\s]+/)?.[0] || null; return url ? { url, code: null, wantsCode: /paste the authorization code/i.test(pane) } : null; },
  loginDone(pane) { return pane.includes('? for shortcuts') && !pane.includes('Welcome to Antigravity CLI!') && !onboarding.some(s => pane.includes(s)); },
  loginStatus() { return c.status('agy', ['models'], {}, out => !/Please sign in/i.test(out)); },
  seed() {},
};
