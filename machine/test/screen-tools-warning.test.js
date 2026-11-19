'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { MachineService } = require('../service');
const { TOOLS } = require('../lib/screen');
const { makeTemp } = require('../../test-support/run-dir');

const listen = (server, ...args) => new Promise(resolve => server.listen(...args, resolve));
const close = server => new Promise(resolve => server.close(resolve));

test('approval card reports missing screen tools, preserves startup order, and respects platform', async () => {
  const root = await makeTemp('screen-warning-');
  const empty = path.join(root, 'empty'), partial = path.join(root, 'partial'), full = path.join(root, 'full');
  await Promise.all([empty, partial, full].map(dir => fs.mkdir(dir)));
  for (const name of TOOLS) {
    await fs.writeFile(path.join(full, name), '', { mode: 0o755 });
    if (name === TOOLS[1] || name === TOOLS[6]) await fs.writeFile(path.join(partial, name), '', { mode: 0o755 });
  }
  const secretFile = path.join(root, 'secret'); await fs.writeFile(secretFile, 'secret');
  const cards = [];
  const hub = http.createServer((req, res) => { let body = ''; req.on('data', chunk => { body += chunk; }); req.on('end', () => { cards.push(JSON.parse(body)); res.end('{}'); }); });
  await listen(hub, 0, '127.0.0.1');
  const probe = http.createServer(); await listen(probe, 0, '127.0.0.1'); const port = probe.address().port; await close(probe);
  const service = new MachineService({ stateDir: path.join(root, 'state'), host: '127.0.0.1', port, secretFile, hubUrl: `http://127.0.0.1:${hub.address().port}` });
  service.tmux = () => ({ ok: true, stdout: '', stderr: '' });
  const oldPath = process.env.PATH;
  try {
    await service.listen();
    service.sessions = { lead: { name: 'wc-t-lead', thread_id: 't', role: 'lead', token: 'lead' } };
    service.platform = 'linux'; service.refreshStartupWarning = () => {};
    const post = async () => {
      const res = await fetch(`http://127.0.0.1:${service.server.address().port}/v1/agent/cards`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-wheelchair-session-token': 'lead' }, body: JSON.stringify({ kind: 'approval' }) });
      assert.equal(res.status, 200); return cards.at(-1);
    };
    const warning = names => `Screens won't work on ${os.hostname()}: missing ${names.join(', ')}. Builds that don't use a screen are unaffected.`;
    process.env.PATH = empty; assert.deepEqual((await post()).warnings, [warning(TOOLS)]);
    process.env.PATH = partial; assert.deepEqual((await post()).warnings, [warning(TOOLS.filter(n => n !== TOOLS[1] && n !== TOOLS[6]))]);
    service.startupWarning = 'startup'; assert.deepEqual((await post()).warnings, ['startup', warning(TOOLS.filter(n => n !== TOOLS[1] && n !== TOOLS[6]))]);
    service.startupWarning = null; process.env.PATH = full; assert.equal('warnings' in await post(), false);
    process.env.PATH = empty; service.platform = 'darwin'; assert.equal('warnings' in await post(), false);
  } finally { process.env.PATH = oldPath; if (service.server.listening) await close(service.server); await close(hub); }
});
