'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { makeTempSync } = require('../../test-support/run-dir');
const { missingPrograms } = require('../lib/project-programs');

function fixture() {
  const worktree = makeTempSync('programs-');
  const file = (name, mode = 0o755) => {
    const target = path.join(worktree, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, '', { mode });
    return target;
  };
  const check = (servers, searchPath = '/nonexistent') => missingPrograms({
    worktree, mcp: { names: Object.keys(servers), servers }, path: searchPath,
  });
  return { worktree, file, check };
}

test('finds absolute, worktree-relative and PATH programs', () => {
  const { worktree, file, check } = fixture();
  const absolute = file('absolute');
  file('bin/tool');
  file('path-dir/tool');
  assert.deepEqual(check({ a: { command: absolute }, b: { command: 'bin/tool' }, c: { type: 'stdio', command: 'tool' } }, `${worktree}/path-dir`), []);
});

test('reports missing and non-executable files without exposing commands', () => {
  const { file, check } = fixture();
  file('bin/private-command', 0o644);
  assert.deepEqual(check({ 'odd name': { command: 'bin/private-command' }, missing: { command: 'secret-command' } }), [
    { names: ['odd name'], text: '"odd name": its program can\'t be found' },
    { names: ['missing'], text: 'missing: its program can\'t be found' },
  ]);
});

test('skips variable commands and non-stdio servers, and accepts null mcp', () => {
  const { worktree, check } = fixture();
  assert.deepEqual(check({ variable: { command: '${X}/bin/tool' }, web: { type: 'http', url: 'https://example.test' }, stream: { type: 'sse', url: 'https://example.test' } }), []);
  assert.deepEqual(missingPrograms({ worktree, mcp: null, path: '' }), []);
});

test('directories do not count on PATH or as relative commands', () => {
  const { worktree, check } = fixture();
  fs.mkdirSync(`${worktree}/bin/tool`, { recursive: true });
  assert.deepEqual(check({ bare: { command: 'tool' }, relative: { command: 'bin/tool' } }, `${worktree}/bin`), [
    { names: ['bare'], text: "bare: its program can't be found" },
    { names: ['relative'], text: "relative: its program can't be found" },
  ]);
});

test('empty and relative PATH entries are based on the worktree', () => {
  const { file, check } = fixture();
  file('root-tool');
  file('bin/local-tool');
  assert.deepEqual(check({ root: { command: 'root-tool' }, local: { command: 'local-tool' } }, '/nonexistent::bin'), []);
});

test('dot-dot after a symlink is resolved by the filesystem', () => {
  const { worktree, file, check } = fixture();
  fs.mkdirSync(`${worktree}/bin`, { recursive: true });
  fs.mkdirSync(`${worktree}/other/target`, { recursive: true });
  fs.symlinkSync(`${worktree}/other/target`, `${worktree}/bin/link`);
  file('other/runner');
  file('bin/reverse');
  assert.deepEqual(check({ found: { command: 'bin/link/../runner' }, missing: { command: 'bin/link/../reverse' } }), [
    { names: ['missing'], text: "missing: its program can't be found" },
  ]);
});

test('Windows programs respect mount, file type and WSL', () => {
  const { isWindowsProgram } = require('../lib/project-programs');
  const { worktree, file } = fixture();
  const exe = file('c/tool.EXE', 0o644);
  const cmd = file('c/tool.cmd', 0o644);
  assert.equal(isWindowsProgram(exe, worktree), true);
  assert.equal(isWindowsProgram('/mnt/c/tool.exe', worktree), true);
  for (const value of [cmd, 'tool.exe', '/mnt/cc/tool.exe', '/mnt/c/tool.bat', '/mnt/c/tool.ps1']) assert.equal(isWindowsProgram(value, worktree), false);
  const check = (command, wsl) => missingPrograms({ worktree, mcp: { servers: { tool: { command } } }, path: '', wsl, mount: worktree });
  assert.deepEqual(check(exe, true), []);
  assert.equal(check(`${worktree}/c/missing.exe`, true).length, 1);
  assert.deepEqual(check(`${worktree}/c/missing.exe`, false), []);
  assert.equal(check(cmd, true).length, 1);
});
