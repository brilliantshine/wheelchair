'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempSync } = require('../../test-support/run-dir');
const kimi = require('../adapters/kimi');
const { MachineService } = require('../service');
function fixture() {
  const dir = makeTempSync('kimi-'); fs.mkdirSync(path.join(dir, 'credentials'));
  fs.writeFileSync(path.join(dir, 'credentials', 'dummy.json'), '{}');
  fs.writeFileSync(path.join(dir, 'config.toml'), `default_model = "kimi-code/k3"\n[services.search.oauth]\nkey = "oauth/wrong"\n[providers."managed:kimi-code".oauth]\noauth_host = "https://auth.kimi.ai"\nkey = "oauth/dummy"\n[models."kimi-code/k3"]\nsupport_efforts = [ "low", "high", "max" ]\n[models."kimi-code/light"]\nmodel = "light"\n`); return dir;
}
test('Kimi config, authentication, region, and effort', () => {
  const dir = fixture(); assert.deepEqual(kimi.loginStatus(dir), { logged_in: true, authenticated: true });
  assert.deepEqual(kimi.command({}, { effort: 'medium' }, '', { accountDir: dir }).env, { KIMI_MODEL_THINKING_EFFORT: 'high' });
  assert.equal(kimi.command({ model: 'kimi-code/light' }, { effort: 'max' }, '', { accountDir: dir }).env, undefined);
  const file = path.join(dir, 'config.toml'); fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('auth.kimi.ai', 'auth.kimi.com'));
  assert.match(kimi.loginStatus(dir).problem, /China/);
  fs.appendFileSync(file, '\nvalue = """\n[providers."managed:kimi-code".oauth]\n"""\n');
  assert.equal(kimi.loginStatus(dir).authenticated, true); assert.match(kimi.loginStatus(dir).problem, /multi-line/);
  fs.unlinkSync(file); fs.mkdirSync(file); assert.match(kimi.loginStatus(dir).problem, /can't be read/);
  assert.deepEqual(kimi.loginStatus(makeTempSync('kimi-empty-')), { logged_in: false, authenticated: false });
});
test('Kimi prompts and role message', () => {
  assert.deepEqual(kimi.answerPrompts({}, 'Trust this folder?\n❯ Trust and continue'), { step: 'trust', keys: ['Enter'] });
  assert.deepEqual(kimi.answerPrompts({}, 'Trust this folder?\n❯ Exit'), { step: 'trust-select', keys: ['Up'] });
  assert.match(kimi.firstMessage({ role: 'worker' }, '/prompt', 'wc-name'), /Session: wc-name/);
  assert.deepEqual(kimi.parseLogin('Opening browser for Kimi device login: https://kimi.ai/device\npaste the URL above and enter code: ABCD'), { url: 'https://kimi.ai/device', code: 'ABCD', wantsCode: false });
});
test('Kimi login results persist and require successful exit', () => {
  const dir = fixture(); const machine = Object.create(MachineService.prototype); machine.logins = { team: { cli: 'kimi', dir } };
  machine.tmux = args => { assert.equal(args.at(-1), '=wc-login-team:'); return { ok: true, stdout: '__wc_login_exit 0' }; };
  assert.equal(machine.loginState('team').state, 'done'); machine.tmux = () => ({ ok: false }); assert.equal(machine.loginState('team').state, 'done');
  machine.logins.team = { cli: 'kimi', dir }; machine.tmux = () => ({ ok: true, stdout: '__wc_login_exit 1' }); assert.equal(machine.loginState('team').state, 'failed');
  machine.logins.team = { cli: 'kimi', dir }; machine.tmux = () => ({ ok: false }); machine.liveTmux = () => null; assert.equal(machine.loginState('team').state, 'waiting');
});
test('version floor follows the resolved binary and its mtime', () => {
  const dir = makeTempSync('kimi-bin-'), file = path.join(dir, 'kimi'), old = process.env.PATH;
  try {
    fs.writeFileSync(file, '#!/bin/sh\necho 2.6.2\n', { mode: 0o755 }); process.env.PATH = `${dir}:${old}`;
    const machine = Object.create(MachineService.prototype);
    assert.match(machine.cliStatus('kimi', { logged_in: true }).problem, /found 2.6.2/);
    fs.writeFileSync(file, '#!/bin/sh\necho 2.6.3\n'); fs.utimesSync(file, new Date(), new Date(Date.now() + 2000));
    assert.equal(machine.cliStatus('kimi', { logged_in: true }).logged_in, true);
    assert.equal(kimi.loginCommand()[0], file); assert.equal(kimi.command({}, {}, '', { accountDir: dir }).argv[0], file);
  } finally { process.env.PATH = old; }
});

