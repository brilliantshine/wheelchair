'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { makeTemp } = require('../../test-support/run-dir.js');
const { setup, close, thread, api, card } = require('./helpers/app.js');
const { validate } = require('../app/card.js');

async function update(c, id, changes) {
  const file = path.join(c.state, 'threads', `${id}.json`);
  const record = JSON.parse(await fs.readFile(file, 'utf8'));
  Object.assign(record, changes);
  await fs.writeFile(file, JSON.stringify(record));
}
async function download(c, id, file) {
  const url = `${c.server.url}/api/threads/${id}/doc?file=${file}&download=1&token=${c.server.token}`;
  return fetch(url);
}

test('file card validation and machine relay storage', async () => {
  const input = { kind: 'file', path: '/tmp/1-report.pdf', title: 'Report' };
  assert.equal(validate('file', input, 'lead').ok, true);
  assert.equal(validate('file', input, 'worker').ok, false);
  assert.equal(validate('file', { ...input, name: 'report.pdf' }, 'lead').ok, false);
  const c = await setup();
  try {
    const t = await thread(c);
    const result = await card(c, t.id, t.sessions[0].name, { ...input, name: 'report.pdf', size: 42 });
    assert.equal(result.status, 202);
    const chat = await api(c, `/threads/${t.id}/chat`);
    const stored = chat.body.cards.find((item) => item.kind === 'file');
    assert.deepEqual([stored.file, stored.name, stored.size], ['1-report.pdf', 'report.pdf', 42]);
  } finally { await close(c); }
});

test('live documents share listing and route eligibility', async () => {
  const c = await setup();
  try {
    const t = await thread(c);
    const worktree = await makeTemp('documents-');
    const dir = path.join(worktree, 'docs/plans/example');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'MAP.md'), 'map\n');
    await fs.writeFile(path.join(dir, 'IDEA.md'), Buffer.alloc(2 * 1024 * 1024 + 1));
    await fs.symlink(path.join(dir, 'MAP.md'), path.join(dir, 'PLAN.md'));
    await update(c, t.id, { worktree, slug: 'example' });
    assert.deepEqual((await api(c, `/threads/${t.id}/chat`)).body.documents, ['MAP.md']);
    assert.equal((await api(c, `/threads/${t.id}/doc?file=MAP.md`)).body.content, 'map\n');
    for (const file of ['IDEA.md', 'PLAN.md', 'OTHER.md']) assert.equal((await api(c, `/threads/${t.id}/doc?file=${file}`)).status, 404);
    const response = await download(c, t.id, 'MAP.md');
    assert.equal(await response.text(), 'map\n');
    assert.equal(response.headers.get('content-type'), 'text/markdown; charset=utf-8');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('content-disposition'), 'attachment; filename="example-MAP.md"');
    await update(c, t.id, { slug: '../bad' });
    assert.deepEqual((await api(c, `/threads/${t.id}/chat`)).body.documents, []);
    assert.equal((await api(c, `/threads/${t.id}/doc?file=MAP.md`)).status, 404);
    await update(c, t.id, { slug: 'example', worktree: path.join(worktree, 'missing') });
    assert.deepEqual((await api(c, `/threads/${t.id}/chat`)).body.documents, []);
  } finally { await close(c); }
});

test('archived documents list is cached without a worktree and route reads the branch', async () => {
  const bin = await makeTemp('document-git-');
  const log = path.join(bin, 'calls');
  const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  await fs.writeFile(path.join(bin, 'git'), `#!/bin/sh\ncase "$*" in *cat-file*) echo call >> "${log}"; case "$*" in *IDEA.md*) exit 1;; esac; exit 0;; *show*) echo archived; exit 0;; esac\nexec "${realGit}" "$@"\n`);
  await fs.chmod(path.join(bin, 'git'), 0o755);
  const c = await setup({ env: { PATH: `${bin}:${process.env.PATH}` } });
  try {
    const t = await thread(c);
    await update(c, t.id, { archived: true, branch: 'wc/example', slug: 'example', worktree: null });
    for (let i = 0; i < 2; i++) assert.deepEqual((await api(c, `/threads/${t.id}/chat`)).body.documents, ['MAP.md', 'PLAN.md']);
    assert.equal((await fs.readFile(log, 'utf8')).trim().split('\n').length, 3);
    assert.equal((await api(c, `/threads/${t.id}/doc?file=MAP.md`)).body.content, 'archived\n');
    const response = await download(c, t.id, 'MAP.md');
    assert.equal(await response.text(), 'archived\n');
    assert.equal(response.headers.get('content-disposition'), 'attachment; filename="example-MAP.md"');
  } finally { await close(c); }
});
