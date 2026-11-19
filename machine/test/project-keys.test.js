'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { makeTemp } = require('../../test-support/run-dir');
const { keyReferences, isReserved, projectIdentity, readKeyStore, writeKeyStore, launchKeys } = require('../lib/project-keys');
const { commandAsync } = require('../service');
test('references, reservations and held-back names', () => {
  const servers = { a: { command: 'run', args: ['${A:-x}'], env: { A: '${A}', X: 'x${X}', HOME: '${HOME}', B: '${B}', TOKEN: '${TOKEN}' } }, b: { type: 'http', url: 'https://x/${B}', headers: { Authorization: 'Bearer ${TOKEN}' } }, malformed: { command: '${TOKEN}' } };
  const { references, heldBack } = keyReferences(servers);
  assert.deepEqual({ ...references }, { A: ['a'], B: ['a'], TOKEN: ['a', 'b'] });
  assert.deepEqual({ ...heldBack }, { A: [{ tool: 'a', field: 'args' }], B: [{ tool: 'b', field: 'url' }], TOKEN: [{ tool: 'malformed', field: 'command' }] });
  for (const name of ['HOME', 'OPENAI_API_KEY', 'LD_PRELOAD', 'WHEELCHAIR_X', 'CLAUDE_CONFIG_DIR', 'path', 'OPTIND', 'ifs', 'MAILPATH']) assert.equal(isReserved(name), true, name);
  assert.equal(isReserved('MAILBOX'), false);
  assert.deepEqual({ ...launchKeys(servers, { keys: { A: 'a', B: 'b', TOKEN: 't' } }).env }, {});
});
test('key store is private, revisioned and cleans failed temporary writes', async () => {
  const dir = await makeTemp('keys-'); const identity = '/project';
  assert.equal((await readKeyStore(dir, identity)).revision, 0);
  assert.equal((await writeKeyStore(dir, identity, { set: { X: 'secret' }, remove: [] })).revision, 1);
  assert.equal((await writeKeyStore(dir, identity, { set: {}, remove: ['X'] })).revision, 2);
  const folder = path.join(dir, 'project-keys'); const [file] = await fs.readdir(folder);
  assert.equal((await fs.stat(path.join(folder, file))).mode & 0o777, 0o600);
  assert.equal((await fs.stat(folder)).mode & 0o777, 0o700);
  const rename = fs.rename; fs.rename = async () => { throw new Error('rename failed'); };
  try { await assert.rejects(writeKeyStore(dir, identity, { set: { X: 'secret' } }), /can't be written/); } finally { fs.rename = rename; }
  assert.deepEqual(await fs.readdir(folder), [file]);
});
test('identity is shared by alias and git worktree', async () => {
  const root = await makeTemp('identity-'), repo = path.join(root, 'repo'), alias = path.join(root, 'alias'), worktree = path.join(root, 'worktree');
  await fs.mkdir(repo); execFileSync('git', ['init', '-q', repo]); execFileSync('git', ['-C', repo, '-c', 'user.name=test', '-c', 'user.email=test@example.test', 'commit', '-qm', 'initial', '--allow-empty']); execFileSync('git', ['-C', repo, 'worktree', 'add', '-q', '-b', 'thread', worktree]); await fs.symlink(repo, alias);
  const identity = await projectIdentity(repo, commandAsync); assert.equal(await projectIdentity(alias, commandAsync), identity); assert.equal(await projectIdentity(worktree, commandAsync), identity);
  await writeKeyStore(root, identity, { set: { X: 'v' } }); assert.equal((await readKeyStore(root, await projectIdentity(worktree, commandAsync))).keys.X, 'v');
});
test('command timeout kills the child', async () => {
  const start = Date.now(), result = await commandAsync('sleep', ['30'], { timeout: 100 });
  assert.equal(result.timedOut, true); assert.equal(result.status, null); assert.match(result.stderr, /timed out after 0.1s/); assert.ok(Date.now() - start < 3000);
});
test('session launcher passes only selected keys outside recorded commands', async () => {
  const { MachineService } = require('../service');
  const root = await makeTemp('keys-launch-'), repo = path.join(root, 'repo'), bin = path.join(root, 'bin'), state = path.join(root, 'state');
  await fs.mkdir(repo); await fs.mkdir(bin);
  execFileSync('git', ['init', '-q', repo]);
  await fs.writeFile(path.join(repo, '.mcp.json'), JSON.stringify({ mcpServers: { local: { command: 'tool', args: ['${HOLD:-x}'], env: { KEY: '${KEY}', HOLD: '${HOLD}', HOME: '${HOME}' } } } }));
  const identity = await projectIdentity(repo, commandAsync); await writeKeyStore(state, identity, { set: { KEY: "value'quoted", HOLD: 'held-secret', HOME: 'reserved-secret', UNUSED: 'unused-secret' } });
  const log = path.join(root, 'tmux.log'), captured = path.join(root, 'captured');
  await fs.writeFile(path.join(bin, 'systemd-run'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  await fs.writeFile(path.join(bin, 'tmux'), `#!/bin/sh\nif [ "$1" = new-session ]; then printf '%s\\n' "$@" >> "$FAKE_LOG"; for arg do last="$arg"; done; eval "$last"; elif [ "$1" = capture-pane ]; then printf 'auto mode on\\n❯ Ready\\n'; fi\n`, { mode: 0o755 });
  for (const cli of ['claude', 'codex', 'agy']) await fs.writeFile(path.join(bin, cli), '#!/bin/sh\nprintf "%s|%s|%s|%s\\n" "${KEY-unset}" "${HOLD-unset}" "${UNUSED-unset}" "${HOME-unset}" >> "$CAPTURED"\n', { mode: 0o755 });
  const previous = { PATH: process.env.PATH, FAKE_LOG: process.env.FAKE_LOG, CAPTURED: process.env.CAPTURED }; Object.assign(process.env, { PATH: `${bin}:${previous.PATH}`, FAKE_LOG: log, CAPTURED: captured });
  const instance = new MachineService({ stateDir: state, host: '127.0.0.1', port: 0 });
  const writeFile = fs.writeFile; const modes = [];
  fs.writeFile = async (...args) => { const result = await writeFile(...args); if (String(args[0]).endsWith('.json') && String(args[0]).includes('session-env')) modes.push((await fs.stat(args[0])).mode & 0o777); return result; };
  const agy = require('../adapters/agy'), prepare = agy.prepare; agy.prepare = () => {};
  try {
    for (const [role, cli, id] of [['worker', 'claude', 'one'], ['worker', 'codex', 'two'], ['reviewer', 'claude', 'three'], ['worker', 'agy', 'four']]) {
      const session = await instance.start({ role, cli, thread_id: id, token: id, worktree: repo, name: `wc-${id}-${role}` });
      assert.doesNotMatch(JSON.stringify(session.command), /value'quoted|held-secret|unused-secret|reserved-secret/);
    }
    const lines = (await fs.readFile(captured, 'utf8')).trim().split('\n'); assert.equal(lines.length, 4);
    for (const line of lines.slice(0, 2)) assert.match(line, /^value'quoted\|unset\|unset\|/);
    for (const line of lines.slice(2)) assert.match(line, /^unset\|unset\|unset\|/);
    for (const file of [log, path.join(state, 'sessions.json')]) assert.doesNotMatch(await fs.readFile(file, 'utf8'), /value'quoted|held-secret|unused-secret|reserved-secret/);
    assert.deepEqual(modes, [0o600, 0o600]);
    assert.deepEqual(await fs.readdir(path.join(state, 'session-env')), []);
    const commandLog = await fs.readFile(log, 'utf8');
    assert.match(commandLog, /env-launch\.js/); assert.match(commandLog, /wc-one-worker\.json/);
  } finally { fs.writeFile = writeFile; agy.prepare = prepare; for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});

test('launcher safely passes shell special names and removes the file', async () => {
  const dir = await makeTemp('env-launch-'), file = path.join(dir, 'env.json'), agent = path.join(dir, 'agent');
  const value = "a'b\"c $(x) ${y}\nnext";
  await fs.writeFile(file, JSON.stringify({ OPTIND: value, IFS: value, PLAIN: value }));
  await fs.writeFile(agent, `#!${process.execPath}\nconst value = ${JSON.stringify(value)}; for (const name of ['OPTIND', 'IFS', 'PLAIN']) console.log(name + '=' + (process.env[name] === value ? 'ok' : 'bad'));\n`, { mode: 0o755 });
  const result = spawnSync(process.execPath, [path.join(__dirname, '../lib/env-launch.js'), file, agent], { encoding: 'utf8' });
  assert.equal(result.status, 0); assert.equal(result.stdout, 'OPTIND=ok\nIFS=ok\nPLAIN=ok\n'); assert.equal(result.stderr, '');
  for (const part of ["a'b", 'next']) { assert.ok(!result.stdout.includes(part)); assert.ok(!result.stderr.includes(part)); }
  await assert.rejects(fs.stat(file), { code: 'ENOENT' });
});

test('launcher errors are fixed messages and remove the file', async () => {
  const dir = await makeTemp('env-errors-'), file = path.join(dir, 'env.json'), agent = path.join(dir, 'agent');
  await fs.writeFile(agent, `#!${process.execPath}\nconsole.log('started');\n`, { mode: 0o755 });
  await fs.writeFile(file, '{"OPTIND": "a\'b');
  const launcher = path.join(__dirname, '../lib/env-launch.js');
  const invalid = spawnSync(process.execPath, [launcher, file, agent], { encoding: 'utf8' });
  assert.equal(invalid.status, 0); assert.equal(invalid.stdout, 'started\n'); assert.equal(invalid.stderr, "wheelchair: project keys couldn't be loaded; starting without them\n");
  assert.ok(!(invalid.stdout + invalid.stderr).includes("a'b")); await assert.rejects(fs.stat(file), { code: 'ENOENT' });
  await fs.writeFile(file, JSON.stringify({ PLAIN: "a'b" }));
  const missing = spawnSync(process.execPath, [launcher, file, path.join(dir, 'missing')], { encoding: 'utf8' });
  assert.equal(missing.status, 127); assert.equal(missing.stdout, ''); assert.equal(missing.stderr, "wheelchair: the agent couldn't be started\n");
  assert.ok(!missing.stderr.includes("a'b")); await assert.rejects(fs.stat(file), { code: 'ENOENT' });
});

test('an invalid executable cannot leak key values in startup errors', async () => {
  const dir = await makeTemp('env-bad-exec-'), file = path.join(dir, 'env.json'), agent = path.join(dir, 'agent');
  const value = "a'b\"c $(x) ${y}\nnext";
  await fs.writeFile(file, JSON.stringify({ PLAIN: value }));
  await fs.writeFile(agent, 'not an executable format\n', { mode: 0o755 });
  const result = spawnSync(process.execPath, [path.join(__dirname, '../lib/env-launch.js'), file, agent], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  for (const part of [value, "a'b", 'next']) assert.ok(!(result.stdout + result.stderr).includes(part));
  await assert.rejects(fs.stat(file), { code: 'ENOENT' });
});

test('nested and unbalanced substitutions hold back every referenced name', () => {
  const servers = { x: { command: 'run', args: ['${PRIMARY:-${FALLBACK}}', '${BROKEN:-${INNER}'], env: { FALLBACK: '${FALLBACK}' } }, web: { type: 'http', url: 'https://x/${A:-x${B:-${C}}}' } };
  const { heldBack } = keyReferences(servers);
  for (const name of ['PRIMARY', 'FALLBACK', 'BROKEN', 'INNER']) assert.deepEqual(heldBack[name], [{ tool: 'x', field: 'args' }]);
  for (const name of ['A', 'B', 'C']) assert.deepEqual(heldBack[name], [{ tool: 'web', field: 'url' }]);
  assert.equal(Object.hasOwn(launchKeys(servers, { keys: { FALLBACK: 'secret' } }).env, 'FALLBACK'), false);
});

test('an sse tool header key is a key reference', () => {
  const { references } = keyReferences({ s: { type: 'sse', url: 'https://example.test/sse', headers: { Authorization: 'Bearer ${SSE_TOKEN}' } } });
  assert.ok(Object.hasOwn(references, 'SSE_TOKEN'));
});
