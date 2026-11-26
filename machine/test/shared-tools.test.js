'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { makeTemp } = require('../../test-support/run-dir');
const shared = require('../lib/shared-tools');
const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
async function setup() {
  const dir = await makeTemp('shared-'), bare = path.join(dir, 'origin.git'), source = path.join(dir, 'source'), clone = path.join(dir, 'clone'), stateDir = path.join(dir, 'state');
  execFileSync('git', ['init', '--bare', '--initial-branch=main', bare], { stdio: 'ignore' });
  execFileSync('git', ['clone', bare, source], { stdio: 'ignore' });
  git(source, 'config', 'user.email', 'test@example.com'); git(source, 'config', 'user.name', 'Test');
  await fs.mkdir(path.join(source, '.wheelchair/tools/a'), { recursive: true });
  await fs.writeFile(path.join(source, '.wheelchair/tools/a/tool.json'), 'first');
  git(source, 'add', '.'); git(source, 'commit', '-m', 'first'); git(source, 'push', 'origin', 'main');
  execFileSync('git', ['clone', bare, clone], { stdio: 'ignore' });
  git(clone, 'remote', 'set-url', 'origin', 'https://github.com/Owner/Repo.git');
  git(clone, 'config', `url.file://${bare}.insteadOf`, 'https://github.com/Owner/Repo.git');
  return { dir, bare, source, clone, stateDir };
}
async function next(s, content) { await fs.writeFile(path.join(s.source, '.wheelchair/tools/a/tool.json'), content); git(s.source, 'add', '.'); git(s.source, 'commit', '-m', content); git(s.source, 'push', 'origin', 'main'); }

test('finds first matching repository and skips missing and unrelated candidates', async () => {
  const s = await setup(); const other = path.join(s.dir, 'other'); await fs.mkdir(other);
  assert.equal(await shared.findSharedProject('owner/repo', [other, path.join(s.dir, 'missing'), s.clone, s.source]), s.clone);
  assert.equal(await shared.findSharedProject('else/repo', [s.clone]), null);
});

test('refresh preserves clone, publishes read-only copies, records outcomes and cleans old copies', async () => {
  const s = await setup(); const file = path.join(s.clone, '.wheelchair/tools/a/tool.json');
  await fs.writeFile(file, 'local change'); git(s.clone, 'add', file); await fs.writeFile(file, 'unstaged');
  const before = [git(s.clone, 'status', '--porcelain=v1'), git(s.clone, 'diff', '--cached'), git(s.clone, 'rev-parse', 'HEAD')];
  const first = await shared.refreshShared({ stateDir: s.stateDir, projectPath: s.clone }); assert.equal(first.error, null);
  const copied = path.join(first.copy, '.wheelchair/tools/a/tool.json'); assert.equal(await fs.readFile(copied, 'utf8'), 'first');
  assert.equal((await fs.stat(copied)).mode & 0o777, 0o444); assert.equal((await fs.stat(first.copy)).mode & 0o777, 0o555);
  if (process.getuid?.() !== 0) await assert.rejects(fs.writeFile(copied, 'bad'), { code: 'EACCES' });
  assert.deepEqual([git(s.clone, 'status', '--porcelain=v1'), git(s.clone, 'diff', '--cached'), git(s.clone, 'rev-parse', 'HEAD')], before);
  await next(s, 'second'); const second = await shared.refreshShared({ stateDir: s.stateDir, projectPath: s.clone }); assert.equal(second.error, null); assert.notEqual(first.copy, second.copy); assert.equal(shared.newestCopy(s.stateDir, first.identity), second.copy);
  assert.equal(await fs.readFile(copied, 'utf8'), 'first');
  await next(s, 'third'); const third = await shared.refreshShared({ stateDir: s.stateDir, projectPath: s.clone });
  await shared.cleanupCopies(s.stateDir, new Set([first.copy])); assert.equal(shared.newestCopy(s.stateDir, first.identity), third.copy); await assert.rejects(fs.stat(second.copy), { code: 'ENOENT' }); await fs.stat(first.copy);
  git(s.clone, 'remote', 'set-url', 'origin', path.join(s.dir, 'missing.git'));
  const failed = await shared.refreshShared({ stateDir: s.stateDir, projectPath: s.clone }); assert.ok(failed.error); assert.equal(failed.copy, third.copy); assert.equal(shared.lastRefresh(s.stateDir, first.identity).ok, false);
  git(s.clone, 'remote', 'set-url', 'origin', 'https://github.com/Owner/Repo.git');
  assert.equal((await shared.refreshShared({ stateDir: s.stateDir, projectPath: s.clone })).error, null); assert.equal(shared.lastRefresh(s.stateDir, first.identity).ok, true);
});

test('concurrent refreshes share one fetch, and deadline kills a stalled process', async () => {
  const s = await setup(); const bin = path.join(s.dir, 'bin'); await fs.mkdir(bin); const log = path.join(s.dir, 'fetches');
  const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim(); const wrapper = path.join(bin, 'git');
  await fs.writeFile(wrapper, `#!/bin/sh\ncase " $* " in *" fetch "*) echo fetch >> '${log}'; sleep 1;; esac\nexec '${realGit}' "$@"\n`, { mode: 0o755 });
  const old = process.env.PATH; process.env.PATH = `${bin}:${old}`;
  try {
    const [a,b] = await Promise.all([shared.refreshShared({ stateDir:s.stateDir, projectPath:s.clone }), shared.refreshShared({ stateDir:s.stateDir, projectPath:s.clone })]);
    assert.equal(a.error, null); assert.equal(a.copy, b.copy); assert.equal((await fs.readFile(log, 'utf8')).trim().split('\n').length, 1);
    await fs.writeFile(wrapper, `#!/bin/sh\ncase " $* " in *" ls-remote "*) sleep 10;; esac\nexec '${realGit}' "$@"\n`, { mode: 0o755 });
    const start = Date.now(); const failed = await shared.refreshShared({ stateDir:s.stateDir, projectPath:s.clone, deadlineMs:2000 });
    assert.ok(Date.now() - start < 3000); assert.match(failed.error, /timed out/); assert.equal(failed.copy, a.copy);
  } finally { process.env.PATH = old; }
});

test('failed copy extraction leaves pointer and no temporary folder', async () => {
  const s = await setup(); const first = await shared.refreshShared({ stateDir:s.stateDir, projectPath:s.clone }); await next(s, 'new');
  const bin = path.join(s.dir, 'bin'); await fs.mkdir(bin); await fs.writeFile(path.join(bin, 'tar'), '#!/bin/sh\nexit 1\n', { mode:0o755 }); const old = process.env.PATH; process.env.PATH = `${bin}:${old}`;
  try { const result = await shared.refreshShared({ stateDir:s.stateDir, projectPath:s.clone }); assert.ok(result.error); assert.equal(result.copy, first.copy); assert.equal((await fs.readdir(path.dirname(first.copy))).filter(n => n.startsWith('.tmp-')).length, 0); }
  finally { process.env.PATH = old; }
});
