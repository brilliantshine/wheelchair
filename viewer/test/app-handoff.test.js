'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { historyText, buildHandoffFile, validateHandoffFile, handoffFileName } = require('../app/handoff.js');
const at = '2026-11-17T12:00:00.000Z';
const id = 'abcdef123456';
function sample() { return buildHandoffFile({ id, title: 'A'.repeat(120), slug: 'a-plan', sent: [], cards: [] }, { head: 'a'.repeat(40), stage: 'approved', repository: 'github.com/owner/repo' }); }
function valid(value) { return validateHandoffFile(JSON.stringify(value)).ok; }
test('handoff validator checks schema, limits and unknown fields', () => {
  const file = sample();
  assert.equal(valid(file), true);
  assert.equal(validateHandoffFile('{').ok, false);
  for (const edit of [
    (f) => { f.thread.id = 'bad'; }, (f) => { f.version = 2; }, (f) => { f.extra = 1; },
    (f) => { f.thread.extra = 1; }, (f) => { f.history = [{ at, who: 'lead', kind: 'question', text: 'x', extra: 1 }]; },
    (f) => { f.history = [{ at, who: 'nobody', kind: 'question', text: 'x' }]; },
    (f) => { f.branch = 'wc/other'; }, (f) => { f.pr_url = 'url'; }, (f) => { f.stage = 'done'; },
  ]) { const changed = structuredClone(file); edit(changed); assert.equal(valid(changed), false); }
  assert.equal(validateHandoffFile(' '.repeat(10 * 1024 * 1024 + 1)).ok, false);
  file.stage = 'done'; file.pr_url = 'https://github.com/owner/repo/pull/1'; assert.equal(valid(file), true);
});
test('history renders shown cards and skips hidden and progress cards', () => {
  const cases = [
    [{ kind: 'question', question: 'Why?', options: [{ label: 'Yes' }], answered_value: 'Yes' }, ['Why?', 'Yes']],
    [{ kind: 'idea', bullets: [{ text: 'A' }] }, ['A']],
    [{ kind: 'approval', objections: [{ finding: 'F', reason: 'R' }], answered_action: 'start-building' }, ['F', 'R', 'start-building']],
    [{ kind: 'done', title: 'Done', can_do: ['C'], left_as_is: ['L'], pr_url: 'P' }, ['Done', 'C', 'L', 'P']],
    [{ kind: 'needs', title: 'N', body: 'B' }, ['N', 'B']],
    [{ kind: 'offer', summary: 'S', retracted_at: at }, ['S', 'withdrawn']],
    ...['stub', 'diagram', 'image'].map((kind) => [{ kind, title: 'T' }, ['T']]),
    [{ kind: 'sudo', command: 'cmd', state: 'ran', exit_code: 0 }, ['cmd', 'ran', 'exit 0']],
  ];
  for (const [card, parts] of cases) for (const part of parts) assert.match(historyText(card), new RegExp(part));
  assert.equal(historyText({ kind: 'progress' }), null); assert.equal(historyText({ kind: 'result' }), null);
});
test('history accumulates, orders and trims entries, and names downloads', () => {
  const old = '2026-11-16T12:00:00.000Z';
  const thread = { id, title: 'A title!', slug: 'plan', imported: { at: old, history: [{ at: old, who: 'lead', kind: 'message', text: 'prior' }] }, sent: [{ at: old, source: 'collin', text: 'excluded' }, { at, source: 'card', text: 'pressed' }], cards: [{ at, kind: 'needs', title: 'Notice', body: 'X'.repeat(21000) }, { at, kind: 'progress' }] };
  let file = buildHandoffFile(thread, { head: 'a'.repeat(40), stage: 'approved', repository: 'github.com/owner/repo' });
  assert.equal(file.history.length, 3); assert.equal(file.history[0].text, 'prior'); assert.equal(file.history[1].kind, 'press'); assert.match(file.history[2].text, /… \(cut\)$/); assert.ok(valid(file));
  thread.sent = Array.from({ length: 2100 }, (_, i) => ({ at, source: 'collin', text: String(i) })); thread.cards = [];
  file = buildHandoffFile(thread, { head: 'a'.repeat(40), stage: 'approved', repository: 'github.com/owner/repo' });
  assert.equal(file.history.length, 2000); assert.match(file.history[0].text, /102 earlier entries/); assert.ok(valid(file));
  thread.sent = Array.from({ length: 600 }, () => ({ at, source: 'collin', text: '😀'.repeat(10000) }));
  file = buildHandoffFile(thread, { head: 'a'.repeat(40), stage: 'approved', repository: 'github.com/owner/repo' });
  assert.ok(Buffer.byteLength(JSON.stringify(file)) <= 10 * 1024 * 1024); assert.match(file.history[0].text, /earlier entries/); assert.ok(valid(file));
  assert.equal(handoffFileName('Hello, WORLD!'), 'hello-world.wheelchair.json'); assert.equal(handoffFileName('!!!'), 'thread.wheelchair.json'); assert.equal(handoffFileName('a'.repeat(120)), `${'a'.repeat(60)}.wheelchair.json`);
});

