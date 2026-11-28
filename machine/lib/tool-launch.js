'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { validateToolJson } = require('./folder-tools');
const { toolEnv } = require('./tool-run');
const { debuglog } = require('util');
const { projectIdentity, readKeyStore, usableReason } = require('./project-keys');
const { readSharedKeys } = require('./shared-keys');
const { relay } = require('./server-relay');
const args = process.argv.slice(2); let dir, projectDir, stateDir, keyStore; const keys = [];
for (let i = 0; i < args.length; i++) { if (args[i] === '--project-dir') projectDir = args[++i]; else if (args[i] === '--tool') dir = args[++i]; else if (args[i] === '--state-dir') stateDir = args[++i]; else if (args[i] === '--key-store') keyStore = args[++i]; else if (args[i] === '--key') keys.push(args[++i]); }
if (!projectDir || projectDir.startsWith('--')) { console.error('usage: --project-dir <dir> --tool <dir>'); process.exit(1); }
let tool;
try {
  if (!dir) throw new Error('usage: --project-dir <dir> --tool <dir>');
  const file = path.join(dir, 'tool.json');
  let stat; try { stat = fs.statSync(file); } catch (e) { if (e.code === 'ENOENT') throw new Error('tool.json is missing'); throw e; }
  if (!stat.isFile()) throw new Error('tool.json is not a regular file');
  if (stat.size > 32768) throw new Error('tool.json is over 32 KiB');
  const content = fs.readFileSync(file, 'utf8');
  let value; try { value = JSON.parse(content); } catch { throw new Error('tool.json is not JSON'); }
  const result = validateToolJson(path.basename(dir), value);
  if (!result.ok) throw new Error(result.reason);
  if (result.tool.kind !== 'server') throw new Error('tool is not a server');
  tool = result.tool;
} catch (e) { console.error(`${dir ? `tool ${path.basename(dir)}: ` : ''}${e.message.replace(/[\r\n]+/g, ' ')}`); process.exit(1); }
async function start() {
const keyed = keys.length > 0;
if (keyed && debuglog('child_process').enabled) { console.error(`tool ${tool.name}: Node debug output for child processes is on; keyed tools won't run`); process.exit(1); }
if ((keys.length || tool.keys.length) && (keys.length !== tool.keys.length || !tool.keys.every(k => keys.includes(k)))) { console.error(`tool ${tool.name}: its keys changed; they are used from the next agent start (a new session, a resume or an account switch)`); process.exit(1); }
const env = toolEnv(process.env, projectDir), values = [];
if (keyed) {
  let store; try { store = keyStore === 'shared' ? await readSharedKeys(stateDir) : await readKeyStore(stateDir, await projectIdentity(projectDir)); } catch (e) { console.error(e.message); process.exit(1); }
  const missing = keys.filter(k => !Object.hasOwn(store.keys, k) || usableReason(store.keys[k]));
  if (missing.length) { console.error(`tool ${tool.name} needs ${missing.length === 1 ? 'key' : 'keys'} ${missing.join(', ')}, not set on this machine`); process.exit(1); }
  for (const k of keys) { env[k] = store.keys[k]; values.push(store.keys[k]); }
}
const program = tool.start[0].includes('/') ? path.resolve(dir, tool.start[0]) : tool.start[0];
let child;
try { child = spawn(program, tool.start.slice(1), { cwd: dir, env, detached: true, stdio: keyed ? ['pipe','pipe','pipe'] : ['pipe','pipe','inherit'] }); } catch (e) { console.error(`tool ${tool.name}: cannot start ${tool.start[0]}: ${keyed ? e.code : e.message.replace(/[\r\n]+/g, ' ')}`); process.exit(1); }
let killed = false;
function kill() { if (killed || !child.pid) return; killed = true; try { process.kill(-child.pid, 'SIGTERM'); } catch {} const reaper = spawn(process.execPath, ['-e', "setTimeout(() => { try { process.kill(-Number(process.argv[1]), 'SIGKILL'); } catch {} }, 5000)", String(child.pid)], { detached: true, stdio: 'ignore' }); reaper.on('error', () => {}); reaper.unref(); }
process.on('exit', kill);
for (const sig of ['SIGINT','SIGTERM','SIGHUP']) process.on(sig, () => { kill(); process.removeAllListeners(sig); process.kill(process.pid, sig); });
if (keyed) {
  child.on('error', e => { console.error(`tool ${tool.name}: cannot start ${tool.start[0]}: ${e.code}`); process.exit(1); });
  relay({ child, name: tool.name, values, kill, stdin: process.stdin, stdout: process.stdout, stderr: process.stderr });
  return;
}
process.stdin.pipe(child.stdin); child.stdout.pipe(process.stdout); child.stdin.on('error', () => {});
process.stdin.on('end', () => { kill(); process.exit(0); });
child.on('error', e => { console.error(`tool ${tool.name}: cannot start ${tool.start[0]}: ${e.message.replace(/[\r\n]+/g, ' ')}`); process.exit(1); });
child.on('close', (code, signal) => { kill(); if (signal) process.exit(1); else process.exit(code ?? 1); });

}
start();
