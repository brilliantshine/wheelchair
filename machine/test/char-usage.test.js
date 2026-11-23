'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { MachineService } = require('../service');
const { makeTempSync } = require('../../test-support/run-dir');
test('usage endpoint allowlist and default account checks distinguish all tools', async () => {
  const machine = new MachineService({ stateDir: makeTempSync('char-usage-') });
  machine.authorize = async () => {};
  const server = http.createServer((req, res) => machine.handle(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    for (const [cli, error] of [['claude', 'invalid default account'], ['codex', 'invalid default account'], ['kimi', 'invalid default account'], ['agy', 'invalid account or cli'], ['pi', 'invalid account or cli']]) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/usage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account: 'default-wrong', cli, dir: null }) });
      assert.equal(response.status, 400, cli); assert.equal((await response.json()).error, error, cli);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
