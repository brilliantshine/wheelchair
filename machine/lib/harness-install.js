'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { providers, loadRecipes } = require('./harness-recipes');
const root = path.resolve(__dirname, '../..');
const connectors = require('../../connectors');
const dir = () => path.join(os.homedir(), '.wheelchair', 'installs');
const file = (p, ext) => path.join(dir(), `${p}.${ext}`);
function read(p, ext) { try { return JSON.parse(fs.readFileSync(file(p, ext), 'utf8')); } catch { return null; } }
function live(pid) { if (!Number.isSafeInteger(pid) || pid <= 0) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }
function state(p) {
  const pid = read(p, 'pid'), result = read(p, 'result');
  let log = ''; try { log = fs.readFileSync(file(p, 'log'), 'utf8'); } catch {}
  const tail = log.replace(/\n$/, '').split('\n').slice(-40).join('\n');
  if (pid && live(pid.pid)) return { state: 'running', exit_code: null, output_tail: tail, started_at: pid.started_at, finished_at: null, explanation: null };
  if (result) return { ...result, output_tail: tail, explanation: result.state === 'failed' ? explain(result.reason, log) : null };
  if (pid) return { state: 'failed', exit_code: null, output_tail: `${tail}${tail ? '\n' : ''}The install stopped before finishing.`, started_at: pid.started_at, finished_at: null, explanation: null };
  return { state: 'idle', exit_code: null, output_tail: tail, started_at: null, finished_at: null, explanation: null };
}
function explain(reason, log) {
  if (reason === 'timeout') return "The install took too long (over 15 minutes) and was stopped. Try again; if it keeps happening, check this machine's network.";
  if (reason !== 'recipe') return null;
  if (/ENOSPC|No space left on device/.test(log)) return 'The disk on this machine is full. Free up some space, then try again.';
  if (/EACCES|EPERM/.test(log) && /npm/.test(log)) {
    const folder = log.match(/npm (?:ERR!|error) path (.+)/)?.[1]?.trim() || 'one of its folders';
    return `npm isn't allowed to write to ${folder} on this machine (it may be owned by root from an earlier sudo npm). Fix that folder's owner, then try again.`;
  }
  if (/Could not resolve host|curl: \((?:6|7|28)\)|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|ECONNRESET|Network is unreachable/.test(log)) return "This machine couldn't reach the internet to download it. Check its network, then try again.";
  return null;
}
function stopJob(p) {
  if (state(p).state !== 'running') return false;
  process.kill(read(p, 'pid').pid, 'SIGTERM');
  return true;
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
function newer(actual, min) { const a = actual.split('.').map(Number), b = min.split('.').map(Number); for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]; return true; }
async function job(p, started_at) {
  process.on('SIGTERM', () => stop('cancelled'));
  let reason = null, current = null, stopping = null;
  const timer = setTimeout(() => stop('timeout'), Number(process.env.WHEELCHAIR_INSTALL_LIMIT_MS) || 900000);
  function stop(why) {
    if (reason) return;
    reason = why;
    if (current) {
      const { child, exited } = current;
      const signal = sig => { try { process.kill(-child.pid, sig); } catch (e) { if (e.code !== 'ESRCH') throw e; } };
      signal('SIGTERM');
      stopping = (async () => {
        let timeout;
        await Promise.race([exited, new Promise(resolve => { timeout = setTimeout(resolve, 5000); })]);
        clearTimeout(timeout);
        signal('SIGKILL');
      })();
    }
  }
  async function run(program, args, env = process.env, capture = false, quietError = false) {
    if (reason) throw new Error('stopped');
    const result = await new Promise(resolve => {
      const child = spawn(program, args, { env, detached: true, stdio: capture ? 'pipe' : 'inherit' });
      let stdout = '', stderr = '', error;
      if (capture) { child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; }); }
      let done;
      const exited = new Promise(r => { done = r; });
      current = { child, exited };
      child.on('error', e => { error = e; if (!quietError && !reason) console.error(e.message); });
      child.on('exit', () => done());
      child.on('close', status => { current = null; done(); resolve({ status: error ? null : status, stdout, stderr, error }); });
    });
    if (reason) throw new Error('stopped');
    return result;
  }
  // Parent publishes the pid before any result can be written.
  while (read(p, 'pid')?.pid !== process.pid) await new Promise(resolve => setTimeout(resolve, 10));
  let code = 1, recipeFailed = false;
  try {
    const recipe = loadRecipes()[p], manifest = connectors.byProvider(p), cli = manifest?.install.binary;
    if (!recipe) throw new Error('no recipe');
    const node = recipe.node ? await run('node', ['-e', 'process.stdout.write(process.versions.node)'], process.env, true, true) : null;
    const version = node?.status === 0 ? node.stdout.trim() : '';
    if (recipe.node && !/^\d+\.\d+\.\d+$/.test(version)) {
      console.error(`${manifest.install.label} needs Node ${recipe.node} or newer; this machine has no working node on its path. Update Node, then try again.`);
    } else if (recipe.node && !newer(version, recipe.node)) {
      console.error(`${manifest.install.label} needs Node ${recipe.node} or newer; this machine has ${version}. Update Node, then try again.`);
    } else {
      const installed = await run('/bin/sh', ['-c', recipe.command]); code = installed.status ?? 1; recipeFailed = code !== 0;
      if (code === 0 && manifest.install.sensitivity) {
        const home = os.homedir(), installedName = manifest.cli, other = connectors.list().find(m => m.install.sensitivity && m.cli !== manifest.cli)?.cli || '';
        const cleanup = await run('python3', ['-I', path.join(root, 'install/unseen.py'), root, process.env.WHEELCHAIR_CLAUDE_HOME || path.join(home, '.claude'), process.env.WHEELCHAIR_CODEX_HOME || path.join(home, '.codex'), `${installedName},`]);
        code = cleanup.status ?? 1;
        if (!code) {
          const dial = path.join(root, 'sensitivity/set.sh');
          const get = await run(dial, ['--json'], { ...process.env, WHEELCHAIR_PRESENT: other }, true);
          let level = 'default'; try { const v = JSON.parse(get.stdout).level; if (get.status === 0 && ['ask', 'default', 'high'].includes(v)) level = v; } catch {}
          const set = await run(dial, [level], { ...process.env, WHEELCHAIR_PRESENT: installedName });
          if (set.status !== 0) console.error('Warning: diagram sensitivity setup failed.');
        }
      }
      if (code === 0) {
        let resolved;
        if (manifest.install.lookup !== 'path') {
          const found = await run('sh', ['-c', `command -v ${cli}`], process.env, true);
          if (manifest.install.lookup === 'absolute') resolved = found.status === 0 ? (found.stdout.trim() || null) : null;
          else {
            const candidate = found.status === 0 ? found.stdout.trim() : manifest.install.fallbackPath.replace(/^~/, os.homedir());
            try { fs.accessSync(candidate, fs.constants.X_OK); resolved = path.resolve(candidate); } catch { resolved = null; }
          }
        } else resolved = (await run('sh', ['-c', `command -v ${cli}`], process.env, true)).status === 0 && cli;
        if (!resolved) { console.error(`Installed, but wheelchair can't find ${cli} on its path. Re-run ./install.sh from the wheelchair folder once.`); code = 1; }
        else if (manifest.install.versionArgs !== null) code = (await run(resolved, manifest.install.versionArgs)).status ?? 1;
      }
    }
  } catch (e) { if (!reason) console.error(e.stack || e); code = 1; }
  if (stopping) await stopping;
  clearTimeout(timer);
  const result = reason ? { state: reason === 'cancelled' ? 'cancelled' : 'failed', exit_code: null, reason, started_at, finished_at: new Date().toISOString() } : { state: code === 0 ? 'succeeded' : 'failed', exit_code: code, ...(recipeFailed ? { reason: 'recipe' } : {}), started_at, finished_at: new Date().toISOString() };
  fs.writeFileSync(file(p, 'result'), JSON.stringify(result));
  fs.unlinkSync(file(p, 'pid'));
}
if (require.main === module && providers.includes(process.argv[2])) job(process.argv[2], process.argv[3]);
module.exports = { state, start, stopJob, newer };
