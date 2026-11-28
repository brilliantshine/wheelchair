'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { makeTemp } = require('../../test-support/run-dir');
const { Hub } = require('../app/hub');
const settings = require('../app/settings');
const usage = require('../app/usage');
const poll = require('../app/usage-poll');
const sessions = require('../app/sessions');
const asides = require('../app/asides');
const chat = require('../app/chat');
const { api, close, setup } = require('./helpers/app');
const tools = [['claude','claude'],['gpt','codex'],['gemini','agy'],['kimi','kimi'],['openrouter','pi']];

test('idle probes all and only supported tools, including live Antigravity and Kimi', async () => {
  const dir = await makeTemp('char-hub-poll-'); const hub = new Hub({ stateDir: dir }); await hub.state.init();
  hub.machines = async () => ({ hub: { name: 'hub' } });
  hub.allThreads = async () => [{ sessions: [{ live: true, account: 'default-kimi' }, { live: true, account: 'default-gemini' }] }];
  const calls = [];
  hub.call = async (_m, route, _method, body) => {
    if (route === '/v1/status') return { ...Object.fromEntries(tools.map(([,cli]) => [cli, { installed: true }])), accounts: tools.map(([p,cli]) => ({ id: `default-${p}`, cli, logged_in: true })) };
    if (route === '/v1/usage') { calls.push(body); return { reading: { account: body.account, week: { used: 25, resets_at: null } } }; }
    throw Error(route);
  };
  await poll.pollIdle(hub);
  assert.deepEqual(calls, ['claude','gpt','gemini','kimi'].map(p => ({ account: `default-${p}`, cli: tools.find(t => t[0] === p)[1], dir: null })));
  assert.deepEqual(Object.keys(await usage.readings(hub)).sort(), ['default-claude','default-gemini','default-gpt','default-kimi']);

  const liveHub = new Hub({ stateDir: await makeTemp('char-hub-live-') }); await liveHub.state.init();
  liveHub.machines = hub.machines; liveHub.call = hub.call;
  liveHub.allThreads = async () => [{ sessions: tools.map(([p]) => ({ live: true, account: `default-${p}` })) }];
  calls.length = 0; await poll.pollIdle(liveHub);
  assert.deepEqual(calls, [{ account: 'default-gemini', cli: 'agy', dir: null }, { account: 'default-kimi', cli: 'kimi', dir: null }]);
  assert.deepEqual(Object.keys(await usage.readings(liveHub)).sort(), ['default-gemini', 'default-kimi']);

  const retryHub = new Hub({ stateDir: await makeTemp('char-hub-retry-') }); await retryHub.state.init();
  retryHub.machines = async () => ({ hub: { name: 'hub' }, second: { name: 'second' } });
  retryHub.allThreads = async () => [];
  const attempts = [];
  retryHub.call = async (machine, route, _method, body) => {
    if (route === '/v1/status') return { ...Object.fromEntries(tools.map(([,cli]) => [cli, { installed: true }])), accounts: tools.map(([p,cli]) => ({ id: `default-${p}`, cli, logged_in: true })) };
    attempts.push([machine, body.cli]);
    if (machine === 'hub') throw Error('probe failed');
    return { reading: { account: body.account, week: { used: 40, resets_at: null } } };
  };
  await poll.pollIdle(retryHub);
  assert.deepEqual(attempts, [['hub','claude'], ['hub','codex'], ['hub','agy'], ['hub','kimi'], ['second','kimi']]);
  assert.deepEqual(Object.keys(await usage.readings(retryHub)), ['default-kimi']);
});

