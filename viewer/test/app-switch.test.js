'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Hub } = require('../app/hub.js');
const settings = require('../app/settings.js');
const usage = require('../app/usage.js');
const { chooseSwitch } = require('../app/balancer.js');
const sessions = require('../app/sessions.js');
const quiet = require('../app/quiet.js');
const { makeDir } = require('./helpers/server.js');
const carry = '[wc:context switch] Your account hit its usage limit, so this conversation was moved to another account. Carry on from where you stopped.';
const future = () => new Date(Date.now() + 3600000).toISOString();
async function fixture(provider = 'claude', extra = true) {
  const hub = new Hub({ stateDir: await makeDir('switch-') }); await hub.state.init();
  const calls = [], submits = [];
  hub.machines = async () => ({ hub: { name: 'hub' } });
  hub.call = async (machine, path, method, body) => {
    calls.push({ path, body });
    if (path === '/v1/status') return { claude: { installed: true }, codex: { installed: true }, agy: { installed: true }, accounts: [{ id: `default-${provider}`, cli: provider === 'gpt' ? 'codex' : provider === 'gemini' ? 'agy' : 'claude', logged_in: true }, ...(extra ? [{ id: 'second', cli: provider === 'gpt' ? 'codex' : provider === 'gemini' ? 'agy' : 'claude', logged_in: true }] : [])] };
    if (path.endsWith('/submit')) { submits.push(body.text); return {}; }
    return { accepted: true };
  };
  await settings.update(hub, s => { if (extra) s.accounts.push({ id: 'second', provider, name: 'Second', plan: 'unknown', weight: 1, paused: false }); s.held_back.worker = false; });
  const target = { name: 'agent', role: 'lead', provider, account: `default-${provider}`, model: 'saved-model', live: true, ready: true, turn_ended: false, queue: [] };
  const thread = { id: 'switchtest', project: '/tmp/project', machine: 'hub', sessions: [target], cards: [], queues: {}, sent: [] };
  await hub.save(thread);
  return { hub, calls, submits, thread, target };
}
async function current(c) { return (await c.hub.thread(c.thread.id)).sessions[0]; }
async function waitFor(fn) { for (let i = 0; i < 300; i++) { if (await fn()) return; await new Promise(r => setTimeout(r, 20)); } throw new Error('timed out'); }
for (const provider of ['claude', 'gpt']) test(`${provider} switches and carries on before held messages`, async () => {
  const c = await fixture(provider); const limit = future();
  await sessions.event(c.hub, { thread_id: c.thread.id, session: 'agent', type: provider === 'gpt' ? 'turn-ended' : 'limit-hit', ...(provider === 'gpt' ? { reading: { account: 'default-gpt', at: new Date().toISOString(), limited_until: limit }, 'last-assistant-message': 'partial' } : { limited_until: limit }) });
  await waitFor(async () => (await current(c)).account === 'second');
  let thread = await c.hub.thread(c.thread.id), target = thread.sessions[0];
  assert.equal(target.switches.length, 1); assert.equal(target.switches[0].from, `default-${provider}`);
  const request = c.calls.find(x => x.path.endsWith('/switch'));
  assert.deepEqual(request.body, { switch_id: target.switching.id, account: { id: 'second', dir: '~/.wheelchair/accounts/second' }, model: 'saved-model', project: 'project', project_dir: '/tmp/project' });
  await sessions.enqueue(c.hub, thread, 'agent', 'held one');
  thread = await c.hub.thread(c.thread.id); await sessions.enqueue(c.hub, thread, 'agent', 'held two');
  assert.deepEqual(c.submits, []);
  await sessions.event(c.hub, { thread_id: c.thread.id, session: 'agent', type: 'ready', switch_id: target.switching.id });
  assert.deepEqual(c.submits, [carry]);
  await sessions.event(c.hub, { thread_id: c.thread.id, session: 'agent', type: 'turn-ended' });
  await sessions.event(c.hub, { thread_id: c.thread.id, session: 'agent', type: 'turn-ended' });
  assert.deepEqual(c.submits, [carry, 'held one', 'held two']);
});
test('no alternate and other providers retain the limit hold', async () => {
  for (const provider of ['claude', 'gemini']) {
    const c = await fixture(provider, false), limit = future();
    await sessions.event(c.hub, { thread_id: c.thread.id, session: 'agent', type: 'limit-hit', limited_until: limit });
    let thread = await c.hub.thread(c.thread.id); assert.equal(thread.sessions[0].limited_until, limit);
    thread.sessions[0].limited_until = new Date(Date.now() - 1000).toISOString(); await c.hub.save(thread); await sessions.releaseLimits(c.hub);
    assert.deepEqual(c.submits, ['Continue.']); assert.equal(c.calls.some(x => x.path.endsWith('/switch')), false);
  }
});

