'use strict';
// Keep service instances independent of the host's WSL and interop setup.
const noWsl = { procRoot: __dirname, etcRoot: __dirname, runRoot: __dirname };
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempSync } = require('../../test-support/run-dir');
const kimi = require('../../connectors/kimi/machine.js');
const { MachineService } = require('../service');
function fixture() {
  const dir = makeTempSync('kimi-'); fs.mkdirSync(path.join(dir, 'credentials'));
  fs.writeFileSync(path.join(dir, 'credentials', 'dummy.json'), '{}');
  fs.writeFileSync(path.join(dir, 'config.toml'), `default_model = "kimi-code/k3"\n[services.search.oauth]\nkey = "oauth/wrong"\n[providers."managed:kimi-code".oauth]\noauth_host = "https://auth.kimi.ai"\nkey = "oauth/dummy"\n[models."kimi-code/k3"]\nsupport_efforts = [ "low", "high", "max" ]\n[models."kimi-code/light"]\nmodel = "light"\n`); return dir;
}
test('Kimi config, authentication, region, and effort', () => {
  const dir = fixture(); assert.deepEqual(kimi.loginStatus(dir), { logged_in: true, authenticated: true });
  assert.equal(kimi.command({}, { effort: 'medium' }, '', { accountDir: dir }).env, undefined);
  assert.equal(kimi.command({ model: 'kimi-code/light' }, { effort: 'max' }, '', { accountDir: dir }).env, undefined);
  const file = path.join(dir, 'config.toml'); fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('auth.kimi.ai', 'auth.kimi.com'));
  assert.match(kimi.loginStatus(dir).problem, /China/);
  fs.appendFileSync(file, '\nvalue = """\n[providers."managed:kimi-code".oauth]\n"""\n');
  assert.equal(kimi.loginStatus(dir).authenticated, true); assert.match(kimi.loginStatus(dir).problem, /multi-line/);
  fs.unlinkSync(file); fs.mkdirSync(file); assert.match(kimi.loginStatus(dir).problem, /can't be read/);
  assert.deepEqual(kimi.loginStatus(makeTempSync('kimi-empty-')), { logged_in: false, authenticated: false });
});
test('Kimi authentication requires regular credential files', () => {
  const dir = fixture(), credential = path.join(dir, 'credentials', 'dummy.json');
  fs.unlinkSync(credential); fs.mkdirSync(credential);
  assert.deepEqual(kimi.loginStatus(dir), { logged_in: false, authenticated: false });
  fs.rmdirSync(credential); fs.writeFileSync(credential, '{}');
  assert.deepEqual(kimi.loginStatus(dir), { logged_in: true, authenticated: true });

  const untrusted = makeTempSync('kimi-untrusted-');
  fs.mkdirSync(path.join(untrusted, 'credentials', 'x.json'), { recursive: true });
  fs.writeFileSync(path.join(untrusted, 'config.toml'), 'value = """\nuntrusted\n"""\n');
  assert.deepEqual(kimi.loginStatus(untrusted), { logged_in: false, authenticated: false, problem: "Kimi Code's config.toml has multi-line strings wheelchair can't read" });
  fs.rmdirSync(path.join(untrusted, 'credentials', 'x.json'));
  fs.writeFileSync(path.join(untrusted, 'credentials', 'x.json'), '{}');
  assert.deepEqual(kimi.loginStatus(untrusted), { logged_in: false, authenticated: true, problem: "Kimi Code's config.toml has multi-line strings wheelchair can't read" });
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
test('version floor follows the resolved binary and its mtime', async () => {
  const dir = makeTempSync('kimi-bin-'), file = path.join(dir, 'kimi'), old = process.env.PATH;
  try {
    fs.writeFileSync(file, '#!/bin/sh\necho 2.6.2\n', { mode: 0o755 }); process.env.PATH = `${dir}:${old}`;
    const machine = Object.create(MachineService.prototype);
    await machine.checkKimiVersion(); assert.match(machine.cliStatus('kimi', { logged_in: true }).problem, /found 2.6.2/);
    fs.writeFileSync(file, '#!/bin/sh\necho 2.6.3\n'); fs.utimesSync(file, new Date(), new Date(Date.now() + 2000));
    await machine.checkKimiVersion(); assert.equal(machine.cliStatus('kimi', { logged_in: true }).logged_in, true);
    assert.equal(kimi.loginCommand()[0], file); assert.equal(kimi.command({}, {}, '', { accountDir: dir }).argv[0], file);
  } finally { process.env.PATH = old; }
});

test('config reader rejects untrusted files and ignores service oauth', t => {
  const dir = fixture(), file = path.join(dir, 'config.toml');
  const config = kimi.readConfig(dir);
  assert.equal(config.key, 'oauth/dummy');
  assert.equal('models' in config, false);
  assert.deepEqual(kimi.readConfig(makeTempSync('kimi-empty-')), {});
  fs.appendFileSync(file, '\ntext = """\n[providers."managed:kimi-code".oauth]\nkey = "oauth/fake"\n"""\n');
  assert.match(kimi.readConfig(dir).problem, /multi-line/);
  assert.deepEqual(kimi.loginStatus(dir), { logged_in: false, authenticated: true, problem: "Kimi Code's config.toml has multi-line strings wheelchair can't read" });
  if (process.getuid?.() !== 0) {
    fs.chmodSync(file, 0); assert.match(kimi.readConfig(dir).problem, /can't be read/); fs.chmodSync(file, 0o600);
  } else t.diagnostic('chmod unreadable check skipped as root');
});

test('config reader skips multiline arrays before the managed oauth table', () => {
  const dir = fixture(), file = path.join(dir, 'config.toml');
  fs.writeFileSync(file, `default_model = "kimi-code/k3"\n[models."kimi-code/k3"]\nsupport_efforts = [\n  "low",\n  [x],\n  "max",\n]\n[providers."managed:kimi-code".oauth]\nkey = "oauth/dummy"\noauth_host = "https://auth.kimi.ai"\n`);
  assert.deepEqual(kimi.readConfig(dir), { default_model: 'kimi-code/k3', key: 'oauth/dummy', oauth_host: 'https://auth.kimi.ai' });
  assert.deepEqual(kimi.loginStatus(dir), { logged_in: true, authenticated: true });
});

test('config reader tracks nested brackets outside quoted strings and comments', () => {
  const dir = fixture(), file = path.join(dir, 'config.toml');
  fs.writeFileSync(file, `default_model = "kimi-code/k3"\nignored = [\n  "]",\n  [\n    [1, 2],\n    [3],\n  ],\n] # ] in comment\n[providers."managed:kimi-code".oauth]\noauth_host = "https://auth.kimi.ai"\nkey = "oauth/dummy"\n`);
  assert.deepEqual(kimi.readConfig(dir), { default_model: 'kimi-code/k3', key: 'oauth/dummy', oauth_host: 'https://auth.kimi.ai' });
  assert.deepEqual(kimi.loginStatus(dir), { logged_in: true, authenticated: true });
});

test('config reader treats single-quoted literal strings like quoted text', () => {
  const dir = fixture(), file = path.join(dir, 'config.toml');
  fs.writeFileSync(file, `default_model = "kimi-code/k3"\nignored = [\n  'a]b',\n  'c#d',\n  '[e]',\n]\nnote = 'x # y' # comment\n[providers."managed:kimi-code".oauth]\nkey = "oauth/dummy" # note\noauth_host = "https://auth.kimi.ai"\n`);
  assert.deepEqual(kimi.readConfig(dir), { default_model: 'kimi-code/k3', key: 'oauth/dummy', oauth_host: 'https://auth.kimi.ai' });
  assert.deepEqual(kimi.loginStatus(dir), { logged_in: true, authenticated: true });
});

test('China or absent oauth host prevents eligibility despite authentication', () => {
  const dir = fixture(), file = path.join(dir, 'config.toml'), original = fs.readFileSync(file, 'utf8');
  for (const host of ['https://auth.kimi.com', null]) {
    fs.writeFileSync(file, host ? original.replace('https://auth.kimi.ai', host) : original.replace('oauth_host = "https://auth.kimi.ai"', ''));
    assert.deepEqual(kimi.loginStatus(dir), { authenticated: true, logged_in: false, problem: "signed in to Kimi's China region; log in again" });
  }
});

test('launch keeps model default effort and exact role message', () => {
  const dir = fixture();
  for (const effort of ['low', 'medium', 'high', 'xhigh', 'max']) {
    const built = kimi.command({}, { effort, permission_mode: 'bypass' }, '', { accountDir: dir });
    assert.deepEqual(built.argv.slice(1), ['--auto']);
    assert.equal(built.env, undefined);
  }
  const built = kimi.command({ model: 'kimi-code/light' }, { effort: 'max' }, '', { accountDir: dir });
  assert.deepEqual(built.argv.slice(1), ['--yolo', '--model', 'kimi-code/light']); assert.equal(built.env, undefined);
  const agy = require('../../connectors/agy/machine.js');
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
  machine.tmux = args => ({ ok: true, stdout: args[0] === 'capture-pane' ? '│ >\nAsk When Needed  K3.1 Pro thinking: high\ncontext: 0% (0/256k)' : '/tmp' });
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
    version('2.6.2'); await machine.checkKimiVersion(); assert.equal(machine.cliStatus('kimi').problem, 'Kimi Code 2.6.3 or newer is needed (found 2.6.2)');
    machine.cliStatus('kimi'); assert.equal(fs.readFileSync(count, 'utf8').trim().split('\n').length, 1);
    version('unknown'); await machine.checkKimiVersion(); assert.match(machine.cliStatus('kimi').problem, /found unknown/);
    for (const v of ['2.6.3', 'kimi 2.6.3', 'kimi, version 2.10.0', '2.6.4-rc.1', '2.10.0', '2.6.3+build']) { version(v); await machine.checkKimiVersion(); assert.equal(machine.cliStatus('kimi').problem, undefined); }
    for (const v of ['kimi 2.6.3foo', 'kimi 2.6.3.0', '2.6.3-rc.1', '2.6.2']) { version(v); await machine.checkKimiVersion(); assert.equal(machine.cliStatus('kimi').problem, `Kimi Code 2.6.3 or newer is needed (found ${v})`); }
    version('2.6.2'); await assert.rejects(machine.startNamed({ cli: 'kimi' }, 'wc-test-worker'), /Kimi Code 2.6.3 or newer is needed \(found 2.6.2\)/);
  } finally { process.env.PATH = old; }
});

test('launch rechecks the executable after worktree creation and uses that path', async () => {
  const root = makeTempSync('kimi-launch-version-'), bin = path.join(root, 'bin'), file = path.join(bin, 'kimi'), log = path.join(root, 'tmux.log');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'systemd-run'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'tmux'), `#!/bin/sh\nprintf '%s\\n' "$@" >> '${log}'\n`, { mode: 0o755 });
  const old = process.env.PATH;
  const version = (value, time) => { fs.writeFileSync(file, `#!/bin/sh\necho ${value}\n`, { mode: 0o755 }); fs.utimesSync(file, time, time); };
  try {
    process.env.PATH = `${bin}:/usr/bin:/bin`;
    const machine = Object.create(MachineService.prototype);
    Object.assign(machine, { stateDir: root, config: { host: '127.0.0.1', port: 0 }, sessions: {}, cancelledStarts: new Set(), startingNames: new Map(), startingBranches: new Set() });
    machine.persistSessions = async () => {}; machine.checkReady = async () => {};
    const input = { cli: 'kimi', role: 'worker', thread_id: 'test', token: 'token', role_prompt: 'rules' };
    const time = Date.now() / 1000;
    version('2.6.3', time);
    machine.createWorktree = async () => { version('2.6.2', time + 2); return { worktree: root }; };
    await assert.rejects(machine.start(input), /Kimi Code 2.6.3 or newer is needed \(found 2.6.2\)/);
    assert.equal(fs.existsSync(log), false);
    version('2.6.3', time + 4);
    machine.createWorktree = async () => ({ worktree: root });
    const session = await machine.start({ ...input, thread_id: 'success' });
    assert.equal(session.command[0], file);
    assert.match(fs.readFileSync(log, 'utf8'), /new-session/);
  } finally { process.env.PATH = old; }
});

