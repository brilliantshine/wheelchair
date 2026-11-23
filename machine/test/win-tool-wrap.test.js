'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const { makeTempSync } = require('../../test-support/run-dir');
const { PROXY, wrapEntries, cacheKey } = require('../lib/win-tool-wrap');
const adapters = Object.fromEntries(['claude', 'codex', 'agy'].map(name => [name, require('../../connectors').machine(name)]));
const mount = makeTempSync('win-tool-mount-');
const win = path.join(mount, 'c', 'Tools', 'tool.exe');
const servers = {
  win: { command: win, args: ['a'], env: { FOO: '${FOO}' }, cwd: '/work', type: 'stdio' },
  bare: { command: win },
  unity: { command: win, args: ['mcp-for-unity'] },
  web: { type: 'http', url: 'https://example.test', command: win },
  linux: { command: '/usr/bin/tool' },
};
const cacheFile = name => `/cache/${name}.json`;
const options = { servers, wsl: true, mount, readyFile: '/ready', cacheFile };
const replacements = wrapEntries(options);
const session = { name: 'wc-test', cli_session_id: 'test' };
const context = { tools: true, stateDir: '/state', promptPath: '/prompt', mount, wsl: true, mcp: { names: Object.keys(servers), servers }, replaceEntries: replacements };
const call = (name, extra = {}) => adapters[name].command({ role: 'worker' }, session, '/work', { ...context, ...extra });

test('wraps only eligible Windows stdio entries and hashes original invocation', () => {
  assert.deepEqual(Object.keys(replacements), ['win', 'bare']);
  assert.deepEqual(replacements.win, { ...servers.win, command: process.execPath, args: [PROXY, '--ready-file', '/ready', '--list-cache', '/cache/win.json', '--name', 'win', '--', win, 'a'] });
  assert.deepEqual(replacements.bare.args, [PROXY, '--ready-file', '/ready', '--list-cache', '/cache/bare.json', '--name', 'bare', '--', win]);
  assert.deepEqual(wrapEntries({ ...options, wsl: false }), {});
  assert.equal(cacheKey('/common', 'bare', servers.bare), crypto.createHash('sha256').update(JSON.stringify(['/common', 'bare', win, []])).digest('hex'));
});

test('adapters emit replacements and report original classification', () => {
  const claude = call('claude');
  assert.deepEqual(claude.settings.disabledMcpjsonServers, ['win', 'bare']);
  assert.deepEqual(claude.mcpConfig, { path: '/state/settings/wc-test.mcp.json', data: { mcpServers: replacements } });
  assert.deepEqual(claude.argv.slice(claude.argv.indexOf('--mcp-config'), claude.argv.indexOf('--mcp-config') + 2), ['--mcp-config', claude.mcpConfig.path]);
  assert.ok(!claude.argv.includes('--strict-mcp-config'));
  const codex = call('codex');
  assert.ok(codex.argv.includes(`mcp_servers.project_win.command=${JSON.stringify(process.execPath)}`));
  assert.ok(codex.argv.includes(`mcp_servers.project_win.args=${JSON.stringify(replacements.win.args)}`));
  assert.ok(codex.argv.includes('mcp_servers.project_win.env_vars=["FOO","WHEELCHAIR_WINDOWS_PROJECT","WSLENV"]'));
  const agy = call('agy');
  const config = JSON.parse(agy.toolFiles.files[1].text).mcpServers;
  assert.deepEqual(config.win, { command: process.execPath, args: replacements.win.args, env: {} });
  for (const name of Object.keys(adapters)) {
    assert.deepEqual(call(name).loaded, [
      { name: 'win', windows: true, wrapped: true }, { name: 'bare', windows: true, wrapped: true },
      { name: 'unity', windows: true, wrapped: false }, { name: 'web', windows: false, wrapped: false }, { name: 'linux', windows: false, wrapped: false },
    ]);
  }
});

test('null withholds entries without warnings and replacement validation and budget still apply', () => {
  for (const name of Object.keys(adapters)) {
    const result = call(name, { replaceEntries: { win: null } });
    assert.ok(!result.loaded.some(entry => entry.name === 'win'));
    assert.ok(!(result.warnings || []).some(warning => warning.names.includes('win')));
    if (name === 'claude') { assert.ok(result.settings.disabledMcpjsonServers.includes('win')); assert.equal(result.mcpConfig, undefined); }
    if (name === 'codex') assert.ok(!result.argv.some(arg => arg.includes('project_win.')));
    if (name === 'agy') assert.ok(!Object.hasOwn(JSON.parse(result.toolFiles.files[1].text).mcpServers, 'win'));
  }
  const huge = call('codex', { replaceEntries: { win: { command: 'x'.repeat(70000) } } });
  assert.deepEqual(huge.loaded, []);
  assert.ok(huge.warnings.some(warning => warning.text.includes('too large')));
  for (const name of ['codex', 'agy']) {
    const result = call(name, { replaceEntries: { win: { command: '${BAD}' } } });
    assert.ok(!result.loaded.some(entry => entry.name === 'win'));
    assert.ok(result.warnings.some(warning => warning.names.includes('win')));
  }
});
