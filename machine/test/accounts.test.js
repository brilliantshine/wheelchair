'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const adapters = require('../adapters');
const { limitedUntil } = require('../lib/limits');
const { makeTempSync } = require('../../test-support/run-dir');
test('exhausted windows and expired resets choose a future reset', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  const reading = { five_hour: { used: 100, resets_at: '2026-01-01T05:00:00Z' }, week: { used: 40, resets_at: '2026-01-08T00:00:00Z' } };
  assert.equal(limitedUntil(reading, now), '2026-01-01T05:00:00.000Z');
  reading.five_hour.resets_at = '2025-12-31T23:00:00Z';
  assert.equal(limitedUntil(reading, now), '2026-01-08T00:00:00.000Z');
  assert.equal(limitedUntil(null, now), '2026-01-01T01:00:00.000Z');
});
test('adapters seed account files and locate transcripts', async () => {
  const root = makeTempSync('wc-accounts-');
  for (const cli of ['claude', 'codex']) {
    const dir = path.join(root, cli); adapters[cli].seed(dir, cli);
    assert.equal(fs.statSync(dir).mode & 0o777, 0o700);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'wheelchair-account.json'))), { id: cli, cli });
    const file = cli === 'claude' ? path.join(dir, 'projects', 'project', 'session.jsonl') : path.join(dir, 'sessions', '2026', 'rollout-thread.jsonl');
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, '');
    assert.equal(await adapters[cli].findTranscript({ cli_session_id: 'session', codex_thread_id: 'thread' }, dir), file);
    if (cli === 'codex') assert.match(fs.readFileSync(path.join(dir, 'config.toml'), 'utf8'), /cli_auth_credentials_store = "file"/);
  }
});
test('Codex rollout fixture maps windows by their lengths', () => {
  const line = fs.readFileSync(path.join(__dirname, 'fixtures/codex-rate-limits.jsonl'), 'utf8');
  const raw = JSON.parse(line); const reading = adapters.codex.usageFrom(line);
  assert.ok(reading); for (const window of [raw.payload.rate_limits.primary, raw.payload.rate_limits.secondary]) {
    if (window?.window_minutes === 300) assert.equal(reading.five_hour.used, window.used_percent);
    if (window?.window_minutes === 10080) assert.equal(reading.week.used, window.used_percent);
  }
});
test('Claude failure hooks and status line survive an offline service', () => {
  assert.equal(adapters.claude.hookEvent({ hook_event_name: 'StopFailure', error: 'rate_limit' }).type, 'limit-hit');
  assert.equal(adapters.claude.hookEvent({ hook_event_name: 'StopFailure', error_type: 'rate_limit' }).type, 'limit-hit');
  assert.deepEqual(adapters.claude.hookEvent({ hook_event_name: 'StopFailure', error: 'broken' }), { type: 'turn-failed', error: 'broken' });
  const state = makeTempSync('wc-statusline-');
  fs.writeFileSync(path.join(state, 'machine.json'), JSON.stringify({ host: '127.0.0.1', port: 1 }));
  const payload = JSON.stringify({ model: { display_name: 'opus' }, rate_limits: { five_hour: { used_percentage: 42, resets_at: 1800000000 } } });
  const result = spawnSync(path.join(__dirname, '../statusline.sh'), ['claude', 'wc-test-lead'], { input: payload, encoding: 'utf8', env: { ...process.env, WHEELCHAIR_STATE_DIR: state, WHEELCHAIR_SESSION_TOKEN: 'test' } });
  assert.equal(result.status, 0); assert.equal(result.stdout.trim(), 'opus · 5h 42%');
  assert.equal(fs.readdirSync(path.join(state, 'spool/events')).length, 1);
});
test('captured login screens parse wrapped URLs and device codes', () => {
  const fixture = name => fs.readFileSync(path.join(__dirname, 'fixtures/login', name), 'utf8');
  const claude = adapters.claude.parseLogin(fixture('claude.txt'));
  assert.equal(claude.wantsCode, true); assert.match(claude.url, /code_challenge=AAA/); assert.ok(claude.url.endsWith('BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'));
  assert.deepEqual(adapters.claude.loginPrompt(fixture('claude-menu.txt')), ['Enter']);
  assert.equal(adapters.claude.loginPrompt(fixture('claude.txt')), null);
  assert.equal(adapters.claude.parseLogin(fixture('claude-menu.txt')), null);
  assert.deepEqual(adapters.codex.parseLogin(fixture('codex.txt')), { url: 'https://auth.openai.com/codex/device', code: 'ABCD-12345', wantsCode: false });
});
test('seed links instruction files and preserves existing Codex configuration', () => {
  const root = makeTempSync('wc-seed-');
  const prev = { CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR, CODEX_HOME: process.env.CODEX_HOME };
  try {
    for (const [cli, env, name] of [['claude', 'CLAUDE_CONFIG_DIR', 'CLAUDE.md'], ['codex', 'CODEX_HOME', 'AGENTS.md']]) {
      const usual = path.join(root, cli + '-usual'), dir = path.join(root, cli); fs.mkdirSync(usual); fs.mkdirSync(dir);
      fs.writeFileSync(path.join(usual, name), 'instructions'); process.env[env] = usual;
      if (cli === 'codex') fs.writeFileSync(path.join(dir, 'config.toml'), 'existing');
      adapters[cli].seed(dir, cli); assert.equal(fs.readlinkSync(path.join(dir, name)), path.join(usual, name));
      if (cli === 'codex') assert.equal(fs.readFileSync(path.join(dir, 'config.toml'), 'utf8'), 'existing');
    }
  } finally { for (const k of Object.keys(prev)) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; } }
});
test('Codex maps both quota windows and reached flag', () => {
  const reading = adapters.codex.usageFrom({ payload: { rate_limits: { primary: { window_minutes: 300, used_percent: 100, resets_at: 1800000000 }, secondary: { window_minutes: 10080, used_percent: 23, resets_at: 1800100000 }, rate_limit_reached_type: 'primary' } } });
  assert.equal(reading.five_hour.used, 100); assert.equal(reading.week.used, 23); assert.equal(reading.reached, true);
});

