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
const warning = (name, reason) => `server ${JSON.stringify(name)} skipped on Codex: ${reason}`;

test('missing project tools leave the existing command unchanged', () => {
  for (const context of [undefined, { tools: true }, { tools: true, mcp: null }, { tools: true, mcp: { names: [], servers: {} } }]) {
    const result = command(input, session, worktree, context);
    assert.deepEqual(result.argv, base);
    assert.deepEqual(result.warnings || [], []);
  }
});

test('translates stdio and http servers in order', () => {
  const result = call({ local: { command: 'node', args: ['a.js', 'a"b'], env: { LITERAL: 'hello', KEY: '${KEY}' } }, remote: { type: 'http', url: 'https://example.test/mcp' } });
  assert.deepEqual(result.argv, [...base, ...pairs('mcp_servers.project_local.command="node"', 'mcp_servers.project_local.args=["a.js","a\\"b"]', 'mcp_servers.project_local.env={"LITERAL"="hello"}', 'mcp_servers.project_local.env_vars=["KEY"]', 'mcp_servers.project_local.enabled=true', 'mcp_servers.project_remote.url="https://example.test/mcp"', 'mcp_servers.project_remote.enabled=true')]);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(call({ empty: { command: 'go' } }).argv.slice(base.length), pairs('mcp_servers.project_empty.command="go"', 'mcp_servers.project_empty.args=[]', 'mcp_servers.project_empty.env={}', 'mcp_servers.project_empty.env_vars=[]', 'mcp_servers.project_empty.enabled=true'));
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
  assert.deepEqual(result.warnings, [warning('bad.name', 'its name must use only letters, digits, _ and -'), warning('line\nbreak', 'its name must use only letters, digits, _ and -'), warning('headers', 'servers with headers are not supported on Codex yet')]);
  for (const item of result.warnings) assert.ok(!item.includes('\n'));
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
