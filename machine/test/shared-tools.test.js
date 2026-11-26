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
  git(s.source, 'remote', 'set-url', 'origin', 'https://github.com/Owner/Repo.git');
  git(s.source, 'config', `url.file://${s.bare}.insteadOf`, 'https://github.com/Owner/Repo.git');
  assert.equal(await shared.findSharedProject('owner/repo', [other, path.join(s.dir, 'missing'), s.clone, s.source]), s.clone);
  assert.equal(await shared.findSharedProject('owner/repo', [s.source, s.clone]), s.source);
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
    await fs.writeFile(wrapper, `#!/bin/sh\ncase " $* " in *" fetch "*) for arg do :; done; ref="${'$'}{arg##*:}"; '${realGit}' -C '${s.clone}' update-ref "${'$'}ref" '${git(s.clone, 'rev-parse', 'HEAD')}'; touch '${s.clone}/.git/'"${'$'}ref".lock; echo $$ > '${s.dir}/pid'; sleep 10;; esac\nexec '${realGit}' "$@"\n`, { mode: 0o755 });
    const start = Date.now(); const failed = await shared.refreshShared({ stateDir:s.stateDir, projectPath:s.clone, deadlineMs:2000 });
    assert.ok(Date.now() - start < 3000); assert.match(failed.error, /git fetch timed out after 2 s/); assert.equal(failed.copy, a.copy);
    const pid = Number(await fs.readFile(path.join(s.dir, 'pid'), 'utf8')); assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    assert.equal(git(s.clone, 'for-each-ref', '--format=%(refname)', 'refs/wheelchair/'), '');
    assert.deepEqual((await fs.readdir(path.join(s.clone, '.git/refs/wheelchair/shared-tools')).catch(e => e.code === 'ENOENT' ? [] : Promise.reject(e))).filter(n => n.endsWith('.lock')), []);
  } finally { process.env.PATH = old; }
});

test('failed copy extraction leaves pointer and no temporary folder', async () => {
  const s = await setup(); const first = await shared.refreshShared({ stateDir:s.stateDir, projectPath:s.clone }); await next(s, 'new');
  const bin = path.join(s.dir, 'bin'); await fs.mkdir(bin); await fs.writeFile(path.join(bin, 'tar'), '#!/bin/sh\nexit 1\n', { mode:0o755 }); const old = process.env.PATH; process.env.PATH = `${bin}:${old}`;
  try { const result = await shared.refreshShared({ stateDir:s.stateDir, projectPath:s.clone }); assert.ok(result.error); assert.equal(result.copy, first.copy); assert.equal((await fs.readdir(path.dirname(first.copy))).filter(n => n.startsWith('.tmp-')).length, 0); }
  finally { process.env.PATH = old; }
});

test('a waiting caller has its own deadline and stale temporary copies are removed', async () => {
  const s = await setup(); const first = await shared.refreshShared({ stateDir:s.stateDir, projectPath:s.clone });
  const bin = path.join(s.dir, 'bin'), marker = path.join(s.dir, 'started'); await fs.mkdir(bin);
  const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  await fs.writeFile(path.join(bin, 'git'), `#!/bin/sh\ncase " $* " in *" fetch "*) touch '${marker}'; sleep 3;; esac\nexec '${realGit}' "$@"\n`, { mode:0o755 });
  const old = process.env.PATH; process.env.PATH = `${bin}:${old}`;
  try {
    const ongoing = shared.refreshShared({ stateDir:s.stateDir, projectPath:s.clone, deadlineMs:8000 });
    const until = Date.now() + 5000;
    while (true) { try { await fs.stat(marker); break; } catch (e) { if (e.code !== 'ENOENT' || Date.now() >= until) throw e; await new Promise(resolve => setTimeout(resolve, 25)); } }
    const start = Date.now(); const waiting = await shared.refreshShared({ stateDir:s.stateDir, projectPath:s.clone, deadlineMs:1200 });
    assert.ok(Date.now() - start < 2200); assert.match(waiting.error, /still running/); assert.equal(waiting.copy, first.copy);
    assert.deepEqual(shared.lastRefresh(s.stateDir, first.identity).error, waiting.error);
    assert.equal((await ongoing).error, null);
    const stale = path.join(path.dirname(first.copy), '.tmp-stale'); await fs.mkdir(stale); await fs.chmod(stale, 0o555);
    await shared.cleanupCopies(s.stateDir, new Set()); await assert.rejects(fs.stat(stale), { code:'ENOENT' });
  } finally { process.env.PATH = old; }
});

