'use strict';
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
merge.timing.retryMs = 5; merge.timing.waitMs = 20; merge.timing.mergeTimeoutMs = 100;
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
const view = (status = 'CLEAN', state = 'OPEN') => JSON.stringify({ state, mergeStateStatus: status, headRefName: 'branch', baseRefName: 'main', headRefOid: head, statusCheckRollup: [] });
const script = (status = 'CLEAN', state = 'OPEN', api = `printf '{"merged":true}'`) => `if [ "$1" = pr ]; then printf '%s' '${view(status, state)}'; else ${api}; fi`;

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
test('GitHub outcomes and exact merge arguments', async () => {
  for (const [status, state, api, outcome, message] of [
    ['UNKNOWN', 'OPEN', '', 'not-ready', 'still working out'], ['CLEAN', 'MERGED', '', 'already-merged'], ['CLEAN', 'CLOSED', '', 'closed'],
    ['BLOCKED', 'OPEN', '', 'not-ready', 'review'], ['CLEAN', 'OPEN', `printf '{"merged":true}'`, 'merged'],
    ['CLEAN', 'OPEN', `printf '{"message":"Required review missing"}'; exit 1`, 'failed', 'Required review missing'],
  ]) {
    const f = await fixture(script(status, state, api)); try {
      const result = await f.run(); assert.equal(result.auto_merge_attempts[head].outcome, outcome);
      const calls = await f.calls();
      if (['merged', 'failed'].includes(outcome)) assert.equal(calls.at(-1), `api -X PUT repos/o/r/pulls/1/merge -f sha=${head} -f merge_method=merge`);
      else assert.ok(calls.every(c => c.startsWith('pr view ')));
      if (status === 'UNKNOWN') assert.ok(calls.length > 1);
      if (message) assert.ok(result.cards.find(c => c.auto_merge).body.toLowerCase().includes(message.toLowerCase()));
      else assert.ok(!result.cards.some(c => c.auto_merge));
      await f.run(); assert.deepEqual(await f.calls(), calls);
    } finally { f.restore(); }
  }
});
test('dismiss auto-merge card and refuse lead resolution', async () => {
  const f = await fixture(); try { const t = await f.hub.thread('one'); t.cards.push({ kind: 'needs', id: 'n', system: true, auto_merge: true, answered: false }); await f.hub.save(t);
    assert.equal(resolvable(t, 'n', 'lead').ok, false); await dismiss(f.hub, 'one', 'n'); assert.equal((await f.hub.thread('one')).cards.at(-1).answered, true);
  } finally { f.restore(); }
});
