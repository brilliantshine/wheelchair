'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { command } = require('../adapters/codex');

const input = { role: 'worker', model: 'test-model' };
const session = { name: 'wc-test', effort: 'high' };
const worktree = '/work/tree';
const base = ['codex', '-s', 'workspace-write', '-a', 'never', '-c', 'sandbox_workspace_write.network_access=true', '-c', `notify=[${JSON.stringify(path.resolve(__dirname, '../hook.sh'))},"codex","wc-test"]`, '-c', 'projects={"/work/tree"={trust_level="trusted"}}', '-m', 'test-model', '-c', 'model_reasoning_effort=high'];
const call = servers => command(input, session, worktree, { tools: true, mcp: { names: Object.keys(servers), servers } });
const pairs = (...values) => values.flatMap(value => ['-c', value]);
const { serverLabel } = require('../lib/project-mcp');
const warning = (name, reason) => ({ names: [name], text: `${serverLabel(name)}: skipped on Codex: ${reason}` });

test('missing project tools leave the existing command unchanged', () => {
  for (const context of [undefined, { tools: true }, { tools: true, mcp: null }, { tools: true, mcp: { names: [], servers: {} } }]) {
    const result = command(input, session, worktree, context);
    assert.deepEqual(result.argv, base);
    assert.deepEqual(result.warnings || [], []);
  }
});

test('translates stdio and http servers in order', () => {
  const result = call({ local: { command: 'node', args: ['a.js', 'a"b'], env: { LITERAL: 'hello', KEY: '${KEY}' } }, remote: { type: 'http', url: 'https://example.test/mcp' } });
  assert.deepEqual(result.argv, [...base, ...pairs('mcp_servers.project_local.command="node"', 'mcp_servers.project_local.args=["a.js","a\\"b"]', 'mcp_servers.project_local.env={"LITERAL"="hello"}', 'mcp_servers.project_local.env_vars=["KEY"]', 'mcp_servers.project_local.default_tools_approval_mode="approve"', 'mcp_servers.project_local.enabled=true', 'mcp_servers.project_remote.url="https://example.test/mcp"', 'mcp_servers.project_remote.default_tools_approval_mode="approve"', 'mcp_servers.project_remote.enabled=true')]);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(call({ empty: { command: 'go' } }).argv.slice(base.length), pairs('mcp_servers.project_empty.command="go"', 'mcp_servers.project_empty.args=[]', 'mcp_servers.project_empty.env={}', 'mcp_servers.project_empty.env_vars=[]', 'mcp_servers.project_empty.default_tools_approval_mode="approve"', 'mcp_servers.project_empty.enabled=true'));
});

test('reviewer receives neither overrides nor warnings', () => {
  const result = command({ ...input, role: 'reviewer' }, session, worktree, { tools: false, mcp: { servers: { 'bad.name': { command: '${X}' } } } });
  assert.deepEqual(result.argv, ['codex', '-s', 'read-only', '-a', 'never', ...base.slice(7)]);
  assert.deepEqual(result.warnings || [], []);
});

test('unsupported expansions skip only their server', () => {
  const entries = [
    { command: 'go', env: { KEY: '${OTHER}' } },
    { command: 'go', env: { KEY: '${KEY:-x}' } },
    { command: 'go', args: ['${HOME}'] },
    { type: 'http', url: '${X}' },
    { command: '${X}' },
    { command: 'go', env: { 'bad-key': '${bad-key}' } },
  ];
  for (const entry of entries) {
    const result = call({ bad: entry, good: { command: 'ok' } });
    assert.deepEqual(result.warnings, [warning('bad', 'it uses ${...} that Codex cannot pass through')]);
    assert.deepEqual(result.argv, call({ good: { command: 'ok' } }).argv);
  }
});

test('invalid names and headers are warned in priority order on one line', () => {
  const result = call({ 'bad.name': { command: '${X}', headers: {} }, 'line\nbreak': { command: 'go' }, headers: { type: 'http', url: '${X}', headers: {} } });
  assert.deepEqual(result.argv, base);
  assert.deepEqual(result.warnings, [warning('bad.name', 'its name must use only letters, digits, _ and -'), warning('line\nbreak', 'its name must use only letters, digits, _ and -'), warning('headers', 'it uses ${...} that Codex cannot pass through')]);
  for (const item of result.warnings) assert.ok(!item.text.includes('\n'));
});

test('never expands environment secrets into arguments or warnings', () => {
  const previous = process.env.WC_TEST_SECRET;
  process.env.WC_TEST_SECRET = 'sentinel-secret-value';
  try {
    const result = call({ pass: { command: 'go', env: { WC_TEST_SECRET: '${WC_TEST_SECRET}' } }, skip: { command: 'go', args: ['${WC_TEST_SECRET}'] } });
    assert.ok(result.argv.includes('mcp_servers.project_pass.env_vars=["WC_TEST_SECRET"]'));
    assert.ok(!JSON.stringify(result).includes('sentinel-secret-value'));
    assert.deepEqual(result.warnings, [warning('skip', 'it uses ${...} that Codex cannot pass through')]);
  } finally {
    if (previous === undefined) delete process.env.WC_TEST_SECRET;
    else process.env.WC_TEST_SECRET = previous;
  }
});

