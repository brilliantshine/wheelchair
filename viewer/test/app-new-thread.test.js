'use strict';

// Spec "Hub" of new-thread-screen: GET /new-thread, saved directories, the default folder,
// the path check at thread start, and template scope over saved paths.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');
const { api, close, setup, thread } = require('./helpers/app.js');
const { startMachine } = require('./helpers/app-machine.js');
const { freePort } = require('./helpers/server.js');

async function withContext(work) {
  const context = await setup();
  try { await work(context); } finally { await close(context); }
}

async function writeMachines(context, machines) {
  await fs.writeFile(path.join(context.state, 'machines.json'), JSON.stringify(machines));
}

function entry(machine) {
  return { address: '127.0.0.1', port: machine.port, secret: machine.secret };
}

const setFolder = (context, value) => api(context, '/settings/preferences', { method: 'PUT', body: { default_project_folder: value } });

test('GET /new-thread returns found repositories for the machine and passes folder_error on', async () => {
  await withContext(async (context) => {
    await setFolder(context, '~/code');
    context.machine.projects = { found: [{ name: 'alpha', path: '/home/fake/code/alpha' }] };
    const result = await api(context, '/new-thread');
    assert.equal(result.status, 200);
    assert.equal(result.body.machine, 'hub');
    assert.equal(result.body.default_folder, '~/code');
    assert.deepEqual(result.body.found, [{ name: 'alpha', path: '/home/fake/code/alpha' }]);
    assert.equal(result.body.found_error, undefined);
    assert.ok(context.machine.calls.some((call) => call.path === '/v1/projects'));
    context.machine.projects = { found: [], folder_error: 'does not exist' };
    const missing = await api(context, '/new-thread?machine=hub');
    assert.deepEqual(missing.body.found, []);
    assert.equal(missing.body.found_error, 'does not exist');
  });
});

test('GET /new-thread asks for no folder when none is set', async () => {
  await withContext(async (context) => {
    const result = await api(context, '/new-thread');
    assert.deepEqual(result.body.found, []);
    assert.equal(result.body.default_folder, '');
    assert.equal(context.machine.calls.some((call) => call.path === '/v1/projects'), false);
  });
});

test('GET /new-thread says an unreachable machine is not reachable and an old one needs updating', async () => {
  await withContext(async (context) => {
    const old = await startMachine('old-secret');
    old.projectsAvailable = false;
    try {
      await writeMachines(context, {
        hub: entry(context.machine),
        gone: { address: '127.0.0.1', port: await freePort(), secret: 'x' },
        old: entry(old),
      });
      await setFolder(context, '/srv');
      const gone = await api(context, '/new-thread?machine=gone');
      assert.equal(gone.status, 200);
      assert.deepEqual(gone.body.found, []);
      assert.equal(gone.body.found_error, 'gone is not reachable');
      const stale = await api(context, '/new-thread?machine=old');
      assert.equal(stale.status, 200);
      assert.equal(stale.body.found_error, 'old needs updating');
      assert.equal((await api(context, '/new-thread?machine=nobody')).status, 404);
    } finally { await old.stop(); }
  });
});

test('GET /new-thread lists hub first and folds the hub hostname entry into it', async () => {
  await withContext(async (context) => {
    await fs.writeFile(path.join(context.state, 'machine.json'), JSON.stringify({ host: '127.0.0.1', port: context.machine.port }));
    await writeMachines(context, {
      hearth: { name: 'hearth', ...entry(context.machine) },
      zeta: { name: 'zeta', address: '127.0.0.2', port: 9, secret: 'x' },
      alpha: { name: 'alpha', address: '127.0.0.3', port: 9, secret: 'x' },
    });
    const result = await api(context, '/new-thread');
    assert.deepEqual(result.body.machines, ['hub', 'zeta', 'alpha']);
    assert.equal((await api(context, '/new-thread?machine=hearth')).status, 200);
  });
});

