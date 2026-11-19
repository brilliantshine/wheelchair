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
