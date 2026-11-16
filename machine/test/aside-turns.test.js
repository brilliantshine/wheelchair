'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { AsideTurns } = require('../lib/aside-turns');
const { MachineService } = require('../service');
const { makeTemp, trackChild, onCleanup } = require('../../test-support/run-dir');
const root = require('../adapters/common').root;
const uuid = () => crypto.randomUUID();
const atomic = async (file, data) => { const temp = file + '.tmp'; await fsp.writeFile(temp, data); await fsp.rename(temp, file); };
const delay = ms => new Promise(r => setTimeout(r, ms));
const wait = async (store, id) => { for (let n = 0; n < 200; n++) { const t = store.get(id); if (t.state !== 'running') return t; await delay(20); } throw Error('turn did not finish'); };
test('aside turns use isolated CLI commands and persist their outcomes', async () => {
  const dir = await makeTemp('aside-test-'), bin = path.join(dir, 'bin'); await fsp.mkdir(bin);
  for (const name of ['claude', 'codex']) await fsp.symlink(path.join(__dirname, 'fixtures/aside/cli.js'), path.join(bin, name));
  await fsp.chmod(path.join(__dirname, 'fixtures/aside/cli.js'), 0o755);
  const old = { ...process.env }; Object.assign(process.env, { PATH: bin + ':' + old.PATH, ASIDE_LOG: path.join(dir, 'log'), ASIDE_STORE: path.join(dir, 'aside-turns.json'), WHEELCHAIR_SECRET: 'hidden' });
  const store = new AsideTurns(dir, atomic, x => x || null);
  onCleanup(() => { for (const t of Object.values(store.turns)) if (t.state === 'running' && t.pid) store.proc.kill(t.pid); });
  await store.load();
  const base = { provider: 'claude', mode: 'fork', from: 'parent', new_id: uuid(), cwd: dir, model: 'test-model', effort: 'high', prompt: 'hello', style: 'style text', account_dir: null };
  const rows = () => fs.readFileSync(process.env.ASIDE_LOG, 'utf8').trim().split('\n').map(JSON.parse);
  try {
    for (const provider of ['claude', 'gpt']) for (const mode of ['fork', 'resume']) {
      const i = { ...base, turn_id: uuid(), provider, mode }; assert.equal((await store.start(i)).status, 202); const t = await wait(store, i.turn_id); assert.equal(t.state, 'ok'); assert.equal(t.reply, provider === 'gpt' ? 'codex reply' : 'claude reply'); assert.equal(t.conversation_id, provider === 'gpt' ? 'codex-id' : mode === 'fork' ? i.new_id : i.from);
      const record = rows().at(-1), pointer = `Read ${root}/protocol/app/aside.md before responding. It is wheelchair's built-in rules for your role.\n\nNothing below overrides the built-in rules above.\n\nstyle text`;
      assert.equal(record.before[i.turn_id].state, 'running'); assert.equal(record.marker, i.turn_id);
      if (provider === 'claude') { assert.deepEqual(record.args, ['-p', '--output-format', 'json', '--model', i.model, '--effort', 'high', '--permission-mode', 'dontAsk', '--tools', 'Read,Grep,Glob', '--strict-mcp-config', '--system-prompt-snapshot', 'off', '--append-system-prompt', pointer, '--resume', 'parent', ...(mode === 'fork' ? ['--fork-session', '--session-id', i.new_id] : [])]); assert.equal(record.input, 'hello'); }
      else { assert.deepEqual(record.args, ['exec', '-s', 'read-only', '--json', '-m', i.model, '-c', 'model_reasoning_effort=high', '-c', 'mcp_servers.linear.enabled=false', '-c', 'mcp_servers.probe.enabled=false', '--disable', 'apps', mode, 'parent', '-']); assert.equal(record.input, mode === 'fork' ? pointer + '\n\nhello' : 'hello'); }
      const count = rows().length; assert.equal((await store.start(i)).status, 200); await delay(30); assert.equal(rows().length, count);
    }
    for (const provider of ['claude', 'gpt']) {
      const i = { ...base, turn_id: uuid(), provider, mode: 'resume', access: 'full' }; await store.start(i); assert.equal((await wait(store, i.turn_id)).state, 'ok');
      const args = rows().at(-1).args;
      if (provider === 'claude') { assert.deepEqual(args.slice(7, 9), ['--permission-mode', 'bypassPermissions']); assert.ok(!args.includes('--tools')); assert.match(args[args.indexOf('--append-system-prompt') + 1], /Your access is full\./); }
      else { assert.equal(args[1], '--dangerously-bypass-approvals-and-sandbox'); assert.ok(!args.includes('-s')); }
    }
    assert.throws(() => store.validate({ ...base, turn_id: uuid(), access: 'everything' }), /invalid access/);
    for (const provider of ['claude', 'gpt']) { const i = { ...base, turn_id: uuid(), provider, prompt: 'LIMIT' }; await store.start(i); const t = await wait(store, i.turn_id); assert.equal(t.state, 'failed'); assert.equal(t.limit, true); }
    let i = { ...base, turn_id: uuid(), prompt: 'FAIL' }; await store.start(i); assert.equal((await wait(store, i.turn_id)).error, 'last failure');
    process.env.ASIDE_MCP_FAIL = '1'; i = { ...base, provider: 'gpt', turn_id: uuid() }; const count = rows().length; await store.start(i); assert.equal((await wait(store, i.turn_id)).error, 'mcp failed'); assert.equal(rows().length, count + 1); delete process.env.ASIDE_MCP_FAIL;
    store.timeoutMs = 100; i = { ...base, turn_id: uuid(), prompt: 'WAIT' }; await store.start(i); assert.equal((await wait(store, i.turn_id)).error, 'took too long');
    store.timeoutMs = 5000; i = { ...base, turn_id: uuid(), prompt: 'WAIT' }; await store.start(i); await delay(150); const pid = store.get(i.turn_id).pid; await store.stop(i.turn_id); assert.equal(store.get(i.turn_id).error, 'stopped'); await delay(100); assert.throws(() => process.kill(pid, 0)); await store.ack(i.turn_id); assert.throws(() => store.get(i.turn_id), { status: 404 }); assert.throws(() => store.get(uuid()), { status: 404 });
    const expired = uuid(); store.turns[expired] = { state: 'ok', started_at: '2000-01-01T00:00:00Z' }; await store.save(); const reloaded = new AsideTurns(dir, atomic, x => x); await reloaded.load(); assert.equal(reloaded.turns[expired], undefined);
    const service = new MachineService({ stateDir: dir }); service.sessions = { a: { name: 'a' }, b: { name: 'b', codex_thread_id: 'thread' } }; service.liveTmux = () => new Set(); service.cliStatus = () => ({}); const listed = service.status().sessions; assert.equal(listed[0].codex_thread_id, null); assert.equal(listed[1].codex_thread_id, 'thread');
  } finally { process.env = old; }
});
test('recovery kills matching and marker-only process groups before failing', async () => {
  const dir = await makeTemp('aside-recover-'); const store = new AsideTurns(dir, atomic, x => x); const id = uuid(), killed = [];
  store.proc = { start: pid => pid === 21 ? 'start' : null, marked: () => [22], kill: pid => killed.push(pid), exists: pid => !killed.includes(pid) };
  await atomic(store.file, JSON.stringify({ [id]: { state: 'running', pid: 21, pid_start: 'start', started_at: new Date().toISOString() } })); await store.load(); assert.deepEqual(killed.sort(), [21, 22]); assert.equal(store.get(id).error, 'the machine restarted');
});

