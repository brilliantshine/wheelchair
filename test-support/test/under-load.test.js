'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const script = path.resolve(__dirname, '../under-load.sh');
const available = spawnSync('taskset', ['--version']).status === 0;
const options = ['--cpus', '1', '--hogs', '1'];
function run(args) { return spawnSync('bash', [script, ...options, ...args], { encoding: 'utf8' }); }
function alive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }
async function until(check, message) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const value = check();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.fail(message);
}
function children(pid) {
  const result = spawnSync('ps', ['-o', 'pid=', '--ppid', String(pid)], { encoding: 'utf8' });
  return result.stdout.trim().split(/\s+/).filter(Boolean).map(Number);
}
function start(args) {
  const child = spawn('bash', [script, ...options, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const closed = new Promise(resolve => child.on('close', (code, signal) => resolve({ code, signal, output })));
  return { child, closed };
}

test('counts passing and failing commands and pins command affinity', t => {
  if (!available) return t.skip('taskset missing');
  const pass = run(['--repeat', '2', '--', 'bash', '-c', 'taskset -pc $$']);
  assert.equal(pass.status, 0, pass.stderr);
  assert.match(pass.stdout, /under-load: pass 2 of 2/);
  const selected = pass.stdout.match(/under-load: cpus ([0-9,-]+)$/m)[1];
  const affinities = [...pass.stdout.matchAll(/current affinity list: ([0-9,-]+)$/gm)];
  assert.equal(affinities.length, 2);
  for (const affinity of affinities) assert.equal(affinity[1], selected);
  const fail = run(['--repeat', '2', '--', 'false']);
  assert.equal(fail.status, 1);
  assert.match(fail.stdout, /under-load: pass 0 of 2/);
});

test('reaps helper after normal exit', async t => {
  if (!available) return t.skip('taskset missing');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'under-load-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const marker = path.join(dir, 'ready');
  const { child, closed } = start(['--repeat', '1', '--', 'bash', '-c', 'touch "$1"; sleep .5', '_', marker]);
  await until(() => fs.existsSync(marker), 'command did not start');
  const pids = children(child.pid);
  assert.ok(pids.length >= 2, `expected helper and command, got ${pids}`);
  const result = await closed;
  assert.equal(result.code, 0, result.output);
  await until(() => pids.every(pid => !alive(pid)), 'process survived normal exit');
});

test('TERM reaps helper and command child', async t => {
  if (!available) return t.skip('taskset missing');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'under-load-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const marker = path.join(dir, 'child');
  const signalled = path.join(dir, 'signalled');
  const trapped = `${signalled}.trap`;
  const { child, closed } = start(['--repeat', '1', '--', 'bash', '-c', `bash -c 'trap "touch \"$1\"; exit" TERM; touch "$2"; while :; do sleep .05; done' _ "$2" "$3" & echo $! > "$1.tmp" && mv "$1.tmp" "$1"; trap 'wait; exit' TERM; wait`, '_', marker, signalled, trapped]);
  await until(() => fs.existsSync(marker), 'command child PID was not written');
  const descendant = Number(fs.readFileSync(marker, 'utf8'));
  assert.ok(Number.isInteger(descendant) && descendant > 0, `invalid command child PID: ${descendant}`);
  await until(() => fs.existsSync(trapped), 'command child did not install TERM trap');
  assert.ok(alive(descendant));
  const pids = children(child.pid);
  assert.ok(pids.length >= 2, `expected helper and command, got ${pids}`);
  child.kill('SIGTERM');
  const result = await closed;
  assert.notEqual(result.code, 0, result.output);
  assert.ok(fs.existsSync(signalled), 'command child did not receive TERM');
  await until(() => [...pids, descendant].every(pid => !alive(pid)), 'process survived TERM');
});
