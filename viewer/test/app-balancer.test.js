'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, close, api, machinePost, event } = require('./helpers/app.js');

test('default placement, strict and preferred constraints, and invalid flags', async () => {
  const c = await setup();
  try {
    const made = (await api(c, '/threads', { method: 'POST', body: { project: '/tmp/placement' } })).body;
    assert.equal(made.provider, 'claude');
    assert.equal(made.cli, 'claude');
    assert.equal(made.sessions[0].account, 'default-claude');
    const lead = made.sessions[0].name;
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
  const { choose } = require('../app/balancer.js');
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
    assert.ok((await choose(hub, { machine: 'hub' }, 'worker', 'top', { provider: 'claude' })).wait);
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
    const hub = await fixture({ worker_order: ['claude', 'gpt'], margin: 50 }, { 'default-claude': { week: { used: 70, resets_at: future(24) } } });
    const selection = await choose(hub, { machine: 'hub' }, 'worker', 'top', { provider: 'claude' });
    assert.equal(selection.provider, 'gpt'); assert.match(selection.note, /claude.*gpt/);
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
    assert.equal(response.status, 400); assert.match(response.body.message, /GPT is not used at heavy/);
  } finally { await close(c); }
});

test('preflight retries on the other signed-in GPT account', async () => {
  const c = await setup();
  try {
    await api(c, '/settings/accounts', { method: 'POST', body: { provider: 'gpt', name: 'Second', plan: 'pro' } });
    c.machine.status.accounts.push({ id: 'second', cli: 'codex', logged_in: true });
    const made = (await api(c, '/threads', { method: 'POST', body: { project: '/tmp/retry' } })).body;
    const sub = (await machinePost(c, '/machine/session', { calling_session: made.sessions[0].name, action: 'start', role: 'sub-lead', attempt_id: 'sub-retry' })).body.session;
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
