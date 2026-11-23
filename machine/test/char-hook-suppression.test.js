'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { MachineService } = require('../service');
const { makeTempSync } = require('../../test-support/run-dir');

test('agent hook route suppresses only Kimi and forwards every other CLI', async () => {
  const machine = new MachineService({ stateDir: makeTempSync('char-hook-suppression-') });
  let cli, forwarded;
  machine.authorize = async () => ({ name: 'wc-test', cli });
  machine.hook = async (name, body) => { forwarded = { name, body }; return { accepted: true }; };
  const server = http.createServer((req, res) => machine.handle(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    for (cli of ['claude', 'codex', 'agy', 'kimi', 'pi']) {
      forwarded = null;
      const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/agent/hooks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'turn-ended' }) });
      assert.equal(response.status, 202, cli);
      assert.deepEqual(await response.json(), cli === 'kimi' ? { ignored: true } : { accepted: true }, cli);
      assert.deepEqual(forwarded, cli === 'kimi' ? null : { name: 'wc-test', body: { type: 'turn-ended' } }, cli);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
