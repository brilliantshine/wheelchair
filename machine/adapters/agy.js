'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const c = require('./common');
const onboarding = ['Choose your color scheme', 'Terms of Service & Data Use', 'Do you trust the contents of this project?', 'Requesting permission for:'];
module.exports = {
  provider: 'gemini', loginEnv: () => ({}), sessionNameEnv: true,
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
  command(input, session, worktree, context) {
    const settingsPath = path.join(context.stateDir, 'settings', `${session.name}.json`);
    return { ...(context.tools && context.mcp?.names.length ? { warnings: ["project tools aren't supported on Antigravity yet; this agent runs without them"] } : {}), settingsPath, settings: { trustedWorkspaces: [worktree] }, argv: ['agy', '--settings', settingsPath, ...(session.permission_mode === 'bypass' ? ['--dangerously-skip-permissions'] : ['--mode', 'auto']), ...(input.model ? ['--model', input.model] : []), ...(session.effort ? ['--effort', session.effort] : [])] };
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
  usageFrom() { return null; },
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
