'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { makeTempSync } = require('../../test-support/run-dir');
const hook = path.join(process.cwd(), 'machine/hook.sh');
function setup() {
  const state = makeTempSync('char-hook-');
  fs.writeFileSync(path.join(state, 'machine.json'), JSON.stringify({ host: '127.0.0.1', port: 1 }));
  return { state, env: { ...process.env, WHEELCHAIR_STATE_DIR: state, WHEELCHAIR_SESSION_TOKEN: 'synthetic', WHEELCHAIR_SESSION_NAME: 'wc-env' } };
}
function events(state) {
  const dir = path.join(state, 'spool/events');
  return fs.existsSync(dir) ? fs.readdirSync(dir).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) : [];
}
test('hook transports stdin for Claude, Pi and Antigravity with its environment session', () => {
  const { state, env } = setup();
  for (const [kind, args, payload, expected] of [
    ['claude', ['wc-claude'], { hook_event_name: 'Stop', transcript_path: '/claude' }, { type: 'turn-ended', session: 'wc-claude', transcript_path: '/claude' }],
    ['pi', ['wc-pi'], { hook_event_name: 'agent_settled', turn: 7, entry_id: 'answer' }, { type: 'turn-ended', session: 'wc-pi', turn_id: 7, entry_id: 'answer' }],
    ['agy', [], { hookEventName: 'Stop', conversationId: 'conversation' }, { type: 'turn-ended', session: 'wc-env', conversation_id: 'conversation' }],
  ]) {
    const before = events(state).length;
    const result = spawnSync(hook, [kind, ...args], { env, input: JSON.stringify(payload), timeout: 5000 });
    assert.equal(result.status, 0, kind);
    const all = events(state); assert.equal(all.length, before + 1, kind);
    const event = all.find(e => e.session === expected.session);
    for (const [key, value] of Object.entries(expected)) assert.equal(event[key], value, `${kind} ${key}`);
  }
});
test('Codex hook takes the last argument while stdin remains open', async () => {
  const { state, env } = setup();
  const child = spawn(hook, ['codex', 'wc-codex', 'ignored', JSON.stringify({ type: 'agent-turn-complete', 'last-assistant-message': 'answer' })], { env, stdio: ['pipe', 'ignore', 'pipe'] });
  const code = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('hook waited for stdin')); }, 5000);
    child.once('error', reject); child.once('close', code => { clearTimeout(timer); resolve(code); });
  });
  assert.equal(code, 0);
  const [event] = events(state); assert.equal(event.type, 'turn-ended'); assert.equal(event.session, 'wc-codex'); assert.equal(event['last-assistant-message'], 'answer');
});
