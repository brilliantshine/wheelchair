'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { MachineService } = require('../service');
const { makeTemp } = require('../../test-support/run-dir');
const header = { 'x-wheelchair-machine-secret': 'secret', 'content-type': 'application/json' };
async function setup() {
  const root = await makeTemp('plan-files-'); const state = path.join(root, 'state'); await fs.mkdir(state);
  const secret = path.join(root, 'secret'); await fs.writeFile(secret, 'secret');
  await fs.writeFile(path.join(state, 'machine.json'), JSON.stringify({ secret_file: secret, host: '127.0.0.1', port: 0 }));
  const service = new MachineService({ stateDir: state }); await service.listen();
  const base = `http://127.0.0.1:${service.server.address().port}`;
  const post = async (url, body) => { const r = await fetch(base + url, { method: 'POST', headers: header, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
  return { root, state, service, base, post, close: () => new Promise(resolve => service.server.close(resolve)) };
}
function git(repo, ...args) { return execFileSync('git', ['-C', repo, ...args], { stdio: 'pipe' }); }
async function write(file, content) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, content); }
test('plan files use committed refs and enforce input and size limits', async () => {
  const e = await setup(); try {
    const repo = path.join(e.root, 'repo'); await fs.mkdir(repo); git(repo, 'init', '-b', 'main'); git(repo, 'config', 'user.name', 'Test'); git(repo, 'config', 'user.email', 'test@example.com');
    await write(path.join(repo, 'README'), 'base'); git(repo, 'add', '.'); git(repo, 'commit', '-m', 'base'); git(repo, 'checkout', '-b', 'wc/abcdef123456');
    const dir = path.join(repo, 'docs/plans/example'); const big = 'x'.repeat(1536 * 1024); await write(path.join(dir, 'MAP.md'), big); await write(path.join(dir, 'IDEA.md'), 'x'.repeat(2 * 1024 * 1024 + 1)); await write(path.join(dir, 'PLAN.md'), 'status: building # comment\n'); git(repo, 'add', '.'); git(repo, 'commit', '-m', 'plan');
    const req = { thread_id: 'abcdef123456', project: repo, default_branch: 'main' };
    assert.deepEqual((await e.post('/v1/plan-files', { ...req, action: 'discover' })).body, { slug: 'example' });
    assert.deepEqual((await e.post('/v1/plan-files', { ...req, action: 'list', slug: 'example' })).body, { files: ['MAP.md', 'PLAN.md'], status: 'building' });
    assert.equal((await e.post('/v1/plan-files', { ...req, action: 'read', slug: 'example', file: 'MAP.md' })).body.content, big);
    assert.equal((await e.post('/v1/plan-files', { ...req, action: 'read', slug: 'example', file: 'IDEA.md' })).status, 404);
    for (const bad of [{ thread_id: 'bad' }, { project: 'relative' }, { project: e.root }, { action: 'bad' }, { action: 'list', slug: '../bad' }, { action: 'read', slug: 'example', file: 'bad' }]) assert.equal((await e.post('/v1/plan-files', { ...req, action: 'discover', ...bad })).status, 400);
    assert.equal((await e.post('/v1/plan-files', { ...req, thread_id: '000000000000', action: 'list', slug: 'example' })).status, 404);
    assert.equal((await e.post('/v1/plan-files', { ...req, action: 'read', slug: 'missing', file: 'PLAN.md' })).status, 404);
  } finally { await e.close(); }
});
test('archive keeps selected regular uploads, retries and reserves numbers', async () => {
  const e = await setup(); try {
    const id = 'thread'; const dir = path.join(e.state, 'uploads', id); await write(path.join(dir, '4-keep.txt'), 'kept'); await write(path.join(dir, '5-drop.txt'), 'drop'); await write(path.join(dir, 'bad'), 'bad'); await fs.symlink(path.join(dir, '4-keep.txt'), path.join(dir, '6-link.txt'));
    const keep = ['4-keep.txt', '6-link.txt', 'bad']; const a = await e.post('/v1/archive', { thread_id: id, keep }); assert.equal(a.body.uploads_removed, true); assert.deepEqual(a.body.kept_uploads, ['4-keep.txt']); await assert.rejects(fs.access(dir));
    assert.deepEqual((await e.post('/v1/archive', { thread_id: id, keep })).body.kept_uploads, ['4-keep.txt']);
    const response = await fetch(`${e.base}/v1/uploads/${id}/4-keep.txt`, { headers: header }); assert.equal(await response.text(), 'kept');
    const reservation = await e.service.reserveUpload(id, 'new.txt'); assert.equal(path.basename(reservation.target), '5-new.txt'); await reservation.file.close();
    await write(path.join(e.state, 'uploads', 'failure', '1-file'), 'x'); await write(path.join(e.state, 'kept', 'failure'), 'obstacle');
    const failed = await e.post('/v1/archive', { thread_id: 'failure', keep: ['1-file'] }); assert.equal(failed.body.uploads_removed, false); assert.ok(failed.body.uploads_error); await fs.access(path.join(e.state, 'uploads', 'failure', '1-file'));
  } finally { await e.close(); }
});
