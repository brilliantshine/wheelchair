'use strict';

const { spawn } = require('node:child_process');
const { interopEnv } = require('./win-env');

function createUnityPrep({ detected, winEnv, now = Date.now, run = runFetch }) {
  let cached, lookup, fetchState;
  async function command() {
    if (cached && now() - cached.at < 600000) return cached.path;
    if (!lookup) lookup = (async () => {
      const result = await winEnv.ps('(Get-Command uvx.exe -ErrorAction SilentlyContinue).Source', { timeoutMs: 10000 });
      if (result.code || !result.stdout.trim()) throw new Error('uvx.exe not found');
      const path = winEnv.toLinux(result.stdout.trim());
      cached = { path, at: now() };
      return path;
    })().finally(() => { lookup = null; });
    return lookup;
  }
  return async function prepare({ poll = false } = {}) {
    if (!detected.kernel) return { command: 'uvx' };
    if (!detected.interop) return { command: null, message: 'Windows interop is off in WSL; turn it on to set up MCP for Unity.' };
    let path;
    try { path = await command(); } catch { return { command: null, message: 'Install uv on Windows first: https://docs.astral.sh/uv/getting-started/installation/' }; }
    if (!poll && (!fetchState || fetchState.state === 'failed')) {
      fetchState = { state: 'running' };
      Promise.resolve().then(() => run(path)).then(() => { fetchState = { state: 'ready' }; }, error => { fetchState = { state: 'failed', reason: error.message || String(error) }; });
    }
    return { command: path, ...(fetchState ? { fetch: { ...fetchState } } : {}) };
  };
}

function runFetch(program) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, ['--from', 'mcpforunityserver', 'mcp-for-unity', '--help'], { env: interopEnv(process.env), stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '', timedOut = false;
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4096); });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, 300000);
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); if (timedOut) reject(new Error('process timed out')); else if (code !== 0) reject(new Error(stderr.trim() || `process exited with code ${code}`)); else resolve(); });
  });
}
module.exports = { createUnityPrep };
