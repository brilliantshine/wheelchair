'use strict';
const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('node:fs'); const path = require('node:path');
const { makeTemp } = require('../../test-support/run-dir'); const f = require('../lib/folder-tools');
const script = { name:'weather', description:'Weather', kind:'script', inputs:{ city:{type:'string', description:'City', required:true} }, run:['node','a.js'] };
test('description validation and normalization', () => {
  assert.equal(f.validateToolJson('weather', script).tool.timeout_seconds, 120);
  assert.deepEqual(f.validateToolJson('weather', {...script, extra:1}).tool, f.validateToolJson('weather', script).tool);
  assert.equal(f.validateToolJson('weather', {name:'weather', description:'Server', kind:'server', start:['node']}).ok, true);
  const cases = [ ['name',{...script,name:'other'}], ['description',{...script,description:'\n'}], ['kind',{...script,kind:'x'}], ['inputs',{...script,inputs:null}], ['type',{...script,inputs:{x:{type:'bad',description:'x',required:true}}}], ['description',{...script,inputs:{x:{type:'string',required:true}}}], ['required',{...script,inputs:{x:{type:'string',description:'x'}}}], ['run',{...script,run:[]}], ['start',{name:'weather',description:'x',kind:'server'}], ...[0,241,1.5].map(n=>['timeout_seconds',{...script,timeout_seconds:n}]) ];
  for (const [field, value] of cases) { const r = f.validateToolJson('weather', value); assert.equal(r.ok,false); assert.match(r.reason,new RegExp(field)); }
  for (const name of ['wheelchair-tools','bad.name','x'.repeat(41)]) assert.equal(f.validateToolJson(name,{...script,name}).ok,false);
  assert.equal(f.validateToolJson('weather',{...script,timeout_seconds:240}).ok,true);
});
test('directory reading, collision, programs and entries', async () => {
  const root = await makeTemp(), shared = await makeTemp();
  async function put(base,name,value) { const dir=path.join(base,'.wheelchair/tools',name); await fs.promises.mkdir(dir,{recursive:true}); if (value !== undefined) await fs.promises.writeFile(path.join(dir,'tool.json'),value); return dir; }
  const dir=await put(root,'weather',JSON.stringify({...script,run:[process.execPath]}));
  await put(shared,'weather',JSON.stringify(script)); await put(root,'bad','{'); await put(root,'huge',' '.repeat(32769)); const non=await put(root,'non'); await fs.promises.mkdir(path.join(non,'tool.json')); await put(root,'missing');
  await put(root,'absent',JSON.stringify({...script,name:'absent',run:['./no']})); await put(root,'pathless',JSON.stringify({...script,name:'pathless',run:['no-such-program-xyz']}));
  const result=await f.discover({worktree:root,shared,path:process.env.PATH});
  assert.equal(result.usable.length,1); assert.equal(result.rows.find(r=>r.source==='shared').status,'hidden'); assert.match(result.problems.find(p=>p.text.startsWith('shared')).text,/hidden/);
  for (const name of ['bad','huge','non','missing']) assert.equal(result.rows.find(r=>r.name===name).status,'invalid');
  for (const name of ['absent','pathless']) assert.equal(result.rows.find(r=>r.name===name).status,'missing-program');
  await fs.promises.writeFile(path.join(dir,'local-program'), '#!/bin/sh\n', {mode:0o755}); assert.equal(f.findProgram('local-program',dir,'.'),true); assert.equal(f.findProgram(process.execPath,dir,''),true); assert.equal(f.bridgeEntry(root,result.usable).entry.args.at(-1),dir); assert.equal(f.serverEntry(root,{name:'x',dir}).folder,'server'); assert.deepEqual(await f.readToolsDir(path.join(root,'none'),'project'),[]);
});