test('GET /new-thread filters saved directories by machine', async () => {
  await withContext(async (context) => {
    const other = await startMachine('other-secret');
    try {
      await writeMachines(context, { hub: entry(context.machine), other: entry(other) });
      assert.equal((await api(context, '/settings/saved-dirs', { method: 'POST', body: { name: 'one', path: '/srv/one', machine: 'hub' } })).status, 201);
      assert.equal((await api(context, '/settings/saved-dirs', { method: 'POST', body: { name: 'two', path: '/srv/two', machine: 'other' } })).status, 201);
      assert.deepEqual((await api(context, '/new-thread')).body.saved, [{ name: 'one', path: '/srv/one', machine: 'hub' }]);
      assert.deepEqual((await api(context, '/new-thread?machine=other')).body.saved, [{ name: 'two', path: '/srv/two', machine: 'other' }]);
    } finally { await other.stop(); }
  });
});

test('GET /new-thread previous comes from threads on that machine, newest first, hostname alias included', async () => {
  await withContext(async (context) => {
    await fs.writeFile(path.join(context.state, 'machine.json'), JSON.stringify({ host: '127.0.0.1', port: context.machine.port }));
    const other = await startMachine('other-secret');
    try {
      await writeMachines(context, {
        hearth: { name: 'hearth', ...entry(context.machine) },
        other: entry(other),
      });
      await thread(context, { project: '/srv/old', machine: 'hearth' });
      await thread(context, { project: '/srv/elsewhere', machine: 'other' });
      await thread(context, { project: '/srv/new', machine: 'hub' });
      await thread(context, { project: '/srv/old', machine: 'hub' });
      const hub = await api(context, '/new-thread');
      assert.deepEqual(hub.body.previous, ['/srv/old', '/srv/new']);
      assert.deepEqual((await api(context, '/new-thread?machine=other')).body.previous, ['/srv/elsewhere']);
    } finally { await other.stop(); }
  });
});

test('saved directories: add, duplicate 409, remove, remove unknown 404', async () => {
  await withContext(async (context) => {
    const add = (body) => api(context, '/settings/saved-dirs', { method: 'POST', body });
    const first = await add({ name: ' proj ', path: '~/proj', machine: 'hub' });
    assert.equal(first.status, 201);
    assert.deepEqual(first.body.saved, [{ name: 'proj', path: '/home/fake/proj', machine: 'hub' }]);
    assert.equal((await api(context, '/settings')).body.saved_dirs.length, 1);
    const again = await add({ name: 'proj', path: '/srv/x', machine: 'hub' });
    assert.equal(again.status, 409);
    assert.equal((await add({ name: '', path: '/srv/x', machine: 'hub' })).status, 400);
    assert.equal((await add({ name: 'x'.repeat(61), path: '/srv/x', machine: 'hub' })).status, 400);
    assert.equal((await add({ name: 'nopath', machine: 'hub' })).status, 400);
    assert.equal((await api(context, '/settings/saved-dirs/missing', { method: 'DELETE' })).status, 404);
    assert.equal((await api(context, '/settings/saved-dirs/proj?machine=other', { method: 'DELETE' })).status, 404);
    const removed = await api(context, '/settings/saved-dirs/proj', { method: 'DELETE' });
    assert.equal(removed.status, 200);
    assert.deepEqual(removed.body.saved, []);
    assert.deepEqual((await api(context, '/settings')).body.saved_dirs, []);
  });
});

test('saving a directory is refused with the check reason, and 502 when the machine does not answer', async () => {
  await withContext(async (context) => {
    context.machine.projects = { bad: { '/srv/plain': 'is not a git repository' } };
    const refused = await api(context, '/settings/saved-dirs', { method: 'POST', body: { name: 'plain', path: '/srv/plain', machine: 'hub' } });
    assert.equal(refused.status, 400);
    assert.equal(refused.body.detail, '/srv/plain is not a git repository on hub');
    const relative = await api(context, '/settings/saved-dirs', { method: 'POST', body: { name: 'rel', path: 'rel/dir', machine: 'hub' } });
    assert.equal(relative.status, 400);
    assert.match(relative.body.detail, /must be an absolute path/);
    assert.deepEqual((await api(context, '/settings')).body.saved_dirs, []);
    await writeMachines(context, { gone: { address: '127.0.0.1', port: await freePort(), secret: 'x' } });
    const down = await api(context, '/settings/saved-dirs', { method: 'POST', body: { name: 'a', path: '/srv/a', machine: 'gone' } });
    assert.equal(down.status, 502);
    assert.equal(down.body.detail, 'gone is not reachable');
    assert.equal((await api(context, '/settings/saved-dirs', { method: 'POST', body: { name: 'a', path: '/srv/a', machine: 'nobody' } })).status, 404);
  });
});