test('Antigravity screens, hooks, binding and command', () => {
  const a = adapters.agy, fixture = name => fs.readFileSync(path.join(__dirname, 'fixtures/agy', name), 'utf8');
  for (const name of ['login-link-wrapped.txt', 'login-link-joined.txt']) {
    const pane = fixture(name).replace('[OAuth URL redacted]', 'https://accounts.google.com/oauth?abc=123');
    const sample = `${pane}\npaste the authorization code below`;
    const parsed = a.parseLogin(sample); assert.match(parsed.url, /^https:\/\/accounts\.google\.com\//); assert.equal(parsed.wantsCode, true);
  }
  const steps = { 'login-menu.txt': ['method', ['Enter']], 'onboard-1-theme.txt': ['theme', ['Enter']], 'onboard-2-data.txt': ['data', ['Enter', 'Down', 'Right', 'Enter']], 'onboard-3-trust.txt': ['trust', ['Enter']] };
  for (const [name, [step, keys]] of Object.entries(steps)) assert.deepEqual(a.loginPrompt(fixture(name)), { step, keys });
  for (const name of ['idle.txt', 'login-link-joined.txt']) assert.equal(a.loginPrompt(fixture(name)), null);
  for (const name of ['login-success.txt', 'onboard-1-theme.txt', 'onboard-2-data.txt', 'onboard-3-trust.txt']) {
    assert.equal(a.loginDone(fixture(name)), false); assert.equal(a.readyText({}, fixture(name)), false);
    assert.equal(a.loginDone(fixture(name) + '\n? for shortcuts'), false); assert.equal(a.readyText({}, fixture(name) + '\n? for shortcuts'), false);
  }
  assert.equal(a.loginDone(fixture('idle.txt')), true);
  assert.equal(a.loginDone(fixture('login-link-joined.txt')), false);
  assert.equal(a.readyText({}, fixture('idle.txt')), true);
  for (const name of ['permission-prompt.txt', 'trust-prompt.txt']) assert.equal(a.readyText({}, fixture(name)), false);
  assert.equal(a.promptText(fixture('permission-prompt.txt')), true); assert.equal(a.promptText(fixture('idle.txt')), false);
  const raw = name => JSON.parse(fixture(name));
  for (const name of ['stop.json', 'stop-tools.json']) assert.equal(a.hookEvent(raw(name)).type, 'turn-ended');
  assert.equal(a.hookEvent({ ...raw('stop.json'), terminationReason: 'max_steps_exceeded' }).type, 'turn-ended');
  assert.equal(a.hookEvent({ ...raw('stop.json'), terminationReason: 'error', error: 'quota' }).type, 'limit-hit');
  assert.equal(a.hookEvent({ ...raw('stop.json'), terminationReason: 'error', error: 'broken' }).type, 'turn-failed');
  assert.equal(a.hookEvent({ hookEventName: 'Other' }), null);
  const session = {}; assert.deepEqual(a.onTurnEnded(session, a.hookEvent(raw('stop-tools.json'))), { ignored: true });
  assert.deepEqual(a.onTurnEnded(session, a.hookEvent(raw('stop-role.json'))), {});
  assert.deepEqual(a.onTurnEnded(session, { conversation_id: 'different' }), { ignored: true });
  const ctx = { stateDir: '/state' }, base = { name: 'wc-test', effort: 'high' };
  const auto = a.command({ role: 'reviewer', model: 'model' }, base, '/work', ctx);
  assert.deepEqual(auto.settings, { trustedWorkspaces: ['/work'] });
  assert.deepEqual(auto.argv, ['agy', '--settings', '/state/settings/wc-test.json', '--mode', 'auto', '--model', 'model', '--effort', 'high']);
  assert.deepEqual(a.command({}, { ...base, permission_mode: 'bypass' }, '/work', ctx).argv.slice(3, 4), ['--dangerously-skip-permissions']);
});

test('Antigravity hooks merge atomically and reject invalid JSON', () => {
  const home = makeTempSync('wc-agy-home-'), previous = process.env.HOME; process.env.HOME = home;
  try {
    const file = path.join(home, '.gemini/config/hooks.json'); adapters.agy.prepare();
    const wanted = JSON.parse(fs.readFileSync(file)); assert.ok(wanted.wheelchair.Stop);
    fs.writeFileSync(file, JSON.stringify({ another: { value: 1 } })); adapters.agy.prepare();
    assert.deepEqual(JSON.parse(fs.readFileSync(file)).another, { value: 1 });
    fs.writeFileSync(file, '{bad'); assert.throws(() => adapters.agy.prepare(), /Couldn't update Antigravity's hooks file/); assert.equal(fs.readFileSync(file, 'utf8'), '{bad');
  } finally { if (previous === undefined) delete process.env.HOME; else process.env.HOME = previous; }
});

test('Antigravity hook spools using the session environment', () => {
  const state = makeTempSync('wc-agy-hook-'), hook = path.join(__dirname, '../hook.sh');
  fs.writeFileSync(path.join(state, 'machine.json'), JSON.stringify({ host: '127.0.0.1', port: 1 }));
  const env = { ...process.env, WHEELCHAIR_STATE_DIR: state, WHEELCHAIR_SESSION_TOKEN: 'test', WHEELCHAIR_SESSION_NAME: 'wc-test-lead' };
  const input = fs.readFileSync(path.join(__dirname, 'fixtures/agy/stop-role.json'));
  assert.equal(spawnSync(hook, ['agy'], { env, input }).status, 0);
  const spool = path.join(state, 'spool/events'); assert.equal(JSON.parse(fs.readFileSync(path.join(spool, fs.readdirSync(spool)[0]))).session, 'wc-test-lead');
  delete env.WHEELCHAIR_SESSION_NAME; assert.equal(spawnSync(hook, ['agy'], { env, input }).status, 0);
  for (const cli of ['claude', 'codex']) assert.notEqual(spawnSync(hook, [cli], { env, input }).status, 0);
});
