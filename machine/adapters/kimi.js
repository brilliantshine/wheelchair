'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const c = require('./common');
const home = dir => path.resolve(dir || c.home('KIMI_CODE_HOME', '.kimi-code'));
function resolveCli() {
  const found = spawnSync('sh', ['-c', 'command -v kimi'], { encoding: 'utf8' });
  const candidate = found.status === 0 ? found.stdout.trim() : path.join(os.homedir(), '.kimi-code/bin/kimi');
  try { fs.accessSync(candidate, fs.constants.X_OK); return path.resolve(candidate); } catch { return null; }
}
function readConfig(dir) {
  let text;
  try { text = fs.readFileSync(path.join(home(dir), 'config.toml'), 'utf8'); }
  catch (e) { return e.code === 'ENOENT' ? { models: {} } : { models: {}, problem: "Kimi Code's config.toml can't be read" }; }
  if (text.includes('"""') || text.includes("'''")) return { models: {}, problem: "Kimi Code's config.toml has multi-line strings wheelchair can't read" };
  const result = { models: {} }; let table = '';
  for (const line of text.split(/\r?\n/)) {
    const header = line.match(/^\s*\[([^\[\]]+)\]\s*(?:#.*)?$/);
    if (header) { table = header[1].trim(); continue; }
    if (/^\s*\[\[/.test(line)) { table = null; continue; }
    const kv = line.match(/^\s*([\w-]+)\s*=\s*(.*?)\s*(?:#.*)?$/); if (!kv) continue;
    let value; try { value = JSON.parse(kv[2]); } catch { continue; }
    if (!table && table !== null && kv[1] === 'default_model' && typeof value === 'string') result.default_model = value;
    if (table === 'providers."managed:kimi-code".oauth' && ['key', 'oauth_host'].includes(kv[1]) && typeof value === 'string') result[kv[1]] = value;
    const model = table?.match(/^models\."([^"]+)"$/);
    if (model && kv[1] === 'support_efforts' && Array.isArray(value) && value.every(v => typeof v === 'string')) result.models[model[1]] = value;
  }
  return result;
}
function loginStatus(dir) {
  const config = readConfig(dir), credentials = path.join(home(dir), 'credentials'); let authenticated = false;
  if (config.problem) { try { authenticated = fs.readdirSync(credentials).some(f => f.endsWith('.json')); } catch {} }
  else if (/^oauth\/[A-Za-z0-9._-]+$/.test(config.key || '')) authenticated = fs.existsSync(path.join(credentials, `${config.key.slice(6)}.json`));
  if (config.problem) return { logged_in: false, authenticated, problem: config.problem };
  let global = false; try { global = new URL(config.oauth_host).hostname === 'auth.kimi.ai'; } catch {}
  return { logged_in: authenticated && global, authenticated, ...(authenticated && !global ? { problem: "signed in to Kimi's China region; log in again" } : {}) };
}
module.exports = {
  provider: 'kimi', resolveCli, readConfig, loginStatus,
  loginEnv: dir => ({ KIMI_CODE_HOME: home(dir) }),
  seed(dir, id) { c.seed(dir, home(), 'AGENTS.md', 'kimi', id); }, prepare() {},
  loginCommand() { return [resolveCli(), 'login', '--region', 'global']; }, loginPrompt: null,
  parseLogin(pane) { const url = pane.match(/Opening browser for Kimi device login:\s*(https?:\/\/\S+)/)?.[1]; const code = pane.match(/paste the URL above and enter code:\s*(\S+)/i)?.[1]; return url && code ? { url, code, wantsCode: false } : null; },
  loginDone() { return false; },
  command(input, session, worktree, context) {
    const config = readConfig(context.accountDir), effort = { low: 'low', medium: 'high', high: 'high', xhigh: 'max', max: 'max' }[session.effort];
    const supported = config.models[input.model || config.default_model] || [];
    return { argv: [resolveCli(), session.permission_mode === 'bypass' ? '--auto' : '--yolo', ...(input.model ? ['--model', input.model] : [])], ...(effort && supported.includes(effort) ? { env: { KIMI_MODEL_THINKING_EFFORT: effort } } : {}) };
  },
  firstMessage(input, promptPath, name) { return `[wc:role] Role: ${input.role}\nSession: ${name}\nRead ${promptPath} before responding: it holds your role rules and card rules. Read it again only if it is no longer in your context.\n\n${input.brief || input.first_message || ''}`; },
  readyText(session, pane) { return /│\s*>/.test(pane) && pane.includes('context:') && !pane.includes('Trust this folder?'); },
  answerPrompts(session, pane) { if (!pane.includes('Trust this folder?')) return null; if (/❯\s*Trust and continue/.test(pane)) return { step: 'trust', keys: ['Enter'] }; if (/❯\s*Exit/.test(pane)) return { step: 'trust-select', keys: ['Up'] }; return null; },
  promptText(pane) { return /approval required|approve|allow this/i.test(pane); },
  findTranscript() { return null; }, hookEvent() { return null; }, usageFrom() { return null; },
};
