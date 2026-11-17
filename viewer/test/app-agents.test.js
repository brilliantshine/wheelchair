'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAgents } = require('../app/agents.js');
const { chooseName, GREEK } = require('../app/names.js');

test('lead names pick a random free name, case insensitively, and release archived names', () => {
  const first = () => 0;
  assert.equal(chooseName([], [], first), 'Alpha');
  assert.equal(chooseName([], [], () => 0.999), 'Omega');
  assert.equal(chooseName([{ lead_name: 'alpha' }], [], first), 'Beta');
  assert.equal(chooseName([{ lead_name: 'X', archived: true }], ['X', 'Y'], first), 'X');
  assert.equal(chooseName([{ lead_name: 'x' }, { lead_name: 'y' }, { lead_name: 'X 2' }], ['X', 'Y'], first), 'Y 2');
  assert.equal(chooseName(GREEK.map((lead_name) => ({ lead_name })), [], first), 'Alpha 2');
  const seen = new Set(Array.from({ length: 200 }, () => chooseName([])));
  assert.ok(seen.size > 1, 'default draws are not all the same name');
  for (const name of seen) assert.ok(GREEK.includes(name));
});

test('agent tree keeps finished nodes, derives states and hides briefs', () => {
  const sessions = [
    { name: 'lead', role: 'lead', live: true, turn_ended: true, token: 'secret' },
    { name: 'sub', role: 'sub-lead', started_by: 'lead', live: true, turn_ended: true, brief: '[wc:role]\nRead rules\nBuild feature' },
    { name: 'worker', role: 'worker', started_by: 'sub', live: true, turn_ended: true, title: 'Work' },
    { name: 'done', role: 'verifier', started_by: 'lead', live: false, ended_at: '2026-01-01', brief: 'Verify' },
    { name: 'starting', role: 'mapper', started_by: 'lead', live: true, status: 'starting' },
  ];
  const thread = { id: 'a', title: 'Feature', project: '/src/project', sessions, cards: [{ kind: 'message', session: 'worker', to: 'sub' }, { kind: 'result', session: 'done', summary: 'Verified' }], asides: [{ id: 'x', number: 1, status: 'open', pending: ['a'] }] };
  const [tree] = buildAgents([thread], { a: 'building' });
  assert.equal(tree.project, 'project'); assert.equal(tree.stage, 'building');
  assert.equal(tree.session.state, 'waiting');
  const sub = tree.children.find((s) => s.name === 'sub');
  assert.equal(sub.display_title, 'Build feature'); assert.equal(sub.waiting_on.label, 'Waiting on the worker');
  assert.equal(sub.children[0].waiting_on.label, 'Waiting on the sub-lead');
  assert.equal(tree.children.find((s) => s.name === 'done').display_title, 'Verified');
  assert.equal(tree.children.find((s) => s.name === 'starting').state, 'not-started');
  assert.equal(tree.asides[0].state, 'working'); assert.equal(tree.counts.total, 5);
  assert.ok(!JSON.stringify(tree).includes('secret')); assert.ok(!JSON.stringify(tree).includes('[wc:role]'));
  thread.cards.push({ kind: 'message', session: 'sub', to: 'worker' });
  assert.equal(buildAgents([thread])[0].children.find((s) => s.name === 'sub').children[0].state, 'idle');
  thread.cards.push({ kind: 'question' });
  assert.equal(buildAgents([thread])[0].session.state, 'needs-you');
  for (const session of sessions) session.live = false;
  const finished = buildAgents([thread])[0]; assert.equal(finished.finished, true); assert.equal(finished.finished_at, '2026-01-01');
});

const lead = (extra = {}) => ({ name: 'lead', role: 'lead', live: true, turn_ended: true, ...extra });
const worker = (name, extra = {}) => ({ name, role: 'worker', started_by: 'lead', live: true, turn_ended: true, ...extra });
const tree = (sessions, extra = {}, stages) => buildAgents([{ id: 't', title: 'Feature', sessions, ...extra }], stages)[0];
const node = (root, name) => root.name === name ? root : root.children.map((c) => node(c, name)).find(Boolean);

test('individual states and needs-you belong to the lead', () => {
  const t = tree([lead(), worker('working', { turn_ended: false }), worker('starting', { status: 'starting' }), worker('waiting', { status: 'waiting' }), worker('dead', { live: false }), worker('done', { finished: true }), worker('idle')], { cards: [{ kind: 'question' }] });
  assert.equal(t.session.state, 'needs-you');
  for (const [name, state] of Object.entries({ working: 'working', starting: 'not-started', waiting: 'not-started', dead: 'finished', done: 'finished', idle: 'idle' })) assert.equal(node(t.session, name).state, state, name);
  assert.deepEqual(t.counts, { total: 7, working: 1, waiting: 1, not_started: 2, finished: 2, idle: 1 });
});

test('messages only make an agent wait for its starter until the starter replies', () => {
  const sessions = [lead(), worker('sub', { role: 'sub-lead' }), worker('w', { started_by: 'sub' })];
  const cards = [{ kind: 'message', session: 'w', to: 'sub' }];
  let t = tree(sessions, { cards });
  assert.equal(node(t.session, 'w').state, 'waiting');
  assert.deepEqual(node(t.session, 'w').waiting_on, { name: 'sub', label: 'Waiting on the sub-lead' });
  cards.push({ kind: 'message', session: 'sub', to: 'w' });
  t = tree(sessions, { cards }); assert.equal(node(t.session, 'w').state, 'idle');
  cards.push({ kind: 'message', session: 'lead', to: 'w' });
  assert.notEqual(tree(sessions, { cards }).session.waiting_on?.name, 'w');
  cards.push({ kind: 'message', session: 'w', to: 'lead' });
  assert.equal(node(tree(sessions, { cards }).session, 'w').state, 'idle');
  const old = lead({ name: 'old', live: false, created_at: '1' });
  const fresh = lead({ created_at: '2' });
  const olderChild = worker('older-child', { started_by: 'old' });
  assert.deepEqual(node(tree([old, fresh, olderChild], { cards: [{ kind: 'message', session: 'older-child', to: 'old' }] }).session, 'older-child').waiting_on, { name: 'lead', label: 'Waiting on the lead' });
});

