'use strict';
require('./helpers/isolate-models.js');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { makeTemp } = require('../../test-support/run-dir');
const { Hub } = require('../app/hub');
const settings = require('../app/settings');
const merge = require('../app/auto-merge');
const { validate, resolvable } = require('../app/card');
const { dismiss } = require('../app/threads');
const head = 'a'.repeat(40), url = 'https://github.com/o/r/pull/1';
const step = { where: 'app', do: 'Open', see: 'Open', agent: 'matched' };
const done = { kind: 'done', title: 'Done', can_do: [], left_as_is: [], head, pr_url: url, verified: true, created_at: '2026-01-01T00:00:00Z' };
const check = { kind: 'check', id: 'check', head, steps: [step] };
merge.timing.retryMs = 20; merge.timing.waitMs = 20; merge.timing.mergeTimeoutMs = 5000;
async function fixture(script = '') {
  const dir = await makeTemp('auto-merge-'), bin = path.join(dir, 'bin'), log = path.join(dir, 'calls');
  await fs.mkdir(bin);
  await fs.writeFile(path.join(bin, 'gh'), `#!/bin/sh\nprintf '%s\\n' "$*" >> '${log}'\n${script}\n`, { mode: 0o755 });
  const old = process.env.PATH; process.env.PATH = `${bin}:${old}`;
  const hub = new Hub({ stateDir: path.join(dir, 'state'), codeVersion: '' }); await hub.state.init();
  await settings.update(hub, v => { v.auto_merge = 'on'; });
  const thread = { id: 'one', project: '/tmp/project', machine: 'hub', branch: 'branch', default_branch: 'main', sessions: [], cards: [done, check], pinned: {}, queues: {}, asides: [] };
  await hub.save(thread);
  return { hub, thread, dir, log, restore: () => { process.env.PATH = old; }, calls: async () => (await fs.readFile(log, 'utf8').catch(() => '')).trim().split('\n').filter(Boolean), run: async () => { merge.afterCheck(hub, 'one', 'check'); await merge.settled(); return hub.thread('one'); } };
}
const view = (status = 'CLEAN', state = 'OPEN', extra = { isCrossRepository: false }) => JSON.stringify({ state, mergeStateStatus: status, headRefName: 'branch', baseRefName: 'main', headRefOid: head, statusCheckRollup: [], ...extra });
const script = (status = 'CLEAN', state = 'OPEN', api = `printf '{"merged":true}'`, extra) => `if [ "$1" = pr ]; then printf '%s' '${view(status, state, extra)}'; else ${api || ':'}; fi`;