test('usage displays forecasts, spend, problems and warnings by provider', async () => {
  const dir = await makeTemp('char-hub-usage-'); const hub = new Hub({ stateDir: dir }); await hub.state.init();
  hub.machines = async () => ({ hub: { name: 'hub' } }); hub.allThreads = async () => [];
  hub.call = async (_m, route) => {
    if (route === '/v1/spend') return { accounts: [{ today: 1, last_7_days: 2, last_30_days: 3 }] };
    if (route === '/v1/status') return { ...Object.fromEntries(tools.map(([,cli]) => [cli, { installed: true, problem: `${cli} broken`, warning: `${cli} warning` }])), accounts: tools.map(([p,cli]) => ({ id: `default-${p}`, cli, logged_in: true, problem: `${cli} account problem` })) };
    throw Error(route);
  };
  const now = Date.now();
  for (const [p] of tools) await usage.record(hub, { account: `default-${p}`, at: new Date(now).toISOString(), week: { used: 50, resets_at: new Date(now + 86400000).toISOString() } });
  let result = (await usage.summary(hub, true, now)).providers;
  for (const [p,cli] of tools) {
    assert.equal(result[p].left, p === 'openrouter' ? null : 0.5, p);
    assert.equal(Object.hasOwn(result[p], 'spend'), p === 'openrouter', p);
    assert.deepEqual(result[p].accounts[0].machines.hub, p === 'kimi' || p === 'openrouter' ? { state: 'problem', text: `${cli} broken` } : 'signed_in', p);
  }
  assert.deepEqual(result.openrouter.spend, { today: 1, last_7_days: 2, last_30_days: 3, incomplete: false });
  hub.call = async (_m, route) => route === '/v1/spend' ? { accounts: [] } : { ...Object.fromEntries(tools.map(([,cli]) => [cli, { installed: true, warning: `${cli} warning` }])), accounts: tools.map(([p,cli]) => ({ id: `default-${p}`, cli, logged_in: false })) };
  usage.clearCache(hub); result = (await usage.summary(hub, true, now)).providers;
  for (const [p] of tools) assert.deepEqual(result[p].accounts[0].machines.hub, p === 'openrouter' ? { state: 'signed_out', warning: 'pi warning' } : 'signed_out', p);
  const previousCall = hub.call; hub.call = async (...args) => { const status = await previousCall(...args); if (args[1] === '/v1/status') for (const account of status.accounts) account.logged_in = true; return status; };
  usage.clearCache(hub); result = (await usage.summary(hub, true, now)).providers;
  for (const [p] of tools) assert.deepEqual(result[p].accounts[0].machines.hub, p === 'openrouter' ? { state: 'signed_in', warning: 'pi warning' } : 'signed_in', p);
  hub.call = async (...args) => { const status = await previousCall(...args); if (args[1] === '/v1/status') for (const account of status.accounts) account.problem = `${account.cli} account problem`; return status; };
  usage.clearCache(hub); result = (await usage.summary(hub, true, now)).providers;
  for (const [p,cli] of tools) assert.deepEqual(result[p].accounts[0].machines.hub, { state: 'problem', text: `${cli} account problem` }, p);
});

test('settings preserve provider plans, scout wording, review fallback and discovery', () => {
  assert.deepEqual(settings.PLANS, { claude: { unknown: 1, pro: 1, max5: 5, max20: 20 }, gpt: { unknown: 1, plus: 1, prolite: 5, pro: 10, promax: 25 }, gemini: { unknown: 1, pro: 1, ultra: 4 }, kimi: { unknown: 1 }, openrouter: { unknown: 1 } });
  for (const [p] of tools) {
    assert.equal(settings.normalize({ review_families: p }).review_families, p);
    const text = settings.roleLayers(settings.defaults(), 'lead', '/tmp/project', { light: 'model', heavy: 'strong' }, p).text;
    const clause = p === 'claude' ? ' (Claude Code: the Agent tool with model "model")' : '';
    assert.ok(text.includes(`Scout model for code reading: model. Questions that need more than a couple of files read go to your CLI's built-in helper on this model${clause}, asking for conclusions with file:line evidence, not file dumps.`), p);
  }
  assert.equal(settings.normalize({ review_families: 'invalid' }).review_families, 'both');
  const o = settings.options({ visible: ['gpt-a','gpt-a'], gpt: { light: { model: 'gpt-b' } }, kimi_visible: [{ value: 'k-a', label: 'K A' }, { value: 3, label: 'bad' }], kimi: { light: { model: 'k-b' } }, gemini: { light: { model: 'g' } }, openrouter: { light: { model: 'x/y' } } });
  assert.deepEqual(o.claude.map(x => x.value), ['haiku','sonnet','opus','fable','claude-haiku-5-5','claude-sonnet-5-5','claude-opus-5-5','claude-fable-5-2']);
  assert.deepEqual(o.gpt, [{ value: 'gpt-a', label: 'gpt-a' }, { value: 'gpt-b', label: 'gpt-b' }]);
  assert.deepEqual(o.kimi, [{ value: 'k-a', label: 'K A' }, { value: 'k-b', label: 'k-b' }]);
  assert.deepEqual(o.gemini, [{ value: 'g', label: 'g' }]); assert.equal(o.openrouter, undefined);
});

