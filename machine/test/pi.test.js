'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempSync } = require('../../test-support/run-dir');
const pi = require('../adapters/pi');
const { MachineService } = require('../service');
test('Pi command writes an extension and applies reviewer and account settings', () => {
  const root = makeTempSync('pi-adapter-');
  const session = { name: 'wc-test-worker', cli_session_id: '123' };
  const context = { stateDir: root, promptPath: '/prompt' };
  const command = pi.command({ role: 'worker', model: 'openrouter/auto' }, session, root, context);
  assert.deepEqual(command.argv.slice(1, 7), ['--provider', 'openrouter', '--model', 'openrouter/auto', '--session-id', '123']);
  assert.match(fs.readFileSync(command.argv[command.argv.indexOf('-e') + 1], 'utf8'), /agent_settled/);
  assert.deepEqual(pi.command({ role: 'reviewer' }, session, root, context).argv.slice(-2), ['--tools', 'read,grep,find,ls']);
  assert.deepEqual(pi.loginEnv(null), {}); assert.deepEqual(pi.loginEnv(root), { PI_CODING_AGENT_DIR: root });
  assert.equal(pi.firstMessage({ brief: 'brief' }), 'brief');
  assert.equal(pi.readyText({}, 'escape interrupt · ctrl+c/ctrl+d clear/exit\n─────\n─────\nopenrouter/auto • medium'), true);
  assert.equal(pi.readyText({}, 'escape interrupt · ctrl+c/ctrl+d clear/exit Trust project folder?'), false);
});
test('login status checks presence without returning credentials', () => {
  const dir = makeTempSync('pi-auth-'); assert.equal(pi.loginStatus(dir).logged_in, false);
  fs.writeFileSync(path.join(dir, 'auth.json'), JSON.stringify({ openrouter: { key: 'sk-or-v1-0000synthetic0000' } }));
  assert.equal(pi.loginStatus(dir).logged_in, true); assert.doesNotMatch(JSON.stringify(pi.loginStatus(dir)), /sk-or-/);
});
test('Pi binds by session id and redacts kept lines', async () => {
  const root = makeTempSync('pi-copy-'); const file = path.join(root, 'sessions', 'work', 'time_123.jsonl'); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, '{"text":"sk-or-v1-0000synthetic0000"}\n');
  const session = { name: 'wc-test-worker', thread_id: 'test', cli: 'pi', cli_session_id: '123' };
  assert.equal(await pi.findTranscript(session, root), file);
  const machine = Object.create(MachineService.prototype); machine.stateDir = root; machine.sessions = { [session.name]: session }; machine.persistSessions = async () => {};
  await machine.copyTranscript(session, file); assert.doesNotMatch(fs.readFileSync(session.transcript_path, 'utf8'), /sk-or-/);
});
test('orphaned Pi pane is marked lost after restart', async () => {
  const machine = Object.create(MachineService.prototype); machine.sessions = {}; machine.liveTmux = () => new Set(['wc-abc-worker']); machine.persistSessions = async () => {}; machine.tmux = args => ({ ok: true, stdout: args[0] === 'capture-pane' ? fs.readFileSync(path.join(__dirname, '../../docs/plans/openrouter-harness/samples/screens/agent-agent.txt'), 'utf8') : '/tmp' });
  await machine.recoverFromTmux(); assert.equal(machine.sessions['wc-abc-worker'].end_reason, 'Lost track of this Pi session after a machine restart; restart it');
});

test('wrapped key is joined and redacted in agent pane', () => {
  const machine = new MachineService({ stateDir: makeTempSync('pi-pane-') }); const name = 'wc-test-worker'; machine.sessions[name] = { name, cli: 'pi' };
  machine.tmux = args => ({ ok: true, stdout: args.includes('-J') ? ['sk-or-v1-0000', 'synthetic0000'].join('') : ['sk-or-v1-0000', 'synthetic0000'].join('\n') }); assert.equal(machine.pane(name, true), '[redacted key]');
});


test('Pi argv carries --thinking only when the session has an effort', () => {
  const root = makeTempSync('pi-thinking-');
  const context = { stateDir: root, promptPath: '/prompt' };
  const high = pi.command({ role: 'worker' }, { name: 'wc-test-worker', cli_session_id: '123', effort: 'high' }, root, context).argv;
  assert.equal(high[high.indexOf('--thinking') + 1], 'high');
  assert.equal(pi.command({ role: 'worker' }, { name: 'wc-test-worker', cli_session_id: '123', effort: null }, root, context).argv.includes('--thinking'), false);
  assert.equal(pi.command({ role: 'worker' }, { name: 'wc-test-worker', cli_session_id: '123' }, root, context).argv.includes('--thinking'), false);
});
test('Pi role prompts and reviewer tools are passed in argv', () => {
  const root = makeTempSync('pi-roles-');
  for (const role of ['lead', 'sub-lead', 'worker', 'reviewer', 'verifier', 'mapper']) {
    const promptPath = `/prompts/${role}`;
    const argv = pi.command({ role }, { name: 'wc-test-worker', cli_session_id: '123' }, root, { stateDir: root, promptPath }).argv;
    const prompt = argv.indexOf('--append-system-prompt');
    assert.notEqual(prompt, -1); assert.equal(argv[prompt + 1], promptPath);
    const tools = argv.indexOf('--tools');
    if (role === 'reviewer') { assert.notEqual(tools, -1); assert.equal(argv[tools + 1], 'read,grep,find,ls'); }
    else assert.equal(tools, -1);
  }
});

