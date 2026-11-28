'use strict';
const test=require('node:test'); const assert=require('node:assert/strict'); const fs=require('node:fs'); const path=require('node:path'); const {spawn}=require('node:child_process'); const readline=require('node:readline');
const {makeTemp}=require('../../test-support/run-dir'); const {handshake}=require('../lib/mcp-stdio'); const {runScript,toolEnv}=require('../lib/tool-run');
async function fixture(code, extra={}) { const root=await makeTemp(), dir=path.join(root,'example'); await fs.promises.mkdir(dir); await fs.promises.writeFile(path.join(dir,'main.js'),code); const tool={name:'example',description:'Example',kind:'script',inputs:{x:{type:'string',description:'X',required:true}},run:[process.execPath,'main.js'],timeout_seconds:1,...extra}; await fs.promises.writeFile(path.join(dir,'tool.json'),JSON.stringify(tool)); return {root,dir,tool}; }
function rpc(child) { const pending=new Map(); readline.createInterface({input:child.stdout}).on('line',line=>{const m=JSON.parse(line); pending.get(m.id)?.(m);}); let id=0; return (method,params={})=>new Promise((resolve,reject)=>{const n=++id; const timer=setTimeout(()=>reject(Error('RPC deadline')),5000); pending.set(n,m=>{clearTimeout(timer);resolve(m);}); child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:n,method,params})+'\n');}); }
test('bridge schema, call, environment and changed description',async()=>{ const {root,dir,tool}=await fixture("let s=''; process.stdin.on('data',x=>s+=x); process.stdin.on('end',()=>console.log(JSON.stringify({input:JSON.parse(s),project:process.env.WHEELCHAIR_PROJECT_DIR,token:process.env.WHEELCHAIR_SESSION_TOKEN}))); "); const child=spawn(process.execPath,[path.join(__dirname,'../lib/tool-bridge.js'),'--project-dir',root,'--tool',dir],{env:{...process.env,WHEELCHAIR_SESSION_TOKEN:'secret'}}); const call=rpc(child); try { const list=await call('tools/list'); assert.equal(list.result.tools[0].inputSchema.properties.x.type,'string'); const r=await call('tools/call',{name:'example',arguments:{x:'hello'}}); assert.deepEqual(JSON.parse(r.result.content[0].text),{input:{x:'hello'},project:root}); await fs.promises.writeFile(path.join(dir,'tool.json'),JSON.stringify({...tool,description:'Changed'})); assert.match((await call('tools/call',{name:'example'})).result.content[0].text,/tool changed/i); } finally {child.stdin.end();} });
test('runner errors, stderr tail and output cap',async()=>{ let f=await fixture("process.stderr.write('a'.repeat(5000)+'END'); process.exit(7)"); let r=await runScript({dir:f.dir,tool:f.tool,input:{},env:toolEnv(process.env,f.root)}); assert.equal(r.ok,false); assert.equal(r.code,7); assert.equal(Buffer.byteLength(r.stderr),4096); assert.ok(r.stderr.endsWith('END')); f=await fixture("process.stdout.write('x'.repeat(1100000))"); r=await runScript({dir:f.dir,tool:f.tool,input:{},env:process.env}); assert.equal(r.truncated,true); assert.match(r.text,/cut at 1 MiB/); });
test('handshake lists tools and times out on silent server',async()=>{ const root=await makeTemp(), server=path.join(root,'server.js'); await fs.promises.writeFile(server,`require(${JSON.stringify(path.join(__dirname,'../lib/mcp-stdio.js'))}).serve({name:'test',version:'1',tools:[{name:'hello',description:'hello',inputSchema:{type:'object'},call:async()=>({text:'ok'})}]})`); const ok=await handshake({command:process.execPath,args:[server],cwd:root,env:process.env,timeoutMs:2000}); assert.equal(ok.ok,true); assert.deepEqual(ok.tools,['hello']); const bad=await handshake({command:process.execPath,args:['-e','setInterval(()=>{},1000)'],cwd:root,env:process.env,timeoutMs:1000}); assert.equal(bad.ok,false); assert.match(bad.error,/timed out/); });
test('timeout kills the script process group',async()=>{ const f=await fixture("const {spawn}=require('child_process'); const c=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); require('fs').writeFileSync('pid',String(c.pid)); setInterval(()=>{},1000)"); const r=await runScript({dir:f.dir,tool:f.tool,input:{},env:process.env}); assert.equal(r.timedOut,true); const pid=Number(await fs.promises.readFile(path.join(f.dir,'pid'),'utf8')); await stopped(pid); });
async function stopped(pid) { const deadline=Date.now()+3000; while(Date.now()<deadline) { try { process.kill(pid,0); if (fs.existsSync('/proc/self/stat')) { const stat=await fs.promises.readFile(`/proc/${pid}/stat`,'utf8'); if (stat.slice(stat.lastIndexOf(')')+2).startsWith('Z')) return; } } catch(e) { if(e.code==='ESRCH'||e.code==='ENOENT') return; throw e; } await new Promise(r=>setTimeout(r,50)); } assert.fail(`process ${pid} survived`); }
async function pidFile(file) { const deadline=Date.now()+4000; while(Date.now()<deadline) { try { return Number(await fs.promises.readFile(file,'utf8')); } catch(e) { if(e.code!=='ENOENT') throw e; } await new Promise(r=>setTimeout(r,50)); } assert.fail('pid file not written'); }
for (const keys of [[], ['secretvalue']]) {
  const mode=keys.length?'keyed':'keyless';
  test(`runner ${mode} abort kills only its own process group`,async()=>{
    const f=await fixture("const c=require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); require('fs').writeFileSync('pid',String(c.pid)); setInterval(()=>{},1000)",{timeout_seconds:6});
    const other=await fixture("setTimeout(()=>console.log('other completed'),500)",{timeout_seconds:6});
    const controller=new AbortController();
    const pending=runScript({dir:f.dir,tool:f.tool,input:{},env:process.env,keys,signal:controller.signal});
    const concurrent=runScript({dir:other.dir,tool:other.tool,input:{},env:process.env,keys});
    const pid=await pidFile(path.join(f.dir,'pid')); controller.abort();
    await stopped(pid); const result=await pending, second=await concurrent;
    assert.equal(result.ok,false); assert.equal(result.timedOut,false);
    assert.equal(second.ok,true); assert.equal(second.text.trim(),'other completed');
  });
  test(`runner ${mode} already aborted signal starts nothing`,async()=>{
    const f=await fixture("require('fs').writeFileSync('started','yes')"), controller=new AbortController(); controller.abort();
    const result=await runScript({dir:f.dir,tool:f.tool,input:{},env:process.env,keys,signal:controller.signal});
    assert.deepEqual(result,{ok:false,text:'',code:null,signal:null,timedOut:false,truncated:false,stderr:'cancelled'});
    assert.equal(fs.existsSync(path.join(f.dir,'started')),false);
  });
}
for (const mode of ['stdin','signal']) test(`bridge ${mode} stops tool group`,async()=>{ const f=await fixture("const c=require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); require('fs').writeFileSync('pid',String(c.pid)); setInterval(()=>{},1000)",{timeout_seconds:60}); const child=spawn(process.execPath,[path.join(__dirname,'../lib/tool-bridge.js'),'--project-dir',f.root,'--tool',f.dir]); child.stdout.resume(); child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'example'}})+'\n'); const pid=await pidFile(path.join(f.dir,'pid')); try { if(mode==='stdin') child.stdin.end(); else child.kill('SIGTERM'); await stopped(pid); } finally { child.kill('SIGTERM'); } });
test('launcher stdin close stops server group',async()=>{ const f=await fixture("const c=require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); require('fs').writeFileSync('pid',String(c.pid)); setInterval(()=>{},1000)",{kind:'server',start:[process.execPath,'main.js']}); const child=spawn(process.execPath,[path.join(__dirname,'../lib/tool-launch.js'),'--project-dir',f.root,'--tool',f.dir]); child.stdout.resume(); const pid=await pidFile(path.join(f.dir,'pid')); child.stdin.end(); await stopped(pid); });
test('bridge reports exit code and stderr',async()=>{ const f=await fixture("process.stderr.write('bad tail'); process.exit(9)"); const child=spawn(process.execPath,[path.join(__dirname,'../lib/tool-bridge.js'),'--project-dir',f.root,'--tool',f.dir]); const call=rpc(child); try { const r=await call('tools/call',{name:'example'}); assert.equal(r.result.isError,true); assert.match(r.result.content[0].text,/exit code 9/); assert.match(r.result.content[0].text,/bad tail/); } finally {child.stdin.end();} });
test('handshake deadline kills server descendants',async()=>{ const root=await makeTemp(), file=path.join(root,'pid'); const code="const c=require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); require('fs').writeFileSync(process.argv[1],String(c.pid)); setInterval(()=>{},1000)"; const result=await handshake({command:process.execPath,args:['-e',code,file],cwd:root,env:process.env,timeoutMs:1000}); assert.equal(result.ok,false); await stopped(await pidFile(file)); });
test('launcher SIGTERM stops server group',async()=>{ const f=await fixture("const c=require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); require('fs').writeFileSync('pid',String(c.pid)); setInterval(()=>{},1000)",{kind:'server',start:[process.execPath,'main.js']}); const child=spawn(process.execPath,[path.join(__dirname,'../lib/tool-launch.js'),'--project-dir',f.root,'--tool',f.dir]); child.stdout.resume(); const pid=await pidFile(path.join(f.dir,'pid')); child.kill('SIGTERM'); await stopped(pid); });
const launch=path.join(__dirname,'../lib/tool-launch.js'), bridge=path.join(__dirname,'../lib/tool-bridge.js');
function completed(child) { return new Promise(resolve=>{ let stdout='',stderr=''; child.stdout?.on('data',b=>stdout+=b); child.stderr?.on('data',b=>stderr+=b); child.on('close',(code,signal)=>resolve({code,signal,stdout,stderr})); }); }
test('launcher errors and required project directory',async()=>{
  const f=await fixture('',{kind:'server',start:['no-such-program-wc-xyz']});
  let child=spawn(process.execPath,[launch,'--project-dir',f.root,'--tool',f.dir]); let result=await completed(child); assert.equal(result.code,1); assert.match(result.stderr,/no-such-program-wc-xyz/); assert.equal(result.stderr.trim().split('\n').length,1);
  await fs.promises.unlink(path.join(f.dir,'tool.json')); child=spawn(process.execPath,[launch,'--project-dir',f.root,'--tool',f.dir]); result=await completed(child); assert.equal(result.stderr.trim(),'tool example: tool.json is missing'); assert.notEqual(result.code,0);
  await fs.promises.writeFile(path.join(f.dir,'tool.json'),JSON.stringify({name:'example',kind:'server',description:'x'})); child=spawn(process.execPath,[launch,'--project-dir',f.root,'--tool',f.dir]); result=await completed(child); assert.equal(result.stderr.trim(),'tool example: tool.json is missing "start"');
  for(const file of [launch,bridge]) { child=spawn(process.execPath,[file,'--tool',f.dir]); child.stdin.end(); result=await completed(child); assert.notEqual(result.code,0); assert.match(result.stderr,/usage/i); assert.equal(result.stderr.trim().split('\n').length,1); }
});
test('launcher drains output and propagates child exit',async()=>{
  const f=await fixture("process.stdout.write('x'.repeat(1000000)); process.exitCode=7",{kind:'server',start:[process.execPath,'main.js']});
  const child=spawn(process.execPath,[launch,'--project-dir',f.root,'--tool',f.dir]); const result=await completed(child); assert.equal(result.code,7); assert.equal(result.stdout.length,1000000);
});
test('keyless launcher waits for stdout flush and handles EPIPE',()=>{
  const {EventEmitter}=require('node:events'), {PassThrough}=require('node:stream');
  const {pipeKeyless}=require('../lib/tool-launch');
  function setup() {
    const child=new EventEmitter(); child.stdin=new PassThrough(); child.stdout=new PassThrough();
    const stdin=new PassThrough(), stdout=new EventEmitter(), exits=[]; let kills=0, pending;
    stdout.write=(chunk, callback)=>{ assert.equal(chunk,''); pending=callback; return true; };
    pipeKeyless({child,stdin,stdout,kill:()=>kills++,exit:code=>exits.push(code)});
    return {child,stdin,stdout,exits,kills:()=>kills,release:()=>pending()};
  }
  const drain=setup(); drain.child.emit('close',7,null);
  assert.equal(drain.kills(),1); assert.deepEqual(drain.exits,[]);
  drain.release(); assert.deepEqual(drain.exits,[7]);
  const broken=setup(); broken.stdout.emit('error',Object.assign(new Error('closed'),{code:'EPIPE'}));
  assert.equal(broken.kills(),1); assert.deepEqual(broken.exits,[0]);
});
test('keyed launcher drains output and propagates child exit',async()=>{
  const text=JSON.stringify({jsonrpc:'2.0',id:1,result:'x'.repeat(999963)})+'\n';
  assert.equal(Buffer.byteLength(text),1000000);
  const f=await fixture(`process.stdout.write(${JSON.stringify(text)}); process.exitCode=7`,{kind:'server',start:[process.execPath,'main.js'],keys:['TOKEN']});
  const {writeSharedKeys}=require('../lib/shared-keys'), state=path.join(f.root,'state');
  await writeSharedKeys(state,{set:{TOKEN:'secretvalue'}});
  const child=spawn(process.execPath,[launch,'--project-dir',f.root,'--tool',f.dir,'--state-dir',state,'--key-store','shared','--key','TOKEN']);
  const result=await completed(child); assert.equal(result.code,7); assert.equal(result.stdout,text); assert.equal(result.stderr,'');
});
test('launcher serves MCP round trip and stdio methods',async()=>{
  const code=`require(${JSON.stringify(path.join(__dirname,'../lib/mcp-stdio.js'))}).serve({name:'server',version:'1',tools:[{name:'hello',description:'Hi',inputSchema:{type:'object'},call:async a=>({text:a.name})}]})`;
  const f=await fixture(code,{kind:'server',start:[process.execPath,'main.js']}); const child=spawn(process.execPath,[launch,'--project-dir',f.root,'--tool',f.dir]); const call=rpc(child);
  try { assert.equal((await call('initialize',{protocolVersion:'custom'})).result.protocolVersion,'custom'); assert.equal((await call('initialize')).result.protocolVersion,'2025-06-18'); assert.deepEqual((await call('ping')).result,{}); assert.equal((await call('unknown')).error.code,-32601); assert.equal((await call('tools/list')).result.tools[0].name,'hello'); assert.equal((await call('tools/call',{name:'hello',arguments:{name:'world'}})).result.content[0].text,'world'); } finally {child.stdin.end();}
});
test('parallel bridge calls complete',async()=>{
  const f=await fixture("setTimeout(()=>console.log('done'),200)",{timeout_seconds:10}); const child=spawn(process.execPath,[bridge,'--project-dir',f.root,'--tool',f.dir]); const call=rpc(child);
  try { const results=await Promise.all([call('tools/call',{name:'example'}),call('tools/call',{name:'example'})]); assert.deepEqual(results.map(r=>r.result.content[0].text.trim()),['done','done']); } finally {child.stdin.end();}
});
test('exited script cannot leave pipes open',async()=>{
  const f=await fixture("const c=require('child_process').spawn('sleep',['30'],{stdio:['ignore','inherit','inherit']}); require('fs').writeFileSync('pid',String(c.pid)); c.unref(); console.log('done')",{timeout_seconds:10});
  const start=Date.now(), result=await runScript({dir:f.dir,tool:f.tool,input:{},env:process.env}); assert.ok(Date.now()-start<4000); assert.equal(result.ok,true); assert.match(result.text,/done/); await stopped(await pidFile(path.join(f.dir,'pid')));
});
test('timeout stays active while exited script leaves pipes open',async()=>{
  const f=await fixture("require('child_process').spawn('sleep',['30'],{stdio:['ignore','inherit','inherit']}).unref(); console.log('done')",{timeout_seconds:1}); const result=await runScript({dir:f.dir,tool:f.tool,input:{},env:process.env}); assert.equal(result.timedOut,true);
});
test('SIGKILL follows timeout when script ignores SIGTERM',async()=>{
  const f=await fixture("process.on('SIGTERM',()=>{}); require('fs').writeFileSync('pid',String(process.pid)); setInterval(()=>{},1000)"); const start=Date.now(); const result=await runScript({dir:f.dir,tool:f.tool,input:{},env:process.env}); const elapsed=Date.now()-start; assert.equal(result.timedOut,true); assert.equal(result.signal,'SIGKILL'); assert.ok(elapsed>=5500 && elapsed<9000,`elapsed ${elapsed}`); await stopped(await pidFile(path.join(f.dir,'pid')));
});
test('launcher waits for stdout after child exit', {timeout:7000}, async()=>{
  const f=await fixture('',{kind:'server',start:['fake-server']}), shim=path.join(f.root,'spawn-shim.js');
  await fs.promises.writeFile(shim, `const cp=require('child_process'), {EventEmitter}=require('events'), {PassThrough}=require('stream');
cp.spawn=()=>{ const child=new EventEmitter(); child.stdin=new PassThrough(); child.stdout=new PassThrough(); setTimeout(()=>child.emit('exit',7,null),1000); setTimeout(()=>{ child.stdout.end('late output'); child.stdout.on('end',()=>child.emit('close',7,null)); },2000); return child; };`);
  const child=spawn(process.execPath,[launch,'--project-dir',f.root,'--tool',f.dir],{env:{...process.env,NODE_OPTIONS:`--require=${shim}`}}); const result=await completed(child); assert.equal(result.code,7); assert.equal(result.stdout,'late output');
});
test('handshake returns cancelled for an already aborted signal without starting',async()=>{
  const root=await makeTemp(), marker=path.join(root,'started'), controller=new AbortController(); controller.abort();
  const result=await handshake({command:process.execPath,args:['-e',"require('fs').writeFileSync(process.argv[1],'started'); setInterval(()=>{},1000)",marker],cwd:root,env:process.env,timeoutMs:1000,signal:controller.signal});
  assert.deepEqual(result,{ok:false,serverInfo:null,tools:null,error:'cancelled'}); assert.equal(fs.existsSync(marker),false);
});
test('handshake abort stops an unresponsive server and its grandchild',async()=>{
  const root=await makeTemp(), file=path.join(root,'pid'), controller=new AbortController();
  const code="const c=require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); require('fs').writeFileSync(process.argv[1],String(c.pid)); setInterval(()=>{},1000)";
  const pending=handshake({command:process.execPath,args:['-e',code,file],cwd:root,env:process.env,timeoutMs:3000,signal:controller.signal});
  const pid=await pidFile(file); controller.abort(); const result=await pending;
  assert.deepEqual(result,{ok:false,serverInfo:null,tools:null,error:'cancelled'}); await stopped(pid);
});
test('handshake abort discards a partial initialize response',async()=>{
  const root=await makeTemp(), file=path.join(root,'ready'), controller=new AbortController();
  const code="require('readline').createInterface({input:process.stdin}).on('line',s=>{const m=JSON.parse(s); if(m.method==='initialize') console.log(JSON.stringify({jsonrpc:'2.0',id:m.id,result:{serverInfo:{name:'partial'},capabilities:{tools:{}}}})); if(m.method==='tools/list') require('fs').writeFileSync(process.argv[1],'ready');}); setInterval(()=>{},1000)";
  const pending=handshake({command:process.execPath,args:['-e',code,file],cwd:root,env:process.env,timeoutMs:3000,signal:controller.signal});
  const deadline=Date.now()+2500; while(!fs.existsSync(file) && Date.now()<deadline) await new Promise(r=>setTimeout(r,50)); assert.equal(fs.existsSync(file),true);
  controller.abort(); assert.deepEqual(await pending,{ok:false,serverInfo:null,tools:null,error:'cancelled'});
});
test('bridge runs a shared copy without writing in its tool folder', { skip: process.getuid?.() === 0 }, async()=>{
  const {execFileSync}=require('node:child_process'); const shared=require('../lib/shared-tools');
  const root=await makeTemp(), bare=path.join(root,'bare'), source=path.join(root,'source'), stateDir=path.join(root,'state');
  const git=(cwd,...args)=>execFileSync('git',['-C',cwd,...args],{stdio:'ignore'});
  execFileSync('git',['init','--bare','--initial-branch=main',bare],{stdio:'ignore'}); execFileSync('git',['clone',bare,source],{stdio:'ignore'});
  git(source,'config','user.email','test@example.com'); git(source,'config','user.name','Test');
  const dir=path.join(source,'.wheelchair/tools/example'); await fs.promises.mkdir(dir,{recursive:true});
  await fs.promises.writeFile(path.join(dir,'tool.json'),JSON.stringify({name:'example',description:'Example',kind:'script',inputs:{},run:[process.execPath,'main.js']}));
  await fs.promises.writeFile(path.join(dir,'main.js'),"require('fs').writeFileSync('written','bad')");
  git(source,'add','.'); git(source,'commit','-m','tool'); git(source,'push','origin','main');
  const copied=await shared.refreshShared({stateDir,projectPath:source}); assert.equal(copied.error,null);
  const toolDir=path.join(copied.copy,'.wheelchair/tools/example'); const child=spawn(process.execPath,[bridge,'--project-dir',root,'--tool',toolDir]); const call=rpc(child);
  try { const result=await call('tools/call',{name:'example',arguments:{}}); assert.equal(result.result.isError,true); assert.equal(fs.existsSync(path.join(toolDir,'written')),false); } finally {child.stdin.end();}
});
test('keyed bridge reads shared keys on every call and binds names', async () => {
  const {writeSharedKeys}=require('../lib/shared-keys');
  const f=await fixture("require('fs').writeFileSync('seen',process.env.TOKEN); console.log('ok')",{keys:['TOKEN']});
  const state=path.join(f.root,'state'); await writeSharedKeys(state,{set:{TOKEN:'firstvalue'}});
  const args=[bridge,'--project-dir',f.root,'--state-dir',state,'--tool',f.dir,'--key-store','shared','--key','TOKEN'];
  assert.ok(!args.includes('firstvalue'));
  const child=spawn(process.execPath,args); const call=rpc(child), invoke=async()=> (await call('tools/call',{name:'example'})).result;
  try {
    assert.equal((await invoke()).isError,false); assert.equal(await fs.promises.readFile(path.join(f.dir,'seen'),'utf8'),'firstvalue');
    await writeSharedKeys(state,{set:{TOKEN:'secondvalue'}}); assert.equal((await invoke()).isError,false); assert.equal(await fs.promises.readFile(path.join(f.dir,'seen'),'utf8'),'secondvalue');
    await writeSharedKeys(state,{remove:['TOKEN']}); assert.match((await invoke()).content[0].text,/needs key TOKEN, not set/); assert.equal(await fs.promises.readFile(path.join(f.dir,'seen'),'utf8'),'secondvalue');
    await fs.promises.writeFile(path.join(f.dir,'tool.json'),JSON.stringify({...f.tool,keys:['OTHER']})); assert.match((await invoke()).content[0].text,/Its keys are used from the next agent start/);
  } finally { child.stdin.end(); }
});

