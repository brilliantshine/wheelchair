'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempSync } = require('../../test-support/run-dir');
const { MachineService } = require('../service');
const kimi = require('../adapters/kimi');
function setup() {
  const root = makeTempSync('kimi-turns-');
  const machine = Object.create(MachineService.prototype);
  machine.stateDir = root; machine.sessions = {}; machine.persistSessions = async () => {};
  machine.tmux = () => ({ ok: true, stdout: '' }); machine.liveTmux = () => new Set();
  machine.hook = async (name, event) => { machine.events.push(event); }; machine.events = [];
  const session = { name: 'wc-abc-worker', thread_id: 'abc', cli: 'kimi', status: 'ready', account_dir: root, created_at: new Date(Date.now()-10000).toISOString(), ready_at: new Date().toISOString() };
  machine.sessions[session.name] = session;
  function log(id, rows, agent = 'main') {
    const file = path.join(root, 'sessions/work', id, 'agents', agent, 'wire.jsonl'); fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n')+'\n'); return file;
  }
  const metadata = { type: 'metadata', protocol_version: '1.5', min_protocol_version: '1.5' };
  const prompt = name => ({ type: 'turn.prompt', origin: { kind: 'user' }, input: [{ type: 'text', text: `[wc:role] Role: worker\nSession: ${name}\n` }] });
  return { machine, session, log, metadata, prompt };
}
test('binding rejects a role message quoted after ordinary prompt text', async () => {
  const { machine, session, log, metadata, prompt } = setup();
  const row = prompt(session.name);
  row.input = [{ type: 'text', text: 'Hello ' }, { type: 'text', text: `[wc:role] Role: worker\nSession: ${session.name}\nRead …` }];
  log('quoted', [metadata, row]);
  await machine.kimiBinding(session);
  assert.equal(session.source_transcript, undefined);
});
test('binding joins role message text parts before checking its session line', async () => {
  const { machine, session, log, metadata, prompt } = setup();
  const row = prompt(session.name);
  row.input = [{ type: 'text', text: '[wc:role] Role: worker\n' }, { type: 'text', text: `Session: ${session.name}\nRead …` }];
  const file = log('split', [metadata, row]);
  await machine.kimiBinding(session);
  assert.equal(session.source_transcript, file);
});
test('binding is shared and selects each session marker, ignoring subagents', async () => {
  const { machine, session, log, metadata, prompt } = setup();
  const other = { ...session, name: 'wc-abc-worker-2' }; machine.sessions[other.name] = other;
  log('sub', [metadata, prompt(session.name), { type: 'turn.ended', agentId: 'main', turnId: 1, reason: 'completed' }], 'other');
  const a = log('a', [metadata, prompt(session.name)]), b = log('b', [metadata, prompt(other.name)]);
  await Promise.all([machine.kimiBinding(session), machine.pollKimiTurns()]);
  assert.equal(session.source_transcript, a); assert.equal(other.source_transcript, b); assert.deepEqual(machine.events, []);
  assert.equal((await kimi.findTranscript(session, session.account_dir)), a);
});
test('turn zero and all outcomes are mapped, persisted and not repeated', async () => {
  const { machine, session, log, metadata, prompt } = setup();
  const ends = ['completed', 'cancelled', 'failed', 'failed', 'failed', 'other'].map((reason, turnId) => ({ type: 'turn.ended', agentId: 'main', turnId, reason, ...(turnId === 2 ? { error: 'rate limit' } : turnId === 3 ? { error: { code: 'bad', message: 'outer', cause: { code: 'provider.rate_limit', message: 'inner' } } } : {}) }));
  log('one', [metadata, prompt(session.name), ...ends, { type: 'turn.ended', agentId: 'sub', turnId: 9, reason: 'completed' }]);
  await machine.pollKimiTurns(); await machine.pollKimiTurns();
  assert.deepEqual(machine.events.map(e => e.type), ['turn-ended','turn-ended','limit-hit','limit-hit','turn-failed','turn-failed']);
  assert.equal(machine.events[1].interrupted, true); assert.equal(machine.events[2].error, 'rate limit'); assert.equal(machine.events[3].error, '[bad] outer: inner'); assert.equal(machine.events[4].error, 'Kimi Code turn failed'); assert.equal(machine.events[5].error, 'Kimi Code turn ended (other)');
  assert.deepEqual(machine.events.map(e => e.turn_id), [0,1,2,3,4,5]); assert.ok(machine.events.every(e => e.transcript_path === session.source_transcript));
  assert.equal(session.kimi_last_turn, 5); assert.ok(session.kimi_offset > 0);
});
test('incompatible marker and missing binding stop with a reason', async () => {
  for (const meta of [{ protocol_version: '2.0' }, { protocol_version: '1.5', min_protocol_version: '1.9' }]) {
    const { machine, session, log, prompt } = setup(); log('one', [{ type:'metadata', ...meta }, prompt(session.name)]);
    await machine.pollKimiTurns(); assert.match(session.end_reason, /format changed/); assert.equal(session.status, 'stopped');
  }
  const { machine, session } = setup(); const now = Date.now(); session.ready_at = new Date(now-119999).toISOString(); const original = Date.now; Date.now = () => now;
  try { await machine.pollKimiTurns(); assert.equal(session.end_reason, undefined); Date.now = () => now + 1; await machine.pollKimiTurns(); assert.equal(session.end_reason, "Couldn't find Kimi Code's log for this session"); assert.equal(machine.sessionList().find(s => s.name === session.name).end_reason, session.end_reason); } finally { Date.now = original; }
});
test('protocol versions must be well formed and respect the full minimum', async () => {
  for (const [meta, compatible] of [
    [{ protocol_version: '1.5', min_protocol_version: '1.5.1' }, false],
    [{ protocol_version: '1.5', min_protocol_version: '1.bad' }, false],
    [{ protocol_version: '1.bad' }, false],
    [{}, false],
    [{ protocol_version: '1.5', min_protocol_version: '1.5' }, true],
    [{ protocol_version: '1.5', min_protocol_version: '1.4.9' }, true],
    [{ protocol_version: '1.5', min_protocol_version: '1.6' }, false],
    [{ protocol_version: '1.5', min_protocol_version: '2.0' }, false],
  ]) {
    const { machine, session, log, prompt } = setup();
    const file = log('one', [{ type: 'metadata', ...meta }, prompt(session.name)]);
    await machine.pollKimiTurns();
    if (compatible) assert.equal(session.source_transcript, file, JSON.stringify(meta));
    else assert.match(session.end_reason, /format changed/, JSON.stringify(meta));
  }
});
test('fatal stop refuses input and waits for confirmed absence', async () => {
  const { machine, session } = setup(); session.end_reason = 'lost'; const targets = []; let listingFails = true;
  machine.tmux = args => { targets.push(args); if (args[0] === 'list-sessions') return listingFails ? { ok:false, stderr:'failure', status:1 } : { ok:true, stdout:`${session.name}-2\n` }; return { ok:false, stderr:'gone' }; };
  machine.liveTmux = MachineService.prototype.liveTmux; machine.log = () => {};
  assert.deepEqual(await machine.stop(session.name), { pending: true, end_reason: 'lost' }); assert.equal(session.status, 'ready');
  assert.throws(() => machine.raw(session.name, 'x'), /lost/); await assert.rejects(machine.submit(session.name, 'x'), /lost/);
  assert.deepEqual(targets, [['kill-session','-t',`=${session.name}`],['list-sessions','-F','#S']]);
  listingFails = false; await machine.stop(session.name); assert.equal(session.status, 'stopped');
  assert.deepEqual(targets[2], ['kill-session','-t',`=${session.name}`]);
});

