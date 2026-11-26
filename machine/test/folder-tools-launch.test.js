'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { makeTemp } = require('../../test-support/run-dir');
const { MachineService } = require('../service');
const connectors = require('../../connectors');

test('launch discovers folder scripts, reports invalid tools and refreshes on relaunch', async () => {
  const root = await makeTemp('folder-launch-'), worktree = path.join(root, 'work'), state = path.join(root, 'state');
  const dir = path.join(worktree, '.wheelchair/tools/hello');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'tool.json'), JSON.stringify({ name: 'hello', description: 'hello', kind: 'script', inputs: {}, run: ['node', 'run.js'] }));
  const service = new MachineService({ stateDir: state, win: { procRoot: root, etcRoot: root, runRoot: root } });
  service.threadWorktree = () => true;
  const input = { role: 'worker', cli: 'codex', thread_id: 'test' };
  const session = { name: 'wc-test', role: 'worker', cli: 'codex', codex_mode: 'unrestricted', token: 'x', status: 'starting' };
  const prompt = path.join(root, 'prompt');
  const launch = resume => service.prepareLaunch(input, session, connectors.machine('codex'), worktree, prompt, 'prompt', resume);
  const first = await launch(false);
  assert.match(first.commandText, /wheelchair-tools/);
  assert.match(first.commandText, /tool_timeout_sec=260/);
  assert.deepEqual(session.shared_tools, { repo: null, copy: null });
  await fs.writeFile(path.join(dir, 'tool.json'), '{');
  await launch(true);
  assert.equal(session.project_tools.folder.length, 1);
  assert.match(session.project_tools.folder[0].text, /hello/);
  await fs.rm(dir, { recursive: true });
  await launch(true);
  assert.deepEqual(session.project_tools.folder, []);
});

test('sandbox, non-tool roles and server name precedence', async () => {
  const root = await makeTemp('folder-roles-'), worktree = path.join(root, 'work'), state = path.join(root, 'state');
  const dir = path.join(worktree, '.wheelchair/tools/hello'); await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'tool.json'), JSON.stringify({ name: 'hello', description: 'hello', kind: 'script', inputs: {}, run: ['node', 'run.js'] }));
  const service = new MachineService({ stateDir: state, win: { procRoot: root, etcRoot: root, runRoot: root } }); service.threadWorktree = () => true;
  const run = async (cli, role, mode = 'sandboxed') => {
    const input = { role, cli, thread_id: 'test' }, session = { name: `wc-${cli}-${role}`, role, cli, codex_mode: mode, token: 'x', status: 'starting' };
    const result = await service.prepareLaunch(input, session, connectors.machine(cli), worktree, path.join(root, `prompt-${cli}-${role}`), 'prompt', false);
    return { session, result, prompt: await fs.readFile(path.join(root, `prompt-${cli}-${role}`), 'utf8').catch(() => '') };
  };
  const sandbox = await run('codex', 'worker'); assert.doesNotMatch(sandbox.result.commandText, /mcp_servers\.project_wheelchair-tools/); assert.match(sandbox.prompt, /Folder tools:/); assert.match(JSON.stringify(sandbox.session.project_tools.clis.codex.lines), /folder tools run from the shell/);
  for (const cli of ['kimi', 'pi']) assert.match((await run(cli, 'worker')).prompt, /Folder tools:/);
  for (const role of ['reviewer', 'mapper']) { const item = await run('codex', role, 'unrestricted'); assert.doesNotMatch(item.result.commandText, /wheelchair-tools/); assert.equal(item.session.shared_tools, undefined); }
  await fs.writeFile(path.join(worktree, '.mcp.json'), JSON.stringify({mcpServers:{'wheelchair-tools':{command:'node'}}}));
  const collision = await run('codex', 'worker', 'unrestricted'); assert.match(JSON.stringify(collision.session.project_tools.folder), /hidden by the .mcp.json server/);
});

