'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeTemp } = require('../../test-support/run-dir');
const { createSharedKeysPage } = require('../lib/shared-keys-page');
test('shared keys validate, revise, remove and never return values', async () => {
  const page = createSharedKeysPage({ stateDir: await makeTemp('shared-page-') });
  const read = (await page.read({})).body; assert.match(read.notes[0], /couldn't read/);
  const empty = await page.save({ revision: 0, keys: {} }); assert.equal(empty.status, 400); assert.equal(empty.body.reason, 'nothing to save'); assert.equal((await page.read({})).body.revision, 0);
  assert.match((await page.save({ revision: 0, keys: { BAD: 'short' } })).body.reason, /short/);
  assert.match((await page.save({ revision: 0, keys: { 'BAD-NAME': 'longvalue' } })).body.reason, /invalid key name/);
  const saved = await page.save({ revision: 0, keys: { TOKEN: 'longvalue' } }); assert.equal(saved.body.outcome, 'saved'); assert(!JSON.stringify(saved).includes('longvalue'));
  assert.equal((await page.save({ revision: 0, keys: { OTHER: 'longvalue' } })).body.reason, 'changed elsewhere, reload');
  assert.equal((await page.remove({ revision: 1, name: 'TOKEN' })).body.outcome, 'removed');
  assert.equal((await page.remove({ revision: 2, name: 'TOKEN' })).body.reason, 'key is not stored');
});
test('shared declarations fetch a missing copy and report refresh failure', async () => {
  const shared = require('../lib/shared-tools'), folder = require('../lib/folder-tools');
  const original = { find: shared.findSharedProject, identity: shared.identityFor, newest: shared.newestCopy, refresh: shared.refreshShared, discover: folder.discover };
  try {
    shared.findSharedProject = async () => '/project'; shared.identityFor = async () => 'id'; shared.newestCopy = () => null;
    let calls = 0; shared.refreshShared = async () => { calls++; return { copy: '/copy' }; };
    folder.discover = async () => ({ rows: [{ name: 'demo', tool: { keys: ['TOKEN'] } }] });
    const page = createSharedKeysPage({ stateDir: await makeTemp('shared-fetch-') }), input = { shared_tools: { repo: 'a/b', candidates: ['/project'] } };
    const read = (await page.read(input)).body; assert.equal(calls, 1); assert.deepEqual(read.keys[0], { name: 'TOKEN', stored: false, folder_usable: null, reason: null, tools: ['demo'] });
    const saved = await page.save({ revision: 0, keys: { TOKEN: 'secretvalue' } }); assert.deepEqual(saved.body.keys[0].tools, []); assert.equal(calls, 1); assert(!JSON.stringify(saved).includes('secretvalue'));
    shared.newestCopy = () => '/copy'; await page.read(input); assert.equal(calls, 1); assert.deepEqual((await page.save({ revision: 1, keys: { OTHER: 'othervalue' } })).body.keys.map(k => k.tools), [[], []]);
    shared.newestCopy = () => null; shared.refreshShared = async () => ({ copy: null, error: 'offline' }); assert.match((await page.read(input)).body.notes[0], /offline/);
  } finally { shared.findSharedProject = original.find; shared.identityFor = original.identity; shared.newestCopy = original.newest; shared.refreshShared = original.refresh; folder.discover = original.discover; }
});
test('service serializes simultaneous shared key saves', async () => {
  const fs = require('node:fs/promises'), path = require('node:path'), { MachineService } = require('../service');
  const root = await makeTemp('shared-service-'), state = path.join(root, 'state'), secret = path.join(root, 'secret');
  await fs.mkdir(state); await fs.writeFile(secret, 'correct-secret\n');
  await fs.writeFile(path.join(state, 'machine.json'), JSON.stringify({ secret_file: secret, host: '127.0.0.1', port: 0 }));
  const service = new MachineService({ stateDir: state, host: '127.0.0.1', port: 0, win: { procRoot: __dirname, etcRoot: __dirname, runRoot: __dirname } });
  await service.listen();
  try {
    const url = `http://127.0.0.1:${service.server.address().port}/v1/shared-keys/save`;
    const send = name => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-wheelchair-machine-secret': 'correct-secret' }, body: JSON.stringify({ revision: 0, keys: { [name]: 'longvalue' } }) }).then(async r => ({ status: r.status, body: await r.json() }));
    let timer; const results = await Promise.race([Promise.all([send('ONE'), send('TWO')]), new Promise(resolve => { timer = setTimeout(() => resolve(null), 5000); })]).finally(() => clearTimeout(timer));
    assert.ok(results, 'concurrent saves did not finish before deadline'); assert.deepEqual(results.map(r => r.status).sort(), [200, 409]); assert.equal(results.find(r => r.status === 200).body.outcome, 'saved'); assert.equal(results.find(r => r.status === 409).body.reason, 'changed elsewhere, reload');
  } finally { service.server.closeAllConnections(); await new Promise(resolve => service.server.close(resolve)); }
});


test('missing shared project reports the exact note', async () => {
  const shared = require('../lib/shared-tools'), original = shared.findSharedProject;
  try {
    shared.findSharedProject = async () => null;
    const page = createSharedKeysPage({ stateDir: await makeTemp('shared-missing-') });
    assert.deepEqual((await page.read({ shared_tools: { repo: 'a/b', candidates: [] } })).body.notes, ["couldn't read the shared tools: the shared tools project isn't added on this machine"]);
  } finally { shared.findSharedProject = original; }
});

test('service releases shared write lock before slow listing', async () => {
  const fs = require('node:fs/promises'), path = require('node:path'), { MachineService } = require('../service');
  const shared = require('../lib/shared-tools'), folder = require('../lib/folder-tools');
  const original = { find: shared.findSharedProject, identity: shared.identityFor, newest: shared.newestCopy, discover: folder.discover };
  const root = await makeTemp('shared-lock-'), state = path.join(root, 'state'), secret = path.join(root, 'secret');
  await fs.mkdir(state); await fs.writeFile(secret, 'correct-secret\n');
  await fs.writeFile(path.join(state, 'machine.json'), JSON.stringify({ secret_file: secret, host: '127.0.0.1', port: 0 }));
  const service = new MachineService({ stateDir: state, host: '127.0.0.1', port: 0, win: { procRoot: __dirname, etcRoot: __dirname, runRoot: __dirname } });
  let release, started; const gate = new Promise(resolve => { release = resolve; }), entered = new Promise(resolve => { started = resolve; });
  try {
    shared.findSharedProject = async () => '/project'; shared.identityFor = async () => 'id'; shared.newestCopy = () => '/copy';
    folder.discover = async () => { started(); await gate; return { rows: [] }; };
    await service.listen();
    const url = `http://127.0.0.1:${service.server.address().port}/v1/shared-keys/save`;
    const send = data => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-wheelchair-machine-secret': 'correct-secret' }, body: JSON.stringify(data) }).then(async r => ({ status: r.status, body: await r.json() }));
    const first = send({ revision: 0, keys: { FIRST: 'firstvalue' }, shared_tools: { repo: 'a/b', candidates: ['/project'] } });
    const wait = promise => { let timer; return Promise.race([promise, new Promise(resolve => { timer = setTimeout(() => resolve(null), 3000); })]).finally(() => clearTimeout(timer)); };
    assert.equal(await wait(Promise.race([entered.then(() => true), first.then(() => false)])), true, 'first listing did not start before the request settled or the deadline');
    const second = await wait(send({ revision: 1, keys: { SECOND: 'secondvalue' } }));
    assert.ok(second, 'second save did not finish before listing was released'); assert.equal(second.status, 200); assert.equal(second.body.outcome, 'saved'); assert.equal(second.body.revision, 2);
    release(); const firstResult = await wait(first); assert.ok(firstResult); assert.equal(firstResult.body.outcome, 'saved');
  } finally {
    release(); shared.findSharedProject = original.find; shared.identityFor = original.identity; shared.newestCopy = original.newest; folder.discover = original.discover;
    if (service.server.listening) await new Promise(resolve => service.server.close(resolve));
  }
});

test('project key status service route returns all four fields', async () => {
  const fs = require('node:fs/promises'), path = require('node:path'), { execFileSync } = require('node:child_process'), { MachineService } = require('../service');
  const root = await makeTemp('key-status-route-'), state = path.join(root, 'state'), repo = path.join(root, 'repo'), secret = path.join(root, 'secret');
  await fs.mkdir(state); await fs.mkdir(repo); execFileSync('git', ['init', '-q', repo]); await fs.writeFile(secret, 'correct-secret\n');
  await fs.writeFile(path.join(state, 'machine.json'), JSON.stringify({ secret_file: secret, host: '127.0.0.1', port: 0 }));
  const service = new MachineService({ stateDir: state, host: '127.0.0.1', port: 0, win: { procRoot: __dirname, etcRoot: __dirname, runRoot: __dirname } });
  await service.listen();
  try {
    const response = await fetch(`http://127.0.0.1:${service.server.address().port}/v1/project-tools/key-status`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-wheelchair-machine-secret': 'correct-secret' }, body: JSON.stringify({ path: repo }) });
    assert.equal(response.status, 200); const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), ['folder_tools', 'key_info', 'key_revision', 'keys']);
    assert.equal(body.key_revision, 0); assert.deepEqual(body.keys, []); assert.deepEqual(body.key_info, []); assert.ok(Array.isArray(body.folder_tools.rows));
  } finally { await new Promise(resolve => service.server.close(resolve)); }
});
