'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { makeTemp } = require('../../test-support/run-dir');
const { Hub } = require('../app/hub');
const { resolvable } = require('../app/card');

const url = 'https://github.com/owner/repo/pull/1';
const done = (pr_url = url) => ({ kind: 'done', pr_url });
const record = (id, cards = [done()]) => ({ id, project: '/tmp/project', machine: 'hub', sessions: [], cards, pinned: {}, queues: {}, asides: [], archived: false });

async function fixture(script) {
  const dir = await makeTemp('merged-');
  const bin = path.join(dir, 'bin');
  await fs.mkdir(bin);
  const log = path.join(dir, 'calls');
  const gate = path.join(dir, 'gate');
  await fs.writeFile(path.join(bin, 'gh'), `#!/bin/sh\nprintf '%s\\n' "$3" >> '${log}'\n${script}\n` , { mode: 0o755 });
  const old = process.env.PATH;
  process.env.PATH = `${bin}:${old}`;
  const hub = new Hub({ stateDir: path.join(dir, 'state'), codeVersion: '' });
  await hub.state.init();
  return { hub, dir, log, gate, restore: () => { process.env.PATH = old; } };
}
async function calls(f) { return (await fs.readFile(f.log, 'utf8').catch(() => '')).trim().split('\n').filter(Boolean); }
async function waitForCall(f) {
  for (let i = 0; i < 200; i++) {
    if ((await calls(f)).length) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('gh did not start');
}
const slow = (gate) => `while [ ! -f '${gate}' ]; do sleep 0.02; done\nprintf '{"state":"MERGED"}'`;

// Each test restores PATH; tests within this file run serially.
test('MERGED posts exactly one card and marker; a second poll posts nothing', async () => {
  const f = await fixture('printf \'{"state":"MERGED"}\'');
  try {
    await f.hub.save(record('one'));
    await f.hub.pollMerged();
    let t = await f.hub.thread('one');
    assert.equal(t.merge_noticed_url, url);
    assert.ok(!Number.isNaN(Date.parse(t.merge_noticed_at)));
    assert.deepEqual(t.cards.filter((c) => c.kind === 'merged').map((c) => [c.title, c.pr_url, c.system]), [['Pull request merged', url, true]]);
    await f.hub.pollMerged();
    t = await f.hub.thread('one');
    assert.equal(t.cards.filter((c) => c.kind === 'merged').length, 1);
    assert.equal((await calls(f)).length, 1);
  } finally { f.restore(); }
});

test('overlapping sweeps return immediately and call gh once per thread', async () => {
  const f = await fixture('');
  try {
    await fs.writeFile(path.join(f.dir, 'bin', 'gh'), `#!/bin/sh\nprintf '%s\\n' "$3" >> '${f.log}'\n${slow(f.gate)}\n`, { mode: 0o755 });
    await f.hub.save(record('one'));
    const first = f.hub.pollMerged();
    await waitForCall(f);
    await f.hub.pollMerged();
    assert.equal((await calls(f)).length, 1);
    await fs.writeFile(f.gate, '');
    await first;
  } finally { await fs.writeFile(f.gate, ''); f.restore(); }
});

test('archiving during gh leaves no merged card', async () => {
  const f = await fixture('');
  try {
    await fs.writeFile(path.join(f.dir, 'bin', 'gh'), `#!/bin/sh\nprintf '%s\\n' "$3" >> '${f.log}'\n${slow(f.gate)}\n`, { mode: 0o755 });
    await f.hub.save(record('one'));
    const poll = f.hub.pollMerged();
    await waitForCall(f);
    f.hub.call = async () => ({ kept: [], uploads_removed: true });
    await f.hub.archive('one');
    await fs.writeFile(f.gate, '');
    await poll;
    assert.equal((await f.hub.thread('one')).cards.filter((c) => c.kind === 'merged').length, 0);
  } finally { await fs.writeFile(f.gate, ''); f.restore(); }
});

test('init resolves while gh is still running', async () => {
  const f = await fixture('');
  try {
    await fs.writeFile(path.join(f.dir, 'bin', 'gh'), `#!/bin/sh\nprintf '%s\\n' "$3" >> '${f.log}'\n${slow(f.gate)}\n`, { mode: 0o755 });
    await f.hub.save(record('one'));
    await f.hub.init();
    await waitForCall(f);
    assert.ok(f.hub.mergePolling);
    const poll = f.hub.mergePolling;
    await fs.writeFile(f.gate, '');
    await poll;
  } finally { await fs.writeFile(f.gate, ''); f.restore(); }
});

test('OPEN, CLOSED and failing gh leave threads unchanged and do not throw', async () => {
  const f = await fixture('case "$3" in */1) printf \'{"state":"OPEN"}\';; */2) printf \'{"state":"CLOSED"}\';; *) exit 1;; esac');
  try {
    for (let n = 1; n <= 3; n++) await f.hub.save(record(`t${n}`, [done(`https://github.com/owner/repo/pull/${n}`)]));
    await f.hub.pollMerged();
    assert.equal((await calls(f)).length, 3);
    for (let n = 1; n <= 3; n++) assert.equal((await f.hub.thread(`t${n}`)).cards.length, 1);
  } finally { f.restore(); }
});

test('archived and invalid URLs are not checked; newest unreplaced done URL wins', async () => {
  const f = await fixture('printf \'{"state":"MERGED"}\'');
  try {
    const archived = record('archived'); archived.archived = true;
    await f.hub.save(archived);
    await f.hub.save(record('invalid', [done('https://example.com/pull/2')]));
    const newest = 'https://github.com/owner/repo/pull/3';
    await f.hub.save(record('newest', [done(url), done(newest), { ...done('https://github.com/owner/repo/pull/4'), replaced: true }]));
    await f.hub.pollMerged();
    assert.deepEqual(await calls(f), [newest]);
    assert.equal((await f.hub.thread('newest')).merge_noticed_url, newest);
  } finally { f.restore(); }
});

test('merged needs attention until keep resolves without a live lead', async () => {
  const f = await fixture('printf \'{"state":"MERGED"}\'');
  try {
    await f.hub.save(record('one'));
    await f.hub.pollMerged();
    const card = (await f.hub.thread('one')).cards.find((c) => c.kind === 'merged');
    assert.equal((await f.hub.features()).needs[0].title, 'Pull request merged');
    await assert.rejects(f.hub.press('one', card.id, { action: 'other' }), { status: 400, message: 'a merged card takes keep' });
    assert.deepEqual(await f.hub.press('one', card.id, { action: 'keep' }), { queued: false });
    const t = await f.hub.thread('one');
    assert.equal(t.cards.find((c) => c.id === card.id).resolved_note, 'Kept');
    assert.equal((await f.hub.features()).needs.length, 0);
    await assert.rejects(f.hub.press('one', card.id, { action: 'keep' }), { status: 422, message: 'card is already answered' });
    assert.equal(resolvable(t, card.id).ok, false);
  } finally { f.restore(); }
});

test('successful archive resolves merged cards; failed archive leaves them open', async () => {
  const f = await fixture('printf \'{"state":"MERGED"}\'');
  try {
    await f.hub.save(record('success')); await f.hub.save(record('failure'));
    await f.hub.pollMerged();
    f.hub.call = async (_machine, _route, _method, body) => body.thread_id === 'success' ? { kept: [], uploads_removed: true } : { kept: [{ reason: 'rebase in progress', worktree: '/tmp/work' }] };
    await f.hub.archive('success'); await f.hub.archive('failure');
    const success = await f.hub.thread('success'); const failure = await f.hub.thread('failure');
    assert.equal(success.cards.find((c) => c.kind === 'merged').resolved_note, 'Archived');
    assert.equal(failure.archived, false);
    assert.equal(failure.cards.find((c) => c.kind === 'merged').answered, false);
  } finally { f.restore(); }
});

test('card.js refuses merged from a session', async () => {
  const dir = await makeTemp('merged-card-');
  const file = path.join(dir, 'card.json');
  await fs.writeFile(file, JSON.stringify({ kind: 'merged', title: 'Pull request merged', pr_url: url }));
  const result = spawnSync(process.execPath, [path.join(__dirname, '../app/card.js'), 'merged', file], { encoding: 'utf8', env: { ...process.env, WHEELCHAIR_SESSION_TOKEN: 'test' } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown card kind/);
});
