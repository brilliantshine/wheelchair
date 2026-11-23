'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { makeTemp } = require('../../test-support/run-dir');
const { MachineService } = require('../service');
const claude = require('../../connectors/claude/machine.js');
const codex = require('../../connectors/codex/machine.js');

test('resume commands preserve reviewer restrictions and Claude start identity', () => {
  const session = { name: 'wc-test', cli_session_id: 'uuid', codex_thread_id: 'thread', permission_mode: 'auto', effort: 'high', codex_mode: 'unrestricted' };
  const context = { stateDir: '/tmp/state', promptPath: '/tmp/prompt', tools: false };
  const start = claude.command({ model: 'model' }, session, '/tmp/work', context).argv;
  const resume = claude.command({ model: 'model' }, session, '/tmp/work', { ...context, resume: true }).argv;
  assert.ok(start.includes('--session-id')); assert.ok(!resume.includes('--session-id'));
  assert.deepEqual(resume.slice(1, 3), ['--resume', 'uuid']);
  const argv = codex.command({ role: 'reviewer', model: 'model' }, session, '/tmp/work', { ...context, resume: true }).argv;
  assert.deepEqual(argv.slice(1, 5), ['-s', 'read-only', '-a', 'never']);
  assert.deepEqual(argv.slice(-2), ['resume', 'thread']);
  assert.deepEqual(claude.answerPrompts(session, 'Try the new fullscreen renderer?'), { step: 'renderer', keys: ['Down', 'Enter'] });
});

