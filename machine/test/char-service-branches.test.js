'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { MachineService } = require(process.env.CHAR_MACHINE_SERVICE || '../service');
const { makeTempSync } = require('../../test-support/run-dir');
const clis = ['claude', 'codex', 'agy', 'kimi', 'pi'];
const machine = () => new MachineService({ stateDir: makeTempSync('char-service-') });

async function serverFor(m) {
  m.authorize = async () => {};
  const server = http.createServer((req, res) => m.handle(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}

test('unknown cli reports the registry choices', async () => {
  const m = machine();
  const message = 'cli must be claude, codex, agy, kimi or pi';
  assert.throws(() => m.commandFor({ cli: 'unknown' }), { message });
  await assert.rejects(m.startNamed({ cli: 'unknown' }, 'wc-test-worker'), { message });
});

test('recovery classifies panes and retries only Pi fatal stops on the recovery path', async () => {
  const m = machine(), panes = {
    'wc-a-worker': 'ordinary unknown pane', 'wc-b-worker': 'Codex',
    'wc-c-worker': 'Antigravity CLI', 'wc-d-worker': 'Ask When Needed\ncontext: 7%',
    'wc-e-worker': 'escape interrupt\nctrl+c/ctrl+d clear/exit',
    'wc-f-worker': 'openrouter/model • provider',
    'wc-g-worker': 'Trust this folder?\n❯ Trust and continue\nExit',
    'wc-h-worker': 'unrecognized',
  };
  let live = new Set(Object.keys(panes));
  m.liveTmux = () => live;
  const kills = [];
  m.tmux = args => {
    if (args[0] === 'kill-session') { kills.push(args[2]); return { ok: true, stdout: '' }; }
    if (args[0] === 'capture-pane') return { ok: args.at(-1) !== 'wc-h-worker', stdout: panes[args.at(-1)] };
    return { ok: true, stdout: '/work' };
  };
  m.sessions['wc-existing-worker'] = { name: 'wc-existing-worker', cli: 'kimi', status: 'ready', end_reason: 'keep this reason' };
  live.add('wc-existing-worker');
  await m.recoverFromTmux();
  assert.deepEqual(Object.fromEntries(Object.keys(panes).map(n => [n, m.sessions[n].cli])), {
    'wc-a-worker': 'claude', 'wc-b-worker': 'codex', 'wc-c-worker': 'agy', 'wc-d-worker': 'kimi',
    'wc-e-worker': 'pi', 'wc-f-worker': 'pi', 'wc-g-worker': 'kimi', 'wc-h-worker': 'claude',
  });
  assert.equal(m.sessions['wc-e-worker'].end_reason, 'Lost track of this Pi session after a machine restart; restart it');
  assert.equal(m.sessions['wc-d-worker'].end_reason, 'Lost track of this Kimi Code session after a machine restart; restart it');
  assert.equal(m.sessions['wc-existing-worker'].end_reason, 'keep this reason');
  assert.deepEqual(kills, ['=wc-e-worker', '=wc-f-worker']);
  assert.equal(m.sessions['wc-e-worker'].status, 'ready');
  await m.recoverFromTmux();
  assert.deepEqual(kills, ['=wc-e-worker', '=wc-f-worker', '=wc-e-worker', '=wc-f-worker']);
  live = new Set([...live].filter(n => !['wc-e-worker', 'wc-f-worker'].includes(n)));
  await m.recoverFromTmux();
  assert.equal(m.sessions['wc-e-worker'].status, 'stopped');
  assert.equal(m.sessions['wc-f-worker'].status, 'stopped');
  await m.recoverFromTmux();
  assert.equal(kills.filter(n => n === '=wc-e-worker').length, 3);
});

test('poll retries Pi fatal stops while other tools do not enter the Pi loop', async () => {
  const m = machine(), seen = [];
  for (const cli of clis) m.sessions[`wc-${cli}-worker`] = { name: `wc-${cli}-worker`, cli, status: 'starting', end_reason: 'existing' };
  m.stopFatal = async s => { seen.push(s.cli); if (s.cli === 'pi' && seen.filter(x => x === 'pi').length === 2) s.status = 'stopped'; };
  await m.pollTurns(); await m.pollTurns(); await m.pollTurns();
  assert.deepEqual(seen, ['pi', 'kimi', 'pi', 'kimi', 'kimi']);
  assert.equal(m.sessions['wc-pi-worker'].end_reason, 'existing');
});

test('pane capture joins wrapped lines only for Pi', () => {
  const m = machine(); let args;
  m.tmux = value => { args = value; return { ok: true, stdout: 'safe' }; };
  for (const cli of clis) {
    const name = `wc-${cli}-worker`; m.sessions[name] = { name, cli };
    assert.equal(m.pane(name, true, 42), 'safe');
    assert.deepEqual(args, ['capture-pane', '-p', ...(cli === 'pi' ? ['-J'] : []), '-e', '-S', '-42', '-t', `=${name}:`]);
  }
});

test('usage-source hook records Claude and Codex and ignores the other tools', async () => {
  const m = machine(), payload = { timestamp: '2026-01-01T00:00:00Z', rate_limits: { five_hour: { used_percentage: 42, resets_at: 1800000000 } }, payload: { rate_limits: { primary: { window_minutes: 300, used_percent: 27, resets_at: 1800000000 } } } };
  const providers = { claude: 'claude', codex: 'gpt', agy: 'gemini', kimi: 'kimi', pi: 'openrouter' };
  for (const cli of clis) {
    const name = `wc-${cli}-worker`, session = m.sessions[name] = { name, cli, thread_id: 'test', status: 'ready', last_reading: { stale: true } };
    const result = await m.hook(name, { type: 'usage-source', payload }, { spooled: true });
    if (cli === 'claude' || cli === 'codex') {
      assert.equal(result.ok, true, cli);
      assert.equal(result.event.type, 'usage'); assert.equal(result.event.reading.account, `default-${providers[cli]}`);
      assert.equal(result.event.reading.five_hour.used, cli === 'claude' ? 42 : 27);
      assert.deepEqual(session.last_reading, result.event.reading);
    } else { assert.deepEqual(result, { ignored: true }); assert.deepEqual(session.last_reading, { stale: true }); }
  }
});

test('login state responses scrub keys for every tool', async () => {
  const m = machine(), web = await serverFor(m);
  try {
    for (const cli of clis) {
      const account = `test-${cli}`; m.logins[account] = { cli, dir: m.stateDir };
      let pane = 'https://accounts.google.com/sk-or-v1-synthetic123456\npaste the authorization code';
      if (cli === 'claude') pane = 'https://claude.com/sk-or-v1-synthetic123456\nPaste code here';
      if (cli === 'codex') pane = 'https://auth.openai.com/sk-or-v1-synthetic123456 ABCD-12345';
      if (cli === 'kimi') pane = 'Opening browser for Kimi device login: https://example.com/sk-or-v1-synthetic123456\npaste the URL above and enter code: ABCD';
      if (cli === 'pi') pane = 'sk-or-v1-synthetic123456\nEnter OpenRouter API key:';
      m.tmux = () => ({ ok: true, stdout: pane });
      const response = await fetch(`${web.url}/v1/logins/${account}`);
      assert.equal(response.status, 200, cli);
      const data = await response.text(); assert.doesNotMatch(data, /sk-or-v1/, cli);
      assert.equal(JSON.parse(data).state, 'waiting', cli);
    }
  } finally { await web.close(); }
});

test('launch version gates apply to Pi and Kimi and preserve their exact errors', async () => {
  const home = makeTempSync('char-version-gates-home-'), oldHome = process.env.HOME;
  process.env.HOME = home;
  try {
    for (const cli of clis) {
      const m = machine(), checked = [];
      m.checkVersion = async cli => checked.push(cli);
      m.cliStatus = name => ({ installed: true, problem: `${name} version problem` });
      m.createWorktree = async () => { throw new Error('reached worktree'); };
      await assert.rejects(m.startNamed({ cli, role: 'lead', thread_id: 'test', token: 'x' }, `wc-${cli}-lead`), { message: cli === 'pi' || cli === 'kimi' ? `${cli} version problem` : 'reached worktree' });
      assert.deepEqual(checked, cli === 'pi' || cli === 'kimi' ? [cli] : []);
      if (cli === 'pi' || cli === 'kimi') {
        m.cliStatus = () => ({ installed: false });
        await assert.rejects(m.startNamed({ cli }, `wc-${cli}-lead`), { message: cli === 'pi' ? 'Pi is not installed' : 'Kimi Code is not installed' });
      }
    }
  } finally { if (oldHome === undefined) delete process.env.HOME; else process.env.HOME = oldHome; }
  const m = machine();
  assert.equal(require('../../connectors/pi/machine').piVersionStatus('1.5.1', { logged_in: true }).problem, 'Pi 1.5.2 or newer is needed (found 1.5.1)');
  assert.equal(require('../../connectors/pi/machine').piVersionStatus('1.6.0', { logged_in: true }).warning, 'Pi 1.6.0 is newer than the version wheelchair was tested with (1.5.2). If OpenRouter agents fail, this may be why.');
  assert.equal(require('../../connectors/pi/machine').piVersionStatus(null, { logged_in: true }).warning, "Pi's version couldn't be read. If OpenRouter agents fail, this may be why.");
  assert.equal(require('../../connectors/kimi/machine').kimiVersionStatus(null, { logged_in: true }).problem, "Checking Kimi Code's version");
  assert.equal(require('../../connectors/kimi/machine').kimiVersionStatus({ output: 'kimi 2.6.2', failed: false }, { logged_in: true }).problem, 'Kimi Code 2.6.3 or newer is needed (found kimi 2.6.2)');
});

test('preflight passes account CODEX_HOME only for a directory and maps exit status', async () => {
  const root = makeTempSync('char-preflight-'), bin = path.join(root, 'bin'), log = path.join(root, 'env'); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'python3'), '#!/bin/sh\nprintf "%s\\n" "$CODEX_HOME" > "$CHAR_PREFLIGHT_LOG"\nexit "$CHAR_PREFLIGHT_EXIT"\n', { mode: 0o755 });
  const prior = { HOME: process.env.HOME, PATH: process.env.PATH, CODEX_HOME: process.env.CODEX_HOME, CHAR_PREFLIGHT_LOG: process.env.CHAR_PREFLIGHT_LOG, CHAR_PREFLIGHT_EXIT: process.env.CHAR_PREFLIGHT_EXIT };
  Object.assign(process.env, { HOME: root, PATH: `${bin}:${prior.PATH}`, CODEX_HOME: 'inherited-home', CHAR_PREFLIGHT_LOG: log });
  const m = machine(), web = await serverFor(m);
  try {
    for (const [dir, code, expected] of [[null, '0', 'inherited-home'], ['~/.wheelchair/accounts/test', '0', path.join(root, '.wheelchair/accounts/test')], [null, '1', 'inherited-home'], ['~/.wheelchair/accounts/test', '1', path.join(root, '.wheelchair/accounts/test')]]) {
      process.env.CHAR_PREFLIGHT_EXIT = code;
      const response = await fetch(`${web.url}/v1/preflight`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dir }) });
      assert.equal(response.status, code === '0' ? 200 : 409); assert.equal(fs.readFileSync(log, 'utf8'), `${expected}\n`);
    }
  } finally { await web.close(); for (const [key, value] of Object.entries(prior)) value === undefined ? delete process.env[key] : process.env[key] = value; }
});

