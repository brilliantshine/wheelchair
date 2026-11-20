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
    (f) => { f.thread.id = 'bad'; }, (f) => { f.version = 3; }, (f) => { f.extra = 1; },
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
    [{ kind: 'needs', title: 'N', body: 'B', items: ['_tool_: x', 'and 3 more'] }, ['N', 'B', '_tool_: x', 'and 3 more']],
    [{ kind: 'offer', summary: 'S', retracted_at: at }, ['S', 'withdrawn']],
    ...['stub', 'diagram', 'image'].map((kind) => [{ kind, title: 'T' }, ['T']]),
    [{ kind: 'sudo', command: 'cmd', state: 'ran', exit_code: 0 }, ['cmd', 'ran', 'exit 0']],
  ];
  for (const [card, parts] of cases) for (const part of parts) assert.match(historyText(card), new RegExp(part));
  assert.match(historyText({ kind: 'question', question: 'Open?', options: [] }), /withdrawn/);
  assert.equal(historyText({ kind: 'progress' }), null); assert.equal(historyText({ kind: 'result' }), null);
});
test('history accumulates, orders and trims entries, and names downloads', () => {
  const old = '2026-11-16T12:00:00.000Z';
  const thread = { id, title: 'A title!', slug: 'plan', imported: { at: old, history: [{ at: old, who: 'lead', kind: 'message', text: 'prior' }] }, sent: [{ at: old, source: 'user', text: 'excluded' }, { at, source: 'card', text: 'pressed' }], cards: [{ at, kind: 'needs', title: 'Notice', body: 'X'.repeat(21000) }, { at, kind: 'progress' }] };
  let file = buildHandoffFile(thread, { head: 'a'.repeat(40), stage: 'approved', repository: 'github.com/owner/repo' });
  assert.equal(file.history.length, 3); assert.equal(file.history[0].text, 'prior'); assert.equal(file.history[1].kind, 'press'); assert.match(file.history[2].text, /… \(cut\)$/); assert.ok(valid(file));
  thread.sent = Array.from({ length: 2100 }, (_, i) => ({ at, source: 'user', text: String(i) })); thread.cards = [];
  file = buildHandoffFile(thread, { head: 'a'.repeat(40), stage: 'approved', repository: 'github.com/owner/repo' });
  assert.equal(file.history.length, 2000); assert.match(file.history[0].text, /102 earlier entries/); assert.ok(valid(file));
  thread.sent = Array.from({ length: 600 }, () => ({ at, source: 'user', text: '😀'.repeat(10000) }));
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
  status.plan_status = 'done'; status.pr_state = 'OPEN'; thread.cards.push({ kind: 'done', pr_url: 'url' }); status.remote_tip = 'b'; assert.equal(reason(), 'A fix is still being checked');
  status.remote_tip = 'a'; status.pr_state = 'CLOSED'; assert.equal(reason(), 'The pull request is merged or closed; nothing left to hand off');
  status.pr_state = null; status.pr_error = 'gh: not authenticated'; assert.equal(reason(), "Couldn't check the pull request");
  delete status.pr_error; assert.equal(reason(), "Couldn't check the pull request");
  status.pr_state = 'OPEN'; status.pr_error = 'gh: not authenticated'; assert.equal(reason(), "Couldn't check the pull request");
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
      current.cards.push({ id: 'real-question', kind: 'question', question: 'Ready?', options: [], answered: false, at });
      current.cards.push({ id: 'real-needs', kind: 'needs', title: 'Help', body: 'Help', answered: false, at });
      current[field] = {}; current.sessions[0].queue = [{ text: 'waiting', source: 'user', at }]; current.sessions[0].ready = true; current.sessions[0].turn_ended = true;
      await hub.save(current);
      const expected = field === 'handed_off' ? 'handed off' : 'Retry the unfinished import first';
      for (const [route, body] of [
        [`/threads/${made.id}/messages`, { text: 'hi' }], [`/threads/${made.id}/send-now`, { at }],
        [`/threads/${made.id}/cards/real-question/press`, { action: 'picked', value: 'x' }], [`/threads/${made.id}/cards/real-needs/dismiss`, {}],
        [`/threads/${made.id}/restart`, {}], [`/threads/${made.id}/open`, {}], [`/threads/${made.id}/asides`, {}], [`/threads/${made.id}/asides/no/messages`, { text: 'hi' }],
        ...['close', 'retry', 'think-harder', 'summary'].map((action) => [`/threads/${made.id}/asides/no/${action}`, {}]),
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
      assert.equal((await hub.thread(made.id)).sessions[0].limited_until, '2000-01-01T00:00:00.000Z');
      await hub.event({ thread_id: made.id, session: target.name, type: 'limit-hit', limited_until: '2000-01-01T00:00:00.000Z' });
      assert.equal((await hub.thread(made.id)).sessions[0].queue.length, before);
      delete frozen[field]; await hub.save(frozen);
    }
    const archivedThread = await hub.thread(made.id); archivedThread.handed_off = {}; await hub.save(archivedThread);
    assert.equal((await api(c, `/threads/${made.id}/archive`, { method: 'POST', body: {} })).status, 200);
  } finally { await close(c); }
});