test('model routes validate each provider, aliases, efforts and review choices', async () => {
  const c = await setup();
  try {
    const put = body => api(c, '/settings/models', { method: 'PUT', body: { slot: 'light', ...body } });
    for (const [provider] of tools) {
      const invalid = await put({ provider, model: provider === 'openrouter' ? `a/${'x'.repeat(127)}` : 'a'.repeat(65) });
      assert.equal(invalid.status, 400, provider); assert.equal(invalid.body.detail, 'model is invalid', provider);
      const model = provider === 'openrouter' ? 'vendor/model' : provider === 'kimi' ? 'vendor/model' : 'model-1';
      assert.equal((await put({ provider, model })).status, 200, provider);
      const bad = await put({ provider, model, effort: 'ultra' });
      assert.equal(bad.body.detail, provider === 'gpt' ? 'effort for GPT must be one of low, medium, high, xhigh' : provider === 'kimi' ? 'Kimi Code has no effort setting' : 'effort is invalid', provider);
    }
    assert.equal((await put({ provider: 'gpt', model: 'a'.repeat(64) })).status, 200);
    assert.equal((await put({ provider: 'kimi', model: 'vendor/model' })).status, 200);
    assert.equal((await put({ provider: 'claude', model: 'vendor/model' })).body.detail, 'model is invalid');
    assert.equal((await put({ provider: 'openrouter', model: 'vendor/model:free' })).status, 200);
    for (const [alias,slot] of [['haiku','light'],['sonnet','standard'],['opus','heavy']]) {
      const r = await put({ provider: 'claude', slot: alias, model: 'alias-model' });
      assert.equal(r.status, 200); assert.equal(r.body.models.claude[slot].model, 'alias-model');
      for (const [provider] of tools.filter(([p]) => p !== 'claude')) assert.equal((await put({ provider, slot: alias, model: provider === 'openrouter' ? 'v/m' : 'model' })).body.detail, 'slot is invalid', provider);
    }
    for (const value of ['both', ...tools.map(([p]) => p)]) assert.equal((await api(c, '/settings/preferences', { method: 'PUT', body: { review_families: value } })).body.review_families, value);
    const bad = await api(c, '/settings/preferences', { method: 'PUT', body: { review_families: 'invalid' } });
    assert.equal(bad.body.detail, 'review_families must be both, claude, gpt, gemini, kimi or openrouter');
  } finally { await close(c); }
});

test('aside fork chooses each supported parent and rejects unsupported providers', async () => {
  const originalChat = chat.chat, originalModel = settings.modelCommand;
  chat.chat = async () => ({ items: [{ type: 'assistant', id: 'lead#0' }] }); settings.modelCommand = async () => ({ stdout: 'model' });
  try {
    for (const [provider,cli] of tools) {
      const thread = { sessions: [{ role: 'lead', live: true, provider, cli, cli_session_id: 'cli-parent', codex_thread_id: 'codex-parent', agy_conversation_id: 'agy-parent' }], asides: [] };
      const hub = { save: async () => {} };
      const input = { message_id: 'lead#0', start: 0, end: 1, quote: 'x', action: 'ask' };
      if (provider === 'gemini' || provider === 'kimi') await assert.rejects(asides.create(hub, thread, input), { status: 400, message: `Side conversations aren't available on ${provider === 'kimi' ? 'Kimi Code' : 'Antigravity'} sessions yet` });
      else assert.equal((await asides.create(hub, thread, input)).fork_parent, provider === 'gpt' ? 'codex-parent' : 'cli-parent', provider);
    }
  } finally { chat.chat = originalChat; settings.modelCommand = originalModel; }
});

