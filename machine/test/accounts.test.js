'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const adapters = require('../adapters');
const { limitedUntil } = require('../lib/limits');
test('exhausted windows and expired resets choose a future reset', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  const reading = { five_hour: { used: 100, resets_at: '2026-01-01T05:00:00Z' }, week: { used: 40, resets_at: '2026-01-08T00:00:00Z' } };
  assert.equal(limitedUntil(reading, now), '2026-01-01T05:00:00.000Z');
  reading.five_hour.resets_at = '2025-12-31T23:00:00Z';
  assert.equal(limitedUntil(reading, now), '2026-01-08T00:00:00.000Z');
  assert.equal(limitedUntil(null, now), '2026-01-01T01:00:00.000Z');
});
test('adapters seed account files and locate transcripts', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-accounts-'));
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
  assert.deepEqual(adapters.claude.hookEvent({ hook_event_name: 'StopFailure', error: 'broken' }), { type: 'turn-failed', error: 'broken' });
  const state = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-statusline-'));
  fs.writeFileSync(path.join(state, 'machine.json'), JSON.stringify({ host: '127.0.0.1', port: 1 }));
  const payload = JSON.stringify({ model: { display_name: 'opus' }, rate_limits: { five_hour: { used_percentage: 42, resets_at: 1800000000 } } });
  const result = spawnSync(path.join(__dirname, '../statusline.sh'), ['claude', 'wc-test-lead'], { input: payload, encoding: 'utf8', env: { ...process.env, WHEELCHAIR_STATE_DIR: state, WHEELCHAIR_SESSION_TOKEN: 'test' } });
  assert.equal(result.status, 0); assert.equal(result.stdout.trim(), 'opus · 5h 42%');
  assert.equal(fs.readdirSync(path.join(state, 'spool/events')).length, 1);
});