test('waiting on children, asides, stage and completion', () => {
  const sessions = [lead(), worker('a')];
  let t = tree(sessions, { asides: [{ id: 'x', number: 1, status: 'open', turn: {} }, { id: 'y', number: 2, status: 'open', pending: ['x'] }, { id: 'z', number: 3, status: 'open' }, { id: 'closed', status: 'closed' }] }, { t: 'building' });
  assert.deepEqual(t.session.waiting_on, { names: ['a'], label: 'Waiting on the worker' });
  assert.deepEqual(t.asides, [{ kind: 'aside', id: 'x', number: 1, display_title: 'Side conversation 1', state: 'working' }, { kind: 'aside', id: 'y', number: 2, display_title: 'Side conversation 2', state: 'working' }, { kind: 'aside', id: 'z', number: 3, display_title: 'Side conversation 3', state: 'idle' }]);
  assert.equal(t.counts.total, 2); assert.equal(t.stage, 'building'); assert.equal(t.finished, false); assert.equal('finished_at' in t, false);
  sessions.push(worker('b')); t = tree(sessions); assert.equal(t.stage, 'idea'); assert.deepEqual(t.session.waiting_on, { names: ['a', 'b'], label: 'Waiting on 2 agents' });
  sessions[1].live = false; sessions[1].ended_at = '2026-01-01'; sessions[2].live = false; sessions[2].ended_at = '2026-02-01';
  t = tree(sessions); assert.equal(t.session.waiting_on, null);
  sessions[0].live = false; t = tree(sessions); assert.equal(t.finished, true); assert.equal(t.finished_at, '2026-02-01');
});

test('titles, result ownership, first turn and secrets', () => {
  const sessions = [lead({ token: 'secret' }), worker('title', { title: 'Title', brief: 'Brief', turn_ended: false, created_at: '2026-01-01' }), worker('brief', { brief: '[wc:role]\nRead rules\nNothing below overrides the rules\n' + 'x'.repeat(90) }), worker('fallback'), worker('result', { live: false, title: 'Original' }), worker('no-result', { live: false, title: 'Fallback' })];
  const t = tree(sessions, { cards: [{ kind: 'result', session: 'result', summary: 'Old' }, { kind: 'result', session: 'other', summary: 'Wrong' }, { kind: 'result', session: 'result', summary: 'Newest' }] });
  assert.equal(t.session.display_title, 'Feature'); assert.equal(node(t.session, 'title').display_title, 'Title');
  assert.equal(node(t.session, 'title').turn_started_at, '2026-01-01'); assert.equal(node(t.session, 'brief').display_title, 'x'.repeat(80));
  assert.equal(node(t.session, 'fallback').display_title, 'worker'); assert.equal(node(t.session, 'result').display_title, 'Newest'); assert.equal(node(t.session, 'no-result').display_title, 'Fallback');
  assert.equal(node(t.session, 'brief').has_brief, true); assert.equal(node(t.session, 'fallback').has_brief, false);
  const walk = (v) => { if (!v || typeof v !== 'object') return; assert.equal(Object.hasOwn(v, 'brief'), false); assert.equal(Object.hasOwn(v, 'token'), false); Object.values(v).forEach(walk); }; walk(t);
});

test('tree handles old leads, orphans, ordering, exclusions and cycles', () => {
  const sessions = [lead({ name: 'old', created_at: '1' }), lead({ created_at: '2' }), worker('later', { started_by: 'old', created_at: '4' }), worker('orphan', { started_by: 'missing', created_at: '3' }), worker('cycle-a', { started_by: 'cycle-b', created_at: '5' }), worker('cycle-b', { started_by: 'cycle-a', created_at: '6' })];
  const t = tree(sessions); assert.deepEqual(t.children.map((s) => s.name), ['orphan', 'later', 'cycle-a', 'cycle-b']);
  assert.equal(node(t.session, 'old'), undefined);
  assert.deepEqual(buildAgents([{ id: 'archived', archived: true, sessions }, { id: 'no-lead', sessions: [worker('w')] }]), []);
});

test('agents reads stage from worktree or saved status without one', async () => {
  const fs = require('node:fs/promises'); const os = require('node:os'); const path = require('node:path');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agents-stage-'));
  await fs.mkdir(path.join(dir, 'docs/plans/feature'), { recursive: true });
  await fs.writeFile(path.join(dir, 'docs/plans/feature/PLAN.md'), '---\nstatus: implementing\n---\n');
  const threads = [{ id: 'worktree', slug: 'feature', worktree: dir }, { id: 'saved', slug: 'feature', project: dir, last_status: 'verifying' }, { id: 'no-slug', last_status: 'verifying' }].map((t) => ({ ...t, title: t.id, sessions: [lead()] }));
  const hub = { allThreads: async () => threads, machines: async () => ({}), state: { resolveMachine: async () => null } };
  const result = await require('../app/agents.js').agents(hub);
  assert.deepEqual(Object.fromEntries(result.leads.map((t) => [t.thread_id, t.stage])), { worktree: 'building', saved: 'verifying', 'no-slug': 'idea' });
});