test('launch preparation selects project keys and dropped MCP settings per tool', async () => {
  const { execFileSync } = require('node:child_process');
  const { projectIdentity, writeKeyStore } = require('../lib/project-keys');
  const { commandAsync } = require(process.env.CHAR_MACHINE_SERVICE || '../service');
  const root = makeTempSync('char-preparation-'), work = path.join(root, 'work'), state = path.join(root, 'state');
  fs.mkdirSync(work); execFileSync('git', ['init', '-q', work]);
  fs.writeFileSync(path.join(work, '.mcp.json'), JSON.stringify({ mcpServers: { local: { command: 'node', env: { KEY: '${KEY}' } }, windows: { command: '/mnt/c/tool.exe' } } }));
  const identity = await projectIdentity(work, commandAsync); await writeKeyStore(state, identity, { set: { KEY: 'secret-value' } });
  const m = new MachineService({ stateDir: state }); m.win = null; m.config = { host: '127.0.0.1', port: 1234 };
  m.threadWorktree = () => null; m.updateProjectTools = () => {};
  const adapter = { loginEnv: () => ({}), firstMessage: () => 'initial' };
  let context;
  m.launchPath = async () => ({ executable: '/resolved/kimi' });
  m.commandFor = (input, session, worktree, prompt, rolePrompt, mcp, supplied) => {
    context = supplied;
    assert.deepEqual(Object.keys(mcp.servers), ['local']);
    return { argv: [input.cli], settingsPath: path.join(state, 'settings', `${input.cli}.json`), settings: { disabledMcpjsonServers: ['existing'] } };
  };
  for (const cli of clis) {
    const input = { cli, role: 'worker' }, session = { name: `wc-${cli}-worker`, cli, token: 'token' };
    const result = await m.prepareLaunch(input, session, adapter, work, path.join(root, 'prompt'), 'role', false);
    assert.equal(context.launchExtras.kimiExecutable, cli === 'kimi' ? '/resolved/kimi' : undefined);
    const settings = JSON.parse(fs.readFileSync(path.join(state, 'settings', `${cli}.json`), 'utf8'));
    assert.deepEqual(settings.disabledMcpjsonServers, cli === 'claude' ? ['existing', 'windows'] : ['existing']);
    const envFile = path.join(state, 'session-env', `${session.name}.json`), getsKey = ['claude', 'codex'].includes(cli);
    assert.equal(fs.existsSync(envFile), getsKey, cli);
    assert.equal(result.commandText.includes('env-launch.js'), getsKey, cli);
    assert.doesNotMatch(result.commandText, /secret-value/);
    if (getsKey) { assert.deepEqual(JSON.parse(fs.readFileSync(envFile, 'utf8')), { KEY: 'secret-value' }); assert.equal(fs.statSync(envFile).mode & 0o777, 0o600); }
  }
});

