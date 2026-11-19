'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const cli = path.resolve(__dirname, '../app/wc.js');
const { screenRequest } = require('../app/wc.js');

const cases = [
  ['start', ['--size', '800x600']],
  ['run', ['--env', 'A=1', '--', 'xmessage', '--help']],
  ['shot', ['--window', '12']],
  ['windows', []],
  ['move', ['1', '2']],
  ['click', ['3', '4', '--button', 'right', '--double']],
  ['drag', ['1', '2', '3', '4']],
  ['type', ['--window x']],
  ['key', ['--hold', '100', 'ctrl+s', 'Return']],
  ['focus', ['99']],
  ['stop', []],
  ['status', []],
];

function runWithServer(args, response = { status: 200, body: '{"ok":true,"display":":5"}' }) {
  const received = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    if (req.method !== 'POST' || !req.url.endsWith('/screen') || req.headers['x-wheelchair-session-token'] !== 'test') {
      res.statusCode = 404;
      res.end();
      return;
    }
    let parsed;
    try { parsed = JSON.parse(body); } catch {
      res.statusCode = 404;
      res.end();
      return;
    }
    received.push({ method: req.method, url: req.url, token: req.headers['x-wheelchair-session-token'], body: parsed });
    res.statusCode = response.status;
    res.end(response.body);
  });
  const closeServer = () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', async () => {
      try {
        const result = await new Promise((resolveChild, rejectChild) => {
          const child = spawn(process.execPath, [cli, ...args], {
            env: { ...process.env, WHEELCHAIR_MACHINE_URL: `http://127.0.0.1:${server.address().port}/v1/agent`, WHEELCHAIR_SESSION_TOKEN: 'test' },
          });
          let stdout = ''; let stderr = '';
          child.stdout.on('data', chunk => { stdout += chunk; });
          child.stderr.on('data', chunk => { stderr += chunk; });
          child.on('error', rejectChild);
          child.on('close', code => resolveChild({ code, stdout, stderr }));
        });
        resolve({ ...result, received });
      } catch (error) { reject(error); }
      finally {
        try { await closeServer(); } catch (error) { reject(error); }
      }
    });
  });
}

for (const [op, args] of cases) {
  test(`screen ${op} passes the operation and unchanged arguments`, async () => {
    assert.deepEqual(screenRequest(op, args), { path: '/screen', body: { op, args } });
    const result = await runWithServer(['screen', op, ...args]);
    assert.equal(result.received.length, 1);
    assert.deepEqual(result.received[0], {
      method: 'POST', url: '/v1/agent/screen', token: 'test', body: { op, args },
    });
    assert.equal(result.stdout, '{"ok":true,"display":":5"}\n');
    assert.equal(result.stderr, '');
    assert.equal(result.code, 0);
  });
}

test('screen non-2xx response is reported with the wc prefix', async () => {
  const result = await runWithServer(['screen', 'status'], { status: 422, body: '{"error":"no screen; run wc.js screen start first"}' });
  assert.equal(result.received.length, 1);
  assert.equal(result.stderr, 'wc: {"error":"no screen; run wc.js screen start first"}\n');
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
});

test('unknown screen op fails without sending a request', async () => {
  let matchingRequests = 0;
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    if (req.method === 'POST' && req.url.endsWith('/screen') && req.headers['x-wheelchair-session-token'] === 'test') {
      try { JSON.parse(body); matchingRequests += 1; } catch { /* Ignore malformed unrelated probes. */ }
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [cli, 'screen', 'fly'], {
        env: { ...process.env, WHEELCHAIR_MACHINE_URL: `http://127.0.0.1:${server.address().port}/v1/agent`, WHEELCHAIR_SESSION_TOKEN: 'test' },
      });
      let stdout = ''; let stderr = '';
      child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
      child.on('error', reject); child.on('close', code => resolve({ code, stdout, stderr }));
    });
    assert.equal(result.code, 1);
    assert.match(result.stderr, /^wc: unsupported screen operation/);
    assert.equal(result.stdout, '');
    assert.equal(matchingRequests, 0);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('screenRequest rejects unknown and missing operations', () => {
  assert.throws(() => screenRequest('fly', []), /unsupported screen operation/);
  assert.throws(() => screenRequest(undefined, []), /unsupported screen operation/);
});
