'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { makeTempSync } = require('../../test-support/run-dir.js');
process.env.WHEELCHAIR_MODELS = path.join(makeTempSync('balancer-models-'), 'models');
const { setup, close, api, machinePost, event } = require('./helpers/app.js');

test('default placement, strict and preferred constraints, and invalid flags', async () => {
  const c = await setup();
  try {
    const made = (await api(c, '/threads', { method: 'POST', body: { project: '/tmp/placement' } })).body;
    assert.equal(made.provider, 'claude');
    assert.equal(made.cli, 'claude');
    assert.equal(made.sessions[0].account, 'default-claude');
    const lead = made.sessions[0].name;
    await api(c, '/settings/preferences', { method: 'PUT', body: { review_families: 'gpt' } });
    const list = await machinePost(c, '/machine/session', { calling_session: lead, action: 'list' });
    assert.equal(list.body.review_families, 'gpt'); assert.ok(Array.isArray(list.body.sessions));
    await api(c, '/settings/preferences', { method: 'PUT', body: { review_families: 'both' } });
    const sub = await machinePost(c, '/machine/session', { calling_session: lead, action: 'start', role: 'sub-lead', attempt_id: 'sub' });
    assert.equal(sub.body.session.provider, 'claude');
    const worker = await machinePost(c, '/machine/session', { calling_session: sub.body.session.name, action: 'start', role: 'worker', attempt_id: 'worker' });
    assert.equal(worker.body.session.provider, 'gpt');
    assert.deepEqual(c.machine.calls.find((x) => x.path === '/v1/sessions' && x.body.name === worker.body.session.name).body.account, { id: 'default-gpt', dir: null });
    const invalid = await machinePost(c, '/machine/session', { calling_session: lead, action: 'start', role: 'mapper', provider: 'gpt', attempt_id: 'bad' });
    assert.equal(invalid.status, 400);
    const failed = await event(c, made.id, lead, 'turn-failed', { error: 'broken' });
    assert.equal(failed.status, 202);
    let current = (await api(c, `/threads/${made.id}/chat`)).body.thread;
    assert.ok(current.cards.some((card) => card.title === "The lead's turn failed" && !card.answered));
    await event(c, made.id, lead, 'turn-ended');
    current = (await api(c, `/threads/${made.id}/chat`)).body.thread;
    assert.ok(current.cards.some((card) => card.title === "The lead's turn failed" && card.answered));
  } finally { await close(c); }
});