test('unrelated incompatible logs are ignored and truncation stops a bound session', async () => {
  const { machine, session, log, metadata, prompt } = setup();
  log('bad', [{ type:'metadata', protocol_version:'2.0' }, { text:`quoted [wc:role]\nSession: ${session.name}` }]);
  const file = log('good', [metadata, prompt(session.name), { type:'turn.ended', agentId:'main', turnId:0, reason:'completed' }]);
  await machine.pollKimiTurns(); assert.equal(session.source_transcript, file); assert.equal(machine.events.length, 1);
  fs.writeFileSync(file, ''); await machine.pollKimiTurns(); assert.match(session.end_reason, /disappeared or was replaced/);
});
test('spool gate holds later turns until the previous event drains', async () => {
  const { machine, session, log, metadata, prompt } = setup();
  log('good', [metadata, prompt(session.name), ...[0, 1].map(turnId => ({ type:'turn.ended', agentId:'main', turnId, reason:'completed' }))]);
  let blocked = false; machine.kimiSpoolWaiting = async () => blocked;
  machine.hook = async (name, event) => { machine.events.push(event); blocked = true; };
  await machine.pollKimiTurns(); assert.deepEqual(machine.events.map(e => e.turn_id), [0]);
  await machine.pollKimiTurns(); assert.equal(machine.events.length, 1);
  blocked = false; await machine.pollKimiTurns(); assert.deepEqual(machine.events.map(e => e.turn_id), [0, 1]);
});
test('offset stays behind an unhandled turn when the spool drains after breaking', async () => {
  const { machine, session, log, metadata, prompt } = setup();
  log('good', [metadata, prompt(session.name), ...[0, 1].map(turnId => ({ type: 'turn.ended', agentId: 'main', turnId, reason: 'completed' }))]);
  let calls = 0;
  machine.kimiSpoolWaiting = async () => ++calls === 3;
  await machine.pollKimiTurns();
  assert.deepEqual(machine.events.map(e => e.turn_id), [0]);
  assert.equal(session.kimi_offset || 0, 0);
  await machine.pollKimiTurns();
  assert.deepEqual(machine.events.map(e => e.turn_id), [0, 1]);
});
test('copier refuses replaced or shortened Kimi logs', async () => {
  const { machine, session, log, metadata, prompt } = setup(); const file = log('good', [metadata, prompt(session.name)]);
  await machine.kimiBinding(session); await machine.copyTranscriptNow(session, file);
  const copied = fs.readFileSync(session.transcript_path, 'utf8');
  fs.writeFileSync(file, '{}\n'); await machine.copyTranscriptNow(session, file);
  assert.equal(fs.readFileSync(session.transcript_path, 'utf8'), copied);
  fs.renameSync(file, file + '.old'); fs.writeFileSync(file, JSON.stringify({ text:'foreign' }) + '\n');
  await machine.copyTranscriptNow(session, file); assert.equal(fs.readFileSync(session.transcript_path, 'utf8'), copied);
});

