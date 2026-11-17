'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { makeTemp } = require('../../test-support/run-dir');
const sessions = require('../app/sessions');
const history = require('../app/step-history');
const { buildAgents } = require('../app/agents');

async function fixture() {
  const stateDir = await makeTemp('activity-');
  const start = new Date(Date.now() - 20000).toISOString();
  const s = { name: 'lead', role: 'lead', live: true, ready: true, turn_started_at: start, turn_ended: false, queue: [{ text: 'queued' }], turns: [{ started_at: start, ended_at: null }] };
  const thread = { id: 't', project: '/one/project', title: 'T', sessions: [s], cards: [] };
  const hub = { stateDir, thread: async () => thread, save: async () => {}, call: async () => { throw Error('unexpected delivery'); } };
  const event = payload => sessions.event(hub, { thread_id: 't', session: 'lead', ...payload });
  const stamp = ms => new Date(Date.parse(start) + ms).toISOString();
  const begin = (id, ms = 6000, kind = 'shell') => event({ type: 'step', phase: 'start', step: { id, kind, label: id, key: `${kind}:test`, started_at: stamp(ms) } });
  const end = (id, ms = 7000, clean = true, failed = false) => event({ type: 'step', phase: 'end', step: { id, ended_at: stamp(ms), clean, failed } });
  return { stateDir, s, thread, event, begin, end, stamp };
}

test('events pair in either order, upgrade closure once, and preserve turn and queue', async () => {
  const f = await fixture();
  await f.end('a'); await f.begin('a'); await f.begin('a'); await f.end('a');
  assert.equal(f.s.steps.length, 1); assert.equal(f.s.step_counts.shell, 1); assert.equal(f.s.step_counts.thinking, 1);
  await f.begin('b', 8000); assert.equal(f.s.queue.length, 1); f.s.queue = []; await f.event({ type: 'turn-ended' });
  assert.equal(f.s.steps.find(s => s.id === 'b').clean, false);
  await f.end('b', 9000); await f.end('b', 10000);
  const rows = (await fs.readFile(history.file(f.stateDir, f.thread.project), 'utf8')).trim().split('\n');
  assert.equal(rows.length, 2); assert.equal(f.s.steps.find(s => s.id === 'b').ended_at, f.stamp(9000));
});

test('retention, parallel current, trail, failures and context', async () => {
  const f = await fixture();
  await f.event({ type: 'context', context: { percent: 20, at: f.stamp(2) } });
  await f.event({ type: 'context', context: { percent: 5, at: f.stamp(1) } });
  for (let i = 0; i < 32; i++) { await f.begin(`s${i}`, 10 + i * 2); await f.end(`s${i}`, 11 + i * 2, true, i === 31); }
  await f.begin('running1', 100, 'files'); await f.begin('running2', 101, 'files');
  const node = buildAgents([f.thread])[0].session;
  assert.equal(f.s.steps.length, 32); assert.equal(node.activity.current.id, 'running2');
  assert.deepEqual(node.activity.trail, ['shell', 'files']);
  assert.equal(node.activity.latest[2].label, 'Failed: s31'); assert.equal(node.context.percent, 20);
  assert.equal(f.s.turn_ended, false); assert.equal(f.s.queue.length, 1);
});

test('history median, isolation and pruning', async () => {
  const f = await fixture();
  for (let i = 1; i <= 6; i++) await history.append(f.stateDir, '/one/project', { kind: 'shell', key: 'x', started_at: f.stamp(0), ended_at: f.stamp(i * 1000) });
  await history.append(f.stateDir, '/two/project', { kind: 'shell', key: 'x', started_at: f.stamp(0), ended_at: f.stamp(90000) });
  assert.deepEqual(await history.normal(f.stateDir, '/one/project', 'x'), { samples: [2000, 3000, 4000, 5000, 6000], typical_ms: 4000 });
  await history.prune(f.stateDir, Date.now() + 31 * 86400_000);
  assert.equal(await history.normal(f.stateDir, '/one/project', 'x'), null);
});

test('late starts and pending ends expire, with bounded running steps', async () => {
  const f = await fixture();
  await f.end('expired'); f.s.pending_ends.expired.received_at = new Date(Date.now() - 601000).toISOString();
  await f.begin('expired'); assert.equal(f.s.steps[0].ended_at, undefined);
  for (let i = 0; i < 51; i++) await f.begin(`live${i}`, 7000 + i);
  assert.equal(f.s.steps.filter(s => !s.ended_at).length, 50);
  f.s.turns = [{ started_at: f.stamp(1000), ended_at: f.stamp(9000) }];
  await f.begin('late', 8000); assert.equal(f.s.steps.find(s => s.id === 'late').ended_at, f.stamp(9000));
  await f.begin('old', 0); assert.equal(f.s.steps.find(s => s.id === 'old').ended_at, f.stamp(0));
  f.s.live = false; f.s.ended_at = f.stamp(10000);
  await f.begin('after', 11000); assert.equal(f.s.steps.find(s => s.id === 'after').clean, false);
});

test('thinking gaps and current choose the latest running step, then the previous one', async () => {
  const f = await fixture();
  await f.begin('quick', 4000); await f.end('quick', 4500);
  assert.equal(f.s.step_counts.thinking, 0);
  await f.begin('one', 9500, 'files'); await f.begin('two', 9600, 'web');
  assert.equal(f.s.step_counts.thinking, 1);
  assert.equal(buildAgents([f.thread])[0].session.activity.current.id, 'two');
  await f.end('two', 9700);
  assert.equal(buildAgents([f.thread])[0].session.activity.current.id, 'one');
  await f.end('one', 9800);
  const current = buildAgents([f.thread])[0].session.activity.current;
  assert.equal(current.kind, 'thinking'); assert.equal(current.since, f.stamp(9800));
  f.s.live = false;
  assert.equal(buildAgents([f.thread])[0].session.activity.current, null);
});

test('pending ends are bounded and old history is excluded from normal', async () => {
  const f = await fixture();
  for (let i = 0; i < 51; i++) await f.end(`unknown${i}`);
  assert.equal(Object.keys(f.s.pending_ends).length, 50);
  const old = new Date(Date.now() - 31 * 86400_000).toISOString();
  await history.append(f.stateDir, f.thread.project, { kind: 'shell', key: 'old', started_at: old, ended_at: old });
  assert.equal(await history.normal(f.stateDir, f.thread.project, 'old'), null);
});

test('mid-turn delivery closes the preceding turn for late step starts', async () => {
  const f = await fixture();
  f.s.role = 'worker';
  const hub = { call: async () => {}, appendSent: async () => {}, save: async () => {} };
  assert.equal(await sessions.deliver(hub, f.thread, f.s, { midTurn: true }), true);
  const end = f.s.turns[0].ended_at;
  assert.equal(end, f.s.turns[1].started_at);
  await f.begin('late-mid-turn', 6000);
  assert.equal(f.s.steps.find(s => s.id === 'late-mid-turn').ended_at, end);
  assert.equal(f.s.steps.find(s => s.id === 'late-mid-turn').clean, false);
});
