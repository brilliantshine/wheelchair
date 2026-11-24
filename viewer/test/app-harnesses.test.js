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
  const hub = { machines: async () => ({ hub: { name: 'hub' } }), state: { resolveMachine: async (m, name) => m[name], settings: async () => null }, client: { passThrough: async (name, route, method) => { assert.equal(name, 'hub'); assert.equal(route, '/v1/harnesses/gpt/install'); if (failure) throw Error('offline'); return { status: method === 'POST' ? 202 : 409, body: { state: 'running' } }; } } };
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

const { Hub } = require('../app/hub.js');
const harnesses = require('../app/harnesses.js');
const usage = require('../app/usage.js');
const { choose, reservedProvider } = require('../app/balancer.js');
const { makeDir } = require('./helpers/server.js');

async function harnessFixture(statuses = {}) {
  const hub = new Hub({ stateDir: await makeDir('harness-fixture-'), codeVersion: 'v' });
  await hub.state.init();
  const configured = Object.fromEntries(Object.keys(statuses).map(name => [name, { name }]));
  hub.machines = async () => configured;
  hub.state.resolveMachine = async (machines, name) => machines[name === 'hub' && !machines.hub ? Object.keys(machines)[0] : name];
  let calls = 0;
  hub.call = async name => { calls++; if (!statuses[name]) throw Error('offline'); return statuses[name]; };
  hub.allThreads = async () => [];
  return { hub, statuses, calls: () => calls };
}
const statusFor = (...providers) => {
  const clis = { claude: 'claude', gpt: 'codex', gemini: 'agy', kimi: 'kimi', openrouter: 'pi' };
  return { version: 'v', ...Object.fromEntries(providers.map(p => [clis[p], { installed: true, version: '1' }])), accounts: providers.map(p => ({ id: `default-${p}`, cli: clis[p], logged_in: true })) };
};

test('GET settings describes the harness switches', async () => {
  const c = await setup();
  try { assert.deepEqual((await api(c, '/settings')).body.harnesses, settings.defaults().harnesses); }
  finally { await close(c); }
});

test('switch and balancing writes guard the expanded lead order with the exact message', async () => {
  const c = await setup();
  const message = 'Lead order would have no harness left. Add another to Lead order first.';
  try {
    let r = await api(c, '/settings/harnesses/claude', { method: 'PUT', body: { enabled: false } });
    assert.equal(r.status, 200); assert.equal(r.body.harnesses.claude, false);
    r = await api(c, '/settings/balancing', { method: 'PUT', body: { lead_order: ['claude'] } });
    assert.equal(r.status, 409); assert.equal(r.body.detail, message);
    await api(c, '/settings/harnesses/claude', { method: 'PUT', body: { enabled: true } });
    await api(c, '/settings/balancing', { method: 'PUT', body: { lead_order: ['claude'] } });
    r = await api(c, '/settings/harnesses/claude', { method: 'PUT', body: { enabled: false } });
    assert.equal(r.status, 409); assert.equal(r.body.detail, message);
    assert.equal((await api(c, '/settings/harnesses/claude', { method: 'PUT', body: { enabled: 0 } })).status, 400);
    assert.equal((await api(c, '/settings/harnesses/nope', { method: 'PUT', body: { enabled: false } })).status, 404);
  } finally { await close(c); }
});

test('new leads and all ordered worker roles skip switched-off harnesses', async () => {
  const { hub } = await harnessFixture({ hub: statusFor('claude', 'gpt') });
  await settings.update(hub, s => { s.harnesses.claude = false; s.lead_order = ['claude', 'any']; s.worker_order = ['claude', 'gpt']; s.save_for_leads = false; });
  for (const role of ['lead', 'worker', 'reviewer', 'verifier', 'mapper', 'designer']) assert.equal((await choose(hub, { machine: 'hub', sessions: [] }, role, 'standard')).provider, 'gpt', role);
});

test('a switched-off review family uses the existing fallback', async () => {
  const { hub } = await harnessFixture({ hub: statusFor('claude', 'gpt') });
  await settings.update(hub, s => { s.harnesses.claude = false; s.review_families = 'claude'; s.worker_order = ['gpt']; });
  for (const role of ['reviewer', 'verifier']) {
    const result = await choose(hub, { machine: 'hub', sessions: [] }, role, 'standard');
    assert.equal(result.provider, 'gpt');
    assert.equal(result.note, 'Reviewers and checkers are set to Claude, but Claude is not available; using GPT.');
  }
});

