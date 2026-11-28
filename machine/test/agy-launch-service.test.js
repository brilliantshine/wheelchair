'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempSync } = require('../../test-support/run-dir');
const { MachineService } = require('../service');

test('fresh Antigravity start sends fixed model and effort to tmux while retaining requested effort', async () => {
  const dir = makeTempSync('agy-service-'), bin = path.join(dir, 'bin'), worktree = path.join(dir, 'work'), log = path.join(dir, 'tmux');
  fs.mkdirSync(bin); fs.mkdirSync(worktree);
  fs.writeFileSync(path.join(bin, 'tmux'), '#!/bin/sh\nif [ "$1" = new-session ]; then printf "%s\\n" "$@" > "$FAKE_TMUX_LOG"; fi\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'systemd-run'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const old = { ...process.env };
  Object.assign(process.env, { PATH: `${bin}:${old.PATH}`, FAKE_TMUX_LOG: log, WHEELCHAIR_AGY_MODEL_SCRIPT: path.join(__dirname, 'fixtures/agy/model-launch-fake.sh'), WHEELCHAIR_MODELS: path.join(dir, 'models'), WHEELCHAIR_MODELS_CACHE: path.join(dir, 'cache'), WHEELCHAIR_AGY: path.join(dir, 'agy') });
  const adapter = require('../../connectors').machine('agy'), prepare = adapter.prepare;
  adapter.prepare = () => {};
  try {
    const machine = new MachineService({ stateDir: path.join(dir, 'state') });
    machine.config = { host: '127.0.0.1', port: 1 }; machine.checkReady = async () => {}; machine.persistSessions = async () => {}; machine.createWorktree = async () => ({ worktree }); machine.liveTmux = () => new Set();
    const session = await machine.start({ name: 'wc-test-worker', role: 'worker', cli: 'agy', thread_id: 'test', token: 'token', worktree, model: 'gemini-4-neon-low', effort: 'xhigh' });
    const argv = fs.readFileSync(log, 'utf8');
    assert.match(argv, /--model' 'gemini-4-neon' '--effort' 'high/);
    assert.equal(session.effort, 'xhigh');
    assert.equal(machine.sessions[session.name].effort, 'xhigh');
  } finally { adapter.prepare = prepare; for (const key of Object.keys(process.env)) if (!(key in old)) delete process.env[key]; Object.assign(process.env, old); }
});
