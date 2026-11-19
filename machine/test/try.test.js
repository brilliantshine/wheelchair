'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { TryService } = require('../lib/try');
const service = new TryService({ stateDir: '/tmp/state', root: '/tmp/root', projects: async () => ({ checked: { ok: true } }) });
test('validates all actions and their fields', async () => {
  const base = { thread_id: '0123456789ab', project: '/tmp' };
  for (const input of [{ ...base, action: 'bad' }, { ...base, action: 'try', thread_id: 'bad' }, { ...base, action: 'back' }, { ...base, action: 'forget', version: 'v' }, { ...base, action: 'try', kept: 'x' }]) {
    await assert.rejects(service.handle(input), { status: 422 });
  }
  for (const action of ['forget']) {
    const answer = await service.handle({ ...base, action, version: 'v', ...(action === 'forget' ? { kept: 'ref' } : {}) });
    assert.equal(answer.reason, 'Not built yet');
  }
});
test('record and protected list use the real folder hash and version every write', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path');
  const { makeTemp } = require('../../test-support/run-dir');
  const root = await makeTemp('try-record-'); const instance = new TryService({ stateDir: root, root, projects: async () => ({ checked: { ok: true } }) });
  const folder = path.join(root, 'copy'); await fs.mkdir(folder);
  const record = await instance.read(folder); await instance.write(folder, record); const first = record.version;
  await instance.write(folder, record); assert.notEqual(record.version, first);
  await instance.writeProtected(folder, Buffer.from('ignored\0'));
  assert.equal((await fs.readFile(instance.protectedPath(folder))).toString(), 'ignored\0');
  assert.deepEqual(await instance.read(folder), record);
});
test('lock is keyed by real folder path and advances its generation', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const { makeTemp } = require('../../test-support/run-dir');
  const root = await makeTemp('try-lock-'); const folder = path.join(root, 'copy'); const alias = path.join(root, 'alias');
  await fs.mkdir(folder); await fs.symlink(folder, alias);
  assert.equal(service.folder(alias), service.folder(folder));
  assert.equal(service.acquire(folder), true); assert.equal(service.acquire(service.folder(alias)), false);
  assert.equal(service.lockState(folder).generation, 1); service.release(folder); assert.equal(service.lockState(folder).generation, 2);
});
test('git runner uses a deadline and reports killed', async () => {
  const { makeTemp } = require('../../test-support/run-dir'); const fs = require('node:fs/promises'); const path = require('node:path');
  const root = await makeTemp('try-runner-'); const git = path.join(root, 'git');
  await fs.writeFile(git, '#!/bin/sh\nexec sleep 5\n', { mode: 0o755 });
  const runner = new TryService({ stateDir: root, root, projects: null, gitExecutable: git, killGrace: 50 });
  const result = await runner.runGit(root, [], 80); assert.equal(result.code, 'killed');
});
test('outcome table honors only git removal warning lines', () => {
  const from = { branch: 'refs/heads/main', sha: 'a' }, to = { branch: null, sha: 'b' };
  const result = (code, stderr = '') => ({ code, stderr: Buffer.from(stderr) });
  assert.equal(service.judge(from, to, to, [], result(0)), 'success');
  assert.equal(service.judge(from, to, to, [], result(1, 'error: hook')), 'warning');
  assert.equal(service.judge(from, to, to, [], result(0, "warning: unable to unlink 'file'")), 'interrupted');
  assert.equal(service.judge(from, to, to, [], result(0, "subject warning: unable to unlink 'file'")), 'success');
  assert.equal(service.judge(from, to, from, [], result('killed')), 'nothing-moved');
});
test('protected filter excludes exact untracked paths only', async () => {
  const { makeTemp } = require('../../test-support/run-dir'); const root = await makeTemp('try-protected-');
  const instance = new TryService({ stateDir: root, root, projects: null });
  await instance.writeProtected(root, Buffer.from('ignored/a\0'));
  const entries = [{ path: 'ignored/a', untracked: true }, { path: 'ignored/a', untracked: false }, { path: 'ignored/b', untracked: true }];
  assert.deepEqual(await instance.filtered(root, entries), entries.slice(1));
});
test('folder checks reject service root, worktrees and operations in progress', async () => {
  const { makeTemp } = require('../../test-support/run-dir'); const fs = require('node:fs/promises'); const path = require('node:path'); const { spawnSync } = require('node:child_process');
  const root = await makeTemp('try-check-'); const repo = path.join(root, 'repo'); await fs.mkdir(repo);
  assert.equal(spawnSync('git', ['init', repo]).status, 0);
  const instance = new TryService({ stateDir: path.join(root, 'state'), root: path.join(repo, 'wheelchair'), projects: null });
  const record = await instance.read(repo);
  assert.match(await instance.folderCheck(repo, record), /runs wheelchair/);
  instance.root = path.join(root, 'outside'); await fs.writeFile(path.join(repo, '.git', 'rebase-apply'), 'in progress');
  assert.match(await instance.folderCheck(repo, record), /operation in progress/);
});
test('Status on a repo with an LFS filter runs no filter; pending is interrupted after reload', async () => {
  const { makeTemp } = require('../../test-support/run-dir'); const fs = require('node:fs/promises'); const path = require('node:path'); const { spawnSync } = require('node:child_process');
  const root = await makeTemp('try-status-'); const repo = path.join(root, 'repo'); await fs.mkdir(repo);
  const git = (...args) => { const r = spawnSync('git', ['-C', repo, ...args]); assert.equal(r.status, 0, r.stderr.toString()); };
  git('init'); git('config', 'user.email', 'test@example.com'); git('config', 'user.name', 'Test');
  const log = path.join(root, 'filter-log'); git('config', 'filter.lfs.smudge', `echo hit >> '${log}'; cat`);
  await fs.writeFile(path.join(repo, 'file'), 'data'); git('add', 'file'); git('commit', '-m', 'base');
  const instance = new TryService({ stateDir: path.join(root, 'state'), root: path.join(root, 'other'), projects: async () => ({ checked: { ok: true } }) });
  const record = await instance.read(repo); record.identity = await instance.identity(repo); record.pending = { from: await instance.head(repo), files: ['file'], thread_id: '0123456789ab' }; await instance.write(repo, record);
  const status = await instance.handle({ action: 'status', project: repo, thread_id: '0123456789ab' });
  assert.equal(status.state, 'interrupted'); assert.deepEqual(status.files, ['file']); await assert.rejects(fs.access(log));
});
async function tryFixture() {
  const { makeTemp } = require('../../test-support/run-dir'); const fs = require('node:fs/promises'); const path = require('node:path'); const { spawnSync } = require('node:child_process');
  const root = await makeTemp('try-fixture-'); const repo = path.join(root, 'repo'); await fs.mkdir(repo);
  const git = (...args) => { const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  git('init', '-b', 'main'); git('config', 'user.email', 'test@example.com'); git('config', 'user.name', 'Test');
  await fs.writeFile(path.join(repo, 'file'), 'base\n'); git('add', 'file'); git('commit', '-m', 'base');
  git('switch', '-c', 'wc/0123456789ab'); await fs.writeFile(path.join(repo, 'file'), 'thread\n'); git('commit', '-am', 'thread'); git('switch', 'main');
  const instance = new TryService({ stateDir: path.join(root, 'state'), root: path.join(root, 'wheelchair'), projects: async () => ({ checked: { ok: true } }) });
  const request = { action: 'try', project: repo, thread_id: '0123456789ab' };
  const done = async () => { for (let i = 0; i < 200; i++) { const status = await instance.handle({ ...request, action: 'status' }); if (status.state !== 'busy') return status; await new Promise(resolve => setTimeout(resolve, 20)); } throw new Error('switch did not finish'); };
  return { root, repo, git, instance, request, done };
}
test('try from a clean branch acknowledges, switches and remembers the return point', async () => {
  const f = await tryFixture(); const initial = f.git('rev-parse', 'HEAD');
  const answer = await f.instance.handle(f.request); assert.equal(answer.accepted, true); assert.equal(answer.status.state, 'busy');
  const status = await f.done(); assert.equal(status.state, 'trying-this'); assert.equal(status.last.outcome, 'success');
  const record = await f.instance.read(f.repo); assert.equal(record.active.return_point.sha, initial); assert.equal(f.git('rev-parse', record.active.return_ref), initial);
  assert.equal((await f.instance.handle(f.request)).reason, 'Already showing the newest');
});
test('a dirty first Try answers accepted then writes last as refused with the files', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  await fs.writeFile(path.join(f.repo, 'new file'), 'mine'); f.git('config', 'status.showUntrackedFiles', 'no');
  assert.equal((await f.instance.handle(f.request)).accepted, true);
  const status = await f.done(); assert.equal(status.state, 'none'); assert.equal(status.last.outcome, 'refused'); assert.deepEqual(status.last.files, ['new file']);
});
test('try A, then B at the same sha updates the record without running git switch', async () => {
  const f = await tryFixture(); assert.equal((await f.instance.handle(f.request)).accepted, true); await f.done();
  f.git('branch', 'wc/abcdefabcdef', 'wc/0123456789ab');
  const original = f.instance.runGit.bind(f.instance); let switches = 0;
  f.instance.runGit = (folder, args, timeout) => { if (args.includes('switch')) switches++; return original(folder, args, timeout); };
  assert.equal((await f.instance.handle({ ...f.request, thread_id: 'abcdefabcdef' })).accepted, true);
  const status = await f.done(); assert.equal(status.active_thread_id, 'abcdefabcdef'); assert.equal(switches, 0);
});
test('commit made while trying is pinned and listed; stale record refuses Try', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  await f.instance.handle(f.request); await f.done(); await fs.writeFile(path.join(f.repo, 'file'), 'my commit'); f.git('commit', '-am', 'my commit');
  const mine = f.git('rev-parse', 'HEAD'); await f.instance.handle(f.request); const status = await f.done();
  assert.equal(status.kept.length, 1); assert.equal(f.git('rev-parse', status.kept[0].ref), mine); assert.equal(status.kept[0].missing, false);
  f.git('switch', 'main'); assert.match((await f.instance.handle(f.request)).reason, /switched your copy by hand/);
});
test('Try refused while pending or index.lock exists; index.lock is reported and retained', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  const lock = path.join(f.repo, '.git', 'index.lock'); await fs.writeFile(lock, '');
  const refused = await f.instance.handle(f.request); assert.match(refused.reason, /Git may still be running/); assert.equal(refused.status.index_lock, lock); await fs.access(lock);
  const record = await f.instance.read(f.repo); record.identity = await f.instance.identity(f.repo); record.pending = { from: await f.instance.head(f.repo), thread_id: f.request.thread_id }; await f.instance.write(f.repo, record);
  assert.match((await f.instance.handle(f.request)).reason, /interrupted/);
});
test('post-checkout hook exiting nonzero or printing error follows its exit code', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path');
  for (const code of [0, 1]) {
    const f = await tryFixture(); await fs.writeFile(path.join(f.repo, '.git', 'hooks', 'post-checkout'), `#!/bin/sh\necho 'error: hook text' >&2\nexit ${code}\n`, { mode: 0o755 });
    await f.instance.handle(f.request); const status = await f.done(); assert.equal(status.last.outcome, code ? 'warning' : 'success');
  }
});
test('gitlink change with diff.ignoreSubmodules=all is refused', async () => {
  const f = await tryFixture(); const sha = f.git('rev-parse', 'wc/0123456789ab');
  f.git('switch', 'wc/0123456789ab'); f.git('update-index', '--add', '--cacheinfo', `160000,${sha},sub`); f.git('commit', '-m', 'gitlink'); f.git('switch', 'main'); f.git('config', 'diff.ignoreSubmodules', 'all');
  await f.instance.handle(f.request); const status = await f.done(); assert.equal(status.last.outcome, 'refused'); assert.match(status.last.reason, /submodule/);
});
test('a second write while one runs refuses at once and Status hides index.lock', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  await fs.writeFile(path.join(f.repo, '.git', 'hooks', 'post-checkout'), '#!/bin/sh\nsleep 1\n', { mode: 0o755 });
  assert.equal((await f.instance.handle(f.request)).accepted, true); const second = await f.instance.handle(f.request);
  assert.equal(second.reason, 'A switch is already running'); assert.equal(second.status.state, 'busy'); assert.equal(second.status.index_lock, null);
  const status = await f.done(); assert.equal(status.last.outcome, 'success');
});
test('ignored file in the way stays nothing moved with its path listed and file intact', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  f.git('switch', 'wc/0123456789ab'); await fs.writeFile(path.join(f.repo, 'collision'), 'thread'); f.git('add', 'collision'); f.git('commit', '-m', 'add collision'); f.git('switch', 'main');
  await fs.writeFile(path.join(f.repo, '.git', 'info', 'exclude'), 'collision\n'); await fs.writeFile(path.join(f.repo, 'collision'), 'mine');
  await f.instance.handle(f.request); const status = await f.done(); assert.equal(status.last.outcome, 'nothing-moved'); assert.match(status.last.reason, /collision/); assert.equal(await fs.readFile(path.join(f.repo, 'collision'), 'utf8'), 'mine');
});
test('a pre-switch scan timing out writes refused in last with no pending', async () => {
  const f = await tryFixture(); const original = f.instance.runGit.bind(f.instance);
  f.instance.runGit = (folder, args, timeout) => args.includes('status') ? Promise.resolve({ code: 'killed', stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }) : original(folder, args, timeout);
  await f.instance.handle(f.request); const status = await f.done(); assert.equal(status.last.outcome, 'refused'); assert.match(status.last.reason, /too long/); assert.equal((await f.instance.read(f.repo)).pending, null);
});
test('Status lock generation check does not publish interruption across a switch', async () => {
  const f = await tryFixture(); const record = await f.instance.read(f.repo); record.identity = await f.instance.identity(f.repo); record.pending = { from: await f.instance.head(f.repo) }; await f.instance.write(f.repo, record);
  const read = f.instance.read.bind(f.instance); f.instance.read = async folder => { const value = await read(folder); f.instance.acquire(folder); f.instance.release(folder); return value; };
  assert.equal((await f.instance.handle({ ...f.request, action: 'status' })).state, 'busy');
});
test('tracked and staged rename changes are listed and untouched', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  f.git('mv', 'file', 'renamed'); await fs.writeFile(path.join(f.repo, 'renamed'), 'mine');
  await f.instance.handle(f.request); const status = await f.done(); assert.equal(status.last.outcome, 'refused'); assert.deepEqual(status.last.files.sort(), ['file', 'renamed']); assert.equal(await fs.readFile(path.join(f.repo, 'renamed'), 'utf8'), 'mine');
});
test('Status for the wheelchair clone returns refused', async () => {
  const path = require('node:path'); const f = await tryFixture(); f.instance.root = path.join(f.repo, 'wheelchair');
  const status = await f.instance.handle({ ...f.request, action: 'status' }); assert.match(status.refused, /runs wheelchair itself/);
});
test('POST /v1/try requires the hub secret and validates inputs', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const http = require('node:http'); const { MachineService } = require('../service');
  const f = await tryFixture(); const secret = path.join(f.root, 'secret'); await fs.writeFile(secret, 'correct-secret');
  const machine = new MachineService({ stateDir: path.join(f.root, 'state') }); machine.config.secret_file = secret;
  const server = http.createServer((req, res) => machine.handle(req, res)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const call = async (body, headers = {}) => fetch(`http://127.0.0.1:${server.address().port}/v1/try`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    assert.equal((await call(f.request, { 'x-wheelchair-session-token': 'bad' })).status, 401);
    const headers = { 'x-wheelchair-machine-secret': 'correct-secret' };
    assert.equal((await call({ ...f.request, thread_id: 'bad' }, headers)).status, 422);
    const response = await call({ ...f.request, action: 'status' }, headers); assert.equal(response.status, 200); assert.equal((await response.json()).target_available, true);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('required smudge filter failing on a first Try records interruption across reload', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  f.git('switch', 'wc/0123456789ab'); await fs.writeFile(path.join(f.repo, '.gitattributes'), 'file filter=broken\n'); f.git('add', '.gitattributes'); f.git('commit', '-m', 'require filter'); f.git('switch', 'main');
  f.git('config', 'filter.broken.smudge', 'exit 1'); f.git('config', 'filter.broken.required', 'true');
  await f.instance.handle(f.request); const status = await f.done(); assert.equal(status.state, 'interrupted'); assert.equal(status.last.outcome, 'interrupted');
  const reload = new TryService({ stateDir: f.instance.stateDir, root: f.instance.root, projects: f.instance.projects });
  const again = await reload.handle({ ...f.request, action: 'status' }); assert.equal(again.state, 'interrupted'); assert.ok(again.earlier_branch);
});
test('folder replaced during a trial shows identity mismatch', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  await f.instance.handle(f.request); await f.done();
  await fs.rename(path.join(f.repo, '.git'), path.join(f.repo, '.git-original'));
  const { spawnSync } = require('node:child_process'); const other = path.join(f.root, 'replacement'); assert.equal(spawnSync('git', ['init', other]).status, 0);
  await fs.writeFile(path.join(f.repo, '.git'), `gitdir: ${path.join(other, '.git')}\n`);
  const status = await f.instance.handle({ ...f.request, action: 'status' }); assert.equal(status.state, 'mismatch'); assert.match(status.refused, /no longer the copy/);
});
test('same thread target advances and Status offers newest', async () => {
  const f = await tryFixture(); await f.instance.handle(f.request); await f.done();
  const target = f.git('rev-parse', 'wc/0123456789ab'); const tree = f.git('rev-parse', `${target}^{tree}`);
  const { spawnSync } = require('node:child_process'); const commit = spawnSync('git', ['-C', f.repo, 'commit-tree', tree, '-p', target, '-m', 'newest'], { encoding: 'utf8' }); assert.equal(commit.status, 0, commit.stderr);
  f.git('update-ref', 'refs/heads/wc/0123456789ab', commit.stdout.trim());
  assert.equal((await f.instance.handle({ ...f.request, action: 'status' })).newest, true);
  await f.instance.handle(f.request); assert.equal((await f.done()).active_commit, commit.stdout.trim());
});
test('metadata calls are asynchronous and Status remains bounded when Git hangs', async () => {
  const { makeTemp } = require('../../test-support/run-dir'); const fs = require('node:fs/promises'); const path = require('node:path');
  const root = await makeTemp('try-metadata-'); const executable = path.join(root, 'git');
  await fs.writeFile(executable, '#!/bin/sh\nexec sleep 10\n', { mode: 0o755 });
  const instance = new TryService({ stateDir: path.join(root, 'state'), root: path.join(root, 'other'), projects: async () => ({ checked: { ok: true } }), gitExecutable: executable });
  let ticked = false; setTimeout(() => { ticked = true; }, 50);
  const start = Date.now(); await instance.handle({ action: 'status', project: root, thread_id: '0123456789ab' });
  assert.equal(ticked, true); assert.ok(Date.now() - start < 4500);
});
test('try from a clean branch and back', async () => {
  const f = await tryFixture(); await f.instance.handle(f.request); const trial = await f.done();
  const reply = await f.instance.handle({ ...f.request, action: 'back', version: trial.version }); assert.equal(reply.accepted, true);
  const result = await f.done(); assert.equal(result.state, 'none'); assert.equal(result.last.outcome, 'success'); assert.equal(f.git('branch', '--show-current'), 'main');
});
test('from a detached start and back', async () => {
  const f = await tryFixture(); const sha = f.git('rev-parse', 'HEAD'); f.git('switch', '--detach', sha);
  await f.instance.handle(f.request); const trial = await f.done(); await f.instance.handle({ ...f.request, action: 'back', version: trial.version });
  const result = await f.done(); assert.equal(result.last.outcome, 'success'); assert.equal(f.git('rev-parse', 'HEAD'), sha); assert.equal(f.git('branch', '--show-current'), '');
});
test('back refused when files changed while trying, listing them, nothing deleted', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  await f.instance.handle(f.request); const trial = await f.done(); await fs.writeFile(path.join(f.repo, 'mine'), 'mine');
  await f.instance.handle({ ...f.request, action: 'back', version: trial.version }); const result = await f.done();
  assert.equal(result.last.outcome, 'refused'); assert.deepEqual(result.last.files, ['mine']); assert.equal(await fs.readFile(path.join(f.repo, 'mine'), 'utf8'), 'mine');
});
test('back after the return branch advanced', async () => {
  const f = await tryFixture(); await f.instance.handle(f.request); const trial = await f.done();
  const old = f.git('rev-parse', 'main'); const tree = f.git('rev-parse', `${old}^{tree}`); const { spawnSync } = require('node:child_process');
  const commit = spawnSync('git', ['-C', f.repo, 'commit-tree', tree, '-p', old, '-m', 'advanced'], { encoding: 'utf8' }); assert.equal(commit.status, 0); f.git('update-ref', 'refs/heads/main', commit.stdout.trim());
  await f.instance.handle({ ...f.request, action: 'back', version: trial.version }); const result = await f.done(); assert.equal(result.last.outcome, 'success'); assert.equal(f.git('rev-parse', 'HEAD'), commit.stdout.trim());
});
test('Done refused while index.lock exists', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture(); await f.instance.handle(f.request); const trial = await f.done();
  await fs.writeFile(path.join(f.repo, '.git', 'index.lock'), ''); const answer = await f.instance.handle({ ...f.request, action: 'dismiss', version: trial.version }); assert.match(answer.reason, /Git may still be running/); assert.equal(answer.status.version, trial.version);
});
test('Done after an interrupted Try with HEAD at the target keeps Switch back', async () => {
  const f = await tryFixture(); await f.instance.handle(f.request); const trial = await f.done(); const record = await f.instance.read(f.repo);
  record.pending = { op: 'try', first: true, thread_id: f.request.thread_id, from: record.active.return_point, to: { branch: null, sha: record.active.commit }, return_point: record.active.return_point, return_ref: record.active.return_ref }; record.active = null; await f.instance.write(f.repo, record);
  const answer = await f.instance.handle({ ...f.request, action: 'dismiss', version: record.version }); assert.equal(answer.ok, true); assert.equal(answer.status.state, 'trying-this'); assert.deepEqual(answer.status.last, trial.last);
});
test('Done after an interrupted Back with HEAD at the return branch counts as success', async () => {
  const f = await tryFixture(); await f.instance.handle(f.request); await f.done(); const record = await f.instance.read(f.repo); const from = await f.instance.head(f.repo);
  f.git('switch', 'main'); record.pending = { op: 'back', from, to: await f.instance.head(f.repo) }; await f.instance.write(f.repo, record);
  const answer = await f.instance.handle({ ...f.request, action: 'dismiss', version: record.version }); assert.equal(answer.ok, true); assert.equal(answer.status.state, 'none'); assert.equal(await f.instance.resolveRef(f.repo, record.active.return_ref), null);
});