test('project bridge overrides inherited key and reads project store on each call', async () => {
  const {execFileSync}=require('node:child_process'); const {projectIdentity,writeKeyStore}=require('../lib/project-keys');
  const f=await fixture("require('fs').writeFileSync('seen',process.env.TOKEN); console.log('ok')",{keys:['TOKEN']});
  execFileSync('git',['init',f.root],{stdio:'ignore'}); const state=path.join(f.root,'state'), identity=await projectIdentity(f.root);
  await writeKeyStore(state,identity,{set:{TOKEN:'projectvalue'}});
  const args=[bridge,'--project-dir',f.root,'--state-dir',state,'--tool',f.dir,'--key-store','project','--key','TOKEN'];
  assert.ok(!JSON.stringify(args).includes('projectvalue'));
  const child=spawn(process.execPath,args,{env:{...process.env,TOKEN:'inheritedvalue'}}), call=rpc(child);
  const invoke=async()=> (await call('tools/call',{name:'example'})).result;
  try {
    assert.equal((await invoke()).isError,false); assert.equal(await fs.promises.readFile(path.join(f.dir,'seen'),'utf8'),'projectvalue');
    await writeKeyStore(state,identity,{remove:['TOKEN']}); await fs.promises.unlink(path.join(f.dir,'seen'));
    assert.equal((await invoke()).content[0].text,'tool example needs key TOKEN, not set on this machine'); assert.equal(fs.existsSync(path.join(f.dir,'seen')),false);
    await writeKeyStore(state,identity,{set:{TOKEN:'replacementvalue'}}); assert.equal((await invoke()).isError,false); assert.equal(await fs.promises.readFile(path.join(f.dir,'seen'),'utf8'),'replacementvalue');
  } finally { child.stdin.end(); }
});

