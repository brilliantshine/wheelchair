'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

function detectWsl({ procRoot = '/proc', etcRoot = '/etc' } = {}) {
  let release = '';
  let conf = '';
  try { release = fs.readFileSync(path.join(procRoot, 'sys/kernel/osrelease'), 'utf8'); } catch {}
  try { conf = fs.readFileSync(path.join(etcRoot, 'wsl.conf'), 'utf8'); } catch {}
  let section = '';
  let mount = '/mnt';
  for (const line of conf.split(/\r?\n/)) {
    const heading = line.match(/^\s*\[([^\]]+)\]/);
    if (heading) {
      section = heading[1].toLowerCase();
      continue;
    }
    const setting = line.match(/^\s*root\s*=\s*([^#;]+?)\s*$/i);
    if (section === 'automount' && setting) mount = setting[1].trim();
  }
  const interop = ['WSLInterop', 'WSLInterop-late'].some(name =>
    fs.existsSync(path.join(procRoot, 'sys/fs/binfmt_misc', name)));
  return { wsl: /microsoft/i.test(release) && interop, mount: mount.replace(/\/+$/, '') || '/' };
}

function interopEnv(baseEnv, { runRoot = '/run' } = {}) {
  const env = { ...baseEnv };
  delete env.WHEELCHAIR_SESSION_TOKEN;
  if (!env.WSL_INTEROP || !fs.existsSync(env.WSL_INTEROP)) {
    let candidates = [];
    try {
      const dir = path.join(runRoot, 'WSL');
      candidates = fs.readdirSync(dir).filter(name => name.endsWith('_interop')).flatMap(name => {
        const file = path.join(dir, name);
        try { return [[file, fs.statSync(file).mtimeMs]]; } catch { return []; }
      }).sort((a, b) => b[1] - a[1]);
    } catch {}
    if (candidates.length) env.WSL_INTEROP = candidates[0][0];
    else delete env.WSL_INTEROP;
  }
  return env;
}

function worktreeKey(linuxPath) {
  return crypto.createHash('sha256').update(path.resolve(linuxPath)).digest('hex').slice(0, 12);
}

function createWinEnv({ mount, runRoot = '/run', env: baseEnv = process.env, log = () => {} }) {
  const powershellPath = path.join(mount, 'c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe');
  const childEnv = env => interopEnv(env || baseEnv, { runRoot });

  function spawnPs(script, opts = {}) {
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    return spawn(powershellPath, ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
      { ...opts, env: childEnv(opts.env) });
  }

  function collect(child, timeoutMs, binary = false, startupError) {
    return new Promise((resolve, reject) => {
      const output = [];
      const errors = [];
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeoutMs);
      child.stdout.on('data', chunk => output.push(chunk));
      child.stderr.on('data', chunk => errors.push(chunk));
      child.on('error', error => {
        clearTimeout(timer);
        reject(startupError ? startupError(error) : error);
      });
      child.on('close', code => {
        clearTimeout(timer);
        if (timedOut) return reject(Object.assign(new Error('process timed out'), { status: 422 }));
        const stdout = Buffer.concat(output);
        resolve({ code, stdout: binary ? stdout : stdout.toString(), stderr: Buffer.concat(errors).toString() });
      });
    });
  }

  function ps(script, { timeoutMs = 60000, env } = {}) {
    const effectiveEnv = childEnv(env);
    const child = spawnPs(script, { env: effectiveEnv });
    return collect(child, timeoutMs, false, error => Object.assign(new Error(
      `failed to start PowerShell (${error.message}); WSL_INTEROP=${effectiveEnv.WSL_INTEROP || '(unset)'}; check that interop is enabled in /etc/wsl.conf, then run wsl --shutdown from Windows and reopen WSL`
    ), { status: 422 }));
  }

  function translate(value, windows) {
    if (windows) {
      const relative = path.relative(mount, value);
      const match = relative.match(/^([a-zA-Z])(?:\/(.*))?$/);
      if (match) return `${match[1].toUpperCase()}:\\${(match[2] || '').replace(/\//g, '\\')}`;
    } else {
      const match = value.match(/^([a-zA-Z]):[\\/](.*)$/);
      if (match) return path.join(mount, match[1].toLowerCase(), ...match[2].split(/[\\/]/));
    }
    const result = spawnSync('wslpath', [windows ? '-w' : '-u', value], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`wslpath failed: ${result.stderr || result.error}`);
    return result.stdout.trim();
  }

  function script(op, body) {
    return `# wc:${op} ${Buffer.from('{}').toString('base64')}\n${body}`;
  }
  let appPromise;
  let gitPromise;
  function localAppData() {
    return appPromise ||= ps(script('localappdata', '$env:LOCALAPPDATA')).then(result => {
      if (result.code) throw new Error(result.stderr);
      return result.stdout.trim();
    });
  }
  function gitExe() {
    return gitPromise ||= ps(script('gitpath', '(Get-Command git.exe -ErrorAction SilentlyContinue).Source')).then(result => {
      if (result.code || !result.stdout.trim()) {
        throw Object.assign(new Error('Git for Windows (git.exe) was not found on the Windows PATH'), { status: 422 });
      }
      return translate(result.stdout.trim(), false);
    });
  }
  async function gitRun(program, args, { cwd, env, input, timeoutMs = 60000 } = {}, win = false) {
    const effectiveEnv = childEnv({ ...baseEnv, ...env });
    if (win && env) {
      const present = (effectiveEnv.WSLENV || '').split(':').map(item => item.split('/')[0]);
      const names = Object.keys(env).filter(name => !present.includes(name));
      effectiveEnv.WSLENV = [effectiveEnv.WSLENV, ...names].filter(Boolean).join(':');
    }
    const child = spawn(program, args, { cwd, env: effectiveEnv });
    const result = collect(child, timeoutMs, true);
    child.stdin.on('error', () => {});
    child.stdin.end(input);
    return result;
  }
  const git = (args, opts) => gitRun('git', args, opts);
  const gitWin = async (args, opts) => gitRun(await gitExe(), args, opts, true);
  async function versions() {
    try {
      const [linuxResult, windowsResult] = await Promise.all([git(['--version']), gitWin(['--version'])]);
      const linux = linuxResult.stdout.toString().trim();
      const windows = windowsResult.stdout.toString().trim();
      const valid = value => {
        const match = value.match(/(\d+)\.(\d+)/);
        return match && (+match[1] > 2 || (+match[1] === 2 && +match[2] >= 43));
      };
      const ok = linuxResult.code === 0 && windowsResult.code === 0 && !!valid(linux) && !!valid(windows);
      return { linux, windows, ok, ...(!ok ? { reason: 'Linux git and Git for Windows must both be version 2.43 or newer' } : {}) };
    } catch (error) {
      log(error);
      return { linux: '', windows: '', ok: false, reason: error.message };
    }
  }
  return { powershellPath, ps, spawnPs, toWindows: p => translate(p, true), toLinux: p => translate(p, false), localAppData, gitExe, git, gitWin, versions };
}

async function copyPaths(winEnv, threadId, key) {
  const windows = path.win32.join(await winEnv.localAppData(), 'Wheelchair', 'copies', threadId, key);
  return { windows, linux: winEnv.toLinux(windows) };
}

module.exports = { detectWsl, interopEnv, worktreeKey, createWinEnv, copyPaths };