test('chat binds before polling and simultaneous chat and polling share identity', async () => {
  const { machine, session, log, metadata, prompt } = setup();
  const file = log('own', [metadata, prompt(session.name)]);
  const [chat] = await Promise.all([machine.transcript(session.name), machine.pollKimiTurns()]);
  const stat = fs.statSync(file);
  assert.match(chat.data, /Session: wc-abc-worker/);
  assert.equal(session.source_transcript, file); assert.equal(session.kimi_session_id, 'own');
  assert.deepEqual(session.kimi_log_id, { dev: stat.dev, ino: stat.ino });
  assert.equal(session.transcript_source.ino, stat.ino);
});

test('persisted offsets catch up after restart and a crash before saving replays the turn', async () => {
  const { session, log, metadata, prompt } = setup(); const root = session.account_dir;
  const machine = new MachineService({ stateDir: root }); machine.sessions[session.name] = session;
  machine.config = {}; machine.hook = async (name, event) => { await machine.spool('events', { ...event, session: name, prepared: true }); };
  const file = log('own', [metadata, prompt(session.name), { type:'turn.ended', agentId:'main', turnId:0, reason:'completed' }]);
  await machine.pollKimiTurns(); const spool = path.join(root, 'spool/events');
  for (const name of fs.readdirSync(spool)) fs.unlinkSync(path.join(spool, name));
  // Persist an offset after turn zero and restart from the actual state file.
  await machine.pollKimiTurns(); const before = fs.readFileSync(machine.sessionsPath, 'utf8');
  fs.appendFileSync(file, JSON.stringify({ type:'turn.ended', agentId:'main', turnId:1, reason:'completed' })+'\n');
  const restarted = new MachineService({ stateDir:root }); restarted.config = {}; restarted.sessions = JSON.parse(before);
  const events = []; restarted.hook = async (name,event) => events.push(event);
  await restarted.pollKimiTurns(); await restarted.pollKimiTurns(); assert.deepEqual(events.map(e => e.turn_id), [1]);
  // The event is durable but the session record can still be the pre-save version.
  fs.writeFileSync(restarted.sessionsPath, before); restarted.sessions = JSON.parse(fs.readFileSync(restarted.sessionsPath, 'utf8'));
  await restarted.spool('events', { ...events[0], session:session.name, prepared:true });
  assert.equal(await restarted.kimiSpoolWaiting(restarted.sessions[session.name]), true);
  for (const name of fs.readdirSync(spool)) fs.unlinkSync(path.join(spool, name));
  await restarted.pollKimiTurns(); assert.deepEqual(events.map(e => e.turn_id), [1, 1]);
});