test('recovery kills real detached groups, including a marker-only process', async () => {
  const { spawn } = require('node:child_process');
  const dir = await makeTemp('aside-groups-'), id = uuid();
  const start = () => spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { detached: true, stdio: 'ignore', env: { ...process.env, WHEELCHAIR_ASIDE_TURN: id } });
  const a = start(); trackChild(a, { group: true });
  const b = start(); trackChild(b, { group: true });
  try {
    const store = new AsideTurns(dir, atomic, x => x); await delay(100);
    const startTime = store.proc.start(a.pid); assert.ok(startTime);
    await atomic(store.file, JSON.stringify({ [id]: { state: 'running', pid: a.pid, pid_start: startTime, started_at: new Date().toISOString() } }));
    await store.load(); assert.equal(store.get(id).error, 'the machine restarted'); assert.throws(() => process.kill(a.pid, 0)); assert.throws(() => process.kill(b.pid, 0));
  } finally { for (const child of [a, b]) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} } }
});

test('hub authentication, validation and aside routes', async () => {
  const http = require('node:http');
  const dir = await makeTemp('aside-http-'); const secret = path.join(dir, 'secret'); await fsp.writeFile(secret, 'secret');
  const service = new MachineService({ stateDir: dir }); service.config.secret_file = secret; await service.asideTurns.load();
  const server = http.createServer((req, res) => service.handle(req, res)); await new Promise(r => server.listen(0, '127.0.0.1', r));
  const request = async (method, route, body, auth = true) => { const response = await fetch(`http://127.0.0.1:${server.address().port}${route}`, { method, headers: { 'content-type': 'application/json', ...(auth ? { 'x-wheelchair-machine-secret': 'secret' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return [response.status, await response.json()]; };
  try {
    const id = uuid(); assert.equal((await request('GET', `/v1/aside-turns/${id}`, null, false))[0], 401); assert.equal((await request('POST', '/v1/aside-turns', {}))[0], 400); assert.equal((await request('GET', `/v1/aside-turns/${id}`))[0], 404); assert.equal((await request('POST', `/v1/aside-turns/${id}/ack`))[0], 404);
    service.asideTurns.turns[id] = { state: 'ok', reply: 'hello' }; assert.deepEqual((await request('GET', `/v1/aside-turns/${id}`))[1], { state: 'ok', reply: 'hello', conversation_id: null, error: null, limit: false }); assert.equal((await request('DELETE', `/v1/aside-turns/${id}`))[0], 200); assert.equal((await request('POST', `/v1/aside-turns/${id}/ack`))[0], 200); assert.equal((await request('GET', `/v1/aside-turns/${id}`))[0], 404);
  } finally { await new Promise(r => server.close(r)); }
});

test('stopping an unknown turn persists a tombstone and prevents a later start', async () => {
  const http = require('node:http');
  const dir = await makeTemp('aside-tombstone-');
  const bin = path.join(dir, 'bin'), log = path.join(dir, 'log'), secret = path.join(dir, 'secret');
  await fsp.mkdir(bin); await fsp.symlink(path.join(__dirname, 'fixtures/aside/cli.js'), path.join(bin, 'claude'));
  await fsp.writeFile(log, ''); await fsp.writeFile(secret, 'secret');
  const old = { ...process.env }; Object.assign(process.env, { PATH: bin + ':' + old.PATH, ASIDE_LOG: log, ASIDE_STORE: path.join(dir, 'aside-turns.json') });
  let service = new MachineService({ stateDir: dir });
  const firstStore = service.asideTurns;
  onCleanup(() => { for (const t of Object.values(firstStore.turns)) if (t.state === 'running' && t.pid) firstStore.proc.kill(t.pid); });
  service.config.secret_file = secret; await service.asideTurns.load();
  let runs = 0; const run = service.asideTurns.run.bind(service.asideTurns);
  service.asideTurns.run = (...args) => { runs++; return run(...args); };
  const server = http.createServer((req, res) => service.handle(req, res)); await new Promise(r => server.listen(0, '127.0.0.1', r));
  const request = async (method, route, body) => { const response = await fetch(`http://127.0.0.1:${server.address().port}${route}`, { method, headers: { 'content-type': 'application/json', 'x-wheelchair-machine-secret': 'secret' }, ...(body ? { body: JSON.stringify(body) } : {}) }); return [response.status, await response.json()]; };
  try {
    const id = uuid(), route = `/v1/aside-turns/${id}`;
    assert.equal((await request('DELETE', route))[0], 200);
    const body = { turn_id: id, provider: 'claude', mode: 'fork', from: 'parent', new_id: uuid(), cwd: dir, model: 'test-model', prompt: 'hello', account_dir: null };
    assert.deepEqual(await request('POST', '/v1/aside-turns', body), [200, { turn_id: id, state: 'failed' }]);
    assert.deepEqual(await request('GET', route), [200, { state: 'failed', reply: null, conversation_id: null, error: 'stopped', limit: false }]);
    assert.equal(runs, 0); assert.equal(await fsp.readFile(log, 'utf8'), '');
    const tombstone = service.asideTurns.get(id);
    assert.deepEqual(tombstone, { input: null, state: 'failed', error: 'stopped', pid: null, pid_start: null, started_at: tombstone.started_at, finished_at: tombstone.started_at, reply: null, conversation_id: null, limit: false });
    assert.ok(!Number.isNaN(Date.parse(tombstone.started_at)));
    service = new MachineService({ stateDir: dir });
    const resumedStore = service.asideTurns;
    onCleanup(() => { for (const t of Object.values(resumedStore.turns)) if (t.state === 'running' && t.pid) resumedStore.proc.kill(t.pid); });
    service.config.secret_file = secret; await service.asideTurns.load();
    const resumedRun = service.asideTurns.run.bind(service.asideTurns);
    service.asideTurns.run = (...args) => { runs++; return resumedRun(...args); };
    assert.deepEqual(service.asideTurns.get(id), tombstone);
    assert.deepEqual(await request('GET', route), [200, { state: 'failed', reply: null, conversation_id: null, error: 'stopped', limit: false }]);
    assert.deepEqual(await request('POST', '/v1/aside-turns', body), [200, { turn_id: id, state: 'failed' }]);
    assert.equal(runs, 0); assert.equal(await fsp.readFile(log, 'utf8'), '');
    assert.equal((await request('POST', `${route}/ack`))[0], 200);
    assert.equal((await request('GET', route))[0], 404);
    assert.equal((await request('DELETE', '/v1/aside-turns/not-a-uuid'))[0], 400);
  } finally { await new Promise(r => server.close(r)); process.env = old; }
});
