'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { makeTemp } = require('../../test-support/run-dir');
const { readProjectMcp, TOOL_ROLES } = require('../lib/project-mcp');
const claude = require('../adapters/claude');
const agy = require('../adapters/agy');
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
    assert.match(warnings[0], /server "bad" skipped/);
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
  for (const name of ['git', 'tmux', 'systemd-run']) await fs.writeFile(path.join(bin, name), `#!/bin/sh\n${name === 'systemd-run' ? 'exit 1' : name === 'tmux' ? 'if [ "$1" = capture-pane ]; then printf "auto mode on\\n❯ Ready\\n"; fi' : 'echo deadbeef'}\n`, { mode: 0o755 });
  const prior = process.env.PATH; process.env.PATH = `${bin}:${prior}`;
  const instance = new MachineService({ stateDir: path.join(root, 'state'), host: '127.0.0.1', port: 0 });
  const lines = []; const oldError = console.error; const oldPrepare = agy.prepare;
  agy.prepare = () => {}; console.error = (...args) => lines.push(args.join(' '));
  try {
    const run = async (role, cli, content, id) => {
      const worktree = await fixture(content);
      return instance.start({ role, cli, thread_id: id, token: id, worktree, name: `wc-${id}-${role}` });
    };
    await run('worker', 'claude', JSON.stringify({ mcpServers: { 'bad\nname': null } }), 'one');
    assert.deepEqual(lines.splice(0), ['wc-one-worker: project tools: server "bad\\nname" skipped: not a valid stdio or http entry']);
    await run('worker', 'agy', JSON.stringify({ mcpServers: good }), 'two');
    assert.deepEqual(lines.splice(0), ["wc-two-worker: project tools: project tools aren't supported on Antigravity yet; this agent runs without them"]);
    await run('reviewer', 'agy', JSON.stringify({ mcpServers: good }), 'three');
    await run('reviewer', 'claude', '{', 'four'); assert.deepEqual(lines, []);
    const dir = await fixture(); await fs.mkdir(path.join(dir, '.mcp.json'));
    await instance.start({ role: 'worker', cli: 'claude', thread_id: 'five', token: 'five', worktree: dir, name: 'wc-five-worker' });
    assert.match(lines[0], /not a regular file/);
  } finally { agy.prepare = oldPrepare; console.error = oldError; process.env.PATH = prior; }
});
