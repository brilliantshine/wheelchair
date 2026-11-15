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

test('normalization supplies defaults and all plan weights', () => {
  const plans = [['claude', 'pro', 1], ['claude', 'max5', 5], ['claude', 'max20', 20], ['gpt', 'plus', 1], ['gpt', 'pro', 6], ['gpt', 'unknown', 1]];
  const value = settings.defaults();
  value.accounts = plans.map(([provider, plan], i) => ({ ...account, id: `p${i}`, provider, plan, weight: undefined }));
  value.accounts.push({ ...account, id: 'explicit', weight: 42 });
  const normalized = settings.normalize(value);
  for (const [i, [, , weight]] of plans.entries()) assert.equal(normalized.accounts.find(a => a.id === `p${i}`).weight, weight);
  assert.equal(normalized.accounts.find(a => a.id === 'explicit').weight, 42);
  for (const provider of ['claude', 'gpt']) assert.equal(normalized.accounts.filter(a => a.id === `default-${provider}`).length, 1);
  const duplicate = settings.normalize({ ...normalized, accounts: [...normalized.accounts, ...normalized.accounts.filter(a => a.id.startsWith('default-'))] });
  for (const provider of ['claude', 'gpt']) assert.equal(duplicate.accounts.filter(a => a.id === `default-${provider}`).length, 1);
  for (const key of settings.BALANCING) assert.deepEqual(settings.normalize(normalized)[key], normalized[key]);
});

test('room boundaries, windows, forecast and margin', () => {
  const future = { used: 22, resets_at: reset };
  assert.deepEqual(usage.effective({ week: future }, now).week, future);
  const opts = { loggedIn: true, leave: 10, now };
  assert.equal(usage.hasRoom(account, { ...reading, limited_until: '2026-01-01T00:00:00Z' }, opts), true);
  assert.equal(usage.hasRoom(account, { ...reading, week: { used: 89.99, resets_at: reset } }, opts), true);
  assert.equal(usage.hasRoom(account, null, opts), true);
  const f = usage.forecast([account], { a: reading }, now);
  assert.equal(f.pace, 0.5 / 84);
  assert.equal(usage.belowMargin(f, 1, now), true);
  assert.equal(usage.belowMargin(f, 0, now), false);
  const weighted = usage.forecast([{ ...account, weight: 5 }, { ...account, id: 'b' }], { a: { ...reading, week: { used: 20, resets_at: reset } }, b: { ...reading, week: { used: 80, resets_at: reset } } }, now);
  assert.equal(weighted.used, (5 * 0.2 + 0.8) / 6);
  assert.equal(usage.forecast([{ ...account, paused: true }], { a: reading }, now).amber, false);
});

test('rank chooses by reset, weighted room, live sessions and last choice and explains skips', () => {
  const a = account, b = { ...account, id: 'b' }, c = { ...account, id: 'c' };
  const state = { hub: { reachable: true, accounts: { a: true, b: true, c: true } } };
  const later = '2026-01-09T00:00:00Z';
  const values = { a: { ...reading, week: { used: 50, resets_at: later } }, b: reading };
  const pick = (rows, reads, opts, last) => usage.rank(rows, reads, state, { ...settings.defaults(), ...opts }, 'hub', now, last).find(x => x.next)?.id;
  assert.equal(pick([a, b, c], values, {}), 'b');
  assert.equal(pick([a, { ...b, weight: 5 }], values, { within: 'spread' }), 'b');
  assert.equal(pick([{ ...a, live_sessions: 2 }, { ...b, live_sessions: 1 }], values, { within: 'spread' }), 'b');
  assert.equal(pick([a, b], values, { within: 'one' }, 'a'), 'a');
  assert.equal(pick([{ ...a, paused: true }, b], values, { within: 'one' }, 'a'), 'b');
  const denied = usage.rank([{ ...a, paused: true }, b, c, { ...a, id: 'd' }], { c: { ...reading, limited_until: reset }, d: { ...reading, week: { used: 90, resets_at: reset } } }, { hub: { accounts: { a: true, b: false, c: true, d: true } } }, settings.defaults(), 'hub', now);
  assert.equal(denied[0].reason, 'skipped: paused');
  assert.equal(denied[1].reason, 'skipped: signed out on hub');
  assert.equal(denied[2].reason, `skipped: limit until ${new Date(reset).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`);
  assert.equal(denied[3].reason, 'skipped: under the 10% left for you');
});

