'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), {spawnSync}=require('node:child_process');
const {redactCapture}=require('../lib/key-redact'); const {runScript}=require('../lib/tool-run');
const key='ABCDEFGHIJKL';
const redact=(s,values=[key],cuts={})=>redactCapture(Buffer.from(s),values,cuts).toString();
const run=(js,keys=[key],timeout_seconds=4)=>runScript({dir:__dirname,tool:{run:[process.execPath,'-e',js],timeout_seconds},input:{},env:process.env,keys});
test('cut edges and all overlapping matches',()=>{
 assert.equal(redact('head partial',[key],{cutEnd:true}),'head [output cut]');
 assert.equal(redact('partial tail',[key],{cutStart:true}),'[output cut]tail');
 assert.equal(redact('partial',[key],{cutEnd:true}),'[output cut]');
 assert.equal(redact('123456789ABCDEFGHIJKL ABCDEFGHIJKL987654321',[key,'123456789ABC','IJKL987654321']),'[key] [key]');
 assert.equal(redact('ABCDEFGH ABCDEFGHIJKL',['ABCDEFGH',key]),'[key] [key]');
 assert.equal(redact('TOKEN ABCDEFGHIJKL',['TOKENVALUE',key]),'TOKEN [key]');
 assert.equal(redact('ABCDEFGHIJKL %41BCDEFGHIJKL \\u0041BCDEFGHIJKL'),'[key] %41BCDEFGHIJKL \\u0041BCDEFGHIJKL');
});
test('split chunks, final cut and stderr normal end',async()=>{
 const r=await run("process.stdout.write('ABCDEF'); setTimeout(()=>{process.stdout.write('GHIJKL'); process.stderr.write('tail ABCDEFGHIJKL')},1100)");
 assert.equal(r.text,'[key]'); assert.equal(r.stderr,'tail [key]');
 const large=await run("process.stdout.write('x'.repeat(1048570)+' ABCDEFGHIJKL end')"); assert.equal(large.truncated,true); assert.ok(!large.text.includes('ABCDEFGHIJKL'));
});
test('capture boundary, stderr window and keyless output',async()=>{
 const exact=await run("process.stdout.write('x'.repeat(2097152))"); assert.equal(exact.text.length,1048576+'\n[output cut at 1 MiB]'.length);
 const edge=await run("process.stdout.write('x '.repeat(1048570)+' ABCDEFGHIJKLmore')"); assert.ok(!edge.text.includes('ABCDEFGHIJKL'));
 const over=await run("process.stdout.write('x'.repeat(2097152)+'x')"); assert.equal(over.text,'[output cut]');
 const err=await run("process.stderr.write('x'.repeat(65536)+' tail ABCDEFGHIJKL')"); assert.equal(err.stderr.endsWith('tail [key]'),true);
 const plain=await run("process.stdout.write('ABCDEFGHIJKL'); process.stderr.write('ABCDEFGHIJKL')",[]); assert.equal(plain.text,key); assert.equal(plain.stderr,key);
});
test('timeout and forced pipe close trim open ends',async()=>{
 const timed=await run("process.stdout.write('safe ABCDEF'); process.stderr.write('safe ABCDEF'); setInterval(()=>{},1000)",[key],1); assert.equal(timed.timedOut,true); assert.equal(timed.text,'safe [output cut]'); assert.equal(timed.stderr,'safe [output cut]');
 const forced=await run("require('child_process').spawn(process.execPath,['-e',\"setTimeout(()=>{},5000)\"],{stdio:['ignore',1,2]}); process.stdout.write('safe ABCDEF'); process.stderr.write('safe ABCDEF')"); assert.equal(forced.text,'safe [output cut]'); assert.equal(forced.stderr,'safe [output cut]');
});
test('debug diagnostics refuse keyed runs only',()=>{
 const script=`const {runScript}=require(${JSON.stringify(require.resolve('../lib/tool-run'))}); (async()=>{for(const keys of [['abcdefgh'],[]]) console.log(JSON.stringify(await runScript({dir:process.cwd(),tool:{run:[process.execPath,'-e','process.stdout.write("ok")'],timeout_seconds:3},input:{},env:process.env,keys})))})()`;
 for(const value of ['*','child*','CHILD_PROCESS']) { const p=spawnSync(process.execPath,['-e',script],{env:{...process.env,NODE_DEBUG:value},encoding:'utf8',timeout:10000}); assert.equal(p.status,0); const [a,b]=p.stdout.trim().split('\n').map(JSON.parse); assert.equal(a.refused,"Node debug output for child processes is on; keyed tools won't run"); assert.equal(b.text,'ok'); }
});
test('launch errors expose only the error code',async()=>{
 const r=await runScript({dir:__dirname,tool:{run:['no-such-executable-wc-test'],timeout_seconds:3},input:{},env:process.env,keys:[key]}); assert.equal(r.stderr,'cannot start no-such-executable-wc-test: ENOENT');
});