test('config reader rejects untrusted files and ignores service oauth', t => {
  const dir = fixture(), file = path.join(dir, 'config.toml');
  const config = kimi.readConfig(dir);
  assert.equal(config.key, 'oauth/dummy');
  assert.deepEqual(config.models, { 'kimi-code/k3': ['low', 'high', 'max'] });
  assert.deepEqual(kimi.readConfig(makeTempSync('kimi-empty-')), { models: {} });
  fs.appendFileSync(file, '\ntext = """\n[providers."managed:kimi-code".oauth]\nkey = "oauth/fake"\n"""\n');
  assert.match(kimi.readConfig(dir).problem, /multi-line/);
  assert.deepEqual(kimi.loginStatus(dir), { logged_in: false, authenticated: true, problem: "Kimi Code's config.toml has multi-line strings wheelchair can't read" });
  if (process.getuid?.() !== 0) {
    fs.chmodSync(file, 0); assert.match(kimi.readConfig(dir).problem, /can't be read/); fs.chmodSync(file, 0o600);
  } else t.diagnostic('chmod unreadable check skipped as root');
});

test('China or absent oauth host prevents eligibility despite authentication', () => {
  const dir = fixture(), file = path.join(dir, 'config.toml'), original = fs.readFileSync(file, 'utf8');
  for (const host of ['https://auth.kimi.com', null]) {
    fs.writeFileSync(file, host ? original.replace('https://auth.kimi.ai', host) : original.replace('oauth_host = "https://auth.kimi.ai"', ''));
    assert.deepEqual(kimi.loginStatus(dir), { authenticated: true, logged_in: false, problem: "signed in to Kimi's China region; log in again" });
  }
});

test('launch effort mapping and exact role message', () => {
  const dir = fixture();
  for (const [effort, mapped] of Object.entries({ low: 'low', medium: 'high', high: 'high', xhigh: 'max', max: 'max' })) {
    const built = kimi.command({}, { effort, permission_mode: 'bypass' }, '', { accountDir: dir });
    assert.deepEqual(built.argv.slice(1), ['--auto']);
    assert.deepEqual(built.env, { KIMI_MODEL_THINKING_EFFORT: mapped });
  }
  const built = kimi.command({ model: 'kimi-code/light' }, { effort: 'max' }, '', { accountDir: dir });
  assert.deepEqual(built.argv.slice(1), ['--yolo', '--model', 'kimi-code/light']); assert.equal(built.env, undefined);
  const agy = require('../adapters/agy');
  const input = { role: 'worker', brief: 'Do it' };
  assert.equal(kimi.firstMessage(input, '/prompt', 'wc-test'), agy.firstMessage(input, '/prompt').replace('\n', '\nSession: wc-test\n'));
});

test('ready requires prompt and footer without trust screen', () => {
  assert.equal(kimi.readyText({}, '│ >\ncontext: 10%'), true);
  for (const pane of ['│ >', 'context: 10%', '│ >\ncontext: 10%\nTrust this folder?']) assert.equal(kimi.readyText({}, pane), false);
  assert.equal(kimi.answerPrompts({}, 'normal text'), null);
  assert.equal(kimi.promptText('Please approve the design'), false);
});

test('login state distinguishes exit and liveness cases', () => {
  const dir = fixture(), machine = Object.create(MachineService.prototype);
  machine.logins = { team: { cli: 'kimi', dir } };
  const poll = (capture, live) => { machine.logins.team = { cli: 'kimi', dir }; machine.tmux = () => capture; machine.liveTmux = () => live; return machine.loginState('team'); };
  assert.equal(poll({ ok: false }, new Set(['wc-login-team'])).state, 'waiting');
  assert.equal(poll({ ok: false }, null).state, 'waiting');
  assert.equal(poll({ ok: false }, new Set(['wc-login-team-backup'])).state, 'failed');
  assert.equal(poll({ ok: true, stdout: '__wc_login_exit 1' }, null).state, 'failed');
  fs.unlinkSync(path.join(dir, 'credentials', 'dummy.json'));
  assert.equal(poll({ ok: true, stdout: '__wc_login_exit 0' }, null).state, 'failed');
});

test('recovery recognizes Kimi footer and prompt', async () => {
  const machine = Object.create(MachineService.prototype); machine.sessions = {};
  machine.liveTmux = () => new Set(['wc-test-worker']);
  machine.tmux = args => ({ ok: true, stdout: args[0] === 'capture-pane' ? '│ >\ncontext: 10%' : '/tmp' });
  machine.persistSessions = async () => {};
  await machine.recoverFromTmux(); assert.equal(machine.sessions['wc-test-worker'].cli, 'kimi');
});

test('effective login home and executable fallback use absolute paths', () => {
  const root = makeTempSync('kimi-home-'), oldHome = process.env.HOME, oldPath = process.env.PATH, oldKimi = process.env.KIMI_CODE_HOME;
  try {
    const file = path.join(root, '.kimi-code/bin/kimi'); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, '#!/bin/sh\necho 2.6.3\n', { mode: 0o755 });
    process.env.HOME = root; process.env.PATH = '/usr/bin:/bin'; process.env.KIMI_CODE_HOME = 'relative-kimi-home';
    assert.equal(kimi.resolveCli(), file);
    assert.deepEqual(kimi.loginCommand(), [file, 'login', '--region', 'global']);
    assert.deepEqual(kimi.loginEnv(null), { KIMI_CODE_HOME: path.resolve('relative-kimi-home') });
    assert.deepEqual(kimi.loginEnv(root), { KIMI_CODE_HOME: root });
  } finally {
    process.env.HOME = oldHome; process.env.PATH = oldPath;
    if (oldKimi === undefined) delete process.env.KIMI_CODE_HOME; else process.env.KIMI_CODE_HOME = oldKimi;
  }
});