test('switch rollback preserves switch outcome and discards hooks', async t => {
  const root = await makeTemp('switch-test-');
  const previous = process.env.CLAUDE_CONFIG_DIR; process.env.CLAUDE_CONFIG_DIR = root;
  t.after(() => { if (previous === undefined) delete process.env.CLAUDE_CONFIG_DIR; else process.env.CLAUDE_CONFIG_DIR = previous; });
  const machine = Object.create(MachineService.prototype);
  machine.stateDir = root; machine.sessions = {}; machine.persistSessions = async () => {}; const events = [];
  machine.emitEvent = async event => events.push(event); machine.log = () => {};
  const session = { name: 'wc-test', cli: 'claude', account: 'default-claude', account_dir: null, status: 'ready', thread_id: 't', cli_session_id: 'missing', last_reading: { old: true } };
  machine.sessions[session.name] = session; machine.liveTmux = () => new Set([session.name]);
  const result = await machine.switchSession(session.name, { switch_id: 'first', account: { id: 'default-claude', dir: null }, model: null, project: 'p', project_dir: root });
  assert.equal(result.state, 'running');
  assert.deepEqual(await machine.hook(session.name, { type: 'limit-hit' }), { ignored: true });
  await new Promise(resolve => setImmediate(resolve));
  for (let i = 0; i < 100 && session.switches.first.state === 'running'; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(session.switches.first.state, 'failed'); assert.equal(session.status, 'ready');
  assert.deepEqual(session.last_reading, { old: true });
  assert.equal(events[0].type, 'switch-failed'); assert.equal(events[0].switch_id, 'first');
  const repeat = await machine.switchSession(session.name, { switch_id: 'first', account: { id: 'default-claude', dir: null }, model: null, project: 'p', project_dir: root });
  assert.equal(repeat.state, 'failed');
});

test('relaunch readiness reports the matching switch and timeout ends it', async () => {
  const machine = Object.create(MachineService.prototype); const events = []; const killed = [];
  machine.persistSessions = async () => {}; machine.emitEvent = async e => events.push(e); machine.tmux = args => { killed.push(args); return { ok: true }; }; machine.liveTmux = () => new Set();
  machine.pane = () => 'auto mode on\n❯ Try anything\n';
  const session = { name: 'wc-test', cli: 'claude', thread_id: 't', status: 'starting', active_switch: 'a', switches: { a: { state: 'running' } }, relaunched_at: new Date().toISOString() };
  await machine.checkReady(session); assert.equal(events[0].switch_id, 'a'); assert.equal(session.switches.a.state, 'done');
  session.status = 'starting'; session.active_switch = 'b'; session.switches.b = { state: 'running' }; session.relaunched_at = new Date(Date.now() - 31000).toISOString(); machine.pane = () => 'loading';
  await machine.checkReady(session); assert.equal(session.status, 'stopped'); assert.equal(session.switches.b.state, 'failed'); assert.equal(events.length, 1); assert.equal(killed[0][0], 'kill-session');
});

test('both providers copy the conversation and respawn the existing pane', async t => {
  const root = await makeTemp('switch-copy-');
  const oldPath = process.env.PATH, oldClaude = process.env.CLAUDE_CONFIG_DIR, oldCodex = process.env.CODEX_HOME;
  t.after(() => { process.env.PATH = oldPath; for (const [key, value] of [['CLAUDE_CONFIG_DIR', oldClaude], ['CODEX_HOME', oldCodex]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const bin = path.join(root, 'bin'); await fs.mkdir(bin); const log = path.join(root, 'tmux.log');
  await fs.writeFile(path.join(bin, 'tmux'), `#!/bin/sh\nprintf '%s\\n' "$*" >> '${log}'\n`, { mode: 0o755 }); process.env.PATH = `${bin}:${oldPath}`;
  for (const [cli, relative, id] of [['claude', 'projects/key/uuid.jsonl', 'uuid'], ['codex', 'sessions/2026/11/22/rollout-x-thread.jsonl', 'thread']]) {
    const from = path.join(root, `${cli}-old`), to = path.join(root, `${cli}-new`), state = path.join(root, `${cli}-state`);
    process.env[cli === 'claude' ? 'CLAUDE_CONFIG_DIR' : 'CODEX_HOME'] = from;
    const source = path.join(from, relative), destination = path.join(to, relative);
    await fs.mkdir(path.dirname(source), { recursive: true }); await fs.writeFile(source, '{"line":1}\n');
    await fs.mkdir(path.join(state, 'prompts'), { recursive: true }); await fs.writeFile(path.join(state, 'prompts', 'wc-test.md'), 'original prompt');
    const machine = Object.create(MachineService.prototype); machine.stateDir = state; machine.persistSessions = async () => {}; machine.emitEvent = async () => {};
    machine.copyTranscript = async s => { s.transcript_source = { path: source, ino: 1, offset: 7 }; };
    machine.prepareLaunch = async (input, session, adapter, worktree, promptPath, rolePrompt, resume) => { assert.equal(resume, true); assert.equal(rolePrompt, 'original prompt'); assert.equal(input.model, 'new-model'); assert.equal(input.project, 'project'); assert.equal(input.project_dir, root); assert.equal(input.role, 'reviewer'); return { commandText: 'resume-command' }; };
    const session = { name: 'wc-test', cli, cli_session_id: id, codex_thread_id: id, role: 'reviewer', thread_id: 't', account_dir: null, account: `default-${cli === 'codex' ? 'gpt' : 'claude'}`, status: 'switching', worktree: root, last_reading: { used: 1 }, switches: { a: { state: 'running' } } };
    const snapshot = JSON.parse(JSON.stringify({ ...session, status: 'ready' }));
    await machine.runSwitch(session, snapshot, { switch_id: 'a', account: { id: 'other' }, model: 'new-model', project: 'project', project_dir: root }, to);
    assert.equal(await fs.readFile(source, 'utf8'), '{"line":1}\n'); assert.equal(await fs.readFile(destination, 'utf8'), '{"line":1}\n');
    assert.equal(session.source_transcript, destination); assert.equal(session.transcript_source.offset, 7); assert.equal(session.last_reading, undefined); assert.equal(session.status, 'starting');
  }
  const lines = (await fs.readFile(log, 'utf8')).trim().split('\n'); assert.equal(lines.length, 2); assert.ok(lines.every(line => line === 'respawn-pane -k -t =wc-test: resume-command'));
});
