'use strict';
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
  await fs.writeFile(path.join(bin, 'gh'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$TEST_GH_LOG"\nif [ "$1 $2" = "pr list" ]; then printf "%s\\n" "${TEST_GH_LIST:-[]}"; else if [ "${TEST_GH_FAIL:-}" = 1 ]; then echo failed >&2; exit 1; fi; echo https://github.com/owner/name/pull/1; fi\n', { mode: 0o755 });
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, GIT_CONFIG_GLOBAL: config, TEST_GH_LOG: log };
  const runner = (program, args, options) => commandAsync(program, args, { ...options, env: { ...options.env, ...env } });
  return { root, repo, remote, log, env, runner, tools: createProjectTools({ commandAsync: runner, stateDir: path.join(root, 'state') }) };
}
test('reading from remote default branch via a private ref with FETCH_HEAD and tags untouched', async () => {
  const f = await fixture(); const fetchHead = path.join(f.repo, '.git', 'FETCH_HEAD'); await fs.writeFile(fetchHead, 'unchanged');
  const result = await f.tools.read({ path: f.repo }); assert.equal(result.body.mode, 'tools'); assert.equal(result.body.source.document.mcpServers.old.command, 'tool');
  assert.equal(await fs.readFile(fetchHead, 'utf8'), 'unchanged'); assert.equal(git('-C', f.repo, 'for-each-ref', '--format=%(refname)', 'refs/wheelchair/tools', 'refs/tags'), '');
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
  const service = new MachineService({ stateDir: path.join(f.root, 'state') }); service.projectTools = createProjectTools({ commandAsync: runner, stateDir: service.stateDir }); service.authorize = async () => {};
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
  await fs.writeFile(path.join(f.root, 'bin', 'gh'), '#!/bin/sh\nif [ "$1 $2" = "pr list" ]; then echo "[]"; else echo "Creating pull request"; echo "https://github.com/owner/name/pull/42"; fi\n', { mode: 0o755 });
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
  const service = new MachineService({ stateDir: path.join(f.root, 'state') }); service.projectTools = f.tools; service.authorize = async () => {};
  const server = http.createServer((req, res) => service.handle(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const post = async (action, input) => { const response = await fetch(`http://127.0.0.1:${server.address().port}/v1/project-tools/${action}`, { method: 'POST', body: JSON.stringify(input) }); return { status: response.status, body: await response.json() }; };
  return { post, close: () => new Promise(resolve => server.close(resolve)) };
}
test('concurrent route saves on one project serialize PR creation', async () => {
  const f = await fixture();
  await fs.writeFile(path.join(f.root, 'bin', 'gh'), '#!/bin/sh\nif [ "$1 $2" = "pr list" ]; then echo "[]"; else echo start >> "$TEST_GH_LOG"; sleep 1; echo end >> "$TEST_GH_LOG"; echo https://github.com/owner/name/pull/1; fi\n', { mode: 0o755 });
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
  await fs.writeFile(path.join(f.repo, '.git', 'hooks', 'post-checkout'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
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
  await fs.writeFile(path.join(f.root, 'bin', 'systemd-run'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  await fs.writeFile(path.join(f.root, 'bin', 'tmux'), '#!/bin/sh\nif [ "$1" = capture-pane ]; then printf "auto mode on\\n❯ Ready\\n"; fi\n', { mode: 0o755 });
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
      const instance = new MachineService({ stateDir: state, host: '127.0.0.1', port: 0 });
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
