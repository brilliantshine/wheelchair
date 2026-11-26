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
test('required and invalid fields have distinct reasons; argv elements and limits', () => {
  const server={name:'weather',description:'Server',kind:'server',start:['sh']};
  assert.equal(f.validateToolJson('weather',{...server,start:undefined}).reason,'tool.json has an invalid "start"');
  const {start,...missing}=server;
  assert.equal(f.validateToolJson('weather',missing).reason,'tool.json is missing "start"');
  assert.equal(f.validateToolJson('weather',{...script,description:'two\nlines'}).ok,false);
  for (const argv of [[],['sh',''],['sh',1]]) {
    assert.equal(f.validateToolJson('weather',{...script,run:argv}).ok,false);
    assert.equal(f.validateToolJson('weather',{...server,start:argv}).ok,false);
  }
  for (const timeout_seconds of [null,'1']) assert.equal(f.validateToolJson('weather',{...script,timeout_seconds}).ok,false);
  const name='x'.repeat(40); assert.equal(f.validateToolJson(name,{...script,name}).ok,true);
});
test('valid JSON size boundary', async () => {
  const root=await makeTemp();
  for (const [name,size] of [['under',32768],['over',32769]]) {
    const dir=path.join(root,'.wheelchair/tools',name); await fs.promises.mkdir(dir,{recursive:true});
    const base=JSON.stringify({...script,name,description:'x'}); const data=base+' '.repeat(size-Buffer.byteLength(base));
    await fs.promises.writeFile(path.join(dir,'tool.json'),data);
  }
  const rows=await f.readToolsDir(root,'project');
  assert.equal(rows.find(r=>r.name==='under').status,'ok');
  assert.match(rows.find(r=>r.name==='over').reason,/over 32 KiB/);
});
test('entry shapes and input schema', () => {
  const root=path.resolve('/tmp/project'), rows=[{name:'a',dir:'/tmp/a'},{name:'b',dir:'/tmp/b'}];
  assert.deepEqual(f.bridgeEntry(root,rows),{name:'wheelchair-tools',folder:'bridge',entry:{type:'stdio',command:process.execPath,args:[path.resolve(__dirname,'../lib/tool-bridge.js'),'--project-dir',root,'--tool','/tmp/a','--tool','/tmp/b'],env:{}}});
  assert.deepEqual(f.serverEntry(root,rows[0]),{name:'a',folder:'server',entry:{type:'stdio',command:process.execPath,args:[path.resolve(__dirname,'../lib/tool-launch.js'),'--project-dir',root,'--tool','/tmp/a'],env:{}}});
  const inputs=Object.fromEntries(['string','number','boolean','object','array'].map((type,i)=>[type,{type,description:`desc ${type}`,required:i%2===0}]));
  assert.deepEqual(f.inputSchema(inputs),{type:'object',properties:Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,{type:v.type,description:v.description}])),required:['string','boolean','array']});
  assert.deepEqual(f.inputSchema({x:{type:'string',description:'X',required:false}}),{type:'object',properties:{x:{type:'string',description:'X'}}});
});
test('missing server program, real PATH, and non-executable relative program', async () => {
  const root=await makeTemp();
  for (const [name,tool] of [['server',{name:'server',description:'x',kind:'server',start:['missing-program-wc-xyz']}],['local',{...script,name:'local',run:['./local']} ]]) {
    const dir=path.join(root,'.wheelchair/tools',name); await fs.promises.mkdir(dir,{recursive:true}); await fs.promises.writeFile(path.join(dir,'tool.json'),JSON.stringify(tool));
    if(name==='local') await fs.promises.writeFile(path.join(dir,'local'),'hello',{mode:0o644});
  }
  const found=await f.discover({worktree:root,shared:null,path:process.env.PATH});
  for (const row of found.rows) assert.equal(row.status,'missing-program');
  assert.equal(f.findProgram('sh',root,process.env.PATH),true);
});
test('non-directory tools path and per-tool read errors', async () => {
  const root=await makeTemp(); await fs.promises.mkdir(path.join(root,'.wheelchair')); await fs.promises.writeFile(path.join(root,'.wheelchair/tools'),'x');
  assert.deepEqual(await f.readToolsDir(root,'project'),[]);
  assert.deepEqual((await f.discover({worktree:root,shared:null,path:''})).rows,[]);
  await fs.promises.unlink(path.join(root,'.wheelchair/tools')); const dir=path.join(root,'.wheelchair/tools/bad'); await fs.promises.mkdir(dir,{recursive:true});
  const original=fs.promises.readFile;
  fs.promises.readFile=async (...args)=>{if(args[0]===path.join(dir,'tool.json')) throw Object.assign(new Error('permission denied'),{code:'EACCES'}); return original(...args);};
  try { await fs.promises.writeFile(path.join(dir,'tool.json'),'{}'); const rows=await f.readToolsDir(root,'project'); assert.equal(rows[0].status,'invalid'); assert.equal(rows[0].reason,'permission denied'); } finally { fs.promises.readFile=original; }
});
test('key declarations and store choice', () => {
  const keys=['TOKEN','OTHER']; const result=f.validateToolJson('weather',{...script,keys});
  assert.deepEqual(result.tool.keys,keys); assert.notEqual(result.tool.keys,keys);
  assert.deepEqual(f.validateToolJson('weather',script).tool.keys,[]);
  for (const keys of [null,{},[],Array(21).fill('A'),['A','A'],['1BAD'],['HOME'],[1]]) assert.equal(f.validateToolJson('weather',{...script,keys}).reason,'tool.json has an invalid "keys"');
  assert.equal(f.validateToolJson('weather',{name:'weather',description:'x',kind:'server',start:['sh'],keys:['TOKEN']}).reason,"keys for server tools aren't supported yet");
  assert.deepEqual(f.validateToolJson('weather',{name:'weather',description:'x',kind:'server',start:['sh']}).tool.keys,[]);
  assert.equal(f.toolKeyStore({source:'shared'},false),'shared'); assert.equal(f.toolKeyStore({source:'project'},true),'shared'); assert.equal(f.toolKeyStore({source:'project'},false),'project');
});
