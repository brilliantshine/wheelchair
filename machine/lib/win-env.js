'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

function detectWsl({ procRoot = '/proc', etcRoot = '/etc' } = {}) {
  let release = '', conf = '';
  try { release = fs.readFileSync(path.join(procRoot, 'sys/kernel/osrelease'), 'utf8'); } catch {}
  try { conf = fs.readFileSync(path.join(etcRoot, 'wsl.conf'), 'utf8'); } catch {}
  let section = '', mount = '/mnt';
  for (const line of conf.split(/\r?\n/)) {
    const s = line.match(/^\s*\[([^\]]+)\]/); if (s) { section = s[1].toLowerCase(); continue; }
    const m = line.match(/^\s*root\s*=\s*([^#;]+?)\s*$/i); if (section === 'automount' && m) mount = m[1].trim();
  }
  return { wsl: /microsoft/i.test(release) && ['WSLInterop', 'WSLInterop-late'].some(n => fs.existsSync(path.join(procRoot, 'sys/fs/binfmt_misc', n))), mount: mount.replace(/\/+$/, '') || '/' };
}
function interopEnv(baseEnv, { runRoot = '/run' } = {}) {
  const env = { ...baseEnv }; delete env.WHEELCHAIR_SESSION_TOKEN;
  if (!env.WSL_INTEROP || !fs.existsSync(env.WSL_INTEROP)) {
    let candidates = [];
    try { candidates = fs.readdirSync(path.join(runRoot, 'WSL')).filter(n => n.endsWith('_interop')).map(n => { const p = path.join(runRoot, 'WSL', n); return [p, fs.statSync(p).mtimeMs]; }).sort((a,b) => b[1]-a[1]); } catch {}
    if (candidates.length) env.WSL_INTEROP = candidates[0][0]; else delete env.WSL_INTEROP;
  }
  return env;
}
const worktreeKey = p => crypto.createHash('sha256').update(path.resolve(p)).digest('hex').slice(0, 12);
function createWinEnv({ mount, runRoot = '/run', env: baseEnv = process.env, log = () => {} }) {
  const powershellPath = path.join(mount, 'c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe');
  const childEnv = e => interopEnv(e || baseEnv, { runRoot });
  function spawnPs(script, opts = {}) { return spawn(powershellPath, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { ...opts, env: childEnv(opts.env) }); }
  function collect(child, timeoutMs, binary = false, startupError) {
    return new Promise((resolve, reject) => {
      const out = [], err = []; let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs || 60000);
      child.stdout.on('data', b => out.push(b)); child.stderr.on('data', b => err.push(b));
      child.on('error', e => { clearTimeout(timer); reject(startupError ? startupError(e) : e); });
      child.on('close', code => { clearTimeout(timer); if (timedOut) return reject(Object.assign(new Error('process timed out'), { status: 422 })); resolve({ code, stdout: binary ? Buffer.concat(out) : Buffer.concat(out).toString(), stderr: Buffer.concat(err).toString() }); });
    });
  }
  function ps(script, { timeoutMs = 60000, env } = {}) {
    const e = childEnv(env); const child = spawnPs(script, { env: e });
    return collect(child, timeoutMs, false, error => Object.assign(new Error(`failed to start PowerShell (${error.message}); WSL_INTEROP=${e.WSL_INTEROP || '(unset)'}; check that interop is enabled in /etc/wsl.conf, then run wsl --shutdown from Windows and reopen WSL`), { status: 422 }));
  }
  function translate(p, windows) {
    if (windows) { const rel = path.relative(mount, p); const m = rel.match(/^([a-zA-Z])\/(.*)$/); if (m && !rel.startsWith('..')) return `${m[1].toUpperCase()}:\\${m[2].replace(/\//g, '\\')}`; }
    else { const m = p.match(/^([a-zA-Z]):[\\/](.*)$/); if (m) return path.join(mount, m[1].toLowerCase(), ...m[2].split(/[\\/]/)); }
    const result = spawnSync('wslpath', [windows ? '-w' : '-u', p], { encoding: 'utf8' }); if (result.status !== 0) throw new Error(`wslpath failed: ${result.stderr || result.error}`); return result.stdout.trim();
  }
  const script = (op, body) => `# wc:${op} ${Buffer.from('{}').toString('base64')}\n${body}`;
  let appPromise, gitPromise;
  const localAppData = () => appPromise ||= ps(script('localappdata', '$env:LOCALAPPDATA')).then(r => { if (r.code) throw new Error(r.stderr); return r.stdout.trim(); });
  const gitExe = () => gitPromise ||= ps(script('gitpath', '(Get-Command git.exe -ErrorAction SilentlyContinue).Source')).then(r => { if (r.code || !r.stdout.trim()) throw Object.assign(new Error('Git for Windows (git.exe) was not found on the Windows PATH'), { status: 422 }); return translate(r.stdout.trim(), false); });
  async function gitRun(program, args, { cwd, env, input, timeoutMs = 60000 } = {}, win = false) {
    const e = childEnv({ ...baseEnv, ...env });
    if (win && env) { const names = Object.keys(env); e.WSLENV = [e.WSLENV, ...names.filter(n => !(e.WSLENV || '').split(':').some(x => x.split('/')[0] === n))].filter(Boolean).join(':'); }
    const child = spawn(program, args, { cwd, env: e }); const result = collect(child, timeoutMs, true); if (input != null) child.stdin.end(input); else child.stdin.end(); return result;
  }
  const git = (args, opts) => gitRun('git', args, opts);
  const gitWin = async (args, opts) => gitRun(await gitExe(), args, opts, true);
  async function versions() { try { const [l,w] = await Promise.all([git(['--version']), gitWin(['--version'])]); const linux = l.stdout.toString().trim(), windows = w.stdout.toString().trim(); const valid = s => { const m = s.match(/(\d+)\.(\d+)/); return m && (+m[1] > 2 || (+m[1] === 2 && +m[2] >= 43)); }; const ok = l.code === 0 && w.code === 0 && !!valid(linux) && !!valid(windows); return { linux, windows, ok, ...(!ok ? { reason: 'Linux git and Git for Windows must both be version 2.43 or newer' } : {}) }; } catch (e) { log(e); return { linux: '', windows: '', ok: false, reason: e.message }; } }
  return { powershellPath, ps, spawnPs, toWindows: p => translate(p, true), toLinux: p => translate(p, false), localAppData, gitExe, git, gitWin, versions };
}
async function copyPaths(winEnv, threadId, key) { const windows = path.win32.join(await winEnv.localAppData(), 'Wheelchair', 'copies', threadId, key); return { windows, linux: winEnv.toLinux(windows) }; }
module.exports = { detectWsl, interopEnv, worktreeKey, createWinEnv, copyPaths };
