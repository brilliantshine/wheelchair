'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { makeTempSync } = require('../../test-support/run-dir');
const { classify, shellTarget, truncate } = require('../lib/steps');
const claude = require('../../connectors/claude/machine.js');
test('classifies both CLI tool tables and labels and keys', () => {
  for (const [cli, names, kind] of [
    ['claude', ['Agent','Task'], 'helpers'], ['codex', ['spawn_agent','send_input','wait_agent','close_agent'], 'helpers'],
    ['claude', ['WebFetch','WebSearch'], 'web'], ['codex', ['web_search','web_fetch'], 'web'],
    ['claude', ['Read','Write','Edit','MultiEdit','Glob','Grep','NotebookEdit','LS'], 'files'], ['codex', ['apply_patch','view_image','read_file'], 'files'],
    ['claude', ['Bash','other'], 'shell'], ['codex', ['exec_command','shell','write_stdin','other'], 'shell'],
  ]) for (const name of names) assert.equal(classify(cli, name, {}, {}).kind, kind, name);
  assert.deepEqual(classify('claude','Bash',{command:'cd x && npm test\nnext',description:'Run tests'}), {kind:'shell',label:'Run tests',key:'shell:npm test'});
  assert.equal(shellTarget('cd x && npm test\nnext'), 'npm test'); assert.equal(truncate('a'.repeat(81)), 'a'.repeat(79)+'…');
  for (const name of ['Read','Write','Edit','MultiEdit','NotebookEdit']) assert.equal(classify('claude',name,{file_path:'machine/lib/a.js'}).label, `${name === 'Read' ? 'Read' : 'Edited'} a.js`);
  for (const name of ['Glob','Grep','LS']) assert.deepEqual(classify('claude',name,{pattern:'*.js'}), {kind:'files',label:'Searched *.js',key:'files:Searched *.js'});
  assert.equal(classify('codex','view_image',{path:'/repo/machine/a.png'},{cwd:'/repo'}).key,'files:Read machine');
  assert.equal(classify('codex','apply_patch','*** Update File: a/x\n').label,'Edited x');
  assert.equal(classify('codex','apply_patch','*** Update File: a/x\n*** Add File: b/y\n').label,'Edited 2 files');
  assert.equal(classify('claude','Agent',{prompt:'look here\nmore'}).label,'Asked a helper: look here');
  assert.equal(classify('claude','WebSearch',{query:'cats'}).label,'Searched the web: cats');
  assert.equal(classify('codex','web_fetch',{url:'https://example.com/a'}).label,'Read example.com');
  assert.equal(classify('claude','Task',{}).key,'helpers:helpers'); assert.equal(classify('claude','WebSearch',{}).key,'web:web');
  const dir = makeTempSync('wc-step-'); fs.writeFileSync(path.join(dir,'msg.json'),JSON.stringify({to:'wc-123-lead'}));
  for (const [cli,name] of [['claude','Bash'],['codex','exec_command'],['codex','shell']]) {
    assert.deepEqual(classify(cli,name,{command:'node card.js message msg.json'},{cwd:dir}),{kind:'starter',label:'Messaged lead',key:'starter:starter'});
    assert.equal(classify(cli,name,{command:'node card.js message absent'},{cwd:dir}).label,'Sent a message');
    assert.equal(classify(cli,name,{command:'node card.js result x'}).label,'Reported back');
  }
});
test('Claude step hooks omit raw input and map ends', () => {
  const start = claude.hookEvent({hook_event_name:'PreToolUse',tool_use_id:'id',tool_name:'Read',tool_input:{file_path:'secret/a',secret:'hidden'}});
  assert.equal(start.phase,'start'); assert.equal(start.step.label,'Read a'); assert.ok(start.step.started_at); assert.ok(!JSON.stringify(start).includes('hidden'));
  for (const [name,failed] of [['PostToolUse',false],['PostToolUseFailure',true]]) {
    const event = claude.hookEvent({hook_event_name:name,tool_use_id:'id',is_interrupt:true,tool_response:'secret'});
    assert.equal(event.step.failed,failed); assert.equal(event.step.clean,true); assert.ok(event.step.ended_at); assert.ok(!JSON.stringify(event).includes('secret'));
    assert.equal(claude.hookEvent({hook_event_name:name}),null);
  }
  assert.equal(claude.hookEvent({hook_event_name:'PreToolUse'}),null);
});
test('statusline independently throttles and spools both events', () => {
  const state = makeTempSync('wc-context-'); fs.writeFileSync(path.join(state,'machine.json'),JSON.stringify({host:'127.0.0.1',port:1}));
  const run = payload => { const r = spawnSync(path.join(__dirname,'../statusline.sh'),['claude','wc-test'],{input:JSON.stringify(payload),env:{...process.env,WHEELCHAIR_STATE_DIR:state,WHEELCHAIR_SESSION_TOKEN:'token'}}); assert.equal(r.status,0); };
  const payload = {rate_limits:{five_hour:{used_percentage:20}},context_window:{used_percentage:30}};
  const events = () => fs.readdirSync(path.join(state,'spool/events')).map(f=>JSON.parse(fs.readFileSync(path.join(state,'spool/events',f))));
  run(payload); assert.deepEqual(events().map(e=>e.type).sort(),['context','usage-source']);
  run(payload); assert.equal(events().length,2);
  const old = new Date(Date.now()-20000); fs.utimesSync(path.join(state,'statusline/wc-test.context'),old,old);
  run(payload); assert.equal(events().filter(e=>e.type==='context').length,2); assert.equal(events().filter(e=>e.type==='usage-source').length,1);
  const older = new Date(Date.now()-61000); fs.utimesSync(path.join(state,'statusline/wc-test'),older,older);
  run(payload); assert.equal(events().filter(e=>e.type==='context').length,2); assert.equal(events().filter(e=>e.type==='usage-source').length,2);
});
test('empty commands, command arrays and empty patches have useful labels and keys', () => {
  assert.deepEqual(classify('codex', 'write_stdin', {}), {kind:'shell', label:'Used write_stdin', key:'shell:write_stdin'});
  assert.deepEqual(classify('claude', 'mcp_example', {}), {kind:'shell', label:'Used mcp_example', key:'shell:mcp_example'});
  assert.deepEqual(classify('codex', 'shell', {command:['bash','-lc','npm test']}), {kind:'shell',label:'Ran npm test',key:'shell:npm test'});
  assert.equal(classify('codex', 'shell', {command:['echo','hello']}).label, 'Ran echo hello');
  assert.deepEqual(classify('codex', 'apply_patch', 'no file'), {kind:'files',label:'Edited files',key:'files:Edited'});
});