test('placement ranks accounts and respects provider policy', async (t) => {
  const { Hub } = require('../app/hub.js');
  const settings = require('../app/settings.js');
  const usage = require('../app/usage.js');
  const { choose, reviewFamilies } = require('../app/balancer.js');
  const { makeDir } = require('./helpers/server.js');
  async function fixture(changes = {}, readings = {}, signed = ['default-claude', 'default-gpt', 'gpt-two']) {
    const hub = new Hub({ stateDir: await makeDir('balance-') });
    await hub.state.init();
    hub.machines = async () => ({ hub: { name: 'hub' } });
    hub.call = async () => ({ accounts: signed.map((id) => ({ id, logged_in: true })) });
    hub.allThreads = async () => [];
    await settings.update(hub, (s) => { s.accounts.push({ id: 'gpt-two', provider: 'gpt', name: 'two', plan: 'unknown', weight: 1, paused: false }); Object.assign(s, changes); });
    for (const [id, reading] of Object.entries(readings)) await usage.record(hub, { account: id, at: new Date().toISOString(), ...reading });
    return hub;
  }
  const future = (hours) => new Date(Date.now() + hours * 3600000).toISOString();
  const samples = { 'default-gpt': { week: { used: 60, resets_at: future(24) } }, 'gpt-two': { week: { used: 20, resets_at: future(48) } } };
  for (const [mode, expected] of [['soonest', 'default-gpt'], ['spread', 'gpt-two'], ['one', 'gpt-two']]) await t.test(mode, async () => {
    const hub = await fixture({ within: mode }, samples);
    if (mode === 'one') await usage.recordChosen(hub, 'gpt', 'gpt-two');
    assert.equal((await choose(hub, { machine: 'hub' }, 'worker')).account.id, expected);
  });
  await t.test('three provider placement and constraints', async () => {
    const all = ['default-claude', 'default-gpt', 'default-gemini'];
    const hub = await fixture({ save_for_leads: false, worker_order: ['gpt', 'claude', 'gemini'] }, {}, all);
    assert.equal((await choose(hub, { machine: 'hub' }, 'worker')).provider, 'gpt');
    assert.equal((await choose(hub, { machine: 'hub' }, 'worker', 'top', { not_provider: 'gpt' })).provider, 'claude');
    assert.equal((await choose(hub, { machine: 'hub' }, 'worker', 'top', { provider: 'gemini' })).provider, 'gemini');
    await settings.update(hub, (s) => { s.review_families = 'gemini'; });
    assert.equal((await choose(hub, { machine: 'hub' }, 'reviewer')).provider, 'gemini');
    const onlyGemini = await fixture({ save_for_leads: false }, {}, ['default-gemini']);
    assert.equal((await choose(onlyGemini, { machine: 'hub' }, 'worker')).provider, 'gemini');
  });
  await t.test('leave, paused and signed out', async () => {
    const hub = await fixture({}, { 'default-gpt': { week: { used: 90, resets_at: future(24) } } }, ['default-gpt']);
    assert.ok((await choose(hub, { machine: 'hub' }, 'worker', 'top', { provider: 'gpt' })).wait);
    await settings.update(hub, (s) => { s.accounts.find((a) => a.id === 'default-gpt').paused = true; });
    assert.ok((await choose(hub, { machine: 'hub' }, 'worker', 'top', { provider: 'gpt' })).wait);
  });
  await t.test('save Claude and pinned leads', async () => {
    const hub = await fixture({ worker_order: ['claude', 'gpt'], lead_order: ['claude', 'any'] });
    assert.equal((await choose(hub, { machine: 'hub' }, 'worker')).provider, 'gpt');
    assert.equal((await choose(hub, { machine: 'hub' }, 'worker', 'top', { not_provider: 'gpt' })).provider, 'claude');
    for (const role of ['lead', 'sub-lead']) assert.equal((await choose(hub, { machine: 'hub', provider: 'gpt' }, role)).provider, 'gpt');
  });
  await t.test('lead any and constraint fallback', async () => {
    const hub = await fixture({ lead_order: ['claude', 'any'] }, {}, ['default-gpt']);
    assert.equal((await choose(hub, { machine: 'hub' }, 'lead')).provider, 'gpt');
    assert.deepEqual((( { provider, note }) => ({ provider, note }))(await choose(hub, { machine: 'hub' }, 'worker', 'top', { provider: 'claude' })), { provider: 'gpt', note: 'Could not use claude; using gpt.' });
    assert.ok((await choose(hub, { machine: 'hub' }, 'worker', 'top', { not_provider: 'gpt' })).wait);
    for (const role of ['reviewer', 'verifier']) {
      const selection = await choose(hub, { machine: 'hub' }, role, 'top', { provider: 'claude' });
      assert.equal(selection.provider, 'gpt'); assert.match(selection.note, /claude.*gpt/);
      const excluded = await choose(hub, { machine: 'hub' }, role, 'top', { not_provider: 'gpt' });
      assert.equal(excluded.provider, 'gpt'); assert.match(excluded.note, /gpt/);
    }
    for (const role of ['lead', 'sub-lead', 'mapper']) for (const flag of ['provider', 'not_provider']) await assert.rejects(choose(hub, { machine: 'hub' }, role, 'top', { [flag]: 'gpt' }), { status: 400 });
    await assert.rejects(choose(hub, { machine: 'hub' }, 'worker', 'top', { provider: 'gpt', not_provider: 'claude' }), { status: 400 });
  });
  await t.test('lead reserve follows signed-in lead order and margin', async () => {
    const { reservedProvider } = require('../app/balancer.js');
    const ordered = await fixture({ lead_order: ['gpt', 'any'], worker_order: ['gpt', 'claude'] });
    assert.equal((await choose(ordered, { machine: 'hub' }, 'worker')).provider, 'claude');
    const hub = await fixture({ lead_order: ['gpt', 'any'], worker_order: ['gpt', 'claude'], margin: 50 }, { 'default-gpt': { week: { used: 70, resets_at: future(24) } }, 'gpt-two': { week: { used: 70, resets_at: future(24) } } });
    assert.equal((await choose(hub, { machine: 'hub' }, 'worker')).provider, 'claude');
    assert.equal((await choose(hub, { machine: 'hub' }, 'worker', 'top', { provider: 'gpt' })).provider, 'claude');
    const value = await settings.load(hub);
    assert.equal(reservedProvider(value, { hub: { accounts: { 'default-claude': true } } }, 'hub'), 'claude');
    assert.equal(reservedProvider(value, { hub: { accounts: { 'default-gpt': true } } }, null), 'gpt');
    assert.equal(reservedProvider(value, {}, null), null);
  });
  await t.test('single review family overrides flags and waits or falls back', async () => {
    const hub = await fixture({ review_families: 'claude', worker_order: ['gpt'] });
    assert.equal((await choose(hub, { machine: 'hub' }, 'reviewer')).provider, 'claude');
    await usage.record(hub, { account: 'default-claude', at: new Date().toISOString(), week: { used: 100, resets_at: future(24) } });
    assert.equal((await choose(hub, { machine: 'hub' }, 'reviewer')).wait.provider, 'claude');
    const fallback = await fixture({ review_families: 'claude', worker_order: ['gpt'] }, {}, ['default-gpt']);
    const selection = await choose(fallback, { machine: 'hub' }, 'reviewer');
    assert.equal(selection.provider, 'gpt');
    assert.equal(selection.note, 'Reviewers and checkers are set to Claude, but Claude is not available; using GPT.');
    const gpt = await fixture({ review_families: 'gpt' });
    assert.equal((await choose(gpt, { machine: 'hub' }, 'reviewer', 'top', { provider: 'claude' })).provider, 'gpt');
    assert.equal((await choose(gpt, { machine: 'hub' }, 'verifier', 'top', { not_provider: 'gpt' })).provider, 'gpt');
  });
  await t.test('mixed families report the one family when only one is signed in', async () => {
    assert.equal(await reviewFamilies(await fixture({}, {}, ['default-gpt']), { machine: 'hub' }), 'gpt');
    assert.equal(await reviewFamilies(await fixture({}, {}, ['default-claude', 'default-gpt']), { machine: 'hub' }), 'both');
    assert.equal(await reviewFamilies(await fixture({ review_families: 'claude' }, {}, ['default-gpt']), { machine: 'hub' }), 'claude');
    const paused = await fixture({}, {}, ['default-claude', 'default-gpt']);
    await settings.update(paused, (s) => { s.accounts.find((a) => a.id === 'default-claude').paused = true; });
    assert.equal(await reviewFamilies(paused, { machine: 'hub' }), 'gpt');
    // Claude turned off at the reviewer tier still counts: verifiers may use it at their own tier.
    const tierOff = await fixture({}, {}, ['default-claude', 'default-gpt']);
    await settings.update(tierOff, (s) => { s.other_agents.reviewer = 'critical'; });
    const models = (args) => new Promise((resolve, reject) => require('node:child_process').execFile(path.join(tierOff.root, 'codex', 'model.sh'), args, (e) => (e ? reject(e) : resolve())));
    await models(['set', 'claude', 'critical', 'none']);
    try { assert.equal(await reviewFamilies(tierOff, { machine: 'hub' }), 'both'); } finally { await models(['reset']); }
  });
  await t.test('wait estimate accounts for every exhausted window', async () => {
    const five = future(2), week = future(5);
    const hub = await fixture({}, { 'default-gpt': { five_hour: { used: 100, resets_at: five }, week: { used: 100, resets_at: week } } }, ['default-gpt']);
    const selection = await choose(hub, { machine: 'hub' }, 'worker', 'top', { provider: 'gpt' });
    assert.equal(selection.wait.until, week);
  });
  await t.test('reviewers and verifiers wait when neither provider has room', async () => {
    const hub = await fixture({}, {}, []);
    for (const role of ['reviewer', 'verifier']) assert.ok((await choose(hub, { machine: 'hub' }, role, 'top', { provider: 'gpt' })).wait);
  });
  await t.test('margin skips Claude for workers but not leads', async () => {
    const hub = await fixture({ worker_order: ['claude', 'gpt'], margin: 50, save_for_leads: false }, { 'default-claude': { week: { used: 70, resets_at: future(24) } } });
    for (const role of ['worker', 'reviewer', 'verifier', 'mapper']) assert.equal((await choose(hub, { machine: 'hub' }, role)).provider, 'gpt');
    await settings.update(hub, (s) => { s.held_back.reviewer = false; s.save_for_leads = false; });
    const reviewer = await choose(hub, { machine: 'hub' }, 'reviewer', 'top', { provider: 'claude' });
    assert.equal(reviewer.provider, 'claude'); assert.equal(reviewer.note, undefined);
    const worker = await choose(hub, { machine: 'hub' }, 'worker', 'top', { provider: 'claude' });
    assert.equal(worker.provider, 'gpt'); assert.match(worker.note, /claude.*gpt/);
    assert.equal((await choose(hub, { machine: 'hub' }, 'lead')).provider, 'claude');
  });
});

