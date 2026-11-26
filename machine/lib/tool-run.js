'use strict';
const { spawn } = require('child_process');
const path = require('path');
const { debuglog } = require('util');
const { redactCapture } = require('./key-redact');
const live = new Set();
function toolEnv(baseEnv, projectDir) { const env = { ...baseEnv, WHEELCHAIR_PROJECT_DIR: projectDir }; delete env.WHEELCHAIR_SESSION_TOKEN; return env; }
function killGroup(pid) { try { process.kill(-pid, 'SIGTERM'); } catch {} const reaper = spawn(process.execPath, ['-e', "setTimeout(() => { try { process.kill(-Number(process.argv[1]), 'SIGKILL'); } catch {} }, 5000)", String(pid)], { detached: true, stdio: 'ignore' }); reaper.on('error', () => {}); reaper.unref(); }
function killAll() { for (const pid of live) killGroup(pid); }
let installed = false;
function installExitHandlers() { if (installed) return; installed = true; process.on('exit', killAll); for (const sig of ['SIGINT','SIGTERM','SIGHUP']) process.on(sig, () => { killAll(); process.removeAllListeners(sig); process.kill(process.pid, sig); }); }
function runScript(args) {
  if (args.keys && args.keys.length) return runKeyedScript(args);
  return runKeylessScript(args);
}
function runKeyedScript({ dir, tool, input, env, keys }) {
  const refusal = { ok: false, refused: "Node debug output for child processes is on; keyed tools won't run", text: '', code: null, signal: null, timedOut: false, truncated: false, stderr: '' };
  if (debuglog('child_process').enabled) return Promise.resolve(refusal);
  return new Promise(resolve => {
    let child, pipeTimer, timedOut = false, stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), overflow = false, dropped = false, launchError = null, stdoutEnded = false, stderrEnded = false, stdoutCut = false, stderrCut = false;
    const program = tool.run[0].includes('/') ? path.resolve(dir, tool.run[0]) : tool.run[0];
    const fail = e => `cannot start ${tool.run[0]}: ${e.code}`;
    try { child = spawn(program, tool.run.slice(1), { cwd: dir, env, detached: true, stdio: ['pipe','pipe','pipe'] }); }
    catch (e) { resolve({ ok: false, text: '', code: null, signal: null, timedOut: false, truncated: false, stderr: fail(e) }); return; }
    if (child.pid) live.add(child.pid);
    child.stdout.on('data', b => { const room = 2097152 - stdout.length; if (b.length > room) overflow = true; if (room > 0) stdout = Buffer.concat([stdout, b.subarray(0, room)]); });
    child.stderr.on('data', b => { if (stderr.length + b.length > 65536) dropped = true; stderr = Buffer.concat([stderr, b]).subarray(-65536); });
    child.stdout.on('end', () => { stdoutEnded = true; });
    child.stderr.on('end', () => { stderrEnded = true; });
    child.on('error', e => { launchError = fail(e); });
    child.stdin.on('error', () => {}); child.stdin.end(JSON.stringify(input));
    const cutOpen = () => { if (!stdoutEnded) stdoutCut = true; if (!stderrEnded) stderrCut = true; };
    const timer = setTimeout(() => { timedOut = true; cutOpen(); if (child.pid) killGroup(child.pid); }, tool.timeout_seconds * 1000);
    child.on('exit', () => { pipeTimer = setTimeout(() => { cutOpen(); if (child.pid) killGroup(child.pid); child.stdout.destroy(); child.stderr.destroy(); }, 2000); });
    child.on('close', (code, signal) => {
      clearTimeout(timer); clearTimeout(pipeTimer); if (child.pid) live.delete(child.pid);
      stdout = redactCapture(stdout, keys, { cutEnd: overflow || stdoutCut });
      stderr = redactCapture(stderr, keys, { cutStart: dropped, cutEnd: stderrCut });
      const truncated = stdout.length > 1048576;
      const text = stdout.subarray(0, 1048576).toString('utf8') + (truncated ? '\n[output cut at 1 MiB]' : '');
      resolve({ ok: !launchError && !timedOut && code === 0, text, code, signal, timedOut, truncated, stderr: launchError || stderr.subarray(-4096).toString('utf8') });
    });
  });
}
function runKeylessScript({ dir, tool, input, env }) {
  return new Promise(resolve => {
    let child, pipeTimer, timedOut = false, stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), launchError = null;
    const program = tool.run[0].includes('/') ? path.resolve(dir, tool.run[0]) : tool.run[0];
    try { child = spawn(program, tool.run.slice(1), { cwd: dir, env, detached: true, stdio: ['pipe','pipe','pipe'] }); } catch (e) { resolve({ ok: false, text: '', code: null, signal: null, timedOut: false, truncated: false, stderr: e.message }); return; }
    if (child.pid) live.add(child.pid);
    child.stdout.on('data', b => { if (stdout.length < 2097152) stdout = Buffer.concat([stdout, b.subarray(0, 2097152 - stdout.length)]); });
    child.stderr.on('data', b => { stderr = Buffer.concat([stderr, b]).subarray(-4096); });
    child.on('error', e => { launchError = e.message; });
    child.stdin.on('error', () => {}); child.stdin.end(JSON.stringify(input));
    const timer = setTimeout(() => { timedOut = true; if (child.pid) killGroup(child.pid); }, tool.timeout_seconds * 1000);
    child.on('exit', () => { pipeTimer = setTimeout(() => { if (child.pid) killGroup(child.pid); child.stdout.destroy(); child.stderr.destroy(); }, 2000); });
    child.on('close', (code, signal) => { clearTimeout(timer); clearTimeout(pipeTimer); if (child.pid) live.delete(child.pid); const truncated = stdout.length > 1048576; const text = stdout.subarray(0, 1048576).toString('utf8') + (truncated ? '\n[output cut at 1 MiB]' : ''); resolve({ ok: !launchError && !timedOut && code === 0, text, code, signal, timedOut, truncated, stderr: launchError || stderr.toString('utf8') }); });
  });
}
module.exports = { toolEnv, runScript, killAll, installExitHandlers };