test('missing log requires continuous failures and delivery failures never start the clock', async () => {
  const { machine, session, log, metadata, prompt } = setup();
  const file = log('own', [metadata, prompt(session.name), { type:'turn.ended', agentId:'main', turnId:0, reason:'completed' }]);
  machine.sessionsPath = path.join(machine.stateDir, 'sessions.json'); machine.persistSessions = MachineService.prototype.persistSessions;
  let now = 100000; const oldNow = Date.now; Date.now = () => now;
  try {
    machine.hook = async () => { throw new Error('hub failure'); }; machine.log = () => {};
    await machine.pollKimiTurns(); now += 31000; await machine.pollKimiTurns();
    assert.equal(session.kimi_missing_since, undefined); assert.equal(session.end_reason, undefined);
    fs.renameSync(file, file + '.saved'); await machine.pollKimiTurns(); assert.equal(session.kimi_missing_since, now); assert.equal(JSON.parse(fs.readFileSync(machine.sessionsPath, 'utf8'))[session.name].kimi_missing_since, now);
    now += 29000; fs.renameSync(file + '.saved', file); await machine.pollKimiTurns(); assert.equal(session.kimi_missing_since, undefined); assert.equal(JSON.parse(fs.readFileSync(machine.sessionsPath, 'utf8'))[session.name].kimi_missing_since, undefined);
    fs.renameSync(file, file + '.saved'); await machine.pollKimiTurns(); now += 30000; await machine.pollKimiTurns();
    assert.equal(session.end_reason, "Kimi Code's log for this session disappeared or was replaced");
  } finally { Date.now = oldNow; }
});

test('persistence errors after a successful log read do not start the missing clock', async () => {
  const { machine, session, log, metadata, prompt } = setup();
  log('own', [metadata, prompt(session.name), { type:'turn.ended', agentId:'main', turnId:0, reason:'completed' }]);
  await machine.kimiBinding(session); machine.log = () => {}; machine.persistSessions = async () => { throw new Error('disk'); };
  await machine.pollKimiTurns(); assert.equal(session.kimi_missing_since, undefined); assert.equal(session.end_reason, undefined);
});

test('copier does not open source after fatal and ignores swapped opened file', async () => {
  const { machine, session, log, metadata, prompt } = setup();
  const file = log('own', [metadata, prompt(session.name)]); await machine.kimiBinding(session);
  const oldOpen = fs.promises.open; let swapped = false;
  fs.promises.open = async (name, ...args) => { if (name === file && !swapped) { swapped = true; fs.renameSync(file, file + '.old'); fs.writeFileSync(file, '{"foreign":true}\n'); } return oldOpen(name, ...args); };
  try { assert.deepEqual((await machine.copyTranscriptNow(session, file)).lines, []); } finally { fs.promises.open = oldOpen; }
  session.end_reason = 'lost'; fs.unlinkSync(file);
  assert.deepEqual((await machine.copyTranscriptNow(session, file)).lines, []);
});

