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
    assert.ok(initial.body.accounts.some((account) => account.id === 'default-gemini'));
    assert.deepEqual(initial.body.worker_order, ['gpt', 'claude', 'gemini', 'kimi']);
    assert.ok(initial.body.accounts.some((account) => account.id === 'default-kimi'));
    assert.deepEqual(initial.body.other_agents, { reviewer: 'heavy', verifier: 'heavy', mapper: 'standard', designer: 'standard', scout: 'light', 'scout-heavy': 'standard' });
    const old = settings.normalize({ other_agents: { mapper: 'heavy' }, held_back: { worker: false, reviewer: true, verifier: false, mapper: false } });
    assert.equal(old.other_agents.designer, 'standard');
    assert.deepEqual(old.held_back, { worker: false, reviewer: true, verifier: false, mapper: false, designer: true });
    assert.equal(initial.body.held_back.designer, true);
    assert.equal(initial.body.permission_mode, 'auto');
    assert.equal(initial.body.codex_mode, 'sandboxed');
    assert.equal(initial.body.tool_steps, 'show');
    assert.equal((await api(context, '/settings/preferences', { method: 'PUT', body: { codex_mode: 'yolo' } })).status, 400);
    const unrestricted = await api(context, '/settings/preferences', { method: 'PUT', body: { codex_mode: 'unrestricted' } });
    assert.equal(unrestricted.body.codex_mode, 'unrestricted');
    assert.equal((await api(context, '/settings')).body.codex_mode, 'unrestricted');
    assert.equal(initial.body.aside_access, 'read-only');
    assert.equal((await api(context, '/settings/preferences', { method: 'PUT', body: { aside_access: 'bypass' } })).status, 400);
    assert.equal((await api(context, '/settings/preferences', { method: 'PUT', body: { aside_access: 'full' } })).body.aside_access, 'full');
    assert.equal((await api(context, '/settings')).body.aside_access, 'full');
    assert.equal(initial.body.auto_merge, 'off');
    const autoMergeError = await api(context, '/settings/preferences', { method: 'PUT', body: { auto_merge: 'maybe' } });
    assert.equal(autoMergeError.status, 400);
    assert.match(JSON.stringify(autoMergeError.body), /auto_merge must be off or on/);
    assert.equal((await api(context, '/settings/preferences', { method: 'PUT', body: { auto_merge: 'on' } })).body.auto_merge, 'on');
    assert.equal((await api(context, '/settings')).body.auto_merge, 'on');
    assert.equal((await api(context, '/settings/preferences', { method: 'PUT', body: { auto_merge: 'off' } })).body.auto_merge, 'off');
    assert.equal(initial.body.auto_merge_delete_branch, 'off');
    assert.match(JSON.stringify((await api(context, '/settings/preferences', { method: 'PUT', body: { auto_merge_delete_branch: 'yes' } })).body), /auto_merge_delete_branch must be off or on/);
    assert.equal((await api(context, '/settings/preferences', { method: 'PUT', body: { auto_merge_delete_branch: 'on' } })).body.auto_merge_delete_branch, 'on');
    assert.equal((await api(context, '/settings')).body.auto_merge_delete_branch, 'on');
    assert.equal((await api(context, '/settings/preferences', { method: 'PUT', body: { auto_merge_delete_branch: 'off' } })).body.auto_merge_delete_branch, 'off');
    const all = await api(context, '/settings/templates', { method: 'POST', body: workerTemplate('All workers') });
    const project = await api(context, '/settings/templates', { method: 'POST', body: workerTemplate('Project workers', '/tmp/project', 'Use the project convention.') });
    assert.equal(all.status, 201);
    await api(context, `/settings/templates/${all.body.id}`, { method: 'PUT', body: { in_use: true } });
    await api(context, `/settings/templates/${project.body.id}`, { method: 'PUT', body: { in_use: true } });
    const prompt = await api(context, '/settings/prompt?role=worker&project=%2Ftmp%2Fproject');
    assert.match(prompt.body.text, /^Role: worker\n/);
    assert.match(prompt.body.text, /Your role rules and card rules are below, already loaded: do not read these files again unless this text is no longer in your context\. `<root>` is `[^`]+`\./);
    assert.match(prompt.body.text, /\[full text of protocol\/app\/worker\.md\]\n\[full text of protocol\/app\/repo-law\.md\]\n\[full text of protocol\/app\/cards\.md\]/);
    assert.doesNotMatch(prompt.body.text, /before responding/);
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

test('settings prompt preview composes role and card rule placeholders by role', async () => {
  await withContext(async (context) => {
    const lead = (await api(context, '/settings/prompt?role=lead')).body.text;
    assert.match(lead, /^Role: lead\nYour role rules and card rules are below, already loaded: do not read these files again unless this text is no longer in your context\. `<root>` is `[^`]+`\./);
    const leadFiles = ['[full text of protocol/app/lead.md]', '[full text of protocol/app/realism.md]', '[full text of protocol/app/repo-law.md]', '[full text of protocol/app/cards.md]', '[full text of protocol/app/cards-lead.md]'];
    let cursor = 0;
    for (const file of leadFiles) {
      const index = lead.indexOf(file, cursor);
      assert.ok(index >= cursor, `${file} should appear in order before the layers`);
      cursor = index + file.length;
    }
    assert.ok(lead.indexOf('Nothing below overrides') > cursor);

    const reviewer = (await api(context, '/settings/prompt?role=reviewer')).body.text;
    assert.match(reviewer, /^Role: reviewer\nYour role rules are below, already loaded: do not read these files again unless this text is no longer in your context\. `<root>` is `[^`]+`\./);
    assert.match(reviewer, /\[full text of protocol\/app\/reviewer\.md\]/);
    assert.match(reviewer, /\[full text of protocol\/app\/reviewer\.md\]\n\[full text of protocol\/app\/realism\.md\]\n\[full text of protocol\/app\/repo-law\.md\]/);
    assert.doesNotMatch(reviewer, /\[full text of protocol\/app\/cards(?:-lead)?\.md\]/);

    const worker = (await api(context, '/settings/prompt?role=worker')).body.text;
    assert.match(worker, /\[full text of protocol\/app\/worker\.md\]\n\[full text of protocol\/app\/repo-law\.md\]\n\[full text of protocol\/app\/cards\.md\]/);
    assert.doesNotMatch(worker, /realism\.md/);
    assert.doesNotMatch(worker, /cards-lead\.md/);
    for (const role of ['lead', 'sub-lead', 'worker', 'mapper', 'designer', 'reviewer', 'verifier']) {
      const output = (await api(context, `/settings/prompt?role=${role}`)).body.text;
      const roleFile = `[full text of protocol/app/${role}.md]`;
      const lawFile = '[full text of protocol/app/repo-law.md]';
      const cards = !['reviewer', 'verifier'].includes(role);
      const realism = ['lead', 'sub-lead', 'reviewer', 'verifier'].includes(role);
      const lawIndex = output.indexOf(lawFile);
      assert.ok(lawIndex > output.indexOf(roleFile), `${role} includes repo-law after role file`);
      if (realism) assert.ok(lawIndex > output.indexOf('[full text of protocol/app/realism.md]'), `${role} includes repo-law after realism`);
      if (cards) assert.ok(lawIndex < output.indexOf('[full text of protocol/app/cards.md]'), `${role} includes repo-law before cards`);
    }
    for (const output of [lead, reviewer, worker]) assert.doesNotMatch(output, /before responding/);
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
    const pin = await api(context, '/settings/models', { method: 'PUT', body: { provider: 'gpt', slot: 'heavy', model: 'custom-heavy', effort: 'xhigh' } });
    assert.equal(pin.body.models.gpt.heavy.effort, 'xhigh');
    const invalidEffort = await api(context, '/settings/models', { method: 'PUT', body: { provider: 'gpt', slot: 'heavy', model: 'custom-heavy', effort: 'max' } });
    assert.equal(invalidEffort.body.detail, 'effort for GPT must be one of low, medium, high, xhigh');
    const switched = await api(context, '/settings/models/heads-up', { method: 'POST', body: { action: 'switch', tier: 'sol', model: 'custom-heavy' } });
    assert.equal(switched.status, 200);
    assert.equal(switched.body.models.gpt.heavy.model, 'custom-heavy');
    assert.equal(switched.body.models.gpt.heavy.effort, 'xhigh');
    const cleared = await api(context, '/settings/models', { method: 'PUT', body: { provider: 'gpt', slot: 'heavy', model: 'custom-heavy' } });
    assert.ok(!cleared.body.models.gpt.heavy.effort);
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
    assert.equal(refused.body.detail, 'template.scope must be all or a listed project');
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

test('escalation settings, sentences, and role layers', async () => {
  const defaults = settings.defaults();
  const sentences = settings.escalationSentences(defaults.escalation);
  assert.deepEqual(sentences, [
    'A worker that came back wrong gets a rewritten brief and a fresh session; each step up comes after one failed try.',
    'Raise effort first, one level at a time from the tier\'s own effort ("CLI default" counts as high), up to xhigh, then move to the next tier and repeat, up to Critical. A tier\'s own effort setting is used as is, and a tier already at xhigh or above takes no effort step.',
    'Before moving a task to Critical, ask the lead, who asks the user.',
    'A task still failing at the limits is reported as blocked.',
  ]);
  const variant = { ...defaults.escalation, first: 'model', max_effort: 'max', max_tier: 'heavy', ask_before: 'any' };
  assert.equal(settings.escalationSentences(variant)[1], 'Move up one tier at a time, up to Heavy, at each tier\'s own effort; then raise effort at the top tier, one level at a time from its own effort ("CLI default" counts as high), up to max (GPT stops at xhigh, which is its highest). A tier already at max or above takes no effort step.');
  assert.equal(settings.escalationSentences(variant)[2], 'Before any step up, ask the lead, who asks the user.');
  assert.match(settings.escalationSentences({ ...variant, ask_before: 'never' })[2], /^Do not stop to ask/);
  assert.equal(settings.escalationSentences({ ...variant, ask_before: 'critical' }).length, 3);
  assert.deepEqual(settings.normalize({ escalation: { first: 'bad', max_tier: 'heavy' } }).escalation, { ...defaults.escalation, max_tier: 'heavy' });
  const layers = settings.roleLayers(defaults, 'sub-lead').text;
  assert.ok(layers.includes(`Escalation rules from Settings:\n${sentences.join('\n')}`));
  for (const role of ['lead', 'worker', 'reviewer', 'verifier', 'mapper', 'designer']) assert.ok(!settings.roleLayers(defaults, role).text.includes('Escalation rules from Settings:'));
  await withContext(async (context) => {
    const initial = (await api(context, '/settings')).body;
    assert.deepEqual(initial.escalation, defaults.escalation);
    assert.equal(initial.escalation_text, sentences.join('\n'));
    const saved = await api(context, '/settings/preferences', { method: 'PUT', body: { escalation: variant } });
    assert.deepEqual(saved.body.escalation, variant);
    assert.equal(saved.body.escalation_text, settings.escalationSentences(variant).join('\n'));
    for (const [key, allowed] of Object.entries(settings.ESCALATION_VALUES)) {
      const bad = await api(context, '/settings/preferences', { method: 'PUT', body: { escalation: { [key]: 'invalid' } } });
      assert.equal(bad.status, 400);
      assert.equal(bad.body.detail, `escalation.${key} must be one of ${allowed.join(', ')}`);
    }
    for (const value of [null, [], 'bad']) assert.equal((await api(context, '/settings/preferences', { method: 'PUT', body: { escalation: value } })).body.detail, 'escalation must be an object');
    assert.equal((await api(context, '/settings/preferences', { method: 'PUT', body: { escalation: { unknown: 'bad' } } })).body.detail, 'escalation.unknown is not a setting');
  });
});

test('lead name settings trim and validate names', async () => {
  await withContext(async (context) => {
    assert.deepEqual((await api(context, '/settings')).body.lead_names, []);
    const save = (lead_names) => api(context, '/settings/preferences', { method: 'PUT', body: { lead_names } });
    assert.deepEqual((await save([' Ada ', '', 'Grace'])).body.lead_names, ['Ada', 'Grace']);
    assert.deepEqual((await api(context, '/settings')).body.lead_names, ['Ada', 'Grace']);
    for (const names of [['Ada', 'ada'], ['x'.repeat(41)], Array.from({ length: 1001 }, (_, i) => String(i)), [3], 'Ada']) assert.equal((await save(names)).status, 400);
  });
});

test('lead name list choice saves, validates and migrates', async () => {
  await withContext(async (context) => {
    assert.equal((await api(context, '/settings')).body.lead_name_list, 'greek');
    const put = (body) => api(context, '/settings/preferences', { method: 'PUT', body });
    assert.equal((await put({ lead_name_list: 'stars' })).body.lead_name_list, 'stars');
    assert.equal((await api(context, '/settings')).body.lead_name_list, 'stars');
    assert.equal((await put({ lead_name_list: 'klingon' })).status, 400);
    const custom = await put({ lead_names: ['Ada', 'Grace'], lead_name_list: 'custom' });
    assert.deepEqual([custom.body.lead_name_list, custom.body.lead_names], ['custom', ['Ada', 'Grace']]);
    assert.equal((await put({ lead_name_list: 'nato' })).body.lead_name_list, 'nato');
    assert.equal((await put({ lead_names: ['Ada'] })).body.lead_name_list, 'custom', 'names alone still turn the custom list on');
    assert.equal((await put({ lead_names: [] })).body.lead_name_list, 'greek', 'clearing custom names goes back to Greek');
  });
  assert.equal(settings.normalize({ lead_names: ['Ada'] }).lead_name_list, 'custom');
  assert.equal(settings.normalize({}).lead_name_list, 'greek');
});


test('gemini settings migrate and enforce account and model rules', async () => {
  const saved = settings.normalize({ worker_order: ['claude', 'gpt'], lead_order: ['gpt', 'any'], review_families: 'gemini', accounts: [] });
  assert.deepEqual(saved.worker_order, ['claude', 'gpt', 'gemini', 'kimi']);
  assert.deepEqual(saved.worker_order_seen, ['claude', 'gpt', 'gemini', 'kimi', 'openrouter']);
  assert.deepEqual(settings.normalize(saved).worker_order, saved.worker_order);
  assert.deepEqual(settings.defaults().worker_order_seen, ['claude', 'gpt', 'gemini', 'kimi', 'openrouter']);
  assert.deepEqual(saved.lead_order, ['gpt', 'any']);
  assert.ok(saved.accounts.some((account) => account.id === 'default-gemini'));
  assert.equal(saved.review_families, 'gemini');
  assert.equal(settings.normalize({ review_families: 'bogus' }).review_families, 'both');
  await withContext(async (context) => {
    const account = await api(context, '/settings/accounts', { method: 'POST', body: { provider: 'gemini', name: 'another', plan: 'pro' } });
    assert.equal(account.status, 400);
    assert.equal(account.body.detail, 'Antigravity supports one account per machine');
    const model = await api(context, '/settings/models', { method: 'PUT', body: { provider: 'gemini', slot: 'heavy', model: 'gemini-3.8-flash-high', effort: 'max' } });
    assert.equal(model.status, 200);
    assert.equal(model.body.models.gemini.heavy.effort, 'max');
    assert.equal((await api(context, '/settings/preferences', { method: 'PUT', body: { review_families: 'gemini' } })).body.review_families, 'gemini');
  });
});


test('removed worker providers stay removed after saving', async () => {
  await withContext(async (context) => {
    for (const worker_order of [['claude', 'gemini'], ['gpt', 'claude']]) {
      const saved = await api(context, '/settings/balancing', { method: 'PUT', body: { worker_order } });
      assert.equal(saved.status, 200);
      assert.deepEqual((await api(context, '/settings')).body.worker_order, worker_order);
      const stored = JSON.parse(await fs.readFile(path.join(context.state, 'settings.json'), 'utf8'));
      assert.deepEqual(stored.worker_order_seen, ['claude', 'gpt', 'gemini', 'kimi', 'openrouter']);
    }
  });
});

test('scout preferences and session layers follow the selected provider', async () => {
  await withContext(async (context) => {
    assert.equal(settings.normalize({ other_agents: { mapper: 'heavy' } }).other_agents.scout, 'light');
    const saved = await api(context, '/settings/preferences', { method: 'PUT', body: { other_agents: { scout: 'standard', 'scout-heavy': 'heavy' } } });
    assert.equal(saved.body.other_agents.scout, 'standard');
    assert.equal((await api(context, '/settings')).body.other_agents['scout-heavy'], 'heavy');
    assert.equal((await api(context, '/settings/preferences', { method: 'PUT', body: { other_agents: { scout: 'bad' } } })).status, 400);
    await api(context, '/settings/preferences', { method: 'PUT', body: { other_agents: { scout: 'light', 'scout-heavy': 'standard' } } });
    const claude = await thread(context, { cli: 'claude' });
    const lead = claude.sessions[0];
    assert.match(context.machine.sessions.get(lead.name).role_layers, /Scout model for code reading: haiku\./);
    const sub = await machinePost(context, '/machine/session', { calling_session: lead.name, action: 'start', role: 'sub-lead', cli: 'claude', attempt_id: 'scout-sub' });
    const layers = context.machine.sessions.get(sub.body.session.name).role_layers;
    assert.match(layers, /Agent tool with model "haiku"/);
    assert.match(layers, /Scout for bigger worker changes \(200 to 800 lines\): sonnet\./);
    const gpt = await thread(context, { cli: 'codex', project: '/tmp/scout-gpt' });
    assert.match(context.machine.sessions.get(gpt.sessions[0].name).role_layers, /Scout model for code reading: gpt-6-luna\./);
    assert.doesNotMatch(context.machine.sessions.get(gpt.sessions[0].name).role_layers, /Claude Code/);
    await api(context, '/settings/models', { method: 'PUT', body: { provider: 'claude', slot: 'light', model: null } });
    const none = await thread(context, { cli: 'claude', project: '/tmp/scout-none' });
    assert.match(context.machine.sessions.get(none.sessions[0].name).role_layers, /Scout model for code reading: none on this CLI\. Read code yourself\./);
    for (const role of ['worker', 'reviewer', 'verifier', 'mapper', 'designer']) assert.doesNotMatch(settings.roleLayers(settings.defaults(), role, '', { light: 'haiku', heavy: 'sonnet' }, 'claude').text, /Scout model/);
  });
});

test('model ID limits protect near-limit scout role layers', async () => {
  await withContext(async (context) => {
    const putModel = (model, slot = 'light') => api(context, '/settings/models', { method: 'PUT', body: { provider: 'gpt', slot, model } });
    for (const length of [65, 250]) {
      const refused = await putModel('x'.repeat(length));
      assert.equal(refused.status, 400);
      assert.equal(refused.body.detail, 'model is invalid');
    }
    const model = 'x'.repeat(64);
    assert.equal((await putModel(model)).status, 200);
    assert.equal((await putModel(model, 'standard')).status, 200);
    const style = { ...settings.defaults().style, text: 'y'.repeat(2000), never_say: ['z'.repeat(9000)] };
    const saved = await api(context, '/settings/style', { method: 'PUT', body: style });
    assert.ok([200, 400].includes(saved.status));
    if (saved.status === 400) {
      assert.match(saved.body.detail, /12000/);
      return;
    }
    const made = await thread(context, { cli: 'codex', project: '/tmp/limit-scout' });
    const lead = made.sessions[0];
    const leadLayers = context.machine.sessions.get(lead.name).role_layers;
    assert.ok(leadLayers.includes(model));
    assert.ok(leadLayers.length <= 12000);
    const sub = await machinePost(context, '/machine/session', { calling_session: lead.name, action: 'start', role: 'sub-lead', cli: 'codex', attempt_id: 'limit-scout-sub' });
    assert.equal(sub.status, 200);
    const subLayers = context.machine.sessions.get(sub.body.session.name).role_layers;
    assert.ok(subLayers.includes(model));
    assert.ok(subLayers.length <= 12000);
  });
});

test('your name is saved, validated, and told to every agent only when set', async () => {
  const defaults = settings.defaults();
  for (const role of settings.ROLES) assert.doesNotMatch(settings.roleLayers(defaults, role).text, /The user’s name is/);
  const named = { ...defaults, user_name: 'Sam' };
  for (const role of settings.ROLES) assert.ok(settings.roleLayers(named, role).text.includes('The user’s name is Sam. Where these rules say "the user", that is Sam; call them by it.'));
  assert.equal(settings.normalize({ user_name: 'x\ny' }).user_name, '');
  assert.equal(settings.normalize({ user_name: 7 }).user_name, '');
  await withContext(async (context) => {
    assert.equal((await api(context, '/settings')).body.user_name, '');
    const put = (user_name) => api(context, '/settings/preferences', { method: 'PUT', body: { user_name } });
    assert.equal((await put('  Sam  ')).body.user_name, 'Sam');
    assert.equal((await api(context, '/settings')).body.user_name, 'Sam');
    assert.equal((await put('a'.repeat(81))).status, 400);
    assert.equal((await put('two\nlines')).status, 400);
    assert.equal((await put(5)).status, 400);
    assert.equal((await api(context, '/settings')).body.user_name, 'Sam');
    assert.equal((await put('')).body.user_name, '');
  });
});