test('version timeout and nonzero exit make authenticated Kimi accounts ineligible', async () => {
  const root = makeTempSync('kimi-version-failures-'), bin = path.join(root, 'bin'), file = path.join(bin, 'kimi');
  const old = { HOME: process.env.HOME, PATH: process.env.PATH, KIMI_CODE_HOME: process.env.KIMI_CODE_HOME };
  fs.mkdirSync(bin); fs.symlinkSync('/bin/sh', path.join(bin, 'sh'));
  for (const cli of ['claude', 'codex', 'agy']) fs.writeFileSync(path.join(bin, cli), '#!/bin/sh\necho test\n', { mode: 0o755 });
  try {
    process.env.HOME = root; process.env.PATH = `${bin}:/usr/bin:/bin`; process.env.KIMI_CODE_HOME = fixture();
    assert.equal(kimi.loginStatus(null).logged_in, true);
    const machine = Object.create(MachineService.prototype); machine.options = { kimiVersionTimeoutMs: 100 }; machine.sessions = {}; machine.liveTmux = () => new Set();
    fs.writeFileSync(file, '#!/bin/sh\necho 2.6.3\nexec sleep 2\n', { mode: 0o755 });
    await machine.checkKimiVersion();
    let status = machine.status();
    assert.equal(status.kimi.problem, 'Kimi Code 2.6.3 or newer is needed (found 2.6.3)');
    let accounts = status.accounts.filter(account => account.cli === 'kimi');
    assert.ok(accounts.length > 0); assert.ok(accounts.every(account => account.logged_in === false));
    fs.writeFileSync(file, '#!/bin/sh\nexit 1\n'); fs.utimesSync(file, new Date(), new Date(Date.now() + 2000));
    await machine.checkKimiVersion();
    status = machine.status();
    assert.equal(status.kimi.problem, 'Kimi Code 2.6.3 or newer is needed (found no output)');
    accounts = status.accounts.filter(account => account.cli === 'kimi');
    assert.ok(accounts.length > 0); assert.ok(accounts.every(account => account.logged_in === false));
  } finally {
    process.env.HOME = old.HOME; process.env.PATH = old.PATH; if (old.KIMI_CODE_HOME === undefined) delete process.env.KIMI_CODE_HOME; else process.env.KIMI_CODE_HOME = old.KIMI_CODE_HOME;
  }
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
  fs.mkdirSync(bin); const old = { PATH: process.env.PATH, HOME: process.env.HOME, KIMI_CODE_HOME: process.env.KIMI_CODE_HOME };
  const file = path.join(root, '.kimi-code/bin/kimi'); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, '#!/bin/sh\necho 2.6.3\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'systemd-run'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'tmux'), `#!/bin/sh\nprintf '%s\\n' "$@" >> '${log}'\n`, { mode: 0o755 });
  try {
    process.env.PATH = `${bin}:/usr/bin:/bin`; process.env.HOME = root; process.env.KIMI_CODE_HOME = path.relative(process.cwd(), fixture());
    const machine = Object.create(MachineService.prototype);
    Object.assign(machine, { stateDir: root, config: { host: '127.0.0.1', port: 0 }, sessions: {}, logins: {}, cancelledStarts: new Set(), startingNames: new Map(), startingBranches: new Set() });
    machine.createWorktree = async () => ({ worktree: root });
    machine.persistSessions = async () => {}; machine.checkReady = async () => {};
    const input = { cli: 'kimi', role: 'worker', thread_id: 'test', token: 'token', brief: 'brief', role_prompt: 'rules', effort: 'medium', permission_mode: 'bypass' };
    const calls = []; machine.tmux = args => { calls.push(args); return { ok: true, stdout: '' }; };
    const session = await machine.start(input);
    const yolo = await machine.start({ ...input, thread_id: 'yolo', permission_mode: 'auto' });
    await machine.startLogin({ account: 'default-kimi', cli: 'kimi' });
    // All words are shell-quoted by the service; decode both levels of the login wrapper.
    const words = text => {
      const result = []; let word = '', quote = false, started = false;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === "'") { quote = !quote; started = true; }
        else if (!quote && ch === '\\') { word += text[++i]; started = true; }
        else if (!quote && /\s/.test(ch)) { if (started) { result.push(word); word = ''; started = false; } }
        else { word += ch; started = true; }
      }
      if (started) result.push(word); return result;
    };
    const commands = calls.filter(args => args[0] === 'new-session');
    const launchText = fs.readFileSync(log, 'utf8').split('\n').find(line => line.startsWith("'env'"));
    const launch = words(launchText);
    const loginWrapper = words(commands.find(args => args.includes('wc-login-default-kimi')).at(-1));
    const login = words(loginWrapper[2].split(';')[0]);
    for (const command of [launch, login]) {
      assert.equal(command[0], 'env');
      assert.ok(command.includes(`KIMI_CODE_HOME=${path.resolve(process.env.KIMI_CODE_HOME)}`));
      const executable = command.findIndex((word, i) => i > 0 && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(word));
      assert.equal(command[executable], file);
    }
    assert.deepEqual(session.command, [file, '--auto']);
    assert.deepEqual(yolo.command, [file, '--yolo']);
    assert.deepEqual(login.slice(-3), [file, 'login', '--region', 'global'].slice(-3));
    assert.ok(!launch.includes('KIMI_MODEL_THINKING_EFFORT='));
    assert.match(session.pending_initial, /^\[wc:role\] Role: worker\nSession: wc-test-worker\n/);
    assert.equal(session.account_dir, null); assert.equal(session.effort, null);
  } finally {
    process.env.PATH = old.PATH; process.env.HOME = old.HOME; if (old.KIMI_CODE_HOME === undefined) delete process.env.KIMI_CODE_HOME; else process.env.KIMI_CODE_HOME = old.KIMI_CODE_HOME;
  }
});

