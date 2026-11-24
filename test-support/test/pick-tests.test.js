'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { makeTempSync } = require('../run-dir');
const picker = path.resolve(__dirname, '../pick-tests.js');
function fixture() {
  const dir = makeTempSync('picker-');
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
  const write = (p, s = '') => { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), s); };
  git('init', '-q'); git('config', 'user.email', 'test@example.com'); git('config', 'user.name', 'Test');
  write('test-support/test-map.json', JSON.stringify([{ glob: 'docs/fixture/**', tests: ['viewer/test/page.spec.js'] }, { glob: 'viewer/app/pages/**', tests: ['viewer/test/page.spec.js'] }]));
  write('viewer/test/foo.test.js', "require('../foo.js')\n"); write('viewer/test/page.spec.js', '');
  write('machine/test/cross.test.js', "require('../../viewer/foo.js')\n"); write('machine/test/bar.test.js', '');
  write('viewer/foo.js', 'a'); write('machine/bar.js', 'a'); write('docs/fixture/data', 'a');
  git('add', '.'); git('commit', '-qm', 'base');
  const commit = () => { git('add', '-A'); git('commit', '-qm', 'change'); };
  const run = (...args) => spawnSync(process.execPath, [picker, ...args], { cwd: dir, encoding: 'utf8' });
  const pick = () => { commit(); const r = run('--base', 'HEAD~1', '--json'); assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };
  return { dir, git, write, pick, run };
}
const names = r => r.suites.map(s => s.suite);
test('changed tests select themselves and renamed tests use only head paths', () => {
  const f = fixture(); f.git('mv', 'viewer/test/foo.test.js', 'viewer/test/new.test.js');
  const r = f.pick(); assert.deepEqual(r.changed, ['viewer/test/foo.test.js', 'viewer/test/new.test.js']); assert.deepEqual(r.suites[0].files, ['viewer/test/new.test.js']);
});
test('deleted test selects nothing', () => { const f = fixture(); f.git('update-index', '--force-remove', 'viewer/test/foo.test.js'); f.git('commit', '-qm', 'delete'); const r = f.run('--base', 'HEAD~1', '--json'); assert.deepEqual(JSON.parse(r.stdout).suites, []); });
test('source imports include cross component and deleted source', () => { const f = fixture(); f.git('update-index', '--force-remove', 'viewer/foo.js'); f.git('commit', '-qm', 'delete'); const r = JSON.parse(f.run('--base', 'HEAD~1', '--json').stdout); assert.deepEqual(names(r), ['viewer-node', 'machine']); assert.deepEqual(r.suites[1].files, ['machine/test/cross.test.js']); });
test('map covers docs and front-end browser specs', () => { const f = fixture(); f.write('docs/fixture/data', 'b'); f.write('viewer/app/pages/a.js', 'x'); const r = f.pick(); assert.deepEqual(names(r), ['viewer-browser']); assert.equal(r.suites[0].command, 'npm --prefix viewer run test:browser -- page.spec.js'); });
test('shared file fans out and full selects all suites', () => { const f = fixture(); f.write('test-support/run-dir.js', 'x'); assert.deepEqual(names(f.pick()), ['viewer-node', 'viewer-browser', 'machine', 'test-support']); assert.equal(JSON.parse(f.run('--full', '--json').stdout).suites.length, 8); });
test('fallbacks select viewer, machine, and every suite for root', () => { for (const [file, expected] of [['viewer/unknown.js', ['viewer-node','viewer-browser']], ['machine/unknown.js', ['machine']], ['root.js', ['viewer-node','viewer-browser','machine','test-support','sensitivity','codex','install','sudo-helper']]]) { const f = fixture(); f.write(file, 'x'); assert.deepEqual(names(f.pick()), expected); } });
test('unmapped docs and markdown select nothing and bad base fails', () => { const f = fixture(); f.write('docs/other.txt', 'x'); f.write('note.md', 'x'); assert.deepEqual(f.pick().suites, []); assert.equal(f.run('--base', 'HEAD~1').stdout, ''); const bad = f.run('--base', 'nonsense'); assert.equal(bad.status, 1); assert.equal(bad.stderr.trim().split('\n').length, 1); });
test('a docs fixture named in the map selects its test', () => { const f = fixture(); f.write('docs/fixture/data', 'b'); const r = f.pick(); assert.deepEqual(names(r), ['viewer-browser']); assert.deepEqual(r.suites[0].files, ['viewer/test/page.spec.js']); });
test('a source file selects tests named after it without an import', () => { const f = fixture(); f.write('machine/test/baz-more.test.js', ''); f.write('machine/test/bazooka.test.js', ''); f.git('add', '.'); f.git('commit', '-qm', 'tests'); f.write('machine/baz.js', 'x'); const r = f.pick(); assert.deepEqual(names(r), ['machine']); assert.deepEqual(r.suites[0].files, ['machine/test/baz-more.test.js']); assert.equal(r.suites[0].command, 'node --test machine/test/baz-more.test.js'); });
test('a front-end page a Node test imports but the map does not name falls back to the viewer suites', () => { const f = fixture(); f.write('viewer/pages/x.js', 'a'); f.write('viewer/test/x.test.js', "require('../pages/x.js')\n"); f.git('add', '.'); f.git('commit', '-qm', 'page'); f.write('viewer/pages/x.js', 'b'); const r = f.pick(); assert.deepEqual(names(r), ['viewer-node', 'viewer-browser']); assert.equal(r.suites[0].command, 'node --test viewer/test/*.test.js'); });