test('a reading promotes the same waiting worker and keeps its queue', async () => {
  const { Hub } = require('../app/hub.js');
  const c = await setup();
  try {
    const made = (await api(c, '/threads', { method: 'POST', body: { project: '/tmp/waiting' } })).body;
    const lead = made.sessions[0];
    const sub = (await machinePost(c, '/machine/session', { calling_session: lead.name, action: 'start', role: 'sub-lead', attempt_id: 'sub-wait' })).body.session;
    const reset = new Date(Date.now() + 3600000).toISOString();
    const reading = { account: 'default-gpt', at: new Date(Date.now() - 1000).toISOString(), five_hour: null, week: { used: 100, resets_at: reset } };
    await event(c, made.id, lead.name, 'usage', { reading });
    const payload = { calling_session: sub.name, action: 'start', role: 'worker', provider: 'gpt', attempt_id: 'wait-1', brief: 'work' };
    const waiting = (await machinePost(c, '/machine/session', payload)).body.session;
    assert.equal(waiting.status, 'waiting');
    assert.equal((await machinePost(c, '/machine/session', payload)).body.session.name, waiting.name);
    const hub = new Hub({ stateDir: c.state });
    const stored = await hub.thread(made.id);
    const target = stored.sessions.find((s) => s.name === waiting.name);
    target.queue.push({ text: 'kept', source: 'app' });
    const token = target.token;
    await hub.save(stored);
    await event(c, made.id, lead.name, 'usage', { reading: { ...reading, at: new Date(Date.now() + 1000).toISOString(), week: { used: 0, resets_at: reset } } });
    const promoted = (await hub.thread(made.id)).sessions.find((s) => s.name === waiting.name);
    assert.equal(promoted.status, 'ready');
    assert.equal(promoted.token, token); assert.equal(promoted.attempt_id, 'wait-1'); assert.equal(promoted.started_by, sub.name);
    assert.equal(promoted.queue[0].text, 'kept');
    for (const key of ['pending_start', 'waiting_until', 'waiting_reason']) assert.equal(Object.hasOwn(promoted, key), false);
    assert.deepEqual(c.machine.calls.find((call) => call.path === '/v1/sessions' && call.body.name === waiting.name).body.account, { id: 'default-gpt', dir: null });
  } finally { await close(c); }
});