test('old bridge arguments refuse newly declared keys but preserve keyless edits', async () => {
  const f=await fixture("console.log('ok')"); const child=spawn(process.execPath,[bridge,'--project-dir',f.root,'--tool',f.dir]); const call=rpc(child);
  const invoke=async()=> (await call('tools/call',{name:'example'})).result;
  try {
    assert.equal((await invoke()).isError,false);
    await fs.promises.writeFile(path.join(f.dir,'tool.json'),JSON.stringify({...f.tool,description:'Edited'}));
    assert.equal((await invoke()).content[0].text,'The tool changed. Try it with wc.js tool run now or through MCP after the next agent start (a new session, a resume or an account switch).');
    await fs.promises.writeFile(path.join(f.dir,'tool.json'),JSON.stringify({...f.tool,keys:['TOKEN']}));
    assert.equal((await invoke()).content[0].text,'The tool changed. Its keys are used from the next agent start (a new session, a resume or an account switch); wc.js tool run runs it now without keys.');
  } finally { child.stdin.end(); }
});

test('bridge refuses keyed calls with Node child process debugging but runs keyless calls', async () => {
  const f=await fixture("console.log('ok')",{keys:['TOKEN']}); const other=path.join(f.root,'other'); await fs.promises.mkdir(other);
  await fs.promises.writeFile(path.join(other,'tool.json'),JSON.stringify({...f.tool,name:'other',keys:undefined})); await fs.promises.writeFile(path.join(other,'main.js'),"console.log('ok')");
  const {writeSharedKeys}=require('../lib/shared-keys'); const state=path.join(f.root,'state'); await writeSharedKeys(state,{set:{TOKEN:'somevalue'}});
  const child=spawn(process.execPath,[bridge,'--project-dir',f.root,'--state-dir',state,'--tool',f.dir,'--key-store','shared','--key','TOKEN','--tool',other],{env:{...process.env,NODE_DEBUG:'child_process'}}); child.stderr.resume(); const call=rpc(child);
  try { assert.equal((await call('tools/call',{name:'example'})).result.content[0].text,"Node debug output for child processes is on; keyed tools won't run"); assert.equal((await call('tools/call',{name:'other'})).result.isError,false); } finally { child.stdin.end(); }
});