test('transcript copy redacts Pi lines and preserves lines for the other tools', async () => {
  const root = makeTempSync('char-transcripts-'), m = new MachineService({ stateDir: root });
  const source = path.join(root, 'source.jsonl'), line = '{"text":"sk-or-v1-synthetic123456"}\n'; fs.writeFileSync(source, line);
  const stat = fs.statSync(source);
  for (const cli of clis) {
    const session = { name: `wc-${cli}-worker`, thread_id: cli, cli, kimi_log_id: { dev: stat.dev, ino: stat.ino } };
    const result = await m.copyTranscriptNow(session, source);
    assert.deepEqual(result.lines, [cli === 'pi' ? '{"text":"[redacted key]"}' : line.trim()]);
    assert.equal(fs.readFileSync(session.transcript_path, 'utf8'), cli === 'pi' ? '{"text":"[redacted key]"}\n' : line);
  }
});

test('status version checks retain per-tool results and version messages', async () => {
  const root = makeTempSync('char-versions-'), bin = path.join(root, 'bin'); fs.mkdirSync(bin);
  for (const [cli, version] of [['claude', 'claude 3'], ['codex', 'codex 4'], ['agy', 'agy 5'], ['kimi', 'kimi 2.6.3'], ['pi', '1.5.2']]) fs.writeFileSync(path.join(bin, cli), `#!/bin/sh\nprintf '%s\\n' '${version}'\n`, { mode: 0o755 });
  const old = process.env.PATH; process.env.PATH = `${bin}:/usr/bin:/bin`;
  try {
    const m = new MachineService({ stateDir: root });
    await m.checkVersion('pi'); await m.checkVersion('kimi');
    for (const [cli, version] of [['claude', 'claude 3'], ['codex', 'codex 4'], ['agy', 'agy 5'], ['kimi', 'kimi 2.6.3'], ['pi', '1.5.2']]) assert.deepEqual(m.cliStatus(cli, { logged_in: true }), { installed: true, logged_in: true, version }, cli);
  } finally { process.env.PATH = old; }
});