test('a commit without tools produces an empty copy', async () => {
  const s = await setup(); git(s.source, 'rm', '-r', '.wheelchair'); git(s.source, 'commit', '-m', 'remove tools'); git(s.source, 'push', 'origin', 'main');
  const result = await shared.refreshShared({ stateDir:s.stateDir, projectPath:s.clone });
  assert.equal(result.error, null); assert.deepEqual(await fs.readdir(result.copy), []);
});


test('failed fetch removes private refs and stale locks, and disables automatic maintenance', async () => {
  const s = await setup(), bin = path.join(s.dir, 'bin'), argsFile = path.join(s.dir, 'args'); await fs.mkdir(bin);
  const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  const commit = git(s.clone, 'rev-parse', 'HEAD');
  git(s.clone, 'update-ref', 'refs/wheelchair/shared-tools/stale', commit);
  const refDir = path.join(s.clone, '.git/refs/wheelchair/shared-tools');
  await fs.writeFile(path.join(refDir, 'old.lock'), 'stale');
  await fs.writeFile(path.join(bin, 'git'), `#!/bin/sh
case " $* " in *" fetch "*) echo "$*" > '${argsFile}'; ref="${'${!#}'}";; esac
exec '${realGit}' "$@"
`.replace('ref="${!#}"', `if [ -e '${refDir}/old.lock' ] || '${realGit}' -C '${s.clone}' show-ref --verify --quiet refs/wheelchair/shared-tools/stale; then echo 'sweep missing' >&2; exit 1; fi; for arg do :; done; ref="${'$'}{arg##*:}"; mkdir -p '${refDir}'; '${realGit}' -C '${s.clone}' update-ref "${'$'}ref" '${commit}'; touch '${refDir}/'"${'$'}{ref##*/}".lock; echo 'network broke' >&2; echo 'second line' >&2; exit 1`), { mode: 0o755 });
  const old = process.env.PATH; process.env.PATH = `${bin}:${old}`;
  try {
    const result = await shared.refreshShared({ stateDir: s.stateDir, projectPath: s.clone });
    assert.equal(result.error, 'git fetch failed: network broke');
    assert.match(await fs.readFile(argsFile, 'utf8'), /-c gc.auto=0/);
    assert.match(await fs.readFile(argsFile, 'utf8'), /-c maintenance.auto=false/);
    assert.equal(git(s.clone, 'for-each-ref', '--format=%(refname)', 'refs/wheelchair/'), '');
    assert.deepEqual((await fs.readdir(refDir).catch(e => e.code === 'ENOENT' ? [] : Promise.reject(e))).filter(n => n.endsWith('.lock')), []);
  } finally { process.env.PATH = old; }
});

test('cleanup cannot remove a copy before its refresh publishes the pointer', async () => {
  const s = await setup(); const first = await shared.refreshShared({ stateDir:s.stateDir, projectPath:s.clone }); await next(s, 'new');
  const rename = fs.rename; let release, ready;
  const held = new Promise(resolve => { release = resolve; }); const reached = new Promise(resolve => { ready = resolve; });
  fs.rename = async (from, to) => { if (to === path.join(path.dirname(first.copy), 'current')) { ready(); await held; } return rename(from, to); };
  try {
    const ongoing = shared.refreshShared({ stateDir:s.stateDir, projectPath:s.clone }); await reached;
    await shared.cleanupCopies(s.stateDir, new Set()); release();
    const result = await ongoing; assert.equal(result.error, null); assert.notEqual(result.copy, first.copy);
    await fs.stat(result.copy); assert.equal(shared.newestCopy(s.stateDir, first.identity), result.copy);
  } finally { release(); fs.rename = rename; }
});