test('chat selects distinct report and transcript formats for every CLI', () => {
  const lines = rows => rows.map(JSON.stringify).join('\n');
  const samples = {
    claude: lines([{ type: 'user', origin: { kind: 'human' }, message: { content: 'question' } }, { type: 'assistant', message: { role: 'assistant', content: 'answer' } }]),
    codex: lines([{ type: 'turn_context' }, { type: 'response_item', payload: { type: 'message', role: 'user', content: 'question' } }, { type: 'response_item', payload: { type: 'message', role: 'assistant', content: 'answer' } }]),
    agy: lines([{ type: 'USER_INPUT', content: 'question' }, { type: 'PLANNER_RESPONSE', content: 'answer' }]),
    kimi: lines([{ type: 'turn.prompt', origin: { kind: 'user' }, turnId: 7, input: 'question' }, { type: 'context.append_loop_event', event: { type: 'step.begin', uuid: 's' } }, { type: 'context.append_loop_event', event: { type: 'content.part', stepUuid: 's', block: 0, part: { type: 'text', text: 'answer' } } }, { type: 'turn.ended', turnId: 7 }]),
    pi: lines([{ type: 'message', id: 'u', message: { role: 'user', content: 'question' } }, { type: 'message', id: 'a', message: { role: 'assistant', content: 'answer' } }]),
  };
  for (const [,cli] of tools) {
    assert.deepEqual(chat.transcriptItems(cli, samples[cli], {}, 'agent').map(x => x.text), ['question', 'answer'], cli);
    assert.equal(chat.lastAssistantText(cli, samples[cli], 7, 'a'), 'answer', cli);
  }
  assert.equal(chat.lastAssistantText('kimi', samples.kimi, 8), '');
  assert.equal(chat.lastAssistantText('pi', samples.pi, 7, 'other'), '');
});

test('session limit switching and persisted harness ids vary by provider', async () => {
  for (const [provider,cli] of tools) {
    const hub = new Hub({ stateDir: await makeTemp('char-hub-session-') }); await hub.state.init();
    await settings.update(hub, s => { s.accounts.push({ id: 'second', provider, name: 'second', plan: 'unknown', weight: 1, paused: false }); });
    hub.machines = async () => ({ hub: { name: 'hub' } });
    hub.call = async (_machine, route) => {
      if (route === '/v1/sessions') return [{ name: 'agent', running: true, cli_session_id: 'listed-cli', codex_thread_id: 'listed-codex', agy_conversation_id: 'listed-agy' }];
      if (route === '/v1/status') return { [cli]: { installed: true }, accounts: [{ id: `default-${provider}`, cli, logged_in: true }, { id: 'second', cli, logged_in: true }] };
      return { accepted: true };
    };
    const target = { name: 'agent', role: 'lead', provider, cli, account: `default-${provider}`, live: true, ready: false, queue: [], cli_session_id: 'old-cli', codex_thread_id: 'old-codex', agy_conversation_id: 'old-agy' };
    const thread = { id: 'sessiontest', project: '/tmp/project', machine: 'hub', sessions: [target], cards: [], queues: {}, sent: [] };
    await hub.save(thread);
    await sessions.event(hub, { thread_id: thread.id, session: 'agent', type: 'turn-ended', interrupted: true, cli_session_id: 'new-cli', codex_thread_id: 'new-codex', agy_conversation_id: 'new-agy' });
    let current = (await hub.thread(thread.id)).sessions[0];
    assert.deepEqual([current.cli_session_id, current.codex_thread_id, current.agy_conversation_id], ['new-cli','new-codex','new-agy'], provider);
    await sessions.pollDead(hub);
    current = (await hub.thread(thread.id)).sessions[0];
    assert.deepEqual([current.cli_session_id, current.codex_thread_id, current.agy_conversation_id], ['listed-cli','listed-codex','listed-agy'], provider);
    const limit = new Date(Date.now() + 3600000).toISOString();
    await sessions.event(hub, { thread_id: thread.id, session: 'agent', type: 'limit-hit', limited_until: limit });
    current = (await hub.thread(thread.id)).sessions[0];
    assert.equal(Boolean(current.switching), ['claude','gpt'].includes(provider), provider);
    if (!['claude','gpt'].includes(provider)) assert.equal(current.limited_until, limit, provider);
  }
});

test('worker effort ceilings apply to every provider with effort', async () => {
  const c = await setup();
  try {
    for (const [provider,cli] of tools) {
      c.machine.status[cli] = { installed: true, logged_in: true };
      if (!c.machine.status.accounts.some(a => a.id === `default-${provider}`)) c.machine.status.accounts.push({ id: `default-${provider}`, cli, logged_in: true });
      const model = provider === 'openrouter' ? 'vendor/model' : 'model';
      const r = await api(c, '/settings/models', { method: 'PUT', body: { provider, slot: 'standard', model } }); assert.equal(r.status, 200, provider);
    }
    const made = (await api(c, '/threads', { method: 'POST', body: { project: '/tmp/char-hub-effort' } })).body;
    const sub = await require('./helpers/app').machinePost(c, '/machine/session', { calling_session: made.sessions[0].name, action: 'start', role: 'sub-lead', attempt_id: 'effort-sub' });
    assert.equal(sub.status, 200);
    await api(c, '/settings/preferences', { method: 'PUT', body: { escalation: { max_effort: 'high' } } });
    for (const [provider] of tools) {
      const result = await require('./helpers/app').machinePost(c, '/machine/session', { calling_session: sub.body.session.name, action: 'start', role: 'worker', provider, tier: 'standard', effort: 'xhigh', attempt_id: `effort-${provider}` });
      if (provider === 'kimi') { assert.equal(result.status, 200, JSON.stringify(result.body)); assert.equal(result.body.session.effort ?? null, null); }
      else { assert.equal(result.status, 400, provider); assert.equal(result.body.detail, 'effort xhigh is above the highest effort in Settings (high)', provider); }
    }
  } finally { await close(c); }
});

