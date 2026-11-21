'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { makeTemp } = require('../../test-support/run-dir');
const { newer } = require('../lib/harness-install');
const service = path.resolve(__dirname, '../service.js');
const delay = ms => new Promise(r => setTimeout(r, ms));

test('detached install routes persist through service restart and validate', async () => {
  const root = await makeTemp('harness-'); const bin = path.join(root, '.local/bin'); fs.mkdirSync(bin, { recursive: true });
  const recipes = path.join(root, 'recipes.json'), state = path.join(root, 'state'), secret = path.join(root, 'secret');
  fs.writeFileSync(secret, 'secret\n'); fs.mkdirSync(state); fs.writeFileSync(path.join(state, 'machine.json'), JSON.stringify({ secret_file: secret, host: '127.0.0.1', port: 0 }));
  const mark = path.join(root, 'setup');
  fs.writeFileSync(path.join(bin, 'python3'), `#!/bin/sh\necho setup >> '${mark}'\nexit 0\n`, { mode: 0o755 });
  fs.writeFileSync(recipes, JSON.stringify({ claude: `while [ ! -f "$HOME/release" ]; do sleep 0.1; done; printf '#!/bin/sh\\necho fake\\n' > "$HOME/.local/bin/claude"; chmod +x "$HOME/.local/bin/claude"`, gemini: 'exit 17', kimi: 'true' }));
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
    assert.equal(result.state, 'succeeded', result.output_tail); assert.ok(fs.existsSync(mark));
    assert.equal((await api('gemini', 'POST'))[0], 202); do { await delay(30); result = (await api('gemini'))[1]; } while (result.state === 'running'); assert.equal(result.exit_code, 17);
    assert.equal((await api('kimi', 'POST'))[0], 202); do { await delay(30); result = (await api('kimi'))[1]; } while (result.state === 'running'); assert.match(result.output_tail, /can't find kimi/);
  } finally { p.kill('SIGKILL'); await new Promise(r => p.once('exit', r)); }
});
test('full node version comparison', () => { assert.equal(newer('22.18.9', '22.19.0'), false); assert.equal(newer('22.19.0', '22.19.0'), true); assert.equal(newer('23.0.0', '22.19.0'), true); });