test('record serializes readings and chosen accounts', async () => {
  const fs = require('node:fs/promises'); const os = require('node:os'); const path = require('node:path');
  const { State } = require('../app/state.js');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'usage-test-'));
  const hub = { state: new State(dir) };
  await usage.record(hub, reading);
  await usage.record(hub, { ...reading, at: '2025-01-01T00:00:00Z', week: null });
  assert.deepEqual((await usage.readings(hub)).a, reading);
  const newer = { ...reading, at: '2027-01-01T00:00:00Z' };
  await Promise.all([usage.record(hub, newer), usage.recordChosen(hub, 'claude', 'a'), usage.recordChosen(hub, 'gpt', 'b')]);
  assert.deepEqual((await usage.readings(hub)).a, newer);
  assert.deepEqual(await usage.lastChosen(hub), { claude: 'a', gpt: 'b' });
});

test('Ready rejects paused accounts and preserves old Codex preflight', async () => {
  const value = settings.defaults(); value.accounts[0].paused = true;
  const status = { version: 'v', claude: { installed: true, logged_in: true }, codex: { installed: false }, accounts: [{ id: 'default-claude', cli: 'claude', logged_in: true }] };
  let preflight = false;
  const hub = { codeVersion: 'v', state: { settings: async () => value }, call: async (_m, path) => { if (path === '/v1/preflight') { preflight = true; throw Error('failed'); } return status; } };
  const result = await ready.check(hub, { cli: 'claude', machine: 'hub' });
  assert.equal(result.ok, false); assert.match(result.missing[0], /claude/);
  delete status.accounts; status.claude.installed = false; status.codex.installed = true;
  const old = await ready.check(hub, { cli: 'codex', machine: 'hub' });
  assert.equal(preflight, true); assert.match(old.missing[0], /Codex preflight failed/);
});

test('account route assigns unique slugs and resets weight on plan change', async () => {
  const ctx = await setup();
  try {
    const add = () => api(ctx, '/settings/accounts', { method: 'POST', body: { provider: 'claude', name: 'Same Name', plan: 'max5' } });
    const first = await add(), second = await add();
    assert.equal(first.body.id, 'same-name'); assert.equal(second.body.id, 'same-name-2');
    const update = await api(ctx, `/settings/accounts/${first.body.id}`, { method: 'PUT', body: { plan: 'max20' } });
    assert.equal(update.body.weight, 20);
    assert.equal((await api(ctx, '/settings/accounts/absent', { method: 'PUT', body: { name: 'x' } })).status, 404);
  } finally { await close(ctx); }
});

