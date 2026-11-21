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
  const winEnv = createWinEnv({ mount, env: { ...process.env, WC_FAKE_MOUNT: mount, WC_FAKE_GIT_PATH: 'C:\\tools\\git.exe' } });
  const ctx = { winEnv, worktree, copy, stateDir: path.join(drive, 'state'), threadId: 'test', key: 'test' };
  await ensureCopy(ctx);
  return ctx;
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
