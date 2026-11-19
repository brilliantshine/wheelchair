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

test('Kimi report ignores stale and subagent turn ends', () => {
  const rows = [
    {type:'turn.prompt',origin:{kind:'user'},turnId:0},
    {type:'context.append_loop_event',event:{type:'step.begin',uuid:'zero'}},
    {type:'context.append_loop_event',event:{type:'content.part',stepUuid:'zero',block:0,part:{type:'text',text:'turn zero'}}},
    {type:'turn.ended',turnId:0,agentId:'main'},
    {type:'turn.prompt',origin:{kind:'user'},turnId:1},
    {type:'turn.ended',turnId:0,agentId:'main'},
    {type:'turn.ended',turnId:1,agentId:'agent-0'},
    {type:'context.append_loop_event',event:{type:'step.begin',uuid:'one'}},
    {type:'context.append_loop_event',event:{type:'content.part',stepUuid:'one',block:1,part:{type:'text',text:'turn '}}},
    {type:'context.append_loop_event',event:{type:'content.part',stepUuid:'one',block:2,part:{type:'text',text:'one'}}},
    {type:'turn.ended',turnId:1,agentId:'main'},
  ];
  assert.equal(lastAssistantText('kimi', lines(rows), 1), 'turn one');
  assert.equal(lastAssistantText('kimi', lines(rows), 0), 'turn zero');
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


test('ended workers notify their starter and only those with a reason add a card', async () => {
  const lead = {name:'lead',role:'lead',live:true,status:'ready',ready:false,queue:[]};
  const withReason = {name:'worker-reason',role:'worker',started_by:'lead',live:true,status:'ready',queue:[]};
  const withoutReason = {name:'worker-no-reason',role:'worker',started_by:'lead',live:true,status:'ready',queue:[]};
  const thread = {id:'t',machine:'m',sessions:[lead,withReason,withoutReason],cards:[],queues:{}};
  let count = 0;
  const hub = {allThreads:async()=>[thread],thread:async()=>thread,withThread:async(_id,fn)=>fn(),save:async()=>{},call:async()=> ++count === 1
    ? [{name:'lead',running:true},{name:'worker-reason',running:false},{name:'worker-no-reason',running:false}]
    : [{name:'lead',running:true},{name:'worker-reason',running:false,end_reason:'lost log'},{name:'worker-no-reason',running:false}]};
  await sessions.pollDead(hub);
  assert.deepEqual(lead.queue.map(item=>item.text), [
    '[wc:from app] your session worker-reason ended: lost log',
    '[wc:from app] your session worker-no-reason ended',
  ]);
  assert.equal(thread.cards.length,1);
  assert.equal(thread.cards[0].kind,'needs');
  assert.equal(thread.cards[0].title,'Session ended');
  assert.equal(thread.cards[0].body,'worker-reason ended: lost log. Its starter has been told.');
});

test('confirmed fatal stops notify once while ordinary stops stay silent', async () => {
  const starter = {name:'starter',role:'lead',live:true,status:'ready',ready:false,queue:[]};
  const worker = {name:'worker',role:'worker',started_by:'starter',live:true,status:'ready',queue:[]};
  const lead = {name:'other-lead',role:'lead',live:true,status:'ready',queue:[]};
  const ordinary = {name:'ordinary',role:'worker',started_by:'starter',live:true,status:'ready',queue:[]};
  const thread = {id:'t',machine:'m',sessions:[starter,worker,lead,ordinary],cards:[],queues:{}};
  const hub = {allThreads:async()=>[thread],thread:async()=>thread,withThread:async(_id,fn)=>fn(),save:async()=>{},call:async(_m,route,method)=> method === 'DELETE'
    ? (route.endsWith('/ordinary') ? {ok:true} : {ok:true,end_reason:'lost'})
    : [{name:'starter',running:true}]};
  await sessions.stopManagedSession(hub,thread,worker);
  assert.equal(worker.end_reason,'lost');
  assert.deepEqual(starter.queue.map(item=>item.text),['[wc:from app] your session worker ended: lost']);
  assert.equal(thread.cards.length,1);
  assert.equal(thread.cards[0].title,'Session ended');
  assert.match(thread.cards[0].body,/worker ended: lost/);
  await sessions.stopManagedSession(hub,thread,worker);
  assert.equal(starter.queue.length,1);
  assert.equal(thread.cards.length,1);
  await sessions.stopManagedSession(hub,thread,lead);
  assert.equal(lead.end_reason,'lost');
  assert.equal(thread.cards.length,2);
  assert.equal(thread.cards[1].title,'Sessions ended');
  assert.match(thread.cards[1].body,/lost/);
  await sessions.stopManagedSession(hub,thread,ordinary);
  assert.equal(ordinary.end_reason,undefined);
  assert.equal(starter.queue.length,1);
  assert.equal(thread.cards.length,2);
  await sessions.pollDead(hub);
  assert.equal(starter.queue.length,1);
  assert.equal(thread.cards.length,2);
});
