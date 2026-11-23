'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeTemp } = require('../../test-support/run-dir');
const { Hub } = require('../app/hub');
const settings = require('../app/settings');
const { validate } = require('../app/card');
const { api, close, setup } = require('./helpers/app');
const path = require('node:path');

async function fixture() {
  const dir = await makeTemp('lessons-');
  const hub = new Hub({ stateDir: path.join(dir, 'state'), codeVersion: '' });
  await hub.state.init();
  await hub.save({ id: 'one', project: '/project', sessions: [{ name: 'lead', role: 'lead', provider: 'claude' }, { name: 'worker', role: 'worker', provider: 'claude' }, { name: 'sub-lead', role: 'sub-lead', provider: 'claude' }, { name: 'reviewer', role: 'reviewer' }, { name: 'verifier', role: 'verifier' }], cards: [], pinned: {}, queues: {}, asides: [], archived: false });
  return hub;
}
const add = (extra = {}) => ({ kind: 'lesson', action: 'add', for: 'worker', text: 'Check the result.', why: 'A check failed twice.', ...extra });
const post = (hub, card, session = 'lead') => hub.acceptCard({ ...card, session, thread_id: 'one' });

test('card schema and saver pairs', async () => {
  assert.equal(validate('lesson', add({ why: undefined }), 'lead').ok, false);
  assert.equal(validate('lesson', add({ only_ai: ['gpt'] }), 'worker').ok, false);
  for (const role of ['reviewer', 'verifier']) assert.equal(validate('lesson', add(), role).ok, false);
  const hub = await fixture();
  await assert.rejects(post(hub, add(), 'lead'), /a lead may not save lessons for workers/);
  const saved = await post(hub, add(), 'worker');
  assert.match(saved.lesson, /^L[0-9a-f]{6}$/);
  assert.equal(saved.snapshot.text, 'Check the result.');
  assert.equal((await hub.state.thread('one')).cards.length, 1);
});

test('sub-lead can save a worker lesson for another provider', async () => {
  const hub = await fixture();
  await post(hub, add({ only_ai: 'gpt' }), 'sub-lead');
  const s = await settings.load(hub);
  assert.equal(s.lessons.worker[0].provider, 'gpt');
  assert.match(settings.roleLayers(s, 'worker', '/project', null, 'gpt').text, /Check the result\. \(only on GPT\)/);
  assert.doesNotMatch(settings.roleLayers(s, 'worker', '/project', null, 'claude').text, /Check the result/);
});

test('reviewers and verifiers cannot save lessons through the hub', async () => {
  const hub = await fixture();
  for (const role of ['reviewer', 'verifier']) {
    await assert.rejects(post(hub, add(), role), { status: 422, message: `a ${role} may not save lessons for workers` });
  }
  assert.equal((await hub.state.thread('one')).cards.length, 0);
});

test('scope, repeat safety, replacement, removal and user ownership', async () => {
  const hub = await fixture();
  const first = await post(hub, add({ only_ai: 'gpt', only_project: true }), 'worker');
  const afterFirstAdd = (await hub.state.thread('one')).cards.length;
  assert.equal((await post(hub, add({ only_ai: 'gpt', only_project: true }), 'worker')).lesson, first.lesson);
  assert.equal((await hub.state.thread('one')).cards.length, afterFirstAdd);
  const second = await post(hub, add(), 'worker');
  assert.notEqual(first.lesson, second.lesson);
  assert.equal((await settings.load(hub)).lessons.worker.length, 2);
  const sameTextOtherScope = await post(hub, add({ only_ai: 'claude' }), 'worker');
  assert.notEqual(sameTextOtherScope.lesson, second.lesson);
  assert.equal((await settings.load(hub)).lessons.worker.length, 3);
  const replace = { kind: 'lesson', action: 'replace', for: 'worker', lesson: first.lesson, text: 'Try again.', why: 'A retry failed.' };
  const changed = await post(hub, replace, 'worker');
  assert.deepEqual(changed.snapshot, { text: 'Try again.', provider: 'gpt', project: '/project' });
  const keptMarkers = (await settings.load(hub)).lessons.worker[0];
  assert.equal(keptMarkers.provider, 'gpt');
  assert.equal(keptMarkers.project, '/project');
  const afterFirstReplace = (await hub.state.thread('one')).cards.length;
  await post(hub, replace, 'worker');
  assert.equal((await hub.state.thread('one')).cards.length, afterFirstReplace);
  await post(hub, { ...replace, only_ai: 'any', only_project: false }, 'worker');
  const cleared = (await settings.load(hub)).lessons.worker[0];
  assert.equal(cleared.text, 'Try again.');
  assert.equal(Object.hasOwn(cleared, 'provider'), false);
  assert.equal(Object.hasOwn(cleared, 'project'), false);
  const remove = { kind: 'lesson', action: 'remove', for: 'worker', lesson: first.lesson, why: 'No longer true.' };
  await post(hub, remove, 'worker');
  const afterFirstRemove = (await hub.state.thread('one')).cards.length;
  await post(hub, remove, 'worker');
  assert.equal((await hub.state.thread('one')).cards.length, afterFirstRemove);
  const leadLesson = await post(hub, add({ for: 'lead', text: 'Lead-only lesson.' }), 'lead');
  await assert.rejects(post(hub, { ...remove, for: 'worker', lesson: leadLesson.lesson }, 'worker'), new RegExp(`no lesson ${leadLesson.lesson} for workers`));
  await assert.rejects(post(hub, replace, 'worker'), /no lesson/);
  await settings.update(hub, (s) => { s.lessons.worker[0].saved_by = 'user'; });
  await assert.rejects(post(hub, { ...remove, lesson: second.lesson }, 'worker'), /the user edited this lesson/);
  await assert.rejects(post(hub, { ...replace, lesson: second.lesson }, 'worker'), /the user edited this lesson/);
});