test('recovery stops Kimi while leaving Claude and marker-priority panes alone', async () => {
  const { machine } = setup(); machine.sessions = {};
  const panes = { 'wc-a-worker': '│ >\nAsk When Needed  K3.1 Pro thinking: high  …/clone/wc/db3f0b03dcf6  wc/db3f0b03dcf6\ncontext: 0% (0/256k)', 'wc-b-worker': '│ >\ncontext: 10%', 'wc-c-worker': 'Codex\n› input\ncontext: 0%', 'wc-d-worker': '│ >\nNever Ask  K3 thinking: high  …/worktrees/clone/wc-smoke-w2  wc-smoke-w2\ncontext: 7% (17.5k/256k)', 'wc-e-worker': '│ >\nAsk When Needed  K2.7 Code Highspeed thinking\ncontext: 0% (0/256k)', 'wc-f-worker': 'Antigravity CLI\n> input', 'wc-g-worker': 'Claude Code\n│ >\ncontext: 10%\n  bypass permissions on', 'wc-h-worker': '▶ Run this command?\n▶ 1. Approve once\n  2. Reject\nAsk When Needed  K3.1 Pro thinking: high\ncontext: 5% (13k/256k)' };
  machine.liveTmux = () => new Set(Object.keys(panes));
  machine.tmux = args => ({ ok:true, stdout: args[0] === 'capture-pane' ? panes[args.at(-1)] : '/tmp' });
  await machine.recoverFromTmux();
  assert.equal(machine.sessions['wc-a-worker'].end_reason, 'Lost track of this Kimi Code session after a machine restart; restart it');
  assert.equal(machine.sessions['wc-b-worker'].cli, 'claude'); assert.equal(machine.sessions['wc-c-worker'].cli, 'codex');
  assert.equal(machine.sessions['wc-h-worker'].cli, 'kimi'); assert.equal(machine.sessions['wc-h-worker'].end_reason, 'Lost track of this Kimi Code session after a machine restart; restart it'); assert.equal(machine.sessions['wc-d-worker'].cli, 'kimi'); assert.equal(machine.sessions['wc-e-worker'].cli, 'kimi'); assert.equal(machine.sessions['wc-f-worker'].cli, 'agy'); assert.equal(machine.sessions['wc-g-worker'].cli, 'claude');
  const targets = []; machine.tmux = args => { targets.push(args); return { ok:true, stdout:'' }; }; machine.liveTmux = () => new Set();
  await machine.pollKimiTurns(); assert.deepEqual(targets, [['kill-session','-t','=wc-a-worker'], ['kill-session','-t','=wc-d-worker'], ['kill-session','-t','=wc-e-worker'], ['kill-session','-t','=wc-h-worker']]); assert.equal(machine.sessions['wc-a-worker'].status, 'stopped');
});

test('outage spools one turn at a time and drains in order even when the clock moves backwards', async () => {
  const { session, log, metadata, prompt } = setup();
  const root = session.account_dir; const machine = new MachineService({ stateDir: root });
  machine.config = {}; machine.sessions[session.name] = session;
  log('own', [metadata, prompt(session.name), ...[0,1].map(turnId => ({ type:'turn.ended', agentId:'main', turnId, reason:'completed' }))]);
  let now = Date.now(); const oldNow = Date.now; Date.now = () => now;
  const received = []; const http = require('node:http');
  const hub = http.createServer((req,res) => { let data=''; req.on('data', x => data += x); req.on('end', () => { received.push(JSON.parse(data)); res.writeHead(200); res.end('{}'); }); });
  try {
    await machine.pollKimiTurns(); await machine.pollKimiTurns();
    const spool = path.join(root, 'spool/events'); assert.equal(fs.readdirSync(spool).length, 1);
    assert.equal(session.kimi_last_turn, 0);
    await new Promise(resolve => hub.listen(0, '127.0.0.1', resolve)); machine.config.hub_url = `http://127.0.0.1:${hub.address().port}`;
    await machine.drainSpool('events'); now -= 100000; await machine.pollKimiTurns();
    assert.deepEqual(received.map(e => e.turn_id), [0, 1]); assert.equal(fs.readdirSync(spool).length, 0);
  } finally { Date.now = oldNow; if (hub.listening) await new Promise(resolve => hub.close(resolve)); }
});