test('a turn-ended reading promotes the same waiting worker and keeps its token', async () => {
  const { Hub } = require('../app/hub.js');
  const c = await setup();
  try {
    const made = (await api(c, '/threads', { method: 'POST', body: { project: '/tmp/waiting-turn-ended' } })).body;
    const lead = made.sessions[0];
    const sub = (await machinePost(c, '/machine/session', { calling_session: lead.name, action: 'start', role: 'sub-lead', attempt_id: 'sub-wait-turn-ended' })).body.session;
    const reset = new Date(Date.now() + 3600000).toISOString();
    const reading = { account: 'default-gpt', at: new Date(Date.now() - 1000).toISOString(), five_hour: null, week: { used: 100, resets_at: reset } };
    await event(c, made.id, lead.name, 'usage', { reading });
    const payload = { calling_session: sub.name, action: 'start', role: 'worker', provider: 'gpt', attempt_id: 'wait-turn-ended', brief: 'work' };
    const waiting = (await machinePost(c, '/machine/session', payload)).body.session;
    assert.equal(waiting.status, 'waiting');
    const hub = new Hub({ stateDir: c.state });
    const stored = await hub.thread(made.id);
    const target = stored.sessions.find((s) => s.name === waiting.name);
    const token = target.token;
    await event(c, made.id, lead.name, 'turn-ended', { reading: { ...reading, at: new Date(Date.now() + 1000).toISOString(), week: { used: 0, resets_at: reset } } });
    const promoted = (await hub.thread(made.id)).sessions.find((s) => s.name === waiting.name);
    assert.equal(promoted.status, 'ready');
    assert.equal(promoted.token, token);
  } finally { await close(c); }
});

