'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeTempSync } = require('../../test-support/run-dir');
const { readState, writeState, hasUnresolved } = require('../lib/win-sync');
test('state is persisted and unresolved paths are reported', () => {
  const root = makeTempSync('win-sync-'); assert.equal(hasUnresolved(root,'a'),false);
  const state = {last_ok:'now',last_failed:null,used_since_ok:false,unresolved:['a']}; writeState(root,'a',state);
  assert.deepEqual(readState(root,'a'),state); assert.equal(hasUnresolved(root,'a'),true);
});

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createWinEnv } = require('../lib/win-env');
const { ensureCopy, reconcile } = require('../lib/win-sync');

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com' } });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function fixture() {
  const root = makeTempSync('win-sync-');
  const mount = path.join(root, 'mnt');
  const drive = path.join(mount, 'c');
  const worktree = path.join(drive, 'work');
  const copy = { linux: path.join(drive, 'copy'), windows: 'C:\\copy' };
  const powershell = path.join(drive, 'Windows/System32/WindowsPowerShell/v1.0/powershell.exe');
  const gitExe = path.join(drive, 'tools/git.exe');
  fs.mkdirSync(worktree, { recursive: true });
  fs.mkdirSync(path.dirname(powershell), { recursive: true });
  fs.mkdirSync(path.dirname(gitExe), { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'fixtures/win/powershell.exe'), powershell);
  fs.copyFileSync(path.join(__dirname, 'fixtures/win/git.exe'), gitExe);
  git(worktree, 'init');
  fs.writeFileSync(path.join(worktree, 'initial'), 'initial\n');
  git(worktree, 'add', '.');
  git(worktree, 'commit', '-m', 'initial');
  const fakeEnv = { ...process.env, WC_FAKE_MOUNT: mount, WC_FAKE_GIT_PATH: 'C:\\tools\\git.exe' };
  const winEnv = createWinEnv({ mount, env: fakeEnv });
  const ctx = { winEnv, worktree, copy, stateDir: path.join(drive, 'state'), threadId: 'test', key: 'test' };
  await ensureCopy(ctx);
  return { ...ctx, fakeEnv };
}

test('reconcile transfers additions, edits, deletions, renames and independent changes', async () => {
  const ctx = await fixture();
  const linux = file => path.join(ctx.worktree, file);
  const windows = file => path.join(ctx.copy.linux, file);
  fs.writeFileSync(linux('.gitignore'), 'ignored\n');
  fs.writeFileSync(linux('ignored'), 'private');
  fs.writeFileSync(linux('linux-add'), 'first');
  await reconcile(ctx);
  assert.equal(fs.readFileSync(windows('linux-add'), 'utf8'), 'first');
  assert.equal(fs.existsSync(windows('ignored')), false);
  fs.writeFileSync(windows('ignored'), 'private windows');
  fs.writeFileSync(windows('windows-add'), 'windows');
  fs.writeFileSync(linux('linux-add'), 'second');
  await reconcile(ctx);
  assert.equal(fs.readFileSync(windows('linux-add'), 'utf8'), 'second');
  assert.equal(fs.readFileSync(linux('windows-add'), 'utf8'), 'windows');
  assert.equal(fs.readFileSync(linux('ignored'), 'utf8'), 'private');
  fs.renameSync(linux('linux-add'), linux('linux-renamed'));
  fs.renameSync(windows('windows-add'), windows('windows-renamed'));
  await reconcile(ctx);
  assert.equal(fs.readFileSync(windows('linux-renamed'), 'utf8'), 'second');
  assert.equal(fs.readFileSync(linux('windows-renamed'), 'utf8'), 'windows');
  assert.equal(fs.existsSync(windows('linux-add')), false);
  assert.equal(fs.existsSync(linux('windows-add')), false);
  fs.unlinkSync(linux('linux-renamed'));
  fs.unlinkSync(windows('windows-renamed'));
  await reconcile(ctx);
  assert.equal(fs.existsSync(windows('linux-renamed')), false);
  assert.equal(fs.existsSync(linux('windows-renamed')), false);
});

