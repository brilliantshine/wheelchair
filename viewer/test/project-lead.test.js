'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { api, card, close, event, machinePost, setup, thread } = require('./helpers/app.js');
const { makeDir } = require('./helpers/server.js');
const { Hub } = require('../app/hub.js');
const settings = require('../app/settings.js');
const sessions = require('../app/sessions.js');
const { emptyThread } = require('../app/threads.js');

const project = '/tmp/project';
const projectStatus = (c, id) => api(c, id === undefined ? '/project-lead' : '/project-lead?thread=' + id);
const preferences = (c, body) => api(c, '/settings/preferences', { method: 'PUT', body });
const post = (c, route, body = {}) => api(c, route, { method: 'POST', body });
const create = (c, machine = 'hub', projectPath = project) => post(c, '/project-leads', { machine, path: projectPath });

function refused(response, status, text) {
  assert.equal(response.status, status, JSON.stringify(response.body));
  assert.match(JSON.stringify(response.body), text);
}

async function seed(c, fields = {}) {
  const record = { ...emptyThread({ machine: 'hub', project }), ...fields };
  const dir = path.join(c.state, 'threads');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, record.id + '.json'), JSON.stringify(record));
  return record;
}

async function edit(c, id, change) {
  const file = path.join(c.state, 'threads', id + '.json');
  const record = JSON.parse(await fs.readFile(file, 'utf8'));
  change(record);
  await fs.writeFile(file, JSON.stringify(record));
  return record;
}

async function enableAndCreate(c) {
  assert.equal((await preferences(c, { project_leads: 'on' })).body.project_leads, 'on');
  const created = await create(c);
  assert.equal(created.status, 200, JSON.stringify(created.body));
  return created.body.thread;
}

test('concurrent opens share a record across the hub alias and hostname, with separate projects on a second machine', async (t) => {
  const c = await setup();
  t.after(() => close(c));
  const entry = { name: 'local-host', address: '127.0.0.1', port: c.machine.port, secret: c.machine.secret };
  await fs.writeFile(path.join(c.state, 'machine.json'), JSON.stringify({ host: entry.address, port: entry.port }));
  await fs.writeFile(path.join(c.state, 'machines.json'), JSON.stringify({
    'local-host': entry,
    'other-host': { ...entry, name: 'other-host', address: 'localhost' },
  }));
  const local = await seed(c);
  const remote = await seed(c, { machine: 'other-host' });
  const anotherPath = await seed(c, { project: '/another/project' });
  const assistant = await seed(c, { assistant: true, project: null });
  assert.equal((await preferences(c, { project_leads: 'on', assistant: 'off' })).status, 200);
  const [alias, host, other, another] = await Promise.all([
    create(c), create(c, 'local-host'), create(c, 'other-host'), create(c, 'hub', anotherPath.project),
  ]);
  for (const response of [alias, host, other, another]) assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.deepEqual(alias.body, host.body);
  assert.equal(new Set([alias.body.thread, other.body.thread, another.body.thread]).size, 3);
  assert.equal((await projectStatus(c, local.id)).body.thread, alias.body.thread);
  assert.equal((await projectStatus(c, remote.id)).body.thread, other.body.thread);
  const listed = (await api(c, '/threads?view=list')).body.threads;
  assert.equal(listed.find((row) => row.id === local.id).machine_key, 'local-host');
  assert.equal(listed.find((row) => row.id === remote.id).machine_key, 'other-host');
  assert.equal(listed.some((row) => row.id === assistant.id), false);
  const leads = listed.filter((row) => row.project_lead);
  assert.equal(leads.length, 3);
  const lead = leads.find((row) => row.id === alias.body.thread);
  assert.deepEqual([lead.project, lead.machine, lead.machine_key, lead.title], [project, 'hub', 'local-host', 'project lead']);
  assert.deepEqual(lead.sessions, []);
  for (const field of ['branch', 'slug', 'pr_url']) assert.equal(Object.hasOwn(lead, field), false);
  assert.equal(c.machine.calls.some((call) => call.path === '/v1/sessions' && call.body?.thread_id), false);
});

