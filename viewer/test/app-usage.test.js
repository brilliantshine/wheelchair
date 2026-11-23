'use strict';

const { makeTemp } = require('../../test-support/run-dir');
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
  const old = { ...normalized }; delete old.held_back;
  assert.deepEqual(settings.normalize(old).held_back, { worker: true, reviewer: true, verifier: true, mapper: true, designer: true });
  assert.deepEqual(settings.normalize({ ...old, held_back: {} }).held_back, settings.defaults().held_back);
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
    for (const body of [{ lead_order: [] }, { worker_order: [] }, { lead_order: ['any', 'claude'] }, { lead_order: ['gpt', 'gpt'] }, { worker_order: ['any'] }, { worker_order: ['bad'] }, { within: 'bad' }, { leave: -1 }, { notify_below: 101 }, { margin: '5' }, { save_claude_for_leads: 1 }, { held_back: { worker: true, reviewer: true, verifier: true } }, { held_back: { worker: true, reviewer: true, verifier: true, mapper: true, designer: true, extra: true } }, { held_back: { worker: true, reviewer: 'yes', verifier: true, mapper: true, designer: true } }, { held_back: [] }]) assert.equal((await api(ctx, '/settings/balancing', { method: 'PUT', body })).status, 400);
    assert.equal((await api(ctx, '/settings/balancing', { method: 'PUT', body: { save_claude_for_leads: false } })).body.detail, 'invalid save_claude_for_leads');
    const renamed = await api(ctx, '/settings/balancing', { method: 'PUT', body: { save_for_leads: false, lead_order: ['gpt', 'any'] } });
    assert.equal(renamed.status, 200); assert.equal(renamed.body.save_for_leads, false); assert.equal(renamed.body.reserved_provider, 'GPT');
    const preferences = await api(ctx, '/settings/preferences', { method: 'PUT', body: { review_families: 'gpt' } });
    assert.equal(preferences.body.review_families, 'gpt');
    assert.equal((await api(ctx, '/settings/preferences', { method: 'PUT', body: { review_families: 'bad' } })).body.detail, 'review_families must be both, claude, gpt, gemini, kimi or openrouter');
    const described = (await api(ctx, '/settings')).body; assert.equal(described.review_families, 'gpt'); assert.equal(described.reserved_provider, 'GPT');
    const held = { worker: true, reviewer: false, verifier: true, mapper: true, designer: false };
    const saved = await api(ctx, '/settings/balancing', { method: 'PUT', body: { held_back: held } });
    assert.equal(saved.status, 200); assert.deepEqual(saved.body.held_back, held);
    const result = await api(ctx, '/usage'); assert.equal(result.status, 200); assert.equal(result.body.providers.claude.accounts.length, 2); assert.ok(result.body.providers.gpt.accounts[0].machines.hub);
  } finally { await close(ctx); }
});

