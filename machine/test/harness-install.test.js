'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { makeTemp } = require('../../test-support/run-dir');
const { newer } = require('../lib/harness-install');
const { script } = require('../lib/harness-recipes');
const service = path.resolve(__dirname, '../service.js');
const delay = ms => new Promise(r => setTimeout(r, ms));

test('detached install routes persist through service restart and validate', async () => {
  const root = await makeTemp('harness-'); const bin = path.join(root, '.local/bin'); fs.mkdirSync(bin, { recursive: true });
  const recipes = path.join(root, 'recipes.json'), state = path.join(root, 'state'), secret = path.join(root, 'secret');
  fs.writeFileSync(secret, 'secret\n'); fs.mkdirSync(state); fs.writeFileSync(path.join(state, 'machine.json'), JSON.stringify({ secret_file: secret, host: '127.0.0.1', port: 0 }));
  const mark = path.join(root, 'setup');
  fs.writeFileSync(path.join(bin, 'python3'), `#!/bin/sh\necho setup >> '${mark}'\nexit 0\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'bash'), `#!/bin/sh\ncase "$1" in */sensitivity/set.sh) echo "$WHEELCHAIR_PRESENT $2" >> '${mark}.dial'; [ "$2" = --json ] && echo '{"level":"high"}' && exit 0; exit 1;; esac\nexec /bin/bash "$@"\n`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'curl'), '#!/bin/sh\nexit 22\n', { mode: 0o755 });
  fs.writeFileSync(recipes, JSON.stringify({ openrouter: script('https://example.invalid/install.sh'), claude: `while [ ! -f "$HOME/release" ]; do sleep 0.1; done; printf '#!/bin/sh\\necho fake\\n' > "$HOME/.local/bin/claude"; chmod +x "$HOME/.local/bin/claude"`, gemini: 'exit 17', kimi: 'true' }));
  const env = { ...process.env, HOME: root, PATH: `${bin}:/usr/local/bin:/usr/bin:/bin`, WHEELCHAIR_HARNESS_RECIPES: recipes };
  // Start a service with a reserved port.
  const net = require('node:net'); const sock = net.createServer(); await new Promise(r => sock.listen(0, '127.0.0.1', r)); const port = sock.address().port; await new Promise(r => sock.close(r));
  fs.writeFileSync(path.join(state, 'machine.json'), JSON.stringify({ secret_file: secret, host: '127.0.0.1', port }));
  async function launch() { const p = spawn(process.execPath, [service, '--stateDir', state, '--host', '127.0.0.1', '--port', String(port)], { env, stdio: 'ignore' }); for (let i=0;i<100;i++) { try { await fetch(`http://127.0.0.1:${port}/v1/status`, { headers: { 'x-wheelchair-machine-secret': 'secret' } }); return p; } catch { await delay(30); } } throw Error('service did not start'); }
  async function api(provider, method='GET') { const r = await fetch(`http://127.0.0.1:${port}/v1/harnesses/${provider}/install`, { method, headers: { 'x-wheelchair-machine-secret': 'secret' } }); return [r.status, await r.json()]; }
  let p = await launch();
  try {
    assert.equal((await api('unknown'))[0], 404); assert.equal((await api('gpt', 'POST'))[1].error, 'no recipe'); assert.equal((await api('gpt'))[1].state, 'idle');
    assert.equal((await api('claude', 'POST'))[0], 202); assert.equal((await api('claude', 'POST'))[0], 409);
    p.kill('SIGKILL'); await new Promise(r => p.once('exit', r)); p = await launch(); assert.equal((await api('claude', 'POST'))[0], 409); fs.writeFileSync(path.join(root, 'release'), 'go');
    let result; for (let i=0;i<100;i++) { result = (await api('claude'))[1]; if (result.state !== 'running') break; await delay(50); }
    assert.equal(result.state, 'succeeded', result.output_tail); assert.ok(fs.existsSync(mark)); assert.match(fs.readFileSync(mark, 'utf8'), /setup/); assert.equal(fs.readFileSync(`${mark}.dial`, 'utf8'), 'codex --json\nclaude high\n'); assert.match(result.output_tail, /Warning: diagram sensitivity setup failed/); assert.ok(result.started_at && result.finished_at);
    assert.equal((await api('openrouter', 'POST'))[0], 202); do { await delay(30); result = (await api('openrouter'))[1]; } while (result.state === 'running'); assert.equal(result.state, 'failed'); assert.equal(result.exit_code, 22);
    const installDir = path.join(root, '.wheelchair/installs'); fs.writeFileSync(path.join(installDir, 'gemini.log'), 'old log'); fs.writeFileSync(path.join(installDir, 'gemini.result'), JSON.stringify({state:'succeeded'}));
    assert.equal((await api('gemini', 'POST'))[0], 202); do { await delay(30); result = (await api('gemini'))[1]; } while (result.state === 'running'); assert.equal(result.exit_code, 17); assert.equal(result.state, 'failed'); assert.doesNotMatch(result.output_tail, /old log/); assert.ok(result.started_at && result.finished_at);
    assert.equal((await api('kimi', 'POST'))[0], 202); do { await delay(30); result = (await api('kimi'))[1]; } while (result.state === 'running'); assert.match(result.output_tail, /Installed, but wheelchair can't find kimi on its path\. Re-run \.\/install\.sh from the wheelchair folder once\./);
    fs.writeFileSync(path.join(installDir, 'gpt.pid'), JSON.stringify({pid: 2147483647, started_at: 'then'})); result = (await api('gpt'))[1]; assert.equal(result.state, 'failed'); assert.equal(result.started_at, 'then'); assert.match(result.output_tail, /The install stopped before finishing\.$/);
  } finally { p.kill('SIGKILL'); await new Promise(r => p.once('exit', r)); }
});
test('full node version comparison', () => { assert.equal(newer('22.18.9', '22.19.0'), false); assert.equal(newer('22.19.0', '22.19.0'), true); assert.equal(newer('23.0.0', '22.19.0'), true); });

test('slow Kimi CLI lookup is stopped by the install limit', async () => {
  const root = await makeTemp('harness-kimi-slow-'), home = path.join(root, 'home'), bin = path.join(root, 'bin');
  fs.mkdirSync(home); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'sh'), '#!/bin/bash\nsleep 3\nexec /bin/sh "$@"\n', { mode: 0o755 });
  const recipes = path.join(root, 'recipes.json'); fs.writeFileSync(recipes, JSON.stringify({ kimi: 'true' }));
  const env = { ...process.env, HOME: home, PATH: `${bin}:/usr/local/bin:/usr/bin:/bin`, WHEELCHAIR_HARNESS_RECIPES: recipes, WHEELCHAIR_INSTALL_LIMIT_MS: '500' };
  const start = spawn(process.execPath, ['-e', `require(${JSON.stringify(path.resolve(__dirname, '../lib/harness-install'))}).start('kimi')`], { env, stdio: 'ignore' });
  await new Promise((resolve, reject) => { start.once('error', reject); start.once('exit', code => code === 0 ? resolve() : reject(new Error(`start subprocess exited ${code}`))); });
  const resultFile = path.join(home, '.wheelchair/installs/kimi.result');
  let result; const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (fs.existsSync(resultFile)) { result = JSON.parse(fs.readFileSync(resultFile, 'utf8')); break; }
    await delay(1000);
  }
  assert.ok(result, 'install did not finish within 8 seconds');
  assert.equal(result.state, 'failed'); assert.equal(result.reason, 'timeout');
});

