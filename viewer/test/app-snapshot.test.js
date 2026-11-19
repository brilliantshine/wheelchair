'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { makeTemp } = require('../../test-support/run-dir');
const { State } = require('../app/state');
const { Hub } = require('../app/hub');
const { discoverSlug } = require('../app/views');
const { handle } = require('../app/routes');

const rows = [
  {id:'alpha',title:'Alpha',updated_at:'2020-01-02',provider:'codex',sessions:[{name:'lead',role:'lead',live:true,ready:true,created_at:'2020-01-01'}],cards:[{kind:'done'}],queues:{},pinned:{}},
  {id:'beta',title:'Beta',updated_at:'2020-01-01',provider:'claude',sessions:[],cards:[],queues:{},pinned:{}},
];
async function request(hub) {
  let body;
  await handle(hub, {method:'GET'}, {writeHead(){}, end(s){body=JSON.parse(s);}}, new URL('http://localhost/wheelchair/api/threads?view=list'), false);
  return body;
}
async function setup() {
  const dir = await makeTemp('snapshot-'); const hub = new Hub({stateDir:dir});
  await hub.state.init();
  for (const row of rows) await fs.writeFile(hub.threadPath(row.id), JSON.stringify(row));
  return hub;
}
test('thread snapshots track external and internal changes and are frozen', async () => {
  const hub = await setup(); const state = hub.state; const file = hub.threadPath('alpha');
  let reads = 0; const read = fs.readFile;
  fs.readFile = async (...args) => { if (String(args[0]).startsWith(state.threadsDir)) reads++; return read(...args); };
  try {
    const first = await state.allThreads(); assert.equal(reads, 2);
    await state.allThreads(); assert.equal(reads, 2);
    assert.throws(() => { first[0].sessions[0].live = false; }, TypeError);
    await fs.utimes(file, 1700000000, 1700000000);
    const old = await fs.stat(file);
    await new Promise(resolve => setTimeout(resolve, 20));
    let contents = await read(file, 'utf8'); contents = contents.replace('Alpha', 'Omega');
    await fs.writeFile(file, contents); await fs.utimes(file, old.atime, old.mtime);
    const after = await fs.stat(file); assert.equal(after.mtimeMs, old.mtimeMs); assert.equal(after.size, old.size); assert.equal(after.ino, old.ino);
    assert.equal((await state.threadSnapshot('alpha')).title, 'Omega');
    await fs.writeFile(file, contents.replace('Omega', 'Longer name')); assert.equal((await state.allThreads())[0].title, 'Longer name');
    const replacement = file + '.tmp'; await fs.writeFile(replacement, JSON.stringify({...rows[0], title:'Replaced'})); await fs.rename(replacement,file);
    assert.equal((await state.allThreads())[0].title, 'Replaced');
    await fs.writeFile(hub.threadPath('gamma'), JSON.stringify({...rows[1],id:'gamma'})); assert.equal((await state.allThreads()).length,3);
    await fs.unlink(hub.threadPath('gamma')); assert.equal((await state.allThreads()).length,2);
    const mutable = await state.thread('alpha'); mutable.title='Saved'; await state.save(mutable); assert.equal((await state.allThreads())[0].title,'Saved');
    await fs.writeFile(file, 'null'); await assert.rejects(state.threadSnapshot('alpha'), {status:404});
    await fs.writeFile(file, '{'); await assert.rejects(state.allThreads(), SyntaxError); await assert.rejects(state.allThreads(), SyntaxError);
  } finally { fs.readFile = read; }
});
test('list matches the captured response without rereading unchanged files', async () => {
  const hub = await setup(); const expected = JSON.parse(await fs.readFile(path.join(__dirname,'fixtures/thread-list-before.json')));
  assert.deepEqual(await request(hub), expected);
  hub.thread = () => { throw new Error('unexpected mutable read'); };
  const read = fs.readFile; let reads=0; fs.readFile = async (...args) => { if (String(args[0]).startsWith(hub.threadsDir)) reads++; return read(...args); };
  try { assert.deepEqual(await request(hub), expected); assert.equal(reads,0); } finally { fs.readFile=read; }
});
test('slug discovery is read-only and missing or already present slugs return null', async () => {
  const thread = Object.freeze({id:'x',slug:'already',worktree:'/missing'});
  assert.equal(await discoverSlug(thread), null); assert.deepEqual(thread,{id:'x',slug:'already',worktree:'/missing'});
});

