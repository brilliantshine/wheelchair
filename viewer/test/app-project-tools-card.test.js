'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const { execFileSync, spawn } = require('node:child_process');
const { makeTempSync } = require('../../test-support/run-dir.js');
process.env.WHEELCHAIR_MODELS = path.join(makeTempSync('ptools-models-'), 'models');
const { setup, close, api } = require('./helpers/app.js');
const { Hub } = require('../app/hub.js');
const sessions = require('../app/sessions.js');
const settings = require('../app/settings.js');

const line = (text, ...names) => ({ names, text });
const tools = (over = {}) => ({ boot: 'b1', seq: 1, file: [], programs: [], clis: {}, ...over });
const open = (thread) => thread.cards.filter((c) => c.title === 'Project tools problem' && !c.answered);
const all = (thread) => thread.cards.filter((c) => c.title === 'Project tools problem');
const within = (promise, ms = 3000) => Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout: lock re-taken')), ms))]);

async function fixture() {
  const c = await setup();
  const hub = new Hub({ stateDir: c.state });
  const made = (await api(c, '/threads', { method: 'POST', body: { project: '/tmp/ptools' } })).body;
  const pending = { answer: null };
  const real = hub.call.bind(hub);
  hub.call = async (machine, route, method, body, timeout) => {
    const reply = await real(machine, route, method, body, timeout);
    if (route === '/v1/sessions' && method === 'POST' && pending.answer) return { ...reply, ...pending.answer };
    return reply;
  };
  let n = 0;
  // apply() drives startSession under the thread lock, as the real callers do.
  async function apply(answer) {
    pending.answer = answer;
    n += 1;
    return within(hub.withThread(made.id, async () => {
      const thread = await hub.thread(made.id);
      return sessions.startSession(hub, thread, { role: 'reviewer', attempt_id: `a${n}`, started_by: made.sessions[0].name });
    }));
  }
  const get = () => hub.thread(made.id);
  return { c, hub, made, apply, get, pending };
}
const finish = (f) => close(f.c);

test('card opens, keeps id on same names, replaces on different names, closes on reset', async () => {
  const f = await fixture();
  try {
    await f.apply({ project_tools: tools({ seq: 1, programs: [line('Server "a" needs x, not found', 'a')] }), created_at: '2026-01-01T00:00:00.000Z' });
    let t = await f.get();
    assert.equal(open(t).length, 1);
    const id = open(t)[0].id;
    assert.equal(open(t)[0].body, "Some project tools won't work for agents in this thread:"); assert.deepEqual(open(t)[0].items, ['Server "a" needs x, not found']);
    assert.equal(open(t)[0].kind, 'needs'); assert.equal(open(t)[0].system, true);
    await f.apply({ project_tools: tools({ seq: 2, programs: [line('Server "a" other text', 'a')] }), created_at: '2026-01-01T00:00:01.000Z' });
    t = await f.get();
    assert.equal(open(t).length, 1); assert.equal(open(t)[0].id, id); assert.match(open(t)[0].items[0], /other text/);
    assert.equal(all(t).length, 1);
    await f.apply({ project_tools: tools({ seq: 3, programs: [line('Server "b" bad', 'b')] }), created_at: '2026-01-01T00:00:02.000Z' });
    t = await f.get();
    assert.equal(all(t).length, 2); assert.equal(open(t).length, 1); assert.notEqual(open(t)[0].id, id);
    assert.equal(t.cards.find((c) => c.id === id).answered, true);
    await f.apply({ project_tools: tools({ seq: 4 }), created_at: '2026-01-01T00:00:03.000Z' });
    t = await f.get();
    assert.equal(open(t).length, 0); assert.equal(t.project_tools.card, null); assert.deepEqual(t.project_tools.card_names, []);
  } finally { await finish(f); }
});

test('per-CLI and program lines are kept apart; a file line uses the name file', async () => {
  const f = await fixture();
  try {
    await f.apply({ project_tools: tools({ file: [line('The file is unreadable')], programs: [line('Program missing', 'p')], clis: { codex: { hash: 'h', thread: 't', lines: [line('Codex skips "s"', 's')] }, agy: { hash: 'h', thread: 't', lines: [line('Agy skips "s"', 's')] } } }), created_at: '2026-01-01T00:00:00.000Z' });
    const t = await f.get();
    assert.deepEqual(open(t)[0].items, ['The file is unreadable', 'Program missing', 'Agy skips "s"', 'Codex skips "s"']);
    assert.deepEqual(t.project_tools.card_names, ['file', 'p', 's']);
    const listed = await sessions.sessionRequest(f.hub, { calling_session: f.made.sessions[0].name, action: 'list' });
    assert.equal(listed.sessions.find((s) => s.role === 'lead').project_tools.problems.length, 4);
    assert.equal(listed.sessions.find((s) => s.role === 'reviewer').project_tools, undefined);
  } finally { await finish(f); }
});

