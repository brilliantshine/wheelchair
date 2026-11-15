'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');
const { api, close, event, machinePost, setup, thread } = require('./helpers/app.js');
const { transcriptItems } = require('../app/chat.js');
const settings = require('../app/settings.js');
const { State } = require('../app/state.js');
const { MachineClient } = require('../app/machine-client.js');

async function withContext(work) {
  const context = await setup();
  try { await work(context); } finally { await close(context); }
}

const workerTemplate = (name, scope = 'all', text = 'Work carefully.') => ({ name, role: 'worker', scope, switches: { packages: 'ask', unsettled: 'decide' }, text });

test('settings defaults, templates, prompt composition, counts, and validation', async () => {
  await withContext(async (context) => {
    await fs.writeFile(path.join(context.state, 'projects.json'), JSON.stringify(['/tmp/project']));
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
    const codex = await thread(context, { cli: 'codex' });
    const claude = await thread(context, { cli: 'claude', project: '/tmp/claude' });
    const leads = [codex, claude].map((made) => ({ made, lead: made.sessions[0] }));
    const style = { length: 'balanced', lists: 'always', terms: 'avoid', never_say: ['jargon'], text: 'Use my wording.' };
    const saved = await api(context, '/settings/style', { method: 'PUT', body: style });
    assert.equal(saved.body.style_version, 1);
    for (const { made, lead } of leads) {
      await event(context, made.id, lead.name, 'turn-ended');
      await api(context, `/threads/${made.id}/messages`, { method: 'POST', body: { text: 'Please continue.' } });
      const submitted = context.machine.sessions.get(lead.name).submits.at(-1);
      assert.match(submitted, /^Please continue\.\n\n\[wc:style\]/);
      assert.match(submitted, /This replaces any earlier writing style/);
      await event(context, made.id, lead.name, 'turn-ended');
      await api(context, `/threads/${made.id}/messages`, { method: 'POST', body: { text: 'One more.' } });
      assert.equal(context.machine.sessions.get(lead.name).submits.at(-1), 'One more.');
    }
    const codexSubmitted = context.machine.sessions.get(codex.sessions[0].name).submits.at(-2);
    const rows = [{ type: 'user', origin: { kind: 'human' }, message: { content: [{ type: 'text', text: codexSubmitted }] } }].map(JSON.stringify).join('\n');
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

test('settings updates serialize concurrent saves and report a missing template project', async () => {
  await withContext(async (context) => {
    const created = await Promise.all(Array.from({ length: 10 }, (_, index) => (
      api(context, '/settings/templates', { method: 'POST', body: workerTemplate(`Concurrent ${index}`) })
    )));
    assert.ok(created.every((result) => result.status === 201));
    await fs.writeFile(path.join(context.state, 'projects.json'), JSON.stringify(['/tmp/no-longer-listed']));
    const missing = await api(context, '/settings/templates', { method: 'POST', body: workerTemplate('Old project', '/tmp/no-longer-listed') });
    assert.equal(missing.status, 201);
    await fs.writeFile(path.join(context.state, 'projects.json'), JSON.stringify([]));
    const listed = await api(context, '/settings');
    assert.equal(listed.body.templates.filter((item) => item.name.startsWith('Concurrent ')).length, 10);
    assert.equal(listed.body.templates.find((item) => item.id === missing.body.id).scope_missing, true);
  });
});

test('the role-layer cap refuses template and style saves without changing settings', async () => {
  await withContext(async (context) => {
    const state = new State(context.state);
    const settingsPath = path.join(context.state, 'settings.json');
    const hub = { state };
    const original = JSON.stringify(settings.defaults());
    await fs.writeFile(settingsPath, original);
    await assert.rejects(
      settings.update(hub, (value) => {
        value.templates.push({ id: 'too-large', name: 'Too large', role: 'lead', scope: 'all', switches: {}, text: 'x'.repeat(11400), in_use: true });
      }),
      (error) => error.status === 400 && /12000/.test(error.message),
    );
    assert.equal(await fs.readFile(settingsPath, 'utf8'), original);

    const legacy = settings.defaults();
    legacy.templates.push({ id: 'legacy-large', name: 'Legacy large', role: 'lead', scope: 'all', switches: {}, text: 'x'.repeat(11200), in_use: true });
    await fs.writeFile(settingsPath, JSON.stringify(legacy));
    const beforeStyle = await fs.readFile(settingsPath, 'utf8');
    const style = { ...legacy.style, text: 'y'.repeat(2000) };
    const refused = await api(context, '/settings/style', { method: 'PUT', body: style });
    assert.equal(refused.status, 400);
    assert.equal(await fs.readFile(settingsPath, 'utf8'), beforeStyle);
  });
});

test('preview has a 75-second machine timeout while ordinary calls retain five seconds', async () => {
  const calls = [];
  const style = { length: 'short', lists: 'when-helpful', terms: 'build-up', never_say: [], text: 'Be direct.' };
  const preview = await settings.preview({
    root: '/path/that-does-not-exist',
    call: async (...args) => { calls.push(args); return { text: 'Previewed.' }; },
  }, style);
  assert.equal(preview.after, 'Previewed.');
  assert.equal(calls[0][4], 75000);

  const originalRequest = http.request;
  const timeouts = [];
  try {
    http.request = (_url, options) => {
      timeouts.push(options.timeout);
      const request = new (require('node:events').EventEmitter)();
      request.end = () => queueMicrotask(() => request.emit('error', new Error('expected test failure')));
      request.destroy = () => {};
      return request;
    };
    const client = new MachineClient({ machine: async () => ({ address: '127.0.0.1', port: 1, secret: 'test' }) });
    await assert.rejects(client.call('hub', '/v1/status', 'GET'));
  } finally {
    http.request = originalRequest;
  }
  assert.deepEqual(timeouts, [5000]);
});

test('settings model and heads-up routes reject bad input and preserve the settings file mode', async () => {
  await withContext(async (context) => {
    const model = await api(context, '/settings/models', { method: 'PUT', body: { provider: 'gpt', slot: 'critical', model: 'gpt-6-astra' } });
    assert.equal(model.status, 200);
    const gptAlias = await api(context, '/settings/models', { method: 'PUT', body: { provider: 'gpt', slot: 'terra', model: 'custom-model' } });
    assert.equal(gptAlias.status, 200);
    assert.equal(gptAlias.body.models.gpt.standard.model, 'custom-model');
    const claudeAlias = await api(context, '/settings/models', { method: 'PUT', body: { provider: 'claude', slot: 'opus', model: 'opus' } });
    assert.equal(claudeAlias.status, 200);
    assert.equal(claudeAlias.body.models.claude.heavy.model, 'opus');
    assert.equal((await api(context, '/settings/models', { method: 'PUT', body: { provider: 'gpt', slot: 'opus', model: 'custom-model' } })).status, 400);
    assert.equal((await api(context, '/settings/models', { method: 'PUT', body: { provider: 'other', slot: 'light', model: 'x' } })).status, 400);
    const switched = await api(context, '/settings/models/heads-up', { method: 'POST', body: { action: 'switch', tier: 'sol', model: 'custom-heavy' } });
    assert.equal(switched.status, 200);
    assert.equal(switched.body.models.gpt.heavy.model, 'custom-heavy');
    assert.equal((await api(context, '/settings/models/heads-up', { method: 'POST', body: { action: 'skip', model: 'gpt-6-astra' } })).status, 200);
    assert.equal((await api(context, '/settings/models/heads-up', { method: 'POST', body: { action: 'reset' } })).status, 200);
    await api(context, '/settings/preferences', { method: 'PUT', body: { permission_mode: 'bypass', other_agents: { mapper: 'critical' } } });
    const bytes = await fs.readFile(path.join(context.state, 'settings.json'));
    assert.equal((await fs.stat(path.join(context.state, 'settings.json'))).mode & 0o777, 0o600);
    assert.match(bytes.toString(), /"bypass"/);
  });
});

test('template scopes must be listed when added or changed, while removed-project templates remain editable', async () => {
  await withContext(async (context) => {
    const settingsPath = path.join(context.state, 'settings.json');
    const projectsPath = path.join(context.state, 'projects.json');
    await fs.writeFile(projectsPath, JSON.stringify(['/tmp/listed-project']));

    const seed = await api(context, '/settings/templates', { method: 'POST', body: workerTemplate('Seed') });
    assert.equal(seed.status, 201);
    const before = await fs.readFile(settingsPath, 'utf8');
    const refused = await api(context, '/settings/templates', { method: 'POST', body: workerTemplate('Unlisted', '/tmp/unlisted-project') });
    assert.equal(refused.status, 400);
    assert.equal(refused.body.error, 'template.scope must be all or a listed project');
    assert.equal(await fs.readFile(settingsPath, 'utf8'), before);

    const created = await api(context, '/settings/templates', { method: 'POST', body: workerTemplate('Listed', '/tmp/listed-project') });
    assert.equal(created.status, 201);
    const changed = await api(context, `/settings/templates/${created.body.id}`, { method: 'PUT', body: { scope: '/tmp/unlisted-project' } });
    assert.equal(changed.status, 400);

    await fs.writeFile(projectsPath, JSON.stringify([]));
    const renamed = await api(context, `/settings/templates/${created.body.id}`, { method: 'PUT', body: { name: 'Removed project retained' } });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.scope, '/tmp/listed-project');
    assert.equal(renamed.body.name, 'Removed project retained');
  });
});