test('limit hold releases with Continue and failed turns notify without a result', async () => {
  const { Hub } = require('../app/hub.js');
  const { releaseLimits } = require('../app/sessions.js');
  const c = await setup();
  try {
    const made = (await api(c, '/threads', { method: 'POST', body: { project: '/tmp/limits' } })).body;
    const lead = made.sessions[0];
    const sub = (await machinePost(c, '/machine/session', { calling_session: lead.name, action: 'start', role: 'sub-lead', attempt_id: 'sub-limit' })).body.session;
    const worker = (await machinePost(c, '/machine/session', { calling_session: sub.name, action: 'start', role: 'worker', attempt_id: 'worker-limit' })).body.session;
    const reviewer = (await machinePost(c, '/machine/session', { calling_session: lead.name, action: 'start', role: 'reviewer', attempt_id: 'review-limit' })).body.session;
    await event(c, made.id, worker.name, 'limit-hit', { limited_until: new Date(Date.now() + 3600000).toISOString(), error: 'limit' });
    let hub = new Hub({ stateDir: c.state });
    let stored = await hub.thread(made.id);
    assert.ok(stored.sessions.find((s) => s.name === worker.name).limited_until);
    const readings = await require('../app/usage.js').readings(hub);
    assert.equal(readings[worker.account].limited_until, stored.sessions.find((s) => s.name === worker.name).limited_until);
    await hub.enqueue(stored, worker.name, 'held during limit');
    stored = await hub.thread(made.id);
    assert.ok(stored.sessions.find((s) => s.name === worker.name).queue.some((q) => q.text === 'held during limit'));
    assert.ok(!c.machine.sessions.get(worker.name).submits?.includes('held during limit'));
    stored.sessions.find((s) => s.name === worker.name).limited_until = new Date(Date.now() - 1000).toISOString();
    await hub.save(stored); await releaseLimits(hub);
    stored = await hub.thread(made.id);
    const released = stored.sessions.find((s) => s.name === worker.name);
    assert.equal(released.limited_until, undefined);
    assert.ok(released.queue.some((q) => q.text === 'Continue.') || c.machine.sessions.get(worker.name).submits?.includes('Continue.'));
    await event(c, made.id, worker.name, 'turn-failed', { error: 'worker broke' });
    await event(c, made.id, reviewer.name, 'turn-failed', { error: 'review broke', result: 'wrong result' });
    stored = await hub.thread(made.id);
    assert.equal(stored.sessions.find((s) => s.name === reviewer.name).finished, undefined);
    assert.ok(!JSON.stringify(stored).includes('wrong result'));
    assert.ok(JSON.stringify(stored).includes('worker broke'));
  } finally { await close(c); }
});

test('promotion failure marks the waiting session failed', async () => {
  const { Hub } = require('../app/hub.js');
  const c = await setup();
  try {
    const made = (await api(c, '/threads', { method: 'POST', body: { project: '/tmp/promotion-failure' } })).body;
    const lead = made.sessions[0];
    const sub = (await machinePost(c, '/machine/session', { calling_session: lead.name, action: 'start', role: 'sub-lead', attempt_id: 'sub-fail' })).body.session;
    const reset = new Date(Date.now() + 3600000).toISOString();
    const reading = { account: 'default-gpt', at: new Date(Date.now() - 1000).toISOString(), five_hour: null, week: { used: 100, resets_at: reset } };
    await event(c, made.id, lead.name, 'usage', { reading });
    const waiting = (await machinePost(c, '/machine/session', { calling_session: sub.name, action: 'start', role: 'worker', provider: 'gpt', attempt_id: 'failed-promotion' })).body.session;
    assert.equal(waiting.status, 'waiting');
    c.machine.startOk = false;
    await event(c, made.id, lead.name, 'usage', { reading: { ...reading, at: new Date(Date.now() + 1000).toISOString(), week: { used: 0, resets_at: reset } } });
    const target = (await (new Hub({ stateDir: c.state })).thread(made.id)).sessions.find((s) => s.name === waiting.name);
    assert.equal(target.status, 'failed'); assert.equal(target.live, false); assert.ok(target.error);
  } finally { await close(c); }
});

