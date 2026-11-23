'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { execFileSync } = require('node:child_process');
const { api, close, setup } = require('./helpers/app.js');
const settings = require('../app/settings.js');
const usage = require('../app/usage.js');
const ready = require('../app/ready.js');
const { Hub } = require('../app/hub.js');
const { makeDir } = require('./helpers/server.js');

const MODEL_SH = path.join(__dirname, '..', '..', 'codex', 'model.sh');

async function withContext(work) {
  const context = await setup();
  try { await work(context); } finally { await close(context); }
}

test('Kimi settings: defaults, plans, migration and review families', () => {
  assert.deepEqual(settings.PLANS.kimi, { unknown: 1 });
  assert.deepEqual(settings.defaults().worker_order, ['gpt', 'claude', 'gemini', 'kimi']);
  assert.ok(settings.defaults().accounts.some((a) => a.id === 'default-kimi' && a.provider === 'kimi'));
  // A legacy save (no worker_order_seen) receives both newer providers, in place.
  const legacy = settings.normalize({ worker_order: ['claude', 'gpt'] });
  assert.deepEqual(legacy.worker_order, ['claude', 'gpt', 'gemini', 'kimi']);
  // A current save whose seen list lacks kimi gets kimi appended without reordering.
  const current = settings.normalize({ worker_order: ['gemini', 'gpt', 'claude'], worker_order_seen: ['claude', 'gpt', 'gemini'] });
  assert.deepEqual(current.worker_order, ['gemini', 'gpt', 'claude', 'kimi']);
  assert.deepEqual(current.worker_order_seen, ['claude', 'gpt', 'gemini', 'kimi', 'openrouter']);
  // Already seen and removed: stays removed.
  assert.deepEqual(settings.normalize({ worker_order: ['claude'], worker_order_seen: ['claude', 'gpt', 'gemini', 'kimi'] }).worker_order, ['claude']);
  assert.equal(settings.normalize({ review_families: 'kimi' }).review_families, 'kimi');
});

test('Kimi through the Settings API: accounts, preferences, effort and slashed model pins', async () => {
  await withContext(async (context) => {
    for (const name of ['one', 'two']) {
      const added = await api(context, '/settings/accounts', { method: 'POST', body: { provider: 'kimi', name, plan: 'unknown' } });
      assert.equal(added.status, 201);
    }
    assert.equal((await api(context, '/settings')).body.accounts.filter((a) => a.provider === 'kimi').length, 3);
    assert.equal((await api(context, '/settings/preferences', { method: 'PUT', body: { review_families: 'kimi' } })).body.review_families, 'kimi');
    const bad = await api(context, '/settings/preferences', { method: 'PUT', body: { review_families: 'nope' } });
    assert.equal(bad.body.detail, 'review_families must be both, claude, gpt, gemini, kimi or openrouter');
    const saved = await api(context, '/settings/models', { method: 'PUT', body: { provider: 'kimi', slot: 'heavy', model: 'kimi-code/k3-custom' } });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body.models.kimi.heavy, { model: 'kimi-code/k3-custom', effort: null });
    const withEffort = await api(context, '/settings/models', { method: 'PUT', body: { provider: 'kimi', slot: 'heavy', model: 'kimi-code/k3-custom', effort: 'max' } });
    assert.equal(withEffort.status, 400);
    assert.equal(withEffort.body.detail, 'Kimi Code has no effort setting');
    const shown = JSON.parse(execFileSync(MODEL_SH, ['show', '--json'], { env: { ...process.env, WHEELCHAIR_MODELS: context.models, WHEELCHAIR_MODELS_CACHE: context.modelsCache }, encoding: 'utf8' }));
    assert.deepEqual(shown.kimi.heavy, { model: 'kimi-code/k3-custom', effort: null });
    assert.equal(shown.malformed, false);
    assert.equal((await api(context, '/settings')).body.models.kimi.heavy.model, 'kimi-code/k3-custom');
    // The slashed form is for Kimi only; two slashes are never valid.
    assert.equal((await api(context, '/settings/models', { method: 'PUT', body: { provider: 'gemini', slot: 'heavy', model: 'a/b' } })).status, 400);
    assert.equal((await api(context, '/settings/models', { method: 'PUT', body: { provider: 'kimi', slot: 'heavy', model: 'a/b/c' } })).status, 400);
  });
});

async function hubWith(statusByMachine, accountsChange) {
  const hub = new Hub({ stateDir: await makeDir('kimi-hub-') });
  await hub.state.init();
  hub.codeVersion = 'v1';
  hub.machines = async () => Object.fromEntries(Object.keys(statusByMachine).map((name) => [name, { name }]));
  hub.call = async (machine) => statusByMachine[machine];
  hub.allThreads = async () => [];
  if (accountsChange) await settings.update(hub, accountsChange);
  return hub;
}
const row = (extra = {}) => ({ installed: true, logged_in: false, ...extra });

