'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, close, api, machinePost, event } = require('./helpers/app.js');

test('default placement, strict and preferred constraints, and invalid flags', async () => {
  const c = await setup();
  try {
    const made = (await api(c, '/threads', { method: 'POST', body: { project: '/tmp/placement' } })).body;
    assert.equal(made.provider, 'claude');
    assert.equal(made.sessions[0].account, 'default-claude');
    const lead = made.sessions[0].name;
    const sub = await machinePost(c, '/machine/session', { calling_session: lead, action: 'start', role: 'sub-lead', attempt_id: 'sub' });
    assert.equal(sub.body.session.provider, 'claude');
    const worker = await machinePost(c, '/machine/session', { calling_session: sub.body.session.name, action: 'start', role: 'worker', attempt_id: 'worker' });
    assert.equal(worker.body.session.provider, 'gpt');
    assert.deepEqual(c.machine.calls.find((x) => x.path === '/v1/sessions' && x.body.name === worker.body.session.name).body.account, { id: 'default-gpt', dir: null });
    const invalid = await machinePost(c, '/machine/session', { calling_session: lead, action: 'start', role: 'mapper', provider: 'gpt', attempt_id: 'bad' });
    assert.equal(invalid.status, 400);
    const failed = await event(c, made.id, lead, 'turn-failed', { error: 'broken' });
    assert.equal(failed.status, 202);
    let current = (await api(c, `/threads/${made.id}/chat`)).body.thread;
    assert.ok(current.cards.some((card) => card.title === "The lead's turn failed" && !card.answered));
    await event(c, made.id, lead, 'turn-ended');
    current = (await api(c, `/threads/${made.id}/chat`)).body.thread;
    assert.ok(current.cards.some((card) => card.title === "The lead's turn failed" && card.answered));
  } finally { await close(c); }
});