test('normalization, cap, prompts and preview', async () => {
  const hub = await fixture();
  for (let i = 0; i < 12; i++) await post(hub, add({ text: `Lesson ${i}`, only_ai: 'gpt' }), 'worker');
  const s = await settings.load(hub);
  s.lessons.worker[0].saved_by = 'user';
  await settings.update(hub, (current) => { current.lessons.worker[0].saved_by = 'user'; });
  await assert.rejects(post(hub, add({ text: 'Full' }), 'worker'), (error) => {
    assert.match(error.message, /lessons for workers are full \(12\): replace or remove one instead/);
    const lines = error.message.split('\n').slice(1);
    assert.equal(lines.filter((line) => line.startsWith('[L')).length, 12);
    assert.match(lines.find((line) => line.includes(s.lessons.worker[0].id)), /\(edited by the user\)$/);
    return true;
  });
  s.templates.push({ role: 'worker', scope: 'all', in_use: true, name: 'Mine', switches: {}, text: 'Template text' });
  const prompt = settings.roleLayers(s, 'worker', '/project', null, 'gpt').text;
  assert.match(prompt, /edited by the user/);
  assert.match(prompt, /\(only on GPT\)/);
  assert.ok(prompt.indexOf('Lessons learned') < prompt.indexOf('Template text'));
  assert.doesNotMatch(settings.roleLayers(s, 'worker', '/project', null, 'claude').text, /Lessons learned/);
  s.lessons.worker[0].project = '/project';
  assert.doesNotMatch(settings.roleLayers(s, 'worker', '/other', null, 'gpt').text, /Lesson 0/);
  assert.match(settings.fullPrompt(hub, s, 'worker', '/project'), /Lesson 0/);
  assert.match(settings.fullPrompt(hub, s, 'worker', undefined), /Lesson 0/);
  assert.doesNotMatch(settings.fullPrompt(hub, s, 'worker', '/other'), /Lesson 0/);
  assert.match(settings.fullPrompt(hub, s, 'sub-lead', '/project'), /Lessons you keep for workers/);
  s.lessons.reviewer = [s.lessons.worker[0]];
  assert.match(settings.fullPrompt(hub, s, 'lead', '/project'), /Lessons you keep for reviewers/);
  const oversizedLessons = settings.defaults();
  for (const role of ['reviewer', 'verifier', 'mapper', 'lead']) {
    oversizedLessons.lessons[role] = Array.from({ length: 12 }, (_, i) => ({ id: `L${String(i).padStart(6, '0')}`, text: 'x'.repeat(300), saved_by: 'agent', saved_at: new Date(0).toISOString() }));
  }
  assert.doesNotThrow(() => settings.assertFits(oversizedLessons));
  s.lessons.worker.push({ id: 'bad', text: 'bad' });
  assert.equal(settings.normalize(s).lessons.worker.length, 12);
  const invalidProvider = settings.defaults();
  invalidProvider.lessons.worker = [{ id: 'L123456', text: 'Invalid provider', provider: ['gpt'], saved_by: 'agent', saved_at: new Date(0).toISOString() }];
  assert.deepEqual(settings.normalize(invalidProvider).lessons.worker, []);
});