async function exportFixture(stage = 'approved') {
  const { Hub } = require('../app/hub.js');
  const { makeTemp } = require('../../test-support/run-dir.js');
  const hub = new Hub({ stateDir: await makeTemp('handoff-'), codeVersion: '' }); await hub.state.init();
  const thread = { id, title: 'A'.repeat(120), slug: 'plan', project: '/repo', machine: 'hub', worktree: '/work', sessions: [{ name: 'lead', role: 'lead', live: true, ready: true, turn_ended: true, queue: [] }], cards: [], asides: [], queues: {}, pinned: {}, sent: [] };
  const status = { dirty: false, branch: `wc/${id}`, head: 'a'.repeat(40), repository: 'github.com/owner/repo', idea_status: 'confirmed', map_committed: true, plan_status: stage === 'idea-confirmed' ? null : stage, remote_tip: 'a'.repeat(40), pr_state: 'OPEN' };
  if (stage === 'done') thread.cards.push({ kind: 'done', title: 'done', can_do: [], left_as_is: [], pr_url: 'https://github.com/owner/repo/pull/1', at, created_at: at });
  const calls = [];
  hub.client.handoff = async (machine, request) => { calls.push(request); return request.action === 'status' ? status : { head: status.head, repository: status.repository }; };
  hub.call = async (machine, route) => { calls.push({ route }); return {}; };
  await hub.save(thread);
  return { hub, thread, status, calls };
}
test('exports each stopping point, validates before pushing and freezes the thread', async () => {
  for (const stage of ['idea-confirmed', 'approved', 'done']) {
    const { hub, calls } = await exportFixture(stage);
    const result = await hub.exportThread(id);
    const checked = validateHandoffFile(result.bytes); assert.equal(checked.ok, true); assert.equal(checked.file.stage, stage);
    assert.equal(result.filename, `${'a'.repeat(60)}.wheelchair.json`);
    assert.equal((await hub.thread(id)).handed_off.head, checked.file.head);
    assert.equal((await hub.thread(id)).sessions[0].live, false);
    assert.deepEqual(calls.filter((call) => call.action).map((call) => call.action), ['status', 'push']);
    assert.ok(calls.some((call) => call.route?.endsWith('/lead')));
  }
  const { hub, calls } = await exportFixture(); const thread = await hub.thread(id); thread.title = 'x'.repeat(121); await hub.save(thread);
  await assert.rejects(hub.exportThread(id), /Could not build/); assert.deepEqual(calls.map((call) => call.action), ['status']);
});
test('push and save failures preserve retryability; a saved handoff survives lost save reply', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path');
  for (const mode of ['push', 'before', 'after', 'stop']) {
    const { hub, status } = await exportFixture(); const originalSave = hub.save.bind(hub);
    if (mode === 'push') hub.client.handoff = async (machine, request) => request.action === 'status' ? status : { result: 'failed', error: 'rejected' };
    if (mode === 'before') hub.save = async (thread) => { if (thread.handed_off) throw new Error('before'); return originalSave(thread); };
    if (mode === 'after') { let once = true; hub.save = async (thread) => { if (thread.handed_off && once) { once = false; await originalSave(thread); throw new Error('after'); } return originalSave(thread); }; }
    if (mode === 'stop') hub.call = async () => { throw new Error('stop failed'); };
    if (mode === 'push' || mode === 'before') {
      await assert.rejects(hub.exportThread(id), mode === 'push' ? /Couldn't push/ : /export didn't finish/);
      assert.equal((await hub.thread(id)).handed_off, undefined);
      await assert.rejects(fs.stat(path.join(hub.stateDir, 'handoffs', `${id}.json.new`)), { code: 'ENOENT' });
      hub.save = originalSave; hub.client.handoff = async (machine, request) => request.action === 'status' ? status : { head: status.head, repository: status.repository };
      assert.ok((await hub.exportThread(id)).bytes.length);
    } else {
      assert.ok((await hub.exportThread(id)).bytes.length); assert.ok((await hub.thread(id)).handed_off);
    }
  }
});

