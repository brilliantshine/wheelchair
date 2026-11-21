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
      if (provider === 'claude') { assert.deepEqual(args.slice(7, 9), ['--permission-mode', 'bypassPermissions']); assert.ok(!args.includes('--tools')); }
      else { assert.equal(args[1], '--dangerously-bypass-approvals-and-sandbox'); assert.ok(!args.includes('-s')); }
      assert.equal(rows().at(-1).input, 'hello\n\nYour access is full.');
      const back = { ...i, turn_id: uuid(), access: 'read-only' }; await store.start(back); await wait(store, back.turn_id); assert.equal(rows().at(-1).input, 'hello\n\nYour access is read-only.');
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

test('ps process backend matches exact markers and handles failures', async () => {
  const { createProc } = require('../lib/aside-turns');
  const calls = [], signals = [], id = uuid();
  let fail = false, group = ' 42\n';
  const proc = createProc({ hasProc: false, exec: (program, args, options) => {
    calls.push({ program, args, options });
    if (fail) throw Error('ps failed');
    if (args[1] === 'lstart=') return ' Mon Nov 16 12:34:56 2026 \n';
    if (args[1] === 'pgid=') return group;
    return ` 11 command WHEELCHAIR_ASIDE_TURN=${id}\n 12 command XWHEELCHAIR_ASIDE_TURN=${id}\n 13 command WHEELCHAIR_ASIDE_TURN=${id}suffix\n 14 command WHEELCHAIR_ASIDE_TURN=${id} OTHER=yes\n`;
  }, signal: (pid, sig) => signals.push([pid, sig]) });
  assert.equal(proc.start(11), 'Mon Nov 16 12:34:56 2026');
  assert.deepEqual(proc.marked(id), [11, 14]);
  proc.kill(11); assert.deepEqual(signals, [[-42, 'SIGKILL']]);
  group = ''; proc.kill(11); assert.equal(signals.length, 1);
  fail = true; assert.equal(proc.start(11), null); assert.deepEqual(proc.marked(id), []); assert.doesNotThrow(() => proc.kill(11));
  assert.ok(calls.every(call => call.program === 'ps' && call.options.timeout === 5000 && call.options.encoding === 'utf8'));
  assert.deepEqual(calls[1].args, ['-E', '-ww', '-o', 'pid=,command=', '-A']);
  const dir = await makeTemp('aside-ps-recovery-'), store = new AsideTurns(dir, atomic, x => x);
  store.proc = proc;
  await atomic(store.file, JSON.stringify({ [id]: { state: 'running', pid: 11, pid_start: 'old', started_at: new Date().toISOString() } }));
  await assert.doesNotReject(store.load()); assert.equal(store.get(id).error, 'the machine restarted');
});

test('Pi asides validate, fork, resume, settle and redact', async () => {
  const dir = await makeTemp('aside-pi-'), bin = path.join(dir, 'bin'), log = path.join(dir, 'pi-log'); await fsp.mkdir(bin);
  const cli = path.join(bin, 'pi');
  await fsp.writeFile(cli, `#!/usr/bin/env node
const fs=require('fs'), a=process.argv.slice(2), input=fs.readFileSync(0,'utf8'), get=k=>a[a.indexOf(k)+1];
fs.appendFileSync(process.env.PI_TEST_LOG,JSON.stringify({a,input})+'\\n');
const id=a.includes('--fork')?get('--session-id'):get('--session');
const emit=x=>console.log(JSON.stringify(x));
if(!input.includes('MISSING')) emit({type:'session',id:input.includes('MISMATCH')?'wrong':id});
const msg=(stopReason,text,errorMessage)=>emit({type:'message_end',message:{role:'assistant',stopReason,content:text?[{type:'text',text}]:[],errorMessage}});
if(input.includes('RETRY')) msg('error','','429 rate limit');
if(input.includes('ERROR')) { msg('error','','HTTP 402 credit'); process.stderr.write('sk-or-secret\\n'); }
else if(input.includes('ABORT')) msg('aborted','partial','aborted');
else msg('stop','answer sk-or-secret');
`); await fsp.chmod(cli, 0o755);
  const old = { ...process.env }; Object.assign(process.env, { PATH: bin + ':' + old.PATH, PI_TEST_LOG: log });
  const store = new AsideTurns(dir, atomic, x => x); const base = { provider:'openrouter', mode:'fork', from:uuid(), new_id:uuid(), cwd:dir, model:'vendor/model:variant', effort:'high', prompt:'hello', account_dir:null };
  const run = async changes => { const i = { ...base, ...changes, turn_id:uuid() }; await store.start(i); return [i, await wait(store,i.turn_id)]; };
  try {
    assert.throws(() => store.validate({ ...base, turn_id:uuid(), provider:'other' }), /invalid provider/);
    assert.throws(() => store.validate({ ...base, turn_id:uuid(), model:'invalid' }), /model/);
    assert.throws(() => store.validate({ ...base, turn_id:uuid(), new_id:'bad' }), /new_id/);
    let [i,t] = await run({}); assert.equal(t.state,'ok'); assert.equal(t.conversation_id,i.new_id); assert.equal(t.reply,'answer [redacted key]');
    let records = () => fs.readFileSync(log,'utf8').trim().split('\n').map(JSON.parse); let args = records().at(-1).a;
    assert.deepEqual(args.slice(0,11), ['--provider','openrouter','--model',i.model,'--mode','json','-p','--fork',i.from,'--session-id',i.new_id]);
    assert.equal(args[args.indexOf('--thinking')+1], 'high'); assert.equal(args[args.indexOf('--tools')+1], 'read,grep,find,ls'); assert.equal(args[args.indexOf('-e')+1],path.join(__dirname,'../adapters/pi-guard.js')); assert.ok(fs.existsSync(args[args.indexOf('-e')+1]));
    for (const access of ['read-only','full']) { [i,t] = await run({ mode:'resume', from:base.new_id, access }); assert.equal(t.conversation_id,base.new_id); args=records().at(-1).a; assert.equal(args[args.indexOf('--session')+1],base.new_id); assert.equal(args[args.indexOf('--tools')+1],access==='full'?'read,bash,edit,write,grep,find,ls':'read,grep,find,ls'); assert.equal(args.includes('-e'),access!=='full'); }
    [,t]=await run({prompt:'ERROR'}); assert.equal(t.state,'failed'); assert.equal(t.limit,true); assert.equal(t.error,'HTTP 402 credit');
    [,t]=await run({prompt:'RETRY'}); assert.equal(t.state,'ok'); assert.equal(t.limit,false);
    [,t]=await run({prompt:'ABORT'}); assert.equal(t.state,'failed');
    for (const prompt of ['MISSING','MISMATCH']) { [,t]=await run({prompt}); assert.equal(t.state,'failed'); assert.equal(t.conversation_id,null); }
    // stderr is used when the final assistant has no error message.
    await fsp.writeFile(cli, (await fsp.readFile(cli,'utf8')).replace("msg('error','','HTTP 402 credit')", "msg('error','','')"));
    [,t]=await run({prompt:'ERROR'}); assert.equal(t.error,'[redacted key]'); assert.ok(!JSON.stringify(t).includes('sk-or-'));
    const blocked = new AsideTurns(dir,atomic,x=>x,{piProblem:async()=> 'Pi 1.5.2 or newer is needed (found 1.0.0)'}); i={...base,turn_id:uuid()}; const count=records().length; await blocked.start(i); t=await wait(blocked,i.turn_id); assert.match(t.error,/1.5.2/); assert.equal((await blocked.start(i)).status,200); assert.equal(records().length,count);
  } finally { process.env = old; }
});