test('waiting sessions survive polling and stop without a machine call', async () => {
  const { Hub } = require('../app/hub.js');
  const c = await setup();
  try {
    const made = (await api(c, '/threads', { method: 'POST', body: { project: '/tmp/wait-stop' } })).body;
    const lead = made.sessions[0];
    const sub = (await machinePost(c, '/machine/session', { calling_session: lead.name, action: 'start', role: 'sub-lead', attempt_id: 'sub-stop' })).body.session;
    const reset = new Date(Date.now() + 3600000).toISOString();
    await event(c, made.id, lead.name, 'usage', { reading: { account: 'default-gpt', at: new Date().toISOString(), five_hour: null, week: { used: 100, resets_at: reset } } });
    const waiting = (await machinePost(c, '/machine/session', { calling_session: sub.name, action: 'start', role: 'worker', provider: 'gpt', attempt_id: 'wait-stop' })).body.session;
    const hub = new Hub({ stateDir: c.state }); await hub.pollDead();
    assert.equal((await hub.thread(made.id)).sessions.find(s => s.name === waiting.name).live, true);
    const before = c.machine.calls.length;
    assert.equal((await machinePost(c, '/machine/session', { calling_session: sub.name, action: 'stop', name: waiting.name })).status, 200);
    assert.equal(c.machine.calls.slice(before).some(call => call.path.includes(encodeURIComponent(waiting.name))), false);
    assert.equal((await hub.thread(made.id)).sessions.find(s => s.name === waiting.name).status, 'stopped');
  } finally { await close(c); }
});

test('old threads acquire a provider on first read', async () => {
  const { Hub } = require('../app/hub.js');
  const { makeDir } = require('./helpers/server.js');
  const hub = new Hub({ stateDir: await makeDir('old-thread-') }); await hub.state.init();
  await hub.save({ id: 'old', cli: 'codex', sessions: [{ name: 'old-lead' }] });
  assert.equal((await hub.thread('old')).provider, 'gpt');
});

test('unused worker cell refuses a strict provider', async () => {
  const c = await setup();
  try {
    const made = (await api(c, '/threads', { method: 'POST', body: { project: '/tmp/unused' } })).body;
    const sub = (await machinePost(c, '/machine/session', { calling_session: made.sessions[0].name, action: 'start', role: 'sub-lead', attempt_id: 'sub-unused' })).body.session;
    await api(c, '/settings/models', { method: 'PUT', body: { provider: 'gpt', slot: 'heavy', model: null } });
    const response = await machinePost(c, '/machine/session', { calling_session: sub.name, action: 'start', role: 'worker', provider: 'gpt', tier: 'heavy', attempt_id: 'unused' });
    assert.equal(response.status, 400); assert.equal(response.body.detail, 'GPT is not used at heavy');
  } finally { await close(c); }
});

test('preflight retries on the other signed-in GPT account', async () => {
  const c = await setup();
  try {
    await api(c, '/settings/accounts', { method: 'POST', body: { provider: 'gpt', name: 'Second', plan: 'pro' } });
    c.machine.status.accounts.push({ id: 'second', cli: 'codex', logged_in: true });
    const made = (await api(c, '/threads', { method: 'POST', body: { project: '/tmp/retry' } })).body;
    const sub = (await machinePost(c, '/machine/session', { calling_session: made.sessions[0].name, action: 'start', role: 'sub-lead', attempt_id: 'sub-retry' })).body.session;
    const usage = require('../app/usage.js');
    const hub = new (require('../app/hub.js').Hub)({ stateDir: c.state });
    await usage.record(hub, { account: 'default-gpt', at: new Date().toISOString(), week: { used: 20, resets_at: new Date(Date.now() + 3600000).toISOString() } });
    c.machine.preflightOk = input => input.dir !== null;
    const started = await machinePost(c, '/machine/session', { calling_session: sub.name, action: 'start', role: 'worker', provider: 'gpt', attempt_id: 'retry' });
    assert.equal(started.body.session.account, 'second');
    assert.deepEqual(c.machine.calls.filter(x => x.path === '/v1/preflight').map(x => x.body.dir), [null, '~/.wheelchair/accounts/second']);
  } finally { await close(c); }
});

test('startup promotes a waiting session when room is available', async () => {
  const { Hub } = require('../app/hub.js');
  const c = await setup();
  try {
    const made = (await api(c, '/threads', { method: 'POST', body: { project: '/tmp/startup-wait' } })).body;
    const hub = new Hub({ stateDir: c.state });
    const stored = await hub.thread(made.id);
    stored.sessions.push({ name: `wc-${made.id}-worker-startup`, role: 'worker', status: 'waiting', live: true, token: 'token', queue: [], pending_start: { role: 'worker', provider: 'gpt', attempt_id: 'startup' } });
    await hub.save(stored); await hub.init();
    assert.equal((await hub.thread(made.id)).sessions.at(-1).status, 'ready');
  } finally { await close(c); }
});


