'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile, execFileSync, spawn } = require('node:child_process');
const { once } = require('node:events');
const http = require('node:http');
const { createInterface } = require('node:readline');
const { promisify } = require('node:util');
const { makeTemp } = require('../../test-support/run-dir');
const { MachineService } = require('../service');
const shared = require('../lib/shared-tools');
const connectors = require('../../connectors');

const project = 'project';
const threadId = 'thread';
const origin = 'https://github.com/owner/tools.git';
const realGit = execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();
const git = (cwd, ...args) => execFileSync(realGit, ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000 }).trim();
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));

async function putTool(worktree, name, description, kind = 'script') {
  const dir = path.join(worktree, '.wheelchair', 'tools', name);
  await fs.mkdir(dir, { recursive: true });
  const body = kind === 'script' ? { inputs: {}, run: [process.execPath, 'tool.js'] } : { start: [process.execPath, 'tool.js'] };
  await fs.writeFile(path.join(dir, 'tool.json'), JSON.stringify({ name, description, kind, ...body }));
  return dir;
}

async function fixture(t) {
  const root = await makeTemp('folder-launch-');
  const bin = path.join(root, 'bin');
  const stateDir = path.join(root, 'state');
  const worktree = path.join(stateDir, 'worktrees', project, 'wc', threadId);
  const launchLog = path.join(root, 'launches');
  await fs.mkdir(bin);
  await fs.mkdir(worktree, { recursive: true });
  const shim = (program, body) => fs.writeFile(path.join(bin, program), '#!/bin/sh\n' + body, { mode: 0o755 });
  await shim('systemd-run', 'exit 1\n');
  await shim('tmux', `
case "$1" in
  new-session|respawn-pane)
    for argument do :; done
    printf '%s\\n' "$argument" >> '${launchLog}';;
  capture-pane)
    printf 'auto mode on\\n❯ Try anything\\nAsk Codex to do anything\\n? for shortcuts\\n';;
  load-buffer) cat >/dev/null;;
esac
`);
  for (const cli of ['claude', 'codex', 'agy', 'pi']) await shim(cli, 'exit 0\n');
  await shim('kimi', 'echo "kimi 2.6.3"\n');
  const oldPath = process.env.PATH;
  process.env.PATH = `${bin}:${oldPath}`;
  t.after(() => { process.env.PATH = oldPath; });
  const machine = new MachineService({ stateDir, win: { procRoot: root, etcRoot: root, runRoot: root } });
  const events = [];
  machine.emitEvent = async event => events.push(event);
  machine.versionGate = async () => ({ version: '1.0.0' });
  const promptPath = name => path.join(stateDir, 'prompts', `${name}.md`);
  let count = 0;
  async function start({ cli = 'codex', role = 'worker', mode = 'unrestricted', choice, accountDir = null, sessionWorktree = worktree } = {}) {
    const name = `wc-test-${++count}`;
    const input = { cli, role, project, project_dir: root, thread_id: threadId, token: name, ...(choice ? { shared_tools: choice } : {}) };
    const prompt = promptPath(name);
    await fs.mkdir(path.dirname(prompt), { recursive: true });
    await fs.writeFile(prompt, 'role prompt');
    return machine.startIn(input, name, connectors.machine(cli), { id: accountDir ? 'old-account' : 'default' }, accountDir,
      { codex_mode: mode, permission_mode: 'auto' }, false, { worktree: sessionWorktree }, prompt, 'role prompt');
  }
  const config = async session => {
    const file = session.command[session.command.indexOf('--mcp-config') + 1];
    assert.ok(session.command.includes('--mcp-config'));
    return (await readJson(file)).mcpServers;
  };
  const command = async () => (await fs.readFile(launchLog, 'utf8')).trimEnd().split('\n').at(-1);
  return { root, stateDir, worktree, machine, shim, start, command, events, promptPath, config };
}

async function sharedRepo(f, name = 'tools') {
  const bare = path.join(f.root, `bare-${name}`);
  const source = path.join(f.root, `source-${name}`);
  const repo = `owner/${name}`;
  const origin = `https://github.com/${repo}.git`;
  git(f.root, 'init', '--bare', '--initial-branch=main', bare);
  git(f.root, 'clone', bare, source);
  git(source, 'config', 'user.email', 'test@example.com');
  git(source, 'config', 'user.name', 'Test');
  git(source, 'remote', 'set-url', 'origin', origin);
  git(source, 'config', `url.file://${bare}.insteadOf`, origin);
  async function advance(description) {
    await putTool(source, 'shared', description);
    git(source, 'add', '.wheelchair');
    git(source, 'commit', '-m', description);
    git(source, 'push', 'origin', 'main');
    return git(source, 'rev-parse', 'HEAD');
  }
  const firstCommit = await advance('First shared description');
  return { source, bare, advance, firstCommit, choice: { repo, candidates: [source] } };
}

