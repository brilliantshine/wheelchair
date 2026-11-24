'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { makeTemp } = require('../../test-support/run-dir');
const { Hub } = require('../app/hub');
const { validate } = require('../app/card');

const URL1 = 'https://github.com/o/r/pull/7';
const view = { number: 7, title: 'Fix parser', state: 'OPEN', author: { login: 'alice' }, headRefName: 'alice/fix', baseRefName: 'main', isCrossRepository: false, isDraft: false };
const make = (id, extra = {}) => ({ id, title: id, slug: id, machine: 'hub', project: '/p', branch: `wc/${id}`, default_branch: 'main', cli: 'claude', sessions: [{ name: `lead-${id}`, role: 'lead', live: true, turn_ended: true, queue: [] }], cards: [], pinned: {}, queues: {}, asides: [], ...extra });

// A stub gh on PATH; `script` is the shell body.
async function fixture(script = `printf '%s' '${JSON.stringify(view)}'`) {
  const dir = await makeTemp('permit-'); const bin = path.join(dir, 'bin'); await fs.mkdir(bin);
  await fs.writeFile(path.join(bin, 'gh'), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
  const old = process.env.PATH; process.env.PATH = `${bin}:${old}`;
  const hub = new Hub({ stateDir: path.join(dir, 'state'), codeVersion: '' }); await hub.state.init();
  hub.deliver = async () => {};
  await hub.state.save(make('one'));
  const stub = async (next) => { await fs.writeFile(path.join(bin, 'gh'), `#!/bin/sh\n${next}\n`, { mode: 0o755 }); };
  const post = (extra = {}) => hub.acceptCard({ thread_id: 'one', session: 'lead-one', kind: 'permit', pr_url: URL1, why: 'Fix its bug', ...extra });
  const press = (card, value = 'allow') => hub.press('one', card.id, { action: 'picked', value });
  const get = () => hub.state.thread('one');
  return { hub, post, press, get, stub, restore: () => { process.env.PATH = old; } };
}
const json = (change) => `printf '%s' '${JSON.stringify({ ...view, ...change })}'`;
const rejects = (promise, message) => assert.rejects(promise, e => e.status === 422 && e.message === message);

test('schema: lead only, both fields required, nothing else', () => {
  assert.equal(validate('permit', { pr_url: URL1, why: 'x' }, 'lead').ok, true);
  assert.equal(validate('permit', { pr_url: URL1, why: 'x' }, 'worker').ok, false);
  assert.equal(validate('permit', { pr_url: URL1 }, 'lead').ok, false);
  assert.equal(validate('permit', { why: 'x' }, 'lead').ok, false);
  assert.equal(validate('permit', { pr_url: URL1, why: 'x', extra: 1 }, 'lead').ok, false);
  assert.equal(validate('permit', { pr_url: URL1, why: 'a\nb' }, 'lead').ok, false);
});

test('refusals 1-9 and 4a, in order, and a refusal writes nothing', async () => {
  const cases = [
    [{ pr_url: 'https://example.com/o/r/pull/1' }, '', 'the pull request link is not a GitHub pull request'],
    [{}, 'echo boom >&2; exit 1', "couldn't reach GitHub to check the pull request; try again in a minute"],
    [{}, 'echo "HTTP 404: Not Found" >&2; exit 1', "the app's GitHub login can't read this pull request: HTTP 404: Not Found"],
    [{}, json({ state: 'CLOSED' }), 'that pull request is closed'],
    [{}, json({ isCrossRepository: true }), "that pull request comes from a fork; pushing to forks isn't supported yet"],
    [{}, json({ isDraft: true }), 'that pull request is a draft; ask the author to mark it ready first'],
    [{}, json({ baseRefName: 'dev' }), 'that pull request targets dev, not main'],
    [{}, json({ headRefName: 'wc/one' }), "that is this thread's own branch"],
  ];
  for (const [extra, script, reason] of cases) {
    const f = await fixture(script || undefined);
    try {
      const before = await f.get();
      await rejects(f.post(extra), reason);
      assert.deepEqual(await f.get(), before);
    } finally { f.restore(); }
  }
});

test('refusal 7: another thread by branch or by target_pr; not another project branch; yes another project target_pr', async () => {
  const f = await fixture();
  try {
    const other = make('two', { branch: 'alice/fix' });
    await f.hub.state.save(other);
    await rejects(f.post(), 'that branch belongs to the thread "two" on this hub');
    await f.hub.state.save({ ...other, archived: true });
    assert.equal((await f.post()).pr_number, 7); // archived does not count
    const g = await fixture();
    try {
      await g.hub.state.save(make('two', { project: '/elsewhere', branch: 'alice/fix' }));
      assert.equal((await g.post()).head_branch, 'alice/fix'); // another project's own branch does not block
      const h = await fixture();
      try {
        await h.hub.state.save(make('two', { project: '/elsewhere', branch: 'x', target_pr: { url: 'https://github.com/o/r/pull/9', head_branch: 'alice/fix' } }));
        await rejects(h.post(), 'that branch belongs to the thread "two" on this hub');
        await h.hub.state.save(make('two', { project: '/elsewhere', branch: 'x', target_pr: { url: 'https://github.com/o/other/pull/9', head_branch: 'alice/fix' } }));
        assert.equal((await h.post()).pr_number, 7); // same branch name in a different repository
      } finally { h.restore(); }
    } finally { g.restore(); }
  } finally { f.restore(); }
});

test('refusals 8 and 9', async () => {
  const f = await fixture();
  try {
    const first = await f.post();
    await rejects(f.post(), 'a permit request is already open');
    await f.press(first, "don't allow");
    assert.equal((await f.get()).target_pr, undefined);
    const again = await f.post(); // answered, so a new one is fine
    await f.press(again);
    await rejects(f.post(), `this thread already has an OK for ${URL1}`);
  } finally { f.restore(); }
});

test('accepted card stores copied fields; Allow sets target_pr and tells the lead', async () => {
  const f = await fixture();
  try {
    const card = await f.post();
    const stored = (await f.get()).cards[0];
    assert.deepEqual([stored.pr_number, stored.pr_title, stored.pr_author, stored.head_branch], [7, 'Fix parser', 'alice', 'alice/fix']);
    assert.equal((await f.get()).target_pr, undefined);
    await f.press(card);
    const t = await f.get();
    assert.deepEqual({ ...t.target_pr, allowed_at: undefined }, { url: URL1, number: 7, head_branch: 'alice/fix', title: 'Fix parser', author: 'alice', card: card.id, allowed_at: undefined });
    assert.ok(Date.parse(t.target_pr.allowed_at));
    assert.equal(t.cards[0].answered_value, 'allow');
    assert.equal(t.cards[0].allow_failed, undefined);
    assert.match(t.sessions[0].queue.at(-1).text, new RegExp(`\\[card ${card.id}\\] picked: allow`));
    await rejects(f.press(card), 'card is already answered');
  } finally { f.restore(); }
});

test('Allow after another thread claimed the branch gives allow failed; Don\'t allow changes nothing', async () => {
  const f = await fixture();
  try {
    const card = await f.post();
    await f.hub.state.save(make('two', { branch: 'alice/fix' }));
    await f.press(card);
    const t = await f.get();
    assert.equal(t.target_pr, undefined);
    assert.equal(t.cards[0].allow_failed, 'that branch belongs to the thread "two" on this hub');
    assert.equal(t.cards[0].answered, true);
    assert.match(t.sessions[0].queue.at(-1).text, /allow failed: that branch belongs to the thread "two" on this hub/);
  } finally { f.restore(); }
  const g = await fixture();
  try {
    const card = await g.post(); await g.press(card, "don't allow");
    const t = await g.get();
    assert.equal(t.target_pr, undefined);
    assert.equal(t.cards[0].answered_value, "don't allow");
    assert.match(t.sessions[0].queue.at(-1).text, /picked: don't allow/);
  } finally { g.restore(); }
});

test('retract while open; a press on a withdrawn card is refused', async () => {
  const f = await fixture();
  try {
    const card = await f.post();
    await f.hub.acceptCard({ thread_id: 'one', session: 'lead-one', kind: 'retract', card: card.id, note: 'Changed my mind' });
    assert.ok((await f.get()).cards[0].retracted_at);
    await assert.rejects(f.press(card), e => e.status === 422);
    assert.equal((await f.get()).target_pr, undefined);
    assert.equal((await f.post()).pr_number, 7); // the withdrawn one no longer counts as open
  } finally { f.restore(); }
});
