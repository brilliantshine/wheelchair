'use strict';
// Keep service instances independent of the host's WSL and interop setup.
const noWsl = { procRoot: __dirname, etcRoot: __dirname, runRoot: __dirname };
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { makeTemp } = require('../../test-support/run-dir');
const { readProjectMcp, TOOL_ROLES } = require('../lib/project-mcp');
const claude = require('../../connectors/claude/machine.js');
const agy = require('../../connectors/agy/machine.js');
const { MachineService } = require('../service');

const session = { name: 'wc-test-worker', cli_session_id: 'id', permission_mode: 'auto' };
const base = { stateDir: '/state', promptPath: '/prompt', rolePrompt: '' };
const command = (adapter, mcp, tools) => adapter.command({}, session, '/work', { ...base, mcp, tools });
async function fixture(content) { const dir = await makeTemp('project-mcp-'); if (content !== undefined) await fs.writeFile(path.join(dir, '.mcp.json'), content); return dir; }
const good = { stdio: { command: 'server', args: ['a'], env: { KEY: '${KEY}' } }, web: { type: 'http', url: 'https://example.test' } };

test('missing file preserves both adapters and roles', async () => {
  const { mcp, warnings } = await readProjectMcp(await fixture());
  assert.equal(mcp, null); assert.deepEqual(warnings, []);
  for (const adapter of [claude, agy]) assert.deepEqual(command(adapter, mcp, true), adapter.command({}, session, '/work', base));
  assert.deepEqual([...TOOL_ROLES], ['lead', 'sub-lead', 'worker', 'verifier']);
});
test('valid servers enabled for worker and disabled for reviewer', async () => {
  const { mcp, warnings } = await readProjectMcp(await fixture(JSON.stringify({ mcpServers: good })));
  assert.deepEqual(warnings, []); assert.deepEqual(mcp.servers, good);
  const worker = command(claude, mcp, true).settings;
  assert.equal(worker.enableAllProjectMcpServers, true); assert.equal(worker.disabledMcpjsonServers, undefined);
  const reviewer = command(claude, mcp, false).settings;
  assert.deepEqual(reviewer.disabledMcpjsonServers, ['stdio', 'web']); assert.equal(reviewer.enableAllProjectMcpServers, undefined);
});
test('broken documents leave settings unchanged', async () => {
  for (const content of ['{', JSON.stringify({ mcpServers: [] })]) {
    const { mcp, warnings } = await readProjectMcp(await fixture(content));
    assert.equal(mcp, null); assert.equal(warnings.length, 1);
    assert.deepEqual(command(claude, mcp, true), claude.command({}, session, '/work', base));
  }
});
test('invalid entries are disabled independently, including when all are invalid', async () => {
  for (const servers of [{ good: good.stdio, bad: { type: 'sse' } }, { bad: null, worse: { command: 'x', env: { A: 1 } } }]) {
    const { mcp, warnings } = await readProjectMcp(await fixture(JSON.stringify({ mcpServers: servers })));
    const result = command(claude, mcp, true).settings;
    const rejected = Object.keys(servers).filter(name => name !== 'good');
    assert.deepEqual(result.disabledMcpjsonServers, rejected); assert.equal(warnings.length, rejected.length);
    assert.match(warnings[0].text, /bad: skipped/);
    assert.equal(result.enableAllProjectMcpServers, servers.good ? true : undefined);
  }
});
test('non-regular and oversized files are rejected without opening', { timeout: 2000 }, async () => {
  for (const kind of ['directory', 'pipe', 'large']) {
    const dir = await fixture(); const file = path.join(dir, '.mcp.json');
    if (kind === 'directory') await fs.mkdir(file);
    if (kind === 'pipe') assert.equal(spawnSync('mkfifo', [file]).status, 0);
    if (kind === 'large') await fs.writeFile(file, 'x'.repeat(32769));
    const result = await readProjectMcp(dir); assert.equal(result.mcp, null); assert.equal(result.warnings.length, 1);
  }
});
test('service start logs warnings only for tool roles', async () => {
  const root = await makeTemp('project-mcp-service-'); const bin = path.join(root, 'bin'); await fs.mkdir(bin);
  for (const name of ['git', 'tmux', 'systemd-run']) await fs.writeFile(path.join(bin, name), `#!/bin/sh\nif [ x$1 = xload-buffer ]; then cat >/dev/null; fi\n${name === 'systemd-run' ? 'exit 1' : name === 'tmux' ? 'if [ "$1" = capture-pane ]; then printf "auto mode on\\n❯ Ready\\n"; fi' : 'echo deadbeef'}\n`, { mode: 0o755 });
  const prior = process.env.PATH; process.env.PATH = `${bin}:${prior}`;
  const instance = new MachineService({ win: noWsl, stateDir: path.join(root, 'state'), host: '127.0.0.1', port: 0 });
  const lines = []; const oldError = console.error; const oldPrepare = agy.prepare;
  agy.prepare = () => {}; console.error = (...args) => lines.push(args.join(' '));
  try {
    const run = async (role, cli, content, id) => {
      const worktree = await fixture(content);
      return instance.start({ role, cli, thread_id: id, token: id, worktree, name: `wc-${id}-${role}` });
    };
    await run('worker', 'claude', JSON.stringify({ mcpServers: { 'bad\nname': null } }), 'one');
    assert.deepEqual(lines.splice(0), ['wc-one-worker: project tools: "bad\\nname": skipped: not a valid stdio, http or sse entry']);
    await run('worker', 'agy', JSON.stringify({ mcpServers: good }), 'two');
    assert.deepEqual(lines.splice(0), []);
    await run('reviewer', 'agy', JSON.stringify({ mcpServers: good }), 'three');
    await run('reviewer', 'claude', '{', 'four'); assert.deepEqual(lines, []);
    const dir = await fixture(); await fs.mkdir(path.join(dir, '.mcp.json'));
    await instance.start({ role: 'worker', cli: 'claude', thread_id: 'five', token: 'five', worktree: dir, name: 'wc-five-worker' });
    assert.match(lines[0], /not a regular file/);
  } finally { agy.prepare = oldPrepare; console.error = oldError; process.env.PATH = prior; }
});
test('shared document and entry validators report the reader reasons', () => {
  const { checkDocumentText, entryReason } = require('../lib/project-mcp');
  assert.deepEqual(checkDocumentText('{'), { ok: false, reason: 'invalid JSON' });
  assert.deepEqual(checkDocumentText('{"mcpServers":[]}'), { ok: false, reason: 'mcpServers is not an object' });
  assert.deepEqual(checkDocumentText(' '.repeat(32769)), { ok: false, reason: 'larger than 32 KiB' });
  assert.equal(checkDocumentText('{"mcpServers":{}}').ok, true);
  assert.equal(entryReason('x', { command: 'run' }), null);
  assert.equal(entryReason('x', null), 'not a valid stdio, http or sse entry');
});

