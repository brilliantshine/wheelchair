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
  const env = { ...process.env, HOME: root, PATH: `${bin}:${process.env.PATH}`, WHEELCHAIR_HARNESS_RECIPES: recipes };
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

test('npm recipe refuses an old Node before running', async () => {
  const root = await makeTemp('harness-old-node-');
  const recipes = path.join(root, 'recipes.json'), preload = path.join(root, 'old.js');
  fs.writeFileSync(recipes, JSON.stringify({openrouter: 'touch "$HOME/ran"'}));
  fs.writeFileSync(preload, "Object.defineProperty(process.versions, 'node', {value: '22.18.9'});");
  const env = {...process.env, HOME: root, WHEELCHAIR_HARNESS_RECIPES: recipes, NODE_OPTIONS: `--require=${preload}`};
  const result = spawnSync(process.execPath, ['-e', `const h = require(${JSON.stringify(path.resolve(__dirname, '../lib/harness-install'))}); h.start('openrouter');`], {env, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  let state; for (let i = 0; i < 100; i++) { await delay(30); const f = path.join(root, '.wheelchair/installs/openrouter.result'); if (fs.existsSync(f)) { state = JSON.parse(fs.readFileSync(f)); break; } }
  assert.equal(state.state, 'failed'); assert.equal(fs.existsSync(path.join(root, 'ran')), false);
  assert.match(fs.readFileSync(path.join(root, '.wheelchair/installs/openrouter.log'), 'utf8'), /OpenRouter needs Node 22\.19\.0 or newer; this machine has 22\.18\.9\. Update Node, then try again\./);
});