test('HTTP pending stop, archive and hook preserve pending session and its worktree', async () => {
  const root = makeTempSync('kimi-http-turns-'), secret = path.join(root, 'secret'); fs.writeFileSync(secret, 'secret');
  const http = require('node:http'), probe = http.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const machine = new MachineService({ stateDir: root, host:'127.0.0.1', port, secretFile:secret });
  machine.liveTmux = () => new Set(); await machine.listen();
  const worktree = path.join(root, 'work'); fs.mkdirSync(worktree);
  const session = { name:'wc-abc-worker', thread_id:'abc', cli:'kimi', status:'ready', token:'token', end_reason:'lost', worktree, created_worktree:true, role:'worker' };
  machine.sessions[session.name] = session;
  const otherWorktree = path.join(root, 'other'); fs.mkdirSync(otherWorktree);
  const other = { name:'wc-abc-worker-2', thread_id:'abc', cli:'claude', status:'stopped', worktree:otherWorktree, created_worktree:true, role:'worker' }; machine.sessions[other.name] = other; let calls = [];
  const pendingWorktree = path.join(root, 'pending'); fs.mkdirSync(pendingWorktree);
  const pending = { name:'wc-abc-worker-4', thread_id:'abc', cli:'kimi', status:'ready', end_reason:'pending too', worktree:pendingWorktree, created_worktree:true, role:'worker' }; machine.sessions[pending.name] = pending;
  const finishedWorktree = path.join(root, 'finished'); fs.mkdirSync(finishedWorktree);
  const finished = { name:'wc-abc-worker-3', thread_id:'abc', cli:'kimi', status:'ready', end_reason:'other lost', worktree:finishedWorktree, created_worktree:true, role:'worker' }; machine.sessions[finished.name] = finished;
  const upload = path.join(root, 'uploads/abc/123-test'); fs.mkdirSync(path.dirname(upload), { recursive:true }); fs.writeFileSync(upload, 'upload');
  machine.tmux = args => { calls.push(args); return { ok:false, stderr:'failure', status:1 }; };
  machine.liveTmux = () => new Set([session.name, pending.name]);
  const request = (route, method, body, token = 'secret') => fetch(`http://127.0.0.1:${port}${route}`, { method, headers: { [token === 'token' ? 'x-wheelchair-session-token' : 'x-wheelchair-machine-secret']:token, 'content-type':'application/json' }, ...(body ? { body:JSON.stringify(body) } : {}) });
  try {
    let response = await request('/v1/sessions/wc-abc-worker','DELETE'); assert.equal(response.status,202); assert.deepEqual(await response.json(), {pending:true,end_reason:'lost'});
    response = await request('/v1/archive','POST',{thread_id:'abc'}); assert.equal(response.status,200); const result = await response.json();
    assert.deepEqual(result, { pending:true, pending_sessions:[session.name,pending.name], stopped:[finished.name], committed:[], removed:[], kept:[{worktree,reason:'lost'},{worktree:pendingWorktree,reason:'pending too'}] });
    assert.equal(machine.sessions[session.name],session); assert.equal(machine.sessions[other.name],other); assert.equal(finished.status,'stopped');
    const saved = JSON.parse(fs.readFileSync(machine.sessionsPath,'utf8')); assert.equal(saved[session.name].status,'ready'); assert.equal(saved[pending.name].status,'ready'); assert.equal(saved[finished.name].status,'stopped');
    assert.ok(fs.existsSync(worktree)); assert.ok(fs.existsSync(otherWorktree)); assert.ok(fs.existsSync(finishedWorktree)); assert.ok(fs.existsSync(pendingWorktree)); assert.equal(fs.readFileSync(upload,'utf8'),'upload');
    for (const [endpoint,body] of [['submit',{text:'test'}], ['keys',{keys:'x'}]]) { response = await request(`/v1/sessions/${session.name}/${endpoint}`,'POST',body); assert.equal(response.status,409); assert.equal((await response.json()).error,'lost'); }
    assert.ok(calls.filter(args => args[0] === 'kill-session').every(args => [ `=${session.name}`, `=${pending.name}`, `=${finished.name}` ].includes(args.at(-1))));
    const chatSession = { name:'wc-def-worker', thread_id:'def', cli:'kimi', status:'ready', account_dir:root, token:'other-token', created_at:new Date(Date.now()-10000).toISOString(), ready_at:new Date().toISOString() };
    machine.sessions[chatSession.name] = chatSession;
    const chatFile = path.join(root, 'sessions/work/chat/agents/main/wire.jsonl'); fs.mkdirSync(path.dirname(chatFile), {recursive:true});
    fs.writeFileSync(chatFile, [ {type:'metadata',protocol_version:'1.5'}, {type:'turn.prompt',origin:{kind:'user'},input:[{text:`[wc:role] Role: worker\nSession: ${chatSession.name}\n`}]} ].map(JSON.stringify).join('\n')+'\n');
    const [chatResponse] = await Promise.all([request(`/v1/sessions/${chatSession.name}/transcript`,'GET'), machine.pollKimiTurns()]);
    assert.match((await chatResponse.json()).data, /Session: wc-def-worker/); assert.equal(chatSession.source_transcript,chatFile); assert.equal(chatSession.kimi_session_id,'chat');
    const chatStat = fs.statSync(chatFile); assert.deepEqual(chatSession.kimi_log_id,{dev:chatStat.dev,ino:chatStat.ino});
    let hookCalls = 0; machine.hook = async () => { hookCalls++; };
    for (const type of ['turn-ended','prompt','turn-failed']) {
      response = await request('/v1/agent/hooks','POST',{type,notification_type:'permission_prompt',transcript_path:'/other'},'token');
      assert.deepEqual(await response.json(),{ignored:true});
    }
    assert.equal(hookCalls,0); assert.equal(session.source_transcript,undefined); assert.equal(session.prompt_open,undefined);
    response = await request('/v1/sessions','GET'); assert.equal((await response.json()).find(s => s.name === session.name).end_reason,'lost');
    machine.liveTmux = () => new Set();
    response = await request(`/v1/sessions/${session.name}`,'DELETE'); assert.equal(response.status,200); assert.deepEqual(await response.json(),{ok:true,end_reason:'lost'});
    const deadline = { name:'wc-ghi-worker', thread_id:'ghi', cli:'kimi', status:'ready', account_dir:root, created_at:new Date(Date.now()-130000).toISOString(), ready_at:new Date(Date.now()-120000).toISOString() };
    machine.sessions[deadline.name] = deadline; machine.liveTmux = () => new Set(); await machine.pollKimiTurns();
    response = await request('/v1/sessions','GET'); const listed = (await response.json()).find(s => s.name === deadline.name);
    assert.equal(listed.end_reason, "Couldn't find Kimi Code's log for this session"); assert.equal(listed.status,'stopped');
  } finally { await new Promise(resolve => machine.server.close(resolve)); }
});


