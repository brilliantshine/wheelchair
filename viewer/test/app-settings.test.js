'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');
const { api, close, event, machinePost, setup, thread } = require('./helpers/app.js');
const { transcriptItems } = require('../app/chat.js');

async function withContext(work) {
  const context = await setup();
  try { await work(context); } finally { await close(context); }
}

const workerTemplate = (name, scope = 'all', text = 'Work carefully.') => ({ name, role: 'worker', scope, switches: { packages: 'ask', unsettled: 'decide' }, text });

test('settings defaults, templates, prompt composition, counts, and validation', async () => {
  await withContext(async (context) => {
    const initial = await api(context, '/settings');
    assert.equal(initial.status, 200);
    assert.deepEqual(initial.body.other_agents, { reviewer: 'heavy', verifier: 'heavy', mapper: 'standard' });
    assert.equal(initial.body.permission_mode, 'auto');
    const all = await api(context, '/settings/templates', { method: 'POST', body: workerTemplate('All workers') });
    const project = await api(context, '/settings/templates', { method: 'POST', body: workerTemplate('Project workers', '/tmp/project', 'Use the project convention.') });
    assert.equal(all.status, 201);
    await api(context, `/settings/templates/${all.body.id}`, { method: 'PUT', body: { in_use: true } });
    await api(context, `/settings/templates/${project.body.id}`, { method: 'PUT', body: { in_use: true } });
    const prompt = await api(context, '/settings/prompt?role=worker&project=%2Ftmp%2Fproject');
    assert.match(prompt.body.text, /Nothing below overrides the built-in rules above, except/);
    assert.match(prompt.body.text, /Project workers/);
    assert.doesNotMatch(prompt.body.text, /All workers/);
    assert.match(prompt.body.text, /Where the template and the brief you are given disagree, the brief wins/);
    const made = await thread(context);
    const lead = made.sessions[0];
    const sublead = await machinePost(context, '/machine/session', { calling_session: lead.name, action: 'start', role: 'sub-lead', cli: 'codex', attempt_id: 'template-sublead' });
    const worker = await machinePost(context, '/machine/session', { calling_session: sublead.body.session.name, action: 'start', role: 'worker', cli: 'codex', tier: 'heavy', attempt_id: 'template-worker' });
    assert.equal(worker.status, 200);
    const listed = await api(context, '/settings');
    assert.equal(listed.body.templates.find((item) => item.id === project.body.id).live_sessions, 1);
    const replacement = await api(context, '/settings/templates', { method: 'POST', body: workerTemplate('Replacement') });
    await api(context, `/settings/templates/${replacement.body.id}`, { method: 'PUT', body: { in_use: true } });
    const after = await api(context, '/settings');
    assert.equal(after.body.templates.find((item) => item.id === all.body.id).in_use, false);
    assert.equal((await api(context, `/settings/templates/${project.body.id}`, { method: 'DELETE' })).body.ok, true);
    assert.equal((await api(context, '/settings/prompt?role=worker&project=%2Ftmp%2Fproject')).body.text.includes('Replacement'), true);
    const invalid = await api(context, '/settings/templates', { method: 'POST', body: { ...workerTemplate('Bad'), switches: { unsettled: 'decide' }, role: 'lead' } });
    assert.equal(invalid.status, 400);
    assert.equal((await api(context, '/settings/templates/nope', { method: 'PUT', body: workerTemplate('Nope') })).status, 404);
    const enormous = await api(context, '/settings/templates', { method: 'POST', body: workerTemplate('Large', 'all', 'x'.repeat(4000)) });
    assert.equal(enormous.status, 201);
    const tooLong = await api(context, `/settings/templates/${enormous.body.id}`, { method: 'PUT', body: { in_use: true } });
    assert.equal(tooLong.status, 200);
  });
});

test('style saving, trailer delivery, chat stripping, and preview stay scoped to leads', async () => {
  await withContext(async (context) => {
    const made = await thread(context, { cli: 'codex' });
    const lead = made.sessions[0];
    const style = { length: 'balanced', lists: 'always', terms: 'avoid', never_say: ['jargon'], text: 'Use my wording.' };
    const saved = await api(context, '/settings/style', { method: 'PUT', body: style });
    assert.equal(saved.body.style_version, 1);
    await event(context, made.id, lead.name, 'turn-ended');
    await api(context, `/threads/${made.id}/messages`, { method: 'POST', body: { text: 'Please continue.' } });
    const submitted = context.machine.sessions.get(lead.name).submits.at(-1);
    assert.match(submitted, /^Please continue\.\n\n\[wc:style\]/);
    assert.match(submitted, /This replaces any earlier writing style/);
    await event(context, made.id, lead.name, 'turn-ended');
    await api(context, `/threads/${made.id}/messages`, { method: 'POST', body: { text: 'One more.' } });
    assert.equal(context.machine.sessions.get(lead.name).submits.at(-1), 'One more.');
    const rows = [{ type: 'user', origin: { kind: 'human' }, message: { content: [{ type: 'text', text: submitted }] } }].map(JSON.stringify).join('\n');
    assert.equal(transcriptItems('claude', rows, {}).at(0).text, 'Please continue.');
    const second = await thread(context, { cli: 'codex', project: '/tmp/second' });
    await event(context, second.id, second.sessions[0].name, 'turn-ended');
    await api(context, `/threads/${second.id}/messages`, { method: 'POST', body: { text: 'Fresh lead.' } });
    assert.equal(context.machine.sessions.get(second.sessions[0].name).submits.at(-1), 'Fresh lead.');
    const preview = await api(context, '/settings/style/preview', { method: 'POST', body: style });
    assert.equal(preview.status, 200);
    assert.equal(preview.body.after, 'Previewed message.');
    assert.equal(context.machine.calls.find((call) => call.path === '/v1/preview').body.model, 'claude-haiku-5-5');
    context.machine.preview = { ok: false, error: 'Claude is unavailable' };
    const previewFailure = await api(context, '/settings/style/preview', { method: 'POST', body: style });
    assert.equal(previewFailure.status, 502);
    assert.match(previewFailure.body.detail, /Preview failed/);
  });
});

test('settings model and heads-up routes reject bad input and preserve the settings file mode', async () => {
  await withContext(async (context) => {
    const model = await api(context, '/settings/models', { method: 'PUT', body: { provider: 'gpt', slot: 'critical', model: 'gpt-6-astra' } });
    assert.equal(model.status, 200);
    assert.equal((await api(context, '/settings/models', { method: 'PUT', body: { provider: 'other', slot: 'light', model: 'x' } })).status, 400);
    assert.equal((await api(context, '/settings/models/heads-up', { method: 'POST', body: { action: 'skip', model: 'gpt-6-astra' } })).status, 200);
    assert.equal((await api(context, '/settings/models/heads-up', { method: 'POST', body: { action: 'reset' } })).status, 200);
    await api(context, '/settings/preferences', { method: 'PUT', body: { permission_mode: 'bypass', other_agents: { mapper: 'critical' } } });
    const bytes = await fs.readFile(path.join(context.state, 'settings.json'));
    assert.equal((await fs.stat(path.join(context.state, 'settings.json'))).mode & 0o777, 0o600);
    assert.match(bytes.toString(), /"bypass"/);
  });
});
