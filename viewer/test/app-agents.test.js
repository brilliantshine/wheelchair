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

test('agent tree retains live descendants and waiting follows actual starter', () => {
  const sessions = [
    { name: 'old', role: 'lead', created_at: '1', live: false },
    { name: 'new', role: 'lead', created_at: '2', live: true, turn_ended: true, token: 'secret' },
    { name: 'sub', role: 'sub-lead', started_by: 'old', live: false, turn_ended: true },
    { name: 'worker', role: 'worker', started_by: 'sub', live: true },
    { name: 'review', role: 'reviewer', started_by: 'new', live: true },
    { name: 'done', role: 'verifier', started_by: 'new', live: true, finished: true },
    { name: 'orphan', role: 'mapper', live: true },
    { name: 'dead', role: 'worker', started_by: 'new', live: false },
  ];
  const [tree] = buildAgents([{ id: 'a', title: 'A', lead_name: 'Alpha', sessions }]);
  assert.equal(tree.session.name, 'new');
  assert.equal(tree.session.token, undefined);
  assert.deepEqual(tree.session.waiting_on, ['review']);
  assert.deepEqual(tree.children.map((s) => s.name), ['sub', 'review', 'done', 'orphan']);
  assert.deepEqual(tree.children[0].waiting_on, ['worker']);
  assert.equal(tree.children[0].children[0].name, 'worker');
  assert.deepEqual(tree.children[0].children[0].waiting_on, []);
  assert.deepEqual(buildAgents([{ sessions: sessions.map((s) => ({ ...s, live: false })) }]), []);
  assert.deepEqual(buildAgents([{ archived: true, sessions }]), []);
});
