'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const chat = require('../app/chat.js');
const sessions = require('../app/sessions.js');
const sample = fs.readFileSync(path.join(__dirname, '../../docs/plans/openrouter-harness/samples/pi-session-01ea710b-2ab0-44a2-b771-fd079d32726d.jsonl'), 'utf8');
const lines = rows => rows.map(JSON.stringify).join('\n');
const row = (id, role, content) => ({type:'message', id, message:{role, content}});
const raw = lines([row('u1','user',[{type:'text',text:'first'}]), row('a1','assistant',[{type:'text',text:'first report'}]), row('u2','user',[{type:'text',text:'second'}]), row('a2','assistant',[{type:'thinking',thinking:'hidden'}, {type:'text',text:'second '}, {type:'text',text:'report'}])]);

function context(transcript = raw, role = 'reviewer') {
  const target = {name:'reviewer',role,started_by:'lead',cli:'pi',provider:'openrouter',account:'openrouter-work',live:true,ready:true,queue:[]};
  const lead = {name:'lead',role:'lead',live:true,ready:false,queue:[]};
  const thread = {id:'t',machine:'m',sessions:[target,lead],cards:[],queues:{},delivered_ids:[]};
  const hub = {thread:async()=>thread,save:async()=>{},appendSent:async()=>{},call:async(_m, route)=>{ assert.match(route,/transcript/); return {data:transcript}; }, client:{passThrough:async(_m, route)=>{ assert.match(route,/transcript/); return {status:200,body:{data:transcript}}; }}};
  const event = payload => sessions.event(hub,{thread_id:'t',session:'reviewer',...payload});
  return {target,lead,thread,hub,event};
}

test('Pi sample shows text and folded tool calls without thinking or system content', () => {
  const items = chat.transcriptItems('pi',sample,{},'session');
  assert.match(items[0].text,/List the files/);
  const tool = items.find(x=>x.type==='tool');
  assert.equal(tool.text,'bash');
  assert.match(tool.detail,/ls -la/);
  assert.match(tool.detail,/total 0/);
  assert.equal(items.find(x=>x.type==='assistant').text,'DONE');
  assert.equal(items.find(x=>x.type==='assistant').id,'session#0');
  assert.doesNotMatch(JSON.stringify(items),/thinkingSignature|The user wants me/);
});

test('Pi report selects only the named assistant entry', () => {
  assert.equal(chat.lastAssistantText('pi',raw,1,'a1'),'first report');
  assert.equal(chat.lastAssistantText('pi',raw,2,'a2'),'second report');
  for (const id of [null,undefined,'missing','u1']) assert.equal(chat.lastAssistantText('pi',raw,2,id),'');
});

test('completed Pi event delivers the named report to the starter', async () => {
  const c = context();
  await c.event({type:'turn-ended',turn_id:1,entry_id:'a1','last-assistant-message':'wrong'});
  assert.equal(c.lead.queue[0].text,'[wc:from reviewer] result: first report');
  assert.equal(c.thread.cards[0].summary,'first report');
});

test('Pi sample completed entry reaches the starting session', async () => {
  const entry = sample.trim().split('\n').map(JSON.parse).find(x => x.id === '83d2881d');
  assert.equal(entry.message.stopReason, 'stop');
  const text = entry.message.content.filter(x => x.type === 'text').map(x => x.text).join('');
  const c = context(sample);
  await c.event({type:'turn-ended',turn_id:1,entry_id:entry.id});
  assert.equal(c.lead.queue.length,1);
  assert.equal(c.lead.queue[0].text,`[wc:from reviewer] result: ${text}`);
  assert.equal(c.thread.cards[0].summary,text);
});

test('Pi sample aborted entry delivers no report', async () => {
  const entry = sample.trim().split('\n').map(JSON.parse).find(x => x.id === '3ed91fce');
  assert.equal(entry.message.stopReason,'aborted');
  const c = context(sample);
  await c.event({type:'turn-ended',turn_id:1,entry_id:entry.id,interrupted:true});
  assert.equal(c.lead.queue.length,0);
  assert.equal(c.thread.cards.filter(x => x.kind === 'result').length,0);
});

test('aborted and failed Pi turns deliver no report', async () => {
  for (const event of [{type:'turn-ended',turn_id:1,entry_id:'a1',interrupted:true},{type:'turn-failed',turn_id:1,error:'failed'}]) {
    const c = context(); await c.event(event);
    assert.equal(c.target.finished,undefined);
    assert.equal(c.thread.cards.filter(x=>x.kind==='result').length,0);
  }
});

test('an aborted first turn permits the second report', async () => {
  const c = context();
  await c.event({type:'turn-ended',turn_id:1,entry_id:null,interrupted:true});
  await c.event({type:'turn-ended',turn_id:2,entry_id:'a2'});
  assert.match(c.lead.queue[0].text,/second report/);
  assert.equal(c.target.last_turn_id,2);
});

test('completed turns advance watermark, replay is ignored, and null abort cannot reuse a reply', async () => {
  const c = context(raw,'worker');
  await c.event({type:'turn-ended',turn_id:1,entry_id:'a1'});
  await c.event({type:'turn-ended',turn_id:2,entry_id:'a2'});
  assert.equal(c.target.last_turn_id,2);
  assert.equal((await c.event({type:'turn-ended',turn_id:1,entry_id:'a1'})).duplicate,true);
  const d = context();
  await d.event({type:'turn-ended',turn_id:1,entry_id:'a1'});
  await d.event({type:'turn-ended',turn_id:2,entry_id:null,interrupted:true});
  assert.equal(d.lead.queue.length,1);
  assert.equal(d.thread.cards.filter(x=>x.kind==='result').length,1);
});

test('rate-limit failures do not cool down the OpenRouter account and redacted errors reach the starter', async () => {
  const c = context();
  await c.event({type:'turn-failed',turn_id:1,error:'rate limit: [redacted key]'});
  assert.equal(c.target.limited_until,undefined);
  assert.match(c.lead.queue[0].text,/rate limit: \[redacted key\]/);
  assert.doesNotMatch(JSON.stringify(c.thread),/sk-or-/);
});

test('Pi chat response redacts synthetic keys from text and tool details', async () => {
  const secret = 'sk-or-v1-0000synthetic0000';
  const transcript = lines([row('u','user',[{type:'text',text:secret}]),row('a','assistant',[{type:'text',text:secret},{type:'toolCall',id:'call',name:'bash',arguments:{command:secret}}]),row('r','toolResult',[{type:'text',text:secret}])]);
  const thread = {id:'t',machine:'m',sessions:[{name:'lead',role:'lead',cli:'pi'}],cards:[],pinned:{},queues:{}};
  const hub = {readSnapshot:async()=>thread,state:{settings:async()=>null},call:async()=>({data:transcript})};
  const response = await chat.chat(hub,'t');
  assert.doesNotMatch(JSON.stringify(response),/sk-or-/);
  assert.match(JSON.stringify(response),/\[redacted key\]/);
});