test('project status is read-only and requires a non-archived ordinary thread in the project', async (t) => {
  const c = await setup();
  t.after(() => close(c));
  const active = await seed(c);
  const archived = await seed(c, { archived: true, project: '/tmp/archived' });
  const assistant = await seed(c, { assistant: true, project: null });
  assert.equal((await api(c, '/settings')).body.project_leads, 'off');
  assert.deepEqual((await projectStatus(c)).body, { on: false });
  assert.deepEqual((await projectStatus(c, active.id)).body, { on: false });
  refused(await create(c), 404, /project leads are off/);
  refused(await preferences(c, { project_leads: 'maybe' }), 400, /project_leads must be off or on/);
  assert.equal((await preferences(c, { project_leads: 'on' })).status, 200);
  assert.equal((await api(c, '/settings')).body.assistant, 'off');
  assert.deepEqual((await projectStatus(c)).body, { on: true });
  const before = (await fs.readdir(path.join(c.state, 'threads'))).sort();
  assert.deepEqual((await projectStatus(c, active.id)).body, {
    on: true, project: { machine: 'hub', path: project, name: 'project' }, thread: null, lead_live: false,
  });
  for (const id of ['', archived.id, assistant.id, 'missing']) {
    assert.deepEqual((await projectStatus(c, id)).body, { on: true, project: null });
  }
  assert.deepEqual((await fs.readdir(path.join(c.state, 'threads'))).sort(), before);
  refused(await create(c, 'hub', archived.project), 404, /no such project/);
  const id = (await create(c)).body.thread;
  assert.ok(id);
  assert.deepEqual((await projectStatus(c, id)).body, { on: true, project: null });
  await edit(c, active.id, (record) => { record.archived = true; });
  assert.deepEqual((await projectStatus(c, active.id)).body, { on: true, project: null });
  refused(await create(c), 404, /no such project/);
  await edit(c, active.id, (record) => { record.archived = false; });
  assert.deepEqual((await create(c)).body, { thread: id });
});

test('project lead start forces the sandbox and includes only the project role layers', async (t) => {
  const c = await setup();
  t.after(() => close(c));
  const normal = await thread(c);
  const id = await enableAndCreate(c);
  assert.equal((await preferences(c, { user_name: 'Collin', codex_mode: 'unrestricted' })).status, 200);
  for (const role of ['lead', 'reviewer']) {
    const lesson = await card(c, normal.id, normal.sessions[0].name, {
      kind: 'lesson', action: 'add', for: role, text: 'Private ' + role + ' lesson', why: 'Test fixture',
    });
    assert.equal(lesson.status, 202, JSON.stringify(lesson.body));
  }
  const hub = new Hub({ stateDir: await makeDir('project-lead-start-') });
  await hub.state.init();
  await fs.copyFile(path.join(c.state, 'machines.json'), path.join(hub.stateDir, 'machines.json'));
  await fs.copyFile(path.join(c.state, 'settings.json'), path.join(hub.stateDir, 'settings.json'));
  await fs.copyFile(path.join(c.state, 'threads', id + '.json'), path.join(hub.stateDir, 'threads', id + '.json'));
  const record = await hub.thread(id);
  await sessions.startSession(hub, record, { role: 'lead', brief: '', tier: 'top', worktree: '/ignore', branch: 'ignore', from_remote_branch: { sha: 'ignore' } });
  const start = c.machine.calls.find((call) => call.path === '/v1/sessions' && call.body?.thread_id === id)?.body;
  assert.ok(start);
  assert.equal(start.project_lead, true);
  assert.equal(start.prompt_role, 'project-lead');
  assert.equal(start.project_dir, project);
  assert.equal(start.project, 'project');
  assert.equal(start.project_machine, 'hub');
  assert.equal(start.codex_mode, 'sandboxed');
  for (const field of ['worktree', 'branch', 'assistant', 'from_remote_branch']) assert.equal(Object.hasOwn(start, field), false, field);
  assert.match(start.role_layers, /The user’s name is Collin/);
  assert.match(start.role_layers, /writing style/);
  assert.match(start.role_layers, /Scout model for code reading/);
  assert.doesNotMatch(start.role_layers, /Private .* lesson|Nothing below overrides|behavior template/i);
  assert.equal(Object.hasOwn(await hub.thread(id), 'branch'), false);
});