test('export route returns a downloadable JSON file', async () => {
  const { setup, close, thread: makeThread } = require('./helpers/app.js'); const { Hub } = require('../app/hub.js');
  const c = await setup();
  try {
    const made = await makeThread(c); const hub = new Hub({ stateDir: c.state }); const thread = await hub.thread(made.id);
    thread.slug = 'plan'; thread.title = 'My plan'; thread.sessions[0].turn_ended = true; thread.sessions[0].queue = []; await hub.save(thread);
    c.machine.handoffReplies.status = { dirty: false, branch: `wc/${made.id}`, head: 'a'.repeat(40), repository: 'github.com/owner/repo', plan_status: 'approved' };
    c.machine.handoffReplies.push = { head: 'a'.repeat(40), repository: 'github.com/owner/repo' };
    const response = await fetch(`${c.server.url}/api/threads/${made.id}/export`, { method: 'POST', headers: { 'x-graph-token': c.server.token, origin: new URL(c.server.url).origin } });
    assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'application/json'); assert.equal(response.headers.get('content-disposition'), 'attachment; filename="my-plan.wheelchair.json"'); assert.equal(validateHandoffFile(await response.text()).ok, true);
  } finally { await close(c); }
});

test('export route reports a failed PR check without pushing', async () => {
  const { setup, close, api, thread: makeThread } = require('./helpers/app.js'); const { Hub } = require('../app/hub.js');
  const c = await setup();
  try {
    const made = await makeThread(c); const hub = new Hub({ stateDir: c.state }); const thread = await hub.thread(made.id);
    thread.cards.push({ kind: 'done', pr_url: 'https://github.com/owner/repo/pull/1', at }); await hub.save(thread);
    c.machine.handoffReplies.status = { branch: `wc/${made.id}`, repository: 'github.com/owner/repo', plan_status: 'done', pr_state: null, pr_error: 'gh: not authenticated' };
    const response = await api(c, `/threads/${made.id}/export`, { method: 'POST', body: {} });
    assert.equal(response.status, 409); assert.equal(response.body.detail, "Couldn't check the pull request");
    assert.equal(c.machine.calls.some((call) => call.path === '/v1/handoff' && call.body?.action === 'push'), false);
  } finally { await close(c); }
});