test('service login endpoints use exact targets for prefix sibling and stale requests', async () => {
  const root = makeTempSync('kimi-http-'), secret = path.join(root, 'secret'), http = require('node:http'); fs.writeFileSync(secret, 'secret');
  const probe = http.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const machine = new MachineService({ win: noWsl, stateDir: root, host: '127.0.0.1', port, secretFile: secret });
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
    const staleCode = await fetch(`http://127.0.0.1:${port}/v1/logins/team/code`, { method: 'POST', headers: { 'x-wheelchair-machine-secret': 'secret', 'content-type': 'application/json' }, body: JSON.stringify({ code: '1234' }) });
    assert.equal(staleCode.status, 409); assert.equal(calls.at(-1)[0], 'delete-buffer'); assert.equal(calls.at(-1)[2], calls.at(-2)[2]);
    const saved = { resolveCli: kimi.resolveCli, loginCommand: kimi.loginCommand, seed: kimi.seed };
    try {
      kimi.resolveCli = () => '/fake/kimi'; kimi.loginCommand = () => ['/fake/kimi', 'login']; kimi.seed = () => {};
      machine.tmux = args => { calls.push(args); return { ok: true, stdout: '' }; };
      await machine.startLogin({ account:'team', cli:'kimi', dir:'~/.wheelchair/accounts/team' });
    } finally { Object.assign(kimi, saved); }
    assert.ok(calls.some(args => args[0] === 'kill-session' && args.at(-1) === '=wc-login-team'));
    assert.ok(calls.every(args => !args.includes('=wc-login-team-backup') && !args.includes('=wc-login-team-backup:')));
  } finally { await new Promise(resolve => machine.server.close(resolve)); }
});

