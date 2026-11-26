'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { validateToolJson } = require('./folder-tools');
const { toolEnv } = require('./tool-run');
const args = process.argv.slice(2); let dir, projectDir;
for (let i = 0; i < args.length; i++) { if (args[i] === '--project-dir') projectDir = args[++i]; else if (args[i] === '--tool') dir = args[++i]; }
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
const program = tool.start[0].includes('/') ? path.resolve(dir, tool.start[0]) : tool.start[0];
let child;
try { child = spawn(program, tool.start.slice(1), { cwd: dir, env: toolEnv(process.env, projectDir), detached: true, stdio: ['pipe','pipe','inherit'] }); } catch (e) { console.error(`tool ${tool.name}: cannot start ${tool.start[0]}: ${e.message.replace(/[\r\n]+/g, ' ')}`); process.exit(1); }
let killed = false;
function kill() { if (killed || !child.pid) return; killed = true; try { process.kill(-child.pid, 'SIGTERM'); } catch {} const reaper = spawn(process.execPath, ['-e', "setTimeout(() => { try { process.kill(-Number(process.argv[1]), 'SIGKILL'); } catch {} }, 5000)", String(child.pid)], { detached: true, stdio: 'ignore' }); reaper.on('error', () => {}); reaper.unref(); }
process.on('exit', kill);
for (const sig of ['SIGINT','SIGTERM','SIGHUP']) process.on(sig, () => { kill(); process.removeAllListeners(sig); process.kill(process.pid, sig); });
process.stdin.pipe(child.stdin); child.stdout.pipe(process.stdout); child.stdin.on('error', () => {});
process.stdin.on('end', () => { kill(); process.exit(0); });
child.on('error', e => { console.error(`tool ${tool.name}: cannot start ${tool.start[0]}: ${e.message.replace(/[\r\n]+/g, ' ')}`); process.exit(1); });
child.on('close', (code, signal) => { kill(); if (signal) process.exit(1); else process.exit(code ?? 1); });
