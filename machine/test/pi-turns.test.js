'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const pi = require('../adapters/pi');
test('Pi maps settled and tool events, redacting errors', () => {
  const event = { hook_event_name: 'agent_settled', turn: 2, entry_id: 'reply' };
  assert.deepEqual(pi.hookEvent(event), { type: 'turn-ended', turn_id: 2, entry_id: 'reply' });
  assert.deepEqual(pi.hookEvent({ ...event, aborted: true, entry_id: null }), { type: 'turn-ended', turn_id: 2, entry_id: null, interrupted: true });
  assert.deepEqual(pi.hookEvent({ ...event, stopReason: 'error', errorMessage: 'rate limit sk-or-v1-0000synthetic0000' }), { type: 'turn-failed', error: 'rate limit [redacted key]' });
  assert.equal(pi.hookEvent({ ...event, entry_id: null }).type, 'turn-failed');
  assert.equal(pi.hookEvent({ hook_event_name: 'tool_execution_start', toolCallId: 'x', toolName: 'read', args: { path: 'a' } }).step.kind, 'files');
  assert.equal(pi.hookEvent({ hook_event_name: 'tool_execution_end', toolCallId: 'x', isError: true }).step.failed, true);
});

test('real extension posts tool and turn events through hook.sh', async () => {
  const fs = require('node:fs'), path = require('node:path'), { spawn } = require('node:child_process');
  const { makeTempSync } = require('../../test-support/run-dir');
  const root = makeTempSync('pi-bridge-'), bin = path.join(root, 'bin'); fs.mkdirSync(bin);
  fs.symlinkSync(path.join(__dirname, 'fixtures/fake-pi.js'), path.join(bin, 'pi'));
  const oldPath = process.env.PATH; process.env.PATH = `${bin}:${oldPath}`;
  let built; try { built = pi.command({ role: 'worker' }, { name: 'wc-test-worker', cli_session_id: '123' }, root, { stateDir: root, promptPath: '/prompt' }); } finally { process.env.PATH = oldPath; }
  const child = spawn(built.argv[0], built.argv.slice(1), { env: { ...process.env, PI_CODING_AGENT_DIR: root, WHEELCHAIR_STATE_DIR: root, WHEELCHAIR_SESSION_TOKEN: 'synthetic' }, stdio: ['pipe', 'pipe', 'pipe'] });
  let output = '', errors = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { errors += chunk; });
  await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('error', reject); });
  assert.match(output, /escape interrupt/); child.stdin.end('hello\n');
  await new Promise((resolve, reject) => { child.once('exit', code => code === 0 ? resolve() : reject(new Error(errors))); });
  const spool = path.join(root, 'spool/events'); let events = [];
  for (let i = 0; i < 100; i++) { events = fs.existsSync(spool) ? fs.readdirSync(spool).filter(x => x.endsWith('.json')).map(x => JSON.parse(fs.readFileSync(path.join(spool, x), 'utf8'))) : []; if (events.length >= 3) break; await new Promise(resolve => setTimeout(resolve, 25)); }
  assert.ok(events.some(event => event.type === 'turn-ended' && event.entry_id === 'a1')); assert.equal(events.filter(event => event.type === 'step').length, 2);
});