test('status lists multiple Kimi accounts and version problem suppresses account problems', async () => {
  const root = makeTempSync('kimi-status-'), oldHome = process.env.HOME, oldPath = process.env.PATH, oldKimi = process.env.KIMI_CODE_HOME;
  try {
    process.env.HOME = root; delete process.env.KIMI_CODE_HOME;
    const bin = path.join(root, 'bin'); fs.mkdirSync(bin); fs.writeFileSync(path.join(bin, 'kimi'), '#!/bin/sh\necho 2.6.2\n', { mode: 0o755 });
    fs.symlinkSync('/bin/sh', path.join(bin, 'sh'));
    for (const cli of ['claude', 'codex', 'agy']) fs.writeFileSync(path.join(bin, cli), '#!/bin/sh\necho test\n', { mode: 0o755 });
    process.env.PATH = bin;
    const global = fixture(); fs.cpSync(global, path.join(root, '.kimi-code'), { recursive: true });
    assert.equal(kimi.loginStatus(null).logged_in, true);
    for (const id of ['team', 'team-backup']) {
      const dir = path.join(root, '.wheelchair/accounts', id); fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'wheelchair-account.json'), JSON.stringify({ id, cli: 'kimi' }));
      fs.mkdirSync(path.join(dir, 'credentials')); fs.writeFileSync(path.join(dir, 'credentials', 'dummy.json'), '{}'); fs.writeFileSync(path.join(dir, 'config.toml'), '[providers."managed:kimi-code".oauth]\nkey = "oauth/dummy"\noauth_host = "https://auth.kimi.ai"\n');
    }
    const machine = Object.create(MachineService.prototype); machine.sessions = {}; machine.liveTmux = () => new Set();
    await machine.checkKimiVersion(); const status = machine.status(); assert.ok(status.accounts.every(entry => !('authenticated' in entry))); const entries = status.accounts.filter(a => a.cli === 'kimi');
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

test('service command leaves named account model effort at its default', () => {
  const dir = fixture(), machine = Object.create(MachineService.prototype);
  const built = machine.commandFor({ cli: 'kimi' }, { account_dir: dir, effort: 'low' }, '/work', '/prompt', '');
  assert.equal(built.env, undefined);
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

test('array tables, unsupported effort and unrelated credentials are ignored', () => {
  const dir = fixture(), file = path.join(dir, 'config.toml');
  fs.appendFileSync(file, '\n[[providers."managed:kimi-code".oauth]]\nkey = "oauth/array-table"\n');
  assert.equal(kimi.readConfig(dir).key, 'oauth/dummy');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('[ "low", "high", "max" ]', '[ "low" ]').replace('oauth/dummy', 'oauth/missing'));
  assert.equal(kimi.command({}, { effort: 'high' }, '', { accountDir: dir }).env, undefined);
  assert.equal(kimi.loginStatus(dir).authenticated, false);
});
test('missing executable refuses Kimi login', async () => {
  const oldPath = process.env.PATH, oldHome = process.env.HOME;
  try { process.env.PATH = '/usr/bin:/bin'; process.env.HOME = makeTempSync('kimi-no-bin-'); assert.throws(() => kimi.loginCommand(), /Kimi Code is not installed/); const machine = Object.create(MachineService.prototype); await assert.rejects(machine.startLogin({account:'default-kimi', cli:'kimi'}), /Kimi Code is not installed/); }
  finally { process.env.PATH = oldPath; process.env.HOME = oldHome; }
});

test('approval panels require ordered bottom lines and no input box', () => {
  const panel = (title, choice = 'Approve once') => `Earlier output\nMore output\n╭────────────╮\n│ ${title} │\n│ command │\n│ ❯ ${choice} │\n│   Approve for this session │\n│   Reject │\n╰────────────╯`;
  for (const title of ['Run this command?', 'Write this file?', 'Apply these edits?', 'Stop this task?', 'Approve SomeTool?']) assert.equal(kimi.promptText(panel(title)), true, title);
  assert.equal(kimi.promptText('Earlier output\n│ Ready to build with this plan? │\n│ ❯ Approve │\n│ Reject │\n│ Revise plan │'), true);
  const kimiPanel = (title, choice = '1. Approve once', bordered = false) => {
    const rows = [`▶ ${title}`, 'command', `▶ ${choice}`, '  2. Approve for this session', '  3. Reject'];
    const footer = ['Ask When Needed  K3 thinking: high  …/worktrees/clone/wc-x  wc-x', 'context: 7% (17.5k/256k)'];
    return [...(bordered ? rows.map(line => `│ ${line} │`) : rows), ...footer].join('\n');
  };
  for (const title of ['Run this command?', 'Write this file?', 'Apply these edits?', 'Stop this task?', 'Approve SomeTool?']) {
    assert.equal(kimi.promptText(kimiPanel(title)), true, title);
    assert.equal(kimi.promptText(kimiPanel(title, '1. Approve once', true)), true, `${title} bordered`);
  }
  assert.equal(kimi.promptText(kimiPanel('Ready to build with this plan?', '1. Approve')), true);
  assert.equal(kimi.promptText('Run this command?\n  1. Approve once'), true);
  for (const text of [
    'The tool asks "Run this command?" and offers Approve once.\n│ >\ncontext: 10%',
    'Run this command?\nApprove once\n│ >\ncontext: 10%',
    'Run this command?\nReject',
    `Approve once\n${Array(15).fill('output').join('\n')}\nRun this command?`,
    'Run this command?\nThe choice is Approve once.',
    'The assistant asks: Run this command?\nApprove once',
    'Approve once\nRun this command?',
    'Ready to build with this plan?\nThe choice is Approve',
    '▶ Run this command?\ncommand\n▶ 1. Approve once\n│ >\ncontext: 10%',
  ]) assert.equal(kimi.promptText(text), false, text);
});

test('readiness polling opens one Kimi permission hold and clears it on input', async () => {
  const root = makeTempSync('kimi-prompt-tmux-'), bin = path.join(root, 'bin'), pane = path.join(root, 'pane'), old = process.env.PATH;
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'tmux'), `#!/bin/sh\ncat '${pane}'\n`, { mode: 0o755 });
  const machine = Object.create(MachineService.prototype), events = [];
  const session = { name: 'wc-test-worker', cli: 'kimi', status: 'ready', thread_id: 'test', prompt_open: false };
  machine.sessions = { [session.name]: session }; machine.persistSessions = async () => {}; machine.emitEvent = async event => events.push(event);
  try {
    process.env.PATH = `${bin}:${old}`;
    const ready = 'The tool asks "Run this command?" and offers Approve once.\n│ >\ncontext: 10%';
    fs.writeFileSync(pane, ready);
    for (let i = 0; i < 3; i++) await machine.pollReadiness();
    assert.equal(events.filter(event => event.type === 'prompt').length, 0); assert.equal(session.prompt_open, false);
    fs.writeFileSync(pane, '│ Run this command? │\n│ command │\n│ ❯ Approve once │\n│ Reject │');
    for (let i = 0; i < 3; i++) await machine.pollReadiness();
    assert.equal(events.filter(event => event.type === 'prompt').length, 1); assert.equal(session.prompt_open, true);
    fs.writeFileSync(pane, ready); await machine.checkPrompt(session);
    assert.equal(session.prompt_open, false); assert.equal(events.filter(event => event.type === 'prompt-cleared').length, 1);
  } finally { process.env.PATH = old; }
});
test('recovery prioritizes anchored Kimi markers over reply text', async () => {
  const machine = Object.create(MachineService.prototype); machine.sessions = {}; machine.persistSessions = async () => {};
  const panes = { 'wc-a-worker': 'Codex and Antigravity CLI\n│ >\nAsk When Needed K3 thinking: high\ncontext: 12%', 'wc-b-worker': 'Codex\ncontext: 20%', 'wc-c-worker': 'Antigravity CLI', 'wc-d-worker': 'Claude says context: 3% and Ask When Needed thinking\n│ >' };
  machine.liveTmux = () => new Set(Object.keys(panes)); machine.tmux = args => ({ ok: true, stdout: args[0] === 'capture-pane' ? panes[args.at(-1).replace(/^=(.*):$/, '$1')] : '/tmp' });
  await machine.recoverFromTmux(); assert.deepEqual(Object.values(machine.sessions).map(s => s.cli), ['kimi', 'codex', 'agy', 'claude']); assert.match(machine.sessions['wc-a-worker'].end_reason, /Lost track/);
});

