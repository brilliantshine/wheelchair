'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readLines } = require('../lib/codex-steps');
const fixture = name => fs.readFileSync(path.join(__dirname,'fixtures/codex-steps',name+'.jsonl'),'utf8').trim().split('\n');
const call = (id,name,input,at='2026-01-01T00:00:00Z') => ({timestamp:at,type:'response_item',payload:{type:'custom_tool_call',call_id:id,name,input}});
const output = (id,output,at='2026-01-01T00:00:01Z') => ({timestamp:at,type:'response_item',payload:{type:'custom_tool_call_output',call_id:id,output}});
test('real immediate script completes at its matching output', () => {
  // The first exec_command has a literal cmd; its output reports Script completed.
  const events=readLines({},fixture('instant')); assert.equal(events.length,2); assert.equal(events[0].step.kind,'shell'); assert.match(events[0].step.label,/^Ran /); assert.equal(events[1].step.clean,true);
});
test('real yielded cell finishes on wait', () => {
  // The exec output yields a cell, then wait reports Script completed and a result.
  const events=readLines({},fixture('wait')); assert.deepEqual(events.map(e=>e.phase),['start','end']); assert.equal(events[1].step.clean,true);
});
test('real mixed scripts start operations and cut short yielded steps', () => {
  // First output has session_id and no exit_code. The next exec is non-poll and
  // ends it uncleanly; the last script mixes write_stdin with exec_command too.
  const events=readLines({},fixture('mixed')); assert.deepEqual(events.map(e=>e.phase),['start','end','start','end','start']); assert.equal(events[1].step.clean,false); assert.equal(events[1].step.failed,null); assert.match(events[4].step.label,/ and more$/);
});
test('real poll chain ends yielded operation with exit 1', () => {
  // The copied chain contains only polls; seed the yielded operation that precedes it.
  const state={yielded:'original',open:{}}; const events=readLines(state,fixture('poll-chain')); assert.equal(events.length,1); assert.deepEqual({...events[0].step,ended_at:null},{id:'original',ended_at:null,failed:true,clean:true});
});
test('real token count uses last usage and context window', () => {
  const lines=fixture('context'), row=JSON.parse(lines[0]), info=row.payload.info;
  assert.deepEqual(readLines({},lines),[{type:'context',context:{percent:Math.round(100*info.last_token_usage.total_tokens/info.model_context_window),at:row.timestamp}}]);
});
test('script targets, polls, state round trip and failure', () => {
  const s={}; let events=readLines(s,[call('a','exec','text(await tools.exec_command({cmd:"npm test"}));'),output('a','Script running with cell ID 1')]);
  assert.equal(events[0].step.label,'Ran npm test');
  events=readLines(JSON.parse(JSON.stringify(s)),[call('p','exec','text(await tools.write_stdin({session_id:1}));'),output('p','{"exit_code":1}')]);
  assert.equal(events.length,1); assert.equal(events[0].step.failed,true);
  events=readLines({},[call('b','exec','tools.view_image({path:"/tmp/a.png"}); tools.exec_command({cmd:"true"});')]);
  assert.equal(events[0].step.label,'Read a.png and more'); assert.equal(events[0].step.kind,'files');
});