function assertEntry(entry, launcher, projectDir, ...toolDirs) {
  assert.equal(entry.command, process.execPath);
  assert.deepEqual(entry.args, [
    path.resolve(__dirname, '../lib', launcher), '--project-dir', projectDir,
    ...toolDirs.flatMap(dir => ['--tool', dir]),
  ]);
}

async function listedTools(entry, cwd) {
  const child = spawn(entry.command, entry.args, { cwd, stdio: ['pipe', 'pipe', 'inherit'] });
  const closed = once(child, 'close');
  const lines = createInterface({ input: child.stdout });
  const deadline = AbortSignal.timeout(4000);
  try {
    const response = once(lines, 'line', { signal: deadline });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) + '\n');
    const [line] = await response;
    return JSON.parse(line).result.tools.map(({ name, description }) => [name, description]);
  } finally {
    lines.close();
    child.stdin.end();
    child.kill();
    await closed;
  }
}

for (const cli of ['claude', 'codex', 'agy']) {
  test(`${cli} launches a script bridge and standalone server without .mcp.json`, async t => {
    const f = await fixture(t);
    const script = await putTool(f.worktree, 'script', 'Project script');
    const server = await putTool(f.worktree, 'server', 'Project server', 'server');
    const session = await f.start({ cli });
    const command = await f.command();
    if (cli === 'codex') {
      assert.match(command, /mcp_servers\.project_wheelchair-tools\.command=/);
      assert.match(command, /mcp_servers\.project_wheelchair-tools\.args=.*tool-bridge\.js/);
      assert.ok(command.includes(script));
      assert.match(command, /mcp_servers\.project_server\.args=.*tool-launch\.js/);
      assert.ok(command.includes(server));
      assert.match(command, /mcp_servers\.project_wheelchair-tools\.tool_timeout_sec=260/);
    } else {
      let entries;
      if (cli === 'claude') {
        const configPath = session.command[session.command.indexOf('--mcp-config') + 1];
        assert.match(command, /--mcp-config/);
        assert.ok(command.includes(configPath));
        entries = await f.config(session);
      } else {
        const pluginRoot = session.command[session.command.indexOf('--add-dir') + 1];
        assert.match(command, /--add-dir/);
        assert.ok(command.includes(pluginRoot));
        entries = (await readJson(path.join(pluginRoot, '.agents/plugins/wheelchair-project/mcp_config.json'))).mcpServers;
      }
      assert.deepEqual(Object.keys(entries), ['wheelchair-tools', 'server']);
      assertEntry(entries['wheelchair-tools'], 'tool-bridge.js', f.worktree, script);
      assertEntry(entries.server, 'tool-launch.js', f.worktree, server);
    }
    assert.deepEqual(session.project_tools.folder, []);
  });
}

test('all invalid folder tools are reported without .mcp.json and clear on a clean start', async t => {
  const f = await fixture(t);
  const malformed = await putTool(f.worktree, 'malformed', 'Broken JSON');
  const missing = await putTool(f.worktree, 'missing', 'Missing description file');
  await fs.writeFile(path.join(malformed, 'tool.json'), '{');
  await fs.unlink(path.join(missing, 'tool.json'));
  const bad = await f.start();
  assert.doesNotMatch(await f.command(), /mcp_servers\.project_/);
  assert.deepEqual(bad.project_tools.folder.map(line => line.names), [['malformed'], ['missing']]);
  assert.match(bad.project_tools.folder[0].text, /not JSON/i);
  assert.match(bad.project_tools.folder[1].text, /missing/);
  await putTool(f.worktree, 'malformed', 'Fixed JSON');
  await fs.rm(missing, { recursive: true });
  const clean = await f.start();
  assert.ok(clean.project_tools.seq > bad.project_tools.seq);
  assert.deepEqual(clean.project_tools.folder, []);
  assert.match(await f.command(), /mcp_servers\.project_wheelchair-tools/);
});

test('Codex keeps .mcp.json entries when folder entries exceed the launch budget', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.worktree, '.mcp.json'), JSON.stringify({
    mcpServers: { existing: { command: process.execPath, args: ["'".repeat(15800)] } },
  }));
  for (let i = 0; i < 20; i++) await putTool(f.worktree, `script-${i}`, 'Script');
  await putTool(f.worktree, 'standalone', 'Small server entry', 'server');
  const session = await f.start();
  const command = await f.command();
  assert.ok(command.includes('mcp_servers.project_existing.args='), 'existing server must fit by itself');
  assert.ok(command.includes('mcp_servers.project_standalone.command='), 'the smaller entry should still fit');
  assert.ok(!command.includes('mcp_servers.project_wheelchair-tools'), 'the bridge should exceed the remaining budget');
  assert.deepEqual(session.project_tools.clis.codex.lines.map(line => line.names), [['wheelchair-tools']]);
  assert.match(session.project_tools.clis.codex.lines[0].text, /over Codex's launch size limit/);
});

