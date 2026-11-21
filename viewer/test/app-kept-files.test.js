'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { setup, close, thread, api } = require('./helpers/app.js');
test('archive sends only live lead files and records kept uploads on retry', async () => {
  const ctx = await setup();
  try {
    const made = await thread(ctx); const file = path.join(ctx.state, 'threads', `${made.id}.json`);
    const stored = JSON.parse(await fs.readFile(file)); const lead = stored.sessions.find(s => s.role === 'lead').name;
    stored.cards.push({ kind: 'file', file: '1-a.txt', session: lead }, { kind: 'image', file: '1-a.txt', session: lead }, { kind: 'file', file: '2-b.txt', session: lead, retracted_at: 'now' });
    await fs.writeFile(file, JSON.stringify(stored));
    ctx.machine.uploadsRemoved = false; ctx.machine.keptUploads = ['1-a.txt'];
    await api(ctx, `/threads/${made.id}/archive`, { method: 'POST', body: {} });
    assert.equal((await api(ctx, `/threads/${made.id}/chat`)).body.thread.archived, false);
    ctx.machine.uploadsRemoved = true; ctx.machine.keptUploads = ['1-a.txt', 3];
    await api(ctx, `/threads/${made.id}/archive`, { method: 'POST', body: {} });
    assert.deepEqual(ctx.machine.calls.filter(c => c.path === '/v1/archive').at(-1).body.keep, ['1-a.txt']);
    assert.deepEqual((await api(ctx, `/threads/${made.id}/chat`)).body.thread.kept_files, ['1-a.txt']);
  } finally { await close(ctx); }
});