test('ready and pinned leads report the left-out harness; unpinned waits name an enabled one', async () => {
  const { hub } = await harnessFixture({ hub: statusFor() });
  await settings.update(hub, s => { s.harnesses.claude = false; });
  assert.deepEqual(await require('../app/ready.js').check(hub, { machine: 'hub', provider: 'claude', cli: 'claude' }), { ok: false, missing: ['Claude Code is left out in Settings'] });
  assert.equal((await choose(hub, { machine: 'hub', provider: 'claude', sessions: [] }, 'lead')).wait.reason, 'Claude Code is left out in Settings');
  assert.equal((await choose(hub, { machine: 'hub', sessions: [] }, 'lead')).wait.provider, 'gpt');
});

test('status shape counts live threads, ignores paused and retired logins, and marks old recipes unknown', async () => {
  const s = statusFor('claude', 'gpt');
  s.accounts.push({ id: 'retired', cli: 'claude', logged_in: true });
  const { hub } = await harnessFixture({ hub: s, offline: null });
  await settings.update(hub, v => { v.accounts.find(a => a.provider === 'claude').paused = true; v.accounts = v.accounts.filter(a => a.provider !== 'gpt'); v.retired_accounts.push('retired', 'default-gpt'); });
  hub.allThreads = async () => [{ provider: 'claude', sessions: [{ live: true, provider: 'claude' }, { live: true, provider: 'claude' }] }, { sessions: [{ live: false, provider: 'gpt' }] }];
  const data = await harnesses.describe(hub);
  assert.deepEqual(data.threads_using, { claude: 1, gpt: 0, gemini: 0, kimi: 0, openrouter: 0 });
  assert.deepEqual(data.machines[1], { name: 'offline', reachable: false, harnesses: {} });
  assert.deepEqual(data.machines[0].harnesses.claude, { installed: true, version: '1', recipe: null, signed_in: false });
  assert.equal(data.machines[0].harnesses.gpt.signed_in, false);
});

test('fresh harness status fetch clears cached machine status', async () => {
  const { hub, calls } = await harnessFixture({ hub: statusFor('gpt') });
  await harnesses.describe(hub); const first = calls();
  await harnesses.describe(hub); assert.equal(calls(), first);
  await harnesses.describe(hub, true); assert.equal(calls(), first + 1);
});

test('can_start reports orders, room, version, connectivity and the resolved hub hostname', async () => {
  const s = statusFor('openrouter');
  const { hub, statuses } = await harnessFixture({ hostname: s });
  let data = await harnesses.describe(hub);
  assert.equal(data.can_start.machine, 'hostname');
  for (const role of ['lead', 'worker']) { assert.equal(data.can_start[role].ok, false); assert.match(data.can_start[role].reason, /Pi \(OpenRouter\).*Workers try first/); }
  await settings.update(hub, v => { v.worker_order.push('openrouter'); v.escalation.max_tier = 'standard'; });
  data = await harnesses.describe(hub); assert.deepEqual(data.can_start.lead, { ok: true }); assert.deepEqual(data.can_start.worker, { ok: true });
  Object.assign(s, statusFor('gpt')); delete s.pi; usage.clearCache(hub);
  await settings.update(hub, v => { v.lead_order = ['claude']; });
  data = await harnesses.describe(hub); assert.match(data.can_start.lead.reason, /Codex.*Leads try/);
  await settings.update(hub, v => { v.harnesses.gpt = false; });
  data = await harnesses.describe(hub); assert.equal(data.can_start.lead.ok, false); assert.doesNotMatch(data.can_start.lead.reason, /Add Codex/);
  await settings.update(hub, v => { v.harnesses.gpt = true; v.lead_order = ['gpt']; });
  await usage.record(hub, { account: 'default-gpt', at: new Date().toISOString(), limited_until: new Date(Date.now() + 3600000).toISOString() });
  data = await harnesses.describe(hub); assert.equal(data.can_start.lead.reason, 'No account has room for a new lead right now (usage limits, or the share saved for leads).');
  s.version = 'old'; usage.clearCache(hub); data = await harnesses.describe(hub); assert.equal(data.can_start.worker.reason, 'hostname needs updating: re-run ./install.sh on it.');
  statuses.hostname = null; usage.clearCache(hub); data = await harnesses.describe(hub); assert.equal(data.can_start.lead.reason, "hostname isn't reachable.");
});