test('new login clears previous result and uses exact target', async () => {
  const machine = Object.create(MachineService.prototype), calls = [];
  machine.logins = { 'default-kimi': { cli: 'kimi', dir: null, result: { state: 'done' } } };
  machine.tmux = args => { calls.push(args); return { ok: true, stdout: '' }; };
  await machine.startLogin({ account: 'default-kimi', cli: 'kimi' });
  assert.equal(machine.logins['default-kimi'].result, undefined);
  assert.deepEqual(calls[0], ['kill-session', '-t', '=wc-login-default-kimi']);
  machine.loginPane('default-kimi'); machine.loginState('default-kimi');
  assert.deepEqual(calls.slice(2).map(args => args.at(-1)), ['=wc-login-default-kimi:', '=wc-login-default-kimi:']);
});

test('version cache checks semver and invalidates when mtime changes', async () => {
  const dir = makeTempSync('kimi-versions-'), file = path.join(dir, 'kimi'), count = path.join(dir, 'count'), old = process.env.PATH;
  const machine = Object.create(MachineService.prototype);
  try {
    process.env.PATH = `${dir}:${old}`;
    let tick = Date.now();
    const version = output => { fs.writeFileSync(file, `#!/bin/sh\necho hit >> '${count}'\necho '${output}'\n`, { mode: 0o755 }); tick += 2000; fs.utimesSync(file, tick / 1000, tick / 1000); };
    version('2.6.2'); assert.equal(machine.cliStatus('kimi').problem, 'Kimi Code 2.6.3 or newer is needed (found 2.6.2)');
    machine.cliStatus('kimi'); assert.equal(fs.readFileSync(count, 'utf8').trim().split('\n').length, 1);
    version('unknown'); assert.match(machine.cliStatus('kimi').problem, /found unknown/);
    for (const v of ['2.6.3', '2.10.0']) { version(v); assert.equal(machine.cliStatus('kimi').problem, undefined); }
    version('2.6.2'); await assert.rejects(machine.startNamed({ cli: 'kimi' }, 'wc-test-worker'), /Kimi Code 2.6.3 or newer is needed \(found 2.6.2\)/);
  } finally { process.env.PATH = old; }
});