test('banner reports remote states and caches inspection', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path');
  const { hub } = await exportFixture(); await hub.exportThread(id); const thread = await hub.thread(id); let calls = 0;
  hub.client.handoff = async () => { calls++; return { remote_tip: thread.handed_off.head }; };
  assert.equal((await hub.handoffBanner(id)).state, 'unchanged'); assert.equal((await hub.handoffBanner(id)).state, 'unchanged'); assert.equal(calls, 1);
  hub.handoffInspect.clear(); hub.client.handoff = async () => ({ remote_tip: 'b'.repeat(40), picked_up_at: at });
  assert.deepEqual(await hub.handoffBanner(id), { state: 'moved', at: thread.handed_off.at, picked_up_at: at });
  await fs.writeFile(path.join(hub.stateDir, 'revoke.json'), JSON.stringify([{ thread_id: id, sha: 'b'.repeat(40) }]));
  hub.handoffInspect.clear(); assert.equal((await hub.handoffBanner(id)).state, 'own-cancelled');
  hub.handoffInspect.clear(); hub.client.handoff = async () => { throw new Error('offline'); }; assert.equal((await hub.handoffBanner(id)).state, 'inspect-failed');
});
test('download recovery selects matching head, and startup sweeps stray files', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path');
  const { hub } = await exportFixture(); const result = await hub.exportThread(id); const dir = path.join(hub.stateDir, 'handoffs'); const base = path.join(dir, `${id}.json`);
  const old = JSON.parse(result.bytes); old.head = 'b'.repeat(40); await fs.writeFile(base, JSON.stringify(old)); await fs.writeFile(`${base}.new`, result.bytes);
  assert.equal(JSON.parse((await hub.handoffFile(id)).bytes).head, 'a'.repeat(40));
  await fs.writeFile(`${base}.new`, result.bytes); await fs.writeFile(path.join(dir, 'stray.json'), '{}'); await fs.writeFile(path.join(dir, 'stray.json.new'), '{}');
  const op = await hub.thread(id); op.id = '123456abcdef'; delete op.handed_off; op.handoff_op = {}; await hub.save(op); await fs.writeFile(path.join(dir, `${op.id}.json`), '{}');
  await hub.init();
  assert.equal(JSON.parse(await fs.readFile(base)).head, 'a'.repeat(40));
  await assert.rejects(fs.stat(`${base}.new`), { code: 'ENOENT' }); await assert.rejects(fs.stat(path.join(dir, 'stray.json')), { code: 'ENOENT' }); await assert.rejects(fs.stat(path.join(dir, 'stray.json.new')), { code: 'ENOENT' }); assert.ok(await fs.stat(path.join(dir, `${op.id}.json`)));
});
test('download waits for export to finish its rename', async () => {
  const { hub, status } = await exportFixture(); let release; let pushed;
  const started = new Promise((resolve) => { pushed = resolve; }); const gate = new Promise((resolve) => { release = resolve; });
  hub.client.handoff = async (machine, request) => { if (request.action === 'status') return status; pushed(); await gate; return { head: status.head, repository: status.repository }; };
  const exporting = hub.exportThread(id); await started; const downloading = hub.handoffFile(id); release();
  const [exported, downloaded] = await Promise.all([exporting, downloading]); assert.ok(exported.bytes.equals(downloaded.bytes));
});

test('an admitted upload blocks export until its stream completes', async () => {
  const http = require('node:http'); const { setup, close, api, thread: makeThread } = require('./helpers/app.js'); const { Hub } = require('../app/hub.js');
  const c = await setup();
  try {
    const made = await makeThread(c); const hub = new Hub({ stateDir: c.state }); const thread = await hub.thread(made.id);
    thread.slug = 'plan'; thread.sessions[0].turn_ended = true; thread.sessions[0].queue = []; await hub.save(thread);
    c.machine.handoffReplies.status = { dirty: false, branch: `wc/${made.id}`, head: 'a'.repeat(40), repository: 'github.com/owner/repo', plan_status: 'approved' };
    const target = new URL(`${c.server.url}/api/threads/${made.id}/uploads?name=part`);
    let finish; const completed = new Promise((resolve, reject) => { finish = http.request(target, { method: 'POST', headers: { 'x-graph-token': c.server.token, origin: new URL(c.server.url).origin, 'content-length': 4 } }, (response) => { response.resume(); response.on('end', resolve); }); finish.on('error', reject); });
    finish.write('ab');
    let view;
    for (let i = 0; i < 100; i++) { view = await api(c, `/threads/${made.id}/chat`); if (view.body.thread.export.reason === 'A file is still uploading') break; await new Promise((resolve) => setTimeout(resolve, 10)); }
    assert.equal(view.body.thread.export.reason, 'A file is still uploading'); finish.end('cd'); await completed;
  } finally { await close(c); }
});

