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
