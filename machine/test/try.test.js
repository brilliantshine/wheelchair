'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { TryService } = require('../lib/try');
const service = new TryService({ stateDir: '/tmp/state', root: '/tmp/root', projects: async () => ({ checked: { ok: true } }) });
test('validates all actions and their fields', async () => {
  const base = { thread_id: '0123456789ab', project: '/tmp/repo' };
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
