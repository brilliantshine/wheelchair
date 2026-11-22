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
  const { text, provider, project, thread } = v.lessons.worker[0];
  await s.restoreLesson(h, 'worker', added.id, vid); v = await s.load(h);
  const archived = v.lesson_history[added.id].versions.at(-1);
  assert.deepEqual({ text: archived.text, provider: archived.provider, project: archived.project, thread: archived.thread, changed_by: archived.changed_by }, { text, provider, project, thread, changed_by: 'user' });
  assert.equal(v.lessons.worker[0].saved_by, 'user'); assert.equal(v.lessons.worker[0].thread, 'thread-old');
  const beforeRetry = structuredClone({ lesson: v.lessons.worker[0], history: v.lesson_history[added.id] });
  await new Promise((resolve) => setTimeout(resolve, 5));
  await s.restoreLesson(h, 'worker', added.id, vid); v = await s.load(h);
  assert.deepEqual(v.lessons.worker[0], beforeRetry.lesson); assert.deepEqual(v.lesson_history[added.id], beforeRetry.history);
  const count = beforeRetry.history.versions.length;
  await s.keepLesson(h, 'worker', added.id); v = await s.load(h); assert.ok(v.lessons.worker[0].kept_at); assert.equal(v.lessons.worker[0].saved_by, 'user'); assert.equal(v.lesson_history[added.id].versions.length, count);
  await assert.rejects(s.restoreLesson(h, 'worker', added.id, 'missing'), { status: 409 });
  assert.equal(s.STALE_DAYS, 90); assert.equal(s.isLessonStale({ saved_at: date }, 90 * 86400000 - 1), false); assert.equal(s.isLessonStale({ saved_at: date }, 90 * 86400000), true); assert.equal(s.isLessonStale(v.lessons.worker[0]), false);
  const normalized = s.normalize({ ...v, lesson_history: { ...v.lesson_history, Lffffff: { role: 'worker', versions: [] } }, lesson_waiting: [null] });
  assert.deepEqual(normalized.lesson_history[added.id], v.lesson_history[added.id]); assert.equal(normalized.lesson_history.Lffffff, undefined); assert.deepEqual(normalized.lesson_waiting, []);
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
test('agent removal appends the current text to existing history', async () => {
  const h = await hub(); const lesson = await s.applyLesson(h, card('add'), 'worker', '/p', 'one');
  await s.applyLesson(h, card('replace', { lesson: lesson.id, text: 'Changed' }), 'worker', '/p', 'one');
  const before = await s.load(h); const count = before.lesson_history[lesson.id].versions.length; const text = before.lessons.worker[0].text;
  assert.notEqual(text, before.lesson_history[lesson.id].versions.at(-1).text);
  await s.applyLesson(h, card('remove', { lesson: lesson.id }), 'worker', '/p', 'one');
  const entry = (await s.load(h)).lesson_history[lesson.id];
  assert.equal(entry.versions.length, count + 1); assert.equal(entry.versions.at(-1).text, text); assert.equal(entry.versions.at(-1).changed_by, 'agent'); assert.equal(entry.removed.by, 'agent');
});
test('a second merge skips a lesson already waiting', async () => {
  const h = await hub();
  await s.update(h, (v) => { for (let i = 0; i < 12; i++) v.lessons.worker.push({ id: `L${String(i).padStart(6, '0')}`, text: `Fill ${i}`, saved_by: 'agent', saved_at: date }); });
  const incoming = [item('Waiting lesson')];
  assert.equal((await s.mergeIncoming(h, incoming, { source: 'file', known: [] })).waiting, 1);
  const before = (await s.load(h)).lesson_waiting;
  assert.deepEqual(await s.mergeIncoming(h, incoming, { source: 'file', known: [] }), { added: 0, skipped: 1, invalid: 0, unknown_project: 0, waiting: 0 });
  assert.deepEqual((await s.load(h)).lesson_waiting, before);
});
test('merge matches trimmed text in the same scope', async () => {
  const h = await hub(); await s.mergeIncoming(h, [item('Run lint')], { source: 'file', known: [] });
  const counts = await s.mergeIncoming(h, [item('  Run lint  ')], { source: 'file', known: [] });
  assert.equal(counts.skipped, 1); assert.equal(counts.added, 0);
});
test('history caps, removals, merge and waiting', async () => {
  const h = await hub(); const first = await s.applyLesson(h, card('add'), 'worker', '/p', 'one');
  for (let i = 0; i < 23; i++) await s.applyLesson(h, card('replace', { lesson: first.id, text: `Edit ${i}` }), 'worker', '/p', 'one');
  let v = await s.load(h); assert.deepEqual(v.lesson_history[first.id].versions.map((version) => version.text), Array.from({ length: 20 }, (_, i) => `Edit ${i + 2}`));
  await s.applyLesson(h, card('remove', { lesson: first.id }), 'worker', '/p', 'one');
  v = await s.load(h); assert.equal(v.lesson_history[first.id].versions.at(-1).changed_by, 'agent'); assert.equal(v.lesson_history[first.id].removed.by, 'agent');
  const restoredVersion = v.lesson_history[first.id].versions.at(-1);
  await s.restoreLesson(h, 'worker', first.id); v = await s.load(h);
  const { saved_at: restoredAt, ...restored } = v.lessons.worker[0];
  assert.deepEqual(restored, { id: first.id, text: restoredVersion.text, thread: restoredVersion.thread, saved_by: 'user' }); assert.equal('removed' in v.lesson_history[first.id], false);
  const removedIds = [];
  for (let i = 0; i < 50; i++) { const x = await s.applyLesson(h, card('add', { text: `Removed ${i}` }), 'worker', '/p', 'one'); await s.applyLesson(h, card('remove', { lesson: x.id }), 'worker', '/p', 'one'); removedIds.push(x.id); await s.update(h, (state) => { state.lesson_history[x.id].removed.at = new Date(i * 1000).toISOString(); }); }
  const newest = await s.applyLesson(h, card('add', { text: 'Removed 50' }), 'worker', '/p', 'one'); await s.applyLesson(h, card('remove', { lesson: newest.id }), 'worker', '/p', 'one');
  v = await s.load(h); assert.deepEqual(Object.keys(v.lesson_history).filter((id) => v.lesson_history[id].removed).sort(), [...removedIds.slice(1), newest.id].sort()); assert.equal(v.lesson_history[removedIds[0]], undefined); assert.equal(v.lesson_history[newest.id].versions.at(-1).text, 'Removed 50');
  const incoming = [item('Fresh'), item('Fresh'), item('Fresh', { provider: 'gpt' }), item('Bad', { provider: 'bad' }), item('Lost', { project: '/missing' })];
  const mergeTime = Date.now();
  let counts = await s.mergeIncoming(h, incoming, { source: 'file', known: [] }); assert.deepEqual(counts, { added: 2, skipped: 1, invalid: 1, unknown_project: 1, waiting: 0 });
  const afterMerge = await s.load(h);
  for (const [index, expected] of [incoming[0], incoming[2]].entries()) { const lesson = afterMerge.lessons.worker.filter((entry) => entry.text === expected.text)[index]; const { id, kept_at, ...actual } = lesson; const { role, ...fields } = expected; assert.deepEqual(actual, fields); assert.ok(Number.isFinite(Date.parse(kept_at)) && Date.parse(kept_at) >= mergeTime); }
  counts = await s.mergeIncoming(h, incoming, { source: 'file', known: [] }); assert.deepEqual(counts, { added: 0, skipped: 3, invalid: 1, unknown_project: 1, waiting: 0 });
  assert.deepEqual(await s.load(h), afterMerge);
  await s.update(h, (x) => { for (const role of s.ROLES) while (x.lessons[role].length < 12) x.lessons[role].push({ id: `L${(Math.random()*0xffffff|0).toString(16).padStart(6,'0')}`, text: `Fill ${x.lessons[role].length}`, saved_by: 'agent', saved_at: date }); });
  const existing = [item('Existing one', { source: 'file', received_at: date, wid: 'existing-one' }), item('Existing two', { source: 'handoff', received_at: date, wid: 'existing-two' })];
  await s.update(h, (x) => { x.lesson_waiting.push(...existing); });
  const arrivals = [...s.ROLES].flatMap((role) => Array.from({length: 12}, (_, i) => item(`Incoming ${i}`, { role })));
  counts = await s.mergeIncoming(h, arrivals, { source: 'file', known: [] }); assert.deepEqual(counts, { added: 0, skipped: 0, invalid: 0, unknown_project: 0, waiting: 72 });
  v = await s.load(h); assert.deepEqual(v.lesson_waiting.slice(2).map(({ role, text, saved_by, saved_at, source }) => ({ role, text, saved_by, saved_at, source })), arrivals.map((entry) => ({ ...entry, source: 'file' })));
  for (const original of existing) assert.deepEqual(v.lesson_waiting.find((entry) => entry.wid === original.wid), original);
  const w = v.lesson_waiting[0]; const beforeFullAdd = structuredClone({ lessons: v.lessons[w.role], history: v.lesson_history, waiting: v.lesson_waiting }); await assert.rejects(s.waitingAction(h, w.role, w.wid, 'add'), { status: 422 });
  v = await s.load(h); assert.deepEqual({ lessons: v.lessons[w.role], history: v.lesson_history, waiting: v.lesson_waiting }, beforeFullAdd);
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
    const beforeEdit = (await s.load(h)).lessons.worker[0]; await new Promise((resolve) => setTimeout(resolve, 5));
    let r = await api(app, '/settings/lessons/worker', { method: 'PUT', body: { edits: [{ id: x.id, text: 'Changed' }], removals: [] } });
    const edited = (await s.load(h)).lessons.worker[0]; assert.deepEqual(edited, { ...beforeEdit, text: 'Changed', saved_by: 'user', saved_at: edited.saved_at }); assert.ok(Date.parse(edited.saved_at) > Date.parse(beforeEdit.saved_at));
    assert.equal(r.body.history[x.id].versions.at(-1).changed_by, 'user'); assert.equal(r.body.history[x.id].versions.at(-1).text, 'First');
    const c = await s.mergeIncoming(h, [item('First')], { source: 'file', known: [] }); assert.equal(c.skipped, 1);
    const beforeRemoval = await s.load(h); const versionCount = beforeRemoval.lesson_history[x.id].versions.length; const removedText = beforeRemoval.lessons.worker.find((lesson) => lesson.id === x.id).text;
    assert.notEqual(removedText, beforeRemoval.lesson_history[x.id].versions.at(-1).text);
    r = await api(app, '/settings/lessons/worker', { method: 'PUT', body: { edits: [], removals: [x.id] } });
    assert.equal(r.body.history[x.id].versions.length, versionCount + 1); assert.equal(r.body.history[x.id].versions.at(-1).text, removedText); assert.equal(r.body.history[x.id].versions.at(-1).changed_by, 'user'); assert.equal(r.body.history[x.id].removed.by, 'user');
    await s.update(h, (v) => { for (let i=0;i<12;i++) v.lessons.worker.push({ id: `L${i.toString(16).padStart(6,'0')}`, text: `x${i}`, saved_by: 'agent', saved_at: date }); });
    const full = await s.load(h); const beforeFullRestore = structuredClone({ lessons: full.lessons.worker, history: full.lesson_history, waiting: full.lesson_waiting });
    r = await api(app, '/settings/lessons/worker/restore', { method: 'POST', body: { id: x.id } }); assert.equal(r.status, 422);
    const refused = await s.load(h); assert.deepEqual({ lessons: refused.lessons.worker, history: refused.lesson_history, waiting: refused.lesson_waiting }, beforeFullRestore);
    await s.update(h, (v) => { v.lesson_history = {}; v.lesson_waiting = []; });
    const before = s.roleLayers(await s.load(h), 'worker', '/p', null, 'gpt').text;
    await s.update(h, (v) => { v.lessons.worker[0].kept_at = new Date().toISOString(); v.lesson_history[v.lessons.worker[0].id] = { role: 'worker', versions: [{ ...item('HISTORY-MARKER'), vid: 'history', changed_at: date, changed_by: 'user' }] }; v.lesson_history.Labcdef = { role: 'worker', versions: [{ ...item('HISTORY-MARKER removed'), vid: 'removed', changed_at: date, changed_by: 'user' }], removed: { at: date, by: 'user' } }; v.lesson_waiting.push({ ...item('WAITING-MARKER'), source: 'file', received_at: date, wid: 'w' }); });
    const after = s.roleLayers(await s.load(h), 'worker', '/p', null, 'gpt').text;
    assert.equal(after, before); assert.doesNotMatch(after, /HISTORY-MARKER|WAITING-MARKER/);
    await s.update(h, (v) => { v.lessons.worker.pop(); });
    const waitingBefore = (await s.load(h)).lesson_waiting.find((entry) => entry.wid === 'w');
    r = await api(app, '/settings/lessons/worker/waiting', { method: 'POST', body: { wid: 'w', action: 'add' } }); assert.equal(r.body.result, 'added');
    const addedState = await s.load(h); const addedLesson = addedState.lessons.worker.find((entry) => entry.text === waitingBefore.text); const { id, kept_at, ...addedFields } = addedLesson; const { role, source, received_at, wid, ...waitingFields } = waitingBefore; assert.deepEqual(addedFields, waitingFields); assert.equal(addedState.lesson_waiting.some((entry) => entry.wid === wid), false);
  } finally { await close(app); }
});
test('merge skips older versions of current and removed lessons', async () => {
  const h = await hub();
  for (const prefix of ['Current', 'Removed']) {
    const lesson = await s.applyLesson(h, card('add', { text: `${prefix} v1` }), 'worker', '/p', 't');
    for (const version of ['v2', 'v3', 'current']) await s.applyLesson(h, card('replace', { lesson: lesson.id, text: `${prefix} ${version}` }), 'worker', '/p', 't');
    if (prefix === 'Removed') await s.applyLesson(h, card('remove', { lesson: lesson.id }), 'worker', '/p', 't');
  }
  const before = await s.load(h);
  const counts = await s.mergeIncoming(h, [item('Current v1'), item('Current v2'), item('Removed v1')], { source: 'file', known: [] });
  assert.deepEqual(counts, { added: 0, skipped: 3, invalid: 0, unknown_project: 0, waiting: 0 });
  const after = await s.load(h);
  assert.deepEqual(after.lessons, before.lessons); assert.deepEqual(after.lesson_waiting, before.lesson_waiting);
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
    const beforeAlready = (await s.load(h)).lessons.worker;
    assert.equal((await s.waitingAction(h, 'worker', 'already', 'add')).result, 'already');
    const afterAlready = await s.load(h); assert.equal(afterAlready.lesson_waiting.some((entry) => entry.wid === 'already'), false); assert.deepEqual(afterAlready.lessons.worker, beforeAlready);
    await assert.rejects(s.waitingAction(h, 'worker', 'missing', 'add'), { status: 409 });
    const waitingInput = { ...item('wait', { thread: 'thread-wait', provider: 'gpt', project: '/saved' }), source: 'file', received_at: date, wid: 'one' };
    const n = s.normalize({ lessons: { worker: [{ id: 'L123456', ...item('ok'), kept_at: date }] }, lesson_waiting: [waitingInput, { ...waitingInput, wid: 'two' }] });
    assert.equal(n.lessons.worker[0].kept_at, date); assert.deepEqual(n.lesson_waiting, [waitingInput]);
  } finally { await close(app); }
});
test('new ids avoid removed history and different project scopes remain distinct', async () => {
  const h = await hub();
  await s.update(h, (v) => { v.lesson_history.L123456 = { role: 'worker', versions: [{ ...item('old'), vid: 'old', changed_at: date, changed_by: 'agent' }], removed: { at: date, by: 'agent' } }; });
  const crypto = require('node:crypto'), original = crypto.randomBytes; let calls = 0;
  crypto.randomBytes = (n) => n === 3 ? Buffer.from(++calls === 1 ? '123456' : 'abcdef', 'hex') : original(n);
  try { const x = await s.applyLesson(h, card('add'), 'worker', '/p', 't'); assert.equal(x.id, 'Labcdef'); } finally { crypto.randomBytes = original; }
  const result = await s.mergeIncoming(h, [item('scoped', { project: '/a' }), item('scoped', { project: '/b' })], { source: 'file', known: ['/a', '/b'] });
  const scoped = (await s.load(h)).lessons.worker.filter((entry) => entry.text === 'scoped'); assert.deepEqual(scoped.map(({ id, kept_at, ...entry }) => entry), [{ text: 'scoped', project: '/a', saved_by: 'agent', saved_at: date }, { text: 'scoped', project: '/b', saved_by: 'agent', saved_at: date }]); assert.equal(result.added, 2);
});