test('done verified validation', () => { for (const v of [true, false, undefined]) assert.equal(validate('done', (({ created_at, ...rest }) => ({ ...rest, verified: v }))(done), 'lead').ok, true); assert.equal(validate('done', (({ created_at, ...rest }) => ({ ...rest, verified: 'yes' }))(done), 'lead').ok, false); });
test('silent gates and held gates', async () => {
  for (const kind of ['off', 'head', 'attempt', 'broken', 'imported', 'unverified', 'unmatched']) {
    const f = await fixture(); try {
      const t = await f.hub.thread('one');
      if (kind === 'off') await settings.update(f.hub, v => { v.auto_merge = 'off'; });
      if (kind === 'head') t.cards[1].head = 'b'.repeat(40);
      if (kind === 'attempt') t.auto_merge_attempts = { [head]: { outcome: 'started' } };
      if (kind === 'broken') t.cards[1].steps = [{ ...step, agent: 'broken' }];
      if (kind === 'imported') t.imported = { at: '2020-01-01' };
      if (kind === 'unverified') delete t.cards[0].verified;
      if (kind === 'unmatched') t.cards[1].steps = [{ ...step, agent: 'not-tried' }];
      await f.hub.save(t); const result = await f.run();
      assert.deepEqual(await f.calls(), [], kind);
      const held = ['imported', 'unverified', 'unmatched'].includes(kind);
      assert.equal(result.cards.some(c => c.auto_merge), held, kind);
      if (held) assert.equal(result.auto_merge_attempts[head].outcome, 'held');
    } finally { f.restore(); }
  }
});
test('held gate does not add notice when pull request already has a merged card', async () => {
  const f = await fixture(); try {
    const t = await f.hub.thread('one');
    t.cards[1].steps = [{ ...step, agent: 'not-tried' }];
    t.cards.push({ kind: 'merged', pr_url: url });
    await f.hub.save(t);
    const result = await f.run();
    assert.equal(result.auto_merge_attempts[head].outcome, 'held');
    assert.ok(!result.auto_merge_attempts[head].card);
    assert.ok(!result.cards.some(c => c.auto_merge));
    assert.deepEqual(await f.calls(), []);
  } finally { f.restore(); }
});
test('GitHub outcomes and exact merge arguments', async () => {
  for (const [status, state, api, outcome, message] of [
    ['UNKNOWN', 'OPEN', '', 'not-ready', 'still working out'], ['CLEAN', 'MERGED', '', 'already-merged'], ['CLEAN', 'CLOSED', '', 'closed'],
    ['BLOCKED', 'OPEN', '', 'not-ready', 'review'], ['CLEAN', 'OPEN', `printf '{"merged":true}'`, 'merged'],
    ['CLEAN', 'OPEN', `printf '{"message":"Required review missing"}'; exit 1`, 'failed', 'Required review missing'],
  ]) {
    const f = await fixture(script(status, state, api)); try {
      if (status === 'UNKNOWN') { merge.timing.retryMs = 50; merge.timing.waitMs = 1500; }
      const result = await f.run(); assert.equal(result.auto_merge_attempts[head].outcome, outcome);
      const calls = await f.calls();
      if (['merged', 'failed'].includes(outcome)) assert.equal(calls.at(-1), `api -X PUT repos/o/r/pulls/1/merge -f sha=${head} -f merge_method=merge`);
      else assert.ok(calls.every(c => c.startsWith('pr view ')));
      if (status === 'UNKNOWN') assert.ok(calls.length > 1);
      if (message) assert.ok(result.cards.find(c => c.auto_merge).body.toLowerCase().includes(message.toLowerCase()));
      else assert.ok(!result.cards.some(c => c.auto_merge));
      await f.run(); assert.deepEqual(await f.calls(), calls);
    } finally { merge.timing.retryMs = 20; merge.timing.waitMs = 20; f.restore(); }
  }
});
test('dismiss auto-merge card and refuse lead resolution', async () => {
  const f = await fixture(); try { const t = await f.hub.thread('one'); t.cards.push({ kind: 'needs', id: 'n', system: true, auto_merge: true, answered: false }); await f.hub.save(t);
    assert.equal(resolvable(t, 'n', 'lead').ok, false); await dismiss(f.hub, 'one', 'n'); assert.equal((await f.hub.thread('one')).cards.at(-1).answered, true);
  } finally { f.restore(); }
});