test('Claude adds folder entries alone and beside replacements only when tools are enabled', () => {
  const entry = { type: 'stdio', command: '/node', args: ['/bridge'], env: {} };
  const extras = [{ name: 'wheelchair-tools', folder: 'bridge', entry }];
  const invoke = context => claude.command({}, session, '/work', { ...base, ...context });
  const alone = invoke({ tools: true, extraServers: extras });
  assert.deepEqual(alone.mcpConfig.data.mcpServers, { 'wheelchair-tools': entry });
  assert.ok(alone.argv.includes('--mcp-config'));
  assert.deepEqual(alone.loaded.map(x => x.name), ['wheelchair-tools']);
  const mcp = { names: ['old'], servers: { old: { command: 'old' } } };
  const replacement = { command: 'new' };
  const both = invoke({ tools: true, mcp, replaceEntries: { old: replacement }, extraServers: extras });
  assert.deepEqual(both.mcpConfig.data.mcpServers, { old: replacement, 'wheelchair-tools': entry });
  assert.deepEqual(both.loaded.map(x => x.name), ['old', 'wheelchair-tools']);
  assert.deepEqual(invoke({ tools: false, mcp, extraServers: extras }), invoke({ tools: false, mcp }));
  assert.deepEqual(invoke({ tools: true, mcp, extraServers: [] }), invoke({ tools: true, mcp }));
});

test('Kimi and Pi warn only for folder servers when tools are enabled', async () => {
  const extraServers = [{ name: 'wheelchair-tools', folder: 'bridge', entry: {} }, { name: 'one', folder: 'server', entry: {} }, { name: 'two', folder: 'server', entry: {} }];
  const dir = await fixture();
  for (const [adapter, product] of [[require('../../connectors/kimi/machine'), 'Kimi Code'], [require('../../connectors/pi/machine'), 'Pi']]) {
    const ctx = { ...base, stateDir: dir, tools: true };
    const invoke = changes => adapter.command({}, session, '/work', { ...ctx, ...changes });
    assert.deepEqual(invoke({ extraServers }).warnings, [{ names: ['one', 'two'], text: `server tools don't work on ${product}: one, two` }]);
    assert.deepEqual(invoke({ extraServers: [extraServers[0]] }), invoke({}));
    assert.deepEqual(invoke({ extraServers: [] }), invoke({}));
    assert.deepEqual(invoke({ tools: false, extraServers }), invoke({ tools: false }));
  }
});