test('restore preserves version scope and appends removed lessons', async () => {
  const h = await hub();
  for (const [id, scope, current] of [['L100001', { project: '/a' }, {}], ['L100002', { provider: 'gpt' }, {}], ['L100003', {}, { project: '/a' }]]) {
    await s.update(h, (v) => { v.lessons.worker.push({ id, ...item('Current', current) }); v.lesson_history[id] = { role: 'worker', versions: [{ ...item('Old', scope), vid: 'v', changed_at: date, changed_by: 'agent' }] }; });
    await s.restoreLesson(h, 'worker', id, 'v'); const lesson = (await s.load(h)).lessons.worker.find((l) => l.id === id);
    assert.equal(lesson.project, scope.project); assert.equal(lesson.provider, scope.provider); assert.notEqual(lesson.saved_at, date);
  }
  await s.update(h, (v) => { v.lesson_history.L100004 = { role: 'worker', versions: [{ ...item('Removed'), vid: 'v', changed_at: date, changed_by: 'agent' }], removed: { at: date, by: 'agent' } }; });
  await s.restoreLesson(h, 'worker', 'L100004'); assert.equal((await s.load(h)).lessons.worker.at(-1).id, 'L100004');
});
for (const source of ['import', 'waiting']) test(`${source} avoids removed history ids`, async () => {
    const h = await hub(); await s.update(h, (v) => { v.lesson_history.L123456 = { role: 'worker', versions: [{ ...item('Old'), vid: 'v', changed_at: date, changed_by: 'agent' }], removed: { at: date, by: 'agent' } }; if (source === 'waiting') v.lesson_waiting.push({ ...item('New'), source: 'file', received_at: date, wid: 'w' }); });
    const crypto = require('node:crypto'), original = crypto.randomBytes; let calls = 0;
    crypto.randomBytes = (n) => n === 3 ? Buffer.from(++calls === 1 ? '123456' : 'abcdef', 'hex') : original(n);
    try { if (source === 'import') await s.mergeIncoming(h, [item('New')], { source: 'file', known: [] }); else await s.waitingAction(h, 'worker', 'w', 'add'); } finally { crypto.randomBytes = original; }
    assert.equal((await s.load(h)).lessons.worker[0].id, 'Labcdef', source);
});
test('export contains exactly the specified fields', async () => {
  const app = await setup(); try { const h = new Hub({ stateDir: app.state, codeVersion: '' }); await h.state.init();
    await s.update(h, (v) => { v.lessons.worker.push({ id: 'L123456', ...item('Current', { provider: 'gpt', project: '/a', thread: 't', kept_at: date }) }); v.lesson_history.Labcdef = { role: 'worker', versions: [{ ...item('Removed'), vid: 'v', changed_at: date, changed_by: 'agent' }], removed: { at: date, by: 'agent' } }; v.lesson_waiting.push({ ...item('Waiting'), source: 'file', received_at: date, wid: 'w' }); });
    const out = (await api(app, '/settings/lessons/export')).body; assert.deepEqual(Object.keys(out), ['format', 'version', 'exported_at', 'lessons']); assert.deepEqual(out.lessons.worker, [{ text: 'Current', provider: 'gpt', project: '/a', saved_by: 'agent', saved_at: date, kept_at: date }]);
  } finally { await close(app); }
});
test('merge validates authors, handles threads, and fills the twelfth slot', async () => {
  const h = await hub(); assert.equal((await s.mergeIncoming(h, [item('Invalid', { saved_by: 'bad' })], { source: 'file', known: [] })).invalid, 1);
  await s.mergeIncoming(h, [item('File', { thread: 'file-thread' })], { source: 'file', known: [] }); await s.mergeIncoming(h, [item('Handoff', { thread: 'handoff-thread' })], { source: 'handoff' });
  const v = await s.load(h); assert.equal(v.lessons.worker.find((l) => l.text === 'File').thread, undefined); assert.equal(v.lessons.worker.find((l) => l.text === 'Handoff').thread, 'handoff-thread');
  await s.update(h, (x) => { for (let i = 0; i < 9; i++) x.lessons.worker.push({ id: `L${(i + 256).toString(16).padStart(6, '0')}`, ...item(`Fill ${i}`) }); });
  assert.deepEqual(await s.mergeIncoming(h, [item('Twelfth')], { source: 'file', known: [] }), { added: 1, skipped: 0, invalid: 0, unknown_project: 0, waiting: 0 });
});
test('waiting actions select role and id and discard the requested entry', async () => {
  const h = await hub(); await s.update(h, (v) => { v.lesson_waiting.push({ ...item('First'), source: 'file', received_at: date, wid: 'one' }, { ...item('Second'), source: 'file', received_at: date, wid: 'two' }); });
  await assert.rejects(s.waitingAction(h, 'reviewer', 'two', 'add'), { status: 409 }); await s.waitingAction(h, 'worker', 'two', 'discard'); assert.deepEqual((await s.load(h)).lesson_waiting.map((w) => w.wid), ['one']);
});
test('normalization rejects invalid history authors and waiting sources', () => {
  const n = s.normalize({ lesson_history: { L123456: { role: 'worker', versions: [{ ...item('Old'), vid: 'v', changed_at: date, changed_by: 'bad' }], removed: { at: date, by: 'agent' } } }, lesson_waiting: [{ ...item('Waiting'), source: 'bad', received_at: date, wid: 'w' }] }); assert.deepEqual(n.lesson_history, {}); assert.deepEqual(n.lesson_waiting, []);
});
test('import refuses a newer lessons file version', async () => {
  const app = await setup(); try { const r = await api(app, '/settings/lessons/import', { method: 'POST', body: { format: 'wheelchair-lessons', version: 2, lessons: {} } }); assert.equal(r.status, 400); } finally { await close(app); }
});

test('restore scope after agent replacement', async () => {
  for (const [initial, replacement, expected] of [
    [{ only_project: true }, { only_project: false }, { project: '/a', provider: undefined }],
    [{ only_ai: 'gpt' }, { only_ai: 'any' }, { project: undefined, provider: 'gpt' }],
    [{}, { only_project: true }, { project: undefined, provider: undefined }],
  ]) {
    const h = await hub(); const added = await s.applyLesson(h, card('add', initial), 'worker', '/a', 't');
    await s.applyLesson(h, card('replace', { lesson: added.id, text: 'Replacement', ...replacement }), 'worker', '/a', 't');
    const vid = (await s.load(h)).lesson_history[added.id].versions[0].vid;
    await s.restoreLesson(h, 'worker', added.id, vid); const restored = (await s.load(h)).lessons.worker[0];
    assert.equal(restored.project, expected.project); assert.equal(restored.provider, expected.provider);
  }
});