test('session model resolution uses provider cells and tier aliases', async () => {
  const fs = require('node:fs/promises');
  const root = await makeTemp('char-hub-models-');
  await fs.mkdir(path.join(root, 'codex'));
  await fs.writeFile(path.join(root, 'codex', 'model.sh'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$(dirname "$0")/calls"\nif [ "$1" = effort ]; then echo high; else echo "$1-$2"; fi\n', { mode: 0o755 });
  const hub = new Hub({ stateDir: path.join(root, 'state') }); await hub.state.init(); hub.root = root;
  for (const [provider,cli] of tools) for (const [alias,slot] of [['haiku','light'],['sonnet','standard'],['opus','heavy']]) {
    assert.deepEqual(await sessions.resolveModel(hub, cli, 'worker', alias), { model: `${provider}-${slot}`, effort: provider === 'kimi' ? undefined : 'high', slot }, `${provider} ${alias}`);
  }
  const calls = (await fs.readFile(path.join(root, 'codex', 'calls'), 'utf8')).trim().split('\n');
  assert.deepEqual(calls, tools.flatMap(([provider]) => ['light','standard','heavy'].flatMap(slot => provider === 'kimi' ? [`${provider} ${slot}`] : [`${provider} ${slot}`, `effort ${provider} ${slot}`])));
  await fs.writeFile(path.join(root, 'codex', 'calls'), '');
  hub.machines = async () => ({ hub: { name: 'hub' } }); hub.allThreads = async () => [];
  hub.call = async (_machine, route, _method, body) => {
    if (route === '/v1/status') return { version: hub.codeVersion, ...Object.fromEntries(tools.map(([,cli]) => [cli, { installed: true }])), accounts: tools.map(([p,cli]) => ({ id: `default-${p}`, cli, logged_in: true })) };
    if (route === '/v1/preflight') return {};
    if (route === '/v1/sessions') return { name: body.name, status: 'ready' };
    throw Error(route);
  };
  for (const [provider,cli] of tools) {
    const thread = { id: `scout-${provider}`, provider, cli, machine: 'hub', project: '/tmp/project', sessions: [], cards: [], queues: {}, sent: [] };
    const started = await sessions.startSession(hub, thread, { role: 'sub-lead' });
    assert.equal(started.provider, provider);
  }
  const scoutCalls = (await fs.readFile(path.join(root, 'codex', 'calls'), 'utf8')).trim().split('\n');
  for (const [provider] of tools) for (const slot of ['light','standard']) {
    assert.ok(scoutCalls.includes(provider === 'claude' ? `family claude ${slot}` : `${provider} ${slot}`), `${provider} ${slot}`);
  }
});

test('switch placement runs preflight only for GPT', async () => {
  const { chooseSwitch } = require('../app/balancer');
  for (const [provider,cli] of tools) {
    const hub = new Hub({ stateDir: await makeTemp('char-hub-preflight-') }); await hub.state.init();
    hub.machines = async () => ({ hub: { name: 'hub' } }); hub.allThreads = async () => [];
    const calls = [];
    hub.call = async (_machine, route) => {
      calls.push(route);
      if (route === '/v1/status') return { [cli]: { installed: true }, accounts: [{ id: `default-${provider}`, cli, logged_in: true }] };
      if (route === '/v1/preflight') return {};
      throw Error(route);
    };
    assert.equal((await chooseSwitch(hub, { machine: 'hub' }, { provider, role: 'lead' })).account.id, `default-${provider}`);
    assert.deepEqual(calls, provider === 'gpt' ? ['/v1/status', '/v1/preflight'] : ['/v1/status'], provider);
  }
});