test('page status refresh is background, cached, skips archived and handed-off threads and retains prior results', async () => {
  const { hub, status } = await exportFixture('done'); const calls = []; let release;
  const gate = new Promise((resolve) => { release = resolve; });
  hub.client.handoff = async (machine, input) => { calls.push(input); await gate; return status; };
  const first = await hub.chat(id); assert.equal(first.thread.export.ok, false);
  assert.equal(calls.length, 1); assert.equal(Object.hasOwn(calls[0], 'pr_url'), false);
  await hub.withThread(id, async () => {}); // status is still waiting, without owning the lock
  await hub.chat(id); assert.equal(calls.length, 1);
  release();
  for (let i = 0; i < 100 && !hub.handoffStatus.has(id); i++) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(hub.handoffStatus.get(id), status);
  hub.handoffStatusAt.set(id, Date.now() - 61_000);
  hub.client.handoff = async () => { calls.push({ failed: true }); throw new Error('offline'); };
  const view = await hub.chat(id); assert.equal(view.thread.export.ok, true); await new Promise((resolve) => setImmediate(resolve));
  assert.equal(hub.handoffStatus.get(id), status); await hub.chat(id); assert.equal(calls.length, 2);
  for (const field of ['archived', 'handed_off']) {
    const thread = await hub.thread(id); thread[field] = field === 'archived' ? true : { head: status.head, at }; await hub.save(thread);
    hub.handoffStatusAt.delete(id); await hub.chat(id); assert.equal(calls.length, 2);
    delete thread[field]; await hub.save(thread);
  }
});

test('export cancels asides found after the quiet check', async () => {
  const { hub, status, calls } = await exportFixture();
  const originalThread = hub.thread.bind(hub); const shared = await originalThread(id);
  hub.thread = async () => shared;
  hub.client.handoff = async (machine, request) => {
    if (request.action === 'status') return status;
    shared.asides.push({ status: 'open', turn: { id: 'aside-turn' }, pending: [{ text: 'queued' }] });
    return { head: status.head, repository: status.repository };
  };
  await hub.exportThread(id);
  assert.equal(shared.asides[0].status, 'closed'); assert.equal(shared.asides[0].turn, null); assert.deepEqual(shared.asides[0].pending, []);
  assert.ok(calls.some((call) => call.route === '/v1/aside-turns/aside-turn'));
});

test('handoff banner HTTP route reports each state and the thread list marks handoff', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path');
  const { setup, close, api, thread: makeThread } = require('./helpers/app.js'); const { Hub } = require('../app/hub.js');
  const c = await setup();
  try {
    const made = await makeThread(c); const hub = new Hub({ stateDir: c.state });
    for (const [index, state] of ['unchanged', 'moved', 'inspect-failed', 'own-cancelled'].entries()) {
      const current = await hub.thread(made.id); const head = String(index + 1).repeat(40);
      current.slug = 'plan'; current.handed_off = { at, head, stage: 'approved' }; await hub.save(current);
      const tip = state === 'unchanged' ? head : 'f'.repeat(40);
      c.machine.handoffReplies.inspect = state === 'inspect-failed' ? { result: 'failed', error: 'offline' } : { remote_tip: tip, picked_up_at: at };
      if (state === 'own-cancelled') await fs.writeFile(path.join(c.state, 'revoke.json'), JSON.stringify([{ thread_id: made.id, sha: tip }]));
      const response = await api(c, `/threads/${made.id}/handoff`); assert.equal(response.status, 200); assert.equal(response.body.state, state);
    }
    const list = await api(c, '/threads?view=list'); assert.ok(list.body.threads.find((thread) => thread.id === made.id).handed_off);
  } finally { await close(c); }
});

