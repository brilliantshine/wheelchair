'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const [file, cli, ...args] = process.argv.slice(2);
let keys = {};
try {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed) || !Object.values(parsed).every(value => typeof value === 'string')) throw new Error();
  keys = parsed;
} catch {
  console.error("wheelchair: project keys couldn't be loaded; starting without them");
} finally {
  try { fs.unlinkSync(file); } catch {}
}
const env = { ...process.env, ...keys };
function fail() { console.error("wheelchair: the agent couldn't be started"); process.exit(127); }
try {
  let resolved = cli;
  if (!cli.includes('/')) {
    resolved = (env.PATH || '').split(path.delimiter).map(dir => path.resolve(dir || '.', cli)).find(candidate => {
      try { fs.accessSync(candidate, fs.constants.X_OK); return fs.statSync(candidate).isFile(); } catch { return false; }
    });
  }
  if (!resolved) fail();
  fs.accessSync(resolved, fs.constants.X_OK);
  if (!fs.statSync(resolved).isFile()) fail();
  if (typeof process.execve === 'function') process.execve(resolved, [cli, ...args], env);
  else {
    const child = spawn(resolved, args, { env, stdio: 'inherit', argv0: cli });
    child.on('error', fail);
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => { try { child.kill(signal); } catch {} });
    child.on('exit', (code, signal) => {
      if (signal) { process.removeAllListeners(signal); process.kill(process.pid, signal); }
      else process.exit(code === null ? 127 : code);
    });
  }
} catch { fail(); }
