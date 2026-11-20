'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), http = require('node:http');
const { MachineService } = require('../service'), { makeTempSync } = require('../../test-support/run-dir');
test('code submission uses exact targets, cleans buffers on success and failure, and checks only Pi prompts', async () => {
  const machine = new MachineService({ stateDir: makeTempSync('code-submit-') }); machine.authorize = async () => {}; machine.logins = { work: { cli: 'pi' }, other: { cli: 'claude' } };
  let pane = 'Enter OpenRouter API key:', fail = false; const calls = [], buffers = new Set();
  machine.tmux = (args) => { calls.push(args); switch (args[0]) { case 'capture-pane': return { ok: true, stdout: pane }; case 'load-buffer': buffers.add(args[2]); break; case 'paste-buffer': if (fail) return { ok: false }; buffers.delete(args[args.indexOf('-b') + 1]); break; case 'delete-buffer': buffers.delete(args[2]); break; } return { ok: true, stdout: '' }; };
  const server = http.createServer((req, res) => machine.handle(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const post = async account => fetch(`http://127.0.0.1:${server.address().port}/v1/logins/${account}/code`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'sk-or-v1-0000synthetic0000' }) });
  try {
    assert.equal((await post('work')).status, 200); assert.equal(buffers.size, 0); assert.ok(calls.some(a => a[0] === 'paste-buffer' && a.includes('-d') && a.includes('=wc-login-work:')));
    fail = true; assert.equal((await post('work')).status, 409); assert.equal(buffers.size, 0); assert.ok(calls.some(a => a[0] === 'delete-buffer'));
    fail = false; pane = 'screen changed'; assert.equal((await post('work')).status, 409); assert.equal((await post('other')).status, 200); assert.ok(calls.some(a => a[0] === 'paste-buffer' && a.includes('=wc-login-other:')));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
