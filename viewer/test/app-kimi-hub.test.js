'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transcriptItems, lastAssistantText } = require('../app/chat.js');
const sessions = require('../app/sessions.js');
const sample = fs.readFileSync(path.join(__dirname, '../../docs/plans/kimi-code/samples/wire.jsonl'), 'utf8');
const ordinary = fs.readFileSync(path.join(__dirname, 'fixtures/kimi/ordinary.jsonl'), 'utf8');
const lines = rows => rows.map(JSON.stringify).join('\n');

test('Kimi transcript displays human, tool and reply while hiding role and thinking', () => {
  const items = transcriptItems('kimi', ordinary, {}, 'session');
  assert.deepEqual(items.map(x => x.type), ['human', 'tool', 'assistant']);
  assert.equal(items[0].text, 'Create hello.txt');
  assert.match(items[1].detail, /Wrote 3 bytes/);
  assert.equal(items[2].text, 'done');
  assert.equal(items[2].id, 'session#0');
  assert.deepEqual(transcriptItems('kimi', sample, {}, 'session'), []);
  assert.equal(lastAssistantText('kimi', sample, 0), 'done');
  assert.match(transcriptItems('kimi', '{"type":"other"}', {})[0].text, /Couldn't read this Kimi Code transcript/);
});

test('Kimi report selects a turn and orders the last step parts by block', () => {
  const rows = [
    {type:'turn.prompt', origin:{kind:'user'}, turnId:1},
    {type:'context.append_loop_event', event:{type:'step.begin',uuid:'a'}},
    {type:'context.append_loop_event', event:{type:'content.part',stepUuid:'a',block:2,part:{type:'text',text:'world'}}},
    {type:'context.append_loop_event', event:{type:'content.part',stepUuid:'a',block:1,part:{type:'text',text:'hello '}}},
    {type:'turn.ended',turnId:1},
    {type:'turn.prompt',origin:{kind:'user'},turnId:2},
    {type:'context.append_loop_event',event:{type:'step.begin',uuid:'b'}},
    {type:'context.append_loop_event',event:{type:'content.part',stepUuid:'b',block:0,part:{type:'text',text:'later'}}},
    {type:'turn.ended',turnId:2},
  ];
  assert.equal(lastAssistantText('kimi', lines(rows), 1), 'hello world');
  assert.equal(lastAssistantText('kimi', lines(rows)), 'later');
});

test('turn watermark drops retries and interrupted turn releases permission without report or reminder', async () => {
  const target = {name:'worker',role:'reviewer',started_by:'lead',cli:'kimi',live:true,ready:true,permission_open:true,needs_open:true,needs_card:'n',queue:[{text:'next',source:'app'}],owes_reply:true};
  const lead = {name:'lead',role:'lead',live:true,ready:false,queue:[]};
  const thread = {id:'t',machine:'m',sessions:[target,lead],cards:[{id:'n'}],queues:{},delivered_ids:[]};
  const submitted = [];
  const hub = {thread:async()=>thread,save:async()=>{},appendSent:async()=>{},call:async(_m, path, method, body)=>{ assert.match(path, /submit$/); submitted.push(body.text); },quietGraceMs:1};
  await sessions.event(hub,{thread_id:'t',session:'worker',type:'turn-ended',turn_id:0,interrupted:true});
  assert.deepEqual(submitted,['next']);
  assert.equal(target.queue.length,0);
  assert.equal(target.permission_open,false);
  assert.equal(target.finished,undefined);
  assert.equal(target.quiet_check_at,undefined);
  assert.equal(thread.cards[0].answered,true);
  const result = await sessions.event(hub,{thread_id:'t',session:'worker',type:'turn-ended',turn_id:0});
  assert.equal(result.duplicate,true);
});

test('confirming listing supplies ended reasons and pending stop stays live', async () => {
  const lead = {name:'lead',role:'lead',live:true,status:'ready',queue:[]};
  const worker = {name:'worker',role:'worker',started_by:'lead',live:true,status:'ready',queue:[]};
  const thread = {id:'t',machine:'m',sessions:[lead,worker],cards:[],queues:{}};
  let count = 0;
  const hub = {allThreads:async()=>[thread],thread:async()=>thread,withThread:async(_id,fn)=>fn(),save:async()=>{},call:async(_m,_path,method)=> method === 'DELETE' ? {pending:true,end_reason:'pending'} : (++count === 1 ? [{name:'lead',running:false},{name:'worker',running:false}] : [{name:'lead',running:false,end_reason:'lead reason'},{name:'worker',running:false,end_reason:'worker reason'}])};
  assert.equal((await sessions.stopManagedSession(hub,thread,worker)).pending,true);
  assert.equal(worker.live,true);
  await sessions.pollDead(hub);
  assert.match(lead.queue[0].text,/worker reason/);
  assert.match(thread.cards.find(c=>c.title==='Sessions ended').body,/lead reason/);
  assert.equal(worker.end_reason,'worker reason');
});
