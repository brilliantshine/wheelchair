'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { makeTemp } = require('../../test-support/run-dir');

const url = 'https://github.com/owner/repo/pull/1';
const sha = '0123456789abcdef0123456789abcdef01234567';
const script = path.resolve(__dirname, '../app/pr-wait.py');

async function poll(pr) {
  const dir = await makeTemp('pr-wait-');
  const gh = path.join(dir, 'gh');
  await fs.writeFile(gh, `#!/bin/sh\nprintf '%s' '${JSON.stringify(pr)}'\n`, { mode: 0o755 });
  return spawnSync('python3', [script, url, sha, String(Math.floor(Date.now() / 1000))], {
    encoding: 'utf8', timeout: 4000, env: { ...process.env, WC_GH: gh },
  });
}

const base = (overrides = {}) => ({
  state: 'OPEN', mergeStateStatus: 'CLEAN', headRefOid: sha,
  statusCheckRollup: [{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'SUCCESS' }],
  ...overrides,
});

for (const [name, pr, expected] of [
  ['clean with a passed check', base(), 'ready'],
  ['dirty', base({ mergeStateStatus: 'DIRTY' }), 'conflicts'],
  ['changed head', base({ headRefOid: 'abcdef0123456789abcdef0123456789abcdef01' }), 'head changed'],
  ['merged', base({ state: 'MERGED' }), 'closed or merged'],
  ['failed check under unstable', base({ mergeStateStatus: 'UNSTABLE', statusCheckRollup: [{ __typename: 'CheckRun', status: 'COMPLETED', conclusion: 'FAILURE' }] }), 'check failed'],
]) {
  test(`poll stops for ${name}`, async () => {
    const result = await poll(pr);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim().split('\n').at(-1), `STOP: ${expected}`);
  });
}
