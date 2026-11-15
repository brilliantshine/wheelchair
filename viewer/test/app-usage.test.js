'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const usage = require('../app/usage.js');
const settings = require('../app/settings.js');
const ready = require('../app/ready.js');
const { transcriptItems } = require('../app/chat.js');
const { api, close, setup } = require('./helpers/app.js');
const now = Date.parse('2026-01-04T12:00:00Z');
const reset = '2026-01-08T00:00:00.000Z';
const account = { id: 'a', provider: 'claude', name: 'A', plan: 'pro', weight: 1, paused: false };
const reading = { account: 'a', at: new Date(now).toISOString(), week: { used: 50, resets_at: reset }, five_hour: null };
test('account normalization and balancing settings survive round trip', () => {
  const value = settings.defaults(); value.accounts.push({ ...account, id: 'other', plan: 'max5', weight: undefined }); value.accounts.push(value.accounts[0]);
  const normalized = settings.normalize(value);
  assert.equal(normalized.accounts.filter((a) => a.id === 'default-claude').length, 1);
  assert.equal(normalized.accounts.find((a) => a.id === 'other').weight, 5);
  assert.deepEqual(settings.normalize(normalized), normalized);
});
test('effective windows, room and forecasts', () => {
  assert.deepEqual(usage.effective({ week: { used: 90, resets_at: '2026-01-01T00:00:00Z' } }, now).week, { used: 0, resets_at: null });
  const options = { loggedIn: true, leave: 10, now };
  assert.equal(usage.hasRoom(account, reading, options), true);
  assert.equal(usage.hasRoom({ ...account, paused: true }, reading, options), false);
  assert.equal(usage.hasRoom(account, reading, { ...options, loggedIn: false }), false);
  assert.equal(usage.hasRoom(account, { ...reading, limited_until: reset }, options), false);
  assert.equal(usage.hasRoom(account, { ...reading, week: { used: 90, resets_at: reset } }, options), false);
  const f = usage.forecast([account], { a: reading }, now);
  assert.equal(f.left, 0.5); assert.equal((Date.parse(f.runs_out_at) - now) / 3600000, 84); assert.equal(f.amber, false);
  assert.equal(usage.forecast([account], { a: { ...reading, week: { used: 90, resets_at: reset } } }, now).amber, true);
  assert.equal(usage.forecast([{ ...account, paused: true }], { a: reading }, now).all_paused, true);
  const noReset = usage.forecast([account], { a: { ...reading, week: { used: 90, resets_at: null } } }, now);
  assert.equal(noReset.amber, false); assert.equal(usage.belowMargin(noReset, 100, now), false);
});
test('ranking and unknown transcript', () => {
  const accounts = [account, { ...account, id: 'b', paused: true }, { ...account, id: 'c' }];
  const ranked = usage.rank(accounts, { a: reading }, { hub: { reachable: true, accounts: { a: true, b: true, c: false } } }, settings.defaults(), 'hub', now);
  assert.deepEqual(ranked.map((a) => a.reason), ['next: refills soonest', 'skipped: paused', 'skipped: signed out on hub']);
  const state = { hub: { reachable: true, accounts: { a: true, b: true, c: true } } };
  const one = { ...settings.defaults(), within: 'one' };
  assert.equal(usage.rank(accounts, { a: reading }, state, one, 'hub', now, { claude: 'c' }).find((a) => a.next).id, 'c');
  assert.equal(usage.rank(accounts, { a: reading }, state, one, 'hub', now, 'b').find((a) => a.next).id, 'a');
  assert.match(transcriptItems('other', '{}', {})[0].text, /has no transcript reader/);
});
test('Ready accepts a second signed-in account and old service status', async () => {
  const value = settings.defaults(); value.accounts.push({ ...account });
  const status = { version: 'v', claude: { installed: true, logged_in: false }, codex: { installed: false }, accounts: [{ id: 'a', cli: 'claude', logged_in: true }] };
  const hub = { codeVersion: 'v', state: { settings: async () => value }, call: async () => status };
  assert.equal((await ready.check(hub, { cli: 'claude', machine: 'hub' })).ok, true);
  delete status.accounts; status.claude.logged_in = true;
  assert.equal((await ready.check(hub, { cli: 'claude', machine: 'hub' })).ok, true);
});
test('account and balancing routes and usage shape', async () => {
  const ctx = await setup();
  try {
    const add = await api(ctx, '/settings/accounts', { method: 'POST', body: { provider: 'claude', name: 'My Account', plan: 'max5' } });
    assert.equal(add.status, 201); assert.equal(add.body.weight, 5);
    for (const body of [{ provider: 'bad', name: 'a', plan: 'pro' }, { provider: 'gpt', name: '', plan: 'pro' }, { provider: 'gpt', name: 'x', plan: 'max5' }]) assert.equal((await api(ctx, '/settings/accounts', { method: 'POST', body })).status, 400);
    for (const body of [{ name: '' }, { plan: 'plus' }, { weight: 0 }, { paused: 'yes' }]) assert.equal((await api(ctx, `/settings/accounts/${add.body.id}`, { method: 'PUT', body })).status, 400);
    assert.equal((await api(ctx, '/settings/accounts/default-claude', { method: 'DELETE' })).status, 400);
    for (const body of [{ lead_order: ['any', 'claude'] }, { lead_order: ['gpt', 'gpt'] }, { worker_order: ['any'] }, { worker_order: ['bad'] }, { within: 'bad' }, { leave: -1 }, { notify_below: 101 }, { margin: '5' }, { save_claude_for_leads: 1 }]) assert.equal((await api(ctx, '/settings/balancing', { method: 'PUT', body })).status, 400);
    const result = await api(ctx, '/usage'); assert.equal(result.status, 200); assert.equal(result.body.providers.claude.accounts.length, 2); assert.ok(result.body.providers.gpt.accounts[0].machines.hub);
  } finally { await close(ctx); }
});
