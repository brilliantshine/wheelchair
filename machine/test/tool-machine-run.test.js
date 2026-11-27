'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { once } = require('node:events');
const { execFileSync } = require('node:child_process');
const { makeTemp } = require('../../test-support/run-dir');
const { MachineService } = require('../service');
const { projectIdentity, writeKeyStore } = require('../lib/project-keys');

test('machine runs enforce eligibility, discovery and live keys', async t => {
  const root = await makeTemp('machine-run-'), work = path.join(root, 'work'), state = path.join(root, 'state'), dir = path.join(work, '.wheelchair/tools/demo');
  await fs.mkdir(dir, { recursive: true }); execFileSync('git', ['init', '-q', work]);
  await fs.writeFile(path.join(dir, 'tool.json'), JSON.stringify({ name:'demo', description:'test', kind:'script', inputs:{}, run:[process.execPath, 'run.js'], keys:['SECRET'] }));
  await fs.writeFile(path.join(dir, 'run.js'), "process.stdout.write(JSON.stringify({key:process.env.SECRET, value:process.env.VALUE, token:process.env.WHEELCHAIR_SESSION_TOKEN || null}))");
  const service = new MachineService({stateDir:state});
  const session = { name:'wc-test', token:'test-token', cli:'kimi', role:'worker', status:'ready', worktree:work };
  service.sessions[session.name] = session; service.liveTmux = () => new Set([session.name]);
  const server = http.createServer((req,res) => service.handle(req,res)); server.listen(0,'127.0.0.1'); await once(server,'listening'); t.after(() => new Promise(resolve => server.close(resolve)));
  const call = async body => { const r = await fetch(`http://127.0.0.1:${server.address().port}/v1/agent/tools/run`, {method:'POST', headers:{'x-wheelchair-session-token':session.token}, body:JSON.stringify(body), signal: AbortSignal.timeout(8000)}); return [r.status, await r.json()]; };
  const body = {name:'demo', input:{}, env:{PATH:process.env.PATH, VALUE:'present', SECRET:'caller', WHEELCHAIR_SESSION_TOKEN:'secret-token'}};
  assert.deepEqual(await call({...body,name:3}), [400,{error:'invalid name'}]);
  assert.deepEqual(await call({...body,input:[]}), [400,{error:'invalid input'}]);
  assert.deepEqual(await call({...body,env:{}}), [400,{error:'invalid env'}]);
  assert.deepEqual(await call({...body,name:'missing'}), [404,{error:'unknown tool: missing'}]);
  assert.deepEqual(await call(body), [422,{error:'tool demo needs key SECRET, not set on this machine'}]);
  await writeKeyStore(state, await projectIdentity(work), {set:{SECRET:'secretvalue123'}});
  const listenersBeforeRun = process.listenerCount('SIGTERM');
  let [status, result] = await call(body); assert.equal(process.listenerCount('SIGTERM'), listenersBeforeRun + 1); assert.equal(status,200); assert.equal(result.ok,true); assert.deepEqual(JSON.parse(result.text), {key:'[key]', value:'present', token:null});
  await writeKeyStore(state, await projectIdentity(work), {set:{SECRET:'anothersecret456'}});
  [status, result] = await call(body); assert.equal(status,200); assert.match(result.text, /\[key\]/);
  for (const changes of [{role:'assistant',assistant:true}, {role:'worker',cli:'codex',codex_mode:'sandboxed'}]) {
    Object.assign(session, changes); assert.equal((await call(body))[0],403);
    Object.assign(session, {role:'worker',assistant:false,cli:'kimi'});
  }
  session.project_lead=true; assert.deepEqual(await call(body),[403,{error:"a project lead can't do that"}]); session.project_lead=false;
  session.role='reviewer'; assert.deepEqual(await call(body),[403,{error:"this session can't run keyed tools through the machine"}]);
  session.role='worker'; session.status='ended'; assert.deepEqual(await call(body),[403,{error:'this session has ended'}]);
  session.status='ready'; service.liveTmux=()=>new Set(); assert.deepEqual(await call(body),[403,{error:'this session has ended'}]);
});

async function runFixture(t) {
  const root = await makeTemp('machine-run-cases-'), work = path.join(root, 'work'), state = path.join(root, 'state');
  await fs.mkdir(work); execFileSync('git', ['init', '-q', work]);
  const service = new MachineService({ stateDir: state });
  const session = { name: 'wc-case', token: 'case-token', cli: 'kimi', role: 'worker', status: 'ready', worktree: work };
  service.sessions[session.name] = session; service.liveTmux = () => new Set([session.name]);
  const server = http.createServer((req, res) => service.handle(req, res)); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const marker = path.join(root, 'marker');
  async function tool(overrides = {}) {
    const dir = path.join(work, '.wheelchair/tools/demo'); await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'tool.json'), JSON.stringify({ name: 'demo', description: 'test', kind: 'script', inputs: {}, run: [process.execPath, 'run.js'], keys: ['SECRET'], ...overrides }));
    await fs.writeFile(path.join(dir, 'run.js'), `require('fs').writeFileSync(${JSON.stringify(marker)}, 'ran')`);
    return dir;
  }
  async function setKey() { await writeKeyStore(state, await projectIdentity(work), { set: { SECRET: 'storedsecret123' } }); }
  const call = (body = {}, signal = AbortSignal.timeout(8000)) => fetch(`http://127.0.0.1:${server.address().port}/v1/agent/tools/run`, { method: 'POST', headers: { 'x-wheelchair-session-token': session.token }, body: JSON.stringify({ name: 'demo', input: {}, env: { PATH: process.env.PATH }, ...body }), signal });
  return { root, work, state, service, session, marker, tool, setKey, call };
}

