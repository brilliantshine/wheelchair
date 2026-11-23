'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ready = require('../app/ready');

test('readiness uses each CLI login and reserves preflight for Codex', async () => {
  for (const [cli, label] of [['claude', 'Claude'], ['codex', 'GPT'], ['agy', 'Antigravity'], ['kimi', 'Kimi Code'], ['pi', 'OpenRouter']]) {
    const calls = [];
    const hub = { codeVersion: 'v1', call: async (_machine, route) => {
      calls.push(route);
      if (route === '/v1/preflight') throw new Error('no login');
      return { version: 'v1', [cli]: { installed: true, logged_in: false } };
    } };
    assert.deepEqual(await ready.check(hub, { machine: 'test-machine', cli }), { ok: false, missing: [`test-machine: ${cli === 'codex' ? 'Codex preflight failed' : `${label} is not logged in`}`] }, cli);
    assert.deepEqual(calls, cli === 'codex' ? ['/v1/status', '/v1/preflight'] : ['/v1/status'], cli);
    hub.call = async (_machine, route) => route === '/v1/status' ? { version: 'v1', [cli]: { installed: true, logged_in: true } } : {};
    assert.deepEqual(await ready.check(hub, { machine: 'test-machine', cli }), { ok: true, missing: [] }, cli);
  }
});
