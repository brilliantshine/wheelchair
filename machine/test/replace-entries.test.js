'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const adapters = Object.fromEntries(['claude', 'codex', 'agy'].map(name => [name, require(`../adapters/${name}`)]));
const http = url => ({ type: 'http', url });
// The shared contract (D17, main's shape): an own-keys object; a value replaces, null withholds.
const map = pairs => Object.assign(Object.create(null), Object.fromEntries(pairs));
function call(cli, servers, replaceEntries, tools = true, extra = {}) {
  return adapters[cli].command({ role: 'worker' }, { name: 'wc-test', cli_session_id: 'id' }, '/work', {
    stateDir: '/state', promptPath: '/prompt', tools, mcp: { names: Object.keys(servers), servers }, replaceEntries, ...extra,
  });
}
for (const cli of Object.keys(adapters)) for (const [replaced, withheld] of [['replace', 'withhold'], ['__proto__', 'withhold'], ['replace', '__proto__'], ['constructor', 'withhold'], ['replace', 'constructor']]) {
  test(`${cli} replaces ${replaced} and withholds ${withheld}`, () => {
    const servers = Object.create(null);
    servers[replaced] = http('http://original.test'); servers[withheld] = http('http://withheld.test'); servers.untouched = http('http://untouched.test');
    const replacements = Object.create(null);
    replacements[replaced] = http('http://replacement.test'); replacements[withheld] = null; replacements.extra = http('http://extra.test');
    const result = call(cli, servers, replacements);
    assert.deepEqual(result.loaded.map(x => x.name), [replaced, 'untouched']);
    const output = JSON.stringify({ argv: result.argv, config: result.mcpConfig, files: result.toolFiles });
    assert.ok(output.includes('http://replacement.test'));
    assert.ok(!output.includes('http://original.test') && !output.includes('http://withheld.test') && !output.includes('http://extra.test'));
    if (cli === 'claude') {
      assert.deepEqual(result.settings.disabledMcpjsonServers, [replaced, withheld]);
      assert.equal(JSON.parse(JSON.stringify(result.mcpConfig.data)).mcpServers[replaced].url, 'http://replacement.test');
      assert.deepEqual(result.argv.slice(result.argv.indexOf('--mcp-config'), result.argv.indexOf('--mcp-config') + 2), ['--mcp-config', '/state/settings/wc-test.mcp.json']);
    } else assert.ok(output.includes('http://untouched.test'));
  });
}
for (const cli of ['codex', 'agy']) test(`${cli} validates replacement and classifies original`, () => {
  const servers = { win: { command: '/mnt/c/tool.exe' }, bad: http('http://old.test') };
  const result = call(cli, servers, map([['win', http('http://new.test')], ['bad', http('http://${X}')]]), true, { wsl: true });
  assert.deepEqual(result.loaded, [{ name: 'win', windows: true, wrapped: true }]);
  assert.equal(result.warnings.length, 1);
  assert.ok(!JSON.stringify(result).includes('http://old.test'));
});
test('Claude with only withheld entries has no config and ignores replacements for non-tool roles', () => {
  const servers = { a: http('http://a.test') }, replacements = map([['a', null]]);
  const result = call('claude', servers, replacements);
  assert.deepEqual(result.loaded, []); assert.equal(result.mcpConfig, undefined); assert.ok(!result.argv.includes('--mcp-config'));
  assert.deepEqual(call('claude', servers, replacements, false), call('claude', servers, undefined, false));
});
test('Codex uses original Windows classification for stdio replacement passthrough', () => {
  const result = call('codex', { win: { command: '/mnt/c/tool.exe' } }, map([['win', { command: '/usr/bin/wrapper' }]]), true, { wsl: true });
  assert.ok(result.argv.some(arg => arg.includes('WHEELCHAIR_WINDOWS_PROJECT')));
});
test('Claude preserves original Windows classification and JSON drops internal symbols', () => {
  const entry = http('http://new.test'); entry[Symbol('internal')] = true;
  const result = call('claude', { win: { command: '/mnt/c/tool.exe' } }, map([['win', entry]]));
  assert.deepEqual(result.loaded, [{ name: 'win', windows: true, wrapped: true }]);
  assert.equal(result.mcpConfig.path, '/state/settings/wc-test.mcp.json');
  assert.deepEqual(JSON.parse(JSON.stringify(result.mcpConfig.data)), { mcpServers: { win: http('http://new.test') } });
});
