'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { makeTemp } = require('../../test-support/run-dir');
const { Hub } = require('../app/hub');
const s = require('../app/settings');
const { api, setup, close } = require('./helpers/app');
const date = new Date(0).toISOString();
const item = (text, extra = {}) => ({ role: 'worker', text, saved_by: 'agent', saved_at: date, ...extra });
async function hub() { const dir = await makeTemp('lesson-history-'); const h = new Hub({ stateDir: path.join(dir, 'state'), codeVersion: '' }); await h.state.init(); return h; }
const card = (action, extra = {}) => ({ action, for: 'worker', text: 'First', ...extra });
test('agent changes, restore, keep and normalization retain history', async () => {
  const h = await hub(); const added = await s.applyLesson(h, card('add'), 'worker', '/p', 'thread-old');
  await s.applyLesson(h, card('replace', { lesson: added.id, only_ai: 'gpt' }), 'worker', '/p', 'thread-new');
  let v = await s.load(h); let entry = v.lesson_history[added.id]; assert.equal(entry.versions.at(-1).changed_by, 'agent'); assert.equal(entry.versions.at(-1).text, 'First');
  const vid = entry.versions[0].vid;
  await s.restoreLesson(h, 'worker', added.id, vid); v = await s.load(h);
  assert.equal(v.lesson_history[added.id].versions.at(-1).changed_by, 'user');
  assert.equal(v.lessons.worker[0].saved_by, 'user'); assert.equal(v.lessons.worker[0].thread, 'thread-old');
  const count = v.lesson_history[added.id].versions.length; await s.restoreLesson(h, 'worker', added.id, vid); assert.equal((await s.load(h)).lesson_history[added.id].versions.length, count);
  await s.keepLesson(h, 'worker', added.id); v = await s.load(h); assert.ok(v.lessons.worker[0].kept_at); assert.equal(v.lessons.worker[0].saved_by, 'user'); assert.equal(v.lesson_history[added.id].versions.length, count);
  await assert.rejects(s.restoreLesson(h, 'worker', added.id, 'missing'), { status: 409 });
  assert.equal(s.STALE_DAYS, 90); assert.equal(s.isLessonStale({ saved_at: date }, 90 * 86400000 - 1), false); assert.equal(s.isLessonStale({ saved_at: date }, 90 * 86400000), true); assert.equal(s.isLessonStale(v.lessons.worker[0]), false);
  const normalized = s.normalize({ ...v, lesson_history: { ...v.lesson_history, Lffffff: { role: 'worker', versions: [] } }, lesson_waiting: [null] });
  assert.ok(normalized.lesson_history[added.id]); assert.equal(normalized.lesson_history.Lffffff, undefined); assert.deepEqual(normalized.lesson_waiting, []);
});
test('Keep clears staleness without changing the saved lesson or history', async () => {
  const h = await hub(); const saved_at = new Date(Date.now() - 100 * 86400000).toISOString();
  await s.update(h, (v) => { v.lessons.worker.push({ id: 'L123456', text: 'Old lesson', saved_by: 'agent', saved_at }); });
  let v = await s.load(h); const original = v.lessons.worker[0];
  assert.equal(s.isLessonStale(original), true);
  assert.equal(s.isLessonStale({ ...original, kept_at: new Date(Date.now() - 10 * 86400000).toISOString() }), false);
  await s.keepLesson(h, 'worker', original.id); v = await s.load(h);
  assert.ok(v.lessons.worker[0].kept_at); assert.equal(v.lessons.worker[0].saved_by, original.saved_by); assert.equal(v.lessons.worker[0].saved_at, saved_at);
  assert.deepEqual(v.lesson_history, {}); assert.equal(s.isLessonStale(v.lessons.worker[0]), false);
});
test('history caps, removals, merge and waiting', async () => {
  const h = await hub(); const first = await s.applyLesson(h, card('add'), 'worker', '/p', 'one');
  for (let i = 0; i < 23; i++) await s.applyLesson(h, card('replace', { lesson: first.id, text: `Edit ${i}` }), 'worker', '/p', 'one');
  let v = await s.load(h); assert.equal(v.lesson_history[first.id].versions.length, 20);
  await s.applyLesson(h, card('remove', { lesson: first.id }), 'worker', '/p', 'one');
  v = await s.load(h); assert.equal(v.lesson_history[first.id].versions.at(-1).changed_by, 'agent'); assert.equal(v.lesson_history[first.id].removed.by, 'agent');
  await s.restoreLesson(h, 'worker', first.id); v = await s.load(h); assert.equal(v.lessons.worker[0].text, 'Edit 22');
  for (let i = 0; i < 51; i++) { const x = await s.applyLesson(h, card('add', { text: `Removed ${i}` }), 'worker', '/p', 'one'); await s.applyLesson(h, card('remove', { lesson: x.id }), 'worker', '/p', 'one'); }
  v = await s.load(h); assert.equal(Object.values(v.lesson_history).filter((e) => e.removed).length, 50);
  const incoming = [item('Fresh'), item('Fresh'), item('Fresh', { provider: 'gpt' }), item('Bad', { provider: 'bad' }), item('Lost', { project: '/missing' })];
  let counts = await s.mergeIncoming(h, incoming, { source: 'file', known: [] }); assert.deepEqual(counts, { added: 2, skipped: 1, invalid: 1, unknown_project: 1, waiting: 0 });
  counts = await s.mergeIncoming(h, incoming, { source: 'file', known: [] }); assert.equal(counts.skipped, 3);
  await s.update(h, (x) => { for (const role of s.ROLES) while (x.lessons[role].length < 12) x.lessons[role].push({ id: `L${(Math.random()*0xffffff|0).toString(16).padStart(6,'0')}`, text: `Fill ${x.lessons[role].length}`, saved_by: 'agent', saved_at: date }); });
  const existing = [item('Existing one', { source: 'file', received_at: date, wid: 'existing-one' }), item('Existing two', { source: 'handoff', received_at: date, wid: 'existing-two' })];
  await s.update(h, (x) => { x.lesson_waiting.push(...existing); });
  counts = await s.mergeIncoming(h, [...s.ROLES].flatMap((role) => Array.from({length: 12}, (_, i) => item(`Incoming ${i}`, { role }))), { source: 'file', known: [] }); assert.equal(counts.waiting, 72);
  v = await s.load(h); assert.equal(v.lesson_waiting.length, 74);
  for (const original of existing) assert.deepEqual(v.lesson_waiting.find((entry) => entry.wid === original.wid), original);
  const w = v.lesson_waiting[0]; await assert.rejects(s.waitingAction(h, w.role, w.wid, 'add'), { status: 422 });
  assert.equal((await s.waitingAction(h, w.role, w.wid, 'discard')).result, 'discarded'); await assert.rejects(s.waitingAction(h, w.role, w.wid, 'discard'), { status: 409 });
});
test('handoff projects and file routes', async () => {
  const h = await hub(); const c = await s.mergeIncoming(h, [item('Thread', { project: true, thread: 't' }), item('Bad', { project: '/p' })], { source: 'handoff', targetProject: '/target' });
  assert.equal(c.added, 1); assert.equal(c.invalid, 1); assert.equal((await s.load(h)).lessons.worker[0].project, '/target');
  const app = await setup(); try {
    const store = new Hub({ stateDir: app.state, codeVersion: '' }); await store.state.init();
    const seeded = [item('User GPT', { provider: 'gpt', saved_by: 'user' }), item('Saved project', { project: '/saved' }), item('Agent thread', { thread: 'thread-one' })];
    await s.update(store, (v) => { v.saved_dirs = [{ path: '/saved' }]; v.lessons.worker = seeded.map((lesson, i) => ({ id: `L00000${i}`, ...lesson })); });
    const exp = await api(app, '/settings/lessons/export'); assert.equal(exp.status, 200);
    assert.equal(exp.body.format, 'wheelchair-lessons'); assert.equal(exp.body.version, 1);
    const exported = Object.values(exp.body.lessons).flat(); assert.equal(exported.length, 3);
    for (const lesson of exported) { assert.equal('id' in lesson, false); assert.equal('thread' in lesson, false); }
    await s.update(store, (v) => { v.lessons.worker = []; });
    const imp = await api(app, '/settings/lessons/import', { method: 'POST', body: exp.body }); assert.equal(imp.status, 200);
    assert.deepEqual(imp.body, { added: 3, skipped: 0, invalid: 0, unknown_project: 0, waiting: 0 });
    const imported = (await s.load(store)).lessons.worker;
    for (const original of seeded) {
      const lesson = imported.find((entry) => entry.text === original.text); assert.ok(lesson);
      for (const field of ['text', 'provider', 'project', 'saved_by', 'saved_at']) assert.equal(lesson[field], original[field]);
      assert.ok(lesson.kept_at); assert.equal('thread' in lesson, false);
    }
    const again = await api(app, '/settings/lessons/import', { method: 'POST', body: exp.body });
    assert.equal(again.body.skipped, 3); assert.equal(again.body.added, 0);
    assert.equal((await api(app, '/settings/lessons/import', { method: 'POST', body: {} })).status, 400);
  } finally { await close(app); }
});
test('user edits and removals, capacity, and history matching', async () => {
  const app = await setup(); try {
    const h = new Hub({ stateDir: app.state, codeVersion: '' }); await h.state.init();
    const x = await s.applyLesson(h, card('add'), 'worker', '/p', 't');
    let r = await api(app, '/settings/lessons/worker', { method: 'PUT', body: { edits: [{ id: x.id, text: 'Changed' }], removals: [] } });
    assert.equal(r.body.history[x.id].versions.at(-1).changed_by, 'user'); assert.equal(r.body.history[x.id].versions.at(-1).text, 'First');
    const c = await s.mergeIncoming(h, [item('First')], { source: 'file', known: [] }); assert.equal(c.skipped, 1);
    r = await api(app, '/settings/lessons/worker', { method: 'PUT', body: { edits: [], removals: [x.id] } }); assert.equal(r.body.history[x.id].versions.at(-1).changed_by, 'user'); assert.equal(r.body.history[x.id].removed.by, 'user');
    await s.update(h, (v) => { for (let i=0;i<12;i++) v.lessons.worker.push({ id: `L${i.toString(16).padStart(6,'0')}`, text: `x${i}`, saved_by: 'agent', saved_at: date }); });
    r = await api(app, '/settings/lessons/worker/restore', { method: 'POST', body: { id: x.id } }); assert.equal(r.status, 422);
    await s.update(h, (v) => { v.lesson_history = {}; v.lesson_waiting = []; });
    const before = s.roleLayers(await s.load(h), 'worker', '/p', null, 'gpt').text;
    await s.update(h, (v) => { v.lessons.worker[0].kept_at = new Date().toISOString(); v.lesson_history[v.lessons.worker[0].id] = { role: 'worker', versions: [{ ...item('HISTORY-MARKER'), vid: 'history', changed_at: date, changed_by: 'user' }] }; v.lesson_history.Labcdef = { role: 'worker', versions: [{ ...item('HISTORY-MARKER removed'), vid: 'removed', changed_at: date, changed_by: 'user' }], removed: { at: date, by: 'user' } }; v.lesson_waiting.push({ ...item('WAITING-MARKER'), source: 'file', received_at: date, wid: 'w' }); });
    const after = s.roleLayers(await s.load(h), 'worker', '/p', null, 'gpt').text;
    assert.equal(after, before); assert.doesNotMatch(after, /HISTORY-MARKER|WAITING-MARKER/);
    await s.update(h, (v) => { v.lessons.worker.pop(); });
    r = await api(app, '/settings/lessons/worker/waiting', { method: 'POST', body: { wid: 'w', action: 'add' } }); assert.equal(r.body.result, 'added');
  } finally { await close(app); }
});
test('file limits, known directories, waiting recheck and normalization', async () => {
  const app = await setup(); try {
    const h = new Hub({ stateDir: app.state, codeVersion: '' }); await h.state.init();
    await s.update(h, (v) => { v.saved_dirs = [{ path: '/saved' }]; });
    const file = { format: 'wheelchair-lessons', version: 1, lessons: { worker: [item('Known', { project: '/saved' }), item('Unknown', { project: '/unknown' })] } };
    let r = await api(app, '/settings/lessons/import', { method: 'POST', body: file }); assert.equal(r.body.added, 1); assert.equal(r.body.unknown_project, 1);
    assert.equal((await s.load(h)).lessons.worker[0].project, '/saved');
    r = await api(app, '/settings/lessons/import', { method: 'POST', body: 'x'.repeat(1024 * 1024) }); assert.equal(r.status, 413);
    await s.update(h, (v) => { v.lesson_waiting.push({ ...item('Known', { project: '/saved' }), source: 'file', received_at: date, wid: 'already' }); });
    assert.equal((await s.waitingAction(h, 'worker', 'already', 'add')).result, 'already');
    await assert.rejects(s.waitingAction(h, 'worker', 'missing', 'add'), { status: 409 });
    const n = s.normalize({ lessons: { worker: [{ id: 'L123456', ...item('ok'), kept_at: date }] }, lesson_waiting: [{ ...item('wait'), source: 'file', received_at: date, wid: 'one' }, { ...item('wait'), source: 'file', received_at: date, wid: 'two' }] });
    assert.equal(n.lessons.worker[0].kept_at, date); assert.equal(n.lesson_waiting.length, 1);
  } finally { await close(app); }
});
test('new ids avoid removed history and different project scopes remain distinct', async () => {
  const h = await hub();
  await s.update(h, (v) => { v.lesson_history.L123456 = { role: 'worker', versions: [{ ...item('old'), vid: 'old', changed_at: date, changed_by: 'agent' }], removed: { at: date, by: 'agent' } }; });
  const crypto = require('node:crypto'), original = crypto.randomBytes; let calls = 0;
  crypto.randomBytes = (n) => n === 3 ? Buffer.from(++calls === 1 ? '123456' : 'abcdef', 'hex') : original(n);
  try { const x = await s.applyLesson(h, card('add'), 'worker', '/p', 't'); assert.equal(x.id, 'Labcdef'); } finally { crypto.randomBytes = original; }
  const result = await s.mergeIncoming(h, [item('scoped', { project: '/a' }), item('scoped', { project: '/b' })], { source: 'file', known: ['/a', '/b'] }); assert.equal(result.added, 2);
});
