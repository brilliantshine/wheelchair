'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const { MachineService } = require('../service'), { makeTempSync } = require('../../test-support/run-dir');

test('exact pane targets isolate stopped Claude records and redact live Claude output', async () => {
  const root = makeTempSync('pane-target-'), socket = path.join(root, 'tmux.sock');
  const tmux = args => { const r = spawnSync('tmux', ['-S', socket, ...args], { encoding: 'utf8' }); return { ok: r.status === 0, stdout: r.stdout || '', stderr: r.stderr || '' }; };
  const machine = new MachineService({ stateDir: root }); machine.tmux = tmux;
  machine.sessions['wc-x-worker'] = { name: 'wc-x-worker', cli: 'claude', status: 'stopped' };
  machine.sessions['wc-live-worker'] = { name: 'wc-live-worker', cli: 'claude' };
  machine.logins = { work: { cli: 'claude', dir: root } };
  try {
    for (const name of ['wc-x-worker-2', 'wc-login-work-2', 'wc-live-worker']) assert.ok(tmux(['new-session', '-d', '-s', name, 'printf "sibling-content sk-or-v1-0000synthetic0000"; sleep 600']).ok);
    for (let i = 0; i < 100 && !tmux(['capture-pane', '-p', '-t', '=wc-live-worker:']).stdout.includes('sibling-content'); i++) await new Promise(r => setTimeout(r, 20));
    assert.throws(() => machine.pane('wc-x-worker'), { status: 409 });
    assert.throws(() => machine.loginPane('work'), { status: 409 });
    assert.doesNotMatch(JSON.stringify(machine.loginState('work')), /sk-or-|sibling-content/);
    assert.match(machine.pane('wc-live-worker'), /\[redacted key\]/);
  } finally { tmux(['kill-server']); }
});