test('sandboxed Codex omits folder entries and warns only with a usable folder tool', async t => {
  const f = await fixture(t);
  const dir = await putTool(f.worktree, 'server', 'Project server', 'server');
  const unrestricted = await f.start();
  assert.match(await f.command(), /mcp_servers\.project_server\.command=/);
  assert.deepEqual(unrestricted.project_tools.clis.codex.lines, []);
  const sandbox = await f.start({ mode: 'sandboxed' });
  assert.doesNotMatch(await f.command(), /mcp_servers\.project_/);
  assert.deepEqual(sandbox.project_tools.clis.codex.lines, [{
    names: ['server'],
    text: 'folder tools run from the shell here (`wc.js tool run`); server tools need Codex set to unrestricted',
  }]);
  await fs.unlink(path.join(dir, 'tool.json'));
  const invalid = await f.start({ mode: 'sandboxed' });
  assert.equal(invalid.project_tools.folder.length, 1);
  assert.deepEqual(invalid.project_tools.clis.codex?.lines || [], []);
});

test('reviewers and mappers get no folder tools', async t => {
  const f = await fixture(t);
  await putTool(f.worktree, 'script', 'Project script');
  for (const role of ['reviewer', 'mapper']) {
    const session = await f.start({ role });
    assert.doesNotMatch(await f.command(), /mcp_servers\.project_/);
    assert.equal(session.shared_tools, undefined);
  }
});

test('.mcp.json entries win over a folder server and the script bridge', async t => {
  const f = await fixture(t);
  await putTool(f.worktree, 'script', 'Project script');
  await putTool(f.worktree, 'server', 'Project server', 'server');
  const names = ['wheelchair-tools', 'server'];
  await fs.writeFile(path.join(f.worktree, '.mcp.json'), JSON.stringify({
    mcpServers: Object.fromEntries(names.map(name => [name, { command: process.execPath, args: ['original.js'] }])),
  }));
  const session = await f.start();
  const command = await f.command();
  for (const name of names) assert.ok(command.includes(`mcp_servers.project_${name}.args=["original.js"]`));
  assert.doesNotMatch(command, /tool-(bridge|launch)\.js/);
  assert.deepEqual(session.project_tools.folder, names.map(name => ({
    names: [name], text: `tool ${name}: hidden by the .mcp.json server of the same name`,
  })));
});

test('shell instructions require a usable script on Kimi, Pi or sandboxed Codex and are not rewritten on resume', async t => {
  const f = await fixture(t);
  await putTool(f.worktree, 'server', 'Project server', 'server');
  const unusable = await putTool(f.worktree, 'script', 'Project script');
  const descriptionFile = path.join(unusable, 'tool.json');
  const tool = await readJson(descriptionFile);
  await fs.writeFile(descriptionFile, JSON.stringify({ ...tool, run: ['./missing-program'] }));
  const fallback = [{ cli: 'kimi' }, { cli: 'pi' }, { cli: 'codex', mode: 'sandboxed' }];
  const line = `Folder tools: this session can't call them through MCP. Run \`node ${path.resolve(__dirname, '../..')}/viewer/app/wc.js tool list\` to see them and \`node ${path.resolve(__dirname, '../..')}/viewer/app/wc.js tool run <name> --input '<json>'\` to run a script tool; give that shell command a timeout longer than the tool's timeout_seconds (default 120 s).`;
  for (const options of fallback) {
    const session = await f.start(options);
    assert.match(await fs.readFile(f.promptPath(session.name), 'utf8'), /Folder tools:/);
  }
  await putTool(f.worktree, 'script', 'Project script');
  for (const options of fallback) {
    const session = await f.start(options);
    const prompt = f.promptPath(session.name);
    assert.equal(await fs.readFile(prompt, 'utf8'), `role prompt\n\n${line}${options.cli !== 'codex' ? ' `wc.js tool run` runs tools that need keys on the machine with their keys; their key values never appear in the result.' : ''}`);
    // Give the prompt a known mtime so even a rewrite with identical content is observable.
    await fs.utimes(prompt, 100, 100);
    await f.machine.prepareLaunch(session, session, connectors.machine(session.cli), f.worktree, prompt, 'role prompt', true);
    assert.equal((await fs.stat(prompt)).mtimeMs, 100000);
    assert.equal(session.pending_initial, '');
  }
  for (const cli of ['codex', 'claude']) {
    const session = await f.start({ cli });
    assert.doesNotMatch(await fs.readFile(f.promptPath(session.name), 'utf8'), /Folder tools:/);
  }
});

