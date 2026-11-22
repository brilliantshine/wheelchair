'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeTempSync } = require('../../test-support/run-dir');
const adapters = Object.fromEntries(['claude', 'codex', 'agy', 'pi', 'kimi'].map(name => [name, require(`../adapters/${name}`)]));
const servers = {
  win: { command: '/custom/c/Tools/tool.exe' },
  linux: { type: 'stdio', command: '/usr/bin/tool' },
  web: { type: 'http', url: 'https://example.test', command: '/mnt/c/tool.exe' },
  events: { type: 'sse', url: 'https://example.test/events', command: '/mnt/c/tool.exe' },
};
const stateDir = makeTempSync('adapters-loaded-');
function call(name, tools = true, entries = servers) {
  return adapters[name].command({ role: 'worker' }, { name: 'wc-test', cli_session_id: 'test' }, '/work', {
    tools, mount: '/custom', stateDir, promptPath: '/prompt', mcp: { names: [...Object.keys(entries), 'rejected'], servers: entries },
  });
}
const common = [{ name: 'win', windows: true, wrapped: false }, { name: 'linux', windows: false, wrapped: false }, { name: 'web', windows: false, wrapped: false }];
test('adapters report only loaded project entries and classify original transports', () => {
  assert.deepEqual(call('claude').loaded, [...common, { name: 'events', windows: false, wrapped: false }]);
  assert.deepEqual(call('codex').loaded, common);
  assert.deepEqual(call('agy').loaded, common);
  assert.deepEqual(call('pi').loaded, []);
  assert.deepEqual(call('kimi').loaded, []);
  for (const name of Object.keys(adapters)) assert.deepEqual(call(name, false).loaded, [], name);
});
test('Codex reports no loaded entries when its override budget is exceeded', () => {
  const result = call('codex', true, { win: servers.win, huge: { command: 'x'.repeat(70000) } });
  assert.deepEqual(result.loaded, []);
  assert.ok(result.warnings.some(warning => warning.text.includes('too large')));
});