test('HTTP status stays responsive while a slow version check runs and launch awaits it', async () => {
  const root = makeTempSync('kimi-slow-'), bin = path.join(root, 'bin'), old = { HOME: process.env.HOME, PATH: process.env.PATH, KIMI_CODE_HOME: process.env.KIMI_CODE_HOME };
  fs.mkdirSync(bin); fs.writeFileSync(path.join(bin, 'kimi'), '#!/bin/sh\nsleep 3\necho 2.6.3\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'systemd-run'), '#!/bin/sh\nexit 1\n', { mode: 0o755 }); fs.writeFileSync(path.join(bin, 'tmux'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const secret = path.join(root, 'secret'); fs.writeFileSync(secret, 'secret');
  process.env.HOME = root; process.env.PATH = `${bin}:/usr/bin:/bin`; delete process.env.KIMI_CODE_HOME;
  const http = require('node:http'), probe = http.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const freePort = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const machine = new MachineService({ win: noWsl, stateDir: root, host: '127.0.0.1', port: freePort, secretFile: secret });
  machine.createWorktree = async () => ({ worktree: root }); machine.checkReady = async () => {}; machine.tmux = () => ({ ok: true, stdout: '' });
  try {
    await machine.listen(); const port = machine.server.address().port;
    const headers = { 'x-wheelchair-machine-secret': 'secret', 'content-type': 'application/json' };
    const start = Date.now(); const response = await fetch(`http://127.0.0.1:${port}/v1/status`, { headers }); const status = await response.json();
    assert.ok(Date.now() - start < 1000); assert.equal(status.kimi.problem, "Checking Kimi Code's version"); assert.ok(status.accounts.filter(a => a.cli === 'kimi').every(a => !a.logged_in && !('authenticated' in a)));
    let done = false; const launch = fetch(`http://127.0.0.1:${port}/v1/sessions`, { method: 'POST', headers, body: JSON.stringify({ cli: 'kimi', role: 'worker', thread_id: 'slow', token: 'token', brief: 'brief', role_prompt: 'rules', effort: 'medium' }) }).then(async r => { done = true; assert.equal(r.status, 201); return r.json(); });
    await new Promise(resolve => setTimeout(resolve, 250)); assert.equal(done, false);
    const session = await launch; assert.equal(session.effort, null); assert.equal(machine.sessions[session.name].effort, null);
    const after = await (await fetch(`http://127.0.0.1:${port}/v1/status`, { headers })).json(); assert.equal(after.kimi.version, '2.6.3'); assert.equal(after.kimi.problem, undefined);
  } finally {
    await new Promise(resolve => machine.server.close(resolve)); process.env.HOME = old.HOME; process.env.PATH = old.PATH; if (old.KIMI_CODE_HOME === undefined) delete process.env.KIMI_CODE_HOME; else process.env.KIMI_CODE_HOME = old.KIMI_CODE_HOME;
  }
});

test('config comments preserve hashes and escapes inside quoted values', () => {
  const dir = fixture(), file = path.join(dir, 'config.toml');
  fs.writeFileSync(file, 'default_model = "kimi-code/k3" # model\nignored = ["a#b", "c"] # array\n[providers."managed:kimi-code".oauth]\noauth_host = "https://auth.kimi.ai/#device"\nkey = "oauth/dummy" # note\n');
  const parse = JSON.parse, arrays = [];
  try {
    JSON.parse = value => { const parsed = parse(value); if (Array.isArray(parsed)) arrays.push(parsed); return parsed; };
    assert.deepEqual(kimi.readConfig(dir), { default_model: 'kimi-code/k3', oauth_host: 'https://auth.kimi.ai/#device', key: 'oauth/dummy' });
  } finally { JSON.parse = parse; }
  assert.deepEqual(arrays, [['a#b', 'c']]);
  assert.deepEqual(kimi.loginStatus(dir), { logged_in: true, authenticated: true });
  fs.writeFileSync(file, '[providers."managed:kimi-code".oauth]\nkey = "oauth/x" # note\noauth_host = "https://auth.kimi.ai/\\\"#device" # comment\n');
  assert.deepEqual(kimi.readConfig(dir), { key: 'oauth/x', oauth_host: 'https://auth.kimi.ai/"#device' });
});

test('usage probe reads without changing Kimi files', async () => {
  const http = require('node:http'), dir = fixture(), credential = path.join(dir, 'credentials/dummy.json');
  const token = 'dummy-test-token', requests = []; let status = 200, payload = '';
  const server = http.createServer((req, res) => { requests.push({ method: req.method, path: req.url, headers: req.headers }); res.writeHead(status); res.end(payload); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/coding/v1/usages`;
  const files = [path.join(dir, 'config.toml'), credential];
  const entries = root => fs.readdirSync(root, { withFileTypes: true }).flatMap(e => [path.relative(dir, path.join(root, e.name)), ...(e.isDirectory() ? entries(path.join(root, e.name)) : [])]).sort();
  const probe = async () => {
    const before = files.map(f => [fs.readFileSync(f), fs.statSync(f).mtimeMs]), names = entries(dir);
    try { return await kimi.usageProbe(dir, { timeout: 1000, url }); }
    finally { assert.deepEqual(files.map(f => [fs.readFileSync(f), fs.statSync(f).mtimeMs]), before); assert.deepEqual(entries(dir), names); }
  };
  const credentials = expires_at => fs.writeFileSync(credential, JSON.stringify({ access_token: token, expires_at }));
  try {
    credentials(Date.now() / 1000 + 600);
    payload = JSON.stringify({ usages: { limit_7d: { used_ratio: '1.4', reset_time: '2030-01-01T00:00:00Z' }, limit_5h: { used_ratio: 0.25, reset_time: '2030-01-02T00:00:00Z' } } });
    assert.deepEqual(await probe(), { week: { used: 100, resets_at: '2030-01-01T00:00:00.000Z' }, five_hour: { used: 25, resets_at: '2030-01-02T00:00:00.000Z' }, reached: true });
    assert.equal(requests[0].method, 'GET'); assert.equal(requests[0].path, '/coding/v1/usages'); assert.equal(requests[0].headers.authorization, `Bearer ${token}`); assert.equal(requests[0].headers.accept, 'application/json');
    payload = JSON.stringify({ usages: { limit_5h: { used_ratio: '0.5', reset_time: '2030-01-02' } } });
    assert.deepEqual(await probe(), { week: null, five_hour: { used: 50, resets_at: '2030-01-02T00:00:00.000Z' } });
    payload = JSON.stringify({ usages: { limit_7d: { used_ratio: 'bad', reset_time: '2030-01-01' }, limit_5h: { used_ratio: 1, reset_time: '' } } });
    await assert.rejects(probe(), { message: 'no usage windows' });
    status = 401; await assert.rejects(probe(), { message: 'Kimi usage request failed (HTTP 401)' });
    credentials(Date.now() / 1000 - 1); const count = requests.length;
    await assert.rejects(probe(), /login key has expired/); assert.equal(requests.length, count);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