async function waitForCall(f) {
  for (let i = 0; i < 500; i++) {
    if ((await f.calls()).length) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('gh did not start');
}
async function addLead(f) {
  const t = await f.hub.thread('one');
  t.sessions.push({ name: 'lead', role: 'lead', live: false });
  await f.hub.save(t);
}
const post = (f, card, session = 'lead') => f.hub.acceptCard({ ...card, thread_id: 'one', session });
const needs = { kind: 'needs', id: 'notice', system: true, auto_merge: true, auto_merge_head: head, answered: false };

test('result delivery includes commit when supplied', async () => {
  const f = await fixture();
  try {
    const t = await f.hub.thread('one');
    t.sessions = [{ name: 'lead', role: 'lead', queue: [] }, { name: 'worker', role: 'worker', started_by: 'lead' }];
    await f.hub.save(t); f.hub.deliver = async () => {};
    await post(f, { kind: 'result', task: 'T2', outcome: 'done', summary: 'Finished', commit: head }, 'worker');
    await post(f, { kind: 'result', task: 'T2', outcome: 'done', summary: 'Finished again' }, 'worker');
    assert.deepEqual((await f.hub.thread('one')).sessions[0].queue.map(q => q.text), [
      `[wc:from worker] result (commit ${head}): Finished`, '[wc:from worker] result: Finished again',
    ]);
  } finally { f.restore(); }
});

test('accepting a check triggers auto-merge', async () => {
  const f = await fixture(script());
  try {
    await addLead(f); const t = await f.hub.thread('one'); t.cards = [t.cards[0]]; await f.hub.save(t);
    await post(f, { kind: 'check', head, update: 'Checked', steps: [step] });
    await merge.settled();
    assert.ok((await f.calls())[0].startsWith(`pr view ${url} `));
    assert.equal((await f.hub.thread('one')).auto_merge_attempts[head].outcome, 'merged');
  } finally { await merge.settled(); f.restore(); }
});

test('switching off during the readiness wait prevents merge', async () => {
  const f = await fixture(); const gate = path.join(f.dir, 'gate'), count = path.join(f.dir, 'count');
  try {
    await fs.writeFile(path.join(f.dir, 'bin', 'gh'), `#!/bin/sh\nprintf '%s\\n' "$*" >> '${f.log}'\nif [ ! -f '${count}' ]; then touch '${count}'; while [ ! -f '${gate}' ]; do sleep 0.01; done; printf '%s' '${view('UNKNOWN')}'; else printf '%s' '${view()}'; fi\n`, { mode: 0o755 });
    merge.timing.waitMs = 1000;
    merge.afterCheck(f.hub, 'one', 'check'); await waitForCall(f);
    await settings.update(f.hub, v => { v.auto_merge = 'off'; }); await fs.writeFile(gate, ''); await merge.settled();
    const t = await f.hub.thread('one');
    assert.equal(t.auto_merge_attempts[head].outcome, 'switched-off');
    assert.ok((await f.calls()).length >= 2); assert.ok((await f.calls()).every(c => c.startsWith('pr view ')));
    assert.ok(!t.cards.some(c => c.auto_merge));
  } finally { await fs.writeFile(gate, ''); await merge.settled(); merge.timing.waitMs = 20; f.restore(); }
});

test('merge timeout produces unknown and its specific notice', async () => {
  const f = await fixture(script('CLEAN', 'OPEN', 'exec sleep 5'));
  try {
    merge.timing.mergeTimeoutMs = 300;
    const t = await f.run();
    assert.equal(t.auto_merge_attempts[head].outcome, 'unknown');
    assert.equal(t.cards.find(c => c.auto_merge).body, "GitHub didn't answer in time; check the pull request on GitHub.");
  } finally { merge.timing.mergeTimeoutMs = 5000; f.restore(); }
});

test('finishing respects concurrent merged, newer done, and unrelated cards', async () => {
  for (const change of ['merged', 'newer', 'unrelated']) {
    const f = await fixture(); const gate = path.join(f.dir, 'gate');
    try {
      await fs.writeFile(path.join(f.dir, 'bin', 'gh'), `#!/bin/sh\nprintf '%s\\n' "$*" >> '${f.log}'\nwhile [ ! -f '${gate}' ]; do sleep 0.01; done\nprintf '%s' '${view('BLOCKED')}'\n`, { mode: 0o755 });
      merge.afterCheck(f.hub, 'one', 'check'); await waitForCall(f);
      await f.hub.withThread('one', async () => {
        const t = await f.hub.thread('one');
        if (change === 'merged') t.cards.push({ kind: 'merged', pr_url: url });
        if (change === 'newer') t.cards.push({ ...done, head: 'b'.repeat(40) });
        if (change === 'unrelated') t.cards.push({ kind: 'needs', id: 'concurrent', title: 'Concurrent writer' });
        await f.hub.save(t);
      });
      await fs.writeFile(gate, ''); await merge.settled();
      const t = await f.hub.thread('one');
      assert.equal(t.auto_merge_attempts[head].outcome, 'not-ready', change);
      assert.equal(t.cards.some(c => c.auto_merge), change === 'unrelated', change);
      if (change === 'unrelated') assert.ok(t.cards.some(c => c.id === 'concurrent'));
    } finally { await fs.writeFile(gate, ''); await merge.settled(); f.restore(); }
  }
});

test('pollMerged closes open auto-merge notices', async () => {
  const f = await fixture(`printf '{"state":"MERGED"}'`);
  try {
    const t = await f.hub.thread('one'); t.cards.push({ ...needs }); await f.hub.save(t);
    await f.hub.pollMerged(); const fresh = await f.hub.thread('one');
    assert.ok(fresh.cards.some(c => c.kind === 'merged' && c.pr_url === url));
    assert.equal(fresh.cards.find(c => c.id === 'notice').resolved_note, 'Merged');
    assert.equal(fresh.cards.find(c => c.id === 'notice').answered, true);
  } finally { f.restore(); }
});

test('done acceptance closes notices for older heads and leaves same head open', async () => {
  for (const newHead of [head, 'b'.repeat(40)]) {
    const f = await fixture(`printf '%s' '${JSON.stringify({ ...JSON.parse(view()), headRefOid: newHead })}'`);
    try {
      await addLead(f); const t = await f.hub.thread('one'); t.cards.push({ ...needs }); await f.hub.save(t);
      const { created_at, ...input } = done;
      await post(f, { ...input, head: newHead });
      const notice = (await f.hub.thread('one')).cards.find(c => c.id === 'notice');
      assert.equal(notice.answered, newHead !== head);
      if (newHead !== head) assert.equal(notice.resolved_note, 'Replaced by a newer version');
    } finally { f.restore(); }
  }
});

test('lead resolve through acceptCard refuses auto-merge needs', async () => {
  const f = await fixture();
  try {
    await addLead(f); const t = await f.hub.thread('one'); t.cards.push({ ...needs }); await f.hub.save(t);
    await assert.rejects(post(f, { kind: 'resolve', card: 'notice', note: 'Resolved' }), { status: 422, message: 'a system needs card closes itself' });
    assert.equal((await f.hub.thread('one')).cards.find(c => c.id === 'notice').answered, false);
  } finally { f.restore(); }
});

test('deleting the branch after a merge follows its setting and only records a failure', async () => {
  for (const [setting, api, outcome, deleted] of [
    ['off', `printf '{"merged":true}'`, 'merged', undefined],
    ['on', `case "$3" in PUT) printf '{"merged":true}';; esac`, 'merged', true],
    ['on', `case "$3" in PUT) printf '{"merged":true}';; *) exit 1;; esac`, 'merged', false],
    ['on', `printf '{"message":"no"}'; exit 1`, 'failed', undefined],
  ]) {
    const f = await fixture(script('CLEAN', 'OPEN', api)); try {
      await settings.update(f.hub, v => { v.auto_merge_delete_branch = setting; });
      const result = await f.run(), record = result.auto_merge_attempts[head];
      assert.equal(record.outcome, outcome); assert.equal(record.branch_deleted, deleted);
      const calls = await f.calls();
      if (deleted === undefined) assert.ok(!calls.some(c => c.includes('DELETE')));
      else assert.equal(calls.at(-1), 'api -X DELETE repos/o/r/git/refs/heads/branch');
      if (deleted === false) assert.ok(!result.cards.some(c => c.auto_merge));
    } finally { f.restore(); }
  }
});

test('branch deletion targets the repository that holds the branch', async () => {
  const api = `case "$3" in PUT) printf '{"merged":true}';; esac`;
  for (const [extra, expected] of [
    [{ isCrossRepository: true, headRepositoryOwner: { login: 'me' }, headRepository: { name: 'fork' } }, 'api -X DELETE repos/me/fork/git/refs/heads/branch'],
    [{ isCrossRepository: true }, undefined],
    [{}, undefined],
  ]) {
    const f = await fixture(script('CLEAN', 'OPEN', api, extra)); try {
      await settings.update(f.hub, v => { v.auto_merge_delete_branch = 'on'; });
      const result = await f.run(), calls = await f.calls();
      assert.equal(result.auto_merge_attempts[head].outcome, 'merged');
      if (expected) assert.equal(calls.at(-1), expected);
      else { assert.ok(!calls.some(c => c.includes('DELETE'))); assert.equal(result.auto_merge_attempts[head].branch_deleted, undefined); }
    } finally { f.restore(); }
  }
});

test('target PR check does not merge, notify, or delete its branch', async () => {
  const f = await fixture(script());
  try {
    await settings.update(f.hub, v => { v.auto_merge_delete_branch = 'on'; });
    const t = await f.hub.thread('one'); t.target_pr = { url, head_branch: 'branch' }; await f.hub.save(t);
    const result = await f.run();
    assert.deepEqual(await f.calls(), []);
    assert.equal(result.auto_merge_attempts, undefined);
    assert.ok(!result.cards.some(c => c.auto_merge));
  } finally { f.restore(); }
});