test('onboarding requires installation and sign-in on the same machine, saves completion, and short-circuits', async () => {
  const { hub, statuses, calls } = await harnessFixture({ hub: statusFor(), other: statusFor() });
  let result = await harnesses.onboarding(hub); assert.equal(result.steps[0].done, false); assert.equal(result.steps[1].done, false); assert.equal(result.steps[2].reason, (await harnesses.describe(hub)).can_start.lead.reason);
  statuses.hub = statusFor('gpt'); statuses.hub.accounts = []; usage.clearCache(hub);
  result = await harnesses.onboarding(hub); assert.equal(result.steps[0].done, true); assert.equal(result.steps[1].done, false);
  statuses.other = statusFor('gpt'); statuses.other.codex.installed = false; usage.clearCache(hub);
  result = await harnesses.onboarding(hub); assert.equal(result.steps[1].done, false);
  statuses.hub.accounts = statusFor('gpt').accounts; usage.clearCache(hub);
  assert.deepEqual(await harnesses.onboarding(hub), { show: false, steps: [] }); assert.equal((await settings.load(hub)).onboarding_done, true);
  const before = calls(); const original = require('../app/balancer.js').choose; let choices = 0;
  require('../app/balancer.js').choose = () => { choices++; throw Error('unexpected choose'); };
  try { assert.deepEqual(await harnesses.onboarding(hub), { show: false, steps: [] }); assert.equal(calls(), before); assert.equal(choices, 0); }
  finally { require('../app/balancer.js').choose = original; }
  const down = await harnessFixture({ hub: null }); assert.equal((await harnesses.onboarding(down.hub)).show, false);
});

test('missing executable prevents placement and ranking identifies switched-off providers', async () => {
  const s = statusFor('claude', 'gpt'); s.claude.installed = false;
  const { hub } = await harnessFixture({ hub: s });
  assert.equal((await choose(hub, { machine: 'hub', sessions: [] }, 'lead')).provider, 'gpt');
  const v = await settings.load(hub); v.harnesses.gpt = false;
  assert.equal(usage.rank([v.accounts.find(a => a.provider === 'gpt')], {}, { hub: { accounts: { 'default-gpt': true } } }, v, 'hub')[0].reason, 'skipped: left out in Settings');
});

test('lead reservation skips a switched-off provider', () => {
  const v = settings.defaults(); v.harnesses.claude = false;
  assert.equal(reservedProvider(v, { hub: { accounts: { 'default-claude': true, 'default-gpt': true } } }, 'hub'), 'gpt');
});

test('a live lead aside fork and an unanswered start retry survive switching off', async () => {
  const c = await setup();
  try {
    const made = (await api(c, '/threads', { method: 'POST', body: { project: '/tmp/harness-retry' } })).body;
    const lead = made.sessions[0]; c.machine.dropNextStart = 2;
    const body = { calling_session: lead.name, action: 'start', role: 'reviewer', attempt_id: 'switch-retry' };
    assert.equal((await machinePost(c, '/machine/session', body)).status, 503);
    const selected = [...c.machine.sessions.values()].find(s => s.role === 'reviewer');
    assert.ok(selected);
    assert.equal((await api(c, `/settings/harnesses/${selected.provider || 'gpt'}`, { method: 'PUT', body: { enabled: false } })).status, 200);
    const retried = await machinePost(c, '/machine/session', body);
    assert.equal(retried.status, 200); assert.equal(retried.body.session.name, selected.name); assert.equal(retried.body.duplicate, true);
  } finally { await close(c); }
  const { hub } = await harnessFixture({ hub: statusFor('gpt') });
  await settings.update(hub, s => { s.harnesses.gpt = false; });
  const a = { id: 'a', anchor: { quote: 'words' }, action: 'ask', provider: 'gpt', account: 'default-gpt', fork_parent: 'parent', slot: 'standard', status: 'open', pending: [{ kind: 'start', text: 'why?' }], history: [], turn: null };
  await hub.save({ id: 'aside-switch', project: '/tmp/repo', worktree: '/tmp/repo', machine: 'hub', sessions: [], asides: [a], cards: [], pinned: {}, queues: {}, sent: [] });
  const original = settings.modelCommand; let posted;
  settings.modelCommand = async () => ({ stdout: 'model' });
  hub.call = async (_, route, method, body) => { if (route === '/v1/aside-turns' && method === 'POST') { posted = body; return {}; } const error = Error('missing'); error.status = 404; throw error; };
  try { await require('../app/asides.js').pump(hub, 'aside-switch'); assert.equal(posted.mode, 'fork'); assert.equal(posted.from, 'parent'); }
  finally { settings.modelCommand = original; }
});