test('usage endpoints expose machine state, sessions and alert weeks', async () => {
  const fs = require('node:fs/promises'), path = require('node:path');
  const ctx = await setup();
  try {
    ctx.machine.status.accounts = [{ id: 'default-claude', cli: 'claude', logged_in: true }];
    const machinesPath = path.join(ctx.state, 'machines.json');
    const machines = JSON.parse(await fs.readFile(machinesPath));
    machines.offline = { name: 'offline', address: '127.0.0.1', port: 1, secret: 'test' };
    await fs.writeFile(machinesPath, JSON.stringify(machines));
    await fs.mkdir(path.join(ctx.state, 'threads'), { recursive: true });
    await fs.writeFile(path.join(ctx.state, 'threads', 'usage-test.json'), JSON.stringify({ id: 'usage-test', sessions: [{ live: true, account: 'default-claude' }, { live: false, account: 'default-claude' }, { live: true, account: 'default-gpt' }] }));
    const future = new Date(Date.now() + 48 * 3600000).toISOString();
    const data = { readings: { 'default-claude': { account: 'default-claude', at: new Date().toISOString(), week: { used: 90, resets_at: future }, five_hour: null } }, seen: {} };
    await fs.writeFile(path.join(ctx.state, 'usage.json'), JSON.stringify(data));
    const result = await api(ctx, '/usage');
    assert.equal(result.status, 200);
    const provider = result.body.providers.claude, row = provider.accounts[0];
    for (const key of ['label', 'left', 'amber', 'runs_out_at', 'first_refill', 'below_notify', 'all_paused', 'accounts']) assert.ok(Object.hasOwn(provider, key), key);
    for (const key of ['id', 'name', 'plan', 'weight', 'paused', 'machines', 'reading', 'next', 'reason', 'live_sessions']) assert.ok(Object.hasOwn(row, key), key);
    assert.equal(row.machines.hub, 'signed_in'); assert.equal(row.machines.offline, 'unknown'); assert.equal(row.live_sessions, 1);
    assert.equal((await api(ctx, '/usage/alert')).body.dot, true);
    assert.equal((await api(ctx, '/usage/seen', { method: 'POST', body: {} })).status, 200);
    assert.equal((await api(ctx, '/usage/alert')).body.dot, false);
    const saved = JSON.parse(await fs.readFile(path.join(ctx.state, 'usage.json')));
    saved.readings['default-claude'].week.resets_at = new Date(Date.now() + 72 * 3600000).toISOString();
    await fs.writeFile(path.join(ctx.state, 'usage.json'), JSON.stringify(saved));
    assert.equal((await api(ctx, '/usage/alert')).body.dot, true);
  } finally { await close(ctx); }
});

test('sign-in proxies forward the account, machine path and payload', async () => {
  const http = require('node:http'), fs = require('node:fs/promises'), path = require('node:path');
  const calls = [];
  const service = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    calls.push({ path: req.url, method: req.method, body: raw ? JSON.parse(raw) : {} });
    res.writeHead(req.method === 'POST' && req.url === '/v1/logins' ? 201 : 200, { 'content-type': 'application/json' }); res.end('{}');
  });
  await new Promise(resolve => service.listen(0, '127.0.0.1', resolve));
  const ctx = await setup();
  try {
    const machinesPath = path.join(ctx.state, 'machines.json');
    const machines = JSON.parse(await fs.readFile(machinesPath));
    machines.test = { name: 'test', address: '127.0.0.1', port: service.address().port, secret: 'test' };
    await fs.writeFile(machinesPath, JSON.stringify(machines));
    const added = await api(ctx, '/settings/accounts', { method: 'POST', body: { provider: 'gpt', name: 'Second', plan: 'pro' } });
    assert.equal((await api(ctx, '/accounts/default-claude/signin', { method: 'POST', body: { machine: 'test' } })).status, 201);
    assert.deepEqual(calls.at(-1).body, { account: 'default-claude', cli: 'claude', dir: null });
    assert.equal((await api(ctx, '/accounts/second/signin', { method: 'POST', body: { machine: 'test' } })).status, 201);
    assert.equal(added.body.id, 'second');
    assert.deepEqual(calls.at(-1).body, { account: 'second', cli: 'codex', dir: '~/.wheelchair/accounts/second' });
    for (const [suffix, method, body] of [['', 'GET'], ['/code', 'POST', { code: '123' }], ['/pane', 'GET'], ['/keys', 'POST', { keys: 'Enter' }]]) {
      assert.equal((await api(ctx, `/accounts/second/signin/test${suffix}`, { method, body })).status, 200);
      assert.equal(calls.at(-1).path, `/v1/logins/second${suffix}`);
      assert.equal(calls.at(-1).method, method);
      if (body) assert.deepEqual(calls.at(-1).body, body);
    }
    assert.equal((await api(ctx, '/accounts/absent/signin', { method: 'POST', body: { machine: 'test' } })).status, 404);
    assert.equal((await api(ctx, '/accounts/second/signin', { method: 'POST', body: { machine: 'absent' } })).status, 404);
  } finally { await close(ctx); await new Promise(resolve => service.close(resolve)); }
});
