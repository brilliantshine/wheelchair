'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempSync } = require('../../test-support/run-dir');
const { createProjectTools } = require('../lib/project-tools');

test('project checks name Codex-only skip and command-line budget warnings', async () => {
  const root = makeTempSync('char-project-tools-'); fs.mkdirSync(path.join(root, '.git'));
  let document = { mcpServers: { stream: { type: 'sse', url: 'https://example.test' }, normal: { command: 'go' } } };
  const run = async (program, args) => {
    let stdout = '';
    if (program === 'gh') stdout = '[]';
    else if (args.includes('rev-parse')) stdout = '.git';
    else if (args.includes('--get-all') && args.includes('remote.origin.url')) stdout = 'https://github.com/owner/repo.git';
    else if (args.includes('remote.origin.pushurl')) return { ok: false, status: 1 };
    else if (args.includes('ls-remote')) stdout = 'ref: refs/heads/main\tHEAD\n';
    else if (args.includes('ls-tree')) stdout = '100644 blob abc123\t.mcp.json\n';
    else if (args.includes('cat-file')) stdout = JSON.stringify(document);
    return { ok: true, status: 0, stdout, stderr: '' };
  };
  const project = createProjectTools({ commandAsync: run, stateDir: path.join(root, 'state') });
  let body = (await project.read({ path: root })).body;
  assert.equal(body.mode, 'tools');
  assert.deepEqual(body.checks.stream.skip, ['on Codex: uses sse, which Codex does not support']);
  assert.deepEqual(body.checks.normal.skip, []); assert.deepEqual(body.file_warnings, []);
  document = { mcpServers: { large: { command: 'go', args: ["'".repeat(20000)] } } };
  body = (await project.read({ path: root })).body;
  assert.deepEqual(body.checks.large.skip, []);
  assert.deepEqual(body.file_warnings, ['project tools skipped on Codex: .mcp.json is too large to pass on the command line']);
});

test('project tool launch warnings are specific to each CLI', async () => {
  const http = require('node:http');
  const { MachineService } = require('../service');
  const root = makeTempSync('char-project-launch-'), bin = path.join(root, 'bin'); fs.mkdirSync(bin);
  for (const name of ['tmux', 'systemd-run']) fs.writeFileSync(path.join(bin, name), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const oldPath = process.env.PATH; process.env.PATH = `${bin}:${oldPath}`;
  const service = new MachineService({ stateDir: path.join(root, 'state'), win: { procRoot: root, etcRoot: root, runRoot: root } });
  service.config = { host: '127.0.0.1', port: 0 }; service.authorize = async () => {};
  service.checkVersion = async () => {};
  service.cliStatus = () => ({ installed: true, version: '2.0.0', problem: null });
  service.launchPath = async () => ({ executable: 'kimi' }); service.checkReady = async () => {};
  const messages = [], oldError = console.error; console.error = (...args) => messages.push(args.join(' '));
  const server = http.createServer((req, res) => service.handle(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    for (const [kind, entry] of [['stream', { type: 'sse', url: 'https://example.test' }], ['large', { command: 'go', args: ["'".repeat(20000)] }]]) {
      for (const cli of ['claude', 'codex', 'agy', 'kimi', 'pi']) {
        const id = `${kind}${cli}`, worktree = path.join(root, id); fs.mkdirSync(worktree);
        fs.writeFileSync(path.join(worktree, '.mcp.json'), JSON.stringify({ mcpServers: { [kind]: entry } }));
        messages.length = 0;
        const res = await fetch(`http://127.0.0.1:${server.address().port}/v1/sessions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role: 'worker', cli, thread_id: id, token: id, worktree, name: `wc-${id}-worker` }) });
        const body = await res.json(); assert.equal(res.status, 201, JSON.stringify(body));
        const codexMessages = messages.filter(line => line.includes('skipped on Codex:'));
        if (cli === 'codex') {
          const reason = kind === 'stream' ? 'uses sse, which Codex does not support' : '.mcp.json is too large to pass on the command line';
          assert.deepEqual(codexMessages, [`wc-${id}-worker: project tools: ${kind}: skipped on Codex: ${reason}`]);
          assert.deepEqual(body.project_tools.clis.codex.lines, [{ names: [kind], text: `${kind}: skipped on Codex: ${reason}` }]);
        } else assert.deepEqual(codexMessages, [], cli);
      }
    }
  } finally { console.error = oldError; process.env.PATH = oldPath; await new Promise(resolve => server.close(resolve)); }
});
