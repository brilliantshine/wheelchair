const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const source = path.resolve(__dirname, '../full-run.sh');
const names = ['viewer-browser', 'viewer-node', 'machine', 'test-support', 'sensitivity', 'codex', 'install', 'sudo-helper'];
function fixture(t, failure = '') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'full-run-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const d of ['test-support/test', 'viewer/test', 'machine/test', 'sensitivity/test', 'codex/test', 'install/test', 'sudo-helper/test', 'bin']) fs.mkdirSync(path.join(dir, d), { recursive: true });
  fs.copyFileSync(source, path.join(dir, 'test-support/full-run.sh'));
  fs.writeFileSync(path.join(dir, 'viewer/test/a.test.js'), '');
  fs.writeFileSync(path.join(dir, 'test-support/test/a.test.js'), '');
  const stub = `#!/bin/bash\ncase "$0 $*" in\n *npm*) name=viewer-browser;;\n *viewer/test*) name=viewer-node;;\n *test-support/test*) name=test-support;;\n *machine/test*) name=machine;;\n *sensitivity/test*) name=sensitivity;;\n *codex/test*) name=codex;;\n *install/test*) name=install;;\n *) name=sudo-helper;;\nesac\nprintf '%s start %s\\n' "$name" "$(date +%s%N)" >> "$EVENTS"\ntrap 'printf "%s stopped %s\\n" "$name" "$(date +%s%N)" >> "$EVENTS"; exit 143' TERM HUP\nif [[ $name == viewer-browser ]]; then sleep \${BROWSER_SLEEP:-3} & else sleep \${OTHER_SLEEP:-1} & fi\nwait $!\nprintf '%s end %s\\n' "$name" "$(date +%s%N)" >> "$EVENTS"\n[[ $name != "$FAIL_SUITE" ]] || exit 7\n`;
  for (const file of ['bin/npm', 'bin/node', 'bin/python3', 'machine/test/run.sh', 'sensitivity/test/run.sh', 'codex/test/run.sh', 'install/test/run.sh', 'sudo-helper/test/install-test.sh']) {
    fs.writeFileSync(path.join(dir, file), stub, { mode: 0o755 });
  }
  for (const args of [['init', '-q'], ['config', 'user.email', 'test@example.com'], ['config', 'user.name', 'Test'], ['add', '.'], ['commit', '-qm', 'fixture']]) assert.equal(spawnSync('git', args, { cwd: dir }).status, 0);
  const env = { ...process.env, PATH: `${dir}/bin:${process.env.PATH}`, EVENTS: path.join(dir, 'events'), FAIL_SUITE: failure };
  return { dir, env, log: path.join(dir, 'logs') };
}
function run(f) {
  const child = spawn('bash', ['test-support/full-run.sh', f.log], { cwd: f.dir, env: f.env });
  let output = ''; child.stdout.on('data', d => output += d); child.stderr.on('data', d => output += d);
  const done = new Promise(resolve => child.on('close', (code, signal) => resolve({ code, signal, output })));
  return { child, done };
}
function events(f) { return fs.existsSync(f.env.EVENTS) ? fs.readFileSync(f.env.EVENTS, 'utf8') : ''; }
async function until(predicate, done, ms = 10000) {
  const deadline = Date.now() + ms;
  let settled = false; done.then(() => { settled = true; });
  while (!predicate() && !settled && Date.now() < deadline) await new Promise(r => setTimeout(r, 100));
  assert.ok(predicate(), 'event did not occur before deadline or process exit');
}
for (const failure of ['', 'machine', 'viewer-browser']) test(`summary and exit: ${failure || 'success'}`, async t => {
  const f = fixture(t, failure); const { done } = run(f); const result = await done;
  assert.equal(result.code, failure ? 1 : 0, result.output);
  const lines = fs.readFileSync(path.join(f.log, 'summary.txt'), 'utf8').trim().split('\n');
  assert.match(lines.shift(), /^commit [0-9a-f]{40}$/);
  assert.equal(lines.length, names.length);
  names.forEach((name, i) => assert.match(lines[i], new RegExp(`^suite ${name} exit ${name === failure ? 7 : 0} seconds \\d+$`)));
  const e = events(f).trim().split('\n').map(line => line.split(' '));
  const stamp = (name, event) => BigInt(e.find(x => x[0] === name && x[1] === event)[2]);
  assert.ok(stamp('viewer-browser', 'start') < stamp('machine', 'end') && stamp('machine', 'start') < stamp('viewer-browser', 'end'));
  for (const name of names) assert.match(result.output, new RegExp(`${name}: exit \\d+ seconds \\d+`));
});
for (const signal of ['TERM', 'HUP']) test(`${signal} stops both suites`, async t => {
  const f = fixture(t); Object.assign(f.env, { BROWSER_SLEEP: '20', OTHER_SLEEP: '20' }); const { child, done } = run(f);
  await until(() => events(f).includes('viewer-browser start') && events(f).includes('viewer-node start'), done);
  child.kill(`SIG${signal}`); const result = await done;
  assert.notEqual(result.code, 0);
  assert.match(events(f), /viewer-browser stopped/); assert.match(events(f), /viewer-node stopped/);
  assert.ok(!fs.existsSync(path.join(f.log, 'summary.txt')));
});
test('dirty tracked tree is refused', async t => {
  const f = fixture(t); fs.appendFileSync(path.join(f.dir, 'viewer/test/a.test.js'), 'dirty');
  const result = await run(f).done; assert.equal(result.code, 2); assert.match(result.output, /refusing dirty/);
});