test('Ready: a per-CLI Kimi problem is the line; otherwise the first account problem; otherwise not logged in', async () => {
  const thread = { machine: 'm', cli: 'kimi' };
  const add = (s) => { s.accounts.push({ id: 'k-two', provider: 'kimi', name: 'Work', plan: 'unknown', weight: 1, paused: false }, { id: 'k-three', provider: 'kimi', name: 'Third', plan: 'unknown', weight: 1, paused: false }); };
  let hub = await hubWith({ m: { version: 'v1', kimi: row({ problem: 'kimi is older than 2.6.3' }), accounts: [{ id: 'default-kimi', cli: 'kimi', logged_in: false, problem: 'ignored' }] } }, add);
  assert.deepEqual(await ready.check(hub, thread), { ok: false, missing: ['m: kimi is older than 2.6.3'] });
  const accounts = [{ id: 'default-kimi', cli: 'kimi', logged_in: false }, { id: 'k-two', cli: 'kimi', logged_in: false, problem: "signed in to Kimi's China region; log in again" }, { id: 'k-three', cli: 'kimi', logged_in: false, problem: 'later' }];
  hub = await hubWith({ m: { version: 'v1', kimi: row(), accounts } }, add);
  assert.deepEqual(await ready.check(hub, thread), { ok: false, missing: ["m: Work: signed in to Kimi's China region; log in again"] });
  // A paused account's problem is skipped; the next one speaks.
  hub = await hubWith({ m: { version: 'v1', kimi: row(), accounts } }, (s) => { add(s); s.accounts.find((a) => a.id === 'k-two').paused = true; });
  assert.deepEqual((await ready.check(hub, thread)).missing, ['m: Third: later']);
  // An account not in Settings has no name and is not used.
  hub = await hubWith({ m: { version: 'v1', kimi: row(), accounts: [{ id: 'stranger', cli: 'kimi', logged_in: false, problem: 'x' }] } });
  assert.deepEqual((await ready.check(hub, thread)).missing, ['m: Kimi Code is not logged in']);
  // A signed-in account passes even when another has a problem.
  hub = await hubWith({ m: { version: 'v1', kimi: row({ logged_in: true }), accounts: [{ id: 'default-kimi', cli: 'kimi', logged_in: true }, { id: 'k-two', cli: 'kimi', logged_in: false, problem: 'x' }] } }, add);
  assert.equal((await ready.check(hub, thread)).ok, true);
});

test('Usage: one Kimi account signed in on one machine and with a problem on another', async () => {
  const hub = await hubWith({
    a: { version: 'v1', kimi: row({ logged_in: true }), accounts: [{ id: 'default-kimi', cli: 'kimi', logged_in: true }] },
    b: { version: 'v1', kimi: row({ logged_in: true }), accounts: [{ id: 'default-kimi', cli: 'kimi', logged_in: false, problem: "signed in to Kimi's China region; log in again" }] },
    c: { version: 'v1', kimi: row({ problem: 'kimi is older than 2.6.3' }), accounts: [{ id: 'default-kimi', cli: 'kimi', logged_in: false }] },
    d: { version: 'v1', kimi: row(), accounts: [{ id: 'default-kimi', cli: 'kimi', logged_in: false }] },
  });
  const machines = await usage.machineAccounts(hub);
  // The boolean map placement reads is untouched.
  assert.deepEqual(Object.fromEntries(Object.entries(machines).map(([m, v]) => [m, v.accounts['default-kimi']])), { a: true, b: false, c: false, d: false });
  const kimi = (await usage.summary(hub)).providers.kimi.accounts.find((x) => x.id === 'default-kimi');
  assert.deepEqual(kimi.machines, {
    a: 'signed_in',
    b: { state: 'problem', text: "signed in to Kimi's China region; log in again" },
    c: { state: 'problem', text: 'kimi is older than 2.6.3' },
    d: 'signed_out',
  });
  const account = kimi;
  const ranked = (machine) => usage.rank([account], {}, machines, { within: 'soonest', leave: 10 }, machine)[0];
  assert.equal(ranked('a').next, true);
  assert.match(ranked('b').reason, /^skipped: signed out on b/);
});

test('Usage: a named Kimi account with no home on a machine below the floor shows the version problem', async () => {
  const floor = 'Kimi Code 2.6.3 or newer is needed (found 2.6.2)';
  const hub = await hubWith({
    a: { version: 'v1', claude: { installed: true }, kimi: row({ problem: floor }), accounts: [{ id: 'default-kimi', cli: 'kimi', logged_in: false }, { id: 'default-claude', cli: 'claude', logged_in: true }] },
    b: { version: 'v1', kimi: row(), accounts: [{ id: 'default-kimi', cli: 'kimi', logged_in: false }] },
  }, (s) => { s.accounts.push({ id: 'k-two', provider: 'kimi', name: 'Work', plan: 'unknown', weight: 1, paused: false }); });
  const machines = await usage.machineAccounts(hub);
  // The named account has no entry in a's accounts[], so the boolean map has no key for it.
  assert.equal(machines.a.accounts['k-two'], undefined);
  const { providers } = await usage.summary(hub);
  const byId = Object.fromEntries(providers.kimi.accounts.map((x) => [x.id, x.machines]));
  assert.deepEqual(byId['k-two'], { a: { state: 'problem', text: floor }, b: 'signed_out' });
  assert.deepEqual(byId['default-kimi'], { a: { state: 'problem', text: floor }, b: 'signed_out' });
  assert.equal(providers.claude.accounts.find((x) => x.id === 'default-claude').machines.a, 'signed_in');
});

test('OpenRouter Pi warning appears in usage and does not block Ready', async () => {
  const warning = 'Pi 1.6.0 is newer than the version wheelchair was tested with (1.5.2). If OpenRouter agents fail, this may be why.';
  const hub = await hubWith({ m: { version: 'v1', pi: row({ logged_in: true, warning }), accounts: [{ id: 'default-openrouter', cli: 'pi', logged_in: true }] } });
  assert.equal((await ready.check(hub, { machine: 'm', cli: 'pi' })).ok, true);
  const account = (await usage.summary(hub)).providers.openrouter.accounts.find(a => a.id === 'default-openrouter');
  assert.deepEqual(account.machines.m, { state: 'signed_in', warning });
});
