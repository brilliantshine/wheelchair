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
  assert.deepEqual([...record.sent.filter((m) => m.source === 'user'), ...record.sessions.at(-1).queue.filter((m) => m.source === 'user')].map((m) => m.text), ['first', 'second']);
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
