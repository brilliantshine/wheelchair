'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { validateToolJson } = require('./folder-tools');
const { toolEnv } = require('./tool-run');
const args = process.argv.slice(2); let dir, projectDir;
for (let i = 0; i < args.length; i++) { if (args[i] === '--project-dir') projectDir = args[++i]; else if (args[i] === '--tool') dir = args[++i]; }
let tool;
try { const file = path.join(dir, 'tool.json'), stat = fs.statSync(file); if (!stat.isFile() || stat.size > 32768) throw new Error('invalid tool.json file'); const result = validateToolJson(path.basename(dir), JSON.parse(fs.readFileSync(file, 'utf8'))); if (!result.ok) throw new Error(result.reason); if (result.tool.kind !== 'server') throw new Error('tool is not a server'); tool = result.tool; } catch (e) { console.error(e.message.replace(/[\r\n]+/g, ' ')); process.exit(1); }
const program = tool.start[0].includes('/') ? path.resolve(dir, tool.start[0]) : tool.start[0];
let child;
try { child = spawn(program, tool.start.slice(1), { cwd: dir, env: toolEnv(process.env, projectDir), detached: true, stdio: ['pipe','pipe','inherit'] }); } catch (e) { console.error(e.message.replace(/[\r\n]+/g, ' ')); process.exit(1); }
let killed = false;
function kill() { if (killed || !child.pid) return; killed = true; try { process.kill(-child.pid, 'SIGTERM'); } catch {} const reaper = spawn(process.execPath, ['-e', "setTimeout(() => { try { process.kill(-Number(process.argv[1]), 'SIGKILL'); } catch {} }, 5000)", String(child.pid)], { detached: true, stdio: 'ignore' }); reaper.on('error', () => {}); reaper.unref(); }
process.on('exit', kill);
for (const sig of ['SIGINT','SIGTERM','SIGHUP']) process.on(sig, () => { kill(); process.removeAllListeners(sig); process.kill(process.pid, sig); });
process.stdin.pipe(child.stdin); child.stdout.pipe(process.stdout); child.stdin.on('error', () => {});
process.stdin.on('end', () => { kill(); process.exit(0); });
child.on('error', e => { console.error(e.message.replace(/[\r\n]+/g, ' ')); process.exit(1); });
child.on('exit', (code, signal) => { kill(); if (signal) process.exit(1); else process.exit(code ?? 1); });