test('login starts each tool with its own executable and working directory', async () => {
  const root = makeTempSync('char-login-start-'), bin = path.join(root, 'bin'); fs.mkdirSync(bin);
  for (const cli of clis) fs.writeFileSync(path.join(bin, cli), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const prior = { HOME: process.env.HOME, PATH: process.env.PATH, KIMI_CODE_HOME: process.env.KIMI_CODE_HOME };
  Object.assign(process.env, { HOME: root, PATH: `${bin}:/usr/bin:/bin`, KIMI_CODE_HOME: path.join(root, 'kimi') });
  try {
    const m = new MachineService({ stateDir: path.join(root, 'state') }), calls = [];
    m.tmux = args => { calls.push(args); return { ok: true, stdout: '' }; };
    const accounts = { claude: 'default-claude', codex: 'default-gpt', agy: 'default-gemini', kimi: 'default-kimi', pi: 'default-openrouter' };
    for (const cli of clis) {
      assert.deepEqual(await m.startLogin({ cli, account: accounts[cli] }), { state: 'starting' });
      const launch = calls.filter(args => args[0] === 'new-session').at(-1);
      assert.equal(launch.includes('-c'), cli === 'agy');
      if (cli === 'agy') assert.equal(launch[launch.indexOf('-c') + 1], path.join(m.stateDir, 'agy-login'));
      const script = launch.at(-1);
      for (const part of ({ claude: ['claude', 'auth', 'login'], codex: ['codex', 'login', '--device-auth'], agy: ['agy'], kimi: [path.join(bin, 'kimi'), 'login', '--region', 'global'], pi: [path.join(bin, 'pi'), 'auth', 'login', 'openrouter', '--api-key'] })[cli]) assert.ok(script.includes(part), `${cli}: ${part}`);
      assert.deepEqual(calls.filter(args => args[0] === 'kill-session').at(-1), ['kill-session', '-t', cli === 'pi' ? `=wc-login-${accounts[cli]}:` : cli === 'kimi' ? `=wc-login-${accounts[cli]}` : `wc-login-${accounts[cli]}`]);
    }
  } finally { for (const [key, value] of Object.entries(prior)) value === undefined ? delete process.env[key] : process.env[key] = value; }
});
