'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { makeTemp } = require('../../test-support/run-dir');
const { Hub } = require('../app/hub');
const { validate } = require('../app/card');
const { judgePr } = require('../app/pr-gate');
const head = 'a'.repeat(40);
const card = { kind: 'done', title: 'Done', can_do: ['Use'], left_as_is: [], pr_url: 'https://github.com/o/r/pull/1', head };
const view = { state: 'OPEN', mergeStateStatus: 'CLEAN', headRefName: 'wc/one', baseRefName: 'main', headRefOid: head, statusCheckRollup: [] };
const thread = { id: 'one', branch: 'wc/one', default_branch: 'main', sessions: [{ name: 'lead', role: 'lead' }], cards: [], pinned: {}, queues: {}, asides: [], archived: false };
const failed = { __typename: 'CheckRun', name: 'tests', status: 'COMPLETED', conclusion: 'FAILURE' };
const pending = { __typename: 'StatusContext', context: 'build', state: 'PENDING' };

test('merge state and identity decisions', () => {
  const cases = [
    [{ state: 'MERGED' }, true], [{ state: 'MERGED', headRefOid: 'b'.repeat(40) }, 'the pull request is at bbbbbbb, not aaaaaaa'],
    [{ mergeStateStatus: 'CLEAN' }, true], [{ mergeStateStatus: 'HAS_HOOKS' }, true],
    [{ mergeStateStatus: 'BLOCKED', statusCheckRollup: [{ ...failed, conclusion: 'SUCCESS' }] }, true],
    [{ mergeStateStatus: 'BLOCKED', statusCheckRollup: [pending] }, 'checks not passed yet: build: running'],
    [{ mergeStateStatus: 'DIRTY' }, 'the pull request conflicts with main'], [{ mergeStateStatus: 'BEHIND' }, 'main moved on and must be merged in'],
    [{ mergeStateStatus: 'UNSTABLE', statusCheckRollup: [failed] }, 'checks not passed yet: tests: failed'],
    [{ mergeStateStatus: 'UNKNOWN' }, 'GitHub is still working out whether it can merge; try again in a minute'],
    [{ headRefName: 'other' }, "that pull request is not this thread's (its branch is other)"],
    [{ baseRefName: 'other' }, 'that pull request targets other'], [{ state: 'CLOSED' }, 'the pull request is closed'],
  ];
  for (const [change, expected] of cases) assert.deepEqual(judgePr({ ...view, ...change }, thread, card), expected === true ? { ok: true } : { ok: false, reason: expected });
});

async function fixture(script) {
  const dir = await makeTemp('done-gate-'); const bin = path.join(dir, 'bin'); await fs.mkdir(bin);
  const calls = path.join(dir, 'calls');
  await fs.writeFile(path.join(bin, 'gh'), `#!/bin/sh\nprintf 'call\\n' >> '${calls}'\n${script}\n`, { mode: 0o755 });
  const old = process.env.PATH; process.env.PATH = `${bin}:${old}`;
  const hub = new Hub({ stateDir: path.join(dir, 'state'), codeVersion: '' }); await hub.state.init(); await hub.save(structuredClone(thread));
  return { hub, calls, dir, restore: () => { process.env.PATH = old; } };
}
const payload = (extra = {}) => ({ ...card, session: 'lead', thread_id: 'one', ...extra });
const calls = (f) => fs.readFile(f.calls, 'utf8').catch(() => '');

test('hub accepts a matching merged PR', async () => {
  const f = await fixture(`printf '%s' '${JSON.stringify({ ...view, state: 'MERGED' })}'`);
  try { await f.hub.acceptCard(payload()); assert.equal((await f.hub.state.thread('one')).cards.length, 1); assert.equal((await calls(f)).trim(), 'call'); } finally { f.restore(); }
});

test('invalid schema and URL skip gh, and refusal never writes the thread', async () => {
  const f = await fixture('exit 1');
  try {
    const file = f.hub.threadPath('one'); const before = await fs.readFile(file, 'utf8');
    for (const value of [undefined, 'xyz', 'A'.repeat(40)]) {
      assert.equal(validate('done', { ...card, head: value }, 'lead').ok, false);
      await assert.rejects(f.hub.acceptCard(payload({ head: value })), /invalid or missing field: head/);
    }
    await assert.rejects(f.hub.acceptCard(payload({ pr_url: 'https://example.com/pull/1' })), /not a GitHub pull request/);
    assert.equal(await calls(f), ''); assert.equal(await fs.readFile(file, 'utf8'), before);
  } finally { f.restore(); }
});

test('gh failures and authentication refusals', async () => {
  for (const [script, reason] of [['exit 1', "couldn't reach GitHub to check the pull request; try again in a minute"], ["echo 'HTTP 403 denied' >&2; exit 1", "the app's GitHub login can't read this pull request: HTTP 403 denied"], ["printf 'no json'", "couldn't reach GitHub to check the pull request; try again in a minute"]]) {
    const f = await fixture(script);
    try { await assert.rejects(f.hub.acceptCard(payload()), { status: 422, message: reason }); } finally { f.restore(); }
  }
});

test('slow gh does not hold the thread lock', async () => {
  const f = await fixture(`sleep 3\nprintf '%s' '${JSON.stringify(view)}'`);
  try {
    const done = f.hub.acceptCard(payload());
    for (let i = 0; i < 100 && !(await calls(f)); i++) await new Promise((r) => setTimeout(r, 10));
    assert.ok(await calls(f));
    const start = Date.now();
    await f.hub.acceptCard({ thread_id: 'one', session: 'lead', kind: 'needs', title: 'Waiting', body: 'Still working' });
    assert.ok(Date.now() - start < 1500);
    await done;
  } finally { f.restore(); }
});

test('target PR uses its head branch only for the exact URL', () => {
  const target = { ...thread, target_pr: { url: card.pr_url, head_branch: 'author/fix' } };
  assert.deepEqual(judgePr({ ...view, headRefName: 'author/fix' }, target, card), { ok: true });
  assert.deepEqual(judgePr({ ...view, headRefName: 'author/fix' }, target, { ...card, pr_url: 'https://github.com/o/r/pull/2' }), { ok: false, reason: "that pull request is not this thread's (its branch is author/fix)" });
  assert.deepEqual(judgePr({ ...view, headRefName: 'author/fix', baseRefName: 'other' }, target, card), { ok: false, reason: 'that pull request targets other' });
});
