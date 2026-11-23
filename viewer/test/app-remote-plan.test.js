'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { setup, close, thread, api } = require('./helpers/app.js');
async function remoteContext(options) {
  const ctx = await setup(options); const made = await thread(ctx);
  const machines = JSON.parse(await fs.readFile(path.join(ctx.state, 'machines.json')));
  machines.remote = { ...machines.hub, name: 'remote', port: ctx.machine.port }; machines.hub = { ...machines.hub, port: 1 };
  await fs.writeFile(path.join(ctx.state, 'machines.json'), JSON.stringify(machines));
  const file = path.join(ctx.state, 'threads', `${made.id}.json`);
  const stored = JSON.parse(await fs.readFile(file)); stored.machine = 'remote'; stored.slug = 'example';
  await fs.writeFile(file, JSON.stringify(stored));
  return { ctx, made, file, stored };
}
test('remote document and ZIP use machine for live and archived threads, mapping failures', async () => {
  const { ctx, made, file, stored } = await remoteContext();
  try {
    ctx.machine.planReplies.list = { files: ['MAP.md'], status: 'implementing' };
    ctx.machine.planReplies.read = { content: 'remote content' };
    for (const archived of [false, true]) {
      stored.archived = archived; await fs.writeFile(file, JSON.stringify(stored));
      assert.equal((await api(ctx, `/threads/${made.id}/doc?file=MAP.md`)).body.content, 'remote content');
      const res = await fetch(`${ctx.server.url}/api/threads/${made.id}/docs.zip?token=${ctx.server.token}`);
      assert.equal(res.status, 200); assert.equal(res.headers.get('content-type'), 'application/zip');
    }
    ctx.machine.planReplies.read = { status: 404, body: { error: 'missing' } };
    assert.equal((await api(ctx, `/threads/${made.id}/doc?file=MAP.md`)).status, 404);
    assert.equal((await fetch(`${ctx.server.url}/api/threads/${made.id}/docs.zip?token=${ctx.server.token}`)).status, 502);
    ctx.machine.planReplies.read = { status: 500, body: { error: 'unavailable' } };
    assert.equal((await api(ctx, `/threads/${made.id}/doc?file=MAP.md`)).status, 502);
    const registryFile = path.join(ctx.state, 'machines.json');
    const registry = JSON.parse(await fs.readFile(registryFile)); registry.remote.port = 1;
    await fs.writeFile(registryFile, JSON.stringify(registry));
    assert.equal((await api(ctx, `/threads/${made.id}/doc?file=MAP.md`)).status, 502);
    assert.equal((await fetch(`${ctx.server.url}/api/threads/${made.id}/docs.zip?token=${ctx.server.token}`)).status, 502);
  } finally { await close(ctx); }
});

test('refresh checks its snapshot and never starts a machine call under the lock', async () => {
  const remote = require('../app/remote-plan.js');
  let locked = false, release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const pending = new Promise(resolve => { release = resolve; });
  const snapshot = { id: 'abcdef123456', machine: 'remote', project: '/project', slug: null };
  let current = { ...snapshot };
  const registry = { hub: {}, remote: {} };
  const hub = {
    state: { machines: async () => registry, resolveMachine: async (r, n) => r[n] },
    client: { call: async (_m, _path, _method, input) => {
      assert.equal(locked, false);
      if (input.action === 'discover') { entered(); await pending; return { slug: 'example' }; }
      return { files: ['PLAN.md'], status: 'implementing' };
    } },
    withThread: async (_id, fn) => { locked = true; try { await fn(); } finally { locked = false; } },
    thread: async () => current,
    save: async () => {},
  };
  remote.refresh(hub, snapshot); await started;
  current = { ...current, project: '/changed' }; release();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(current.slug, null); assert.deepEqual(remote.cached(hub, current), []);
});

test('real plan-file callers do not start or await machine requests under a thread lock', async () => {
  for (const trigger of ['threads', 'list', 'chat', 'doc', 'zip']) {
    const lockFile = path.join(await require('./helpers/server.js').makeDir('plan-lock-'), 'locks.json');
    await fs.writeFile(lockFile, '{}');
    const probe = path.join(__dirname, 'helpers/plan-lock-probe.js');
    const { ctx, made } = await remoteContext({ env: {
      NODE_OPTIONS: `--require=${probe}`, WC_TEST_LOCK_FILE: lockFile,
    } });
    const samples = [];
    try {
      const reply = async input => {
        const sample = async phase => samples.push({ action: input.action, phase, held: (JSON.parse(await fs.readFile(lockFile))[input.thread_id] || 0) > 0 });
        await sample('arrival');
        await new Promise(resolve => setTimeout(resolve, 200));
        await sample('reply');
        return input.action === 'list' ? { files: ['MAP.md'], status: 'implementing' } : { content: 'remote content' };
      };
      ctx.machine.planReplies.list = reply; ctx.machine.planReplies.read = reply;
      let response;
      if (trigger === 'zip') response = await fetch(`${ctx.server.url}/api/threads/${made.id}/docs.zip?token=${ctx.server.token}`);
      else {
        const route = { threads: '/threads', list: '/threads?view=list', chat: `/threads/${made.id}/chat`, doc: `/threads/${made.id}/doc?file=MAP.md` }[trigger];
        response = await api(ctx, route);
      }
      assert.equal(response.status, 200, trigger);
      // Refresh is background work; wait for its delayed response as well as direct reads.
      for (let i = 0; i < 100 && (!samples.length || samples.length % 2); i++) await new Promise(resolve => setTimeout(resolve, 20));
      assert.ok(samples.length >= 2, `${trigger} made a plan-files request: ${JSON.stringify(samples)}`);
      assert.deepEqual(samples.filter(sample => sample.held), [], `${trigger} held the lock: ${JSON.stringify(samples)}`);
    } finally { await close(ctx); }
  }
});

test('remote refresh saves committed status for Features', async () => {
  const { ctx, made, file, stored } = await remoteContext();
  try {
    stored.slug = null; await fs.writeFile(file, JSON.stringify(stored));
    ctx.machine.planReplies.discover = { slug: 'example' };
    ctx.machine.planReplies.list = { files: ['PLAN.md'], status: 'implementing' };
    await api(ctx, '/threads?view=list');
    let record;
    for (let i = 0; i < 100; i++) {
      record = JSON.parse(await fs.readFile(file));
      if (record.last_status === 'implementing') break;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(record.slug, 'example'); assert.equal(record.last_status, 'implementing');
    const features = await api(ctx, '/features');
    assert.ok(features.body.building.some(item => item.id === made.id));
  } finally { await close(ctx); }
});