test('an http entry with stray stdio-shaped keys does not stop its siblings', () => {
  const result = call({ remote: { type: 'http', url: 'https://example.test/mcp', args: {}, env: 5, command: 7 }, local: { command: 'node' } });
  assert.deepEqual(result.argv.slice(base.length), pairs('mcp_servers.project_remote.url="https://example.test/mcp"', 'mcp_servers.project_remote.default_tools_approval_mode="approve"', 'mcp_servers.project_remote.enabled=true', 'mcp_servers.project_local.command="node"', 'mcp_servers.project_local.args=[]', 'mcp_servers.project_local.env={}', 'mcp_servers.project_local.env_vars=[]', 'mcp_servers.project_local.default_tools_approval_mode="approve"', 'mcp_servers.project_local.enabled=true'));
  assert.deepEqual(result.warnings, []);
});

test('control characters are escaped as TOML, not JSON', () => {
  const result = call({ odd: { command: 'n', args: ['a\u007fb', 'q"\\z', 'tab\there'], env: { 'K\u0001': 'v\u007f' } } });
  assert.ok(result.argv.includes('mcp_servers.project_odd.args=["a\\u007fb","q\\"\\\\z","tab\\u0009here"]'));
  assert.ok(result.argv.includes('mcp_servers.project_odd.env={"K\\u0001"="v\\u007f"}'));
  assert.ok(!result.argv.some(value => /[\u0000-\u001f\u007f]/.test(value)));
});

test('overrides too large for one command-line argument are dropped as a whole', () => {
  const big = "'".repeat(20000);
  const result = call({ a: { command: 'n', args: [big] }, b: { command: 'n', args: [big] }, ok: { command: 'go' } });
  assert.deepEqual(result.argv, base);
  assert.deepEqual(result.warnings, [{ names: ['a', 'b', 'ok'], text: 'a, b, ok: skipped on Codex: .mcp.json is too large to pass on the command line' }]);
});


test('headers translate by form and every override is redacted', () => {
  const result = call({ remote: { type: 'http', url: 'https://example.test', headers: { Authorization: 'Bearer ${TOKEN}', 'X-Env': '${ENV}', 'X-Literal': 'hello' } }, local: { command: 'go', headers: { ignored: '${BAD}' } } });
  assert.deepEqual(result.argv.slice(base.length, base.length + 10), pairs('mcp_servers.project_remote.url="https://example.test"', 'mcp_servers.project_remote.bearer_token_env_var="TOKEN"', 'mcp_servers.project_remote.http_headers={"X-Literal"="hello"}', 'mcp_servers.project_remote.env_http_headers={"X-Env"="ENV"}', 'mcp_servers.project_remote.default_tools_approval_mode="approve"'));
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.redactions, result.argv.map((value, i) => value.startsWith('mcp_servers.project_') ? i : -1).filter(i => i >= 0));
  assert.ok(!result.argv.some(value => value.includes('.bearer_token=')));
});

test('header and transport skips follow priority', () => {
  const result = call({ mixed: { type: 'http', url: 'ok', headers: { 'X-Key': 'abc${K}' } }, duplicate: { type: 'http', url: '${X}', headers: { Auth: 'a', auth: 'b' } }, stream: { type: 'sse', url: 'ok' } });
  assert.deepEqual(result.warnings, [warning('mixed', 'a header uses ${...} that Codex cannot pass through'), warning('duplicate', 'has the same header twice'), warning('stream', 'uses sse, which Codex does not support')]);
  assert.deepEqual(result.redactions, []);
});

test('budget counts UTF-8 bytes and names all dropped servers', () => {
  const result = call({ a: { command: 'go', args: ['é'.repeat(18000)] }, b: { command: 'go', args: ['é'.repeat(18000)] } });
  assert.deepEqual(result.argv, base);
  assert.deepEqual(result.redactions, []);
  assert.deepEqual(result.warnings, [{ names: ['a', 'b'], text: 'a, b: skipped on Codex: .mcp.json is too large to pass on the command line' }]);
});

test('skips a reader-marked duplicate header without overrides', () => {
  const { DUPLICATE_HEADERS } = require('../lib/project-mcp');
  const entry = { type: 'http', url: 'ok', headers: { 'X-Fixture': 'last' }, [DUPLICATE_HEADERS]: true };
  const result = call({ duplicate: entry });
  assert.deepEqual(result.warnings, [warning('duplicate', 'has the same header twice')]);
  assert.deepEqual(result.argv, base);
  assert.deepEqual(result.redactions, []);
});
test('exported Codex checks share the command rules', () => {
  const { codexEntryReason, codexOverrides } = require('../adapters/codex');
  assert.equal(codexEntryReason('bad.name', { command: 'x' }), 'its name must use only letters, digits, _ and -');
  assert.equal(codexEntryReason('valid', { command: 'x' }), null);
  assert.equal(codexOverrides({ servers: { valid: { command: 'x' } } }).tooLarge, false);
  assert.equal(codexOverrides({ servers: { valid: { command: 'x'.repeat(70000) } } }).tooLarge, true);
});
