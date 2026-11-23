'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { makeTemp } = require('../../test-support/run-dir');

test('worker effort must be a supported level and cannot exceed the manifest ceiling', async () => {
  const context = require('./helpers/app');
  const hookDir = await makeTemp('worker-effort-hook-');
  const hook = path.join(hookDir, 'manifest.js');
  await fs.writeFile(hook, `const c = require(${JSON.stringify(path.resolve(__dirname, '../../connectors'))});\nconst original = c.manifest;\nconst m = structuredClone(original('codex')); m.models.efforts = ['low', 'high'];\nc.manifest = cli => cli === m.cli ? m : original(cli);\n`);
  const app = await context.setup({ env: { NODE_OPTIONS: `--require=${hook}` } });
  try {
    const made = await context.api(app, '/threads', { method: 'POST', body: { project: '/tmp/worker-effort-membership' } });
    const sub = await context.machinePost(app, '/machine/session', { calling_session: made.body.sessions[0].name, action: 'start', role: 'sub-lead', attempt_id: 'effort-sub' });
    assert.equal(sub.status, 200);
    const start = effort => context.machinePost(app, '/machine/session', { calling_session: sub.body.session.name, action: 'start', role: 'worker', provider: 'gpt', tier: 'standard', effort, attempt_id: `effort-${effort}` });
    for (const [effort, detail] of [['medium', 'GPT has no medium effort'], ['xhigh', "GPT's highest effort is high"]]) {
      const refused = await start(effort);
      assert.equal(refused.status, 400);
      assert.equal(refused.body.detail, detail);
    }
    assert.equal((await start('high')).status, 200);
  } finally {
    await context.close(app);
  }

  const c = await context.setup();
  try {
    const made = await context.api(c, '/threads', { method: 'POST', body: { project: '/tmp/worker-effort-real-gpt' } });
    const sub = await context.machinePost(c, '/machine/session', { calling_session: made.body.sessions[0].name, action: 'start', role: 'sub-lead', attempt_id: 'real-gpt-sub' });
    const result = await context.machinePost(c, '/machine/session', { calling_session: sub.body.session.name, action: 'start', role: 'worker', provider: 'gpt', tier: 'standard', effort: 'max', attempt_id: 'real-gpt-max' });
    assert.equal(result.status, 400);
    assert.equal(result.body.detail, "GPT's highest effort is xhigh");
  } finally { await context.close(c); }
});
