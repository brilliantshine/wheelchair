'use strict';
// Keep service instances independent of the host's WSL and interop setup.
const noWsl = { procRoot: __dirname, etcRoot: __dirname, runRoot: __dirname };
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { makeTemp } = require('../../test-support/run-dir');
const { commandAsync } = require('../service');
const { createProjectTools } = require('../lib/project-tools');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
async function fixture() {
  const root = await makeTemp('project-tools-'), repo = path.join(root, 'repo'), remote = path.join(root, 'owner', 'name.git'), bin = path.join(root, 'bin'), config = path.join(root, 'config'), log = path.join(root, 'gh.log');
  await fs.mkdir(path.dirname(remote), { recursive: true }); await fs.mkdir(bin); git('init', '--bare', '-q', remote); git('init', '-q', '-b', 'main', repo);
  git('-C', repo, 'config', 'user.name', 'Test'); git('-C', repo, 'config', 'user.email', 'test@example.test');
  await fs.writeFile(path.join(repo, '.mcp.json'), JSON.stringify({ extra: { keep: true }, mcpServers: { old: { command: 'tool' } } }));
  git('-C', repo, 'add', '.mcp.json'); git('-C', repo, 'commit', '-qm', 'initial'); git('-C', repo, 'push', '-q', remote, 'main'); git('--git-dir', remote, 'symbolic-ref', 'HEAD', 'refs/heads/main'); git('-C', repo, 'remote', 'add', 'origin', 'https://github.com/owner/name.git');
  await fs.writeFile(config, `[url "${root}/"]\n insteadOf = https://github.com/\n`);
  await fs.writeFile(path.join(bin, 'gh'), '#!/bin/sh\nif [ x$1 = xload-buffer ]; then cat >/dev/null; fi\nprintf "%s\\n" "$*" >> "$TEST_GH_LOG"\nif [ "$1 $2" = "pr list" ]; then printf "%s\\n" "${TEST_GH_LIST:-[]}"; else if [ "${TEST_GH_FAIL:-}" = 1 ]; then echo failed >&2; exit 1; fi; echo https://github.com/owner/name/pull/1; fi\n', { mode: 0o755 });
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, GIT_CONFIG_GLOBAL: config, TEST_GH_LOG: log };
  const runner = (program, args, options) => commandAsync(program, args, { ...options, env: { ...options.env, ...env } });
  return { root, repo, remote, log, env, runner, tools: createProjectTools({ commandAsync: runner, stateDir: path.join(root, 'state') }) };
}
test('reading from remote default branch via a private ref with FETCH_HEAD and tags untouched', async () => {
  const f = await fixture(); const fetchHead = path.join(f.repo, '.git', 'FETCH_HEAD'); await fs.writeFile(fetchHead, 'unchanged');
  const refs = git('-C', f.repo, 'for-each-ref', '--format=%(refname):%(objectname)');
  const result = await f.tools.read({ path: f.repo }); assert.equal(result.body.mode, 'tools'); assert.equal(result.body.source.document.mcpServers.old.command, 'tool');
  assert.equal(await fs.readFile(fetchHead, 'utf8'), 'unchanged'); assert.equal(git('-C', f.repo, 'for-each-ref', '--format=%(refname)', 'refs/wheelchair/tools', 'refs/tags'), '');
  assert.equal(git('-C', f.repo, 'for-each-ref', '--format=%(refname):%(objectname)'), refs);
});
test('temp-worktree commit, new-branch push and PR; two saves make two PRs', async () => {
  const f = await fixture(); const read = (await f.tools.read({ path: f.repo })).body; const before = await fs.readFile(path.join(f.repo, '.mcp.json'), 'utf8');
  const tools = { ...read.source.document.mcpServers, web: { type: 'http', url: 'https://example.test', headers: { Authorization: 'Bearer ${TOKEN}' } } };
  for (let i = 0; i < 2; i++) { const reply = await f.tools.save({ path: f.repo, token: read.token, tools, keys: {} }); assert.equal(reply.body.outcome, 'opened', JSON.stringify(reply)); }
  assert.equal((await fs.readFile(f.log, 'utf8')).split('\n').filter(x => x.startsWith('pr create')).length, 2);
  const branches = git('--git-dir', f.remote, 'for-each-ref', '--format=%(refname)', 'refs/heads/wc-tools/').split('\n'); assert.equal(branches.length, 2);
  const doc = JSON.parse(git('--git-dir', f.remote, 'show', `${branches[0]}:.mcp.json`)); assert.deepEqual(doc.extra, { keep: true }); assert.equal(doc.mcpServers.web.headers.Authorization, 'Bearer ${TOKEN}');
  assert.equal(await fs.readFile(path.join(f.repo, '.mcp.json'), 'utf8'), before);
});
test('keys-only without a GitHub origin, key-only save and removal with revision checks', async () => {
  const f = await fixture(); git('-C', f.repo, 'remote', 'set-url', 'origin', f.remote);
  const read = (await f.tools.read({ path: f.repo })).body; assert.equal(read.mode, 'keys-only');
  const saved = await f.tools.save({ path: f.repo, token: read.token, tools: null, keys: { TOKEN: 'secret' } }); assert.deepEqual(saved.body.keys, ['TOKEN']);
  assert.equal((await f.tools.removeKey({ path: f.repo, token: read.token, name: 'TOKEN' })).status, 409);
  const token = { ...read.token, key_revision: saved.body.key_revision }; assert.equal((await f.tools.removeKey({ path: f.repo, token, name: 'TOKEN' })).body.outcome, 'removed');
});
test('pr_failed with compare link', async () => {
  const f = await fixture(); f.env.TEST_GH_FAIL = '1'; const read = (await f.tools.read({ path: f.repo })).body;
  const reply = await f.tools.save({ path: f.repo, token: read.token, tools: { x: { command: 'run' } }, keys: {} }); assert.equal(reply.body.outcome, 'pr_failed'); assert.match(reply.body.compare_url, /github\.com\/owner\/name\/compare\/main\.\.\.wc-tools\//);
});
test('push refuses an existing branch name and keys remain saved', async () => {
  const f = await fixture(), fixed = createProjectTools({ commandAsync: f.runner, stateDir: path.join(f.root, 'state'), id: () => '123456abcdef' });
  git('--git-dir', f.remote, 'update-ref', 'refs/heads/wc-tools/123456abcdef', git('--git-dir', f.remote, 'rev-parse', 'refs/heads/main'));
  const read = (await fixed.read({ path: f.repo })).body;
  const result = await fixed.save({ path: f.repo, token: read.token, tools: { x: { command: 'run' } }, keys: { TOKEN: 'secret' } });
  assert.equal(result.body.outcome, 'failed'); assert.equal(result.body.key_revision, 1); assert.deepEqual(result.body.keys, ['TOKEN']);
});
test('offline fetch returns failed with original key revision and keys; Read falls back', async () => {
  const f = await fixture(), read = (await f.tools.read({ path: f.repo })).body;
  const offline = createProjectTools({ stateDir: path.join(f.root, 'state'), commandAsync: (program, args, options) => args.includes('fetch') ? Promise.resolve({ ok: false, stderr: 'offline' }) : f.runner(program, args, options) });
  const result = await offline.save({ path: f.repo, token: read.token, tools: { x: { command: 'run' } }, keys: { TOKEN: 'secret' } });
  assert.equal(result.body.outcome, 'failed'); assert.equal(result.body.key_revision, 0); assert.deepEqual(result.body.keys, []);
  const fallback = (await offline.read({ path: f.repo })).body; assert.equal(fallback.mode, 'unreachable'); assert.match(fallback.notice, /offline/);
});
test('reserved names and conflicts created by edited tools are refused', async () => {
  const f = await fixture(), read = (await f.tools.read({ path: f.repo })).body;
  assert.match((await f.tools.save({ path: f.repo, token: read.token, tools: null, keys: { PATH: 'x' } })).body.reason, /can't be set/);
  const tools = { x: { command: 'run', args: ['${TOKEN:-x}'], env: { TOKEN: '${TOKEN}' } } };
  assert.match((await f.tools.save({ path: f.repo, token: read.token, tools, keys: {} })).body.reason, /TOKEN is also used in args/);
});
test('changed key revision and project identity are refused', async () => {
  const f = await fixture(), read = (await f.tools.read({ path: f.repo })).body;
  await f.tools.save({ path: f.repo, token: read.token, tools: null, keys: { TOKEN: 'x' } });
  assert.equal((await f.tools.save({ path: f.repo, token: read.token, tools: null, keys: { TOKEN: 'y' } })).status, 409);
  assert.equal((await f.tools.removeKey({ path: f.repo, token: { ...read.token, project: '/other', key_revision: 1 }, name: 'TOKEN' })).status, 409);
});
test('waiting tools PRs filtered by wc-tools and same repository; gh failure still lists tools', async () => {
  const f = await fixture(); f.env.TEST_GH_LIST = JSON.stringify([{ number: 1, url: 'u', title: 'yes', headRefName: 'wc-tools/one', isCrossRepository: false }, { number: 2, headRefName: 'wc-tools/two', isCrossRepository: true }, { number: 3, headRefName: 'other', isCrossRepository: false }]);
  const read = (await f.tools.read({ path: f.repo })).body; assert.deepEqual(read.waiting, [{ number: 1, url: 'u', title: 'yes', branch: 'wc-tools/one' }]);
  const failed = createProjectTools({ stateDir: path.join(f.root, 'state'), commandAsync: (p, a, o) => p === 'gh' ? Promise.resolve({ ok: false, stderr: 'no gh' }) : f.runner(p, a, o) });
  const other = (await failed.read({ path: f.repo })).body; assert.equal(other.mode, 'tools'); assert.equal(other.waiting_error, 'no gh');
});
test('changed file refused, unrelated commit allowed, and key-only save never fetches', async () => {
  const f = await fixture(), read = (await f.tools.read({ path: f.repo })).body;
  await fs.writeFile(path.join(f.repo, 'other'), 'new'); git('-C', f.repo, 'add', 'other'); git('-C', f.repo, 'commit', '-qm', 'other'); git('-C', f.repo, 'push', '-q', f.remote, 'main');
  const tools = { x: { command: 'run' } }; assert.equal((await f.tools.save({ path: f.repo, token: read.token, tools, keys: {} })).body.outcome, 'opened');
  await fs.writeFile(path.join(f.repo, '.mcp.json'), JSON.stringify({ mcpServers: { newer: { command: 'run' } } })); git('-C', f.repo, 'add', '.mcp.json'); git('-C', f.repo, 'commit', '-qm', 'changed'); git('-C', f.repo, 'push', '-q', f.remote, 'main');
  assert.equal((await f.tools.save({ path: f.repo, token: read.token, tools, keys: {} })).status, 409);
  const noFetch = createProjectTools({ stateDir: path.join(f.root, 'state'), commandAsync: (p, a, o) => a.includes('fetch') ? Promise.reject(new Error('unexpected fetch')) : f.runner(p, a, o) });
  assert.equal((await noFetch.save({ path: f.repo, token: read.token, tools: read.source.document.mcpServers, keys: { KEY: 'v' } })).body.outcome, 'saved');
});
test('Start over replaces unreadable file and is refused on readable source', async () => {
  const f = await fixture(), readable = (await f.tools.read({ path: f.repo })).body;
  assert.equal((await f.tools.save({ path: f.repo, token: readable.token, tools: {}, keys: {}, start_over: true })).status, 400);
  await fs.writeFile(path.join(f.repo, '.mcp.json'), 'invalid'); git('-C', f.repo, 'add', '.mcp.json'); git('-C', f.repo, 'commit', '-qm', 'invalid'); git('-C', f.repo, 'push', '-q', f.remote, 'main');
  const read = (await f.tools.read({ path: f.repo })).body; assert.equal(read.source.state, 'unreadable');
  assert.equal((await f.tools.save({ path: f.repo, token: read.token, tools: {}, keys: {} })).status, 400);
  assert.equal((await f.tools.save({ path: f.repo, token: read.token, tools: {}, keys: {}, start_over: true })).body.outcome, 'opened');
});
test('dropped Save still runs to the end', async () => {
  const http = require('node:http'), { MachineService } = require('../service');
  const f = await fixture(), read = (await f.tools.read({ path: f.repo })).body;
  let signal, release; const started = new Promise(resolve => { signal = resolve; }), gate = new Promise(resolve => { release = resolve; });
  const runner = async (p, a, o) => { if (a.includes('fetch')) { signal(); await gate; } return f.runner(p, a, o); };
  const service = new MachineService({ win: noWsl, stateDir: path.join(f.root, 'state') }); service.projectTools = createProjectTools({ commandAsync: runner, stateDir: service.stateDir }); service.authorize = async () => {};
  const server = http.createServer((req, res) => service.handle(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path: '/v1/project-tools/save', method: 'POST' }); req.on('error', () => {});
    req.end(JSON.stringify({ path: f.repo, token: read.token, tools: { x: { command: 'run' } }, keys: {} })); await started; req.destroy(); release();
    const deadline = Date.now() + 10000; while (Date.now() < deadline && !git('--git-dir', f.remote, 'for-each-ref', '--format=%(refname)', 'refs/heads/wc-tools/')) await new Promise(resolve => setTimeout(resolve, 25));
    assert.match(git('--git-dir', f.remote, 'for-each-ref', '--format=%(refname)', 'refs/heads/wc-tools/'), /wc-tools\//);
  } finally { release(); await new Promise(resolve => server.close(resolve)); }
});
test('a failed key write leaves no temporary file', async () => {
  const f = await fixture(), read = (await f.tools.read({ path: f.repo })).body;
  const rename = fs.rename; fs.rename = async () => { throw new Error('rename failed'); };
  try { const reply = await f.tools.save({ path: f.repo, token: read.token, tools: null, keys: { TOKEN: 'secret' } }); assert.equal(reply.body.outcome, 'failed'); assert.equal(reply.body.key_revision, 0); }
  finally { fs.rename = rename; }
  assert.deepEqual(await fs.readdir(path.join(f.root, 'state', 'project-keys')), []);
});
test('key store mode 600 and fresh key revision after a key write', async () => {
  const f = await fixture(), read = (await f.tools.read({ path: f.repo })).body;
  const first = await f.tools.save({ path: f.repo, token: read.token, tools: null, keys: { A: 'a' } });
  const second = await f.tools.save({ path: f.repo, token: { ...read.token, key_revision: first.body.key_revision }, tools: null, keys: { B: 'b' } });
  assert.deepEqual(second.body.keys, ['A', 'B']); const dir = path.join(f.root, 'state', 'project-keys'); const [file] = await fs.readdir(dir); assert.equal((await fs.stat(path.join(dir, file))).mode & 0o777, 0o600);
});
test('existing conflicts do not block editing unrelated fields', async () => {
  const f = await fixture(); const entry = { command: 'run', args: ['${TOKEN}'], env: { TOKEN: '${TOKEN}' } };
  await fs.writeFile(path.join(f.repo, '.mcp.json'), JSON.stringify({ mcpServers: { x: entry } })); git('-C', f.repo, 'add', '.mcp.json'); git('-C', f.repo, 'commit', '-qm', 'conflict'); git('-C', f.repo, 'push', '-q', f.remote, 'main');
  const read = (await f.tools.read({ path: f.repo })).body;
  assert.match(read.checks.x.key_warnings.join(' '), /TOKEN is held back/);
  assert.equal((await f.tools.save({ path: f.repo, token: read.token, tools: { x: { ...entry, extra: true } }, keys: {} })).body.outcome, 'opened');
});
test('commit failure after keys stored returns updated revision and keys', async () => {
  const f = await fixture(), read = (await f.tools.read({ path: f.repo })).body;
  const broken = createProjectTools({ stateDir: path.join(f.root, 'state'), commandAsync: (p, a, o) => a.includes('commit') ? Promise.resolve({ ok: false, stderr: 'commit failed' }) : f.runner(p, a, o) });
  const result = await broken.save({ path: f.repo, token: read.token, tools: { x: { command: 'run' } }, keys: { TOKEN: 'secret' } });
  assert.equal(result.body.outcome, 'failed'); assert.equal(result.body.key_revision, 1); assert.deepEqual(result.body.keys, ['TOKEN']); assert.match(result.body.error, /commit failed/);
});
test('changed repository is refused', async () => {
  const f = await fixture(), read = (await f.tools.read({ path: f.repo })).body;
  git('-C', f.repo, 'remote', 'set-url', 'origin', 'https://github.com/owner/different.git');
  assert.equal((await f.tools.save({ path: f.repo, token: read.token, tools: { x: { command: 'run' } }, keys: {} })).status, 409);
});
test('Start over replaces a symlink with a regular file', async () => {
  const f = await fixture(); await fs.unlink(path.join(f.repo, '.mcp.json')); await fs.symlink('other', path.join(f.repo, '.mcp.json'));
  git('-C', f.repo, 'add', '.mcp.json'); git('-C', f.repo, 'commit', '-qm', 'symlink'); git('-C', f.repo, 'push', '-q', f.remote, 'main');
  const read = (await f.tools.read({ path: f.repo })).body; assert.equal(read.source.state, 'unreadable'); assert.match(read.source.reason, /not a regular file/);
  assert.equal((await f.tools.save({ path: f.repo, token: read.token, tools: {}, keys: {}, start_over: true })).body.outcome, 'opened');
  assert.match(git('--git-dir', f.remote, 'ls-tree', 'refs/heads/' + git('--git-dir', f.remote, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/wc-tools/'), '.mcp.json'), /^100644 blob/);
});
test('raw configured fetch and push URLs select the GitHub repository while Git applies insteadOf', async () => {
  const f = await fixture();
  git('-C', f.repo, 'remote', 'set-url', '--push', 'origin', 'https://github.com/owner/name.git');
  assert.equal((await f.tools.read({ path: f.repo })).body.mode, 'tools');
  git('-C', f.repo, 'remote', 'set-url', '--push', 'origin', 'https://github.com/owner/other.git');
  assert.equal((await f.tools.read({ path: f.repo })).body.mode, 'keys-only');
});
test('multiple configured push URLs use keys-only mode', async () => {
  const f = await fixture();
  git('-C', f.repo, 'config', '--add', 'remote.origin.pushurl', 'https://github.com/owner/name.git');
  git('-C', f.repo, 'config', '--add', 'remote.origin.pushurl', 'https://github.com/owner/name.git');
  assert.equal((await f.tools.read({ path: f.repo })).body.mode, 'keys-only');
});
test('multiple configured origin URLs use keys-only mode', async () => {
  const f = await fixture();
  git('-C', f.repo, 'config', '--add', 'remote.origin.url', 'https://github.com/owner/name.git');
  assert.equal((await f.tools.read({ path: f.repo })).body.mode, 'keys-only');
});
test('PR URL is the last HTTPS line in gh output', async () => {
  const f = await fixture();
  await fs.writeFile(path.join(f.root, 'bin', 'gh'), '#!/bin/sh\nif [ x$1 = xload-buffer ]; then cat >/dev/null; fi\nif [ "$1 $2" = "pr list" ]; then echo "[]"; else echo "Creating pull request"; echo "https://github.com/owner/name/pull/42"; fi\n', { mode: 0o755 });
  const read = (await f.tools.read({ path: f.repo })).body;
  const reply = await f.tools.save({ path: f.repo, token: read.token, tools: { x: { command: 'run' } }, keys: {} });
  assert.equal(reply.body.pr_url, 'https://github.com/owner/name/pull/42');
});
test('changed default branch refuses a tool save', async () => {
  const f = await fixture(), read = (await f.tools.read({ path: f.repo })).body;
  git('-C', f.repo, 'push', '-q', f.remote, 'main:other'); git('--git-dir', f.remote, 'symbolic-ref', 'HEAD', 'refs/heads/other');
  const reply = await f.tools.save({ path: f.repo, token: read.token, tools: { x: { command: 'run' } }, keys: {} });
  assert.equal(reply.status, 409); assert.equal(reply.body.reason, 'changed since you opened it');
});
async function routeServer(f) {
  const http = require('node:http'), { MachineService } = require('../service');
  const service = new MachineService({ win: noWsl, stateDir: path.join(f.root, 'state') }); service.projectTools = f.tools; service.authorize = async () => {};
  const server = http.createServer((req, res) => service.handle(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const post = async (action, input) => { const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/project-tools/${action}`, { method: 'POST', body: JSON.stringify(input) }); return { status: response.status, body: await response.json() }; };
  return { post, close: () => new Promise(resolve => server.close(resolve)) };
}
test('concurrent route saves on one project serialize PR creation', async () => {
  const f = await fixture();
  await fs.writeFile(path.join(f.root, 'bin', 'gh'), '#!/bin/sh\nif [ x$1 = xload-buffer ]; then cat >/dev/null; fi\nif [ "$1 $2" = "pr list" ]; then echo "[]"; else echo start >> "$TEST_GH_LOG"; sleep 1; echo end >> "$TEST_GH_LOG"; echo https://github.com/owner/name/pull/1; fi\n', { mode: 0o755 });
  const server = await routeServer(f);
  try {
    const read = (await server.post('read', { path: f.repo })).body;
    const input = { path: f.repo, token: read.token, tools: { x: { command: 'run' } }, keys: {} };
    const replies = await Promise.all([server.post('save', input), server.post('save', input)]);
    assert.deepEqual(replies.map(r => r.body.outcome), ['opened', 'opened']);
    assert.deepEqual((await fs.readFile(f.log, 'utf8')).trim().split('\n'), ['start', 'end', 'start', 'end']);
  } finally { await server.close(); }
});
test('alias and thread worktree share keys through routes', async () => {
  const f = await fixture(), alias = path.join(f.root, 'alias'), worktree = path.join(f.root, 'thread');
  await fs.symlink(f.repo, alias); git('-C', f.repo, 'worktree', 'add', '--detach', worktree, 'HEAD');
  const server = await routeServer(f);
  try {
    const read = (await server.post('read', { path: alias })).body;
    const saved = await server.post('save', { path: alias, token: read.token, tools: null, keys: { TOKEN: 'secret' } });
    assert.equal(saved.body.outcome, 'saved');
    assert.deepEqual((await server.post('read', { path: worktree })).body.keys, ['TOKEN']);
  } finally { await server.close(); }
});
test('failed worktree add after registration removes and prunes the temporary worktree', async () => {
  const f = await fixture(), read = (await f.tools.read({ path: f.repo })).body;
  await fs.writeFile(path.join(f.repo, '.git', 'hooks', 'post-checkout'), '#!/bin/sh\nif [ x$1 = xload-buffer ]; then cat >/dev/null; fi\nexit 1\n', { mode: 0o755 });
  const reply = await f.tools.save({ path: f.repo, token: read.token, tools: { x: { command: 'run' } }, keys: {} });
  assert.equal(reply.status, 502);
  assert.equal(reply.body.outcome, 'failed');
  assert.deepEqual(git('-C', f.repo, 'worktree', 'list', '--porcelain').split('\n').filter(line => line.startsWith('worktree ')), [`worktree ${f.repo}`]);
});

test('special names work in checks and keys, and Start over requires an empty list', async () => {
  const f = await fixture();
  await fs.writeFile(path.join(f.repo, '.mcp.json'), JSON.stringify({ mcpServers: { constructor: { command: 'run', env: { constructor: '${constructor}' } } } }));
  git('-C', f.repo, 'add', '.mcp.json'); git('-C', f.repo, 'commit', '-qm', 'special names'); git('-C', f.repo, 'push', '-q', f.remote, 'main');
  const read = (await f.tools.read({ path: f.repo })).body;
  assert.equal(read.mode, 'tools'); assert.deepEqual(read.checks.constructor.key_warnings, ['needs constructor, not set on this machine']);
  const saved = await f.tools.save({ path: f.repo, token: read.token, tools: null, keys: { toString: 'secret' } });
  assert.deepEqual(saved.body.keys, ['toString']);
  await fs.writeFile(path.join(f.repo, '.mcp.json'), 'invalid');
  git('-C', f.repo, 'add', '.mcp.json'); git('-C', f.repo, 'commit', '-qm', 'unreadable'); git('-C', f.repo, 'push', '-q', f.remote, 'main');
  const unreadable = (await f.tools.read({ path: f.repo })).body; assert.equal(unreadable.source.state, 'unreadable');
  const rejected = await f.tools.save({ path: f.repo, token: unreadable.token, tools: { x: { command: 'run' } }, keys: {}, start_over: true });
  assert.equal(rejected.status, 400); assert.equal(rejected.body.reason, 'start over replaces the file with an empty tool list');
});


test('checks expose per-tool eligible and held-back key names', async () => {
  const f = await fixture();
  const servers = { a: { command: 'run', env: { TOKEN: '${TOKEN}' } }, b: { command: 'run', env: { ALIAS: '${TOKEN}' } }, c: { type: 'http', url: 'https://example.test', headers: { X: '${H1}${H2}' } }, d: { command: 'run', args: ['${TOKEN}'], env: { TOKEN: '${TOKEN}' } } };
  await fs.writeFile(path.join(f.repo, '.mcp.json'), JSON.stringify({ mcpServers: servers }));
  git('-C', f.repo, 'add', '.mcp.json'); git('-C', f.repo, 'commit', '-qm', 'references'); git('-C', f.repo, 'push', '-q', f.remote, 'main');
  const { checks } = (await f.tools.read({ path: f.repo })).body;
  assert.deepEqual(checks.a.keys, ['TOKEN']); assert.deepEqual(checks.b.keys, ['TOKEN']);
  assert.deepEqual(checks.c.keys, ['H1', 'H2']); assert.deepEqual(checks.d.held_back, ['TOKEN']);
});

test('save stages an ignored, untracked .mcp.json', async () => {
  const f = await fixture();
  git('-C', f.repo, 'rm', '--cached', '--', '.mcp.json');
  await fs.writeFile(path.join(f.repo, '.gitignore'), '.mcp.json\n');
  git('-C', f.repo, 'add', '.gitignore'); git('-C', f.repo, 'commit', '-qm', 'ignore tools'); git('-C', f.repo, 'push', '-q', f.remote, 'main');
  const read = (await f.tools.read({ path: f.repo })).body; assert.equal(read.source.state, 'missing');
  const reply = await f.tools.save({ path: f.repo, token: read.token, tools: { x: { command: 'run' } }, keys: {} });
  assert.equal(reply.body.outcome, 'opened', JSON.stringify(reply));
  const branch = git('--git-dir', f.remote, 'for-each-ref', '--format=%(refname)', 'refs/heads/wc-tools/');
  assert.equal(JSON.parse(git('--git-dir', f.remote, 'show', `${branch}:.mcp.json`)).mcpServers.x.command, 'run');
});

test('unreadable key store gives complete failed save and remove replies', async () => {
  const f = await fixture(), read = (await f.tools.read({ path: f.repo })).body;
  await f.tools.save({ path: f.repo, token: read.token, tools: null, keys: { TOKEN: 'secret' } });
  const dir = path.join(f.root, 'state', 'project-keys'), [file] = await fs.readdir(dir);
  await fs.writeFile(path.join(dir, file), '{invalid');
  for (const reply of [await f.tools.save({ path: f.repo, token: read.token, tools: null, keys: { TOKEN: 'new' } }), await f.tools.removeKey({ path: f.repo, token: read.token, name: 'TOKEN' })]) {
    assert.equal(reply.status, 502); assert.equal(reply.body.outcome, 'failed');
    assert.equal(reply.body.key_revision, 0); assert.deepEqual(reply.body.keys, []);
  }
});

test('malformed key stores never expose values in replies or launch logs', async () => {
  const { MachineService } = require('../service');
  const f = await fixture(), state = path.join(f.root, 'state');
  await fs.writeFile(path.join(f.repo, '.mcp.json'), JSON.stringify({ mcpServers: { local: { command: 'tool', env: { K: '${K}' } } } }));
  const initial = (await f.tools.read({ path: f.repo })).body;
  await f.tools.save({ path: f.repo, token: initial.token, tools: null, keys: { K: 'original' } });
  const dir = path.join(state, 'project-keys'), [file] = await fs.readdir(dir);
  await fs.writeFile(path.join(f.root, 'bin', 'systemd-run'), '#!/bin/sh\nif [ x$1 = xload-buffer ]; then cat >/dev/null; fi\nexit 1\n', { mode: 0o755 });
  await fs.writeFile(path.join(f.root, 'bin', 'tmux'), '#!/bin/sh\nif [ x$1 = xload-buffer ]; then cat >/dev/null; fi\nif [ "$1" = capture-pane ]; then printf "auto mode on\\n❯ Ready\\n"; fi\n', { mode: 0o755 });
  const previousPath = process.env.PATH; process.env.PATH = `${path.join(f.root, 'bin')}:${previousPath}`;
  const previousError = console.error, logs = []; console.error = (...args) => logs.push(args.join(' '));
  try {
    for (const [index, text] of [
      `{"project":${JSON.stringify(initial.token.project)},"revision":1,"keys":{"K":"SECRET-VALUE-123"`,
      JSON.stringify({ project: initial.token.project, revision: 1, keys: 'SECRET-VALUE-123' }),
    ].entries()) {
      await fs.writeFile(path.join(dir, file), text);
      const read = await f.tools.read({ path: f.repo });
      const save = await f.tools.save({ path: f.repo, token: initial.token, tools: null, keys: { K: 'new' } });
      const remove = await f.tools.removeKey({ path: f.repo, token: initial.token, name: 'K' });
      for (const reply of [read, save, remove]) assert.doesNotMatch(JSON.stringify(reply.body), /SECRET-VALUE-123/);
      assert.equal(read.body.notice, "the key store on this machine can't be read");
      assert.equal(save.body.error, "the key store on this machine can't be read");
      assert.equal(remove.body.error, "the key store on this machine can't be read");
      const instance = new MachineService({ win: noWsl, stateDir: state, host: '127.0.0.1', port: 0 });
      await instance.start({ role: 'worker', cli: 'claude', thread_id: `bad${index}`, token: `bad${index}`, worktree: f.repo, name: `wc-bad${index}-worker` });
    }
    assert.equal(logs.filter(line => line === "the key store on this machine can't be read").length, 2);
    for (const line of logs) assert.doesNotMatch(line, /SECRET-VALUE-123/);
  } finally { console.error = previousError; process.env.PATH = previousPath; }
});
test('R7-1: compare_url encodes branch names but keeps slashes', async () => {
  const f = await fixture(); f.env.TEST_GH_FAIL = '1';
  git('-C', f.repo, 'push', '-q', f.remote, 'main:release#2026'); git('--git-dir', f.remote, 'symbolic-ref', 'HEAD', 'refs/heads/release#2026');
  const read = (await f.tools.read({ path: f.repo })).body;
  const reply = await f.tools.save({ path: f.repo, token: read.token, tools: { x: { command: 'run' } }, keys: {} });
  assert.equal(reply.body.outcome, 'pr_failed');
  assert.match(reply.body.compare_url, /^https:\/\/github\.com\/owner\/name\/compare\/release%232026\.\.\.wc-tools\/[0-9a-f]+\?expand=1$/);
});

test('Windows marks read and save independently while preserving document keys', async () => {
  const f = await fixture();
  const doc = { extra: 1, wheelchair: { windows: ['old'], other: 2 }, mcpServers: { old: { command: 'tool' } } };
  await fs.writeFile(path.join(f.repo, '.mcp.json'), JSON.stringify(doc)); git('-C', f.repo, 'add', '.mcp.json'); git('-C', f.repo, 'commit', '-qm', 'marks'); git('-C', f.repo, 'push', '-q', f.remote, 'main');
  const tools = createProjectTools({ commandAsync: f.runner, stateDir: path.join(f.root, 'state'), wsl: () => true });
  const read = (await tools.read({ path: f.repo })).body; assert.equal(read.wsl, true); assert.deepEqual(read.windows, ['old']);
  assert.equal((await tools.save({ path: f.repo, token: read.token, tools: doc.mcpServers, windows: [1], keys: {} })).body.reason, 'invalid save request');
  assert.equal((await tools.save({ path: f.repo, token: read.token, tools: doc.mcpServers, keys: {} })).body.reason, 'nothing to save');
  assert.equal((await tools.save({ path: f.repo, token: read.token, tools: { x: { command: 'x' } }, keys: {} })).body.outcome, 'opened');
  assert.equal((await tools.save({ path: f.repo, token: read.token, tools: doc.mcpServers, windows: [], keys: {} })).body.outcome, 'opened');
  const branches = git('--git-dir', f.remote, 'for-each-ref', '--format=%(refname)', 'refs/heads/wc-tools/').split('\n');
  const docs = branches.map(b => JSON.parse(git('--git-dir', f.remote, 'show', `${b}:.mcp.json`)));
  assert.ok(docs.some(d => d.wheelchair.windows?.[0] === 'old'));
  assert.ok(docs.some(d => d.extra === 1 && d.wheelchair.other === 2 && !('windows' in d.wheelchair)));
  doc.wheelchair = { windows: ['old'] }; await fs.writeFile(path.join(f.repo, '.mcp.json'), JSON.stringify(doc)); git('-C', f.repo, 'add', '.mcp.json'); git('-C', f.repo, 'commit', '-qm', 'empty mark container'); git('-C', f.repo, 'push', '-q', f.remote, 'main');
  const next = (await tools.read({ path: f.repo })).body; await tools.save({ path: f.repo, token: next.token, tools: doc.mcpServers, windows: [], keys: {} });
  const latest = git('--git-dir', f.remote, 'for-each-ref', '--format=%(refname)', 'refs/heads/wc-tools/').split('\n').map(b => JSON.parse(git('--git-dir', f.remote, 'show', `${b}:.mcp.json`)));
  assert.ok(latest.some(d => !('wheelchair' in d)));
  git('-C', f.repo, 'remote', 'set-url', 'origin', f.remote); const keysOnly = (await tools.read({ path: f.repo })).body; assert.equal(keysOnly.wsl, true); assert.deepEqual(keysOnly.windows, []);
});
test('folder tools come from the default branch even with a different push destination', async () => {
  const f = await fixture();
  const base = path.join(f.repo, '.wheelchair', 'tools');
  for (const [name, value] of Object.entries({ good: { name: 'good', description: 'ok', kind: 'script', inputs: {}, run: ['./run'] }, broken: { name: 'broken', description: 'bad', kind: 'server' }, absent: { name: 'absent', description: 'bad', kind: 'script', inputs: {}, run: ['./missing'] } })) {
    await fs.mkdir(path.join(base, name), { recursive: true });
    await fs.writeFile(path.join(base, name, 'tool.json'), JSON.stringify(value));
  }
  await fs.writeFile(path.join(base, 'good', 'run'), 'ok', { mode: 0o755 });
  git('-C', f.repo, 'add', '.wheelchair'); git('-C', f.repo, 'commit', '-qm', 'tools'); git('-C', f.repo, 'push', '-q', f.remote, 'main');
  await fs.rm(path.join(base, 'good'), { recursive: true });
  git('-C', f.repo, 'remote', 'set-url', '--push', 'origin', 'https://github.com/other/repo.git');
  const read = (await f.tools.read({ path: f.repo })).body;
  assert.equal(read.mode, 'keys-only');
  assert.deepEqual(read.folder_tools.rows.map(r => [r.name, r.status]), [['absent', 'missing-program'], ['broken', 'invalid'], ['good', 'ok']]);
  assert.match(read.folder_tools.rows[1].reason, /start/);
  git('-C', f.repo, 'remote', 'set-url', 'origin', f.remote);
  const local = (await f.tools.read({ path: f.repo })).body;
  assert.deepEqual(local.folder_tools.notes, ['folder tools can only be listed for GitHub projects']);
});
test('shared folder copy, collision, and refresh notes', async () => {
  const f = await fixture();
  const shared = require('../lib/shared-tools');
  const choice = { repo: 'owner/name', candidates: [f.repo] };
  const local = await fixture();
  git('-C', local.repo, 'remote', 'set-url', 'origin', local.remote);
  const state = path.join(local.root, 'state');
  let result = (await local.tools.read({ path: local.repo, shared_tools: { ...choice, candidates: [] } })).body.folder_tools;
  assert.ok(result.notes.includes("the shared tools project isn't added on this machine"));
  result = (await local.tools.read({ path: local.repo, shared_tools: choice })).body.folder_tools;
  assert.ok(result.notes.includes('no shared copy on this machine yet'));
  const id = await shared.identityFor(f.repo), root = path.join(state, 'shared-tools', id), hash = 'a'.repeat(40), copy = path.join(root, hash), dir = path.join(copy, '.wheelchair', 'tools', 'shared');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(root, 'last-refresh.json'), JSON.stringify({ at: 'now', ok: false, error: 'offline' }));
  result = (await local.tools.read({ path: local.repo, shared_tools: choice })).body.folder_tools;
  assert.ok(result.notes.includes('last refresh failed: offline'));
  await fs.writeFile(path.join(dir, 'tool.json'), JSON.stringify({ name: 'shared', description: 'ok', kind: 'server', start: ['node'] }));
  const invalid = path.join(copy, '.wheelchair', 'tools', 'invalid'), missing = path.join(copy, '.wheelchair', 'tools', 'missing');
  await fs.mkdir(invalid); await fs.writeFile(path.join(invalid, 'tool.json'), '{}');
  await fs.mkdir(missing); await fs.writeFile(path.join(missing, 'tool.json'), JSON.stringify({ name: 'missing', description: 'missing', kind: 'server', start: ['wheelchair-absent'] }));
  await fs.writeFile(path.join(root, 'current'), hash);
  result = (await local.tools.read({ path: local.repo, shared_tools: choice })).body.folder_tools;
  assert.equal(result.rows.find(row => row.name === 'shared').status, 'ok');
  assert.equal(result.rows.find(row => row.name === 'invalid').status, 'invalid');
  assert.equal(result.rows.find(row => row.name === 'missing').status, 'missing-program');
  assert.equal(result.rows.find(row => row.name === 'shared').note, "not checked against this project's own tools");
  assert.deepEqual((await f.tools.read({ path: f.repo, shared_tools: choice })).body.folder_tools.rows, []);
  const projectDir = path.join(local.repo, '.wheelchair', 'tools', 'shared');
  await fs.mkdir(projectDir, { recursive: true });
  await fs.writeFile(path.join(projectDir, 'tool.json'), JSON.stringify({ name: 'shared', description: 'project', kind: 'server', start: ['node'] }));
  git('-C', local.repo, 'add', '.wheelchair'); git('-C', local.repo, 'commit', '-qm', 'collision'); git('-C', local.repo, 'push', '-q', local.remote, 'main');
  git('-C', local.repo, 'remote', 'set-url', 'origin', 'https://github.com/owner/name.git');
  git('-C', local.repo, 'config', 'remote.origin.url', 'https://github.com/owner/other.git');
  await fs.mkdir(path.join(local.root, 'owner'), { recursive: true });
  await fs.cp(local.remote, path.join(local.root, 'owner', 'other.git'), { recursive: true });
  result = (await local.tools.read({ path: local.repo, shared_tools: choice })).body.folder_tools;
  assert.equal(result.rows.find(row => row.source === 'shared' && row.name === 'shared').status, 'hidden');
});

test('folder failures preserve editor and shared listing', async () => {
  const f = await fixture();
  const baseline = (await f.tools.read({ path: f.repo })).body;
  const broken = createProjectTools({ stateDir: path.join(f.root, 'state'), commandAsync: (p, a, o) => a.includes('ls-tree') && a.includes('.wheelchair/tools/') ? Promise.reject(new Error('folder failure\nextra')) : f.runner(p, a, o) });
  const result = (await broken.read({ path: f.repo })).body;
  assert.equal(result.mode, baseline.mode); assert.deepEqual(result.source, baseline.source);
  assert.deepEqual(result.folder_tools, { rows: [], notes: ["couldn't list folder tools: folder failure extra"] });
  assert.equal(git('-C', f.repo, 'for-each-ref', '--format=%(refname)', 'refs/wheelchair'), '');
});

test('folder program checks use executable tree modes, absolute paths and PATH', async () => {
  const f = await fixture(), base = path.join(f.repo, '.wheelchair', 'tools');
  const programs = { executable: './run', plain: './run', absolute: process.execPath, bare: 'node', missing: 'wheelchair-no-such-program', 'star[abc]': './run' };
  for (const [name, program] of Object.entries(programs)) {
    const dir = path.join(base, name); await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'tool.json'), JSON.stringify({ name, description: 'test', kind: 'script', inputs: {}, run: [program] }));
    if (program === './run') await fs.writeFile(path.join(dir, 'run'), 'run', { mode: name === 'plain' ? 0o644 : 0o755 });
  }
  const sibling = path.join(base, 'sibling'); await fs.mkdir(sibling);
  await fs.writeFile(path.join(sibling, 'tool.json'), JSON.stringify({ name: 'sibling', description: 'test', kind: 'script', inputs: {}, run: ['../executable/run'] }));
  const symlink = path.join(base, 'symlink'); await fs.mkdir(symlink);
  await fs.writeFile(path.join(symlink, 'tool.json'), JSON.stringify({ name: 'symlink', description: 'test', kind: 'script', inputs: {}, run: ['./run'] }));
  await fs.symlink('target', path.join(symlink, 'run')); await fs.writeFile(path.join(symlink, 'target'), 'ok', { mode: 0o755 });
  git('-C', f.repo, 'add', '.wheelchair'); git('-C', f.repo, 'commit', '-qm', 'programs'); git('-C', f.repo, 'push', '-q', f.remote, 'main');
  const rows = (await f.tools.read({ path: f.repo })).body.folder_tools.rows, byName = Object.fromEntries(rows.map(row => [row.name, row]));
  assert.equal(byName.executable.status, 'ok'); assert.equal(byName.sibling.status, 'ok'); assert.equal(byName.symlink.status, 'ok'); assert.equal(byName.absolute.status, 'ok'); assert.equal(byName.bare.status, 'ok');
  assert.equal(byName.missing.status, 'missing-program'); assert.equal(byName.plain.status, 'missing-program'); assert.match(byName.plain.reason, /not executable|isn't executable/);
  assert.match(byName['star[abc]'].reason, /name/i);
});

test('repo-only read does not fetch or list tools', async () => {
  const f = await fixture();
  const fast = createProjectTools({ stateDir: path.join(f.root, 'state'), commandAsync: (p, a, o) => { if (p === 'gh' || a.includes('fetch') || a.includes('ls-tree')) throw new Error('unexpected expensive operation'); return f.runner(p, a, o); } });
  assert.deepEqual((await fast.read({ path: f.repo, repo_only: true })).body, { repo: 'owner/name' });
});


test('shared listing failure preserves project rows and keys-only editor', async () => {
  const f = await fixture(), shared = require('../lib/shared-tools');
  const original = shared.findSharedProject;
  shared.findSharedProject = async () => { throw new Error('shared failed\nsecond line'); };
  try {
    const choice = { repo: 'another/repo', candidates: [f.repo] };
    const result = (await f.tools.read({ path: f.repo, shared_tools: choice })).body;
    assert.equal(result.mode, 'tools'); assert.equal(result.source.document.mcpServers.old.command, 'tool');
    assert.deepEqual(result.folder_tools.notes, ["couldn't list folder tools: shared failed second line"]);
    git('-C', f.repo, 'remote', 'set-url', '--push', 'origin', 'https://github.com/other/repo.git');
    const keys = (await f.tools.read({ path: f.repo, shared_tools: choice })).body;
    assert.equal(keys.mode, 'keys-only'); assert.deepEqual(keys.folder_tools.notes, ["couldn't list folder tools: shared failed second line"]);
  } finally { shared.findSharedProject = original; }
});


test('project listing failure keeps successfully discovered shared rows', async () => {
  const f = await fixture(), shared = require('../lib/shared-tools'), folder = require('../lib/folder-tools');
  const originals = { find: shared.findSharedProject, identity: shared.identityFor, newest: shared.newestCopy, discover: folder.discover };
  shared.findSharedProject = async () => f.repo; shared.identityFor = async () => 'identity'; shared.newestCopy = () => '/copy';
  folder.discover = async () => ({ rows: [{ name: 'shared', source: 'project', status: 'ok' }] });
  try {
    const broken = createProjectTools({ stateDir: path.join(f.root, 'state'), commandAsync: (p, a, o) => a.includes('ls-tree') && a.includes('.wheelchair/tools/') ? Promise.reject(new Error('bad tree')) : f.runner(p, a, o) });
    const result = (await broken.read({ path: f.repo, shared_tools: { repo: 'another/repo', candidates: [f.repo] } })).body;
    assert.equal(result.mode, 'tools'); assert.equal(result.source.document.mcpServers.old.command, 'tool');
    assert.deepEqual(result.folder_tools.rows.map(row => [row.name, row.source]), [['shared', 'shared']]);
    assert.deepEqual(result.folder_tools.notes, ["couldn't list folder tools: bad tree"]);
  } finally { shared.findSharedProject = originals.find; shared.identityFor = originals.identity; shared.newestCopy = originals.newest; folder.discover = originals.discover; }
});


test('literal tool paths do not interpret wildcard folder names', async () => {
  const f = await fixture(), dir = path.join(f.repo, '.wheelchair', 'tools', 'bad[abc]'); await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'tool.json'), JSON.stringify({ name: 'bad[abc]', description: 'bad name', kind: 'server', start: ['node'] }));
  git('-C', f.repo, 'add', '.wheelchair'); git('-C', f.repo, 'commit', '-qm', 'literal'); git('-C', f.repo, 'push', '-q', f.remote, 'main');
  const calls = []; const tools = createProjectTools({ stateDir: path.join(f.root, 'state'), commandAsync: (p, a, o) => { if (a.includes('ls-tree') && a.some(v => v.startsWith('.wheelchair/tools/'))) calls.push(a); return f.runner(p, a, o); } });
  const [row] = (await tools.read({ path: f.repo })).body.folder_tools.rows;
  assert.equal(row.name, 'bad[abc]'); assert.match(row.reason, /name/i); assert.doesNotMatch(row.reason, /missing/i);
  assert.ok(calls.length >= 2); assert.ok(calls.every(args => args.includes('--literal-pathspecs')));
});
test('folder key status and key-only refresh use the selected store', async () => {
  const f = await fixture(), dir = path.join(f.repo, '.wheelchair/tools/demo'); await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'tool.json'), JSON.stringify({ name: 'demo', description: 'Demo', kind: 'script', inputs: {}, run: ['node'], keys: ['TOKEN'] }));
  const plain = path.join(f.repo, '.wheelchair/tools/plain'); await fs.mkdir(plain); await fs.writeFile(path.join(plain, 'tool.json'), JSON.stringify({ name: 'plain', description: 'Plain', kind: 'script', inputs: {}, run: ['node'] }));
  git('-C', f.repo, 'add', '.wheelchair'); git('-C', f.repo, 'commit', '-qm', 'tool'); git('-C', f.repo, 'push', '-q', f.remote, 'main');
  const input = { path: f.repo }, read = (await f.tools.read(input)).body;
  assert.equal(Object.hasOwn(read.folder_tools.rows[1], 'keys'), false); assert.equal(read.folder_tools.rows[0].key_missing, true); assert.deepEqual(read.folder_tools.rows[0].key_lines, ['needs key TOKEN, not set on this machine']); assert.deepEqual(read.key_info[0].tools, ['demo']);
  await f.tools.save({ ...input, token: read.token, tools: null, keys: { TOKEN: 'short' } });
  let status = (await f.tools.keyStatus(input)).body; assert.equal(status.key_revision, 1); assert.equal(status.key_info[0].folder_usable, false); assert.equal(status.source, undefined); assert.deepEqual(Object.keys(status).sort(), ['folder_tools', 'key_info', 'key_revision', 'keys']); assert.ok(status.key_info[0].reason); assert(!JSON.stringify(status).includes('short'));
  const read2 = (await f.tools.read(input)).body;
  await f.tools.save({ ...input, token: read2.token, tools: null, keys: { TOKEN: 'longvalue' } });
  status = (await f.tools.keyStatus(input)).body; assert.deepEqual(status.folder_tools.rows[0].key_lines, ['uses keys: not available to sandboxed Codex, Kimi or Pi']);
  const own = (await f.tools.keyStatus({ ...input, shared_tools: { repo: 'OWNER/NAME', candidates: [] } })).body;
  assert.equal(own.folder_tools.rows[0].key_store, 'shared'); assert.equal(own.folder_tools.rows[0].key_lines[0], 'needs key TOKEN, not set on this machine; set it in Settings, Shared tools, Shared keys'); assert.deepEqual(own.key_info[0].tools, []);
  await require('../lib/shared-keys').writeSharedKeys(path.join(f.root, 'state'), { set: { TOKEN: 'sharedvalue' } });
  const shared = (await f.tools.keyStatus({ ...input, shared_tools: { repo: 'owner/name', candidates: [] } })).body; assert.equal(shared.folder_tools.rows[0].key_missing, false);
});