test('more than 20 lines shows and N more; duplicates by text drop', async () => {
  const f = await fixture();
  try {
    const lines = Array.from({ length: 23 }, (_, i) => line(`Problem ${i}`, `s${i}`));
    await f.apply({ project_tools: tools({ programs: [...lines, line('Problem 0', 'dup')] }), created_at: '2026-01-01T00:00:00.000Z' });
    const items = open(await f.get())[0].items;
    assert.equal(items.length, 20 + 1); assert.equal(items.at(-1), 'and 3 more');
  } finally { await finish(f); }
});

test('a line with underscores is kept byte-for-byte in items', async () => {
  const f = await fixture();
  try {
    await f.apply({ project_tools: tools({ programs: [line("_tool_: its program can't be found", 'a')] }), created_at: '2026-01-01T00:00:00.000Z' });
    assert.deepEqual(open(await f.get())[0].items, ["_tool_: its program can't be found"]);
  } finally { await finish(f); }
});

test('seq and boot ordering', async () => {
  const f = await fixture();
  try {
    await f.apply({ project_tools: tools({ seq: 5, programs: [line('five', 'a')] }), created_at: '2026-01-02T00:00:00.000Z' });
    await f.apply({ project_tools: tools({ seq: 3, programs: [line('three', 'a')] }), created_at: '2026-01-03T00:00:00.000Z' });
    let t = await f.get();
    assert.equal(t.project_tools.seq, 5); assert.match(open(t)[0].items[0], /five/);
    await f.apply({ project_tools: tools({ boot: 'b2', seq: 1, programs: [line('newboot', 'a')] }), created_at: '2026-01-02T00:00:00.000Z' });
    t = await f.get();
    assert.equal(t.project_tools.boot, 'b2'); assert.equal(t.project_tools.seq, 1); assert.match(open(t)[0].items[0], /newboot/);
    await f.apply({ project_tools: tools({ boot: 'b3', seq: 9, programs: [line('stale', 'a')] }), created_at: '2026-01-01T00:00:00.000Z' });
    t = await f.get();
    assert.equal(t.project_tools.boot, 'b2'); assert.match(open(t)[0].items[0], /newboot/);
  } finally { await finish(f); }
});

test('project_tools is not left on the session record', async () => {
  const f = await fixture();
  try {
    const started = await f.apply({ project_tools: tools({ programs: [line('x', 'a')] }), created_at: '2026-01-01T00:00:00.000Z' });
    assert.equal(started.project_tools, undefined);
    const t = await f.get();
    assert.ok(t.sessions.every((s) => s.project_tools === undefined));
    // an answer without project_tools changes nothing
    await f.apply({});
    assert.equal(open(await f.get()).length, 1);
  } finally { await finish(f); }
});

test('applied in a queued promotion and in resumeUnanswered, without re-taking the lock', async () => {
  const f = await fixture();
  try {
    // queued promotion
    await settings.update(f.hub, (s) => { s.accounts.forEach((a) => { a.paused = true; }); });
    const thread = await f.get();
    const waiting = { name: 'wc-waiting-1', role: 'reviewer', started_by: f.made.sessions[0].name, token: 't', attempt_id: 'w', queue: [], ready: false, live: true, status: 'waiting', created_at: new Date().toISOString(), pending_start: { role: 'reviewer', started_by: f.made.sessions[0].name, attempt_id: 'w' } };
    thread.sessions.push(waiting);
    await f.hub.save(thread);
    await settings.update(f.hub, (s) => { s.accounts.forEach((a) => { a.paused = false; }); });
    f.pending.answer = { project_tools: tools({ programs: [line('queued problem', 'q')] }), created_at: '2026-01-01T00:00:00.000Z' };
    await within(sessions.retryWaiting(f.hub));
    let t = await f.get();
    assert.match(open(t)[0]?.items[0] || '', /queued problem/);
    assert.ok(t.sessions.every((s) => s.project_tools === undefined));
    // resumeUnanswered
    f.pending.answer = { project_tools: tools({ seq: 2, programs: [line('resumed problem', 'q')] }), created_at: '2026-01-01T00:00:01.000Z' };
    t = await f.get();
    const target = t.sessions.find((s) => s.name === 'wc-waiting-1');
    Object.assign(target, { live: false, status: 'failed' });
    target.unanswered_start = { body: { name: target.name, token: 't', role: 'reviewer' }, first_message: false };
    await f.hub.save(t);
    // The real route finds the unanswered start and resumes it under the thread lock it already holds.
    const again = await within(f.hub.withThread(f.made.id, () => sessions.sessionRequest(f.hub, { calling_session: f.made.sessions[0].name, action: 'start', role: 'reviewer', attempt_id: 'w' })));
    assert.equal(again.duplicate, true);
    t = await f.get();
    assert.match(open(t)[0].items[0], /resumed problem/);
    assert.ok(t.sessions.every((s) => s.project_tools === undefined));
  } finally { await finish(f); }
});

