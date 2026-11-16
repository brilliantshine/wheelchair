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
