'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const helper = require('../run-dir');
const modulePath = require.resolve('../run-dir');

function sandbox() { return helper.makeTempSync('case-'); }
function script(code, root) {
  return spawnSync(process.execPath, ['-e', `const h = require(${JSON.stringify(modulePath)}); ${code}`], { env: { ...process.env, TMPDIR: root }, encoding: 'utf8' });
}
function remaining(root) { return fs.readdirSync(root).filter(name => name.startsWith('wheelchair-test-run-')); }
function waitLine(child) {
  return new Promise((resolve, reject) => {
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; if (output.includes('\n')) resolve(output.trim()); });
    child.once('error', reject);
    child.once('exit', () => reject(new Error('child exited before ready')));
  });
}
function exited(child) { return new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal }))); }

test('normal and failing exits remove the run folder', () => {
  for (const ending of ['', 'process.exitCode = 1;', 'throw new Error("failure");']) {
    const root = sandbox();
    const result = script(`h.makeTempSync(); ${ending}`, root);
    assert.equal(result.status, ending ? 1 : 0);
    assert.deepEqual(remaining(root), []);
  }
});

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  test(`${signal} removes the folder and preserves signal termination`, async () => {
    const root = sandbox();
    const child = spawn(process.execPath, ['-e', `const h = require(${JSON.stringify(modulePath)}); h.makeTempSync(); console.log('ready'); setInterval(() => {}, 1000);`], { env: { ...process.env, TMPDIR: root }, stdio: ['ignore', 'pipe', 'pipe'] });
    await waitLine(child);
    const done = exited(child);
    child.kill(signal);
    assert.deepEqual(await done, { code: null, signal });
    assert.deepEqual(remaining(root), []);
  });
}

test('exit kills a tracked running child before removing the folder', () => {
  const root = sandbox();
  const result = script(`const { spawn } = require('node:child_process'); const c = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' }); h.trackChild(c); console.log(c.pid); process.exit(0);`, root);
  assert.equal(result.status, 0, result.stderr);
  const pid = Number(result.stdout.trim());
  assert.ok(pid > 0);
  let state;
  try { state = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ').pop()[0]; } catch {}
  assert.ok(state === undefined || state === 'Z');
  assert.deepEqual(remaining(root), []);
});

test('sweep respects owner liveness and legacy age', async () => {
  const root = sandbox();
  const sibling = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  try {
    const dead = path.join(root, 'wheelchair-test-run-dead');
    const live = path.join(root, 'wheelchair-test-run-live');
    const old = path.join(root, 'wc-doc-old');
    const young = path.join(root, 'wc-doc-young');
    for (const dir of [dead, live, old, young]) fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dead, 'owner.json'), JSON.stringify({ pid: 2147483647, start: null, children: [] }));
    fs.writeFileSync(path.join(live, 'owner.json'), JSON.stringify({ pid: sibling.pid, start: null, children: [] }));
    const past = new Date(Date.now() - 7200000);
    fs.utimesSync(old, past, past);
    const result = script('h.runDir();', root);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(dead), false);
    assert.equal(fs.existsSync(live), true);
    assert.equal(fs.existsSync(old), false);
    assert.equal(fs.existsSync(young), true);
  } finally {
    const done = exited(sibling);
    sibling.kill('SIGKILL');
    await done;
  }
});

test('custom base is created, swept and cleaned along with default root', () => {
  const root = sandbox(), base = path.join(root, 'custom', 'nested');
  fs.mkdirSync(base, { recursive: true });
  const dead = path.join(base, 'wheelchair-test-run-dead'); fs.mkdirSync(dead);
  fs.writeFileSync(path.join(dead, 'owner.json'), JSON.stringify({ pid: 2147483647, children: [] }));
  const result = script(`const base = ${JSON.stringify(base)}; const dir = h.runDir(base); h.makeTempSync('custom-', base); h.makeTempSync(); console.log(JSON.stringify({ dir, owner: require('node:fs').existsSync(require('node:path').join(dir, 'owner.json')), dead: require('node:fs').existsSync(${JSON.stringify(dead)}) })); h.cleanupNow();`, root);
  assert.equal(result.status, 0, result.stderr);
  const value = JSON.parse(result.stdout); assert.equal(value.owner, true); assert.equal(value.dead, false);
  assert.equal(fs.existsSync(value.dir), false); assert.deepEqual(remaining(root), []);
});

test('exit cleanup and sweep remove read-only trees without chmodding symlink targets', () => {
  const root = sandbox();
  const external = path.join(root, 'external-readonly');
  fs.writeFileSync(external, 'keep');
  fs.chmodSync(external, 0o444);

  const dead = path.join(root, 'wheelchair-test-run-dead-ro');
  const deadNested = path.join(dead, 'state', 'shared-tools', 'locked');
  fs.mkdirSync(deadNested, { recursive: true });
  fs.writeFileSync(path.join(dead, 'owner.json'), JSON.stringify({ pid: 2147483647, start: null, children: [] }));
  fs.writeFileSync(path.join(deadNested, 'tool.json'), '{}');
  fs.chmodSync(path.join(deadNested, 'tool.json'), 0o444);
  fs.chmodSync(deadNested, 0o555);
  fs.chmodSync(path.dirname(deadNested), 0o555);

  const orphan = path.join(root, 'wheelchair-test-run-2147483647-orphan');
  const orphanNested = path.join(orphan, 'locked');
  fs.mkdirSync(orphanNested, { recursive: true });
  fs.writeFileSync(path.join(orphanNested, 'tool.json'), '{}');
  fs.chmodSync(orphanNested, 0o555);

  const result = script(`
    const fs = require('node:fs');
    const path = require('node:path');
    const dir = h.makeTempSync('ro-');
    const nested = path.join(dir, 'outer', 'inner');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(nested, 'file.txt'), 'data');
    fs.symlinkSync(${JSON.stringify(external)}, path.join(nested, 'link'));
    fs.chmodSync(path.join(nested, 'file.txt'), 0o444);
    fs.chmodSync(nested, 0o555);
    fs.chmodSync(path.dirname(nested), 0o000);
  `, root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(dead), false);
  assert.equal(fs.existsSync(orphan), false);
  assert.deepEqual(remaining(root), []);
  assert.equal(fs.statSync(external).mode & 0o777, 0o444);
  fs.chmodSync(external, 0o644);
});