test('missing step program reports exit code 1', async () => {
  const root = await makeTemp('harness-no-python-'), home = path.join(root, 'home'), bin = path.join(root, 'bin');
  fs.mkdirSync(home); fs.mkdirSync(bin);
  const recipes = path.join(root, 'recipes.json'); fs.writeFileSync(recipes, JSON.stringify({ claude: 'true' }));
  const env = { ...process.env, HOME: home, PATH: bin, WHEELCHAIR_HARNESS_RECIPES: recipes };
  const start = spawn(process.execPath, ['-e', `require(${JSON.stringify(path.resolve(__dirname, '../lib/harness-install'))}).start('claude')`], { env, stdio: 'ignore' });
  await new Promise((resolve, reject) => { start.once('error', reject); start.once('exit', code => code === 0 ? resolve() : reject(new Error(`start subprocess exited ${code}`))); });
  const resultFile = path.join(home, '.wheelchair/installs/claude.result');
  let result; const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (fs.existsSync(resultFile)) { result = JSON.parse(fs.readFileSync(resultFile, 'utf8')); break; }
    await delay(1000);
  }
  assert.ok(result, 'install did not finish within 8 seconds');
  assert.equal(result.state, 'failed'); assert.equal(result.exit_code, 1);
});

for (const [version, expected] of [['20.19.0', 'failed'], ['22.19.0', 'succeeded'], ['invalid', 'failed']]) {
  test(`npm recipe checks PATH Node ${version}`, async () => {
    const root = await makeTemp('harness-path-node-');
    const bin = path.join(root, '.local/bin'); fs.mkdirSync(bin, { recursive: true });
    const recipes = path.join(root, 'recipes.json');
    fs.writeFileSync(path.join(bin, 'node'), `#!/bin/sh\n[ "$1" = -e ] && printf '%s' '${version}'\n`, { mode: 0o755 });
    fs.writeFileSync(recipes, JSON.stringify({openrouter: `touch "$HOME/ran"; printf '#!/bin/sh\\nexit 0\\n' > "$HOME/.local/bin/pi"; chmod +x "$HOME/.local/bin/pi"`}));
    const env = {...process.env, HOME: root, PATH: `${bin}:/usr/local/bin:/usr/bin:/bin`, WHEELCHAIR_HARNESS_RECIPES: recipes};
    const result = spawnSync(process.execPath, ['-e', `const h = require(${JSON.stringify(path.resolve(__dirname, '../lib/harness-install'))}); h.start('openrouter');`], {env, encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    let state; for (let i = 0; i < 100; i++) { await delay(30); const f = path.join(root, '.wheelchair/installs/openrouter.result'); if (fs.existsSync(f)) { state = JSON.parse(fs.readFileSync(f)); break; } }
    assert.equal(state.state, expected);
    assert.equal(fs.existsSync(path.join(root, 'ran')), expected === 'succeeded');
    if (expected === 'failed') {
      const found = version === 'invalid' ? 'no working node on its path' : version;
      assert.equal(fs.readFileSync(path.join(root, '.wheelchair/installs/openrouter.log'), 'utf8').trim(), `Pi (OpenRouter) needs Node 22.19.0 or newer; this machine has ${found}. Update Node, then try again.`);
    }
  });
}

test('failure explanations use the full log and recipe reason', async () => {
  const root = await makeTemp('harness-explain-');
  const dir = path.join(root, '.wheelchair/installs'); fs.mkdirSync(dir, { recursive: true });
  const modulePath = path.resolve(__dirname, '../lib/harness-install');
  function check(log, reason) {
    fs.writeFileSync(path.join(dir, 'gemini.log'), log);
    fs.writeFileSync(path.join(dir, 'gemini.result'), JSON.stringify({ state: 'failed', reason }));
    const r = spawnSync(process.execPath, ['-e', `console.log(JSON.stringify(require(${JSON.stringify(modulePath)}).state('gemini')))`], { env: { ...process.env, HOME: root }, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout).explanation;
  }
  const disk = 'The disk on this machine is full. Free up some space, then try again.';
  for (const pattern of ['ENOSPC', 'No space left on device']) assert.equal(check(pattern + '\n' + 'later\n'.repeat(50), 'recipe'), disk);
  for (const pattern of ['EACCES', 'EPERM']) {
    assert.equal(check(`${pattern}\nnpm ERR! path /some/folder`, 'recipe'), "npm isn't allowed to write to /some/folder on this machine (it may be owned by root from an earlier sudo npm). Fix that folder's owner, then try again.");
    assert.match(check(`${pattern} npm`, 'recipe'), /write to one of its folders/);
  }
  for (const pattern of ['Could not resolve host', 'curl: (6)', 'curl: (7)', 'curl: (28)', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'Network is unreachable']) assert.equal(check(pattern, 'recipe'), "This machine couldn't reach the internet to download it. Check its network, then try again.");
  assert.equal(check('ENOSPC EACCES npm ERR! path /x ENOTFOUND', 'recipe'), disk);
  assert.equal(check('ENOTFOUND', undefined), null); assert.equal(check('unknown', 'recipe'), null);
  assert.match(check('ENOSPC', 'timeout'), /took too long/);
});

test('cancel and timeout stop recipe groups, including after restart', { timeout: 40000 }, async () => {
  const root = await makeTemp('harness-stop-'), state = path.join(root, 'state'), secret = path.join(root, 'secret'), recipes = path.join(root, 'recipes.json');
  fs.mkdirSync(state); fs.writeFileSync(secret, 'secret\n');
  const net = require('node:net'), sock = net.createServer(); await new Promise(r => sock.listen(0, '127.0.0.1', r)); const port = sock.address().port; await new Promise(r => sock.close(r));
  fs.writeFileSync(path.join(state, 'machine.json'), JSON.stringify({ secret_file: secret, host: '127.0.0.1', port }));
  const env = { ...process.env, HOME: root, WHEELCHAIR_HARNESS_RECIPES: recipes, WHEELCHAIR_INSTALL_LIMIT_MS: '15000' };
  async function launch() { const p = spawn(process.execPath, [service, '--stateDir', state, '--host', '127.0.0.1', '--port', String(port)], { env, stdio: 'ignore' }); for (let i = 0; i < 200; i++) { try { await fetch(`http://127.0.0.1:${port}/v1/status`, { headers: { 'x-wheelchair-machine-secret': 'secret' } }); return p; } catch { await delay(20); } } throw Error('service did not start'); }
  async function api(method = 'GET', provider = 'gemini') { const r = await fetch(`http://127.0.0.1:${port}/v1/harnesses/${provider}/install`, { method, headers: { 'x-wheelchair-machine-secret': 'secret' } }); return [r.status, await r.json()]; }
  async function waitFor(fn, ms = 8000) { const end = Date.now() + ms; while (Date.now() < end) { const value = await fn(); if (value) return value; await delay(30); } throw Error('timed out waiting'); }
  let p = await launch();
  try {
    assert.equal((await api('DELETE'))[0], 409); assert.equal((await api('DELETE', 'unknown'))[0], 404);
    for (const mode of ['cancel', 'restart', 'timeout']) {
      if (mode === 'timeout') { p.kill('SIGKILL'); await new Promise(r => p.once('exit', r)); env.WHEELCHAIR_INSTALL_LIMIT_MS = '500'; p = await launch(); }
      const marker = path.join(root, 'marker'), pidfile = path.join(root, 'child');
      try { fs.unlinkSync(marker); } catch {} try { fs.unlinkSync(pidfile); } catch {}
      // The child publishes its marker only after installing its TERM trap.
      fs.writeFileSync(recipes, JSON.stringify({ gemini: `trap 'wait $kid; exit' TERM; sh -c 'trap "" TERM; echo $$ > "$HOME/child"; touch "$HOME/marker"; exec sleep 60' & kid=$!; wait $kid` }));
      assert.equal((await api('POST'))[0], 202); await waitFor(() => fs.existsSync(marker));
      const child = Number(fs.readFileSync(pidfile, 'utf8'));
      if (mode === 'restart') { p.kill('SIGKILL'); await new Promise(r => p.once('exit', r)); p = await launch(); }
      if (mode !== 'timeout') {
        assert.deepEqual(await api('DELETE'), [202, { state: 'cancelling' }]);
        assert.equal((await api())[1].state, 'running'); assert.equal((await api('POST'))[0], 409);
      }
      const result = await waitFor(async () => { const body = (await api())[1]; return body.state !== 'running' && body; });
      assert.equal(result.state, mode === 'timeout' ? 'failed' : 'cancelled'); assert.equal(result.reason, mode === 'timeout' ? 'timeout' : 'cancelled');
      if (mode === 'timeout') assert.match(result.explanation, /took too long/); else assert.equal(result.explanation, null);
      await waitFor(() => { try { process.kill(child, 0); return false; } catch (e) { return e.code === 'ESRCH'; } });
    }
    fs.writeFileSync(recipes, JSON.stringify({ gemini: 'exit 17' })); assert.equal((await api('POST'))[0], 202);
    const result = await waitFor(async () => { const body = (await api())[1]; return body.state !== 'running' && body; }); assert.equal(result.reason, 'recipe');
  } finally { p.kill('SIGKILL'); await new Promise(r => p.once('exit', r)); }
});