test('sign-in refuses when no Kimi binary is installed', async () => {
  const oldPath = process.env.PATH, oldHome = process.env.HOME;
  try {
    process.env.PATH = '/usr/bin:/bin'; process.env.HOME = makeTempSync('kimi-no-binary-');
    const machine = Object.create(MachineService.prototype);
    await assert.rejects(machine.startLogin({account:'default-kimi',cli:'kimi'}), /Kimi Code is not installed/);
  } finally { process.env.PATH = oldPath; process.env.HOME = oldHome; }
});
test('duplicate turn ends in one read hand off once', async () => {
  const { machine, session, log, metadata, prompt } = setup();
  log('duplicate', [metadata, prompt(session.name), ...[0, 0, 1].map(turnId => ({ type: 'turn.ended', agentId: 'main', turnId, reason: 'completed' }))]);
  await machine.pollKimiTurns(); assert.deepEqual(machine.events.map(event => event.turn_id), [0, 1]);
});

test('HTTP start retry and listing keep Kimi binding state private', async () => {
  const { machine: source, session, log, metadata, prompt } = setup();
  log('bound', [metadata, prompt(session.name), { type:'turn.ended', agentId:'main', turnId:0, reason:'completed' }]);
  await source.pollKimiTurns(); await source.transcript(session.name); session.kimi_missing_since = 123; session.end_reason = 'lost';
  const fields = ['kimi_session_id', 'source_transcript', 'kimi_log_id', 'kimi_offset', 'kimi_last_turn', 'kimi_missing_since', 'transcript_source'];
  const root = makeTempSync('kimi-public-'), secret = path.join(root, 'secret'); fs.writeFileSync(secret, 'secret');
  const http = require('node:http'), probe = http.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const machine = new MachineService({ stateDir:root, host:'127.0.0.1', port, secretFile:secret });
  machine.liveTmux = () => new Set();
  const other = { name:'wc-abc-worker-2', role:'worker', cli:'claude', thread_id:'abc', token:'token', status:'ready' };
  await machine.listen(); machine.sessions[session.name] = session; machine.sessions[other.name] = other;
  try {
    const headers = { 'x-wheelchair-machine-secret':'secret', 'content-type':'application/json' };
    const start = async s => { const response = await fetch(`http://127.0.0.1:${port}/v1/sessions`, { method:'POST', headers, body:JSON.stringify({ name:s.name, role:s.role || 'worker', cli:s.cli, thread_id:'abc', token:'token' }) }); assert.equal(response.status, 201); return response.json(); };
    const retried = await start(session), otherReply = await start(other);
    const listed = await (await fetch(`http://127.0.0.1:${port}/v1/sessions`, { headers })).json();
    for (const field of fields) { assert.ok(Object.hasOwn(session, field), field); assert.ok(!Object.hasOwn(retried, field), field); assert.ok(!Object.hasOwn(listed.find(s => s.name === session.name), field), field); }
    assert.ok(session.transcript_source); assert.equal(retried.end_reason, 'lost'); assert.equal(listed.find(s => s.name === session.name).end_reason, 'lost');
    assert.deepEqual(otherReply, other); assert.deepEqual(listed.find(s => s.name === other.name), { ...other, codex_thread_id:null, managed:true, running:false });
    let finish; machine.startNamed = () => new Promise(resolve => { finish = resolve; });
    const input = { name:'wc-abc-worker-3', role:'worker', cli:'kimi', thread_id:'abc', token:'token' };
    const first = machine.start(input), joined = machine.start(input); finish({ ...session, name:input.name });
    for (const reply of await Promise.all([first, joined])) for (const field of fields) assert.ok(!Object.hasOwn(reply, field), field);
  } finally { await new Promise(resolve => machine.server.close(resolve)); }
});

