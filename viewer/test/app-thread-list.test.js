'use strict';

// GET /threads?view=list: the summary the pages poll, without each thread's history.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { makeTemp } = require('../../test-support/run-dir');
const { api, card, close, setup, thread } = require('./helpers/app.js');

test('the list view keeps the summary and drops the history', async () => {
  const context = await setup();
  try {
    const made = await thread(context, { project: '/srv/proj', machine: 'hub', message: 'Faster lists' });
    const full = (await api(context, '/threads')).body.threads.find((t) => t.id === made.id);
    const lean = (await api(context, '/threads?view=list')).body.threads.find((t) => t.id === made.id);
    assert.ok(Array.isArray(full.cards) && full.sessions.length, 'the full view still carries the history');
    for (const key of ['cards', 'sent', 'delivered_ids', 'context', 'pinned', 'archive', 'queues']) assert.equal(key in lean, false, key);
    for (const key of ['id', 'title', 'project', 'machine', 'created_at', 'lead_name']) assert.deepEqual(lean[key], full[key], key);
    assert.equal(lean.sessions.length, full.sessions.length);
    for (const s of lean.sessions) {
      assert.deepEqual(Object.keys(s).sort().filter((k) => s[k] !== undefined), ['created_at', 'live', 'name', 'ready', 'role', 'turn_ended'].filter((k) => s[k] !== undefined));
      assert.ok(s.name && s.role);
    }
  } finally { await close(context); }
});

test('the list view marks a thread whose lead posted a done card', async () => {
  const bin = await makeTemp('done-gh-');
  await fs.writeFile(path.join(bin, 'gh'), `#!/bin/sh\nprintf '%s' '{"state":"OPEN","mergeStateStatus":"CLEAN","headRefOid":"${'a'.repeat(40)}"}'\n`, { mode: 0o755 });
  const context = await setup({ env: { PATH: `${bin}:${process.env.PATH}` } });
  try {
    const made = await thread(context, { project: '/srv/proj', machine: 'hub', message: 'Quick fix' });
    const file = path.join(context.state, 'threads', `${made.id}.json`);
    const data = JSON.parse(await fs.readFile(file)); data.branch = null; data.default_branch = null;
    await fs.writeFile(file, JSON.stringify(data));
    const lead = made.sessions.find((s) => s.role === 'lead');
    const lean = async () => (await api(context, '/threads?view=list')).body.threads.find((t) => t.id === made.id);
    assert.equal((await lean()).done_card, false);
    const posted = await card(context, made.id, lead.name, {
      kind: 'done', head: 'a'.repeat(40), title: 'Fixed: typo', can_do: ['Use it'], left_as_is: [], pr_url: 'https://github.com/o/r/pull/1',
    });
    assert.equal(posted.status, 202, JSON.stringify(posted.body));
    assert.equal((await lean()).done_card, true);
  } finally { await close(context); }
});

test('the list view gives a quick fix its stage from the pinned progress line', async () => {
  const context = await setup();
  try {
    const made = await thread(context, { project: '/srv/proj', machine: 'hub', message: 'Quick fix' });
    const lead = made.sessions.find((s) => s.role === 'lead');
    const lean = async () => (await api(context, '/threads?view=list')).body.threads.find((t) => t.id === made.id);
    assert.equal((await lean()).progress_stage, null);
    const steps = [
      [{ stage: 'build', done: 0, total: 1 }, 'building'],
      [{ stage: 'verify', pass: 1, phase: 'checking' }, 'verifying'],
      [{ stage: 'verify', pass: 1, phase: 'fixing', found: 1, fixed: 0 }, 'verifying'],
      [{ stage: 'verify', pass: 2, phase: 'clean' }, 'verified'],
    ];
    for (const [fields, expected] of steps) {
      const posted = await card(context, made.id, lead.name, { kind: 'progress', machines: [], choice_waiting: false, ...fields });
      assert.equal(posted.status, 202, JSON.stringify(posted.body));
      assert.equal((await lean()).progress_stage, expected);
    }
  } finally { await close(context); }
});

test('the list view leaves a planned thread to its plan, even with a progress line', async () => {
  const context = await setup();
  try {
    const made = await thread(context, { project: '/srv/proj', machine: 'hub', message: 'Planned' });
    const file = path.join(context.state, 'threads', `${made.id}.json`);
    const data = JSON.parse(await fs.readFile(file)); data.slug = 'some-plan';
    await fs.writeFile(file, JSON.stringify(data));
    const lead = made.sessions.find((s) => s.role === 'lead');
    const posted = await card(context, made.id, lead.name, { kind: 'progress', stage: 'verify', pass: 1, phase: 'clean', machines: [], choice_waiting: false });
    assert.equal(posted.status, 202, JSON.stringify(posted.body));
    const listed = (await api(context, '/threads?view=list')).body.threads.find((t) => t.id === made.id);
    assert.equal(listed.slug, 'some-plan');
    assert.equal(listed.progress_stage, null);
  } finally { await close(context); }
});
