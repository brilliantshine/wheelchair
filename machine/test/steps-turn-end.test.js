'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const connectors = require('../../connectors');
const { MachineService } = require('../service');

test('steps flush at turn end without onTurnEnded', async () => {
  const adapter = connectors.machine('codex');
  const saved = adapter.onTurnEnded;
  delete adapter.onTurnEnded;
  try {
    const svc = Object.create(MachineService.prototype);
    const session = { cli: 'codex', thread_id: 't', steps_state: { open: { a: 1 } } };
    svc.managed = () => session;
    const calls = [];
    svc.readSteps = async (current, options) => calls.push({ current, options });
    svc.persistSessions = async () => {};
    svc.emitEvent = async () => {};
    await svc.hook('wc-test', { type: 'turn-ended' });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].options, { spoolOnly: false, flush: true });
    assert.deepEqual(session.steps_state, { open: {}, yielded: null });
  } finally { adapter.onTurnEnded = saved; }
});