test('fatal verifier stop and archive remove created worktrees, while worker stop keeps its checkout', async () => {
  const { execFileSync } = require('node:child_process');
  const root = makeTempSync('kimi-git-'), repo = path.join(root, 'repo'); fs.mkdirSync(repo);
  const git = (...args) => execFileSync('git', args, { encoding:'utf8', stdio:['ignore','pipe','pipe'] });
  git('init', repo); git('-C', repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '--allow-empty', '-m', 'initial');
  const machine = new MachineService({ stateDir:path.join(root, 'state') }); machine.tmux = () => ({ok:true}); machine.liveTmux = () => new Set();
  const make = (name, role, thread) => { const worktree = path.join(root, name); git('-C', repo, 'worktree', 'add', '--detach', worktree); const session = { name, role, thread_id:thread, cli:'kimi', end_reason:'lost', status:'ready', created_worktree:true, worktree }; machine.sessions[name] = session; return session; };
  const stopped = make('wc-stop-verifier', 'verifier', 'stop');
  await machine.stop(stopped.name); assert.equal(fs.existsSync(stopped.worktree), false); assert.ok(!git('-C', repo, 'worktree', 'list', '--porcelain').includes(stopped.worktree));
  const archived = make('wc-archive-verifier', 'verifier', 'archive');
  await machine.archive('archive'); assert.equal(fs.existsSync(archived.worktree), false); assert.ok(!git('-C', repo, 'worktree', 'list', '--porcelain').includes(archived.worktree));
  const worker = make('wc-worker-worker', 'worker', 'worker');
  await machine.stop(worker.name); assert.ok(fs.existsSync(worker.worktree)); assert.ok(git('-C', repo, 'worktree', 'list', '--porcelain').includes(worker.worktree));
});