for (const kind of ['invalid', 'server', 'keyless', 'missing', 'ended', 'ineligible']) {
  test(`refusal ${kind} never runs the tool`, async t => {
    const f = await runFixture(t), dir = await f.tool();
    if (kind === 'invalid') await fs.writeFile(path.join(dir, 'tool.json'), '{');
    if (kind === 'server') await f.tool({ kind: 'server', keys: undefined, run: undefined, inputs: undefined, start: [process.execPath, 'run.js'] });
    if (kind === 'keyless') await f.tool({ keys: undefined });
    if (kind === 'ended') f.session.status = 'ended';
    if (kind === 'ineligible') f.session.role = 'reviewer';
    const response = await f.call(); assert.equal(response.status, ['ended', 'ineligible'].includes(kind) ? 403 : 422);
    const data = await response.json(); if (kind === 'keyless') assert.equal(data.error, 'demo has no keys; run it with wc.js tool run in your own shell');
    await assert.rejects(fs.stat(f.marker), { code: 'ENOENT' });
  });
}

test('a corrupt key store returns its read error', async t => {
  const f = await runFixture(t); await f.tool(); await f.setKey();
  const files = await fs.readdir(path.join(f.state, 'project-keys')); await fs.writeFile(path.join(f.state, 'project-keys', files[0]), '{');
  const response = await f.call(); assert.equal(response.status, 500); assert.equal((await response.json()).error, "the key store on this machine can't be read");
});

test('caller PATH finds a bare program', async t => {
  const f = await runFixture(t), bin = path.join(f.root, 'bin'); await fs.mkdir(bin);
  await fs.writeFile(path.join(bin, 'only-here'), '#!/bin/sh\nprintf caller-path', { mode: 0o755 });
  await f.tool({ run: ['only-here'] }); await f.setKey();
  const response = await f.call({ env: { PATH: bin } }); assert.equal(response.status, 200); const result = await response.json(); assert.equal(result.ok, true); assert.equal(result.text, 'caller-path');
});

test('caller environment is passed and stored key overrides caller value', async t => {
  const f = await runFixture(t), dir = await f.tool(); await f.setKey();
  await fs.writeFile(path.join(dir, 'run.js'), "process.stdout.write(JSON.stringify([process.env.VALUE,process.env.SECRET]))");
  const response = await f.call({ env: { PATH: process.env.PATH, VALUE: 'caller-value', SECRET: 'caller-secret' } });
  assert.deepEqual(JSON.parse((await response.json()).text), ['caller-value', '[key]']);
});

test('a key set after the session started is used on the next run', async t => {
  const f = await runFixture(t); await f.tool(); assert.equal((await f.call()).status, 422); await f.setKey();
  const response = await f.call(); assert.equal(response.status, 200); assert.equal((await response.json()).ok, true);
});

async function waitFor(check, message) {
  const end = Date.now() + 6000; let result;
  while (Date.now() < end) { result = await check(); if (result && (!Array.isArray(result) || result.length)) break; await new Promise(resolve => setTimeout(resolve, 40)); }
  assert.ok(result && (!Array.isArray(result) || result.length), message); return result;
}
function gone(pid) { try { process.kill(pid, 0); return false; } catch (error) { if (error.code === 'ESRCH') return true; throw error; } }
async function longRun(f) {
  const dir = await f.tool(), pidFile = path.join(f.root, 'child-pid'); await f.setKey();
  // The parent reaps its child on SIGTERM, avoiding a transient orphan zombie.
  await fs.writeFile(path.join(dir, 'run.js'), `const {spawn}=require('child_process'); const fs=require('fs'); const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)']); fs.writeFileSync(${JSON.stringify(pidFile)},String(c.pid)+' '+String(process.pid)); process.on('SIGTERM',()=>{c.kill(); c.on('exit',()=>process.exit());}); setInterval(()=>{},1000);`);
  return pidFile;
}
for (const action of ['disconnect', 'stop']) {
  test(`${action} kills the running tool process group`, async t => {
    const f = await runFixture(t), pidFile = await longRun(f), controller = new AbortController();
    const pending = f.call({}, AbortSignal.any([controller.signal, AbortSignal.timeout(8000)])).then(async r => ({ status: r.status, body: await r.json() }), e => ({ error: e }));
    const pids = await waitFor(async () => (await fs.readFile(pidFile, 'utf8').catch(() => '')).split(' ').map(Number).filter(Boolean), 'child did not start');
    const [pid, parent] = pids; assert.ok(pid && parent); t.after(() => { try { process.kill(-parent, 'SIGKILL'); } catch {} });
    if (action === 'disconnect') controller.abort(); else f.service.abortToolRuns(f.session.name);
    await waitFor(() => gone(pid), 'child survived cancellation');
    const response = await pending; if (action === 'stop') assert.ok(response.status === 403 || (response.status === 200 && response.body.ok === false)); else assert.equal(response.error.name, 'AbortError');
  });
}

test('stop during discovery prevents spawning', async t => {
  const f = await runFixture(t); await f.tool(); await f.setKey();
  const folderTools = require('../lib/folder-tools'), original = folderTools.discover; let release, entered;
  const waiting = new Promise(resolve => { entered = resolve; }); const gate = new Promise(resolve => { release = resolve; });
  folderTools.discover = async (...args) => { entered(); await gate; return original(...args); };
  t.after(() => { folderTools.discover = original; release(); });
  const pending = f.call(); await Promise.race([waiting, new Promise((_, reject) => setTimeout(() => reject(new Error('discovery deadline')), 6000))]);
  f.service.abortToolRuns(f.session.name); release(); const response = await pending;
  assert.equal(response.status, 403); assert.equal((await response.json()).error, 'this session has ended'); await assert.rejects(fs.stat(f.marker), { code: 'ENOENT' });
});
