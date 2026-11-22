'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTemp } = require('../../test-support/run-dir');
const { MachineService } = require('../service');

test('marked Claude tool is rewritten once, written privately and removed at stop', async () => {
  const root = await makeTemp('forward-service-'), state = path.join(root, 'state'), work = path.join(root, 'work'), bin = path.join(root, 'bin');
  fs.mkdirSync(work); fs.mkdirSync(bin);
  for (const name of ['git', 'tmux', 'systemd-run']) fs.writeFileSync(path.join(bin, name), '#!/bin/sh\ncase "$1" in capture-pane) echo "❯ Try anything";; esac\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(work, '.mcp.json'), JSON.stringify({ mcpServers: { tool: { type: 'http', url: 'http://localhost:1234/mcp' } }, wheelchair: { windows: ['tool'] } }));
  const old = process.env.PATH; process.env.PATH = `${bin}:${old}`;
  const forwards = { get: async port => { assert.equal(port, 1234); return 4567; }, restore: async () => {}, status: () => ({}), check: async () => ({ ok: true }) };
  const service = new MachineService({ stateDir: state, win: { procRoot: root, etcRoot: root, runRoot: root, forwards } });
  service.win.detected.kernel = true;
  let calls = 0; const command = service.commandFor.bind(service); service.commandFor = (...args) => { calls++; return command(...args); };
  try {
    await service.init();
    const session = await service.start({ name: 'wc-forward', cli: 'claude', role: 'worker', thread_id: 'forward', token: 'token', worktree: work });
    const file = path.join(state, 'settings', `${session.name}.mcp.json`);
    assert.equal(calls, 1); assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.equal(JSON.parse(fs.readFileSync(file)).mcpServers.tool.url, 'http://127.0.0.1:4567/mcp');
    assert.ok(JSON.parse(fs.readFileSync(path.join(state, 'settings', `${session.name}.json`))).disabledMcpjsonServers.includes('tool'));
    assert.ok(session.command.includes('--mcp-config'));
    await service.stop(session.name); assert.equal(fs.existsSync(file), false);
  } finally {
    for (const key of ['pollTimer', 'stepsTimer', 'kimiTimer', 'trustTimer', 'agyToolsTimer', 'winTimer', 'screenTimer']) clearInterval(service[key]);
    clearInterval(service.win.healthTimer); process.env.PATH = old;
  }
});

test('status route checks only eligible tools without creating forwards', async () => {
  const state = await makeTemp('forward-status-');
  let gets = 0, checks = 0;
  const forwards = { get: async () => { gets++; }, restore: async () => {}, status: () => ({ note: 'restored', last: { reason: 'refused' } }), check: async port => { checks++; return port === 7 ? { ok: true } : { ok: false, reason: 'refused' }; } };
  const service = new MachineService({ stateDir: state, win: { procRoot: state, etcRoot: state, runRoot: state, forwards } });
  service.win.detected.kernel = true; service.win.forwardReady = () => true; service.authorize = async () => {};
  const { Readable } = require('node:stream');
  const input = { tools: [{ id: '__proto__', type: 'http', url: 'http://localhost:7' }, { id: 'bad', type: 'http', url: 'http://localhost:8' }, { id: 'sse', type: 'sse', url: 'http://localhost:9' }] };
  const request = Readable.from([Buffer.from(JSON.stringify(input))]); request.method = 'POST'; request.url = '/v1/project-tools/windows-status'; request.headers = {};
  let body; const response = { writeHead(code) { this.statusCode = code; }, end(value) { body = JSON.parse(value); } };
  await service.handle(request, response);
  assert.equal(response.statusCode, 200); assert.equal(body.status.__proto__.state, 'reachable'); assert.equal(body.status.__proto__.note, 'restored'); assert.equal(body.status.bad.reason, 'refused'); assert.equal(Object.hasOwn(body.status, 'sse'), false); assert.equal(checks, 2); assert.equal(gets, 0);
});