test('worker placement uses account login on its own machine', async () => {
  const { Hub } = require('../app/hub.js');
  const settings = require('../app/settings.js');
  const { choose } = require('../app/balancer.js');
  const { makeDir } = require('./helpers/server.js');
  const hub = new Hub({ stateDir: await makeDir('balance-machines-') });
  await hub.state.init();
  await settings.update(hub, s => { s.accounts.push({ id: 'gpt-b', provider: 'gpt', name: 'B', plan: 'unknown', weight: 1, paused: false }); });
  hub.machines = async () => ({ a: { name: 'a' }, b: { name: 'b' } });
  hub.call = async machine => ({ accounts: [
    { id: 'default-gpt', cli: 'codex', logged_in: machine === 'a' },
    { id: 'gpt-b', cli: 'codex', logged_in: machine === 'b' },
  ] });
  hub.allThreads = async () => [];
  for (const [machine, account] of [['a', 'default-gpt'], ['b', 'gpt-b']]) {
    const selection = await choose(hub, { machine }, 'worker', 'top', { provider: 'gpt' });
    assert.equal(selection.account.id, account);
  }
});

test('limited verifier reports only after release and continuation', async () => {
  const { Hub } = require('../app/hub.js');
  const { releaseLimits } = require('../app/sessions.js');
  const c = await setup();
  try {
    const thread = (await api(c, '/threads', { method: 'POST', body: { project: '/tmp/limited-verifier' } })).body;
    const verifier = (await machinePost(c, '/machine/session', { calling_session: thread.sessions[0].name, action: 'start', role: 'verifier', attempt_id: 'limited-verifier' })).body.session;
    const future = new Date(Date.now() + 3600000).toISOString();
    await event(c, thread.id, verifier.name, 'turn-ended', { reading: { account: verifier.account, at: new Date().toISOString(), limited_until: future }, 'last-assistant-message': 'Partial report' });
    const hub = new Hub({ stateDir: c.state });
    let stored = await hub.thread(thread.id);
    assert.equal(stored.sessions.find(s => s.name === verifier.name).finished, undefined);
    assert.equal(stored.cards.filter(card => card.kind === 'result').length, 0);
    const usage = require('../app/usage.js');
    assert.equal(usage.hasRoom({ paused: false }, (await usage.readings(hub))[verifier.account], { loggedIn: true }), false);
    stored.sessions.find(s => s.name === verifier.name).limited_until = new Date(Date.now() - 1000).toISOString();
    await hub.save(stored); await releaseLimits(hub);
    assert.ok(c.machine.sessions.get(verifier.name).submits.includes('Continue.'));
    await event(c, thread.id, verifier.name, 'turn-ended', { 'last-assistant-message': 'Complete report' });
    stored = await hub.thread(thread.id);
    const results = stored.cards.filter(card => card.kind === 'result');
    assert.equal(results.length, 1); assert.equal(results[0].summary, 'Complete report');
    assert.equal(stored.sessions.find(s => s.name === verifier.name).finished, true);
  } finally { await close(c); }
});

for (const role of ['reviewer', 'verifier', 'worker']) {
  for (const scenario of ['live', 'late', 'spooled retry', 'limit-hit', 'control']) {
    test(`${role}: ${scenario} limit-ended delivery`, async () => {
      const { Hub } = require('../app/hub.js');
      const { releaseLimits } = require('../app/sessions.js');
      const c = await setup();
      try {
        const thread = (await api(c, '/threads', { method: 'POST', body: { project: `/tmp/d18-${role}-${scenario}` } })).body;
        let starter = thread.sessions[0];
        if (role === 'worker') starter = (await machinePost(c, '/machine/session', { calling_session: starter.name, action: 'start', role: 'sub-lead', attempt_id: 'sub' })).body.session;
        const target = (await machinePost(c, '/machine/session', { calling_session: starter.name, action: 'start', role, attempt_id: 'target' })).body.session;
        const hub = new Hub({ stateDir: c.state });
        const until = new Date(Date.now() + (scenario === 'live' ? 3600000 : -3600000)).toISOString();
        const extra = { 'last-assistant-message': 'Partial report' };
        if (scenario === 'limit-hit') extra.limited_until = until;
        else if (scenario !== 'control') extra.reading = { account: target.account, at: new Date().toISOString(), limited_until: until };
        if (scenario === 'spooled retry') extra.delivery_id = 'retry-id';
        const type = scenario === 'limit-hit' ? 'limit-hit' : 'turn-ended';
        await event(c, thread.id, target.name, type, extra);
        if (scenario === 'spooled retry') await event(c, thread.id, target.name, type, extra);
        let stored = await hub.thread(thread.id);
        const current = stored.sessions.find(s => s.name === target.name);
        const results = () => stored.cards.filter(card => card.kind === 'result');
        const submits = () => c.machine.sessions.get(target.name).submits || [];
        if (scenario === 'control') {
          assert.equal(results().length, role === 'worker' ? 0 : 1);
          if (role !== 'worker') assert.equal(results()[0].summary, 'Partial report');
          return;
        }
        assert.equal(current.finished, undefined);
        assert.equal(results().length, 0);
        if (scenario === 'live') {
          assert.equal(current.limited_until, until);
          assert.equal(submits().length, 0);
          current.limited_until = new Date(Date.now() - 1000).toISOString();
          await hub.save(stored);
          await releaseLimits(hub);
        } else assert.equal(current.limited_until, undefined);
        assert.deepEqual(submits(), ['Continue.']);
        await event(c, thread.id, target.name, 'turn-ended', { 'last-assistant-message': 'Complete report' });
        stored = await hub.thread(thread.id);
        assert.equal(results().length, role === 'worker' ? 0 : 1);
        if (role !== 'worker') assert.equal(results()[0].summary, 'Complete report');
      } finally { await close(c); }
    });
  }
}