test('Pi busy input border is not ready', () => {
  const ready = 'escape interrupt · ctrl+c/ctrl+d clear/exit\n─────\n─────\nopenrouter/auto • medium';
  assert.equal(pi.readyText({}, ready), true);
  assert.equal(pi.readyText({}, ready.replace('─────', '── ⠏ Working ──')), false);
});

test('Pi usageFrom returns null for any pane', () => {
  for (const pane of ['', 'escape interrupt · ctrl+c/ctrl+d clear/exit\n─────\nopenrouter/auto • medium', '── ⠏ Working ──', 'random 100%']) assert.equal(pi.usageFrom(pane), null);
});

test('Pi login status ignores the environment key', () => {
  const dir = makeTempSync('pi-no-auth-'); const old = process.env.OPENROUTER_API_KEY;
  try {
    process.env.OPENROUTER_API_KEY = 'sk-or-v1-0000synthetic0000';
    const status = pi.loginStatus(dir);
    assert.equal(status.logged_in, false); assert.doesNotMatch(JSON.stringify(status), /sk-or-/);
  } finally { if (old === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = old; }
});

test('registered Pi session survives restart and forwards a later settled hook', async () => {
  const root = makeTempSync('pi-restart-'); const name = 'wc-test-worker';
  const original = new MachineService({ stateDir: root });
  original.sessions[name] = { name, cli: 'pi', role: 'worker', thread_id: 'test', status: 'ready', token: 'synthetic', cli_session_id: '123', account_dir: root };
  await original.persistSessions();
  const machine = new MachineService({ stateDir: root, host: '127.0.0.1', port: 0 });
  machine.liveTmux = () => new Set([name]); machine.tmux = () => ({ ok: true, stdout: fs.readFileSync(path.join(__dirname, '../../docs/plans/openrouter-harness/samples/screens/agent-agent.txt'), 'utf8') });
  machine.checkKimiVersion = () => {}; machine.screens.startup = async () => {};
  await machine.init();
  assert.equal(machine.sessions[name].status, 'ready'); assert.equal(machine.sessions[name].end_reason, undefined);
  const events = []; machine.emitEvent = async event => events.push(event);
  await machine.hook(name, pi.hookEvent({ hook_event_name: 'agent_settled', turn: 1, entry_id: 'a1' }));
  assert.equal(events.length, 1); assert.equal(events[0].type, 'turn-ended'); assert.equal(events[0].entry_id, 'a1');
});

test('Pi waits for every startup download to complete', () => {
  const ready = 'escape interrupt · ctrl+c/ctrl+d clear/exit\n─────\nopenrouter/auto • medium';
  const download = 'fd not found. Downloading...';
  assert.equal(pi.readyText({}, `${download}\n${ready}`), false);
  assert.equal(pi.readyText({}, `${download}\nfd installed to /tmp/fake/fd\n${ready}`), true);
  assert.equal(pi.readyText({}, `${download}\nFailed to download fd: fetch failed\n${ready}`), true);
  assert.equal(pi.readyText({}, `${download}\nfd installed to /tmp/fake/fd\nrg not found. Downloading...\n${ready}`), false);
});

test('Pi version probe gates old versions and caches by executable mtime', async () => {
  const dir = makeTempSync('pi-version-'), file = path.join(dir, 'pi'), old = process.env.PATH;
  let tick = Date.now();
  const version = value => { fs.writeFileSync(file, `#!/bin/sh\n${value ? `echo ${value}` : 'exit 1'}\n`, { mode: 0o755 }); tick += 2000; fs.utimesSync(file, tick / 1000, tick / 1000); };
  try {
    process.env.PATH = `${dir}:${old}`;
    const machine = new MachineService({ stateDir: dir });
    version('1.5.1'); await machine.checkPiVersion();
    assert.equal(machine.cliStatus('pi').problem, 'Pi 1.5.2 or newer is needed (found 1.5.1)');
    await assert.rejects(machine.startNamed({ cli: 'pi' }, 'wc-test-worker'), /Pi 1.5.2 or newer/);
    for (const v of ['1.5.2', '1.5.9']) { version(v); await machine.checkPiVersion(); assert.equal(machine.cliStatus('pi').warning, undefined); assert.equal(machine.cliStatus('pi').problem, undefined); }
    version('1.6.0'); await machine.checkPiVersion(); assert.match(machine.cliStatus('pi').warning, /Pi 1.6.0 is newer/);
    version(null); await machine.checkPiVersion(); assert.equal(machine.cliStatus('pi').warning, "Pi's version couldn't be read. If OpenRouter agents fail, this may be why.");
  } finally { process.env.PATH = old; }
});

test('Pi failure notes use the persisted launch version and startup exits have a reason', async () => {
  const root = makeTempSync('pi-version-session-'), name = 'wc-test-worker';
  const first = new MachineService({ stateDir: root });
  first.sessions[name] = { name, cli: 'pi', thread_id: 'test', status: 'starting', pi_version: '1.5.2' };
  await first.persistSessions();
  const machine = new MachineService({ stateDir: root });
  machine.sessions = JSON.parse(fs.readFileSync(machine.sessionsPath, 'utf8'));
  machine.liveTmux = () => new Set(); machine.pane = () => { throw new Error('gone'); };
  await machine.checkReady(machine.sessions[name]);
  assert.equal(machine.sessions[name].end_reason, 'Pi exited before it was ready');
  assert.equal(JSON.parse(fs.readFileSync(machine.sessionsPath, 'utf8'))[name].end_reason, 'Pi exited before it was ready');
  for (const [version, expected] of [['1.5.2', 'failure'], ['1.6.0', 'failure Pi 1.6.0 is newer than the version wheelchair was tested with (1.5.2); that may be the cause.'], [null, "failure Pi's version couldn't be read; that may be the cause."]]) {
    machine.sessions[name].pi_version = version;
    const events = []; machine.emitEvent = async e => events.push(e);
    await machine.hook(name, { type: 'turn-failed', error: 'failure' });
    assert.equal(events[0].error, expected);
  }
});

test('Pi launch records tested version across restart and allows newer version', async () => {
  const root = makeTempSync('pi-launch-version-'), bin = path.join(root, 'bin'), file = path.join(bin, 'pi'), old = process.env.PATH;
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'systemd-run'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'tmux'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  let tick = Date.now();
  const version = value => { fs.writeFileSync(file, `#!/bin/sh\necho ${value}\n`, { mode: 0o755 }); tick += 2000; fs.utimesSync(file, tick / 1000, tick / 1000); };
  try {
    process.env.PATH = `${bin}:/usr/bin:/bin`;
    const machine = new MachineService({ stateDir: root }); machine.win = null;
    machine.config = { host: '127.0.0.1', port: 0 }; machine.createWorktree = async () => ({ worktree: root }); machine.checkReady = async () => {};
    version('1.5.2');
    const input = { cli: 'pi', role: 'worker', thread_id: 'test', token: 'token', role_prompt: 'rules' };
    const session = await machine.start(input);
    assert.equal(machine.sessions[session.name].pi_version, '1.5.2');
    version('1.6.0');
    const restarted = new MachineService({ stateDir: root }); restarted.win = null;
    restarted.sessions = JSON.parse(fs.readFileSync(restarted.sessionsPath, 'utf8'));
    await restarted.checkPiVersion(); assert.match(restarted.cliStatus('pi').warning, /1.6.0/);
    const events = []; restarted.emitEvent = async e => events.push(e);
    await restarted.hook(session.name, { type: 'turn-failed', error: 'failure' }); assert.equal(events[0].error, 'failure');
    machine.createWorktree = async () => ({ worktree: root });
    const newer = await machine.start({ ...input, thread_id: 'newer' });
    assert.equal(machine.sessions[newer.name].pi_version, '1.6.0');
  } finally { process.env.PATH = old; }
});

test('Pi warns that project tools, including Windows-side ones, are not loaded', () => {
  const root = makeTempSync('pi-adapter-mcp-');
  const session = { name: 'wc-test-worker', cli_session_id: '123' };
  const mcp = { names: ['unity'] };
  assert.deepEqual(pi.command({ role: 'worker' }, session, root, { stateDir: root, promptPath: '/prompt', tools: true, mcp }).warnings, [{ names: ['unity'], text: "project tools aren't supported on Pi yet; this agent runs without them" }]);
  assert.equal(pi.command({ role: 'reviewer' }, session, root, { stateDir: root, promptPath: '/prompt', tools: false, mcp }).warnings, undefined);
  assert.equal(pi.command({ role: 'worker' }, session, root, { stateDir: root, promptPath: '/prompt', tools: true, mcp: { names: [] } }).warnings, undefined);
});
