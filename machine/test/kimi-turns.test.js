'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempSync } = require('../../test-support/run-dir');
const { MachineService } = require('../service');
const kimi = require('../adapters/kimi');
function setup() {
  const root = makeTempSync('kimi-turns-');
  const machine = Object.create(MachineService.prototype);
  machine.stateDir = root; machine.sessions = {}; machine.persistSessions = async () => {};
  machine.tmux = () => ({ ok: true, stdout: '' }); machine.liveTmux = () => new Set();
  machine.hook = async (name, event) => { machine.events.push(event); }; machine.events = [];
  const session = { name: 'wc-abc-worker', thread_id: 'abc', cli: 'kimi', status: 'ready', account_dir: root, created_at: new Date(Date.now()-10000).toISOString(), ready_at: new Date().toISOString() };
  machine.sessions[session.name] = session;
  function log(id, rows, agent = 'main') {
    const file = path.join(root, 'sessions/work', id, 'agents', agent, 'wire.jsonl'); fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n')+'\n'); return file;
  }
  const metadata = { type: 'metadata', protocol_version: '1.5', min_protocol_version: '1.5' };
  const prompt = name => ({ type: 'turn.prompt', origin: { kind: 'user' }, input: [{ text: `[wc:role] Role: worker\nSession: ${name}\n` }] });
  return { machine, session, log, metadata, prompt };
}
test('binding is shared and selects each session marker, ignoring subagents', async () => {
  const { machine, session, log, metadata, prompt } = setup();
  const other = { ...session, name: 'wc-abc-worker-2' }; machine.sessions[other.name] = other;
  log('sub', [metadata, prompt(session.name), { type: 'turn.ended', agentId: 'main', turnId: 1, reason: 'completed' }], 'other');
  const a = log('a', [metadata, prompt(session.name)]), b = log('b', [metadata, prompt(other.name)]);
  await Promise.all([machine.kimiBinding(session), machine.pollKimiTurns()]);
  assert.equal(session.source_transcript, a); assert.equal(other.source_transcript, b); assert.deepEqual(machine.events, []);
  assert.equal((await kimi.findTranscript(session, session.account_dir)), a);
});
test('turn zero and all outcomes are mapped, persisted and not repeated', async () => {
  const { machine, session, log, metadata, prompt } = setup();
  const ends = ['completed', 'cancelled', 'failed', 'failed', 'failed', 'other'].map((reason, turnId) => ({ type: 'turn.ended', agentId: 'main', turnId, reason, ...(turnId === 2 ? { error: 'rate limit' } : turnId === 3 ? { error: { code: 'bad', message: 'outer', cause: { code: 'provider.quota', message: 'inner' } } } : {}) }));
  log('one', [metadata, prompt(session.name), ...ends, { type: 'turn.ended', agentId: 'sub', turnId: 9, reason: 'completed' }]);
  await machine.pollKimiTurns(); await machine.pollKimiTurns();
  assert.deepEqual(machine.events.map(e => e.type), ['turn-ended','turn-ended','limit-hit','limit-hit','turn-failed','turn-failed']);
  assert.equal(machine.events[1].interrupted, true); assert.equal(machine.events[3].error, '[bad] outer: inner'); assert.equal(machine.events[4].error, 'Kimi Code turn failed'); assert.equal(machine.events[5].error, 'Kimi Code turn ended (other)');
  assert.equal(session.kimi_last_turn, 5); assert.ok(session.kimi_offset > 0);
});
test('incompatible marker and missing binding stop with a reason', async () => {
  for (const meta of [{ protocol_version: '2.0' }, { protocol_version: '1.5', min_protocol_version: '1.9' }]) {
    const { machine, session, log, prompt } = setup(); log('one', [{ type:'metadata', ...meta }, prompt(session.name)]);
    await machine.pollKimiTurns(); assert.match(session.end_reason, /format changed/); assert.equal(session.status, 'stopped');
  }
  const { machine, session } = setup(); session.ready_at = new Date(Date.now()-121000).toISOString(); await machine.pollKimiTurns(); assert.match(session.end_reason, /Couldn't find/);
});
test('fatal stop refuses input and waits for confirmed absence', async () => {
  const { machine, session } = setup(); session.end_reason = 'lost'; let targets = [];
  machine.tmux = args => { targets.push(args.at(-1)); return { ok: false }; }; machine.liveTmux = () => null;
  assert.deepEqual(await machine.stop(session.name), { pending: true, end_reason: 'lost' }); assert.equal(session.status, 'ready');
  assert.throws(() => machine.raw(session.name, 'x'), /lost/); await assert.rejects(machine.submit(session.name, 'x'), /lost/);
  assert.deepEqual(targets, [`=${session.name}`]); machine.liveTmux = () => new Set([`${session.name}-2`]); await machine.stop(session.name); assert.equal(session.status, 'stopped');
});

test('unrelated incompatible logs are ignored and truncation stops a bound session', async () => {
  const { machine, session, log, metadata, prompt } = setup();
  log('bad', [{ type:'metadata', protocol_version:'2.0' }, { text:`quoted [wc:role]\nSession: ${session.name}` }]);
  const file = log('good', [metadata, prompt(session.name), { type:'turn.ended', agentId:'main', turnId:0, reason:'completed' }]);
  await machine.pollKimiTurns(); assert.equal(session.source_transcript, file); assert.equal(machine.events.length, 1);
  fs.writeFileSync(file, ''); await machine.pollKimiTurns(); assert.match(session.end_reason, /disappeared or was replaced/);
});
test('spool gate holds later turns until the previous event drains', async () => {
  const { machine, session, log, metadata, prompt } = setup();
  log('good', [metadata, prompt(session.name), ...[0, 1].map(turnId => ({ type:'turn.ended', agentId:'main', turnId, reason:'completed' }))]);
  let blocked = false; machine.kimiSpoolWaiting = async () => blocked;
  machine.hook = async (name, event) => { machine.events.push(event); blocked = true; };
  await machine.pollKimiTurns(); assert.deepEqual(machine.events.map(e => e.turn_id), [0]);
  await machine.pollKimiTurns(); assert.equal(machine.events.length, 1);
  blocked = false; await machine.pollKimiTurns(); assert.deepEqual(machine.events.map(e => e.turn_id), [0, 1]);
});
test('copier refuses replaced or shortened Kimi logs', async () => {
  const { machine, session, log, metadata, prompt } = setup(); const file = log('good', [metadata, prompt(session.name)]);
  await machine.kimiBinding(session); await machine.copyTranscriptNow(session, file);
  const copied = fs.readFileSync(session.transcript_path, 'utf8');
  fs.writeFileSync(file, '{}\n'); await machine.copyTranscriptNow(session, file);
  assert.equal(fs.readFileSync(session.transcript_path, 'utf8'), copied);
  fs.renameSync(file, file + '.old'); fs.writeFileSync(file, JSON.stringify({ text:'foreign' }) + '\n');
  await machine.copyTranscriptNow(session, file); assert.equal(fs.readFileSync(session.transcript_path, 'utf8'), copied);
});
