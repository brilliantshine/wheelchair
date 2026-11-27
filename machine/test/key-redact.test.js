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
 assert.equal(redact('ABCDEFGHIJKL %41BCDEFGHIJKL \\u0041BCDEFGHIJKL'),'[key] [key] [key]');
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

test('each escape form and mixed-case hex', () => {
  for (const prefix of [String.raw`\u0041`, String.raw`\x41`, String.raw`\A`, '%41']) {
    assert.equal(redact('left' + prefix + key.slice(1) + 'right'), 'left[key]right');
  }
  assert.equal(redact(String.raw`AB\u002bCD\/EF%3dGH`, ['AB+CD/EF=GH']), '[key]');
  assert.equal(redact(String.raw`%7ea\x7Ebc\u007eACD`, ['~a~bc~ACD']), '[key]');
});

test('nested and mixed escapes, up to three layers', () => {
  for (const plus of [
    '%252B', '%25252B', String.raw`\\u002B`, '%5Cu002B', String.raw`\u005Cu002B`,
    '%5C%5Cu002B', String.raw`\x25\x32B`, String.raw`\u005Cu005Cu002B`,
  ]) {
    assert.equal(redact(plus + 'ABCDEFGHIJK', ['+ABCDEFGHIJK']), '[key]', plus);
  }
  assert.equal(redact('%2525252BABCDEFGHIJK', ['+ABCDEFGHIJK']), '%2525252BABCDEFGHIJK');
  assert.equal(redact('&#43;ABCDEFGHIJK', ['+ABCDEFGHIJK']), '&#43;ABCDEFGHIJK');
});

test('spelling starts inside escape-like text and overlaps plain keys', () => {
  assert.equal(redact('progress=100%41CD%2BEFGH', ['41CD+EFGH']), 'progress=100%[key]');
  assert.equal(redact('left%41BCDEFGHIJKLMright', [key, 'EFGHIJKLM']), 'left[key]right');
  assert.equal(redact(String.raw`dir\ABCDEFGHIJKL`), 'dir[key]');
});

test('unrelated escape bytes and keyless captures pass through', async () => {
  const text = String.raw`progress=100%; path=C:\folder\file`;
  assert.equal(redact(text), text);
  const escaped = '%41BCDEFGHIJKL';
  assert.equal(redact(escaped, []), escaped);
  const result = await run(`process.stdout.write(${JSON.stringify(escaped)}); process.stderr.write(${JSON.stringify(text)})`, []);
  assert.equal(result.text, escaped);
  assert.equal(result.stderr, text);
});

test('cut edges keep nearby text and remove the longest partial spelling', () => {
  const cutEnd = { cutEnd: true };
  const cutStart = { cutStart: true };
  assert.equal(redact('safe text %41%42%', [key], cutEnd), 'safe text [output cut]');
  assert.equal(redact('safe text %41%42%', [key, 'ZZZZZZZZ'], cutEnd), 'safe text [output cut]');
  assert.equal(redact('42%43DEFGHIJKL rest', [key], cutStart), '[output cut] rest');
  const noise = '%41'.repeat(200);
  assert.equal(redact(noise, ['ZZZZZZZZ'], cutEnd), noise.slice(0, -2) + '[output cut]');
  assert.equal(redact('progress 100%', [key], cutEnd), 'progress 100[output cut]');
  assert.equal(redact('42%43DEFGHIJKLM rest', ['ABCDEFGH', 'EFGHIJKLM'], cutStart), '[output cut][key] rest');
  assert.equal(redact('%42%43%44', [key], { cutStart: true, cutEnd: true }), '[output cut][output cut]');
});

test('a maximum-width escaped character can cross a ring boundary', () => {
  let first = 'A';
  for (let layer = 0; layer < 3; layer++) {
    first = Array.from(first, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  }
  assert.equal(first.length, 216);
  const context = 'x '.repeat(125);
  assert.equal(redact(context + first + key.slice(1)), context + '[key]');
  assert.equal(redact(context + first.slice(0, -1), [key], { cutEnd: true }), context + '[output cut]');
  assert.equal(redact(first.slice(1) + key.slice(1) + ' rest', [key], { cutStart: true }), '[output cut] rest');
});

test('fallback finds unchecked runs and plain keys before trimming', () => {
  const tiny = { workBudget: 1 };
  assert.equal(redact('ok %41%42 then ABCDEFGHIJKL', [key], tiny), 'ok [not checked for keys] then [key]');
  assert.equal(redact('%41BCDEFGHIJKL rest', [key], { ...tiny, cutStart: true }), '[output cut][not checked for keys] rest');
  assert.equal(redact('1%44EFGHIJKL rest', [key], { ...tiny, cutStart: true }), '[output cut][not checked for keys] rest');
  assert.equal(redact('%41%42%43', [key], { ...tiny, cutStart: true, cutEnd: true }), '[output cut][output cut]');
  assert.equal(redact('x ABCDEFGHIJKL%4D', [key, 'GHIJKLMN'], tiny), 'x [not checked for keys]');
});

test('escaped runner timeout hides open stdout and stderr key fragments', async () => {
  const result = await run(`
    process.stdout.write('safe done %41%42%43');
    process.stderr.write('safe tail %41%42');
    setInterval(() => {}, 1000);
  `, [key], 1);
  assert.equal(result.timedOut, true);
  assert.equal(result.text, 'safe done [output cut]');
  assert.equal(result.stderr, 'safe tail [output cut]');
});

test('escaped runner 64 KiB stderr starts inside a three-layer spelling', async () => {
  const part = String.raw`\u005Cu005Cu0041`;
  const value = 'A'.repeat(4096);
  const suffix = ' tail';
  const data = part.repeat(value.length) + suffix;
  assert.equal(data.length - suffix.length, 65536);
  const start = performance.now();
  const result = await run(`process.stderr.write('x '.repeat(10) + ${JSON.stringify(part)}.repeat(4096) + ' tail')`, [value]);
  assert.equal(result.stderr, '[output cut] tail');
  console.log(`64 KiB stderr runner: ${(performance.now() - start).toFixed(1)} ms`);
});

test('escaped runner redacts percent-encoded stdout and JSON stderr', async () => {
  const value = 'AB+CD/EF=GH';
  const jsonValue = String.raw`t=AB\u002BCD/EF=GH`;
  const result = await run(`
    process.stdout.write(encodeURIComponent('https://x.test/?t=' + ${JSON.stringify(value)}));
    process.stderr.write(JSON.stringify(${JSON.stringify(jsonValue)}));
  `, [value]);
  assert.equal(result.text, 'https%3A%2F%2Fx.test%2F%3Ft%3D[key]');
  assert.equal(result.stderr, '"t=[key]"');
});
