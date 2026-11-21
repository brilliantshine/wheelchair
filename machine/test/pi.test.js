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