test('resume and account switch reuse the saved commit and offer edited project tools', async t => {
  const f = await fixture(t);
  const remote = await sharedRepo(f);
  const localTool = await putTool(f.worktree, 'local', 'Original project description');
  const oldAccount = path.join(f.root, 'old-account');
  const newAccount = path.join(f.root, 'new-account');
  const oldHome = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = newAccount;
  t.after(() => {
    if (oldHome === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = oldHome;
  });
  const session = await f.start({ cli: 'claude', choice: remote.choice, accountDir: oldAccount });
  const pin = session.shared_tools;
  assert.equal(path.basename(pin.copy), remote.firstCommit);
  const sharedTool = path.join(pin.copy, '.wheelchair/tools/shared');
  async function descriptions(projectDescription) {
    const bridge = (await f.config(session))['wheelchair-tools'];
    assertEntry(bridge, 'tool-bridge.js', f.worktree, localTool, sharedTool);
    assert.deepEqual(await listedTools(bridge, f.worktree), [
      ['local', projectDescription], ['shared', 'First shared description'],
    ]);
    assert.deepEqual(session.shared_tools, pin);
  }
  await descriptions('Original project description');

  const nextCommit = await remote.advance('New shared description');
  const newer = await f.start({ choice: remote.choice });
  assert.equal(path.basename(newer.shared_tools.copy), nextCommit);
  assert.ok((await fs.stat(pin.copy)).isDirectory());
  const replacement = await sharedRepo(f, 'replacement');
  const changed = await f.start({ choice: replacement.choice });
  assert.equal(changed.shared_tools.repo, replacement.choice.repo);
  assert.equal(path.basename(changed.shared_tools.copy), replacement.firstCommit);
  assert.notEqual(changed.shared_tools.copy, pin.copy);
  const cleared = await f.start();
  assert.deepEqual(cleared.shared_tools, { repo: null, copy: null });

  await putTool(f.worktree, 'local', 'Edited on resume');
  const savedSessions = await readJson(f.machine.sessionsPath);
  const recovered = savedSessions[session.name];
  const launchInput = { cli: 'claude', role: 'worker', project, thread_id: threadId };
  const prompt = f.promptPath(session.name);
  await f.machine.prepareLaunch(launchInput, recovered, connectors.machine('claude'), f.worktree, prompt, 'role prompt', true);
  const resumedBridge = (await f.config(recovered))['wheelchair-tools'];
  assertEntry(resumedBridge, 'tool-bridge.js', f.worktree, localTool, sharedTool);
  assert.deepEqual(await listedTools(resumedBridge, f.worktree), [
    ['local', 'Edited on resume'], ['shared', 'First shared description'],
  ]);

  await putTool(f.worktree, 'local', 'Edited before switch');
  const broken = await putTool(f.worktree, 'broken', 'Becomes invalid during the switch');
  await fs.writeFile(path.join(broken, 'tool.json'), '{');
  const transcript = path.join(oldAccount, 'projects', 'test', `${session.cli_session_id}.jsonl`);
  await fs.mkdir(path.dirname(transcript), { recursive: true });
  await fs.writeFile(transcript, '{"type":"user"}\n');
  const snapshot = structuredClone(session);
  session.status = 'switching';
  session.switches = { next: { state: 'running' } };
  await f.machine.runSwitch(session, snapshot, {
    ...launchInput, switch_id: 'next', account: { id: 'default-claude' }, model: null, project_dir: f.root,
    shared_tools: replacement.choice,
  }, null);
  assert.equal(session.status, 'starting', JSON.stringify(f.events));
  assert.match(await f.command(), /--resume/);
  assert.ok(await f.machine.checkReady(session));
  assert.equal(session.switches.next.state, 'done');
  const ready = f.events.at(-1);
  assert.equal(ready.type, 'ready');
  assert.equal(ready.switch_id, 'next');
  assert.equal(ready.created_at, snapshot.created_at);
  assert.deepEqual(ready.project_tools, session.project_tools);
  assert.ok(ready.project_tools.seq > snapshot.project_tools.seq);
  assert.deepEqual(ready.project_tools.folder.map(line => line.names), [['broken']]);
  await descriptions('Edited before switch');
});

test('copy cleanup preserves live, recovered and starting pins and drops ended records', async t => {
  const f = await fixture(t);
  const remote = await sharedRepo(f);
  const live = await f.start({ choice: remote.choice });
  const parent = path.dirname(live.shared_tools.copy);
  const records = [
    { status: 'ready', recovered: true },
    { status: 'switching' },
    { status: 'starting', inProgress: true },
    { status: 'ended', ended: true },
    { status: 'stopped', ended: true },
    { status: 'failed', ended: true },
    { status: 'ready', ended_at: new Date().toISOString(), ended: true },
  ];
  for (const [i, record] of records.entries()) {
    const name = `wc-record-${i}`;
    const copy = path.join(parent, String(i).repeat(40));
    await fs.mkdir(copy);
    Object.assign(record, { name, shared_tools: { copy } });
    if (record.inProgress) f.machine.startingToolPins.add(record);
    else f.machine.sessions[name] = record;
  }
  const newestCommit = await remote.advance('Newest shared description');
  const next = await f.start({ choice: remote.choice });
  assert.equal(path.basename(next.shared_tools.copy), newestCommit);
  assert.ok((await fs.stat(live.shared_tools.copy)).isDirectory());
  for (const record of records) {
    const copy = record.shared_tools.copy;
    if (record.ended) await assert.rejects(fs.stat(copy), { code: 'ENOENT' }, record.name);
    else assert.ok((await fs.stat(copy)).isDirectory(), record.name);
  }
});

test("the shared project's own thread skips the shared copy and uses its worktree", async t => {
  const f = await fixture(t);
  const remote = await sharedRepo(f);
  const other = await f.start({ choice: remote.choice });
  assert.ok(other.shared_tools.copy);
  git(f.worktree, 'init');
  git(f.worktree, 'remote', 'add', 'origin', origin);
  git(f.worktree, 'config', `url.file://${remote.bare}.insteadOf`, origin);
  const own = await putTool(f.worktree, 'draft', 'Unmerged tool');
  const session = await f.start({ cli: 'claude', choice: { ...remote.choice, repo: 'Owner/Tools' } });
  assert.deepEqual(session.shared_tools, { repo: 'Owner/Tools', copy: null, own: true });
  assertEntry((await f.config(session))['wheelchair-tools'], 'tool-bridge.js', f.worktree, own);
  assert.deepEqual(session.project_tools.folder, []);
});

test('a project tool hides a shared tool with the same name', async t => {
  const f = await fixture(t);
  const remote = await sharedRepo(f);
  const local = await putTool(f.worktree, 'shared', 'Project description');
  const session = await f.start({ cli: 'claude', choice: remote.choice });
  assert.ok(session.shared_tools.copy);
  const bridge = (await f.config(session))['wheelchair-tools'];
  assertEntry(bridge, 'tool-bridge.js', f.worktree, local);
  assert.deepEqual(await listedTools(bridge, f.worktree), [['shared', 'Project description']]);
  assert.deepEqual(session.project_tools.folder.map(line => line.names), [['shared']]);
  assert.match(session.project_tools.folder[0].text, /hidden/);
});

test('Codex orders shared and project servers by name after the bridge', async t => {
  const f = await fixture(t);
  const remote = await sharedRepo(f);
  await putTool(remote.source, 'alpha', 'Shared server', 'server');
  git(remote.source, 'add', '.wheelchair');
  git(remote.source, 'commit', '-m', 'Add shared server');
  git(remote.source, 'push', 'origin', 'main');
  await putTool(f.worktree, 'zeta', 'Project server', 'server');
  await f.start({ choice: remote.choice });
  const command = await f.command();
  const names = [...command.matchAll(/mcp_servers\.project_([^.]+)\.command=/g)].map(match => match[1]);
  assert.deepEqual(names, ['wheelchair-tools', 'alpha', 'zeta']);
});

for (const step of ['ls-remote', 'fetch']) {
  test(`the shared refresh deadline kills a stalled git ${step} and launch completes`, { timeout: 7000 }, async t => {
    const f = await fixture(t);
    const remote = await sharedRepo(f);
    const pidFile = path.join(f.root, 'git-pid');
    await f.shim('git', `
case " $* " in
  *" ${step} "*) echo "$$" > '${pidFile}'; exec sleep 5;;
  ${step === 'fetch' ? '*" ls-remote "*) sleep 1;;' : ''}
esac
exec '${realGit}' "$@"
`);
    f.machine.sharedToolsDeadlineMs = 2000;
    const before = Date.now();
    const session = await f.start({ choice: remote.choice });
    assert.ok(Date.now() - before < 3100, 'launch exceeded the single shared refresh deadline');
    assert.equal(session.status, 'ready');
    assert.equal(session.shared_tools.copy, null);
    assert.deepEqual(session.project_tools.folder, [{
      names: [], text: `shared tools couldn't be fetched: git ${step} timed out after 2 s`,
    }]);
    const pid = Number(await fs.readFile(pidFile, 'utf8'));
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  });
}

test('a partial copy never publishes and launch uses the newest complete copy if present', async t => {
  const f = await fixture(t);
  const remote = await sharedRepo(f);
  const identity = await shared.identityFor(remote.source);
  const badTar = 'printf partial > "$3/partial"\necho fixture-extraction-failed >&2\nexit 1\n';
  await f.shim('tar', badTar);
  const none = await f.start({ choice: remote.choice });
  assert.equal(none.status, 'ready');
  assert.equal(none.shared_tools.copy, null);
  assert.match(none.project_tools.folder[0].text, /tar failed: fixture-extraction-failed/);
  assert.equal(shared.newestCopy(f.stateDir, identity), null);

  await fs.unlink(path.join(f.root, 'bin', 'tar'));
  const good = await f.start({ choice: remote.choice });
  const pin = good.shared_tools.copy;
  assert.equal(path.basename(pin), remote.firstCommit);
  const next = await remote.advance('New description');
  await f.shim('tar', badTar);
  const fallback = await f.start({ choice: remote.choice });
  assert.equal(fallback.status, 'ready');
  assert.equal(fallback.shared_tools.copy, pin);
  assert.deepEqual(fallback.project_tools.folder, []);
  assert.ok((await f.command()).includes(pin));
  assert.equal(shared.newestCopy(f.stateDir, identity), pin);
  const observed = await fs.readdir(path.dirname(pin));
  assert.ok(!observed.includes(next) && !observed.some(name => name.startsWith('.tmp-')));
  assert.match(shared.lastRefresh(f.stateDir, identity).error, /fixture-extraction-failed/);
});

test('two concurrent starts share one refresh and a later refresh advances the pointer', async t => {
  const f = await fixture(t);
  const remote = await sharedRepo(f);
  const identity = await shared.identityFor(remote.source);
  const fetchLog = path.join(f.root, 'fetches');
  await f.shim('git', `
case " $* " in
  *" fetch "*) echo fetch >> '${fetchLog}'; sleep 1;;
esac
exec '${realGit}' "$@"
`);
  const [first, second] = await Promise.all([f.start({ choice: remote.choice }), f.start({ choice: remote.choice })]);
  assert.equal(await fs.readFile(fetchLog, 'utf8'), 'fetch\n');
  assert.equal(path.basename(first.shared_tools.copy), remote.firstCommit);
  assert.equal(second.shared_tools.copy, first.shared_tools.copy);
  assert.equal(shared.newestCopy(f.stateDir, identity), first.shared_tools.copy);

  const laterCommit = await remote.advance('Later shared description');
  const later = await f.start({ choice: remote.choice });
  assert.equal(await fs.readFile(fetchLog, 'utf8'), 'fetch\nfetch\n');
  assert.equal(path.basename(later.shared_tools.copy), laterCommit);
  assert.equal(shared.newestCopy(f.stateDir, identity), later.shared_tools.copy);
});
test('agent tools endpoint and wc tool list use the session pin', async t => {
  const f = await fixture(t);
  const remote = await sharedRepo(f);
  const session = await f.start({ choice: remote.choice });
  const server = http.createServer((req, res) => f.machine.handle(req, res));
  const listening = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await listening;
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const request = token => fetch(`${origin}/v1/agent/tools`, {
      method: 'POST', headers: { 'x-wheelchair-session-token': token }, body: '{}', signal: AbortSignal.timeout(4000),
    });
    const denied = await request('invalid');
    assert.equal(denied.status, 401);
    const response = await request(session.token);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { worktree: f.worktree, shared_copy: session.shared_tools.copy, keyed_unavailable: null, keyed_run: 'local' });
    const result = await promisify(execFile)(process.execPath, [path.join(__dirname, '../../viewer/app/wc.js'), 'tool', 'list'], {
      env: { ...process.env, WHEELCHAIR_MACHINE_ORIGIN: origin, WHEELCHAIR_SESSION_TOKEN: session.token },
      timeout: 5000,
    });
    assert.match(result.stdout, /shared/);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('shell-only sessions report keyed tools and include the starting clause', async t => {
  const f = await fixture(t); git(f.worktree, 'init');
  for (const name of ['first', 'second']) { const dir = await putTool(f.worktree, name, name); const file = path.join(dir, 'tool.json'); await fs.writeFile(file, JSON.stringify({ ...(await readJson(file)), keys: ['TOKEN'] })); }
  for (const options of [{cli:'kimi'}, {cli:'pi'}, {cli:'codex',mode:'sandboxed'}]) {
    const session = await f.start(options), lines = session.project_tools.keyed[session.name];
    assert.equal(lines.length, 2); assert.doesNotMatch(await f.command(), /tool-bridge\.js/);
    const prompt = await fs.readFile(f.promptPath(session.name), 'utf8');
    if (options.cli === 'codex') {
      assert.deepEqual(lines.map(line => line.text), ['first','second'].map(name => `tool ${name} needs keys, which ${connectors.machine(session.cli).keyedToolsReason(session)}`));
      assert.match(prompt, /Tools that need keys aren't available/);
    } else {
      assert.deepEqual(lines.map(line => line.text), ['first','second'].map(name => `tool ${name} needs key TOKEN, not set on this machine when this session started; set it and run again`));
      assert.match(prompt, /runs tools that need keys on the machine/); assert.doesNotMatch(prompt, /Tools that need keys aren't available/);
    }
  }
});

async function keyedTool(worktree, name, keys=['TOKEN'], kind='script') {
  const dir=await putTool(worktree,name,name,kind), file=path.join(dir,'tool.json');
  await fs.writeFile(file,JSON.stringify({...await readJson(file),keys})); return dir;
}

test('keyed discovery omits missing keys and keeps secrets out of launch artifacts', async t => {
  const {projectIdentity,writeKeyStore}=require('../lib/project-keys'); const f=await fixture(t); git(f.worktree,'init');
  const dir=await keyedTool(f.worktree,'secret');
  const missing=await f.start({cli:'claude'}); assert.ok(!missing.command.includes('--mcp-config')); assert.equal(missing.project_tools.folder[0].text,'tool secret needs key TOKEN, not set on this machine');
  const value='sentinelvalue123'; await writeKeyStore(f.stateDir,await projectIdentity(f.worktree),{set:{TOKEN:value}});
  for(const cli of ['claude','codex']) {
    const session=await f.start({cli}); const artifacts=[await f.command(),JSON.stringify(session.command),await fs.readFile(f.promptPath(session.name),'utf8')];
    if(cli==='claude') { const config=await f.config(session); assert.ok(config['wheelchair-tools'].args.includes(dir)); artifacts.push(JSON.stringify(config)); }
    else assert.match(artifacts[0],/tool-bridge/);
    for(const artifact of artifacts) assert.ok(!artifact.includes(value));
  }
});

test('shared project uses shared store and missing shared tool identifies its source', async t => {
  const {writeSharedKeys}=require('../lib/shared-keys'); const f=await fixture(t); const remote=await sharedRepo(f);
  await keyedTool(remote.source,'shared'); await keyedTool(remote.source,'shared-server',['TOKEN'],'server'); git(remote.source,'add','.wheelchair'); git(remote.source,'commit','-m','keyed'); git(remote.source,'push','origin','main');
  const missing=await f.start({cli:'claude',choice:remote.choice}); assert.equal(missing.project_tools.folder.find(line=>line.names?.includes('shared'))?.text,'shared tool shared needs key TOKEN, not set on this machine'); assert.equal(missing.project_tools.folder.find(line=>line.names?.includes('shared-server'))?.text,'shared tool shared-server needs key TOKEN, not set on this machine'); assert.ok(!missing.command.includes('--mcp-config'));
  git(f.worktree,'init'); git(f.worktree,'remote','add','origin',origin); git(f.worktree,'config',`url.file://${remote.bare}.insteadOf`,origin);
  const dir=await keyedTool(f.worktree,'own'); await writeSharedKeys(f.stateDir,{set:{TOKEN:'sharedvalue'}});
  const own=await f.start({cli:'claude',choice:remote.choice}); assert.equal(own.shared_tools.own,true);
  const args=(await f.config(own))['wheelchair-tools'].args; assert.ok(args.includes(dir)); assert.equal(args[args.indexOf('--key-store')+1],'shared');
});

test('keyed server discovery checks keys and keeps values out of entries', async t => {
  const {projectIdentity,writeKeyStore}=require('../lib/project-keys'); const f=await fixture(t); git(f.worktree,'init');
  await keyedTool(f.worktree,'bad',['TOKEN'],'server'); await putTool(f.worktree,'good','good','server');
  const missing=await f.start({cli:'claude'}), entries=await f.config(missing);
  assert.equal(entries.bad,undefined); assert.ok(entries.good); assert.equal(missing.project_tools.folder[0].text,'tool bad needs key TOKEN, not set on this machine');
  const value='sentinelservervalue'; await writeKeyStore(f.stateDir,await projectIdentity(f.worktree),{set:{TOKEN:value}});
  const present=await f.start({cli:'claude'}), entry=(await f.config(present)).bad;
  assert.ok(entry.args.includes('--state-dir')); assert.ok(entry.args.includes(f.stateDir)); assert.ok(entry.args.includes('--key-store')); assert.ok(entry.args.includes('project')); assert.ok(entry.args.includes('--key')); assert.ok(entry.args.includes('TOKEN')); assert.ok(!JSON.stringify(entry).includes(value));
  for (const options of [{cli:'kimi'},{cli:'pi'},{mode:'sandboxed'}]) { const session=await f.start(options); assert.ok(!session.project_tools.folder.some(line=>line.text.includes('needs key TOKEN'))); }
  const files=await fs.readdir(path.join(f.stateDir,'project-keys')); await fs.writeFile(path.join(f.stateDir,'project-keys',files[0]),'{');
  const unreadable=await f.start({cli:'claude'}); assert.equal(unreadable.project_tools.folder.find(line=>line.names?.includes('bad'))?.text,"the key store on this machine can't be read");
});

test('agent routes report key status and sandbox restriction without values', async t => {
  const {projectIdentity,writeKeyStore}=require('../lib/project-keys'); const f=await fixture(t); git(f.worktree,'init');
  await keyedTool(f.worktree,'secret',['SET','MISSING','BAD']); await keyedTool(f.worktree,'srv',['SET'],'server'); await writeKeyStore(f.stateDir,await projectIdentity(f.worktree),{set:{SET:'sentinelvalue',BAD:'short'}});
  const unrestricted=await f.start(), sandbox=await f.start({mode:'sandboxed'}), eligible=await f.start({cli:'kimi'}); const server=http.createServer((req,res)=>f.machine.handle(req,res)); server.listen(0,'127.0.0.1'); await once(server,'listening');
  try {
    const request=async (session,route)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/v1/agent/${route}`,{method:'POST',headers:{'x-wheelchair-session-token':session.token},body:'{}',signal:AbortSignal.timeout(4000)}); assert.equal(response.status,200); return response.json();};
    assert.equal((await request(eligible,'tools')).keyed_run,'machine'); assert.equal((await request(unrestricted,'tools')).keyed_run,'local'); assert.equal((await request(unrestricted,'tools')).keyed_unavailable,null); assert.equal((await request(sandbox,'tools')).keyed_unavailable,connectors.machine('codex').keyedToolsReason(sandbox));
    const result=await request(unrestricted,'tool-keys'); assert.ok(!JSON.stringify(result).includes('sentinelvalue')); assert.deepEqual(result.tools.find(row=>row.name==='secret').keys,[{name:'SET',set:true,reason:null},{name:'MISSING',set:false,reason:'not set on this machine'},{name:'BAD',set:false,reason:'value too short (under 8 characters)'}]); assert.deepEqual(result.tools.find(row=>row.name==='srv').keys,[{name:'SET',set:true,reason:null}]);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});

test('shell-only keyed lines survive other sessions and disappear after end', async t => {
  const f=await fixture(t); git(f.worktree,'init'); await keyedTool(f.worktree,'first'); await keyedTool(f.worktree,'second');
  const a=await f.start({cli:'kimi'}), b=await f.start({cli:'pi'});
  assert.equal(b.project_tools.keyed[a.name].length,2); assert.equal(b.project_tools.keyed[b.name].length,2);
  f.machine.sessions[a.name].status='ended'; const c=await f.start({mode:'sandboxed'});
  assert.equal(c.project_tools.keyed[a.name],undefined); assert.equal(c.project_tools.keyed[b.name].length,2);
});

test('starting prompt excludes keyed clause for keyless or hidden shared scripts', async t => {
  const f=await fixture(t); await putTool(f.worktree,'shared','local'); const remote=await sharedRepo(f);
  await keyedTool(remote.source,'shared'); git(remote.source,'add','.wheelchair'); git(remote.source,'commit','-m','keyed'); git(remote.source,'push','origin','main');
  for(const options of [{cli:'kimi'},{mode:'sandboxed'}]) {
    const plain=await f.start(options); assert.doesNotMatch(await fs.readFile(f.promptPath(plain.name),'utf8'),/Tools that need keys/);
    const hidden=await f.start({...options,choice:remote.choice}); assert.doesNotMatch(await fs.readFile(f.promptPath(hidden.name),'utf8'),/Tools that need keys/); assert.deepEqual(hidden.project_tools.keyed[hidden.name],[]);
  }
});


test('worker on its own worktree reports its missing project and shared keys', async t => {
  const f = await fixture(t); git(f.worktree, 'init');
  git(f.worktree, 'config', 'user.email', 'test@example.com'); git(f.worktree, 'config', 'user.name', 'Test');
  git(f.worktree, 'commit', '--allow-empty', '-m', 'base');
  const workerWorktree = path.join(f.root, 'worker-worktree'); git(f.worktree, 'worktree', 'add', '--detach', workerWorktree);
  await keyedTool(workerWorktree, 'own');
  const remote = await sharedRepo(f); await keyedTool(remote.source, 'shared');
  git(remote.source, 'add', '.wheelchair'); git(remote.source, 'commit', '-m', 'keyed shared'); git(remote.source, 'push', 'origin', 'main');
  const session = await f.start({ cli: 'kimi', choice: remote.choice, sessionWorktree: workerWorktree });
  assert.deepEqual(session.project_tools.keyed[session.name].map(line => line.text), [
    'tool own needs key TOKEN, not set on this machine when this session started; set it and run again',
    'shared tool shared needs key TOKEN, not set on this machine when this session started; set it and run again',
  ]);
});