test('default_project_folder is trimmed, cleared by empty, and must be absolute or start with ~', async () => {
  await withContext(async (context) => {
    assert.equal((await api(context, '/settings')).body.default_project_folder, '');
    const saved = await setFolder(context, '  ~/code  ');
    assert.equal(saved.status, 200);
    assert.equal(saved.body.default_project_folder, '~/code');
    assert.equal((await api(context, '/settings')).body.default_project_folder, '~/code');
    assert.equal((await setFolder(context, '~')).status, 200);
    assert.equal((await setFolder(context, '/srv/code')).status, 200);
    for (const bad of ['~user', '~user/code', 'code', './code']) {
      const refused = await setFolder(context, bad);
      assert.equal(refused.status, 400, bad);
    }
    assert.equal((await api(context, '/settings/preferences', { method: 'PUT', body: { default_project_folder: 5 } })).status, 400);
    assert.equal((await api(context, '/settings')).body.default_project_folder, '/srv/code');
    const cleared = await setFolder(context, '   ');
    assert.equal(cleared.body.default_project_folder, '');
  });
});

test('starting a thread on a path the machine refuses leaves no thread and no projects.json entry', async () => {
  await withContext(async (context) => {
    context.machine.projects = { bad: { '/srv/plain': 'is not a git repository' } };
    const refused = await api(context, '/threads', { method: 'POST', body: { project: '/srv/plain', cli: 'codex', machine: 'hub' } });
    assert.equal(refused.status, 400);
    assert.equal(refused.body.detail, '/srv/plain is not a git repository on hub');
    assert.deepEqual((await api(context, '/threads')).body.threads, []);
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(context.state, 'projects.json'), 'utf8')), []);
    assert.equal(context.machine.sessions.size, 0);
    assert.equal((await api(context, '/threads', { method: 'POST', body: { project: '/srv/x', cli: 'codex', machine: 'nobody' } })).status, 404);
    await writeMachines(context, { gone: { address: '127.0.0.1', port: await freePort(), secret: 'x' } });
    const down = await api(context, '/threads', { method: 'POST', body: { project: '/srv/x', cli: 'codex', machine: 'gone' } });
    assert.equal(down.status, 502);
    assert.equal(down.body.detail, 'gone is not reachable');
    assert.deepEqual((await api(context, '/threads')).body.threads, []);
  });
});

test('starting a thread stores the path the machine expanded', async () => {
  await withContext(async (context) => {
    const made = await thread(context, { project: '~/proj', machine: 'hub' });
    assert.equal(made.project, '/home/fake/proj');
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(context.state, 'projects.json'), 'utf8')), ['/home/fake/proj']);
    const check = context.machine.calls.find((call) => call.path === '/v1/projects');
    assert.ok(check);
  });
});

test('a template scope may name a saved directory path, and settings lists it as a project', async () => {
  await withContext(async (context) => {
    await api(context, '/settings/saved-dirs', { method: 'POST', body: { name: 'proj', path: '/srv/proj', machine: 'hub' } });
    const template = {
      name: 'Saved scope', role: 'worker', scope: '/srv/proj', text: 'x',
      switches: { packages: 'ask', unsettled: 'decide' },
    };
    const created = await api(context, '/settings/templates', { method: 'POST', body: template });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const listed = await api(context, '/settings');
    assert.ok(listed.body.projects.includes('/srv/proj'));
    assert.equal(listed.body.templates[0].scope_missing, false);
    const nowhere = await api(context, '/settings/templates', { method: 'POST', body: { ...template, scope: '/srv/unknown' } });
    assert.equal(nowhere.status, 400);
    const moved = await api(context, `/settings/templates/${created.body.id}`, { method: 'PUT', body: { scope: '/srv/unknown' } });
    assert.equal(moved.status, 400);
  });
});
