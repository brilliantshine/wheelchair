'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { setup, close, api } = require('./helpers/app.js');
const { Hub } = require('../app/hub.js');

const id = 'aaaaaaaaaaaa';
const other = 'bbbbbbbbbbbb';
const root = path.resolve(__dirname, '../..');
const refusal = 'This folder runs wheelchair itself; switching it would swap the running app for untested code.';

test('try routes forward recorded identity, preserve fields, allow archive and enrich status', async (t) => {
  const c = await setup();
  const calls = [];
  let active = other;
  let error = false;
  const fake = http.createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw); calls.push({ path: req.url, body, secret: req.headers['x-wheelchair-machine-secret'] });
    res.setHeader('content-type', 'application/json');
    if (error) { res.statusCode = 422; return res.end(JSON.stringify({ error: 'Bad input.' })); }
    const status = { active_thread_id: active, refused: null };
    res.end(JSON.stringify(body.action === 'status' ? status : { ok: true, status }));
  });
  await new Promise((resolve) => fake.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise((resolve) => fake.close(resolve)); await close(c); });
  await fs.writeFile(path.join(c.state, 'machines.json'), JSON.stringify({ hub: { address: '127.0.0.1', port: fake.address().port, secret: 'secret' }, remote: { address: '127.0.0.1', port: fake.address().port, secret: 'secret' } }));
  const hub = new Hub({ stateDir: c.state, codeVersion: '' });
  const saved = { id, title: 'Current', project: '/tmp/project', machine: 'remote', archived: true, sessions: [] };
  await hub.save(saved); await hub.save({ ...saved, id: other, title: 'Other thread' });
  let r = await api(c, `/threads/${id}/try`);
  assert.equal(r.status, 200); assert.equal(r.body.active_thread_title, 'Other thread');
  assert.deepEqual(calls.at(-1), { path: '/v1/try', body: { action: 'status', thread_id: id, project: '/tmp/project' }, secret: 'secret' });
  r = await api(c, `/threads/${id}/try`, { method: 'POST', body: { action: 'forget', version: 'v1', kept: 'refs/kept', project: '/evil', machine: 'hub', thread_id: other } });
  assert.equal(r.body.status.active_thread_title, 'Other thread');
  assert.deepEqual(calls.at(-1).body, { action: 'forget', thread_id: id, project: '/tmp/project', version: 'v1', kept: 'refs/kept' });
  active = 'cccccccccccc';
  r = await api(c, `/threads/${id}/try`, { method: 'POST', body: { action: 'try' } });
  assert.equal(r.body.status.active_thread_title, null);
  assert.deepEqual(calls.at(-1).body, { action: 'try', thread_id: id, project: '/tmp/project' });
  const unauth = await fetch(`${c.server.url}/api/threads/${id}/try`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(unauth.status, 401);
  error = true;
  r = await api(c, `/threads/${id}/try`); assert.equal(r.status, 422); assert.deepEqual(r.body, { error: 'Bad input.' });
  error = false;
  for (const project of [root, path.dirname(root)]) {
    await hub.save({ ...saved, project, machine: 'hub' });
    r = await api(c, `/threads/${id}/try`); assert.equal(r.body.refused, refusal);
    const before = calls.length;
    for (const action of ['try', 'back']) {
      r = await api(c, `/threads/${id}/try`, { method: 'POST', body: { action, version: 'v' } });
      assert.equal(r.body.accepted, false); assert.equal(r.body.reason, refusal); assert.equal(r.body.status.refused, refusal);
    }
    assert.deepEqual(calls.slice(before).map((call) => call.body.action), ['status', 'status']);
    r = await api(c, `/threads/${id}/try`, { method: 'POST', body: { action: 'dismiss', version: 'v' } });
    assert.equal(r.body.ok, true); assert.equal(calls.at(-1).body.action, 'dismiss');
  }
  await fs.writeFile(path.join(c.state, 'machines.json'), JSON.stringify({ hub: { address: '127.0.0.1', port: 1 } }));
  r = await api(c, `/threads/${id}/try`); assert.equal(r.status, 502); assert.deepEqual(r.body, { error: "Can't reach hub." });
});