test('waiting lead records provider and promoted role layers and style', async () => {
  const { Hub } = require('../app/hub.js');
  const settings = require('../app/settings.js');
  const { retryWaiting } = require('../app/sessions.js');
  const c = await setup();
  try {
    const hub = new Hub({ stateDir: c.state });
    await settings.update(hub, s => { s.lead_order = ['gpt', 'any']; s.accounts.forEach(a => { a.paused = true; }); s.style_version = 3; s.templates.push({ id: 'lead-template', role: 'lead', scope: 'all', in_use: true, switches: {}, text: '', name: 'Lead' }); });
    const thread = (await api(c, '/threads', { method: 'POST', body: { project: '/tmp/waiting-lead' } })).body;
    const lead = thread.sessions[0];
    assert.equal(lead.status, 'waiting'); assert.equal(lead.waiting_provider, 'gpt');
    await settings.update(hub, s => { s.accounts.forEach(a => { a.paused = false; }); });
    await retryWaiting(hub);
    let stored = await hub.thread(thread.id);
    const promoted = stored.sessions.find(s => s.name === lead.name);
    assert.equal(promoted.template_id, 'lead-template'); assert.equal(promoted.style_version, 3);
    await event(c, thread.id, lead.name, 'turn-ended');
    stored = await hub.thread(thread.id); await hub.enqueue(stored, lead.name, 'First message');
    assert.ok(c.machine.sessions.get(lead.name).submits.includes('First message'));
    assert.ok(!c.machine.sessions.get(lead.name).submits.some(s => s.includes('[wc:style]')));
  } finally { await close(c); }
});

test('lead and sub-lead use distinct model slots', async () => {
  const { slotFor } = require('../app/balancer.js');
  assert.equal(await slotFor(null, 'lead'), 'lead');
  assert.equal(await slotFor(null, 'sub-lead'), 'sub-lead');
});

test('OpenRouter explicit placement outside order respects review family', async () => {
  const { Hub } = require('../app/hub.js');
  const settings = require('../app/settings.js');
  const { choose } = require('../app/balancer.js');
  const { makeDir } = require('./helpers/server.js');
  const hub = new Hub({ stateDir: await makeDir('balance-openrouter-') });
  await hub.state.init();
  await settings.update(hub, s => { s.worker_order = ['claude']; s.save_for_leads = false; });
  hub.machines = async () => ({ m: { name: 'm' } });
  hub.call = async () => ({ accounts: [
    { id: 'default-openrouter', cli: 'pi', logged_in: true },
    { id: 'default-claude', cli: 'claude', logged_in: true },
    { id: 'default-gpt', cli: 'codex', logged_in: true },
  ] });
  hub.allThreads = async () => [];
  const thread = { machine: 'm' };
  for (const role of ['worker', 'reviewer', 'verifier']) assert.equal((await choose(hub, thread, role, 'heavy', { provider: 'openrouter' })).provider, 'openrouter');
  assert.equal((await choose(hub, thread, 'worker', 'heavy')).provider, 'claude');
  assert.ok((await choose(hub, thread, 'worker', 'heavy', { provider: 'gpt' })).wait);
  await settings.update(hub, s => { s.review_families = 'claude'; });
  assert.equal((await choose(hub, thread, 'reviewer', 'heavy', { provider: 'openrouter' })).provider, 'claude');
});