test('validator rejects each malformed scalar and history limit', () => {
  const file = sample();
  const entry = { at, who: 'lead', kind: 'question', text: 'text' };
  for (const change of [
    (f) => { f.format = 'other'; }, (f) => { f.exported_at = 'yesterday'; },
    (f) => { f.thread.title = 'x'.repeat(121); }, (f) => { f.thread.slug = '../bad'; },
    (f) => { f.repository = 'gitlab.com/owner/repo'; }, (f) => { f.head = 'f'.repeat(39); },
    (f) => { f.stage = 'planning'; }, (f) => { f.history = 'bad'; },
    (f) => { f.history = Array(2001).fill(entry); },
    (f) => { f.history = [{ ...entry, at: 'bad' }]; }, (f) => { f.history = [{ ...entry, kind: 'unknown' }]; },
    (f) => { f.history = [{ ...entry, text: 'x'.repeat(20001) }]; },
  ]) { const changed = structuredClone(file); change(changed); assert.equal(valid(changed), false); }
});

test('export uses session stop lifecycle and preserves recovery on rename failure', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path');
  const { hub } = await exportFixture(); const thread = await hub.thread(id);
  thread.sessions[0].turn_started_at = '2026-11-17T12:00:00.000Z'; thread.sessions[0].quiet_check_at = at; thread.sessions[0].quiet_card = 'quiet';
  thread.cards.push({ id: 'quiet', kind: 'needs', title: 'Notice', body: 'Waiting', at, answered: false }); await hub.save(thread);
  hub.renameHandoff = async () => { throw new Error('injected rename failure'); };
  const result = await hub.exportThread(id); const stored = await hub.thread(id);
  assert.equal(stored.sessions[0].live, false); assert.equal(stored.sessions[0].quiet_check_at, undefined); assert.equal(stored.cards[0].answered, true);
  assert.ok(stored.sessions[0].turns[0].ended_at); assert.ok(await fs.stat(path.join(hub.stateDir, 'handoffs', `${id}.json.new`)));
  assert.ok((await hub.handoffFile(id)).bytes.equals(result.bytes));
});

test('slow banner inspection does not hold the thread lock', async () => {
  const { hub } = await exportFixture(); await hub.exportThread(id); let release, started;
  const gate = new Promise((resolve) => { release = resolve; });
  const called = new Promise((resolve) => { started = resolve; });
  hub.client.handoff = async () => { started(); await gate; return { remote_tip: 'a'.repeat(40) }; };
  const pending = hub.handoffBanner(id); await called;
  const lock = await Promise.race([hub.withThread(id, async () => 'free'), new Promise((resolve) => setTimeout(() => resolve('blocked'), 500))]);
  release(); assert.equal(lock, 'free'); assert.equal((await pending).state, 'unchanged');
});