test('off stops sessions, hides records, and guards direct thread routes', async (t) => {
  const c = await setup();
  t.after(() => close(c));
  const normal = await thread(c);
  const id = await enableAndCreate(c);
  const assistant = await seed(c, { assistant: true, project: null });
  assert.equal((await preferences(c, { assistant: 'on' })).status, 200);
  const started = await post(c, `/threads/${id}/restart`);
  assert.equal(started.status, 201, JSON.stringify(started.body));
  assert.equal((await projectStatus(c, normal.id)).body.lead_live, true);
  refused(await post(c, `/threads/${id}/archive`), 409, /a project lead can't be archived/);
  refused(await post(c, `/threads/${id}/export`), 409, /a project lead can't be handed off or exported/);
  refused(await post(c, `/threads/${id}/asides`), 403, /no asides in a project lead thread/);
  assert.equal((await preferences(c, { project_leads: 'off' })).body.project_leads, 'off');
  assert.equal(c.machine.sessions.get(started.body.name).running, false);
  const listed = (await api(c, '/threads')).body.threads;
  assert.equal(listed.some((row) => row.id === id), false);
  assert.equal(listed.find((row) => row.id === assistant.id).machine_key, 'hub');
  for (const suffix of ['', '/chat', '/handoff']) refused(await api(c, `/threads/${id}${suffix}`), 404, /project leads are off/);
  for (const suffix of ['/archive', '/restart', '/messages']) refused(await post(c, `/threads/${id}${suffix}`), 404, /project leads are off/);
  assert.equal((await preferences(c, { project_leads: 'on' })).status, 200);
  assert.equal((await projectStatus(c, normal.id)).body.thread, id);
  assert.equal((await projectStatus(c, normal.id)).body.lead_live, false);
});

test('project lead sessions cannot use the machine session relay or receive cross-thread cards', async (t) => {
  const c = await setup();
  t.after(() => close(c));
  const normal = await thread(c);
  const id = await enableAndCreate(c);
  const lead = { name: `wc-${id}-lead`, role: 'lead', live: true, queue: [] };
  await edit(c, id, (record) => { record.sessions.push(lead); });
  for (const action of ['start', 'leads', 'list', 'stop']) {
    const result = await machinePost(c, '/machine/session', { calling_session: lead.name, action, role: 'worker', all_projects: true });
    refused(result, 403, /a project lead can't do that/);
  }
  const from = normal.sessions[0].name;
  refused(await card(c, normal.id, from, { kind: 'message', to: lead.name, text: 'Hello' }), 422, /a project lead takes messages only from the user/);
  assert.equal((await preferences(c, { user_name: 'Collin' })).status, 200);
  refused(await card(c, normal.id, from, { kind: 'reach', thread: id, why: 'Work overlaps' }), 422, /a project lead takes messages only from Collin/);
  refused(await card(c, id, lead.name, { kind: 'lesson', action: 'add', for: 'lead', text: 'Wrong kind', why: 'Test fixture' }), 422, /a project lead doesn't post lesson/);
});

test('features and peer discovery exclude project leads but Needs you keeps their open questions', async (t) => {
  const c = await setup();
  t.after(() => close(c));
  const normal = await thread(c);
  const id = await enableAndCreate(c);
  const lead = { name: `wc-${id}-lead`, role: 'lead', live: true, queue: [] };
  await edit(c, id, (record) => {
    record.slug = 'should-not-appear';
    record.last_status = 'implementing';
    record.sessions.push(lead);
  });
  const question = await card(c, id, lead.name, {
    kind: 'question', fits: 'Fits', question: 'Choose?', options: [{ id: 'a', label: 'Yes', consequence: 'Yes' }, { id: 'b', label: 'No', consequence: 'No' }], leaning: 'a', why: 'Why',
  });
  assert.equal(question.status, 202, JSON.stringify(question.body));
  const control = await seed(c, { slug: 'control', sessions: [{ name: 'control-lead', role: 'lead', live: true }] });
  const features = await api(c, '/features');
  assert.equal(features.status, 200);
  const { needs, ...groups } = features.body;
  assert.ok(!Object.values(groups).flat().some((row) => row.id === id));
  assert.ok(Object.values(groups).flat().some((row) => row.id === control.id));
  assert.deepEqual(needs.filter((item) => item.thread_id === id).map((item) => item.card_id), [question.body.id]);
  const peers = await machinePost(c, '/machine/session', { calling_session: normal.sessions[0].name, action: 'leads', all_projects: true });
  assert.equal(peers.status, 200, JSON.stringify(peers.body));
  assert.deepEqual(peers.body.leads.map((entry) => entry.thread), [control.id]);
  await edit(c, normal.id, (record) => { record.project = '/tmp/now-different'; });
  await edit(c, control.id, (record) => { record.project = '/tmp/now-different'; });
  assert.ok(!(await api(c, '/new-thread')).body.previous.includes(project));
});

test('restart drops old card messages and renders the project lead fresh-context line', async (t) => {
  const c = await setup();
  t.after(() => close(c));
  await thread(c);
  const id = await enableAndCreate(c);
  await edit(c, id, (record) => {
    record.sessions.push({ name: `wc-${id}-lead`, role: 'lead', live: false, queue: [
      { text: 'Waiting user message', source: 'user' }, { text: 'Old card answer', source: 'card' },
    ] });
    record.cards.push({ id: 'q', kind: 'question', answered: false }, { id: 'n', kind: 'needs', answered: false });
    record.sent.push({ text: 'Old history', source: 'user' });
  });
  const restarted = await post(c, `/threads/${id}/restart`);
  assert.equal(restarted.status, 201, JSON.stringify(restarted.body));
  const saved = JSON.parse(await fs.readFile(path.join(c.state, 'threads', id + '.json'), 'utf8'));
  const queue = saved.sessions.at(-1).queue;
  assert.ok(queue.some((message) => message.text === 'Waiting user message'));
  assert.ok(!queue.some((message) => message.source === 'card'));
  const context = queue.find((message) => message.source === 'context')?.text;
  assert.equal(context, `[wc:context restart] Thread state:\n${JSON.stringify({ thread: id, title: 'project lead', project_lead: true })}`);
  for (const old of saved.cards.filter((item) => ['q', 'n'].includes(item.id))) assert.equal(old.retracted_note, 'The project lead restarted');
  const { renderTurn } = require('../../connectors/hub-common.js');
  assert.equal(renderTurn({ human: context, replies: [] }, saved)[0].text, 'Project lead restarted · starting fresh');
});

test('auto-merge ignores an otherwise eligible project lead record', async () => {
  const hub = new Hub({ stateDir: await makeDir('project-lead-auto-merge-') });
  await hub.state.init();
  await settings.update(hub, (value) => { value.auto_merge = 'on'; });
  const head = 'a'.repeat(40);
  const cards = [
    { kind: 'done', head, pr_url: 'https://github.com/o/r/pull/1', verified: true },
    { id: 'check', kind: 'check', head, steps: [{ agent: 'not-tried' }] },
  ];
  const ordinary = { ...emptyThread({ project }), cards };
  const lead = { ...emptyThread({ project }), project_lead: true, cards };
  await hub.save(ordinary);
  await hub.save(lead);
  const merge = require('../app/auto-merge.js');
  merge.afterCheck(hub, ordinary.id, 'check');
  merge.afterCheck(hub, lead.id, 'check');
  await merge.settled();
  assert.equal((await hub.thread(ordinary.id)).auto_merge_attempts?.[head]?.outcome, 'held');
  assert.equal((await hub.thread(lead.id)).auto_merge_attempts, undefined);
});

test('the merged-PR poller calls GitHub only for ordinary threads', async (t) => {
  const dir = await makeDir('project-lead-merged-');
  const log = path.join(dir, 'calls');
  await fs.writeFile(path.join(dir, 'gh'), `#!/bin/sh\nprintf '%s\\n' "$3" >> '${log}'\nprintf '{"state":"MERGED"}'\n`, { mode: 0o755 });
  const originalPath = process.env.PATH;
  process.env.PATH = dir + path.delimiter + originalPath;
  t.after(() => { process.env.PATH = originalPath; });
  const hub = new Hub({ stateDir: path.join(dir, 'state') });
  await hub.state.init();
  const ordinary = { ...emptyThread({ project }), cards: [{ kind: 'done', pr_url: 'https://github.com/o/r/pull/1' }] };
  const lead = { ...emptyThread({ project }), project_lead: true, cards: [{ kind: 'done', pr_url: 'https://github.com/o/r/pull/2' }] };
  await hub.save(ordinary);
  await hub.save(lead);
  await hub.pollMerged();
  assert.equal((await fs.readFile(log, 'utf8')).trim(), ordinary.cards[0].pr_url);
  assert.ok((await hub.thread(ordinary.id)).cards.some((item) => item.kind === 'merged'));
  assert.ok(!(await hub.thread(lead.id)).cards.some((item) => item.kind === 'merged'));
});

test('account switching keeps the project lead identity', async () => {
  const hub = new Hub({ stateDir: await makeDir('project-lead-switch-') });
  await hub.state.init();
  const calls = [];
  hub.machines = async () => ({ remote: { name: 'remote' } });
  hub.call = async (machine, route, method, body) => {
    calls.push({ machine, route, body });
    if (route === '/v1/status') {
      return { claude: { installed: true }, accounts: [
        { id: 'default-claude', cli: 'claude', logged_in: true },
        { id: 'second', cli: 'claude', logged_in: true },
      ] };
    }
    return { accepted: true };
  };
  await settings.update(hub, (value) => {
    value.project_leads = 'on';
    value.accounts.push({ id: 'second', provider: 'claude', name: 'Second', plan: 'unknown', weight: 1, paused: false });
  });
  const record = {
    ...emptyThread({ project, machine: 'remote' }),
    project_lead: true,
    sessions: [{ name: 'agent', role: 'lead', provider: 'claude', account: 'default-claude', model: 'saved', live: true, ready: true, queue: [] }],
  };
  await hub.save(record);
  await sessions.event(hub, { thread_id: record.id, session: 'agent', type: 'limit-hit', limited_until: new Date(Date.now() + 3600000).toISOString() });
  for (let i = 0; i < 100 && !calls.some((call) => call.route.endsWith('/switch')); i++) await new Promise((resolve) => setTimeout(resolve, 20));
  const request = calls.find((call) => call.route.endsWith('/switch'));
  assert.ok(request);
  assert.equal(request.machine, 'remote');
  assert.deepEqual({ project_lead: request.body.project_lead, project: request.body.project, project_dir: request.body.project_dir }, {
    project_lead: true, project: 'project', project_dir: project,
  });
  assert.equal(Object.hasOwn(request.body, 'assistant'), false);
  await hub.withThread(record.id, async () => {});
});

const savedLead = async (c, id) => JSON.parse(await fs.readFile(path.join(c.state, 'threads', id + '.json'), 'utf8'));
const sendMessage = (c, id, text) => post(c, `/threads/${id}/messages`, { text });
const starts = (c, id) => c.machine.calls.filter((call) => call.path === '/v1/sessions' && call.method === 'POST' && call.body.thread_id === id);

test('opening a project lead starts it only on the first message', async (t) => {
  const c = await setup(); t.after(() => close(c)); await seed(c);
  const id = await enableAndCreate(c);
  await api(c, `/threads/${id}`);
  assert.equal(starts(c, id).length, 0);
  assert.deepEqual((await sendMessage(c, id, 'first')).body, { queued: true });
  assert.equal(starts(c, id).length, 1);
});

test('failed starts retain queued messages in order and a later start carries them', async (t) => {
  const c = await setup(); t.after(() => close(c)); await seed(c);
  const id = await enableAndCreate(c); c.machine.startOk = false;
  const first = await sendMessage(c, id, 'first');
  assert.equal(first.status, 202); assert.match(first.body.start_error, /start refused/);
  assert.deepEqual((await savedLead(c, id)).sessions.at(-1).queue.map((m) => m.text), ['first']);
  const second = await sendMessage(c, id, 'second'); assert.equal(second.status, 202);
  assert.deepEqual((await savedLead(c, id)).sessions.at(-1).queue.map((m) => m.text), ['first', 'second']);
  c.machine.startOk = true;
  assert.equal((await sendMessage(c, id, 'third')).status, 202);
  const record = await savedLead(c, id);
  assert.deepEqual(record.sessions.at(-1).queue.filter((m) => m.source === 'user').map((m) => m.text), ['first', 'second', 'third']);
});

test('concurrent first sends start only one lead and preserve order', async (t) => {
  const c = await setup(); t.after(() => close(c)); await seed(c);
  const id = await enableAndCreate(c);
  const replies = await Promise.all([sendMessage(c, id, 'first'), sendMessage(c, id, 'second')]);
  assert.ok(replies.every((r) => r.status === 202)); assert.equal(starts(c, id).length, 1);
  const record = await savedLead(c, id);
  const messages = [...record.sent.filter((m) => m.source === 'user'), ...record.sessions.at(-1).queue.filter((m) => m.source === 'user')];
  assert.deepEqual(messages.map((m) => m.text).sort(), ['first', 'second']);
  assert.deepEqual(messages.map((m) => m.at), messages.map((m) => m.at).sort());
});

test('a dead lead restarts on a message and turn ends deliver queued messages', async (t) => {
  const c = await setup(); t.after(() => close(c)); await seed(c);
  const id = await enableAndCreate(c);
  await edit(c, id, (record) => record.sessions.push({ name: 'dead-lead', role: 'lead', live: false, queue: [] }));
  await sendMessage(c, id, 'first'); await sendMessage(c, id, 'second');
  assert.equal(starts(c, id).length, 1);
  const lead = (await savedLead(c, id)).sessions.at(-1);
  for (let i = 0; i < 3; i++) await event(c, id, lead.name, 'turn-ended');
  const submitted = c.machine.calls.filter((call) => call.path.endsWith('/submit')).map((call) => call.body.text);
  assert.ok(submitted.indexOf('first') >= 0); assert.ok(submitted.indexOf('second') > submitted.indexOf('first'));
});

test('off refuses messages and failed stops retry on machine contact only while off', async (t) => {
  const c = await setup(); t.after(() => close(c)); await seed(c);
  const id = await enableAndCreate(c); await preferences(c, { default_project_folder: '/tmp' }); await sendMessage(c, id, 'first');
  const lead = (await savedLead(c, id)).sessions.at(-1);
  c.machine.stopOk = false; await preferences(c, { project_leads: 'off' });
  assert.equal((await savedLead(c, id)).stop_pending, true);
  const count = starts(c, id).length;
  refused(await sendMessage(c, id, 'off'), 404, /project leads are off/); assert.equal(starts(c, id).length, count);
  c.machine.stopOk = true;
  await api(c, '/new-thread');
  for (let i = 0; i < 100 && (await savedLead(c, id)).stop_pending; i++) await new Promise((r) => setTimeout(r, 20));
  assert.equal((await savedLead(c, id)).stop_pending, undefined); assert.equal(c.machine.sessions.get(lead.name).running, false);
  await preferences(c, { project_leads: 'on' }); await sendMessage(c, id, 'again');
  c.machine.stopOk = false; await preferences(c, { project_leads: 'off' });
  await preferences(c, { project_leads: 'on' }); c.machine.stopOk = true;
  const deletes = () => c.machine.calls.filter((call) => call.method === 'DELETE' && call.path.startsWith('/v1/sessions/')).length;
  const before = deletes(); await api(c, '/new-thread'); await new Promise((r) => setTimeout(r, 100));
  assert.equal(deletes(), before); assert.equal((await savedLead(c, id)).stop_pending, undefined);
});

test('ordinary threads still reject messages without a live lead', async (t) => {
  const c = await setup(); t.after(() => close(c)); const record = await seed(c);
  refused(await sendMessage(c, record.id, 'hello'), 409, /no live lead/);
});

test('project lead actions enforce project scope and redact cross-project content', async () => {
  const dir = await makeDir('project-lead-actions-');
  const hub = new Hub({ stateDir: dir }); await hub.state.init();
  await settings.update(hub, (value) => { value.project_leads = 'on'; value.assistant = 'on'; });
  const own = { ...emptyThread({ machine: 'hub', project }), project_lead: true, sessions: [{ name: 'project-lead-session', role: 'lead', live: true }] };
  const same = emptyThread({ machine: 'hub', project });
  const other = emptyThread({ machine: 'hub', project: '/elsewhere/project' });
  other.sessions.push({ name: 'other-lead', role: 'lead', live: true });
  const personal = { ...emptyThread({ machine: 'hub', project: null }), assistant: true };
  same.sessions.push({ name: 'same-lead', role: 'lead', live: true });
  same.queues = { 'same-lead': [{ text: '[wc:from other-lead] outside secret' }, { text: 'inside queued' }] };
  same.peer_log = [{ thread: other.id, text: 'outside secret', direction: 'received' }, { thread: same.id, text: 'inside text', direction: 'sent' }];
  same.lead_links = [other.id, same.id]; same.peer_pauses = { [other.id]: 'outside', [same.id]: 'inside' };
  same.cards = [{ id: 'reach1', kind: 'reach', title: 'secret' }, { id: 'permit1', kind: 'permit', pr_number: 99 }, { id: 'msg1', kind: 'message', to: 'other-lead', text: 'outside secret' }, { id: 'local-message', kind: 'message', to: 'same-lead', text: 'inside card' }, { id: 'sudo1', kind: 'sudo' }];
  for (const record of [own, same, other, personal]) await hub.save(record);
  const dispatch = require('../app/project-lead-actions.js').dispatch;
  const call = (action, extra = {}) => dispatch(hub, { calling_session: 'project-lead-session', action, ...extra });
  for (const action of ['thread', 'message', 'press', 'restart', 'archive']) for (const target of [own, other, personal]) {
    await assert.rejects(call(action, { thread: target.id }), /that thread is in another project/);
  }
  await assert.rejects(dispatch(hub, { calling_session: 'stranger', action: 'threads' }), /only a project lead/);
  await assert.rejects(call('projects'), /unsupported project lead action/);
  const rows = (await call('threads')).threads;
  assert.deepEqual(rows.map((r) => r.id), [same.id]);
  const detail = await call('thread', { thread: same.id });
  assert.doesNotMatch(JSON.stringify(detail), /outside secret|other-lead|secret|#99/);
  assert.match(JSON.stringify(detail), /inside text/);
  assert.match(JSON.stringify(detail), /inside queued/); assert.match(JSON.stringify(detail), /inside card/);
  assert.deepEqual(detail.lead_links, [same.id]); assert.deepEqual(Object.keys(detail.peer_pauses), [same.id]);
  assert.deepEqual(detail.cards.find((c) => c.id === 'reach1'), { id: 'reach1', kind: 'reach', text: "a request to talk to another project's lead" });
  assert.equal(detail.waiting.find((c) => c.id === 'permit1').text, "a request to push to someone else's pull request");
  for (const card of ['reach1', 'permit1', 'sudo1']) await assert.rejects(call('press', { thread: same.id, card }), /that needs you/);
  let created; hub.createThread = async (input) => { created = input; return { id: 'new-thread' }; };
  assert.equal((await call('start', { project: '/wrong', machine: 'wrong', message: 'hello' })).thread, 'new-thread');
  assert.equal(created.project, project); assert.equal(created.machine, 'hub'); assert.equal(created.message, '[wc:assistant] hello');
  let refresh; hub.call = async (...args) => { refresh = args; return { ok: true, commit: 'abc' }; };
  assert.deepEqual(await call('refresh'), { ok: true, commit: 'abc' });
  assert.deepEqual(refresh, ['hub', '/v1/project-lead/refresh', 'POST', { thread_id: own.id, project_dir: project }, 100000]);
  await settings.update(hub, (value) => { value.project_leads = 'off'; });
  await assert.rejects(call('threads'), /project leads are off/);
});

test('project lead CLI sends files and retries reads only', async () => {
  const http = require('node:http'), { spawn } = require('node:child_process');
  let calls = [], fail = false;
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    calls.push({ path: req.url, body: JSON.parse(Buffer.concat(chunks)) });
    res.writeHead(fail && calls.length === 1 ? 503 : 200, { 'content-type': 'application/json' }); res.end('{"ok":true}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const file = path.join(await makeDir('project-lead-cli-'), 'message'); await fs.writeFile(file, 'hello\n');
  const run = (...args) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, '../app/wc.js'), 'project-lead', ...args], { env: { ...process.env, WHEELCHAIR_SESSION_TOKEN: 'test', WHEELCHAIR_MACHINE_URL: `http://127.0.0.1:${server.address().port}` } });
    let output = ''; child.stdout.on('data', (s) => { output += s; }); child.on('error', reject); child.on('close', () => resolve(JSON.parse(output)));
  });
  try {
    await run('start', '--message-file', file); assert.equal(calls[0].path, '/project-lead'); assert.equal(calls[0].body.message, 'hello\n');
    calls = []; await run('message', 'target', '--text-file', file); assert.equal(calls[0].body.text, 'hello\n');
    calls = []; fail = true; await run('refresh'); assert.equal(calls.length, 2);
    calls = []; await run('archive', 'target'); assert.equal(calls.length, 1);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

async function actionFixture() {
  const hub = new Hub({ stateDir: await makeDir('project-lead-followup-') });
  await hub.state.init();
  await settings.update(hub, (value) => { value.project_leads = 'on'; });
  hub.machines = async () => ({ hub: { name: 'hub' }, remote: { name: 'remote' } });
  const source = { ...emptyThread({ machine: 'hub', project }), project_lead: true, sessions: [{ name: 'project-lead-session', role: 'lead', live: true }] };
  const local = emptyThread({ machine: 'hub', project });
  const outside = { ...emptyThread({ machine: 'remote', project }), title: 'Outside project title' };
  const otherLead = { ...emptyThread({ machine: 'hub', project: '/other/project-path' }), project_lead: true };
  for (const record of [source, local, outside, otherLead]) await hub.save(record);
  const call = (action, extra = {}) => require('../app/project-lead-actions.js').dispatch(hub, { calling_session: 'project-lead-session', action, ...extra });
  return { hub, source, local, outside, otherLead, call };
}

test('refresh waits for a slow machine', { timeout: 30000 }, async (t) => {
  const c = await setup(); t.after(() => close(c));
  await preferences(c, { project_leads: 'on' });
  await seed(c, { project_lead: true, sessions: [{ name: 'project-lead-session', role: 'lead', live: true }] });
  c.machine.refreshDelay = 6000;
  const result = await machinePost(c, '/machine/project-lead', { calling_session: 'project-lead-session', action: 'refresh' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true, commit: 'a'.repeat(40) });
});

test('outside titles do not erase local question text', async () => {
  const { hub, local, outside, call } = await actionFixture();
  outside.title = 'Release notes'; await hub.save(outside);
  const question = 'Are the Release notes ready?';
  local.cards = [{ id: 'question1', kind: 'question', question }]; await hub.save(local);
  const row = (await call('threads')).threads.find((item) => item.id === local.id);
  assert.equal(row.waiting[0].text, question);
  const detail = await call('thread', { thread: local.id });
  assert.equal(detail.cards[0].question, question);
});

test('outside pull request URLs are removed from recent chat', async () => {
  const { hub, local, outside, call } = await actionFixture();
  const urls = ['https://github.com/outside/repo/pull/1', 'https://github.com/outside/repo/pull/2', 'https://github.com/outside/repo/pull/3'];
  outside.pr_url = urls[0]; outside.target_pr = urls[1]; outside.cards = [{ kind: 'done', pr_url: urls[2] }]; await hub.save(outside);
  const own = 'https://github.com/local/repo/pull/4'; local.pr_url = own; await hub.save(local);
  hub.chat = async () => ({ items: [...urls, own].map((text) => ({ type: 'human', text })) });
  const detail = await call('thread', { thread: local.id });
  assert.deepEqual(detail.recent.map((item) => item.text), [own]);
});

test('outside PR URLs match whole URLs without hiding local PR prefixes', async () => {
  const { hub, local, outside, call } = await actionFixture();
  const url = 'https://github.com/wheelchair/wheelchair/pull/18';
  outside.pr_url = url; await hub.save(outside);
  local.pr_url = `${url}6`;
  const question = `Should I rebase ${local.pr_url}?`;
  local.cards = [{ id: 'q1', kind: 'question', question }]; await hub.save(local);
  hub.chat = async () => ({ items: [local.pr_url, url, `${url}.`].map((text) => ({ type: 'human', text })) });
  const detail = await call('thread', { thread: local.id });
  assert.deepEqual(detail.recent.map((item) => item.text), [local.pr_url]);
  assert.equal(detail.pr_url, local.pr_url);
  assert.equal((await call('threads')).threads.find((row) => row.id === local.id).waiting[0].text, question);
});

test('outside object target PR URLs are removed from thread details', async () => {
  const { hub, local, outside, call } = await actionFixture();
  const url = 'https://github.com/wheelchair/wheelchair/pull/77';
  outside.target_pr = { url, number: 77 }; await hub.save(outside);
  hub.chat = async () => ({ items: [{ type: 'human', text: `See ${url}` }, { type: 'human', text: 'local' }] });
  const detail = await call('thread', { thread: local.id });
  assert.deepEqual(detail.recent.map((item) => item.text), ['local']);
  assert.equal(JSON.stringify(detail).includes(url), false);
});

test('the same path on another registered machine is outside the project', async () => {
  const { local, outside, call } = await actionFixture();
  assert.deepEqual((await call('threads')).threads.map((row) => row.id), [local.id]);
  for (const action of ['thread', 'message', 'press', 'restart', 'archive']) await assert.rejects(call(action, { thread: outside.id }), /that thread is in another project/);
});

test('another project lead is refused as a target of every targeted action', async () => {
  const { otherLead, call } = await actionFixture();
  for (const action of ['thread', 'message', 'press', 'restart', 'archive']) await assert.rejects(call(action, { thread: otherLead.id }), /that thread is in another project/);
});

test('closed reach and permit cards are absent from waiting and cards', async () => {
  const { hub, local, call } = await actionFixture();
  local.cards = ['reach', 'permit'].flatMap((kind) => [
    { id: `${kind}-open`, kind }, { id: `${kind}-answered`, kind, answered: true },
    { id: `${kind}-retracted`, kind, retracted_at: '2026-01-01' }, { id: `${kind}-replaced`, kind, replaced: true },
  ]);
  await hub.save(local);
  const detail = await call('thread', { thread: local.id });
  for (const field of ['waiting', 'cards']) assert.deepEqual(detail[field].map((card) => card.id).sort(), ['permit-open', 'reach-open']);
});

test('cross-thread messages and recent chat omit other project identifiers but keep titles', async () => {
  const { hub, local, outside, otherLead, call } = await actionFixture();
  outside.sessions.push({ name: 'outside-session', role: 'lead', live: true });
  outside.pr_url = 'https://github.com/outside/repo/pull/10'; await hub.save(outside);
  const values = [outside.id, otherLead.project, 'outside-session', outside.pr_url, outside.title];
  local.cross_thread_messages = [...values.map((text) => ({ text: `mentions ${text}` })), { text: 'local message' }];
  await hub.save(local);
  hub.chat = async () => ({ items: [...values.map((text) => ({ type: 'human', text: `mentions ${text}` })), { type: 'human', text: 'local chat' }] });
  const detail = await call('thread', { thread: local.id });
  assert.deepEqual(detail.cross_thread_messages, [{ text: `mentions ${outside.title}` }, { text: 'local message' }]);
  assert.deepEqual(detail.recent.map((item) => item.text), [`mentions ${outside.title}`, 'local chat']);
});

test('short other-project titles do not redact same-project text', async () => {
  const { hub, local, outside, call } = await actionFixture();
  outside.title = 'ok'; await hub.save(outside);
  local.cross_thread_messages = [{ text: 'ok' }]; await hub.save(local);
  const detail = await call('thread', { thread: local.id });
  assert.deepEqual(detail.cross_thread_messages, [{ text: 'ok' }]);
});

test('same-project text mentioning its project path remains in recent chat', async () => {
  const { hub, local, call } = await actionFixture();
  hub.chat = async () => ({ items: [{ type: 'human', text: `working in ${project}` }] });
  const detail = await call('thread', { thread: local.id });
  assert.deepEqual(detail.recent.map((item) => item.text), [`working in ${project}`]);
});

test('every project lead action is refused when the setting is off', async () => {
  const { hub, local, call } = await actionFixture();
  await settings.update(hub, (value) => { value.project_leads = 'off'; });
  for (const action of ['threads', 'thread', 'start', 'message', 'press', 'restart', 'archive', 'refresh']) await assert.rejects(call(action, { thread: local.id }), /project leads are off/);
});

test('project lead CLI retries thread reads and does not retry writes', async () => {
  const http = require('node:http'), { spawn } = require('node:child_process');
  let calls = 0;
  const server = http.createServer((req, res) => { calls++; res.writeHead(calls === 1 ? 503 : 200, { 'content-type': 'application/json' }); res.end(calls === 1 ? '{"error":"hub unavailable"}' : '{"ok":true}'); });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const file = path.join(await makeDir('project-lead-retry-'), 'message'); await fs.writeFile(file, 'hello');
  const run = (...args) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, '../app/wc.js'), 'project-lead', ...args], { env: { ...process.env, WHEELCHAIR_SESSION_TOKEN: 'test', WHEELCHAIR_MACHINE_URL: `http://127.0.0.1:${server.address().port}` } });
    let output = ''; child.stdout.on('data', (data) => { output += data; }); child.on('error', reject); child.on('close', () => resolve(JSON.parse(output)));
  });
  try {
    for (const args of [['threads'], ['thread', 'target']]) { calls = 0; assert.equal((await run(...args)).ok, true); assert.equal(calls, 2); }
    for (const args of [['message', 'target', '--text-file', file], ['restart', 'target'], ['archive', 'target']]) { calls = 0; assert.match((await run(...args)).error, /hub unavailable/); assert.equal(calls, 1); }
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
