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
  catch (e) { return e.code === 'ENOENT' ? {} : { problem: "Kimi Code's config.toml can't be read" }; }
  if (text.includes('"""') || text.includes("'''")) return { problem: "Kimi Code's config.toml has multi-line strings wheelchair can't read" };
  const result = {}; let table = '';
  for (const line of text.split(/\r?\n/)) {
    const header = line.match(/^\s*\[([^\[\]]+)\]\s*(?:#.*)?$/);
    if (header) { table = header[1].trim(); continue; }
    if (/^\s*\[\[/.test(line)) { table = null; continue; }
    const kv = line.match(/^\s*([\w-]+)\s*=\s*(.*?)\s*(?:#.*)?$/); if (!kv) continue;
    let value; try { value = JSON.parse(kv[2]); } catch { continue; }
    if (!table && table !== null && kv[1] === 'default_model' && typeof value === 'string') result.default_model = value;
    if (table === 'providers."managed:kimi-code".oauth' && ['key', 'oauth_host'].includes(kv[1]) && typeof value === 'string') result[kv[1]] = value;
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
const bindings = new Map();
function marker(value, name) {
  if (typeof value === 'string') return value.startsWith('[wc:role]') && value.split(/\r?\n/).includes(`Session: ${name}`);
  return value && typeof value === 'object' && Object.values(value).some(v => marker(v, name));
}
async function findTranscript(session, dir) {
  if (session.source_transcript) return session.source_transcript;
  if (bindings.has(session)) return bindings.get(session);
  const run = (async () => {
    const root = path.join(home(dir), 'sessions');
    const dirs = async p => fs.promises.readdir(p, { withFileTypes: true }).catch(() => []);
    for (const work of await dirs(root)) {
      if (!work.isDirectory()) continue;
      for (const id of await dirs(path.join(root, work.name))) {
        if (!id.isDirectory()) continue;
        const file = path.join(root, work.name, id.name, 'agents/main/wire.jsonl');
        let handle;
        try {
          handle = await fs.promises.open(file, 'r');
          const stat = await handle.stat();
          if (stat.mtimeMs < Date.parse(session.created_at)) continue;
          const text = await handle.readFile('utf8');
          const rows = text.split('\n').map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
          const meta = rows.find(row => row.type === 'metadata');
          if (!meta) continue;
          const parts = String(meta.protocol_version || '').split('.').map(Number);
          const min = String(meta.min_protocol_version || '1.0').split('.').map(Number);
          const compatible = parts[0] === 1 && (min[0] < 1 || (min[0] === 1 && (min[1] || 0) <= 5));
          if (!compatible) {
            if (rows.some(row => marker(row, session.name))) throw Object.assign(new Error(`Kimi Code's log format changed (protocol ${meta.protocol_version}); update wheelchair`), { kimiFatal: true });
            continue;
          }
          const prompt = rows.find(row => row.type === 'turn.prompt' && row.origin?.kind === 'user');
          if (prompt && marker(prompt.input, session.name) && !session.source_transcript) {
            Object.assign(session, { source_transcript: file, kimi_session_id: id.name, kimi_log_id: { dev: stat.dev, ino: stat.ino } });
            return file;
          }
        } catch (error) { if (error.kimiFatal) throw error; }
        finally { if (handle) await handle.close(); }
      }
    }
    return session.source_transcript || null;
  })();
  bindings.set(session, run);
  try { return await run; } finally { bindings.delete(session); }
}
module.exports = {
  provider: 'kimi', resolveCli, readConfig, loginStatus,
  loginEnv: dir => ({ KIMI_CODE_HOME: home(dir) }),
  seed(dir, id) { c.seed(dir, home(), 'AGENTS.md', 'kimi', id); }, prepare() {},
  loginCommand() { const cli = resolveCli(); if (!cli) throw new Error('Kimi Code is not installed'); return [cli, 'login', '--region', 'global']; }, loginPrompt: null,
  parseLogin(pane) { const url = pane.match(/Opening browser for Kimi device login:\s*(https?:\/\/\S+)/)?.[1]; const code = pane.match(/paste the URL above and enter code:\s*(\S+)/i)?.[1]; return url && code ? { url, code, wantsCode: false } : null; },
  loginDone() { return false; },
  command(input, session, worktree, context) {
    return { argv: [resolveCli(), session.permission_mode === 'bypass' ? '--auto' : '--yolo', ...(input.model ? ['--model', input.model] : [])] };
  },
  firstMessage(input, promptPath, name) { return `[wc:role] Role: ${input.role}\nSession: ${name}\nRead ${promptPath} before responding: it holds your role rules and card rules. Read it again only if it is no longer in your context.\n\n${input.brief || input.first_message || ''}`; },
  readyText(session, pane) { return /│\s*>/.test(pane) && pane.includes('context:') && !pane.includes('Trust this folder?'); },
  answerPrompts(session, pane) { if (!pane.includes('Trust this folder?')) return null; if (/❯\s*Trust and continue/.test(pane)) return { step: 'trust', keys: ['Enter'] }; if (/❯\s*Exit/.test(pane)) return { step: 'trust-select', keys: ['Up'] }; return null; },
  promptText(pane) { return /\b(?:tool|command) approval required\b/i.test(pane); },
  async findTranscript(session, dir) { return findTranscript(session, dir); }, hookEvent() { return null; }, usageFrom() { return null; },
};
