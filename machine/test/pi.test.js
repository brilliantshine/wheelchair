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
test('Pi binds by session id and redacts kept lines and pane', async () => {
  const root = makeTempSync('pi-copy-'); const file = path.join(root, 'sessions', 'work', 'time_123.jsonl'); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, '{"text":"sk-or-v1-0000synthetic0000"}\n');
  const session = { name: 'wc-test-worker', thread_id: 'test', cli: 'pi', cli_session_id: '123' };
  assert.equal(await pi.findTranscript(session, root), file);
  const machine = Object.create(MachineService.prototype); machine.stateDir = root; machine.sessions = { [session.name]: session }; machine.persistSessions = async () => {};
  await machine.copyTranscript(session, file); assert.doesNotMatch(fs.readFileSync(session.transcript_path, 'utf8'), /sk-or-/);
  machine.tmux = args => { assert.ok(args.includes('-J')); return { ok: true, stdout: 'sk-or-v1-0000synthetic0000' }; }; assert.equal(machine.pane(session.name), '[redacted key]');
});
test('orphaned Pi pane is marked lost after restart', async () => {
  const machine = Object.create(MachineService.prototype); machine.sessions = {}; machine.liveTmux = () => new Set(['wc-abc-worker']); machine.persistSessions = async () => {}; machine.tmux = args => ({ ok: true, stdout: args[0] === 'capture-pane' ? 'escape interrupt · ctrl+c/ctrl+d clear/exit' : '/tmp' });
  await machine.recoverFromTmux(); assert.match(machine.sessions['wc-abc-worker'].end_reason, /Lost track of this Pi session/);
});
