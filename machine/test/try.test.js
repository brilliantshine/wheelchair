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
test('first Try allows a slow ignored-files scan beyond the metadata deadline', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  const wrapper = path.join(f.root, 'git-wrapper');
  await fs.writeFile(wrapper, '#!/bin/sh\ncase "$*" in *"ls-files -z --others --ignored"*) sleep 2;; esac\nexec git "$@"\n', { mode: 0o755 });
  f.instance.gitExecutable = wrapper; f.instance.metadataTimeout = 1000;
  assert.equal((await f.instance.handle(f.request)).accepted, true);
  const result = await f.done(); assert.equal(result.state, 'trying-this'); assert.equal(result.last.outcome, 'success');
});
test('metadata timeout in folder check is reported as a timeout', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  const wrapper = path.join(f.root, 'git-wrapper');
  await fs.writeFile(wrapper, '#!/bin/sh\ncase "$*" in *"ls-files -u"*) sleep 2;; esac\nexec git "$@"\n', { mode: 0o755 });
  f.instance.gitExecutable = wrapper; f.instance.metadataTimeout = 100;
  const status = await f.instance.handle({ ...f.request, action: 'status' }); assert.equal(status.refused, 'Git did not answer in time. Try again.');
  const reply = await f.instance.handle(f.request); assert.equal(reply.accepted, false); assert.equal(reply.reason, status.refused);
});
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
  const marker = path.join(f.root, 'hook-started'); await fs.writeFile(path.join(f.repo, '.git', 'hooks', 'post-checkout'), `#!/bin/sh\ntouch '${marker}'\nsleep 1\n`, { mode: 0o755 });
  assert.equal((await f.instance.handle(f.request)).accepted, true);
  for (let i = 0; i < 200 && !require('node:fs').existsSync(marker); i++) await new Promise(resolve => setTimeout(resolve, 10)); await fs.access(marker);
  const lock = path.join(f.repo, '.git', 'index.lock'); await fs.writeFile(lock, ''); const second = await f.instance.handle(f.request);
  assert.equal(second.reason, 'A switch is already running'); assert.equal(second.status.state, 'busy'); assert.equal(second.status.index_lock, null);
  await fs.unlink(lock);
  const status = await f.done(); assert.equal(status.last.outcome, 'success');
});
test('ignored file in the way stays nothing moved with its path listed and file intact', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  f.git('switch', 'wc/0123456789ab'); await fs.writeFile(path.join(f.repo, 'collision'), 'thread'); f.git('add', 'collision'); f.git('commit', '-m', 'add collision'); f.git('switch', 'main');
  await fs.writeFile(path.join(f.repo, '.git', 'info', 'exclude'), 'collision\n'); await fs.writeFile(path.join(f.repo, 'collision'), 'mine');
  await f.instance.handle(f.request); const status = await f.done(); assert.equal(status.last.outcome, 'nothing-moved'); assert.equal(status.last.reason, 'These files in your copy are in the way: collision'); assert.equal(await fs.readFile(path.join(f.repo, 'collision'), 'utf8'), 'mine');
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
test('Forget during an interrupted switch leaves pending, active and the return pin and last', async () => {
  const f = await tryFixture(); await f.instance.handle(f.request); await f.done(); const record = await f.instance.read(f.repo);
  const ref = 'refs/wheelchair/kept/test/01234567'; f.git('update-ref', ref, record.active.commit); record.kept.push({ ref, label: 'test', thread_id: f.request.thread_id, at: new Date().toISOString() });
  record.pending = { op: 'back', from: await f.instance.head(f.repo), to: record.active.return_point }; await f.instance.write(f.repo, record);
  const answer = await f.instance.handle({ ...f.request, action: 'forget', version: record.version, kept: ref }); assert.equal(answer.ok, true);
  const next = await f.instance.read(f.repo); assert.deepEqual(next.active, record.active); assert.deepEqual(next.pending, record.pending); assert.deepEqual(next.last, record.last); assert.equal(f.git('rev-parse', next.active.return_ref), next.active.return_point.sha); assert.equal(await f.instance.resolveRef(f.repo, ref), null);
});
test('try A then B then back to the original branch', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  f.git('switch', '-c', 'wc/abcdefabcdef'); await fs.writeFile(path.join(f.repo, 'file'), 'second'); f.git('commit', '-am', 'second'); f.git('switch', 'main');
  const a = f.git('rev-parse', 'wc/0123456789ab'), b = f.git('rev-parse', 'wc/abcdefabcdef'); assert.notEqual(a, b);
  await f.instance.handle(f.request); await f.done(); await f.instance.handle({ ...f.request, thread_id: 'abcdefabcdef' }); const trial = await f.done(); assert.equal(trial.active_commit, b);
  await f.instance.handle({ ...f.request, action: 'back', version: trial.version }); assert.equal((await f.done()).state, 'none'); assert.equal(f.git('branch', '--show-current'), 'main');
});
test('a thread that removes an ignore rule: file not counted, back succeeds, file intact', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  await fs.writeFile(path.join(f.repo, '.gitignore'), 'ignored\n'); f.git('add', '.gitignore'); f.git('commit', '-m', 'ignore'); await fs.writeFile(path.join(f.repo, 'ignored'), 'mine');
  await f.instance.handle(f.request); const trial = await f.done(); assert.equal(trial.state, 'trying-this');
  await f.instance.handle({ ...f.request, action: 'back', version: trial.version }); const back = await f.done(); assert.equal(back.last.outcome, 'success'); assert.equal(await fs.readFile(path.join(f.repo, 'ignored'), 'utf8'), 'mine');
});
test('files appearing after back are listed', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture(); await f.instance.handle(f.request); const trial = await f.done();
  await fs.writeFile(path.join(f.repo, '.git', 'hooks', 'post-checkout'), '#!/bin/sh\necho hello > appeared\n', { mode: 0o755 });
  await f.instance.handle({ ...f.request, action: 'back', version: trial.version }); const result = await f.done(); assert.deepEqual(result.last.appeared, ['appeared']); assert.equal(result.last.appeared_count, 1); assert.equal(result.last.files, undefined);
});
test('a file untracked before and after Back is not in appeared', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  await fs.writeFile(path.join(f.repo, '.git', 'info', 'exclude'), 'ignored\n'); await fs.writeFile(path.join(f.repo, 'ignored'), 'mine');
  await f.instance.handle(f.request); const trial = await f.done();
  await fs.writeFile(path.join(f.repo, '.git', 'info', 'exclude'), ''); assert.match(f.git('status', '--porcelain'), /\?\? ignored/);
  await f.instance.handle({ ...f.request, action: 'back', version: trial.version }); const result = await f.done(); assert.deepEqual(result.last.appeared, []); assert.match(f.git('status', '--porcelain'), /\?\? ignored/);
});
test('a new file in an originally ignored directory whose rule the thread removed is listed on Back', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  await fs.writeFile(path.join(f.repo, '.gitignore'), 'ignored/\n'); f.git('add', '.gitignore'); f.git('commit', '-m', 'ignore'); await fs.mkdir(path.join(f.repo, 'ignored')); await fs.writeFile(path.join(f.repo, 'ignored', 'old'), 'old');
  await f.instance.handle(f.request); const trial = await f.done(); await fs.writeFile(path.join(f.repo, 'ignored', 'new'), 'new');
  await f.instance.handle({ ...f.request, action: 'back', version: trial.version }); const result = await f.done(); assert.equal(result.last.outcome, 'refused'); assert.deepEqual(result.last.files, ['ignored/new']);
});
test('Back refused while pending is set', async () => {
  const f = await tryFixture(); await f.instance.handle(f.request); await f.done(); const record = await f.instance.read(f.repo); record.pending = { op: 'back', from: await f.instance.head(f.repo) }; await f.instance.write(f.repo, record);
  const answer = await f.instance.handle({ ...f.request, action: 'back', version: record.version }); assert.match(answer.reason, /interrupted/);
});
test('after an interrupted move between threads active is kept', async () => {
  const f = await tryFixture(); await f.instance.handle(f.request); await f.done(); const record = await f.instance.read(f.repo); const original = record.active;
  record.pending = { op: 'try', first: false, thread_id: 'abcdefabcdef', from: await f.instance.head(f.repo), to: { branch: null, sha: '0'.repeat(40) } }; await f.instance.write(f.repo, record);
  const answer = await f.instance.handle({ ...f.request, action: 'dismiss', version: record.version }); assert.equal(answer.ok, true); assert.deepEqual((await f.instance.read(f.repo)).active, original);
});
test('return branch deleted or checked out elsewhere is refused', async () => {
  for (const mode of ['deleted', 'checked out']) {
    const path = require('node:path'); const f = await tryFixture(); await f.instance.handle(f.request); const trial = await f.done();
    if (mode === 'deleted') f.git('branch', '-D', 'main'); else f.git('worktree', 'add', path.join(f.root, 'other'), 'main');
    const answer = await f.instance.handle({ ...f.request, action: 'back', version: trial.version }); assert.equal(answer.accepted, false); assert.match(answer.reason, mode === 'deleted' ? /no longer exists/ : /another worktree/);
  }
});
test('stale record: Back refused; Dismiss deletes return pin when its branch contains it, else keeps it', async () => {
  for (const contains of [true, false]) {
    const f = await tryFixture(); await f.instance.handle(f.request); await f.done(); const record = await f.instance.read(f.repo);
    f.git('switch', 'main'); if (!contains) { f.git('switch', '-c', 'other'); f.git('branch', '-D', 'main'); }
    const status = await f.instance.handle({ ...f.request, action: 'status' }); assert.equal(status.state, 'stale');
    assert.match((await f.instance.handle({ ...f.request, action: 'back', version: status.version })).reason, /by hand/);
    const answer = await f.instance.handle({ ...f.request, action: 'dismiss', version: status.version }); assert.equal(answer.ok, true); assert.equal(answer.status.state, 'none'); assert.equal(answer.status.kept.length, contains ? 0 : 1);
    assert.equal(!!await f.instance.resolveRef(f.repo, record.active.return_ref), !contains);
  }
});
test('folder replaced by another clone during a trial: Dismiss keeps entries marked old identity', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture(); await f.instance.handle(f.request); await f.done(); const record = await f.instance.read(f.repo);
  await fs.rename(path.join(f.repo, '.git'), path.join(f.repo, '.git-original')); const { spawnSync } = require('node:child_process'); const other = path.join(f.root, 'replacement'); assert.equal(spawnSync('git', ['init', other]).status, 0); await fs.writeFile(path.join(f.repo, '.git'), `gitdir: ${path.join(other, '.git')}\n`);
  const existing = 'refs/wheelchair/kept/existing'; record.kept.push({ ref: existing, label: 'existing' }); await f.instance.write(f.repo, record);
  const log = path.join(f.root, 'git-calls'); const wrapper = path.join(f.root, 'git-wrapper'); await fs.writeFile(wrapper, `#!/bin/sh\nprintf '%s\\n' "$*" >> '${log}'\nexec git "$@"\n`, { mode: 0o755 }); f.instance.gitExecutable = wrapper;
  const answer = await f.instance.handle({ ...f.request, action: 'dismiss', version: record.version }); assert.equal(answer.ok, true); assert.deepEqual(answer.status.kept.map(entry => entry.ref).sort(), [existing, record.active.return_ref].sort()); assert.ok(answer.status.kept.every(entry => entry.old_identity && entry.missing));
  const calls = await fs.readFile(log, 'utf8'); assert.doesNotMatch(calls, /(?:update-ref|merge-base)/);
});
test('stale version on back, dismiss and forget is refused', async () => {
  const f = await tryFixture(); await f.instance.handle(f.request); const status = await f.done();
  for (const action of ['back', 'dismiss', 'forget']) {
    const answer = await f.instance.handle({ ...f.request, action, version: 'old', ...(action === 'forget' ? { kept: 'ref' } : {}) }); assert.equal(answer.reason, 'Your copy changed since this page loaded'); assert.equal(answer.status.version, status.version);
  }
});
test('required smudge filter failing on Back is interrupted, files recorded and no file deleted', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  await fs.writeFile(path.join(f.repo, '.gitattributes'), 'file filter=broken\n'); f.git('add', '.gitattributes'); f.git('commit', '-m', 'require filter');
  await fs.writeFile(path.join(f.repo, '.git', 'info', 'exclude'), 'precious\n'); await fs.writeFile(path.join(f.repo, 'precious'), 'mine');
  await f.instance.handle(f.request); const trial = await f.done(); assert.equal(trial.state, 'trying-this');
  f.git('config', 'filter.broken.smudge', 'exit 1'); f.git('config', 'filter.broken.required', 'true');
  await f.instance.handle({ ...f.request, action: 'back', version: trial.version }); const result = await f.done(); assert.equal(result.state, 'interrupted'); assert.equal(result.last.outcome, 'interrupted'); assert.ok(Array.isArray(result.files)); assert.equal(await fs.readFile(path.join(f.repo, 'precious'), 'utf8'), 'mine');
});
test('re-cloning after a completed Back allows Try', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const { spawnSync } = require('node:child_process'); const f = await tryFixture();
  await f.instance.handle(f.request); const trial = await f.done(); await f.instance.handle({ ...f.request, action: 'back', version: trial.version }); assert.equal((await f.done()).state, 'none');
  await fs.rename(path.join(f.repo, '.git'), path.join(f.root, 'original.git')); const other = path.join(f.root, 'replacement'); assert.equal(spawnSync('git', ['clone', '-q', path.join(f.root, 'original.git'), other]).status, 0);
  assert.equal(spawnSync('git', ['-C', other, 'branch', 'wc/0123456789ab', 'origin/wc/0123456789ab']).status, 0);
  await fs.writeFile(path.join(f.repo, '.git'), `gitdir: ${path.join(other, '.git')}\n`);
  const answer = await f.instance.handle(f.request); assert.equal(answer.accepted, true); assert.equal((await f.done()).state, 'trying-this');
});
test('tracked path colliding with an ignored file on Back is refused with the file intact', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  await fs.writeFile(path.join(f.repo, 'collision'), 'original'); f.git('add', 'collision'); f.git('commit', '-m', 'track collision');
  await f.instance.handle(f.request); const trial = await f.done();
  await fs.writeFile(path.join(f.repo, '.git', 'info', 'exclude'), 'collision\n'); await fs.writeFile(path.join(f.repo, 'collision'), 'mine');
  await f.instance.handle({ ...f.request, action: 'back', version: trial.version }); const result = await f.done();
  assert.equal(result.last.outcome, 'nothing-moved'); assert.equal(result.last.reason, 'These files in your copy are in the way: collision'); assert.equal(await fs.readFile(path.join(f.repo, 'collision'), 'utf8'), 'mine');
});
test('folder under state worktrees is refused', async () => {
  const path = require('node:path'); const f = await tryFixture(); f.instance.stateDir = f.root;
  const fs = require('node:fs/promises'); await fs.mkdir(path.join(f.root, 'worktrees')); const folder = path.join(f.root, 'worktrees', 'copy'); await fs.rename(f.repo, folder);
  const reply = await f.instance.handle({ ...f.request, project: folder }); assert.match(reply.reason, /agent's copy/);
});
test('real git am in progress is refused', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const { spawnSync } = require('node:child_process'); const f = await tryFixture();
  f.git('switch', 'wc/0123456789ab'); await fs.writeFile(path.join(f.repo, 'file'), 'patch\n'); f.git('commit', '-am', 'patch');
  const patchText = f.git('format-patch', '-1', '--stdout'); f.git('switch', 'main'); await fs.writeFile(path.join(f.repo, 'file'), 'conflict\n'); f.git('commit', '-am', 'conflict');
  const patchFile = path.join(f.root, 'change.patch'); await fs.writeFile(patchFile, patchText + '\n'); assert.notEqual(spawnSync('git', ['-C', f.repo, 'am', patchFile]).status, 0);
  assert.equal((await f.instance.handle({ ...f.request, action: 'status' })).refused, 'Git has an operation in progress. Finish it at your computer first.');
  assert.match((await f.instance.handle(f.request)).reason, /operation in progress/);
});
test('a long switch does not delay the same project agent worktree queue', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const { MachineService } = require('../service'); const f = await tryFixture();
  const marker = path.join(f.root, 'hook-started'); await fs.writeFile(path.join(f.repo, '.git', 'hooks', 'post-checkout'), `#!/bin/sh\ntouch '${marker}'\nsleep 2\n`, { mode: 0o755 });
  const machine = new MachineService({ stateDir: path.join(f.root, 'machine') }); await f.instance.handle(f.request);
  for (let i = 0; i < 200 && !require('node:fs').existsSync(marker); i++) await new Promise(resolve => setTimeout(resolve, 10));
  await fs.access(marker); let ran = false; await Promise.race([machine.inRepoQueue(f.repo, async () => { ran = true; }), new Promise((_, reject) => setTimeout(() => reject(new Error('queue delayed')), 500))]);
  assert.equal(ran, true); assert.equal((await f.done()).last.outcome, 'success');
});
test('two symlink spellings of one folder pressed together are refused', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  const one = path.join(f.root, 'one'), two = path.join(f.root, 'two'); await fs.symlink(f.repo, one); await fs.symlink(f.repo, two);
  await fs.writeFile(path.join(f.repo, '.git', 'hooks', 'post-checkout'), '#!/bin/sh\nsleep 1\n', { mode: 0o755 });
  const first = f.instance.handle({ ...f.request, project: one }); const second = f.instance.handle({ ...f.request, project: two });
  const replies = await Promise.all([first, second]); assert.equal(replies.filter(reply => reply.accepted).length, 1); assert.equal(replies.find(reply => !reply.accepted).reason, 'A switch is already running'); await f.done();
});
test('index.lock is shown after nothing moved and hidden while a switch runs', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  f.git('switch', 'wc/0123456789ab'); await fs.writeFile(path.join(f.repo, 'collision'), 'thread'); f.git('add', 'collision'); f.git('commit', '-m', 'collision'); f.git('switch', 'main');
  await fs.writeFile(path.join(f.repo, '.git', 'info', 'exclude'), 'collision\n'); await fs.writeFile(path.join(f.repo, 'collision'), 'mine');
  await f.instance.handle(f.request); assert.equal((await f.done()).last.outcome, 'nothing-moved');
  const lock = path.join(f.repo, '.git', 'index.lock'); await fs.writeFile(lock, ''); const status = await f.instance.handle({ ...f.request, action: 'status' }); assert.equal(status.index_lock, lock); await fs.access(lock);
  f.instance.acquire(f.repo); assert.equal((await f.instance.handle({ ...f.request, action: 'status' })).index_lock, null); f.instance.release(f.repo);
});
test('Status for stale, moved, trying-other and mismatch includes the right fields', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const { spawnSync } = require('node:child_process'); const f = await tryFixture();
  await f.instance.handle(f.request); const trial = await f.done(); const other = await f.instance.handle({ ...f.request, thread_id: 'abcdefabcdef', action: 'status' });
  assert.equal(other.state, 'trying-other'); assert.equal(other.active_thread_id, f.request.thread_id); assert.equal(other.active_commit, trial.active_commit);
  await fs.writeFile(path.join(f.repo, 'file'), 'local commit'); f.git('commit', '-am', 'local'); const moved = await f.instance.handle({ ...f.request, action: 'status' }); assert.equal(moved.state, 'moved'); assert.equal(moved.active_commit, trial.active_commit);
  f.git('switch', 'main'); const stale = await f.instance.handle({ ...f.request, action: 'status' }); assert.equal(stale.state, 'stale'); assert.equal(stale.active_thread_id, f.request.thread_id);
  await fs.rename(path.join(f.repo, '.git'), path.join(f.root, 'old.git')); const replacement = path.join(f.root, 'replacement'); assert.equal(spawnSync('git', ['init', replacement]).status, 0); await fs.writeFile(path.join(f.repo, '.git'), `gitdir: ${path.join(replacement, '.git')}\n`);
  const mismatch = await f.instance.handle({ ...f.request, action: 'status' }); assert.equal(mismatch.state, 'mismatch'); assert.match(mismatch.refused, /no longer the copy/); assert.equal(mismatch.active_thread_id, f.request.thread_id);
});
test('capped file lists retain full files_count and appeared_count', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  for (let i = 0; i < 55; i++) await fs.writeFile(path.join(f.repo, `file-${i}`), 'mine');
  await f.instance.handle(f.request); const refused = await f.done(); assert.equal(refused.last.files_count, 55); assert.equal(refused.last.files.length, 50);
  for (let i = 0; i < 55; i++) await fs.unlink(path.join(f.repo, `file-${i}`));
  await f.instance.handle(f.request); const trial = await f.done();
  await fs.writeFile(path.join(f.repo, '.git', 'hooks', 'post-checkout'), '#!/bin/sh\ni=0; while [ "$i" -lt 55 ]; do touch "appeared-$i"; i=$((i+1)); done\n', { mode: 0o755 });
  await f.instance.handle({ ...f.request, action: 'back', version: trial.version }); const result = await f.done(); assert.equal(result.last.appeared_count, 55); assert.equal(result.last.appeared.length, 50);
});
test('kept entries show missing and old_identity flags', async () => {
  const f = await tryFixture(); const record = await f.instance.read(f.repo); record.kept = [{ ref: 'refs/wheelchair/kept/missing', label: 'missing' }, { ref: 'refs/wheelchair/kept/old', label: 'old', old_identity: true }]; await f.instance.write(f.repo, record);
  const status = await f.instance.handle({ ...f.request, action: 'status' }); assert.deepEqual(status.kept.map(({ missing, old_identity }) => ({ missing, old_identity })), [{ missing: true, old_identity: false }, { missing: true, old_identity: true }]);
});
test('Status runs no content filter while active', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  await f.instance.handle(f.request); await f.done(); const log = path.join(f.root, 'filter-log');
  await fs.writeFile(path.join(f.repo, '.gitattributes'), 'file filter=lfs\n'); f.git('config', 'filter.lfs.clean', `echo clean >> '${log}'; cat`); f.git('config', 'filter.lfs.smudge', `echo smudge >> '${log}'; cat`);
  for (let i = 0; i < 3; i++) assert.equal((await f.instance.handle({ ...f.request, action: 'status' })).state, 'trying-this'); await assert.rejects(fs.access(log));
});
test('required smudge filter failing on a move between threads records exact interrupted paths', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  f.git('switch', '-c', 'wc/abcdefabcdef'); await fs.writeFile(path.join(f.repo, '.gitattributes'), 'file filter=broken\n'); await fs.writeFile(path.join(f.repo, 'file'), 'second\n'); f.git('add', '.gitattributes', 'file'); f.git('commit', '-m', 'second'); f.git('switch', 'main');
  await f.instance.handle(f.request); await f.done(); f.git('config', 'filter.broken.smudge', 'exit 1'); f.git('config', 'filter.broken.required', 'true');
  await f.instance.handle({ ...f.request, thread_id: 'abcdefabcdef' }); const interrupted = await f.done(); assert.equal(interrupted.state, 'interrupted'); assert.deepEqual(interrupted.files, ['file', '.gitattributes']);
  const reload = new TryService({ stateDir: f.instance.stateDir, root: f.instance.root, projects: f.instance.projects }); const again = await reload.handle({ ...f.request, action: 'status' }); assert.deepEqual(again.files, ['file', '.gitattributes']);
});
test('real git switch unable to unlink warning is interrupted', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  const dir = path.join(f.repo, 'locked'); await fs.mkdir(dir); await fs.writeFile(path.join(dir, 'tracked'), 'mine'); f.git('add', 'locked/tracked'); f.git('commit', '-m', 'add tracked');
  await fs.chmod(dir, 0o555);
  try { await f.instance.handle(f.request); const status = await f.done(); assert.equal(status.state, 'interrupted'); assert.equal(status.last.outcome, 'interrupted'); assert.equal(await fs.readFile(path.join(dir, 'tracked'), 'utf8'), 'mine'); }
  finally { await fs.chmod(dir, 0o755); }
});
test('commit subject containing unable to unlink gives plain success', async () => {
  const f = await tryFixture(); f.git('switch', 'wc/0123456789ab'); f.git('commit', '--allow-empty', '-m', "warning: unable to unlink 'file'"); f.git('switch', 'main');
  await f.instance.handle(f.request); assert.equal((await f.done()).last.outcome, 'success');
});
test('hanging filter subprocess outlives deadline and its whole process group is killed', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  f.git('switch', 'wc/0123456789ab'); await fs.writeFile(path.join(f.repo, '.gitattributes'), 'file filter=hang\n'); f.git('add', '.gitattributes'); f.git('commit', '-m', 'filter'); f.git('switch', 'main');
  const pidFile = path.join(f.root, 'child-pid'); const filter = path.join(f.root, 'filter');
  await fs.writeFile(filter, `#!/bin/sh\nsh -c 'trap "" TERM; exec sleep 30' &\necho $! > '${pidFile}'\nwait\n`, { mode: 0o755 }); f.git('config', 'filter.hang.smudge', filter); f.git('config', 'filter.hang.required', 'true');
  f.instance.switchTimeout = 300; f.instance.killGrace = 100; await f.instance.handle(f.request); const result = await f.done();
  const pid = Number((await fs.readFile(pidFile, 'utf8')).trim()); assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  assert.ok(['nothing-moved', 'interrupted'].includes(result.last.outcome));
  if (result.last.outcome === 'nothing-moved') { assert.equal(f.git('branch', '--show-current'), 'main'); assert.equal(f.git('status', '--porcelain'), ''); }
});
test('delayed process filter failing after HEAD moved records files across reload', async () => {
  const fs = require('node:fs/promises'); const path = require('node:path'); const f = await tryFixture();
  f.git('switch', 'wc/0123456789ab'); await fs.writeFile(path.join(f.repo, '.gitattributes'), 'file filter=delay\n'); f.git('add', '.gitattributes'); f.git('commit', '-m', 'delayed filter'); f.git('switch', 'main');
  const filter = path.join(f.root, 'filter.py'); const target = f.git('rev-parse', 'wc/0123456789ab');
  await fs.writeFile(path.join(f.repo, '.git', 'info', 'exclude'), 'precious\n'); await fs.writeFile(path.join(f.repo, 'precious'), 'mine');
  await fs.writeFile(filter, `#!/usr/bin/env python3
import sys, subprocess
r = sys.stdin.buffer
w = sys.stdout.buffer
def read():
    size = r.read(4)
    if not size: return None
    n = int(size, 16)
    return b'' if n == 0 else r.read(n - 4)
def group():
    result = []
    while True:
        item = read()
        if not item: return result
        result.append(item)
def send(*items):
    for item in items:
        w.write(('%04x' % (len(item) + 4)).encode() + item)
    w.write(b'0000'); w.flush()
group(); send(b'git-filter-server\\n', b'version=2\\n')
group(); send(b'capability=smudge\\n', b'capability=delay\\n')
while True:
    headers = group()
    if not headers: break
    if b'command=list_available_blobs\\n' in headers:
        send(b'pathname=file\\n'); send(b'status=success\\n')
    else:
        group()
        if b'can-delay=1\\n' in headers:
            send(b'status=delayed\\n')
            subprocess.run(['git', '-C', ${JSON.stringify(f.repo)}, 'update-ref', '--no-deref', 'HEAD', ${JSON.stringify(target)}], check=True)
        else: send(b'status=error\\n')
`, { mode: 0o755 });
  f.git('config', 'filter.delay.process', filter); f.git('config', 'filter.delay.required', 'true');
  await f.instance.handle(f.request); const result = await f.done();
  assert.equal(f.git('rev-parse', 'HEAD'), target); assert.equal(result.state, 'interrupted'); assert.ok(result.files.includes('file'));
  const reload = new TryService({ stateDir: f.instance.stateDir, root: f.instance.root, projects: f.instance.projects }); assert.deepEqual((await reload.handle({ ...f.request, action: 'status' })).files, result.files); assert.equal(await fs.readFile(path.join(f.repo, 'precious'), 'utf8'), 'mine');
});
