'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { TryService } = require('../lib/try');
const service = new TryService({ stateDir: '/tmp/state', root: '/tmp/root', projects: async () => ({ checked: { ok: true } }) });
test('validates all actions and their fields', async () => {
  const base = { thread_id: '0123456789ab', project: '/tmp' };
  for (const input of [{ ...base, action: 'bad' }, { ...base, action: 'try', thread_id: 'bad' }, { ...base, action: 'back' }, { ...base, action: 'forget', version: 'v' }, { ...base, action: 'try', kept: 'x' }]) {
    await assert.rejects(service.handle(input), { status: 422 });
  }
  for (const action of ['back', 'dismiss', 'forget']) {
    const answer = await service.handle({ ...base, action, version: 'v', ...(action === 'forget' ? { kept: 'ref' } : {}) });
    assert.equal(answer.reason, 'Not built yet');
  }
});
test('record and protected list use the real folder hash and version every write', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path');
  const { makeTemp } = require('../../test-support/run-dir');
  const root = await makeTemp('try-record-'); const instance = new TryService({ stateDir: root, root, projects: async () => ({ checked: { ok: true } }) });
  const folder = path.join(root, 'copy'); await fs.mkdir(folder);
  const record = await instance.read(folder); await instance.write(folder, record); const first = record.version;
  await instance.write(folder, record); assert.notEqual(record.version, first);
  await instance.writeProtected(folder, Buffer.from('ignored\0'));
  assert.equal((await fs.readFile(instance.protectedPath(folder))).toString(), 'ignored\0');
  assert.deepEqual(await instance.read(folder), record);
});
test('lock is keyed by real folder path and advances its generation', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const { makeTemp } = require('../../test-support/run-dir');
  const root = await makeTemp('try-lock-'); const folder = path.join(root, 'copy'); const alias = path.join(root, 'alias');
  await fs.mkdir(folder); await fs.symlink(folder, alias);
  assert.equal(service.folder(alias), service.folder(folder));
  assert.equal(service.acquire(folder), true); assert.equal(service.acquire(service.folder(alias)), false);
  assert.equal(service.lockState(folder).generation, 1); service.release(folder); assert.equal(service.lockState(folder).generation, 2);
});
test('git runner uses a deadline and reports killed', async () => {
  const { makeTemp } = require('../../test-support/run-dir'); const fs = require('node:fs/promises'); const path = require('node:path');
  const root = await makeTemp('try-runner-'); const git = path.join(root, 'git');
  await fs.writeFile(git, '#!/bin/sh\nexec sleep 5\n', { mode: 0o755 });
  const runner = new TryService({ stateDir: root, root, projects: null, gitExecutable: git, killGrace: 50 });
  const result = await runner.runGit(root, [], 80); assert.equal(result.code, 'killed');
});
test('outcome table honors only git removal warning lines', () => {
  const from = { branch: 'refs/heads/main', sha: 'a' }, to = { branch: null, sha: 'b' };
  const result = (code, stderr = '') => ({ code, stderr: Buffer.from(stderr) });
  assert.equal(service.judge(from, to, to, [], result(0)), 'success');
  assert.equal(service.judge(from, to, to, [], result(1, 'error: hook')), 'warning');
  assert.equal(service.judge(from, to, to, [], result(0, "warning: unable to unlink 'file'")), 'interrupted');
  assert.equal(service.judge(from, to, to, [], result(0, "subject warning: unable to unlink 'file'")), 'success');
  assert.equal(service.judge(from, to, from, [], result('killed')), 'nothing-moved');
});
test('protected filter excludes exact untracked paths only', async () => {
  const { makeTemp } = require('../../test-support/run-dir'); const root = await makeTemp('try-protected-');
  const instance = new TryService({ stateDir: root, root, projects: null });
  await instance.writeProtected(root, Buffer.from('ignored/a\0'));
  const entries = [{ path: 'ignored/a', untracked: true }, { path: 'ignored/a', untracked: false }, { path: 'ignored/b', untracked: true }];
  assert.deepEqual(await instance.filtered(root, entries), entries.slice(1));
});