test('default wc.js session list shows project_tools on the lead entry', async () => {
  const cli = path.resolve(__dirname, '../app/wc.js');
  const dir = makeTempSync('ptools-cli ');
  const lead = { name: 'lead', role: 'lead', status: 'running', project_tools: { problems: ['Server "a" is broken'] } };
  const server = http.createServer(async (req, res) => { for await (const _ of req); res.end(JSON.stringify({ sessions: [lead], review_families: 'both' })); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const out = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [cli, 'session', 'list'], { cwd: dir, env: { ...process.env, WHEELCHAIR_MACHINE_URL: `http://127.0.0.1:${server.address().port}`, WHEELCHAIR_SESSION_TOKEN: 'test' } });
      let text = ''; child.stdout.on('data', (d) => { text += d; }); child.on('error', reject);
      child.on('close', (code) => (code ? reject(new Error(`exit ${code}`)) : resolve(JSON.parse(text))));
    });
    assert.deepEqual(out.sessions[0].project_tools, { problems: ['Server "a" is broken'] });
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

test('with two lead sessions only the newest lead carries project_tools in the hub list', async () => {
  const f = await fixture();
  try {
    await f.apply({ project_tools: tools({ programs: [line('lead problem', 'a')] }), created_at: '2026-01-01T00:00:00.000Z' });
    const t = await f.get();
    t.sessions.push({ name: 'wc-second-lead', role: 'lead', live: true, status: 'ready', queue: [], created_at: new Date().toISOString() });
    await f.hub.save(t);
    const listed = await sessions.sessionRequest(f.hub, { calling_session: f.made.sessions[0].name, action: 'list' });
    const leads = listed.sessions.filter((s) => s.role === 'lead');
    assert.equal(leads.length, 2);
    assert.equal(leads[0].project_tools, undefined);
    assert.deepEqual(leads[1].project_tools, { problems: ['lead problem'] });
  } finally { await finish(f); }
});

test('a new thread gets the default project_tools record when the machine start answer has none', async () => {
  const c = await setup();
  try {
    const res = await api(c, '/threads', { method: 'POST', body: { project: '/tmp/ptools-default' } });
    assert.equal(res.status, 201);
    // the fake machine's start answer carries no project_tools
    assert.ok([...c.machine.sessions.values()].every((s) => s.project_tools === undefined));
    const expected = { boot: null, seq: 0, created_at: null, state: null, card: null, card_names: [] };
    assert.deepEqual(res.body.project_tools, expected);
    const saved = await new Hub({ stateDir: c.state }).thread(res.body.id);
    assert.deepEqual(saved.project_tools, expected);
  } finally { await close(c); }
});

test('a handoff import creates a thread with the default project_tools, even when the lead cannot start', async () => {
  const { makeTemp } = require('../../test-support/run-dir.js');
  const ops = require('../app/handoff-ops.js');
  const { defaultProjectTools } = require('../app/threads.js');
  const dir = await makeTemp('ptools-import-');
  const hub = new Hub({ stateDir: dir }); await hub.state.init();
  const id = 'a'.repeat(12);
  const file = { thread: { id, title: 'Title', slug: 'plan' }, head: 'b'.repeat(40), stage: 'approved', exported_at: 'date', history: [] };
  hub.client.handoff = async (_, input) => ({ inspect: { worktree_exists: false }, known: { checked_out: [] }, 'claim-commit': { sha: 'c'.repeat(40) }, 'claim-push': { result: 'landed' }, running: { names: [] }, 'set-branch': { result: 'ok' }, reopen: { ok: true } })[input.action];
  hub.restartLead = async () => { throw new Error('machine unavailable'); };
  const result = await hub.withThread(id, () => ops.createLocked(hub, { file, machine: 'hub', project: '/repo' }));
  assert.equal(result.outcome, 'created');
  await hub.restartLead(id).catch(() => {});
  const thread = await hub.thread(id);
  assert.deepEqual(thread.project_tools, defaultProjectTools());
  assert.deepEqual(thread.project_tools, { boot: null, seq: 0, created_at: null, state: null, card: null, card_names: [] });
});

test('dismissed project tools card stays closed until problem names change', async () => {
  const f = await fixture();
  try {
    await f.apply({ project_tools: tools({ programs: [line('first', 'a')] }) });
    let t = await f.get(); const id = open(t)[0].id;
    assert.equal((await api(f.c, `/threads/${f.made.id}/cards/${id}/dismiss`, { method: 'POST', body: {} })).status, 200);
    await f.apply({ project_tools: tools({ seq: 2, programs: [line('changed text', 'a')] }) });
    t = await f.get(); assert.equal(open(t).length, 0); assert.equal(t.project_tools.seq, 2);
    assert.equal(t.project_tools.state.programs[0].text, 'changed text'); assert.equal(t.project_tools.card, id);
    await f.apply({ project_tools: tools({ seq: 3, programs: [line('new name', 'b')] }) });
    t = await f.get(); assert.equal(open(t).length, 1); assert.notEqual(open(t)[0].id, id);
  } finally { await finish(f); }
});

test('keyed lines survive another start and leave when their session stops', async () => {
  const f = await fixture();
  try {
    const name = f.made.sessions[0].name;
    const keyed = { [name]: [line('keyed unavailable', 'weather')] };
    await f.apply({ project_tools: tools({ keyed }) });
    assert.deepEqual(open(await f.get())[0].items, ['keyed unavailable']);
    await f.apply({ project_tools: tools({ seq: 2, keyed, clis: { claude: { lines: [line('Claude problem', 'other')] } } }) });
    assert.deepEqual(open(await f.get())[0].items, ['Claude problem', 'keyed unavailable']);
    await f.hub.withThread(f.made.id, async () => {
      const t = await f.get();
      await sessions.stopManagedSession(f.hub, t, t.sessions.find((s) => s.name === name));
    });
    assert.deepEqual(open(await f.get())[0].items, ['Claude problem']);
    await f.apply({ project_tools: tools({ seq: 3, keyed }) });
    assert.equal(open(await f.get()).length, 0);
  } finally { await finish(f); }
});

test('ended and malformed keyed entries do not appear', () => {
  const t = { sessions: [{ name: 'ended', live: false, ended_at: 'now' }], cards: [] };
  sessions.applyProjectTools(t, { project_tools: tools({ keyed: { ended: [line('old', 'a')] } }) });
  assert.equal(open(t).length, 0);
  t.sessions.push({ name: 'live', live: true });
  sessions.applyProjectTools(t, { project_tools: tools({ seq: 2, keyed: { live: 'bad' } }) });
  assert.deepEqual(t.project_tools.state.keyed, {});
  assert.equal(open(t).length, 0);
});

test('dismissal covers shown keyed texts and prioritizes new text across later starts', async () => {
  const f = await fixture();
  try {
    const name = f.made.sessions[0].name;
    const old = line('old keyed', 'a');
    const programs = Array.from({ length: 22 }, (_, i) => line(`problem ${i}`, 'a'));
    await f.apply({ project_tools: tools({ programs: [old, ...programs], keyed: { [name]: [old] } }) });
    let t = await f.get(); const id = open(t)[0].id;
    assert.equal((await api(f.c, `/threads/${f.made.id}/cards/${id}/dismiss`, { method: 'POST', body: {} })).status, 200);
    await f.apply({ project_tools: tools({ seq: 2, programs: [old, ...programs], keyed: { [name]: [old] } }) });
    assert.equal(open(await f.get()).length, 0);
    const fresh = line('new keyed', 'a');
    await f.apply({ project_tools: tools({ seq: 3, programs: [old, ...programs], keyed: { [name]: [old, fresh] } }) });
    t = await f.get();
    assert.equal(open(t)[0].items[0], 'new keyed');
    assert.equal(open(t)[0].items.at(-1), 'and 4 more');
    await f.apply({ project_tools: tools({ seq: 4, programs: [old, ...programs], clis: { claude: { lines: [line('another start', 'a')] } }, keyed: { [name]: [old, fresh] } }) });
    t = await f.get();
    assert.equal(open(t)[0].items[0], 'new keyed');
    assert.equal(open(t)[0].items.at(-1), 'and 5 more');
  } finally { await finish(f); }
});

test('stopping the only session with a keyed problem closes the card', async () => {
  const f = await fixture();
  try {
    const name = f.made.sessions[0].name;
    await f.apply({ project_tools: tools({ keyed: { [name]: [line('only keyed', 'a')] } }) });
    assert.equal(open(await f.get()).length, 1);
    await f.hub.withThread(f.made.id, async () => {
      const t = await f.get();
      await sessions.stopManagedSession(f.hub, t, t.sessions.find((s) => s.name === name));
    });
    assert.equal(open(await f.get()).length, 0);
  } finally { await finish(f); }
});
