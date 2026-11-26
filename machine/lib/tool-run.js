'use strict';
const { spawn } = require('child_process');
const path = require('path');
const live = new Set();
function toolEnv(baseEnv, projectDir) { const env = { ...baseEnv, WHEELCHAIR_PROJECT_DIR: projectDir }; delete env.WHEELCHAIR_SESSION_TOKEN; return env; }
function killGroup(pid) { try { process.kill(-pid, 'SIGTERM'); } catch {} const reaper = spawn(process.execPath, ['-e', "setTimeout(() => { try { process.kill(-Number(process.argv[1]), 'SIGKILL'); } catch {} }, 5000)", String(pid)], { detached: true, stdio: 'ignore' }); reaper.on('error', () => {}); reaper.unref(); }
function killAll() { for (const pid of live) killGroup(pid); }
let installed = false;
function installExitHandlers() { if (installed) return; installed = true; process.on('exit', killAll); for (const sig of ['SIGINT','SIGTERM','SIGHUP']) process.on(sig, () => { killAll(); process.removeAllListeners(sig); process.kill(process.pid, sig); }); }
function runScript({ dir, tool, input, env }) {
  return new Promise(resolve => {
    let child, timedOut = false, stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), launchError = null;
    const program = tool.run[0].includes('/') ? path.resolve(dir, tool.run[0]) : tool.run[0];
    try { child = spawn(program, tool.run.slice(1), { cwd: dir, env, detached: true, stdio: ['pipe','pipe','pipe'] }); } catch (e) { resolve({ ok: false, text: '', code: null, signal: null, timedOut: false, truncated: false, stderr: e.message }); return; }
    if (child.pid) live.add(child.pid);
    child.stdout.on('data', b => { if (stdout.length < 2097152) stdout = Buffer.concat([stdout, b.subarray(0, 2097152 - stdout.length)]); });
    child.stderr.on('data', b => { stderr = Buffer.concat([stderr, b]).subarray(-4096); });
    child.on('error', e => { launchError = e.message; });
    child.stdin.on('error', () => {}); child.stdin.end(JSON.stringify(input));
    const timer = setTimeout(() => { timedOut = true; if (child.pid) killGroup(child.pid); }, tool.timeout_seconds * 1000);
    child.on('close', (code, signal) => { clearTimeout(timer); if (child.pid) live.delete(child.pid); const truncated = stdout.length > 1048576; const text = stdout.subarray(0, 1048576).toString('utf8') + (truncated ? '\n[output cut at 1 MiB]' : ''); resolve({ ok: !launchError && !timedOut && code === 0, text, code, signal, timedOut, truncated, stderr: launchError || stderr.toString('utf8') }); });
  });
}
module.exports = { toolEnv, runScript, killAll, installExitHandlers };
