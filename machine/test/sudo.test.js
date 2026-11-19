'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { MachineService } = require('../service');
const { makeTemp } = require('../../test-support/run-dir');

const password = 'hunter2-TESTPW-9f3a';
const hubHeader = { 'x-wheelchair-machine-secret': 'secret' };
const card = { kind: 'sudo', command: 'id', does: 'Identify user', why: 'Inspect access', request_id: 'forged', url: 'forged', editable: ['forged'] };
const listen = (server, ...args) => new Promise(resolve => server.listen(...args, resolve));
const close = server => new Promise(resolve => server.close(resolve));
async function files(dir) {
  const all = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) all.push(...await files(file));
    else if (entry.isFile()) all.push(await fs.readFile(file, 'utf8'));
  }
  return all;
}

test('sudo registration, delivery, recovery and cancel preserve outcomes', async () => {
  const root = await makeTemp('sudo-machine-');
  const socket = path.join(root, 'intake.sock');
  const stateDir = path.join(root, 'state');
  const secretFile = path.join(root, 'secret');
  await fs.writeFile(secretFile, 'secret');
  const calls = [], responses = [], logs = [];
  let current = { state: 'waiting' }, intakeCode = 201, cardCode = 503, outcomeCode = 409, cancelCalls = 0;
  const id = 'a'.repeat(32);
  const helper = http.createServer((req, res) => {
    let body = ''; req.on('data', chunk => { body += chunk; }); req.on('end', () => {
      calls.push({ path: req.url, method: req.method, body });
      let answer;
      if (req.url === '/requests') { answer = intakeCode === 201 ? { request_id: id, url: `https://example.test/r/${id}`, editable: ['/writable'] } : { error: 'refused by helper' }; res.statusCode = intakeCode; }
      else { if (req.url.endsWith('/cancel')) cancelCalls++; answer = current; }
      res.end(JSON.stringify(answer));
    });
  });
  await listen(helper, socket);
  const hub = http.createServer((req, res) => { let body = ''; req.on('data', chunk => { body += chunk; }); req.on('end', () => {
    assert.equal(req.headers['x-wheelchair-machine-secret'], 'secret');
    const payload = JSON.parse(body); responses.push({ path: req.url, payload });
    res.statusCode = req.url.endsWith('/cards') ? cardCode : outcomeCode;
    res.end('{}');
  }); });
  await listen(hub, 0, '127.0.0.1');
  const probe = http.createServer(); await listen(probe, 0, '127.0.0.1'); const port = probe.address().port; await close(probe);
  const options = { stateDir, host: '127.0.0.1', port, secretFile, hubUrl: `http://127.0.0.1:${hub.address().port}`, sudoIntake: socket };
  let service;
  async function start() {
    service = new MachineService(options); service.log = value => logs.push(String(value));
    service.tmux = () => ({ ok: true, stdout: '', stderr: '' });
    await service.listen();
    service.sessions = { lead: { name: 'wc-t-lead', thread_id: 't', role: 'lead', token: 'lead' }, worker: { name: 'wc-t-worker', thread_id: 't', role: 'worker', token: 'worker' } };
  }
  async function api(endpoint, payload, headers) {
    const response = await fetch(`http://127.0.0.1:${service.server.address().port}${endpoint}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(payload) });
    const body = await response.json(); logs.push(JSON.stringify(body)); return { status: response.status, body };
  }
  const post = (token = 'lead') => api('/v1/agent/cards', card, { 'x-wheelchair-session-token': token });
  const cancel = () => api(`/v1/sudo/${id}/cancel`, {}, hubHeader);
  try {
    await start();
    assert.equal((await post('worker')).status, 403); assert.equal(calls.length, 0);
    intakeCode = 422; assert.deepEqual(await post(), { status: 422, body: { error: 'refused by helper' } });
    intakeCode = 201; assert.equal((await post()).status, 202);
    const queued = responses.find(c => c.path.endsWith('/cards')).payload;
    assert.equal(queued.request_id, id); assert.equal(queued.url, `https://example.test/r/${id}`); assert.deepEqual(queued.editable, ['/writable']);
    assert.deepEqual(JSON.parse(calls.at(-1).body), { command: 'id', does: 'Identify user', why: 'Inspect access' });
    current = { state: 'ran', exit_code: 0, output: 'different output marker', truncated: false };
    await service.sudo.tick(); assert.equal(responses.filter(c => c.path.endsWith('sudo-outcome')).length, 0);
    assert.equal((await fs.stat(path.join(stateDir, 'sudo-requests.json'))).mode & 0o777, 0o600);
    current = { state: 'expired' }; assert.deepEqual((await cancel()).body, { state: 'ran', exit_code: 0, output: 'different output marker', truncated: false }); assert.equal(cancelCalls, 0);
    await close(service.server);
    cardCode = 200; await start();
    assert.equal(service.sudo.entries[id].result.state, 'ran');
    await service.sudo.tick(); await service.sudo.tick();
    const outcomes = responses.filter(c => c.path.endsWith('sudo-outcome'));
    assert.equal(outcomes.length, 2); assert.equal(outcomes[0].payload.state, 'ran'); assert.equal(outcomes[0].payload.delivery_id, outcomes[1].payload.delivery_id);
    outcomeCode = 200; await service.sudo.tick(); assert.equal(service.sudo.entries[id], undefined);
    current = { state: 'waiting' }; await post(); current = { state: 'declined' };
    assert.deepEqual((await cancel()).body, { state: 'declined' }); assert.equal(cancelCalls, 1); assert.equal(service.sudo.entries[id].result.state, 'declined');
    assert.deepEqual((await cancel()).body, { state: 'declined' }); assert.equal(cancelCalls, 1);
    assert.equal((await api(`/v1/sudo/${'b'.repeat(32)}/cancel`, {}, hubHeader)).status, 404);
    await close(helper);
    assert.deepEqual(await post(), { status: 503, body: { error: `sudo helper not installed on ${os.hostname()}; the user installs it once with: sudo ${path.resolve(__dirname, '../..')}/sudo-helper/install.sh` } });
    for (const text of [...await files(stateDir), ...logs, JSON.stringify(calls), JSON.stringify(responses)]) assert.equal(text.includes(password), false);
  } finally { if (service?.server.listening) await close(service.server); if (helper.listening) await close(helper); await close(hub); }
});