test('text conflicts preserve the Windows version and mask markers until resolved', async () => {
  const ctx = await fixture();
  const linux = file => path.join(ctx.worktree, file);
  const windows = file => path.join(ctx.copy.linux, file);
  fs.writeFileSync(linux('conflict'), 'base\n');
  await reconcile(ctx);
  fs.writeFileSync(linux('conflict'), 'linux\n');
  fs.writeFileSync(windows('conflict'), 'windows\n');
  const result = await reconcile(ctx);
  assert.equal(result.conflicts.length, 1);
  assert.match(fs.readFileSync(linux('conflict'), 'utf8'), /^<<<<<<< /m);
  assert.equal(fs.readFileSync(windows('conflict'), 'utf8'), 'linux\n');
  assert.equal(git(ctx.worktree, 'show', `${result.conflicts[0].ref}:conflict`), 'windows');
  fs.writeFileSync(windows('conflict'), 'waiting\n');
  fs.writeFileSync(windows('other'), 'other\n');
  await reconcile(ctx);
  assert.equal(fs.readFileSync(windows('conflict'), 'utf8'), 'waiting\n');
  assert.equal(fs.readFileSync(linux('other'), 'utf8'), 'other\n');
  fs.writeFileSync(windows('conflict'), 'linux\n');
  fs.writeFileSync(linux('conflict'), 'resolved\n');
  const resolved = await reconcile(ctx);
  assert.deepEqual(resolved.unresolved, []);
  assert.equal(fs.readFileSync(windows('conflict'), 'utf8'), 'resolved\n');
});

test('binary and modify/delete conflicts choose Linux and save Windows', async () => {
  const ctx = await fixture();
  const linux = file => path.join(ctx.worktree, file);
  const windows = file => path.join(ctx.copy.linux, file);
  fs.writeFileSync(linux('binary'), Buffer.from([0, 1]));
  fs.writeFileSync(linux('deleted'), 'base');
  await reconcile(ctx);
  fs.writeFileSync(linux('binary'), Buffer.from([0, 2]));
  fs.unlinkSync(linux('deleted'));
  fs.writeFileSync(windows('binary'), Buffer.from([0, 3]));
  fs.writeFileSync(windows('deleted'), 'windows');
  const result = await reconcile(ctx);
  assert.equal(result.conflicts.length, 2);
  assert.deepEqual(fs.readFileSync(linux('binary')), Buffer.from([0, 2]));
  assert.equal(fs.existsSync(linux('deleted')), false);
  assert.equal(git(ctx.worktree, 'show', `${result.conflicts[0].ref}:deleted`), 'windows');
});

test('refuses case collisions and leaves external symlinks out', async () => {
  const ctx = await fixture();
  fs.writeFileSync(path.join(ctx.worktree, 'Case'), 'a');
  fs.writeFileSync(path.join(ctx.worktree, 'case'), 'b');
  await assert.rejects(reconcile(ctx), error => error.status === 422 && /Case/.test(error.message) && /case/.test(error.message));
  assert.equal(fs.existsSync(path.join(ctx.copy.linux, 'Case')), false);
  fs.unlinkSync(path.join(ctx.worktree, 'case'));
  fs.symlinkSync('/etc/passwd', path.join(ctx.worktree, 'outside'));
  const result = await reconcile(ctx);
  assert.deepEqual(result.skipped, ['outside']);
  assert.equal(fs.existsSync(path.join(ctx.copy.linux, 'outside')), false);
});

test('refuses after two changes during apply without losing edits', async () => {
  const ctx = await fixture();
  const linux = path.join(ctx.worktree, 'initial');
  const windows = path.join(ctx.copy.linux, 'initial');
  await reconcile(ctx);
  fs.writeFileSync(windows, 'windows change\n');
  let calls = 0;
  await assert.rejects(reconcile(ctx, { hooks: { afterSnapshot: async () => {
    calls++;
    fs.writeFileSync(linux, `concurrent edit ${calls}\n`);
  } } }), error => error.status === 422 && /initial/.test(error.message));
  assert.equal(calls, 2);
  assert.equal(fs.readFileSync(linux, 'utf8'), 'concurrent edit 2\n');
  assert.equal(fs.readFileSync(windows, 'utf8'), 'windows change\n');
});

test('interrupted Windows apply is resumed after another Linux edit', async () => {
  const ctx = await fixture();
  const linux = file => path.join(ctx.worktree, file);
  const windows = file => path.join(ctx.copy.linux, file);
  await reconcile(ctx);
  fs.writeFileSync(windows('from-windows'), 'windows');
  ctx.fakeEnv.WC_FAKE_GIT_FAIL_ONCE = 'read-tree';
  ctx.fakeEnv.WC_FAKE_GIT_FAULT_FILE = path.join(ctx.stateDir, 'fault');
  await assert.rejects(reconcile(ctx), /injected read-tree failure/);
  assert.equal(fs.readFileSync(linux('from-windows'), 'utf8'), 'windows');
  fs.writeFileSync(linux('new-linux'), 'linux');
  const result = await reconcile(ctx);
  assert.deepEqual(result.conflicts, []);
  assert.equal(fs.readFileSync(windows('new-linux'), 'utf8'), 'linux');
});

