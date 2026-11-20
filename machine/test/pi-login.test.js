'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const pi = require('../adapters/pi'), { MachineService } = require('../service'), { makeTempSync } = require('../../test-support/run-dir');
test('Pi sign-in command, environment and dry-run screens', () => {
  const dir = makeTempSync('pi-login-'), bin = path.join(dir, 'bin'); fs.mkdirSync(bin); fs.writeFileSync(path.join(bin, 'pi'), '#!/bin/sh\n', { mode: 0o755 });
  const old = process.env.PATH; process.env.PATH = `${bin}:${old}`;
  try { assert.deepEqual(pi.loginCommand(), [path.join(bin, 'pi'), 'auth', 'login', 'openrouter', '--api-key']); } finally { process.env.PATH = old; }
  assert.deepEqual(pi.loginEnv(null), {}); assert.deepEqual(pi.loginEnv(path.join(os.homedir(), '.pi/agent')), {}); assert.deepEqual(pi.loginEnv(dir), { PI_CODING_AGENT_DIR: dir });
  const sample = name => fs.readFileSync(path.join(__dirname, '../../docs/plans/openrouter-harness/samples/screens', name), 'utf8');
  assert.equal(pi.parseLogin(sample('auth-login-1-prompt.txt')).wantsCode, true); assert.equal(pi.parseLogin(sample('auth-login-3-done.txt')), null); assert.equal(pi.loginDone(sample('auth-login-3-done.txt')), true);
});
test('Pi login state waits for exit and redacts joined pane', () => {
  const dir = makeTempSync('pi-state-'), machine = new MachineService({ stateDir: dir }); machine.logins = { work: { cli: 'pi', dir } }; let pane = 'Enter OpenRouter API key:\n'; const calls = [];
  machine.tmux = args => { calls.push(args); return { ok: true, stdout: pane }; };
  assert.equal(machine.loginState('work').wantsCode, true); pane = 'sk-or-v1-0000synthetic0000'; assert.equal(machine.loginPane('work'), '[redacted key]'); assert.ok(calls.every(a => a.includes('-J') && a.includes('=wc-login-work:')));
  fs.writeFileSync(path.join(dir, 'auth.json'), '{"openrouter":{}}'); pane = 'Saved API key for OpenRouter.\n__wc_login_exit 0'; assert.equal(machine.loginState('work').state, 'done'); pane = '__wc_login_exit 1'; assert.equal(machine.loginState('work').state, 'failed');
});
test('fake Pi completes a sign-in in an isolated tmux server without touching prefix sibling', async () => {
  const { spawnSync } = require('node:child_process'), http = require('node:http');
  const root = makeTempSync('pi-login-real-'), bin = path.join(root, 'bin'), socket = path.join(root, 'tmux.sock'); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'pi'), `#!/bin/sh
printf 'Enter OpenRouter API key: '
stty -echo
IFS= read -r value
stty echo
mkdir -p "$PI_CODING_AGENT_DIR"
if [ "$value" = 'sk-or-v1-0000synthetic0000' ]; then printf '{"openrouter":{}}' > "$PI_CODING_AGENT_DIR/auth.json"; printf '\\nSaved API key for OpenRouter. Credentials saved to %s\\n' "$PI_CODING_AGENT_DIR/auth.json"; fi
`, { mode: 0o755 });
  const old = { HOME: process.env.HOME, PATH: process.env.PATH }; process.env.HOME = root; process.env.PATH = `${bin}:${old.PATH}`;
  const tmux = (args, options = {}) => { const r = spawnSync('tmux', ['-S', socket, ...args], { encoding: 'utf8', input: options.input }); return { ok: r.status === 0, stdout: r.stdout, stderr: r.stderr }; };
  const machine = new MachineService({ stateDir: root }); machine.tmux = tmux; machine.authorize = async () => {};
  const server = http.createServer((req, res) => machine.handle(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const request = async (method, endpoint, body) => { const res = await fetch(`http://127.0.0.1:${server.address().port}${endpoint}`, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) }); return { status: res.status, body: await res.json() }; };
  const wait = async predicate => { for (let i = 0; i < 100; i++) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 20)); } assert.fail('timed out'); };
  try {
    assert.ok(tmux(['new-session', '-d', '-s', 'wc-login-work-2']).ok);
    await machine.startLogin({ account: 'work', cli: 'pi', dir: '~/.wheelchair/accounts/work' }); assert.ok(tmux(['has-session', '-t', '=wc-login-work-2']).ok);
    await wait(() => machine.loginState('work').wantsCode); const result = await request('POST', '/v1/logins/work/code', { code: 'sk-or-v1-0000synthetic0000' }); assert.equal(result.status, 200);
    await wait(() => machine.loginState('work').state === 'done'); assert.doesNotMatch(JSON.stringify(await request('GET', '/v1/logins/work/pane')), /sk-or-/);
    assert.ok(tmux(['has-session', '-t', '=wc-login-work-2']).ok); assert.equal(tmux(['list-buffers']).stdout.trim(), '');
    await machine.startLogin({ account: 'fail', cli: 'pi', dir: '~/.wheelchair/accounts/fail' }); await wait(() => machine.loginState('fail').wantsCode);
    assert.equal((await request('POST', '/v1/logins/fail/code', { code: 'invalid' })).status, 200); await wait(() => machine.loginState('fail').state === 'failed');
  } finally { tmux(['kill-server']); await new Promise(resolve => server.close(resolve)); process.env.HOME = old.HOME; process.env.PATH = old.PATH; }
});