test('legacy provider migration is persisted by list and chat', async () => {
  const hub = await setup();
  const legacy = {...rows[1], cli:'codex', sessions:[{name:'worker',role:'worker'}], provider:undefined};
  await fs.writeFile(hub.threadPath('beta'), JSON.stringify(legacy));
  const list = await request(hub);
  assert.equal(list.threads.find(t => t.id === 'beta').provider, 'gpt');
  assert.equal((await hub.state.thread('beta')).provider, 'gpt');
  await fs.writeFile(hub.threadPath('beta'), JSON.stringify(legacy));
  const result = await hub.chat('beta');
  assert.equal(result.thread.provider, 'gpt');
  assert.equal((await hub.state.thread('beta')).provider, 'gpt');
});

test('chat reuses thread and parent snapshots under the lock', async () => {
  const hub = await setup();
  const parent = {...rows[1], cards:[], pinned:{}, queues:{}};
  const child = {...rows[0], parent:'beta', sessions:[], cards:[], pinned:{}, queues:{}};
  await fs.writeFile(hub.threadPath('alpha'), JSON.stringify(child));
  await fs.writeFile(hub.threadPath('beta'), JSON.stringify(parent));
  const before = await hub.chat('alpha');
  const read = fs.readFile; let reads = 0;
  fs.readFile = async (...args) => { if (String(args[0]).startsWith(hub.threadsDir)) reads++; return read(...args); };
  try { assert.deepEqual(await hub.chat('alpha'), before); assert.equal(reads, 0); } finally { fs.readFile=read; }
});

test('list joins all locks at once and overlays the fresh record on the listing', async () => {
  const hub = await setup(); let release; const held = new Promise(resolve => { release=resolve; });
  let entered; const inside = new Promise(resolve => { entered=resolve; });
  const operation = hub.withThread('alpha', async () => { entered(); await held; const thread=await hub.thread('alpha'); delete thread.title; thread.extra='saved'; await hub.save(thread); });
  await inside; let betaRead; const betaSeen = new Promise(resolve => { betaRead=resolve; });
  const snapshot = hub.threadSnapshot.bind(hub); hub.threadSnapshot = async id => { if (id === 'beta') betaRead(); return snapshot(id); };
  const pending = request(hub); await betaSeen; release(); await operation;
  const result = await pending; const alpha = result.threads.find(t=>t.id==='alpha');
  assert.equal(alpha.title,'Alpha'); assert.equal(alpha.extra,'saved');
});

test('discovery is read-only and the list saves and returns a discovered slug', async () => {
  const {execFileSync} = require('node:child_process');
  const hub = await setup(); const worktree=await makeTemp('slug-repo-');
  const git=(...args)=>execFileSync('git',['-C',worktree,...args],{stdio:'ignore'});
  git('init'); git('-c','user.name=Test','-c','user.email=test@example.com','commit','--allow-empty','-m','base');
  await fs.mkdir(path.join(worktree,'docs/plans/new-plan'),{recursive:true});
  await fs.writeFile(path.join(worktree,'docs/plans/new-plan/PLAN.md'),'plan');
  const original = {...rows[1],worktree,updated_at:'2020-01-01'};
  await fs.writeFile(hub.threadPath('beta'), JSON.stringify(original));
  const frozen = await hub.threadSnapshot('beta');
  assert.equal(await discoverSlug(frozen),'new-plan');
  assert.deepEqual(await hub.state.thread('beta'), original);
  let registered; hub.registerPlan=async p=>{registered=p;};
  const result=await request(hub); const found=result.threads.find(t=>t.id==='beta');
  assert.equal(found.slug,'new-plan'); assert.notEqual(found.updated_at,original.updated_at);
  assert.equal((await hub.state.thread('beta')).slug,'new-plan');
  assert.equal(registered,path.join(worktree,'docs/plans/new-plan'));
});

test('a save finishing during listing appears after joining the thread lock', async () => {
  const hub = await setup();
  let listed; const listingStarted = new Promise(resolve => { listed=resolve; });
  let resume; const gate = new Promise(resolve => { resume=resolve; });
  const all = hub.allThreads.bind(hub);
  hub.allThreads = async () => { const result=await all(); listed(); await gate; return result; };
  const pending=request(hub); await listingStarted;
  await hub.withThread('alpha', async () => { const thread=await hub.thread('alpha'); thread.title='During listing'; await hub.save(thread); });
  resume(); assert.equal((await pending).threads.find(t=>t.id==='alpha').title,'During listing');
});
