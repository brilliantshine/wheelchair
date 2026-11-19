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
    assert.match(open(t)[0].body, /^Some project tools won't work for agents in this thread:\n• Server "a" needs x, not found$/);
    assert.equal(open(t)[0].kind, 'needs'); assert.equal(open(t)[0].system, true);
    await f.apply({ project_tools: tools({ seq: 2, programs: [line('Server "a" other text', 'a')] }), created_at: '2026-01-01T00:00:01.000Z' });
    t = await f.get();
    assert.equal(open(t).length, 1); assert.equal(open(t)[0].id, id); assert.match(open(t)[0].body, /other text/);
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
    const body = open(t)[0].body.split('\n');
    assert.deepEqual(body.slice(1), ['• The file is unreadable', '• Program missing', '• Agy skips "s"', '• Codex skips "s"']);
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
    const body = open(await f.get())[0].body.split('\n');
    assert.equal(body.length, 1 + 20 + 1); assert.equal(body.at(-1), 'and 3 more');
  } finally { await finish(f); }
});

test('seq and boot ordering', async () => {
  const f = await fixture();
  try {
    await f.apply({ project_tools: tools({ seq: 5, programs: [line('five', 'a')] }), created_at: '2026-01-02T00:00:00.000Z' });
    await f.apply({ project_tools: tools({ seq: 3, programs: [line('three', 'a')] }), created_at: '2026-01-03T00:00:00.000Z' });
    let t = await f.get();
    assert.equal(t.project_tools.seq, 5); assert.match(open(t)[0].body, /five/);
    await f.apply({ project_tools: tools({ boot: 'b2', seq: 1, programs: [line('newboot', 'a')] }), created_at: '2026-01-02T00:00:00.000Z' });
    t = await f.get();
    assert.equal(t.project_tools.boot, 'b2'); assert.equal(t.project_tools.seq, 1); assert.match(open(t)[0].body, /newboot/);
    await f.apply({ project_tools: tools({ boot: 'b3', seq: 9, programs: [line('stale', 'a')] }), created_at: '2026-01-01T00:00:00.000Z' });
    t = await f.get();
    assert.equal(t.project_tools.boot, 'b2'); assert.match(open(t)[0].body, /newboot/);
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
    assert.match(open(t)[0]?.body || '', /queued problem/);
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
    assert.match(open(t)[0].body, /resumed problem/);
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
