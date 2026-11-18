'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempSync } = require('../../test-support/run-dir');
const kimi = require('../adapters/kimi');
const { MachineService } = require('../service');
function fixture() {
  const dir = makeTempSync('kimi-'); fs.mkdirSync(path.join(dir, 'credentials'));
  fs.writeFileSync(path.join(dir, 'credentials', 'dummy.json'), '{}');
  fs.writeFileSync(path.join(dir, 'config.toml'), `default_model = "kimi-code/k3"\n[services.search.oauth]\nkey = "oauth/wrong"\n[providers."managed:kimi-code".oauth]\noauth_host = "https://auth.kimi.ai"\nkey = "oauth/dummy"\n[models."kimi-code/k3"]\nsupport_efforts = [ "low", "high", "max" ]\n[models."kimi-code/light"]\nmodel = "light"\n`); return dir;
}
test('Kimi config, authentication, region, and effort', () => {
  const dir = fixture(); assert.deepEqual(kimi.loginStatus(dir), { logged_in: true, authenticated: true });
  assert.deepEqual(kimi.command({}, { effort: 'medium' }, '', { accountDir: dir }).env, { KIMI_MODEL_THINKING_EFFORT: 'high' });
  assert.equal(kimi.command({ model: 'kimi-code/light' }, { effort: 'max' }, '', { accountDir: dir }).env, undefined);
  const file = path.join(dir, 'config.toml'); fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('auth.kimi.ai', 'auth.kimi.com'));
  assert.match(kimi.loginStatus(dir).problem, /China/);
  fs.appendFileSync(file, '\nvalue = """\n[providers."managed:kimi-code".oauth]\n"""\n');
  assert.equal(kimi.loginStatus(dir).authenticated, true); assert.match(kimi.loginStatus(dir).problem, /multi-line/);
  fs.unlinkSync(file); fs.mkdirSync(file); assert.match(kimi.loginStatus(dir).problem, /can't be read/);
  assert.deepEqual(kimi.loginStatus(makeTempSync('kimi-empty-')), { logged_in: false, authenticated: false });
});
test('Kimi prompts and role message', () => {
  assert.deepEqual(kimi.answerPrompts({}, 'Trust this folder?\n❯ Trust and continue'), { step: 'trust', keys: ['Enter'] });
  assert.deepEqual(kimi.answerPrompts({}, 'Trust this folder?\n❯ Exit'), { step: 'trust-select', keys: ['Up'] });
  assert.match(kimi.firstMessage({ role: 'worker' }, '/prompt', 'wc-name'), /Session: wc-name/);
  assert.deepEqual(kimi.parseLogin('Opening browser for Kimi device login: https://kimi.ai/device\npaste the URL above and enter code: ABCD'), { url: 'https://kimi.ai/device', code: 'ABCD', wantsCode: false });
});
test('Kimi login results persist and require successful exit', () => {
  const dir = fixture(); const machine = Object.create(MachineService.prototype); machine.logins = { team: { cli: 'kimi', dir } };
  machine.tmux = args => { assert.equal(args.at(-1), '=wc-login-team:'); return { ok: true, stdout: '__wc_login_exit 0' }; };
  assert.equal(machine.loginState('team').state, 'done'); machine.tmux = () => ({ ok: false }); assert.equal(machine.loginState('team').state, 'done');
  machine.logins.team = { cli: 'kimi', dir }; machine.tmux = () => ({ ok: true, stdout: '__wc_login_exit 1' }); assert.equal(machine.loginState('team').state, 'failed');
  machine.logins.team = { cli: 'kimi', dir }; machine.tmux = () => ({ ok: false }); machine.liveTmux = () => null; assert.equal(machine.loginState('team').state, 'waiting');
});
test('version floor follows the resolved binary and its mtime', () => {
  const dir = makeTempSync('kimi-bin-'), file = path.join(dir, 'kimi'), old = process.env.PATH;
  try {
    fs.writeFileSync(file, '#!/bin/sh\necho 2.6.2\n', { mode: 0o755 }); process.env.PATH = `${dir}:${old}`;
    const machine = Object.create(MachineService.prototype);
    assert.match(machine.cliStatus('kimi', { logged_in: true }).problem, /found 2.6.2/);
    fs.writeFileSync(file, '#!/bin/sh\necho 2.6.3\n'); fs.utimesSync(file, new Date(), new Date(Date.now() + 2000));
    assert.equal(machine.cliStatus('kimi', { logged_in: true }).logged_in, true);
    assert.equal(kimi.loginCommand()[0], file); assert.equal(kimi.command({}, {}, '', { accountDir: dir }).argv[0], file);
  } finally { process.env.PATH = old; }
});