test('origin lookup honors insteadOf and identity errors are clear', async () => {
  const s = await setup();
  git(s.clone, 'config', '--unset', `url.file://${s.bare}.insteadOf`);
  git(s.clone, 'remote', 'set-url', 'origin', 'shortcut:Repo.git');
  git(s.clone, 'config', 'url.https://github.com/Owner/.insteadOf', 'shortcut:');
  assert.equal(await shared.findSharedProject('owner/repo', [s.clone]), s.clone);
  const failed = await shared.refreshShared({ stateDir:s.stateDir, projectPath:path.join(s.dir, 'missing') });
  assert.equal(failed.identity, null); assert.match(failed.error, /git rev-parse failed/); assert.ok(failed.error.length <= 200);
});


test('a waiter does not overwrite a newer recorded outcome', async () => {
  const s = await setup(), first = await shared.refreshShared({ stateDir:s.stateDir, projectPath:s.clone });
  const bin = path.join(s.dir, 'bin'), marker = path.join(s.dir, 'started'); await fs.mkdir(bin);
  const realGit = execFileSync('which', ['git'], { encoding:'utf8' }).trim();
  await fs.writeFile(path.join(bin, 'git'), `#!/bin/sh\ncase " $* " in *" fetch "*) touch '${marker}'; sleep 2;; esac\nexec '${realGit}' "$@"\n`, { mode:0o755 });
  const old = process.env.PATH; process.env.PATH = `${bin}:${old}`;
  try {
    const ongoing = shared.refreshShared({ stateDir:s.stateDir, projectPath:s.clone, deadlineMs:5000 });
    const until = Date.now() + 3000;
    while (true) { try { await fs.stat(marker); break; } catch (e) { if (e.code !== 'ENOENT' || Date.now() >= until) throw e; await new Promise(resolve => setTimeout(resolve, 25)); } }
    const waiting = shared.refreshShared({ stateDir:s.stateDir, projectPath:s.clone, deadlineMs:700 });
    await new Promise(resolve => setTimeout(resolve, 200));
    const newer = { at:'2099-01-01T00:00:00.000Z', ok:true, error:null };
    await fs.writeFile(path.join(path.dirname(first.copy), 'last-refresh.json'), JSON.stringify(newer));
    assert.match((await waiting).error, /still running/); assert.deepEqual(shared.lastRefresh(s.stateDir, first.identity), newer);
    assert.equal((await ongoing).error, null);
  } finally { process.env.PATH = old; }
});

test('refresh failure messages name the step and fit on one short line', async () => {
  const s = await setup(), bin = path.join(s.dir, 'bin'); await fs.mkdir(bin);
  const realGit = execFileSync('which', ['git'], { encoding:'utf8' }).trim();
  await fs.writeFile(path.join(bin, 'git'), `#!/bin/sh\ncase " $* " in *" ls-remote "*) printf '%s\\nsecond line\\n' '${'x'.repeat(300)}' >&2; exit 1;; esac\nexec '${realGit}' "$@"\n`, { mode:0o755 });
  const old = process.env.PATH; process.env.PATH = `${bin}:${old}`;
  try {
    const result = await shared.refreshShared({ stateDir:s.stateDir, projectPath:s.clone });
    assert.match(result.error, /^git ls-remote failed: x+/); assert.ok(result.error.length <= 200); assert.doesNotMatch(result.error, /[\r\n]|second line/);
  } finally { process.env.PATH = old; }
});

test('a copy publication failure names its step', async () => {
  const s = await setup(), rename = fs.rename;
  fs.rename = async (from, to) => { if (to.endsWith('/current')) throw new Error('disk full\nother detail'); return rename(from, to); };
  try {
    const result = await shared.refreshShared({ stateDir:s.stateDir, projectPath:s.clone });
    assert.equal(result.error, 'copy publication failed: disk full');
  } finally { fs.rename = rename; }
});
