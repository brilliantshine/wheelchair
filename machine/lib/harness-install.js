'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { providers, loadRecipes } = require('./harness-recipes');
const adapters = require('../adapters');
const root = path.resolve(__dirname, '../..');
const names = { claude: 'claude', gpt: 'codex', gemini: 'agy', kimi: 'kimi', openrouter: 'pi' };
const labels = { claude: 'Claude', gpt: 'GPT', gemini: 'Gemini', kimi: 'Kimi', openrouter: 'OpenRouter' };
const dir = () => path.join(os.homedir(), '.wheelchair', 'installs');
const file = (p, ext) => path.join(dir(), `${p}.${ext}`);
function read(p, ext) { try { return JSON.parse(fs.readFileSync(file(p, ext), 'utf8')); } catch { return null; } }
function live(pid) { if (!Number.isSafeInteger(pid) || pid <= 0) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }
function state(p) {
  const pid = read(p, 'pid'), result = read(p, 'result');
  let tail = ''; try { tail = fs.readFileSync(file(p, 'log'), 'utf8').replace(/\n$/, '').split('\n').slice(-40).join('\n'); } catch {}
  if (pid && live(pid.pid)) return { state: 'running', exit_code: null, output_tail: tail, started_at: pid.started_at, finished_at: null };
  if (result) return { ...result, output_tail: tail };
  if (pid) return { state: 'failed', exit_code: null, output_tail: `${tail}${tail ? '\n' : ''}The install stopped before finishing.`, started_at: pid.started_at, finished_at: null };
  return { state: 'idle', exit_code: null, output_tail: tail, started_at: null, finished_at: null };
}
function start(p) {
  fs.mkdirSync(dir(), { recursive: true, mode: 0o700 });
  if (state(p).state === 'running') return false;
  const started_at = new Date().toISOString();
  const log = fs.openSync(file(p, 'log'), 'w', 0o600);
  try {
    try { fs.unlinkSync(file(p, 'result')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    const child = spawn(process.execPath, [__filename, p, started_at], { detached: true, stdio: ['ignore', log, log] });
    fs.writeFileSync(file(p, 'pid'), JSON.stringify({ pid: child.pid, started_at }), { mode: 0o600 });
    child.unref();
  } finally { fs.closeSync(log); }
  return true;
}
function run(program, args, env = process.env, capture = false) {
  const r = spawnSync(program, args, { env, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (r.error) console.error(r.error.message);
  return r;
}
function newer(actual, min) { const a = actual.split('.').map(Number), b = min.split('.').map(Number); for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]; return true; }
async function job(p, started_at) {
  // Parent publishes the pid before any result can be written.
  while (read(p, 'pid')?.pid !== process.pid) await new Promise(resolve => setTimeout(resolve, 10));
  let code = 1;
  try {
    const recipe = loadRecipes()[p], cli = names[p];
    if (!recipe) throw new Error('no recipe');
    if (recipe.node && !newer(process.versions.node, recipe.node)) {
      console.error(`${labels[p]} needs Node ${recipe.node} or newer; this machine has ${process.versions.node}. Update Node, then try again.`);
    } else {
      const installed = run('/bin/sh', ['-c', recipe.command]); code = installed.status ?? 1;
      if (code === 0 && (p === 'claude' || p === 'gpt')) {
        const home = os.homedir(), installedName = p === 'gpt' ? 'codex' : 'claude', other = p === 'gpt' ? 'claude' : 'codex';
        const cleanup = run('python3', ['-I', path.join(root, 'install/unseen.py'), root, process.env.WHEELCHAIR_CLAUDE_HOME || path.join(home, '.claude'), process.env.WHEELCHAIR_CODEX_HOME || path.join(home, '.codex'), `${installedName},`]);
        code = cleanup.status ?? 1;
        if (!code) {
          const dial = path.join(root, 'sensitivity/set.sh');
          const get = run(dial, ['--json'], { ...process.env, WHEELCHAIR_PRESENT: other }, true);
          let level = 'default'; try { const v = JSON.parse(get.stdout).level; if (get.status === 0 && ['ask', 'default', 'high'].includes(v)) level = v; } catch {}
          const set = run(dial, [level], { ...process.env, WHEELCHAIR_PRESENT: installedName });
          if (set.status !== 0) console.error('Warning: diagram sensitivity setup failed.');
        }
      }
      if (code === 0) {
        const resolved = cli === 'pi' || cli === 'kimi' ? adapters[cli].resolveCli() : run('sh', ['-c', `command -v ${cli}`], process.env, true).status === 0 && cli;
        if (!resolved) { console.error(`Installed, but wheelchair can't find ${cli} on its path. Re-run ./install.sh from the wheelchair folder once.`); code = 1; }
        else if (cli !== 'pi') code = run(resolved, ['--version']).status ?? 1;
      }
    }
  } catch (e) { console.error(e.stack || e); code = 1; }
  fs.writeFileSync(file(p, 'result'), JSON.stringify({ state: code === 0 ? 'succeeded' : 'failed', exit_code: code, started_at, finished_at: new Date().toISOString() }));
  fs.unlinkSync(file(p, 'pid'));
}
if (require.main === module && providers.includes(process.argv[2])) job(process.argv[2], process.argv[3]);
module.exports = { state, start, newer };