test('seed writes account metadata without copying credentials', () => {
  const root = makeTempSync('kimi-seed-'), old = process.env.KIMI_CODE_HOME, source = fixture(), target = path.join(root, 'account');
  try {
    process.env.KIMI_CODE_HOME = source; kimi.seed(target, 'team');
    assert.equal(JSON.parse(fs.readFileSync(path.join(target, 'wheelchair-account.json'))).id, 'team');
    assert.equal(fs.existsSync(path.join(target, 'credentials')), false);
  } finally { if (old === undefined) delete process.env.KIMI_CODE_HOME; else process.env.KIMI_CODE_HOME = old; }
});

test('service launch and login include absolute home and executable', async () => {
  const root = makeTempSync('kimi-service-'), bin = path.join(root, 'bin'), log = path.join(root, 'tmux.log');
  fs.mkdirSync(bin); const old = { PATH: process.env.PATH, KIMI_CODE_HOME: process.env.KIMI_CODE_HOME };
  const file = path.join(bin, 'kimi'); fs.writeFileSync(file, '#!/bin/sh\necho 2.6.3\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'systemd-run'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'tmux'), `#!/bin/sh\nprintf '%s\\n' "$*" >> '${log}'\n`, { mode: 0o755 });
  try {
    process.env.PATH = `${bin}:${old.PATH}`; process.env.KIMI_CODE_HOME = path.relative(process.cwd(), fixture());
    const machine = Object.create(MachineService.prototype);
    Object.assign(machine, { stateDir: root, config: { host: '127.0.0.1', port: 0 }, sessions: {}, logins: {}, cancelledStarts: new Set(), startingNames: new Map(), startingBranches: new Set() });
    machine.createWorktree = async () => ({ worktree: root });
    machine.persistSessions = async () => {}; machine.checkReady = async () => {};
    const input = { cli: 'kimi', role: 'worker', thread_id: 'test', token: 'token', brief: 'brief', role_prompt: 'rules', effort: 'medium', permission_mode: 'bypass' };
    const session = await machine.start(input);
    await machine.startLogin({ account: 'default-kimi', cli: 'kimi' });
    const lines = fs.readFileSync(log, 'utf8').split('\n');
    const launch = lines.find(line => line.includes('new-session') && line.includes('wc-test-worker'));
    const login = lines.find(line => line.includes('new-session') && line.includes('wc-login-default-kimi'));
    for (const line of [launch, login]) { assert.ok(line.includes(`KIMI_CODE_HOME=${path.resolve(process.env.KIMI_CODE_HOME)}`)); assert.ok(line.includes(file)); }
    assert.ok(launch.indexOf('KIMI_MODEL_THINKING_EFFORT=high') > launch.indexOf('KIMI_CODE_HOME='));
    assert.match(session.pending_initial, /^\[wc:role\] Role: worker\nSession: wc-test-worker\n/);
    assert.equal(session.account_dir, null);
  } finally {
    process.env.PATH = old.PATH; if (old.KIMI_CODE_HOME === undefined) delete process.env.KIMI_CODE_HOME; else process.env.KIMI_CODE_HOME = old.KIMI_CODE_HOME;
  }
});

test('service login endpoints use exact targets for prefix sibling and stale requests', async () => {
  const root = makeTempSync('kimi-http-'), secret = path.join(root, 'secret'), http = require('node:http'); fs.writeFileSync(secret, 'secret');
  const probe = http.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const machine = new MachineService({ stateDir: root, host: '127.0.0.1', port, secretFile: secret });
  const calls = []; machine.tmux = args => { calls.push(args); return { ok: true, stdout: '' }; };
  await machine.listen();
  try {
    machine.logins.team = { cli: 'kimi', dir: fixture() }; machine.logins['team-backup'] = { cli: 'kimi', dir: fixture() };
    const request = async (endpoint, method = 'GET', body) => {
      const response = await fetch(`http://127.0.0.1:${port}/v1/logins/team${endpoint}`, { method, headers: { 'x-wheelchair-machine-secret': 'secret', 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      assert.equal(response.status, 200);
    };
    await request('/pane'); await request(''); await request('/keys', 'POST', { keys: 'a' }); await request('/code', 'POST', { code: 'abc' });
    const targeted = calls.filter(args => ['capture-pane', 'send-keys', 'paste-buffer'].includes(args[0]));
    assert.equal(targeted.length, 5);
    for (const args of targeted) assert.equal(args[args.indexOf('-t') + 1], '=wc-login-team:');
    assert.ok(calls.some(args => args[0] === 'paste-buffer'));
    machine.tmux = args => { calls.push(args); return { ok: false, stdout: '' }; };
    const stale = await fetch(`http://127.0.0.1:${port}/v1/logins/team/keys`, { method: 'POST', headers: { 'x-wheelchair-machine-secret': 'secret', 'content-type': 'application/json' }, body: JSON.stringify({ keys: 'x' }) });
    assert.equal(stale.status, 409); assert.equal(calls.at(-1)[2], '=wc-login-team:');
  } finally { await new Promise(resolve => machine.server.close(resolve)); }
});

test('status lists multiple Kimi accounts and version problem suppresses account problems', () => {
  const root = makeTempSync('kimi-status-'), oldHome = process.env.HOME, oldPath = process.env.PATH, oldKimi = process.env.KIMI_CODE_HOME;
  try {
    process.env.HOME = root; delete process.env.KIMI_CODE_HOME;
    const bin = path.join(root, 'bin'); fs.mkdirSync(bin); fs.writeFileSync(path.join(bin, 'kimi'), '#!/bin/sh\necho 2.6.2\n', { mode: 0o755 });
    fs.symlinkSync('/bin/sh', path.join(bin, 'sh'));
    for (const cli of ['claude', 'codex', 'agy']) fs.writeFileSync(path.join(bin, cli), '#!/bin/sh\necho test\n', { mode: 0o755 });
    process.env.PATH = bin;
    for (const id of ['team', 'team-backup']) {
      const dir = path.join(root, '.wheelchair/accounts', id); fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'wheelchair-account.json'), JSON.stringify({ id, cli: 'kimi' }));
      fs.writeFileSync(path.join(dir, 'config.toml'), 'value = """\n');
    }
    const machine = Object.create(MachineService.prototype); machine.sessions = {}; machine.liveTmux = () => new Set();
    const status = machine.status(); const entries = status.accounts.filter(a => a.cli === 'kimi');
    assert.equal(entries.length, 3); assert.match(status.kimi.problem, /found 2.6.2/);
    for (const entry of entries) { assert.equal(entry.logged_in, false); assert.equal(entry.problem, undefined); }
  } finally {
    process.env.HOME = oldHome; process.env.PATH = oldPath; if (oldKimi === undefined) delete process.env.KIMI_CODE_HOME; else process.env.KIMI_CODE_HOME = oldKimi;
  }
});

test('China-region login succeeds and result remains after pane disappears', () => {
  const dir = fixture(), file = path.join(dir, 'config.toml'); fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('auth.kimi.ai', 'auth.kimi.com'));
  const machine = Object.create(MachineService.prototype); machine.logins = { team: { cli: 'kimi', dir } };
  machine.tmux = () => ({ ok: true, stdout: '__wc_login_exit 0' });
  assert.equal(machine.loginState('team').state, 'done'); assert.equal(machine.loginState('team').logged_in, true);
  machine.tmux = () => ({ ok: false }); machine.liveTmux = () => new Set();
  assert.equal(machine.loginState('team').state, 'done');
});

test('start allocates the name passed to the role message', async () => {
  const machine = Object.create(MachineService.prototype);
  Object.assign(machine, { sessions: {}, startingNames: new Map(), cancelledStarts: new Set() });
  machine.startNamed = async (input, name) => ({ name, pending_initial: kimi.firstMessage(input, '/prompt', name) });
  const session = await machine.start({ cli: 'kimi', role: 'worker', thread_id: 'allocated', token: 'token' });
  assert.match(session.pending_initial, /^\[wc:role\] Role: worker\nSession: wc-allocated-worker\n/);
});

test('service command passes named account directory to effort lookup', () => {
  const dir = fixture(), machine = Object.create(MachineService.prototype);
  const built = machine.commandFor({ cli: 'kimi' }, { account_dir: dir, effort: 'low' }, '/work', '/prompt', '');
  assert.deepEqual(built.env, { KIMI_MODEL_THINKING_EFFORT: 'low' });
});

test('fake tmux login polls cover exit markers and liveness', () => {
  const root = makeTempSync('kimi-tmux-'), bin = path.join(root, 'bin'), pane = path.join(root, 'pane'), live = path.join(root, 'live'), log = path.join(root, 'argv');
  fs.mkdirSync(bin); const old = process.env.PATH;
  fs.writeFileSync(path.join(bin, 'tmux'), `#!/bin/sh\nprintf '%s\\n' "$*" >> '${log}'\ncase "$1" in\n capture-pane) [ -f '${pane}' ] || exit 1; cat '${pane}' ;;\n list-sessions) [ -f '${live}' ] || exit 1; cat '${live}' ;;\nesac\n`, { mode: 0o755 });
  const dir = fixture(), machine = Object.create(MachineService.prototype);
  try {
    process.env.PATH = `${bin}:${old}`; machine.logins = { team: { cli: 'kimi', dir } };
    const reset = () => { machine.logins.team = { cli: 'kimi', dir }; };
    fs.writeFileSync(pane, '__wc_login_exit 0'); assert.equal(machine.loginState('team').state, 'done');
    fs.unlinkSync(pane); assert.equal(machine.loginState('team').state, 'done');
    reset(); fs.writeFileSync(pane, '__wc_login_exit 1'); assert.equal(machine.loginState('team').state, 'failed');
    reset(); fs.writeFileSync(pane, '__wc_login_exit 0'); fs.unlinkSync(path.join(dir, 'credentials/dummy.json')); assert.equal(machine.loginState('team').state, 'failed');
    reset(); fs.unlinkSync(pane); fs.writeFileSync(live, 'wc-login-team\nwc-login-team-backup\n'); assert.equal(machine.loginState('team').state, 'waiting');
    fs.unlinkSync(live); assert.equal(machine.loginState('team').state, 'waiting');
    fs.writeFileSync(live, 'wc-login-team-backup\n'); assert.equal(machine.loginState('team').state, 'failed');
    assert.ok(fs.readFileSync(log, 'utf8').split('\n').filter(line => line.startsWith('capture-pane')).every(line => line.endsWith('-t =wc-login-team:')));
  } finally { process.env.PATH = old; }
});
