'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const { startServer } = require('./helpers/server.js');

test('tools.js defines WHEELCHAIR_TOOLS: five tools in registry order, no install field', async () => {
  const server = await startServer();
  try {
    const res = await fetch(`${server.url}/assets/tools.js`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/javascript; charset=utf-8');
    const window = {};
    vm.runInNewContext(await res.text(), { window });
    const tools = JSON.parse(JSON.stringify(window.WHEELCHAIR_TOOLS));
    assert.deepEqual(tools.map((t) => t.cli), ['claude', 'codex', 'agy', 'kimi', 'pi']);
    assert.deepEqual(tools.map((t) => t.label), ['Claude', 'GPT', 'Antigravity', 'Kimi Code', 'OpenRouter']);
    for (const t of tools) {
      assert.equal('install' in t, false, `${t.cli} has no install field`);
      for (const key of ['models', 'settings', 'placement', 'capabilities']) assert.ok(t[key], `${t.cli}.${key}`);
    }
    assert.deepEqual(tools[3].models.efforts, []);
  } finally { await server.stop(); }
});