test('wc session start prints the left-out waiting reason', async () => {
  const http = require('node:http'); const fs = require('node:fs/promises');
  const brief = path.join(await makeDir('wc-left-out-'), 'brief'); await fs.writeFile(brief, 'work');
  const server = http.createServer((req, res) => { req.resume(); req.on('end', () => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ session: { status: 'waiting', waiting_until: 'soon', waiting_reason: 'Claude Code is left out in Settings' } })); }); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const { spawn } = require('node:child_process');
    const child = spawn(process.execPath, [path.join(__dirname, '../app/wc.js'), 'session', 'start', '--role', 'worker', '--brief-file', brief, '--attempt', 'x'], { env: { ...process.env, WHEELCHAIR_MACHINE_URL: '', WHEELCHAIR_MACHINE_ORIGIN: `http://127.0.0.1:${server.address().port}`, WHEELCHAIR_SESSION_TOKEN: 'test' } });
    let output = ''; child.stdout.on('data', chunk => { output += chunk; });
    assert.equal(await new Promise(resolve => child.on('close', resolve)), 0);
    assert.match(output, /waiting for room until soon\nwaiting: Claude Code is left out in Settings\n/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('install forwarders retain every machine status and response body', async () => {
  const { handle } = require('../app/routes.js'); const { Readable } = require('node:stream');
  let status = 202;
  const hub = { machines: async () => ({ hub: { name: 'hub' } }), state: { resolveMachine: async m => m.hub, settings: async () => null }, client: { passThrough: async () => { if (status === 502) throw Error('down'); return { status, body: { message: `response ${status}` } }; } } };
  for (const code of [202, 404, 409, 502]) {
    status = code; const req = Readable.from([]); req.method = code === 202 ? 'POST' : 'GET';
    const res = { writeHead(code) { this.status = code; }, end(body) { this.body = JSON.parse(body); } };
    await handle(hub, req, res, new URL('http://localhost/wheelchair/api/machines/hub/harnesses/gpt/install'), false);
    assert.equal(res.status, code);
    if (code === 502) assert.match(res.body.error, /hub/); else assert.deepEqual(res.body, { message: `response ${code}` });
  }
});

async function routed(hub, method, url) {
  const { handle } = require('../app/routes.js'); const { Readable } = require('node:stream');
  const req = Readable.from(method === 'PUT' ? [Buffer.from(JSON.stringify({ enabled: url.enabled }))] : []); req.method = method;
  const res = { writeHead(code) { this.status = code; }, end(body) { this.body = JSON.parse(body); } };
  await handle(hub, req, res, new URL(url.path), false);
  return res;
}

test('install passthrough accepts DELETE and refuses POST while the harness is switched off', async () => {
  const { hub } = await harnessFixture({ hub: statusFor('gpt') });
  const seen = [];
  let down = false;
  hub.client = { passThrough: async (name, route, method) => { seen.push(method); if (down) throw Error('offline'); return { status: method === 'DELETE' ? 202 : 200, body: { state: 'cancelling' } }; } };
  const path = 'http://localhost/wheelchair/api/machines/hub/harnesses/gpt/install';
  const del = await routed(hub, 'DELETE', { path });
  assert.equal(del.status, 202); assert.deepEqual(del.body, { state: 'cancelling' });
  down = true; const out = await routed(hub, 'DELETE', { path }); assert.equal(out.status, 502); assert.match(out.body.error, /hub/);
  down = false;
  await settings.update(hub, s => { s.harnesses.gpt = false; });
  seen.length = 0;
  const post = await routed(hub, 'POST', { path });
  assert.equal(post.status, 409); assert.deepEqual(post.body, { error: 'Codex is switched off' }); assert.deepEqual(seen, []);
  assert.equal((await routed(hub, 'GET', { path })).status, 200);
  assert.equal((await routed(hub, 'DELETE', { path })).status, 202);
});

test('switching a harness off cancels its install on every known machine, without waiting', async () => {
  const { hub } = await harnessFixture({ hub: statusFor('claude', 'gpt'), other: statusFor('claude', 'gpt'), third: statusFor('claude', 'gpt') });
  const calls = [];
  let hubPending = false;
  let resolveThirdCall;
  const thirdCall = new Promise(resolve => { resolveThirdCall = resolve; });
  hub.client = { passThrough: async (name, route, method) => {
    calls.push([name, route, method]);
    if (calls.length === 3) resolveThirdCall();
    if (name === 'other') throw Error('offline');
    if (name === 'third') return { status: 409, body: { error: 'not installing' } };
    hubPending = true;
    return new Promise(() => {});
  } };
  const path = 'http://localhost/wheelchair/api/settings/harnesses/gpt';
  const withTimeout = (promise, ms, label) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
  await withTimeout((async () => {
    const off = await routed(hub, 'PUT', { path, enabled: false });
    assert.equal(off.status, 200); assert.equal(off.body.harnesses.gpt, false);
    assert.equal(hubPending, true);
    await thirdCall;
  })(), 10000, 'Harness cancellation route and machine requests');
  assert.deepEqual(calls.map(c => c[0]).sort(), ['hub', 'other', 'third']);
  assert.ok(calls.every(c => c[1] === '/v1/harnesses/gpt/install' && c[2] === 'DELETE'));
  calls.length = 0;
  const on = await routed(hub, 'PUT', { path, enabled: true });
  assert.equal(on.status, 200); assert.equal(on.body.harnesses.gpt, true);
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.deepEqual(calls, []);
});
