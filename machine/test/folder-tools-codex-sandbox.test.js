'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const readline = require('node:readline');
const { makeTempSync } = require('../../test-support/run-dir');
const { writeSharedKeys } = require('../lib/shared-keys');

const found = spawnSync('sh', ['-c', 'command -v codex'], { encoding: 'utf8' });
const localCodex = path.join(os.homedir(), '.local', 'bin', 'codex');
const codex = found.status === 0 ? found.stdout.trim() : (fs.existsSync(localCodex) ? localCodex : null);
for (const kind of ['script', 'server']) test(`real Codex sandbox confines keyed ${kind} tool`, { skip: codex ? false : 'codex is not installed', timeout: 30000 }, async () => {
  const root = makeTempSync('codex-sandbox-', path.join(os.homedir(), '.cache', 'wheelchair-test-runs'));
  const worktree = path.join(root, 'worktree'), outside = path.join(root, 'outside'), state = path.join(root, 'state'), home = path.join(root, 'account');
  const dir = path.join(worktree, '.wheelchair', 'tools', 'demo');
  for (const d of [dir, outside, state, home]) fs.mkdirSync(d, { recursive: true });
  const probe = path.join(outside, 'probe'); fs.writeFileSync(probe, 'ok'); fs.unlinkSync(probe);
  const secret = 'sandboxsecret123'; await writeSharedKeys(state, { set: { TOKEN: secret } });
  const tool = { name: 'demo', description: 'sandbox test', kind, keys: ['TOKEN'], ...(kind === 'script' ? { inputs: {}, run: [process.execPath, 'tool.js'] } : { start: [process.execPath, 'tool.js'] }) };
  fs.writeFileSync(path.join(dir, 'tool.json'), JSON.stringify(tool));
  fs.writeFileSync(path.join(dir, 'tool.js'), `const fs=require('fs'); const readline=require('readline'); readline.createInterface({input:process.stdin}).on('line',line=>{ let error=''; try { fs.writeFileSync(${JSON.stringify(path.join(outside, 'forbidden'))},'bad'); } catch(e) { error=e.code; } fs.writeFileSync(process.env.WHEELCHAIR_PROJECT_DIR+'/created','ok'); const result=JSON.stringify({error,home:process.env.CODEX_HOME,key:process.env.TOKEN}); ${kind === 'script' ? 'process.stdout.write(result); process.exit(0);' : "process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:1,result})+'\\n');"} });`);
  const launcher = path.join(__dirname, '../lib', kind === 'script' ? 'tool-bridge.js' : 'tool-launch.js');
  const args = [launcher, '--project-dir', worktree, '--sandbox-cli', 'codex', '--tool', dir, '--state-dir', state, '--key-store', 'shared', '--key', 'TOKEN'];
  const child = spawn(process.execPath, args, { env: { ...process.env, PATH: `${path.dirname(codex)}:${process.env.PATH}`, CODEX_HOME: home }, stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = ''; child.stderr.on('data', b => { stderr += b; });
  const lines = readline.createInterface({ input: child.stdout });
  try {
    const response = once(lines, 'line', { signal: AbortSignal.timeout(20000) });
    child.stdin.write(JSON.stringify(kind === 'script' ? { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'demo', arguments: {} } } : { id: 1 }) + '\n');
    const [line] = await response;
    assert.ok(!line.includes(secret)); assert.match(line, /\[key\]/); assert.ok(line.includes(home), line);
    assert.match(line, /EACCES|EROFS|EPERM/, `${line} ${stderr}`);
    assert.equal(fs.readFileSync(path.join(worktree, 'created'), 'utf8'), 'ok');
    assert.equal(fs.existsSync(path.join(outside, 'forbidden')), false);
  } finally { lines.close(); child.stdin.end(); child.kill(); await once(child, 'close'); }
});