test('lead roleLayers keeps reviewer, verifier and mapper blocks', () => {
  const s = settings.defaults();
  for (const role of ['reviewer', 'verifier', 'mapper']) s.lessons[role] = [{ id: `L${role.padEnd(6, '0').slice(0, 6)}`, text: `${role} lesson`, ...(role === 'reviewer' ? { provider: 'gpt' } : {}), saved_by: 'agent', saved_at: new Date(0).toISOString() }];
  const text = settings.roleLayers(s, 'lead', '/project', null, 'claude').text;
  assert.match(text, /Lessons you keep for reviewers:/);
  assert.match(text, /Lessons you keep for verifiers:/);
  assert.match(text, /Lessons you keep for mappers:/);
  assert.match(text, /reviewer lesson \(only on GPT\)/);
});

test('card.js lesson validation refuses reviewer and missing why', () => {
  const valid = add({ for: 'reviewer' });
  const reviewer = validate('lesson', valid, 'reviewer');
  assert.equal(reviewer.ok, false);
  assert.match(reviewer.reason, /reviewer may not post lesson/);
  const missingWhy = validate('lesson', { ...add(), why: undefined }, 'worker');
  assert.equal(missingWhy.ok, false);
  assert.match(missingWhy.reason, /why/);
});

test('settings PUT merges edits and removals over HTTP', async () => {
  const c = await setup();
  try {
    const hub = new Hub({ stateDir: c.state, codeVersion: '' });
    await hub.state.init();
    await settings.applyLesson(hub, add(), 'worker', '/project', 'one');
    await settings.applyLesson(hub, add({ text: 'Second' }), 'worker', '/project', 'one');
    const initial = (await api(c, '/settings')).body.lessons.worker;
    await settings.applyLesson(hub, add({ text: 'Concurrent' }), 'worker', '/project', 'one');
    const result = await api(c, '/settings/lessons/worker', { method: 'PUT', body: { edits: [{ id: initial[0].id, text: 'Edited' }], removals: [initial[1].id] } });
    assert.equal(result.status, 200); assert.deepEqual(result.body.lessons.map((l) => l.text), ['Edited', 'Concurrent']);
    assert.equal(result.body.lessons[0].saved_by, 'user');
    assert.equal((await api(c, '/settings/lessons/worker', { method: 'PUT', body: { edits: [{ id: initial[1].id, text: 'Gone' }], removals: [] } })).status, 409);
    assert.equal((await api(c, '/settings/lessons/worker', { method: 'PUT', body: { edits: [{ id: initial[0].id, text: 'X', provider: 'gpt' }], removals: [] } })).status, 400);
  } finally { await close(c); }
});

test('all saver and target pairs enforce the role matrix', async () => {
  const hub = await fixture();
  const pairs = { lead: ['lead', 'reviewer', 'verifier', 'mapper'], 'sub-lead': ['sub-lead', 'worker'], worker: ['worker'], mapper: ['mapper'] };
  for (const [saver, targets] of Object.entries(pairs)) for (const target of settings.ROLES) {
    const operation = settings.applyLesson(hub, add({ for: target, text: `${saver} to ${target}` }), saver, '/project', 'one');
    if (targets.includes(target)) await operation;
    else await assert.rejects(operation, { status: 422, message: `a ${saver} may not save lessons for ${target}s` });
  }
  const worker = (await settings.load(hub)).lessons.worker[0];
  for (const action of ['replace', 'remove']) await assert.rejects(settings.applyLesson(hub, { ...add({ for: 'lead' }), action, lesson: worker.id }, 'lead', '/project', 'one'), /no lesson/);
});

test('machine refuses an unconfirmed lesson without spooling it', async () => {
  const fs = require('node:fs/promises');
  const http = require('node:http');
  const { MachineService } = require('../../machine/service');
  const dir = await makeTemp('lesson-machine-');
  const secret = path.join(dir, 'secret'); await fs.writeFile(secret, 'secret');
  await fs.writeFile(path.join(dir, 'machine.json'), JSON.stringify({ host: '127.0.0.1', port: 0, secret_file: secret, hub_url: 'http://127.0.0.1:1' }));
  const machine = new MachineService({ stateDir: dir, host: '127.0.0.1', port: 0, win: { procRoot: dir, etcRoot: dir, runRoot: dir } });
  await machine.init();
  machine.authorize = async () => ({ name: 'wc-one-worker', role: 'worker', thread_id: 'one' });
  const server = http.createServer((req, res) => machine.handle(req, res));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/agent/cards`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(add()) });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'the app did not confirm the lesson; run the same card again in a minute (repeating it is safe)');
    assert.deepEqual(await fs.readdir(path.join(dir, 'spool', 'cards')), []);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
