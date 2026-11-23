'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { MachineService } = require('../service');
const { makeTempSync } = require('../../test-support/run-dir');
test('session and login panes scrub OpenRouter keys for all five tools', async () => {
  const machine = new MachineService({ stateDir: makeTempSync('char-redaction-') });
  machine.authorize = async () => {};
  machine.tmux = () => ({ ok: true, stdout: 'before sk-or-v1-synthetic123456 after' });
  const server = http.createServer((req, res) => machine.handle(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    for (const cli of ['claude', 'codex', 'agy', 'kimi', 'pi']) {
      const name = `wc-test-${cli}`, account = `account-${cli}`;
      machine.sessions[name] = { name, cli }; machine.logins[account] = { cli };
      for (const [url, field] of [[`/v1/sessions/${name}/pane`, 'pane'], [`/v1/logins/${account}/pane`, 'text']]) {
        const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`);
        assert.equal(response.status, 200, `${cli} ${url}`);
        assert.equal((await response.json())[field], 'before [redacted key] after', `${cli} ${url}`);
      }
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