test('machine client sends scripted handoff actions and times out', async (t) => {
  const { startMachine } = require('./helpers/app-machine.js');
  const { MachineClient } = require('../app/machine-client.js');
  const machine = await startMachine();
  t.after(() => machine.stop());
  const client = new MachineClient({ machine: async () => ({ port: machine.port, secret: machine.secret }) });
  machine.handoffReplies.status = [(input) => ({ head: input.thread_id }), { head: 'second' }];
  assert.deepEqual(await client.handoff('hub', { action: 'status', thread_id: id, project: '/repo' }), { head: id });
  assert.deepEqual(await client.handoff('hub', { action: 'status', thread_id: id }), { head: 'second' });
  assert.equal(machine.calls.filter((call) => call.path === '/v1/handoff').length, 2);
  machine.handoffReplies.inspect = async () => { await new Promise((resolve) => setTimeout(resolve, 50)); return { remote_tip: 'x' }; };
  client.handoffTimeout = 10;
  await assert.rejects(client.handoff('hub', { action: 'inspect', thread_id: id }), /The machine didn't answer in time/);
});

test('export reasons follow their order and committed stopping points', () => {
  const { exportReason, quietReason, stageFor } = require('../app/handoff.js');
  const hub = { runningHandoffOps: new Set(), uploadsInFlight: new Map() };
  const thread = { id, sessions: [{ name: 'lead', role: 'lead', live: false, queue: [] }], cards: [], asides: [] };
  const status = { repository: 'github.com/owner/repo', branch: `wc/${id}`, idea_status: 'confirmed', plan_status: null, map_committed: true, head: 'a', remote_tip: 'a' };
  const reason = () => exportReason(hub, thread, status, { pressed: true });
  assert.equal(reason(), null);
  thread.archived = true; assert.equal(reason(), "Archived threads can't be exported"); delete thread.archived;
  thread.handed_off = {}; assert.equal(reason(), 'Already handed off'); delete thread.handed_off;
  thread.handoff_op = {}; assert.equal(reason(), "An import or undo didn't finish"); delete thread.handoff_op;
  thread.cards.push({ kind: 'merged' }); assert.match(reason(), /merged or closed/); thread.cards = [];
  status.repository = null; assert.match(reason(), /origin isn't on GitHub/); status.repository = 'github.com/owner/repo';
  thread.asides.push({ status: 'open' }); assert.equal(reason(), 'Agents are still working'); thread.asides = [];
  thread.sessions.push({ role: 'worker', live: true }); assert.equal(reason(), 'Agents are still working'); thread.sessions.pop();
  thread.sessions[0].queue.push({}); assert.equal(reason(), 'The lead is busy'); thread.sessions[0].queue = [];
  thread.sessions.push({ role: 'worker', live: false, queue: [{}] }); assert.equal(reason(), null); thread.sessions.pop();
  thread.sessions[0].live = true; thread.sessions[0].turn_ended = false; assert.equal(quietReason(hub, thread), 'The lead is busy'); thread.sessions[0].turn_ended = true;
  thread.cards.push({ kind: 'sudo', state: 'running' }); assert.equal(reason(), 'A root command is waiting'); thread.cards = [];
  hub.uploadsInFlight.set(id, 1); assert.equal(reason(), 'A file is still uploading'); hub.uploadsInFlight.clear();
  status.dirty = true; assert.equal(reason(), "Some changes aren't committed yet"); status.dirty = false;
  status.map_committed = false; assert.match(reason(), /Not at a stopping point/); status.map_committed = true;
  thread.cards.push({ id: 'a', kind: 'question', doc: 'IDEA.md', answered: true, at });
  thread.cards.push({ id: 'b', kind: 'question', answered: true, at: '2026-11-18T12:00:00.000Z' });
  assert.equal(stageFor(thread, status), null); thread.cards[1].retracted_at = at; assert.equal(stageFor(thread, status), 'idea-confirmed');
  status.plan_status = 'done'; thread.cards.push({ kind: 'done', pr_url: 'url' }); status.remote_tip = 'b'; assert.equal(reason(), 'A fix is still being checked');
  status.remote_tip = 'a'; status.pr_state = 'CLOSED'; assert.match(reason(), /merged or closed/);
});

test('frozen threads refuse mutation entry points and never deliver queued work', async () => {
  const { setup, close, api, machinePost, thread: makeThread } = require('./helpers/app.js');
  const { Hub } = require('../app/hub.js');
  const c = await setup();
  try {
    const made = await makeThread(c); const lead = made.sessions[0];
    const hub = new Hub({ stateDir: c.state });
    for (const field of ['handed_off', 'handoff_op']) {
      const current = await hub.thread(made.id);
      current[field] = {}; current.sessions[0].queue = [{ text: 'waiting', source: 'collin', at }]; current.sessions[0].ready = true; current.sessions[0].turn_ended = true;
      await hub.save(current);
      const expected = field === 'handed_off' ? 'handed off' : 'Retry the unfinished import first';
      for (const [route, body] of [
        [`/threads/${made.id}/messages`, { text: 'hi' }], [`/threads/${made.id}/send-now`, { at }],
        [`/threads/${made.id}/cards/no/press`, { action: 'picked', value: 'x' }], [`/threads/${made.id}/cards/no/dismiss`, {}],
        [`/threads/${made.id}/restart`, {}], [`/threads/${made.id}/asides`, {}], [`/threads/${made.id}/asides/no/messages`, { text: 'hi' }],
        [`/sessions/${lead.name}/keys`, { keys: 'Enter' }],
      ]) { const response = await api(c, route, { method: 'POST', body }); assert.equal(response.status, 409, route); assert.equal(response.body.detail, expected); }
      const posted = await machinePost(c, '/machine/cards', { thread_id: made.id, session: lead.name, kind: 'title', title: 'x' }); assert.equal(posted.status, 409); assert.equal(posted.body.detail, expected);
      const start = await machinePost(c, '/machine/session', { calling_session: lead.name, action: 'start', role: 'worker', attempt_id: 'frozen', brief: 'x' }); assert.equal(start.status, 409); assert.equal(start.body.detail, expected);
      const upload = await fetch(`${c.server.url}/api/threads/${made.id}/uploads?name=x`, { method: 'POST', headers: { 'x-graph-token': c.server.token, origin: new URL(c.server.url).origin }, body: 'hi' }); assert.equal(upload.status, 409);
      if (field === 'handoff_op') { const archived = await api(c, `/threads/${made.id}/archive`, { method: 'POST', body: {} }); assert.equal(archived.status, 409); assert.equal(archived.body.detail, expected); }
      const frozen = await hub.thread(made.id); const target = frozen.sessions[0];
      const before = target.queue.length; await hub.enqueue(frozen, target.name, 'discarded', 'app'); assert.equal(target.queue.length, before); assert.equal(await hub.deliver(frozen, target.name), false);
      frozen.sessions[0].limited_until = '2000-01-01T00:00:00.000Z'; await hub.save(frozen);
      await require('../app/sessions.js').releaseLimits(hub);
      assert.equal((await hub.thread(made.id)).sessions[0].queue.length, before);
      delete frozen[field]; await hub.save(frozen);
    }
    const archivedThread = await hub.thread(made.id); archivedThread.handed_off = {}; await hub.save(archivedThread);
    assert.equal((await api(c, `/threads/${made.id}/archive`, { method: 'POST', body: {} })).status, 200);
  } finally { await close(c); }
});
