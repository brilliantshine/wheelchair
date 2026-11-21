'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, close, api, machinePost } = require('./helpers/app.js');
const settings = require('../app/settings.js');
const path = require('node:path');
const { makeTempSync } = require('../../test-support/run-dir.js');
process.env.WHEELCHAIR_MODELS = path.join(makeTempSync('harness-models-'), 'models');

test('harness settings normalize and preserve fresh onboarding', () => {
  assert.equal(settings.defaults().onboarding_done, false);
  const saved = settings.normalize({ harnesses: { claude: false, gpt: 1, extra: false } });
  assert.equal(saved.onboarding_done, true);
  assert.deepEqual(saved.harnesses, { claude: false, gpt: true, gemini: true, kimi: true, openrouter: true });
  assert.equal(settings.normalize(settings.defaults()).onboarding_done, false);
});

test('switches, lead guard, waiting reason and harness status', async () => {
  const c = await setup();
  try {
    const start = (await api(c, '/threads', { method: 'POST', body: { project: '/tmp/harness-test' } })).body;
    assert.equal((await api(c, '/settings/harnesses/missing', { method: 'PUT', body: { enabled: false } })).status, 404);
    assert.equal((await api(c, '/settings/harnesses/claude', { method: 'PUT', body: { enabled: 'no' } })).status, 400);
    const switched = await api(c, '/settings/harnesses/claude', { method: 'PUT', body: { enabled: false } });
    assert.equal(switched.status, 200); assert.equal(switched.body.harnesses.claude, false);
    assert.equal((await api(c, '/settings/balancing', { method: 'PUT', body: { lead_order: ['claude'] } })).status, 409);
    const sub = await machinePost(c, '/machine/session', { calling_session: start.sessions[0].name, action: 'start', role: 'sub-lead', attempt_id: 'left-out' });
    assert.equal(sub.body.session.waiting_reason, 'Claude Code is left out in Settings');
    const data = (await api(c, '/harnesses?fresh=1')).body;
    assert.equal(data.switches.claude, false); assert.equal(data.threads_using.claude, 1);
    assert.deepEqual(data.machines[0].harnesses.claude, { installed: true, version: null, recipe: null, signed_in: true });
    assert.equal(data.can_start.machine, 'hub');
  } finally { await close(c); }
});

test('cached status, placement and onboarding follow the installed CLI and enabled orders', async () => {
  const { Hub } = require('../app/hub.js');
  const harnesses = require('../app/harnesses.js');
  const usage = require('../app/usage.js');
  const { choose, reservedProvider } = require('../app/balancer.js');
  const { makeDir } = require('./helpers/server.js');
  const hub = new Hub({ stateDir: await makeDir('harnesses-'), codeVersion: 'v' });
  await hub.state.init();
  const status = { version: 'v', pi: { installed: true, version: '1' }, accounts: [{ id: 'default-openrouter', cli: 'pi', logged_in: true }], recipes: { openrouter: true } };
  hub.machines = async () => ({ host: { name: 'host' }, offline: { name: 'offline' } });
  hub.state.resolveMachine = async (machines, name) => machines[name === 'hub' ? 'host' : name];
  let calls = 0;
  hub.call = async (name) => { calls++; if (name === 'offline') throw Error('down'); return status; };
  hub.allThreads = async () => [];
  let data = await harnesses.describe(hub);
  assert.equal(data.can_start.machine, 'host');
  assert.equal(data.can_start.lead.ok, false); assert.match(data.can_start.lead.reason, /Pi \(OpenRouter\).*Workers try first/);
  assert.equal(data.can_start.worker.ok, false); assert.deepEqual(data.machines[1], { name: 'offline', reachable: false, harnesses: {} });
  const before = calls; await harnesses.describe(hub); assert.equal(calls, before);
  await harnesses.describe(hub, true); assert.ok(calls > before);
  const pending = await harnesses.onboarding(hub); assert.equal(pending.steps[0].done, true); assert.equal(pending.steps[1].done, true); assert.equal(pending.steps[2].done, false);
  await settings.update(hub, (s) => { s.worker_order.push('openrouter'); });
  data = await harnesses.describe(hub); assert.equal(data.can_start.lead.ok, true); assert.equal(data.can_start.worker.ok, true);
  assert.deepEqual(await harnesses.onboarding(hub), { show: false, steps: [] });
  status.pi.installed = false; usage.clearCache(hub);
  assert.equal((await choose(hub, { machine: 'hub', sessions: [] }, 'worker', 'standard')).wait !== undefined, true);
  assert.deepEqual(await harnesses.onboarding(hub), { show: false, steps: [] });
  await settings.update(hub, (s) => { s.harnesses.openrouter = false; });
  assert.equal(reservedProvider(await settings.load(hub), { host: { accounts: { 'default-openrouter': true } } }, 'host'), null);
});

test('install routes preserve machine responses and report unreachable machines', async () => {
  const { handle } = require('../app/routes.js');
  const { Readable } = require('node:stream');
  let failure = false;
  const hub = { machines: async () => ({ hub: { name: 'hub' } }), state: { resolveMachine: async (m, name) => m[name] }, client: { passThrough: async (name, route, method) => { assert.equal(name, 'hub'); assert.equal(route, '/v1/harnesses/gpt/install'); if (failure) throw Error('offline'); return { status: method === 'POST' ? 202 : 409, body: { state: 'running' } }; } } };
  async function request(method) {
    const req = Readable.from([]); req.method = method;
    const response = { writeHead(status) { this.status = status; }, end(body) { this.body = JSON.parse(body); } };
    await handle(hub, req, response, new URL('http://localhost/wheelchair/api/machines/hub/harnesses/gpt/install'), false);
    return response;
  }
  assert.equal((await request('POST')).status, 202);
  const get = await request('GET'); assert.equal(get.status, 409); assert.deepEqual(get.body, { state: 'running' });
  failure = true; const down = await request('GET'); assert.equal(down.status, 502); assert.match(down.body.error, /hub/);
});