test('shared copies remain pinned while project tools are rediscovered', async () => {
  const { execFileSync } = require('node:child_process');
  const root = await makeTemp('folder-pin-'), bare = path.join(root, 'bare'), source = path.join(root, 'source'), worktree = path.join(root, 'work'), stateDir = path.join(root, 'state');
  const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  execFileSync('git', ['init', '--bare', '--initial-branch=main', bare], { stdio: 'ignore' }); execFileSync('git', ['clone', bare, source], { stdio: 'ignore' });
  git(source, 'config', 'user.email', 'test@example.com'); git(source, 'config', 'user.name', 'Test');
  const dir = path.join(source, '.wheelchair/tools/shared'); await fs.mkdir(dir, { recursive: true });
  const spec = description => JSON.stringify({ name: 'shared', description, kind: 'script', inputs: {}, run: ['node', 'run.js'] });
  await fs.writeFile(path.join(dir, 'tool.json'), spec('first')); git(source, 'add', '.'); git(source, 'commit', '-m', 'first'); git(source, 'push', 'origin', 'main');
  git(source, 'remote', 'set-url', 'origin', 'https://github.com/owner/tools.git'); git(source, 'config', `url.file://${bare}.insteadOf`, 'https://github.com/owner/tools.git');
  await fs.mkdir(worktree); const service = new MachineService({ stateDir, win: { procRoot: root, etcRoot: root, runRoot: root } }); service.threadWorktree = () => true;
  const start = async (session, input, resume) => service.prepareLaunch(input, session, connectors.machine('codex'), worktree, path.join(root, session.name), 'prompt', resume);
  const input = { role: 'worker', cli: 'codex', thread_id: 'test', shared_tools: { repo: 'owner/tools', candidates: [source] } };
  const session = { name: 'wc-first', role: 'worker', cli: 'codex', codex_mode: 'unrestricted', token: 'x', status: 'ready' };
  await start(session, input, false); const first = session.shared_tools.copy; assert.ok(first); service.sessions[session.name] = session;
  await fs.writeFile(path.join(dir, 'tool.json'), spec('second')); git(source, 'add', '.'); git(source, 'commit', '-m', 'second'); git(source, 'push', 'origin', 'main');
  const other = { ...session, name: 'wc-second' }; delete other.shared_tools;
  await start(other, input, false); assert.notEqual(other.shared_tools.copy, first); await fs.stat(first);
  await start(session, { ...input, shared_tools: undefined }, true); assert.equal(session.shared_tools.copy, first);
  assert.match(await fs.readFile(path.join(first, '.wheelchair/tools/shared/tool.json'), 'utf8'), /first/);
});

test('agent tools endpoint and wc tool list use the session pin', async () => {
  const http = require('node:http'); const { execFile } = require('node:child_process'); const { promisify } = require('node:util');
  const root = await makeTemp('folder-endpoint-'), worktree = path.join(root, 'work'), shared = path.join(root, 'copy'), dir = path.join(shared, '.wheelchair/tools/shared');
  await fs.mkdir(worktree); await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'tool.json'), JSON.stringify({ name: 'shared', description: 'Pinned', kind: 'script', inputs: {}, run: ['node', 'run.js'] }));
  const service = new MachineService({ stateDir: path.join(root, 'state'), win: { procRoot: root, etcRoot: root, runRoot: root } });
  service.sessions['wc-test'] = { name: 'wc-test', token: 'token', role: 'worker', worktree, shared_tools: { copy: shared } };
  const server = http.createServer((req, res) => service.handle(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(`${origin}/v1/agent/tools`, { method: 'POST', headers: { 'x-wheelchair-session-token': 'token' }, body: '{}' });
    assert.deepEqual(await response.json(), { worktree, shared_copy: shared });
    const result = await promisify(execFile)(process.execPath, [path.join(__dirname, '../../viewer/app/wc.js'), 'tool', 'list'], { env: { ...process.env, WHEELCHAIR_MACHINE_ORIGIN: origin, WHEELCHAIR_SESSION_TOKEN: 'token' } });
    assert.match(result.stdout, /shared/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