test('idea answers, retractions, imported anchor, approvals and sudo waiting set export eligibility', () => {
  const { stageFor, exportReason } = require('../app/handoff.js');
  const hub = { runningHandoffOps: new Set(), uploadsInFlight: new Map() };
  const thread = { id, sessions: [], cards: [], sent: [], asides: [] };
  const status = { branch: `wc/${id}`, repository: 'github.com/owner/repo', idea_status: 'confirmed', map_committed: true, plan_status: null };
  thread.cards = [{ kind: 'sudo', state: 'waiting' }]; assert.equal(exportReason(hub, thread, status), 'A root command is waiting');
  const idea = { id: 'idea', kind: 'question', doc: 'IDEA.md', answered: true, at: '2026-11-01T00:00:00.000Z' };
  const planning = { id: 'plan', kind: 'question', answered: true, answered_action: 'answered', at: '2026-11-02T00:00:00.000Z' };
  thread.cards = [idea, planning]; thread.sent = [{ source: 'card', text: '[card idea] answered: yes', at: '2026-11-04T00:00:00.000Z' }, { source: 'card', text: '[card plan] answered: answer', at: '2026-11-05T00:00:00.000Z' }];
  assert.equal(stageFor(thread, status), null);
  thread.sent[1].at = '2026-11-03T00:00:00.000Z'; assert.equal(stageFor(thread, status), 'idea-confirmed');
  thread.sent = []; idea.resolved_at = '2026-11-06T00:00:00.000Z'; planning.resolved_at = '2026-11-07T00:00:00.000Z'; assert.equal(stageFor(thread, status), null);
  planning.retracted_at = '2026-11-08T00:00:00.000Z'; assert.equal(stageFor(thread, status), 'idea-confirmed');
  thread.cards = [planning]; delete planning.retracted_at; thread.imported = { at: '2026-11-08T00:00:00.000Z' }; assert.equal(stageFor(thread, status), 'idea-confirmed');
  thread.imported.at = '2026-11-06T00:00:00.000Z'; assert.equal(stageFor(thread, status), null);
  delete thread.imported; assert.equal(stageFor(thread, status), null);
  status.plan_status = 'approved'; thread.cards = [{ kind: 'approval', answered: true, answered_action: 'start-building' }]; assert.equal(stageFor(thread, status), null);
  thread.cards[0].retracted_at = at; assert.equal(stageFor(thread, status), 'approved');
});

test('done export supplies its PR URL and rejects a non-open PR', async () => {
  const { hub, calls, status } = await exportFixture('done'); status.pr_state = 'CLOSED';
  await assert.rejects(hub.exportThread(id), /merged or closed/);
  assert.equal(calls[0].pr_url, 'https://github.com/owner/repo/pull/1'); assert.equal(calls.length, 1);
});

test('chat holds the thread lock through assembly while status refresh remains outside', async () => {
  const { hub } = await exportFixture(); let release, started; let mutationRan = false;
  const gate = new Promise((resolve) => { release = resolve; });
  const called = new Promise((resolve) => { started = resolve; });
  hub.call = async (machine, route) => { if (route.split('?')[0].endsWith('/transcript')) { started(); await gate; } return {}; };
  const reading = hub.chat(id); await called;
  const mutation = hub.withThread(id, async () => { mutationRan = true; const thread = await hub.thread(id); thread.handed_off = { at, head: 'a'.repeat(40), stage: 'approved' }; await hub.save(thread); });
  await new Promise((resolve) => setImmediate(resolve)); assert.equal(mutationRan, false);
  release(); await Promise.all([reading, mutation]); assert.equal((await hub.thread(id)).handed_off.head, 'a'.repeat(40));
});

test('handoff versions translate v1 and enforce their history labels', () => {
  const file = sample();
  file.history = [{ at, who: 'user', kind: 'message', text: 'hello' }];
  assert.equal(file.version, 2);
  assert.equal(validateHandoffFile(JSON.stringify(file)).file.history[0].who, 'user');
  const old = structuredClone(file); old.version = 1; old.history[0].who = 'collin';
  const translated = validateHandoffFile(JSON.stringify(old));
  assert.equal(translated.file.history[0].who, 'user');
  for (const [version, who, what] of [[1, 'user', 'invalid history'], [2, 'collin', 'invalid history'], [3, 'user', 'unknown format or version']]) {
    const bad = structuredClone(file); bad.version = version; bad.history[0].who = who;
    assert.equal(validateHandoffFile(JSON.stringify(bad)).what, what);
  }
  const reexport = buildHandoffFile({ id, title: 'Title', slug: 'plan', imported: { at, history: translated.file.history }, sent: [], cards: [] }, { head: 'a'.repeat(40), stage: 'approved', repository: 'github.com/owner/repo' });
  assert.equal(reexport.version, 2); assert.equal(reexport.history[0].who, 'user');
});