test('normalization supplies defaults and all plan weights', () => {
  assert.equal(settings.normalize({ save_claude_for_leads: false }).save_for_leads, false);
  assert.equal(settings.normalize({ review_families: 'bad' }).review_families, 'both');
  const plans = [['claude', 'pro', 1], ['claude', 'max5', 5], ['claude', 'max20', 20], ['gpt', 'plus', 1], ['gpt', 'prolite', 5], ['gpt', 'pro', 10], ['gpt', 'promax', 25], ['gpt', 'unknown', 1]];
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
  const fs = require('node:fs/promises'); const path = require('node:path');
  const { State } = require('../app/state.js');
  const dir = await makeTemp('usage-test-');
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
  assert.equal(result.ok, false); assert.match(result.missing[0], /Claude/);
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
    assert.equal((await api(ctx, '/usage/alert')).body.dot, false);
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

test('removing an account leaves its live session intact and removes it from settings and usage', async () => {
  const fs = require('node:fs/promises'), path = require('node:path');
  const ctx = await setup();
  try {
    const added = await api(ctx, '/settings/accounts', { method: 'POST', body: { provider: 'gpt', name: 'Remove me', plan: 'pro' } });
    await fs.mkdir(path.join(ctx.state, 'threads'), { recursive: true });
    await fs.writeFile(path.join(ctx.state, 'threads', 'remove-test.json'), JSON.stringify({ id: 'remove-test', sessions: [{ name: 'live', live: true, account: added.body.id }] }));
    assert.equal((await api(ctx, `/settings/accounts/${added.body.id}`, { method: 'DELETE' })).status, 200);
    assert.equal((await api(ctx, '/settings')).body.accounts.some(a => a.id === added.body.id), false);
    assert.equal((await api(ctx, '/usage')).body.providers.gpt.accounts.some(a => a.id === added.body.id), false);
    assert.equal(JSON.parse(await fs.readFile(path.join(ctx.state, 'threads', 'remove-test.json'))).sessions[0].live, true);
  } finally { await close(ctx); }
});

test('newer ordinary readings preserve a future limit until it expires', async () => {
  const { Hub } = require('../app/hub.js');
  const { event } = require('./helpers/app.js');
  const ctx = await setup();
  try {
    const thread = (await api(ctx, '/threads', { method: 'POST', body: { project: '/tmp/usage-limit' } })).body;
    const lead = thread.sessions[0], limit = new Date(Date.now() + 3600000).toISOString();
    await event(ctx, thread.id, lead.name, 'limit-hit', { limited_until: limit });
    const hub = new Hub({ stateDir: ctx.state });
    const previous = (await usage.readings(hub))[lead.account];
    await usage.record(hub, { account: lead.account, at: new Date(Date.parse(previous.at) + 1000).toISOString(), five_hour: null, week: null });
    const stored = (await usage.readings(hub))[lead.account];
    assert.equal(stored.limited_until, limit);
    assert.equal(usage.hasRoom(account, stored, { loggedIn: true }), false);
    assert.equal(usage.hasRoom(account, stored, { loggedIn: true, now: Date.parse(limit) + 1 }), true);
    const later = new Date(Date.parse(limit) + 3600000).toISOString();
    await usage.record(hub, { ...stored, at: new Date(Date.parse(stored.at) + 1000).toISOString(), limited_until: later });
    assert.equal((await usage.readings(hub))[lead.account].limited_until, later);
  } finally { await close(ctx); }
});

test('removed account ids are retired and do not inherit usage or sessions', async () => {
  const { Hub } = require('../app/hub.js');
  const ctx = await setup();
  try {
    const add = () => api(ctx, '/settings/accounts', { method: 'POST', body: { provider: 'gpt', name: 'Personal', plan: 'pro' } });
    const first = (await add()).body;
    const hub = new Hub({ stateDir: ctx.state });
    await usage.record(hub, { account: first.id, at: new Date().toISOString() });
    const thread = (await api(ctx, '/threads', { method: 'POST', body: { project: '/tmp/retired-account' } })).body;
    const stored = await hub.thread(thread.id); stored.sessions[0].account = first.id; await hub.save(stored);
    assert.equal((await api(ctx, `/settings/accounts/${first.id}`, { method: 'DELETE' })).status, 200);
    const second = (await add()).body;
    assert.notEqual(second.id, first.id); assert.equal(second.id, 'personal-2');
    assert.ok((await settings.load(hub)).retired_accounts.includes(first.id));
    const summary = (await api(ctx, '/usage')).body.providers.gpt.accounts.find(a => a.id === second.id);
    assert.equal(summary.reading, null); assert.equal(summary.live_sessions, 0);
  } finally { await close(ctx); }
});

test('alerts are acknowledged per provider and local ISO week', async () => {
  const { Hub } = require('../app/hub.js');
  const { makeDir } = require('./helpers/server.js');
  const hub = new Hub({ stateDir: await makeDir('alert-week-') });
  await hub.state.init();
  await settings.update(hub, s => { s.accounts.push({ ...account, id: 'b' }); });
  const monday = new Date(2026, 0, 5, 12).getTime();
  const nextWeek = new Date(2026, 0, 12, 12).getTime();
  await usage.record(hub, { account: 'default-claude', at: new Date(monday).toISOString(), week: { used: 99, resets_at: null } });
  await usage.record(hub, { account: 'b', at: new Date(monday).toISOString(), week: { used: 99, resets_at: null } });
  assert.equal((await usage.summary(hub, false, monday)).providers.claude.first_refill, null);
  assert.equal((await usage.alert(hub, monday)).dot, true);
  await usage.seen(hub, monday);
  assert.equal((await usage.alert(hub, monday)).dot, false);
  await usage.record(hub, { account: 'default-claude', at: new Date(monday + 1000).toISOString(), week: { used: 99, resets_at: new Date(nextWeek + 86400000).toISOString() } });
  await usage.record(hub, { account: 'b', at: new Date(monday + 1000).toISOString(), week: { used: 99, resets_at: new Date(nextWeek + 172800000).toISOString() } });
  await settings.update(hub, s => { s.accounts.find(a => a.id === 'default-claude').paused = true; });
  assert.equal((await usage.alert(hub, monday)).dot, false);
  assert.equal((await usage.alert(hub, nextWeek)).dot, true);
});

test('legacy reserve value is carried over from the saved settings file', async () => {
  const fs = require('node:fs/promises');
  const path = require('node:path');
  const { Hub } = require('../app/hub.js');
  const { makeDir } = require('./helpers/server.js');
  const hub = new Hub({ stateDir: await makeDir('legacy-reserve-') });
  await hub.state.init();
  await fs.writeFile(path.join(hub.state.dir, 'settings.json'), JSON.stringify({ save_claude_for_leads: false }));
  assert.equal((await settings.load(hub)).save_for_leads, false);
});
test('a default account can be removed, stays removed, and can be added back', async () => {
  const ctx = await setup();
  try {
    assert.equal((await api(ctx, '/settings/accounts/default-claude/restore', { method: 'POST' })).status, 400);
    assert.equal((await api(ctx, '/settings/accounts/default-claude', { method: 'DELETE' })).status, 200);
    assert.equal((await api(ctx, '/settings/accounts/default-gemini', { method: 'DELETE' })).status, 200);
    let saved = (await api(ctx, '/settings')).body;
    assert.equal(saved.accounts.some((a) => a.id === 'default-claude' || a.id === 'default-gemini'), false);
    assert.ok(saved.retired_accounts === undefined || saved.retired_accounts.includes('default-claude'));
    assert.equal((await api(ctx, '/settings/accounts', { method: 'POST', body: { provider: 'gemini', name: 'x', plan: 'pro' } })).status, 400);
    assert.equal((await api(ctx, '/settings/accounts/default-nope/restore', { method: 'POST' })).status, 404);
    const back = await api(ctx, '/settings/accounts/default-claude/restore', { method: 'POST' });
    assert.equal(back.status, 201); assert.equal(back.body.name, 'default');
    assert.equal((await api(ctx, '/settings/accounts/default-gemini/restore', { method: 'POST' })).status, 201);
    saved = (await api(ctx, '/settings')).body;
    assert.ok(saved.accounts.some((a) => a.id === 'default-claude'));
    assert.ok(saved.accounts.some((a) => a.id === 'default-gemini'));
  } finally { await close(ctx); }
});

// Exercise polling against the scripted machine service, with a separate hub over the same state.
async function pollSetup() {
  const { Hub } = require('../app/hub.js');
  const c = await setup();
  const hub = new Hub({ stateDir: c.state });
  await settings.update(hub, s => { s.accounts.find(a => a.id === 'default-gpt').paused = true; });
  return { c, hub };
}
function usageCalls(c) { return c.machine.calls.filter(call => call.path === '/v1/usage'); }
function gate() { let release, entered; const waiting = new Promise(r => { release = r; }); const called = new Promise(r => { entered = r; }); return { release, called, respond: async input => { entered(); await waiting; return { reading: { account: input.account, week: { used: 20, resets_at: null } } }; } }; }

test('idle poll probes eligible accounts in order and records the selected machine', async () => {
  const { c, hub } = await pollSetup();
  try {
    await settings.update(hub, s => { s.accounts.push({ ...account, id: 'signed-out' }, { ...account, id: 'live' }, { ...account, id: 'paused', paused: true }); });
    c.machine.status.agy = { logged_in: true };
    c.machine.status.accounts.push({ id: 'live', cli: 'claude', logged_in: true }, { id: 'paused', cli: 'claude', logged_in: true }, { id: 'default-gemini', cli: 'agy', logged_in: true });
    await hub.save({ id: 'poll-live', sessions: [{ live: true, account: 'live' }] });
    await hub.pollIdle();
    assert.deepEqual(usageCalls(c).map(x => x.body), [{ account: 'default-claude', cli: 'claude', dir: null }]);
    assert.equal((await usage.readings(hub))['default-claude'].machine, 'hub');
  } finally { await close(c); }
});

test('idle poll stores default and named Kimi account readings', async () => {
  const fs = require('node:fs/promises'), path = require('node:path');
  const { c, hub } = await pollSetup();
  try {
    await settings.update(hub, s => { s.accounts.find(a => a.id === 'default-claude').paused = true; s.accounts.push({ ...account, id: 'other-kimi', provider: 'kimi', plan: 'unknown' }); });
    c.machine.status.kimi = { installed: true, logged_in: true };
    c.machine.status.accounts.push({ id: 'default-kimi', cli: 'kimi', logged_in: true }, { id: 'other-kimi', cli: 'kimi', logged_in: true });
    await hub.pollIdle();
    assert.deepEqual(usageCalls(c).map(x => x.body), [
      { account: 'default-kimi', cli: 'kimi', dir: null },
      { account: 'other-kimi', cli: 'kimi', dir: '~/.wheelchair/accounts/other-kimi' },
    ]);
    const saved = JSON.parse(await fs.readFile(path.join(c.state, 'usage.json'))).readings;
    assert.equal(saved['default-kimi'].machine, 'hub');
    assert.equal(saved['other-kimi'].machine, 'hub');
  } finally { await close(c); }
});

test('idle poll stores a Kimi reading while its session is live', async () => {
  const { c, hub } = await pollSetup(); const g = gate(); c.machine.usageReply = g.respond;
  try {
    await settings.update(hub, s => { s.accounts.find(a => a.id === 'default-claude').paused = true; });
    c.machine.status.kimi = { installed: true, logged_in: true };
    c.machine.status.accounts.push({ id: 'default-kimi', cli: 'kimi', logged_in: true });
    await hub.save({ id: 'kimi-live', sessions: [{ live: true, account: 'default-kimi' }] });
    const poll = hub.pollIdle(); await g.called; g.release(); await poll;
    assert.equal(usageCalls(c)[0].body.cli, 'kimi');
    assert.equal((await usage.readings(hub))['default-kimi'].week.used, 20);
  } finally { g.release(); await close(c); }
});

test('idle poll tries another machine when a Kimi probe fails', async () => {
  const fs = require('node:fs/promises'), path = require('node:path');
  const { startMachine } = require('./helpers/app-machine.js');
  const { c, hub } = await pollSetup(); const second = await startMachine();
  try {
    await settings.update(hub, s => { s.accounts.find(a => a.id === 'default-claude').paused = true; });
    for (const machine of [c.machine, second]) {
      machine.status.kimi = { installed: true, logged_in: true };
      machine.status.accounts.push({ id: 'default-kimi', cli: 'kimi', logged_in: true });
    }
    c.machine.usageReply = { status: 502 };
    second.usageReply = { reading: { account: 'default-kimi', week: { used: 42, resets_at: null } } };
    const machinesPath = path.join(c.state, 'machines.json');
    const machines = JSON.parse(await fs.readFile(machinesPath));
    machines.second = { name: 'second', address: '127.0.0.1', port: second.port, secret: second.secret };
    await fs.writeFile(machinesPath, JSON.stringify(machines));
    await hub.pollIdle();
    assert.equal(usageCalls(c).length, 1);
    assert.equal(second.calls.filter(call => call.path === '/v1/usage').length, 1);
    const saved = (await usage.readings(hub))['default-kimi'];
    assert.equal(saved.week.used, 42); assert.equal(saved.machine, 'second');
  } finally { await second.stop(); await close(c); }
});

test('idle poll skips a live Claude account', async () => {
  const { c, hub } = await pollSetup();
  try {
    await hub.save({ id: 'claude-live', sessions: [{ live: true, account: 'default-claude' }] });
    await hub.pollIdle();
    assert.equal(usageCalls(c).length, 0);
  } finally { await close(c); }
});

test('idle poll drops a reading when the account becomes live', async () => {
  const { c, hub } = await pollSetup(); const g = gate(); c.machine.usageReply = g.respond;
  try { const poll = hub.pollIdle(); await g.called; await hub.save({ id: 'during', sessions: [{ live: true, account: 'default-claude' }] }); g.release(); await poll; assert.equal((await usage.readings(hub))['default-claude'], undefined); } finally { g.release(); await close(c); }
});

test('idle poll keeps stored usage on failure and throttles retries', async () => {
  const { c, hub } = await pollSetup();
  try { const old = { account: 'default-claude', at: new Date(Date.now() - 600000).toISOString(), week: { used: 80, resets_at: null } }; await usage.record(hub, old); c.machine.usageReply = { status: 502 }; await hub.pollIdle(); await hub.pollIdle(); assert.deepEqual((await usage.readings(hub))['default-claude'], old); assert.equal(usageCalls(c).length, 1); } finally { await close(c); }
});

test('overlapping idle polls share one run', async () => {
  const { c, hub } = await pollSetup(); const g = gate(); c.machine.usageReply = g.respond;
  try { const first = hub.pollIdle(); await g.called; const second = hub.pollIdle(); assert.equal(first, second); g.release(); await Promise.all([first, second]); assert.equal(usageCalls(c).length, 1); } finally { g.release(); await close(c); }
});

test('idle poll skips readings less than nine minutes old', async () => {
  const { c, hub } = await pollSetup();
  try { await usage.record(hub, { account: 'default-claude', at: new Date().toISOString() }); await hub.pollIdle(); assert.equal(usageCalls(c).length, 0); } finally { await close(c); }
});

test('idle poll rechecks later accounts before probing', async () => {
  const { c, hub } = await pollSetup(); const g = gate(); c.machine.usageReply = g.respond;
  try { await settings.update(hub, s => { s.accounts.find(a => a.id === 'default-gpt').paused = false; }); const poll = hub.pollIdle(); await g.called; await hub.save({ id: 'later', sessions: [{ live: true, account: 'default-gpt' }] }); g.release(); await poll; assert.deepEqual(usageCalls(c).map(x => x.body.account), ['default-claude']); } finally { g.release(); await close(c); }
});

test('a newer live reading survives an idle probe after the session ends', async () => {
  const { c, hub } = await pollSetup(); const g = gate(); c.machine.usageReply = g.respond;
  try { const poll = hub.pollIdle(); await g.called; const fresh = { account: 'default-claude', at: new Date(Date.now() + 1000).toISOString(), week: { used: 77, resets_at: null } }; await usage.record(hub, fresh); g.release(); await poll; assert.deepEqual((await usage.readings(hub))['default-claude'], fresh); } finally { g.release(); await close(c); }
});

test('idle poll drops a removed account result', async () => {
  const { c, hub } = await pollSetup(); const g = gate(); c.machine.usageReply = g.respond;
  try { const poll = hub.pollIdle(); await g.called; await api(c, '/settings/accounts/default-claude', { method: 'DELETE' }); g.release(); await poll; assert.equal((await usage.readings(hub))['default-claude'], undefined); } finally { g.release(); await close(c); }
});

test('idle poll promotes a waiting start when usage frees room', async () => {
  const { machinePost } = require('./helpers/app.js');
  const { c, hub } = await pollSetup();
  try {
    await settings.update(hub, s => { s.accounts.find(a => a.id === 'default-gpt').paused = false; });
    const made = (await api(c, '/threads', { method: 'POST', body: { project: '/tmp/poll-waiting', cli: 'claude' } })).body;
    const lead = made.sessions[0];
    const sub = (await machinePost(c, '/machine/session', { calling_session: lead.name, action: 'start', role: 'sub-lead', attempt_id: 'poll-sub' })).body.session;
    const reset = new Date(Date.now() + 3600000).toISOString();
    await usage.record(hub, { account: 'default-gpt', at: new Date(Date.now() - 600000).toISOString(), week: { used: 100, resets_at: reset } });
    const waiting = (await machinePost(c, '/machine/session', { calling_session: sub.name, action: 'start', role: 'worker', provider: 'gpt', attempt_id: 'poll-wait', brief: 'work' })).body.session;
    assert.equal(waiting.status, 'waiting');
    c.machine.usageReply = { reading: { account: 'default-gpt', week: { used: 0, resets_at: reset } } };
    await hub.pollIdle();
    assert.equal((await hub.thread(made.id)).sessions.find(s => s.name === waiting.name).status, 'ready');
  } finally { await close(c); }
});

test('a reported GPT plan sets the account plan and weight unless the weight was typed in', async () => {
  const { State } = require('../app/state.js');
  const hub = { state: new State(await makeTemp('usage-plan-')) };
  const gptReading = (plan_type) => ({ account: 'default-gpt', at: new Date().toISOString(), week: { used: 10, resets_at: reset }, five_hour: null, plan_type });
  const gpt = async () => (await settings.load(hub)).accounts.find((a) => a.id === 'default-gpt');
  await usage.record(hub, gptReading('prolite'));
  assert.deepEqual([(await gpt()).plan, (await gpt()).weight], ['prolite', 5]);
  await usage.record(hub, gptReading('promax'));
  assert.deepEqual([(await gpt()).plan, (await gpt()).weight], ['promax', 25]);
  await usage.record(hub, { ...gptReading('prolite'), at: '2020-01-01T00:00:00Z' });
  assert.equal((await gpt()).plan, 'promax');
  await usage.record(hub, gptReading('constructor'));
  await usage.record(hub, gptReading('enterprise'));
  assert.equal((await gpt()).plan, 'promax');
  await settings.update(hub, (v) => { v.accounts.find((a) => a.id === 'default-gpt').weight = 3; });
  await usage.record(hub, gptReading('plus'));
  assert.deepEqual([(await gpt()).plan, (await gpt()).weight], ['promax', 3]);
  assert.deepEqual(settings.reportedPlan({ provider: 'gpt', plan: 'pro', weight: 6 }, 'pro'), { plan: 'pro', weight: 10 });
  assert.equal(settings.reportedPlan({ provider: 'claude', plan: 'pro', weight: 1 }, 'max'), null);
});
