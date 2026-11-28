'use strict';
require('./helpers/isolate-models.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const { requestJson, MachineClient } = require('../app/machine-client.js');
const { sessionTranscript } = require('../app/chat.js');
const sessions = require('../app/sessions.js');

const claude = JSON.stringify({type:'assistant',message:{role:'assistant',content:[{type:'text',text:'report'}]}});
const pi = JSON.stringify({type:'message',id:'entry',message:{role:'assistant',content:[{type:'text',text:'report'}]}});
function fixture(read, cli = 'claude') {
  let time = 0, calls = [];
  const target = {name:'worker',role:cli === 'pi' ? 'verifier' : 'reviewer',started_by:'lead',cli,live:true,ready:true,queue:[],owes_reply:true};
  const lead = {name:'lead',role:'lead',live:true,ready:false,queue:[]};
  const thread = {id:'t',machine:'m',sessions:[target,lead],cards:[],queues:{},delivered_ids:[]};
  const hub = {thread:async()=>thread,save:async()=>{},appendSent:async()=>{},call:async()=>{},quietGraceMs:10,
    reportNow:()=>time,reportSleep:async ms=>{time+=ms;},client:{passThrough:async (...args)=>{calls.push(args[4]); return read(calls.length, ms=>{time+=ms;});}}};
  return {hub,thread,target,lead,calls,time:()=>time,run:()=>sessions.event(hub,{thread_id:'t',session:'worker',type:'turn-ended',entry_id:cli === 'pi' ? 'entry' : undefined})};
}
const ok = data => ({status:200,body:{data}});
test('report retries a failed read and delivers exactly once', async()=>{
  const f=fixture(n=>{if(n===1) throw Error('down'); return ok(claude);});
  await f.run(); await f.run();
  assert.deepEqual(f.calls,[3000,1000]); assert.equal(f.thread.cards.filter(c=>c.kind==='result').length,1); assert.equal(f.lead.queue.length,1);
});
test('Pi retries an empty transcript until its entry arrives', async()=>{
  const f=fixture(n=>ok(n===1?'':pi),'pi'); await f.run();
  assert.equal(f.calls.length,2); assert.equal(f.thread.cards.find(c=>c.kind==='result').summary,'report');
});
test('absent non-Pi transcript reads once and arms quiet; failures exhaust retries', async()=>{
  const absent=fixture(()=>ok('')); await absent.run(); assert.equal(absent.calls.length,1); assert.ok(absent.target.quiet_check_at); assert.equal(absent.thread.cards.length,0);
  const failed=fixture(()=>{throw Error('down');}); await failed.run(); assert.equal(failed.calls.length,4); assert.ok(failed.target.quiet_check_at); assert.ok(failed.time()<=4000);
});
test('deadline boundary skips the gap at 749ms and permits it at 750ms', async()=>{
  for (const [left,count] of [[749,1],[750,2]]) {
    const f=fixture((n,advance)=>{if(n===1){advance(4000-left); throw Error('down');} return ok(claude);});
    await f.run(); assert.equal(f.calls.length,count); assert.ok(f.time()<=4000);
    if(count===2) assert.equal(f.calls[1],250);
  }
});
test('strict absence falls back locally and failed local reads throw', async()=>{
  const hub={client:{passThrough:async()=>({status:404,body:{}})}};
  assert.equal(await sessionTranscript(hub,{machine:'m'},{name:'s'},{strict:true,timeout:100}),'');
  const file=require.resolve('./fixtures/kimi/ordinary.jsonl');
  assert.equal(await sessionTranscript(hub,{machine:'m'},{name:'s',transcript_path:file},{strict:true,timeout:100}),await fs.readFile(file,'utf8'));
  await assert.rejects(sessionTranscript(hub,{machine:'m'},{name:'s',transcript_path:file+'.missing'},{strict:true,timeout:100}));
});
test('strict request cuts off dribbling response at its wall cap', async()=>{
  const server=http.createServer((_req,res)=>{res.writeHead(200); res.write('{'); const interval=setInterval(()=>res.write(' '),15); res.on('close',()=>clearInterval(interval));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try { const start=Date.now(); await assert.rejects(requestJson(`http://127.0.0.1:${server.address().port}/`,'GET',{},undefined,120,true)); assert.ok(Date.now()-start<700); }
  finally { await new Promise(resolve=>server.close(resolve)); }
});
test('timeout and dropped response after headers are retried', async()=>{
  for (const mode of ['timeout','drop']) {
    let count=0;
    const server=http.createServer((_req,res)=>{ count++; if(count===1){res.writeHead(200); res.write('{'); if(mode==='drop') setTimeout(()=>res.destroy(),10); } else res.end(JSON.stringify({data:claude})); });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const client=new MachineClient({machine:async()=>({address:'127.0.0.1',port:server.address().port,secret:'x'})});
    const f=fixture(()=>{}); f.hub.client=client;
    // Advance the injected clock by the real first-call cap to avoid a second long wait.
    f.hub.reportNow=Date.now; f.hub.reportSleep=async()=>{};
    try { const start=Date.now(); await f.run(); assert.equal(count,2); assert.equal(f.thread.cards.filter(c=>c.kind==='result').length,1); assert.ok(Date.now()-start<4100); }
    finally { await new Promise(resolve=>server.close(resolve)); }
  }
});