test('raw bytes, executable mode, force-added and newly ignored files', async () => {
  const ctx = await fixture();
  const linux = file => path.join(ctx.worktree, file);
  const windows = file => path.join(ctx.copy.linux, file);
  const head = git(ctx.worktree, 'rev-parse', 'HEAD');
  const index = fs.readFileSync(path.join(ctx.worktree, '.git/index'));
  fs.writeFileSync(linux('.gitattributes'), 'raw filter=lfs\ncrlf text eol=crlf\n');
  fs.writeFileSync(linux('.gitignore'), 'forced\n');
  fs.writeFileSync(linux('forced'), 'tracked');
  git(ctx.worktree, 'add', '-f', 'forced');
  const realIndex = fs.readFileSync(path.join(ctx.worktree, '.git/index'));
  const raw = Buffer.from([0, 1, 13, 10, 255]);
  fs.writeFileSync(linux('raw'), raw);
  fs.writeFileSync(linux('crlf'), 'a\r\nb\n');
  fs.writeFileSync(linux('exec'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(linux('later-ignored'), 'keep local');
  await reconcile(ctx);
  assert.deepEqual(fs.readFileSync(windows('raw')), raw);
  assert.equal(fs.readFileSync(windows('crlf'), 'utf8'), 'a\r\nb\n');
  assert.equal(fs.readFileSync(windows('forced'), 'utf8'), 'tracked');
  assert.equal(git(ctx.worktree, 'rev-parse', 'HEAD'), head);
  assert.deepEqual(fs.readFileSync(path.join(ctx.worktree, '.git/index')), realIndex);
  assert.notDeepEqual(realIndex, index);
  fs.writeFileSync(linux('.gitignore'), 'forced\nlater-ignored\n');
  await reconcile(ctx);
  fs.writeFileSync(windows('exec'), '#!/bin/sh\nexit 1\n');
  await reconcile(ctx);
  assert.ok(fs.statSync(linux('exec')).mode & 0o111);
  assert.equal(fs.readFileSync(linux('later-ignored'), 'utf8'), 'keep local');
});

test('seeding copies only ignored paths accepted by the new worktree', async () => {
  const source = await fixture();
  fs.writeFileSync(path.join(source.worktree, '.gitignore'), 'cache-one\ncache-two\n');
  await reconcile(source);
  fs.writeFileSync(path.join(source.copy.linux, 'cache-one'), 'one');
  fs.writeFileSync(path.join(source.copy.linux, 'cache-two'), 'two');
  const newCopy = { linux: path.join(path.dirname(source.copy.linux), 'seeded'), windows: 'C:\\seeded' };
  fs.writeFileSync(path.join(source.worktree, '.gitignore'), 'cache-one\n');
  const ctx = { ...source, copy: newCopy, key: 'seeded', sources: [{ copy: source.copy, last_ok: '2026-01-01' }] };
  const result = await ensureCopy(ctx);
  assert.equal(result.created, true);
  assert.equal(fs.readFileSync(path.join(newCopy.linux, 'cache-one'), 'utf8'), 'one');
  assert.equal(fs.existsSync(path.join(newCopy.linux, 'cache-two')), false);
});

test('seeding accepts robocopy success code 1 and reports failure code 8', async () => {
  const source = await fixture();
  fs.writeFileSync(path.join(source.worktree, '.gitignore'), 'cache\n');
  await reconcile(source);
  fs.writeFileSync(path.join(source.copy.linux, 'cache'), 'seeded');
  source.fakeEnv.WC_FAKE_ROBOCOPY_CODE = '1';
  const seeded = { ...source, copy: { linux: path.join(path.dirname(source.copy.linux), 'seed-one'), windows: 'C:\\seed-one' }, key: 'seed-one', sources: [{ copy: source.copy, last_ok: 'now' }] };
  assert.equal((await ensureCopy(seeded)).created, true);
  assert.equal(fs.readFileSync(path.join(seeded.copy.linux, 'cache'), 'utf8'), 'seeded');
  source.fakeEnv.WC_FAKE_ROBOCOPY_CODE = '8';
  const failed = { ...seeded, copy: { linux: path.join(path.dirname(source.copy.linux), 'seed-eight'), windows: 'C:\\seed-eight' }, key: 'seed-eight' };
  await assert.rejects(ensureCopy(failed), /seed failed \(exit 8\)/);
});

test('deleting unresolved copies saves the Windows snapshot and removes copy refs', async () => {
  const { deleteCopy } = require('../lib/win-sync');
  const ctx = await fixture();
  const linux = path.join(ctx.worktree, 'initial');
  const windows = path.join(ctx.copy.linux, 'initial');
  await reconcile(ctx);
  fs.writeFileSync(linux, 'linux\n');
  fs.writeFileSync(windows, 'windows\n');
  const result = await reconcile(ctx);
  await deleteCopy(ctx, { saveUnresolved: true });
  assert.equal(fs.existsSync(ctx.copy.linux), false);
  const refs = git(ctx.worktree, 'for-each-ref', '--format=%(refname)', 'refs/wheelchair');
  assert.doesNotMatch(refs, /refs\/wheelchair\/test\/(base|windows)/);
  const conflicts = refs.split('\n').filter(ref => ref.startsWith('refs/wheelchair/conflicts/'));
  assert.equal(conflicts.length, 2);
  assert.ok(conflicts.includes(result.conflicts[0].ref));
  assert.ok(conflicts.every(ref => git(ctx.worktree, 'show', `${ref}:initial`) === 'windows'));
});

test('concurrent reconciles for the same copy are serialized', async () => {
  const ctx = await fixture();
  let release;
  let entered;
  const blocked = new Promise(resolve => { release = resolve; });
  const firstEntered = new Promise(resolve => { entered = resolve; });
  const order = [];
  const first = reconcile(ctx, { hooks: { afterSnapshot: async () => {
    order.push('first');
    entered();
    await blocked;
  } } });
  await firstEntered;
  const second = reconcile(ctx, { hooks: { afterSnapshot: async () => { order.push('second'); } } });
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.deepEqual(order, ['first']);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(order, ['first', 'second']);
});

test('interrupted conflict application retains marker masking on the next sync', async () => {
  const ctx = await fixture();
  const linux = path.join(ctx.worktree, 'initial');
  const windows = path.join(ctx.copy.linux, 'initial');
  await reconcile(ctx);
  fs.writeFileSync(linux, 'linux\n');
  fs.writeFileSync(windows, 'windows\n');
  ctx.fakeEnv.WC_FAKE_GIT_FAIL_ONCE = 'read-tree';
  ctx.fakeEnv.WC_FAKE_GIT_FAULT_FILE = path.join(ctx.stateDir, 'fault');
  await assert.rejects(reconcile(ctx), /injected read-tree failure/);
  assert.match(fs.readFileSync(linux, 'utf8'), /^<<<<<<< /m);
  const result = await reconcile(ctx);
  assert.deepEqual(result.unresolved, ['initial']);
  assert.equal(fs.readFileSync(windows, 'utf8'), 'windows\n');
});

test('later force-add, repeated tracked deletion, and successive Windows edits sync', async () => {
  const ctx = await fixture();
  const linux = file => path.join(ctx.worktree, file);
  const windows = file => path.join(ctx.copy.linux, file);
  fs.writeFileSync(linux('.gitignore'), 'forced-later\n');
  fs.writeFileSync(linux('forced-later'), 'tracked later');
  await reconcile(ctx);
  assert.equal(fs.existsSync(windows('forced-later')), false);
  git(ctx.worktree, 'add', '-f', 'forced-later');
  fs.unlinkSync(linux('initial'));
  await reconcile(ctx);
  assert.equal(fs.readFileSync(windows('forced-later'), 'utf8'), 'tracked later');
  assert.equal(fs.existsSync(windows('initial')), false);
  await reconcile(ctx);
  assert.equal(fs.existsSync(windows('initial')), false);
  fs.writeFileSync(windows('forced-later'), 'first edit');
  await reconcile(ctx);
  fs.writeFileSync(windows('forced-later'), 'second edit');
  await reconcile(ctx);
  assert.equal(fs.readFileSync(linux('forced-later'), 'utf8'), 'second edit');
});

test('clean checkout LFS and eol attributes do not transform bridge bytes', async () => {
  const ctx = await fixture();
  const linux = file => path.join(ctx.worktree, file);
  const windows = file => path.join(ctx.copy.linux, file);
  fs.writeFileSync(linux('.gitattributes'), 'lfs filter=lfs\neol text eol=crlf\n');
  fs.writeFileSync(linux('lfs'), 'literal LFS file\n');
  fs.writeFileSync(linux('eol'), 'line one\nline two\n');
  git(ctx.worktree, 'add', '.gitattributes');
  for (const file of ['lfs', 'eol']) {
    const oid = git(ctx.worktree, 'hash-object', '-w', '--no-filters', file);
    git(ctx.worktree, 'update-index', '--add', '--cacheinfo', `100644,${oid},${file}`);
  }
  git(ctx.worktree, 'commit', '-m', 'attribute fixture');
  fs.unlinkSync(linux('lfs'));
  fs.unlinkSync(linux('eol'));
  git(ctx.worktree, '-c', 'filter.lfs.smudge=cat', '-c', 'filter.lfs.required=false', 'checkout', '-f', 'HEAD', '--', 'lfs', 'eol');
  const lfs = fs.readFileSync(linux('lfs'));
  const eol = fs.readFileSync(linux('eol'));
  assert.ok(eol.includes(Buffer.from('\r\n')));
  await reconcile(ctx);
  assert.deepEqual(fs.readFileSync(windows('lfs')), lfs);
  assert.deepEqual(fs.readFileSync(windows('eol')), eol);
});