// Claude limit-hit never reaches report delivery; its worker case covers the switch.
// The GPT reviewer case exercises report suppression on a limited turn-ended.
for (const [provider, role] of [['gpt', 'worker'], ['claude', 'worker'], ['gpt', 'reviewer']]) test(`${provider} ${role} does not report a limited turn to its starter`, async () => {
  const c = await fixture(provider), limit = future();
  const thread = await c.hub.thread(c.thread.id);
  Object.assign(thread.sessions[0], { role, started_by: 'starter', owes_reply: true });
  thread.sessions.push({ name: 'starter', role: 'sub-lead', live: true, ready: true, turn_ended: true, queue: [] });
  await c.hub.save(thread);
  await sessions.event(c.hub, { thread_id: c.thread.id, session: 'agent', type: provider === 'gpt' ? 'turn-ended' : 'limit-hit', 'last-assistant-message': 'A completed report', ...(provider === 'gpt' ? { reading: { account: 'default-gpt', at: new Date().toISOString(), limited_until: limit } } : { limited_until: limit }) });
  await waitFor(async () => (await current(c)).account === 'second');
  const after = await c.hub.thread(c.thread.id);
  assert.ok(after.sessions[0].switching);
  assert.deepEqual(after.sessions[1].queue, []);
  assert.deepEqual(c.submits, []);
  assert.equal(after.cards.some(card => card.kind === 'result'), false);
});
test('gemini holds even with another signed-in account', async () => {
  const c = await fixture('gemini'), limit = future();
  await sessions.event(c.hub, { thread_id: c.thread.id, session: 'agent', type: 'limit-hit', limited_until: limit });
  const target = await current(c);
  assert.equal(target.limited_until, limit);
  assert.equal(target.switching, undefined);
  assert.equal(c.calls.some(x => x.path.endsWith('/switch')), false);
});
test('quiet sweep holds reminders during a switch and sends them afterward', async () => {
  const c = await fixture();
  let thread = await c.hub.thread(c.thread.id);
  Object.assign(thread.sessions[0], { role: 'worker', started_by: 'starter', owes_reply: true, turn_ended: true, quiet_check_at: new Date(Date.now() - 1000).toISOString(), switching: { id: 'switch', to: 'second' } });
  thread.sessions.push({ name: 'starter', role: 'sub-lead', live: true, ready: true, turn_ended: true, queue: [] });
  await c.hub.save(thread);
  await quiet.checkQuiet(c.hub);
  thread = await c.hub.thread(c.thread.id);
  assert.deepEqual(thread.sessions.map(s => s.queue), [[], []]);
  assert.deepEqual(c.submits, []);
  assert.equal(thread.sessions[0].quiet_stage || 0, 0);
  delete thread.sessions[0].switching; await c.hub.save(thread);
  await quiet.checkQuiet(c.hub);
  assert.match(c.submits.join(' '), /Your turn ended without a result or a question/);
});
test('matching failures restore hold and unrelated callbacks are ignored', async () => {
  const c = await fixture(); const limit = future();
  await sessions.event(c.hub, { thread_id: c.thread.id, session: 'agent', type: 'limit-hit', limited_until: limit });
  await waitFor(async () => (await current(c)).account === 'second');
  const id = (await current(c)).switching.id;
  for (const type of ['ready', 'switch-failed']) await sessions.event(c.hub, { thread_id: c.thread.id, session: 'agent', type, switch_id: 'other' });
  assert.equal((await current(c)).switching.id, id);
  await sessions.event(c.hub, { thread_id: c.thread.id, session: 'agent', type: 'switch-failed', switch_id: id });
  const target = await current(c); assert.equal(target.account, 'default-claude'); assert.equal(target.limited_until, limit); assert.equal(target.switching, undefined);
});
test('selector respects reserve and preflight retry', async () => {
  const c = await fixture('gpt');
  await settings.update(c.hub, s => { s.accounts.push({ id: 'third', provider: 'gpt', name: 'Third', plan: 'unknown', weight: 1, paused: false }); });
  const oldCall = c.hub.call; c.hub.call = async (...args) => { if (args[1] === '/v1/status') { const value = await oldCall(...args); value.accounts.push({ id: 'third', cli: 'codex', logged_in: true }); return value; } if (args[1] === '/v1/preflight' && args[3].dir === '~/.wheelchair/accounts/second') throw Error('preflight'); return oldCall(...args); };
  await usage.record(c.hub, { account: 'default-gpt', at: new Date().toISOString(), limited_until: future() });
  for (const role of ['lead', 'mapper', 'reviewer']) assert.equal((await chooseSwitch(c.hub, c.thread, { provider: 'gpt', role })).account.id, 'third');
  const thread = await c.hub.thread(c.thread.id); thread.sessions[0].switching = { id: 'x', to: 'third', at: new Date().toISOString() }; thread.sessions[0].owes_reply = true; thread.sessions[0].role = 'worker'; thread.sessions[0].started_by = 'starter'; thread.sessions[0].turn_ended = true;
  quiet.arm(c.hub, thread.sessions[0]); assert.equal(thread.sessions[0].quiet_check_at, undefined); assert.equal(quiet.isQuiet(thread, thread.sessions[0]), false);
});
test('refused and unreachable switch requests restore the old hold', async () => {
  for (const refused of [true, false]) {
    const c = await fixture(), limit = future(), original = c.hub.call; let attempts = 0;
    c.hub.call = async (...args) => { if (args[1].endsWith('/switch')) { attempts++; const e = new Error('failed'); if (refused) e.status = 404; throw e; } return original(...args); };
    await sessions.event(c.hub, { thread_id: c.thread.id, session: 'agent', type: 'limit-hit', limited_until: limit });
    await waitFor(async () => !(await current(c)).switching);
    let thread = await c.hub.thread(c.thread.id); assert.equal(thread.sessions[0].account, 'default-claude'); assert.equal(thread.sessions[0].limited_until, limit); assert.equal(attempts, refused ? 1 : 3);
    thread.sessions[0].limited_until = new Date(Date.now() - 1000).toISOString(); await c.hub.save(thread); await sessions.releaseLimits(c.hub); assert.deepEqual(c.submits, ['Continue.']);
  }
});
test('lead reserve holds a worker back', async () => {
  const c = await fixture();
  await settings.update(c.hub, s => { s.lead_order = ['claude']; s.margin = 90; s.held_back.worker = true; });
  await usage.record(c.hub, { account: 'default-claude', at: new Date().toISOString(), limited_until: future(), week: { used: 70, resets_at: future() } });
  await usage.record(c.hub, { account: 'second', at: new Date().toISOString(), week: { used: 70, resets_at: future() } });
  assert.equal(await chooseSwitch(c.hub, c.thread, { provider: 'claude', role: 'worker' }), null);
  assert.equal((await chooseSwitch(c.hub, c.thread, { provider: 'claude', role: 'lead' })).account.id, 'second');
});
