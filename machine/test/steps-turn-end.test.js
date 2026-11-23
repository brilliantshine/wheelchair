'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const connectors = require('../../connectors');
const machine = connectors.machine;
connectors.machine = cli => {
  const adapter = { ...machine(cli) };
  if (cli === 'codex') delete adapter.onTurnEnded;
  return adapter;
};
const { MachineService } = require('../service');
connectors.machine = machine;

test('steps flush at turn end without onTurnEnded', async () => {
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
});
