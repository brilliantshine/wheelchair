'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const agy = require('../../connectors/agy/machine.js');

function command(servers, tools = true, name = 'wc-a/b') {
  return agy.command({}, { name }, '/work', { stateDir: '/state', tools, mcp: { names: Object.keys(servers), servers } });
}

test('translates only transport fields into private plugin file descriptions', () => {
  const secret = 'literal-header-secret';
  const result = command({
    web: { type: 'http', url: 'https://example.test', headers: { Authorization: secret }, args: ['${IGNORED}'] },
    local: { command: 'server', args: ['arg'], env: { TOKEN: '${TOKEN}', LITERAL: 'value' }, headers: { X: '${IGNORED}' } },
  });
  const dir = path.join('/state', 'agy-tools', 'wc-a%2Fb');
  const plugin = path.join(dir, '.agents/plugins/wheelchair-project');
  assert.deepEqual(result.argv, ['agy', '--settings', '/state/settings/wc-a/b.json', '--add-dir', dir, '--dangerously-skip-permissions']);
  assert.equal(result.toolFiles.dir, dir);
  assert.deepEqual(result.toolFiles.files.map(file => file.path), [path.join(plugin, 'plugin.json'), path.join(plugin, 'mcp_config.json')]);
  assert.equal(result.toolFiles.files[0].text, JSON.stringify({ name: 'wheelchair-project', version: '1' }, null, 2) + '\n');
  assert.equal(result.toolFiles.files[1].text, JSON.stringify({ mcpServers: {
    web: { type: 'http', url: 'https://example.test', headers: { Authorization: secret } },
    local: { command: 'server', args: ['arg'], env: { LITERAL: 'value' } },
  } }, null, 2) + '\n');
  assert.ok(!JSON.stringify(result.argv).includes(secret));
  assert.ok(!JSON.stringify(result.warnings || []).includes(secret));
  assert.equal(result.warnings, undefined);
  const reviewer = command({ web: { type: 'http', url: 'https://example.test' } }, false);
  assert.equal(reviewer.toolFiles, undefined);
  assert.equal(reviewer.warnings, undefined);
  assert.ok(!reviewer.argv.includes('--add-dir'));
  assert.equal(command({}).toolFiles, undefined);
});

test('skips unsupported entries in precedence order without exposing values', () => {
  const entries = {
    'bad name': { type: 'sse', url: '${SECRET}' },
    stream: { type: 'sse', url: 'https://example.test' },
    duplicate: { type: 'http', url: '${SECRET}', headers: { Token: 'one', token: 'two' } },
    alias: { command: 'x', env: { CHILD: '${PARENT}' } },
    cmd: { command: '${COMMAND}' },
    arg: { command: 'x', args: ['${ARG}'] },
    url: { type: 'http', url: '${URL}' },
    header: { type: 'http', url: 'https://example.test', headers: { X: '${VALUE}' } },
    envkey: { command: 'x', env: { '${KEY}': 'value' } },
    headerkey: { type: 'http', url: 'https://example.test', headers: { '${KEY}': 'value' } },
  };
  const result = command(entries);
  const variable = 'uses ${...} that Antigravity cannot pass through';
  const reasons = ['its name must use only letters, digits, _ and -', 'uses sse, which Antigravity does not support here', 'has the same header twice', ...Array(7).fill(variable)];
  assert.deepEqual(result.warnings, Object.keys(entries).map((name, i) => ({ names: [name], text: `${name === 'bad name' ? '"bad name"' : name}: skipped on Antigravity: ${reasons[i]}` })));
  assert.equal(result.toolFiles, undefined);
  assert.ok(!result.argv.includes('--add-dir'));
  assert.ok(!JSON.stringify(result).includes("project tools aren't supported on Antigravity yet"));
  assert.ok(!JSON.stringify(result.warnings).includes('SECRET'));
  assert.equal(command(entries, false).warnings, undefined);
});

test('skips a reader-marked duplicate header without a plugin', () => {
  const { DUPLICATE_HEADERS } = require('../lib/project-mcp');
  const entry = { type: 'http', url: 'ok', headers: { 'X-Fixture': 'last' }, [DUPLICATE_HEADERS]: true };
  const result = command({ duplicate: entry });
  assert.deepEqual(result.warnings, [{ names: ['duplicate'], text: 'duplicate: skipped on Antigravity: has the same header twice' }]);
  assert.equal(result.toolFiles, undefined);
  assert.ok(!result.argv.includes('--add-dir'));
});
