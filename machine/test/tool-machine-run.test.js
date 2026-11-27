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
  const call = async body => { const r = await fetch(`http://127.0.0.1:${server.address().port}/v1/agent/tools/run`, {method:'POST', headers:{'x-wheelchair-session-token':session.token}, body:JSON.stringify(body)}); return [r.status, await r.json()]; };
  const body = {name:'demo', input:{}, env:{PATH:process.env.PATH, VALUE:'present', SECRET:'caller', WHEELCHAIR_SESSION_TOKEN:'secret-token'}};
  assert.deepEqual(await call({...body,name:3}), [400,{error:'invalid name'}]);
  assert.deepEqual(await call({...body,input:[]}), [400,{error:'invalid input'}]);
  assert.deepEqual(await call({...body,env:{}}), [400,{error:'invalid env'}]);
  assert.deepEqual(await call({...body,name:'missing'}), [404,{error:'unknown tool: missing'}]);
  assert.deepEqual(await call(body), [422,{error:'tool demo needs key SECRET, not set on this machine'}]);
  await writeKeyStore(state, await projectIdentity(work), {set:{SECRET:'secretvalue123'}});
  let [status, result] = await call(body); assert.equal(status,200); assert.equal(result.ok,true); assert.deepEqual(JSON.parse(result.text), {key:'[key]', value:'present', token:null});
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
