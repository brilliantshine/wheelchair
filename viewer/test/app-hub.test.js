'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const { validate } = require('../app/card.js');
const { Hub } = require('../app/hub.js');
const { api, card, close, event, machinePost, setup, thread } = require('./helpers/app.js');

async function withContext(work) {
  const context = await setup();
  try {
    await work(context);
  } finally {
    await close(context);
  }
}

test('accepts a valid card for its own lead', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    const result = await card(context, made.id, lead.name, {
      kind: 'offer',
      summary: 'A short summary.',
    });
    assert.equal(result.status, 202);
    assert.equal(result.body.kind, 'offer');
  });
});

test('stores an ISO timestamp on every card', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const result = await card(context, made.id, made.sessions[0].name, {
      kind: 'offer', summary: 'A timestamped card.',
    });
    assert.match(result.body.at, /^\d{4}-\d{2}-\d{2}T/);
  });
});

test('keeps initialized hub state on disk across a new Hub instance', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const threads = await fs.stat(path.join(context.state, 'threads'));
    assert.equal(threads.mode & 0o777, 0o700);
    assert.ok(await fs.readFile(path.join(context.state, 'machines.json'), 'utf8'));
    assert.equal(await fs.readFile(path.join(context.state, 'projects.json'), 'utf8'), '[]\n');
    const restarted = new Hub({ stateDir: context.state });
    await restarted.init();
    assert.equal((await restarted.thread(made.id)).id, made.id);
  });
});

test('uses the card CLI validator for a locally valid card', () => {
  const result = validate('offer', { kind: 'offer', summary: 'A valid local card.' });
  assert.equal(result.ok, true);
});

test('refuses a card with an unknown field', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const result = await card(context, made.id, made.sessions[0].name, {
      kind: 'offer',
      summary: 'A short summary.',
      unexpected: true,
    });
    assert.equal(result.status, 422);
    assert.match(result.body.detail, /unknown field/);
  });
});

test('refuses a card a role may not emit', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const result = await card(context, made.id, made.sessions[0].name, {
      kind: 'result',
      task: 'T3',
      outcome: 'done',
      summary: 'No role mismatch should pass.',
    });
    assert.equal(result.status, 422);
    assert.match(result.body.detail, /lead may not post result/);
  });
});

test('refuses a card envelope with a session from another thread', async () => {
  await withContext(async (context) => {
    const first = await thread(context);
    const second = await thread(context);
    const result = await card(context, second.id, first.sessions[0].name, {
      kind: 'offer',
      summary: 'Wrong thread.',
    });
    assert.equal(result.status, 404);
  });
});

test('replaces a thread singleton card', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    await card(context, made.id, lead.name, { kind: 'offer', summary: 'First.' });
    await card(context, made.id, lead.name, { kind: 'offer', summary: 'Second.' });
    const stored = JSON.parse(
      await fs.readFile(path.join(context.state, 'threads', `${made.id}.json`), 'utf8'),
    );
    assert.equal(stored.pinned.offer.summary, 'Second.');
    assert.equal(stored.cards.filter((item) => !item.replaced).length, 1);
  });
});

test('routes a session message to the named target queue', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    const sublead = await startSublead(context, made, lead);
    const result = await card(context, made.id, sublead.name, {
      kind: 'message',
      to: lead.name,
      text: 'Please decide.',
    });
    assert.equal(result.status, 202);
    await event(context, made.id, lead.name, 'turn-ended');
    assert.match(context.machine.sessions.get(lead.name).submits[0], /^\[wc:from /);
  });
});

test('marks a result task finished and relays it to its starter', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    const sublead = await startSublead(context, made, lead);
    await card(context, made.id, sublead.name, {
      kind: 'result',
      task: 'build',
      outcome: 'done',
      summary: 'Build complete.',
    });
    await event(context, made.id, lead.name, 'turn-ended');
    const stored = JSON.parse(
      await fs.readFile(path.join(context.state, 'threads', `${made.id}.json`), 'utf8'),
    );
    assert.equal(stored.sessions.find((session) => session.name === sublead.name).finished, true);
    assert.match(context.machine.sessions.get(lead.name).submits[0], /Build complete/);
  });
});

test('holds a queued message until both readiness and a turn end', async () => {
  await withContext(async (context) => {
    const made = await thread(context, { message: 'Hello from Collin.' });
    const file = path.join(context.state, 'threads', `${made.id}.json`);
    const stored = JSON.parse(await fs.readFile(file, 'utf8'));
    stored.sessions[0].ready = false;
    await fs.writeFile(file, `${JSON.stringify(stored)}\n`);
    await event(context, made.id, made.sessions[0].name, 'turn-ended');
    assert.equal(context.machine.sessions.get(made.sessions[0].name).submits, undefined);
    await event(context, made.id, made.sessions[0].name, 'ready');
    assert.deepEqual(context.machine.sessions.get(made.sessions[0].name).submits, [
      'Hello from Collin.',
    ]);
  });
});

test('posts a permission need and holds the session queue', async () => {
  await withContext(async (context) => {
    const made = await thread(context, { message: 'Wait for the prompt.' });
    const lead = made.sessions[0];
    await event(context, made.id, lead.name, 'prompt', { notification_type: 'permission_prompt' });
    await event(context, made.id, lead.name, 'turn-ended');
    assert.equal(context.machine.sessions.get(lead.name).submits, undefined);
    const chat = await api(context, `/threads/${made.id}/chat`);
    assert.equal(chat.body.cards.at(-1).title, 'Permission needed');
  });
});

test('closes a permission need and resumes the queue', async () => {
  await withContext(async (context) => {
    const made = await thread(context, { message: 'Resume this message.' });
    const lead = made.sessions[0];
    await event(context, made.id, lead.name, 'prompt', { notification_type: 'permission_prompt' });
    await event(context, made.id, lead.name, 'turn-ended');
    await event(context, made.id, lead.name, 'permission-cleared');
    await event(context, made.id, lead.name, 'turn-ended');
    assert.deepEqual(context.machine.sessions.get(lead.name).submits, ['Resume this message.']);
  });
});

test('posts and clears a stuck-session need', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    await event(context, made.id, lead.name, 'stuck');
    await event(context, made.id, lead.name, 'ready');
    const chat = await api(context, `/threads/${made.id}/chat`);
    const need = chat.body.cards.find((item) => item.title === 'Session stuck at startup');
    assert.equal(need.answered, true);
  });
});

test('allows a lead to start only its permitted roles', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    const denied = await machinePost(context, '/machine/session', {
      calling_session: lead.name,
      action: 'start',
      role: 'worker',
      cli: 'codex',
      attempt_id: 'worker-1',
    });
    assert.equal(denied.status, 403);
    const allowed = await startSublead(context, made, lead);
    assert.equal(allowed.role, 'sub-lead');
  });
});

test('refuses a second live sub-lead', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    await startSublead(context, made, lead);
    const result = await machinePost(context, '/machine/session', {
      calling_session: lead.name,
      action: 'start',
      role: 'sub-lead',
      cli: 'codex',
      attempt_id: 'build-2',
    });
    assert.equal(result.status, 409);
  });
});

test('deduplicates a live start attempt', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    const started = await startSublead(context, made, lead, 'same-attempt');
    const duplicate = await machinePost(context, '/machine/session', {
      calling_session: lead.name,
      action: 'start',
      role: 'sub-lead',
      cli: 'codex',
      attempt_id: 'same-attempt',
    });
    assert.equal(duplicate.body.duplicate, true);
    assert.equal(duplicate.body.session.name, started.name);
  });
});

test('allows a lead to stop a session it started', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    const sublead = await startSublead(context, made, lead);
    const result = await machinePost(context, '/machine/session', {
      calling_session: lead.name,
      action: 'stop',
      name: sublead.name,
    });
    assert.equal(result.status, 200);
    assert.equal(context.machine.sessions.get(sublead.name).running, false);
  });
});

test('starts a replacement lead after the old lead ends', async () => {
  await withContext(async (context) => {
    const made = await thread(context, { message: 'Queued before death.' });
    const oldLead = made.sessions[0];
    context.machine.sessions.get(oldLead.name).running = false;
    const hub = new Hub({ stateDir: context.state });
    await hub.init();
    await hub.pollDead();
    const restarted = await api(context, `/threads/${made.id}/restart`, { method: 'POST', body: {} });
    assert.equal(restarted.status, 201);
    assert.notEqual(restarted.body.name, oldLead.name);
    // The replacement works in the thread's existing worktree and branch, not a new one.
    const started = context.machine.sessions.get(restarted.body.name);
    assert.equal(started.worktree, `/tmp/${oldLead.name}`);
    assert.equal(started.branch, `wc/${made.id}`);
    const after = await hub.thread(made.id);
    assert.ok(after.cards.filter((item) => item.title === 'Sessions ended').every((item) => item.answered));
    // The queued message moves once; the old lead keeps no copy.
    const lead = after.sessions.find((item) => item.name === restarted.body.name);
    assert.equal(lead.queue.filter((item) => item.text === 'Queued before death.').length, 1);
    assert.equal(after.sessions.find((item) => item.name === oldLead.name).queue.length, 0);
  });
});

test('a fresh Claude lead with no first message takes its queue without a turn-ended event', async () => {
  await withContext(async (context) => {
    const made = await thread(context, { cli: 'claude', message: 'Deliver me now.' });
    const submits = context.machine.sessions.get(made.sessions[0].name).submits || [];
    assert.deepEqual(submits, ['Deliver me now.']);
  });
});

test('puts restart context ahead of transferred queued messages', async () => {
  await withContext(async (context) => {
    const made = await thread(context, { message: 'Queued before death.' });
    const oldLead = made.sessions[0];
    context.machine.sessions.get(oldLead.name).running = false;
    const hub = new Hub({ stateDir: context.state });
    await hub.init();
    await hub.pollDead();
    const restarted = await api(context, `/threads/${made.id}/restart`, { method: 'POST', body: {} });
    await event(context, made.id, restarted.body.name, 'turn-ended');
    const submits = context.machine.sessions.get(restarted.body.name).submits;
    assert.match(submits[0], /^\[wc:context restart]/);
  });
});

test('reports a dead worker to its starter', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    const sublead = await startSublead(context, made, lead);
    context.machine.sessions.get(sublead.name).running = false;
    const hub = new Hub({ stateDir: context.state });
    await hub.init();
    await hub.pollDead();
    await event(context, made.id, lead.name, 'turn-ended');
    assert.match(context.machine.sessions.get(lead.name).submits[0], /session .* ended/);
  });
});

test('raises Sessions ended when the lead dies', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    context.machine.sessions.get(made.sessions[0].name).running = false;
    const hub = new Hub({ stateDir: context.state });
    await hub.init();
    await hub.pollDead();
    const chat = await api(context, `/threads/${made.id}/chat`);
    assert.ok(chat.body.cards.some((item) => item.title === 'Sessions ended'));
  });
});

test('creates an unstarted stub and opens it after a role turn ends', async () => {
  await withContext(async (context) => {
    const parent = await thread(context);
    const lead = parent.sessions[0];
    const result = await card(context, parent.id, lead.name, {
      kind: 'stub',
      title: 'Follow-up work',
      summary: 'Start with this context.',
      depends_on_parent: false,
    });
    const stubId = result.body.thread_id;
    const opened = await api(context, `/threads/${stubId}/open`, { method: 'POST', body: {} });
    const stubLead = opened.body.sessions[0];
    assert.equal(context.machine.sessions.get(stubLead.name).submits, undefined);
    await event(context, stubId, stubLead.name, 'turn-ended');
    assert.deepEqual(context.machine.sessions.get(stubLead.name).submits, [
      '[wc:context stub] Start with this context.',
    ]);
  });
});

test('waits for a dependent stub until the parent merges', async () => {
  await withContext(async (context) => {
    const parent = await thread(context);
    const result = await card(context, parent.id, parent.sessions[0].name, {
      kind: 'stub',
      title: 'Dependent work',
      summary: 'Wait for the parent.',
      depends_on_parent: true,
    });
    const opened = await api(context, `/threads/${result.body.thread_id}/open`, {
      method: 'POST',
      body: {},
    });
    assert.equal(opened.body.waiting, true);
    assert.equal(opened.body.thread.sessions.length, 0);
  });
});

test('opens a waiting stub after the 10-minute check finds its parent merged', async () => {
  await withContext(async (context) => {
    const parent = await thread(context);
    const parentFile = path.join(context.state, 'threads', `${parent.id}.json`);
    const parentState = JSON.parse(await fs.readFile(parentFile, 'utf8'));
    parentState.branch = `wc/${parent.id}`;
    await fs.writeFile(parentFile, `${JSON.stringify(parentState)}\n`);
    const result = await card(context, parent.id, parent.sessions[0].name, {
      kind: 'stub',
      title: 'Waiting work',
      summary: 'Wait until merged.',
      depends_on_parent: true,
    });
    // Not opened: a dependent stub left alone is watched all the same.
    const bin = await fs.mkdtemp(path.join(os.tmpdir(), 'wc-gh-'));
    const gh = path.join(bin, 'gh');
    // Like the real gh, -C is refused.
    await fs.writeFile(gh, '#!/bin/sh\n[ "$1" = "-C" ] && { echo "unknown shorthand flag: C" >&2; exit 1; }\nprintf \'[{"number":1}]\'\n');
    await fs.chmod(gh, 0o755);
    // gh runs inside the project's clone, so the stub's project must exist.
    const stubFile = path.join(context.state, 'threads', `${result.body.thread_id}.json`);
    const stubState = JSON.parse(await fs.readFile(stubFile, 'utf8'));
    stubState.project = bin;
    await fs.writeFile(stubFile, `${JSON.stringify(stubState)}\n`);
    const previousPath = process.env.PATH;
    process.env.PATH = `${bin}:${previousPath}`;
    try {
      const hub = new Hub({ stateDir: context.state });
      await hub.init();
      await hub.pollWaiting();
    } finally {
      process.env.PATH = previousPath;
    }
    const stored = JSON.parse(
      await fs.readFile(path.join(context.state, 'threads', `${result.body.thread_id}.json`), 'utf8'),
    );
    assert.equal(stored.ready, true);
    assert.equal(stored.waiting_on_parent, false);
    const opened = await api(context, `/threads/${result.body.thread_id}/open`, {
      method: 'POST', body: {},
    });
    assert.equal(opened.body.sessions.length, 1);
  });
});

test('rechecks an approval in place and gates Start building on the fresh result', async () => {
  await withContext(async (context) => {
    context.machine.status.version = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const made = await thread(context);
    const approval = await card(context, made.id, made.sessions[0].name, {
      kind: 'approval', objections: [], ready: { ok: false, missing: ['old result'] },
    });
    const rechecked = await api(context, `/threads/${made.id}/cards/${approval.body.id}/press`, {
      method: 'POST', body: { action: 'recheck' },
    });
    assert.equal(rechecked.body.queued, false);
    assert.deepEqual(rechecked.body.ready, { ok: true, missing: [] });
    context.machine.preflightOk = false;
    const stopped = await api(context, `/threads/${made.id}/cards/${approval.body.id}/press`, {
      method: 'POST', body: { action: 'start-building' },
    });
    assert.equal(stopped.body.queued, false);
    assert.equal(stopped.body.ready.ok, false);
    assert.equal(context.machine.sessions.get(made.sessions[0].name).submits, undefined);
    assert.ok(context.machine.calls.some((call) => call.path === '/v1/preflight'));
  });
});

test('asks the machine service to archive the thread', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const result = await api(context, `/threads/${made.id}/archive`, { method: 'POST', body: {} });
    assert.equal(result.status, 200);
    assert.equal(result.body.stopped.length, 1);
    assert.ok(context.machine.calls.some((call) => call.path === '/v1/archive'));
  });
});

test('queues a card press as a lead message', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    const offered = await card(context, made.id, lead.name, {
      kind: 'offer',
      summary: 'Offer a plan.',
    });
    const pressed = await api(context, `/threads/${made.id}/cards/${offered.body.id}/press`, {
      method: 'POST',
      body: { action: 'picked', value: 'take it into planning' },
    });
    assert.equal(pressed.status, 202);
    await event(context, made.id, lead.name, 'turn-ended');
    assert.match(context.machine.sessions.get(lead.name).submits[0], /^\[card /);
  });
});

async function archivedDocumentContext() {
  const bin = await fs.mkdtemp(path.join(os.tmpdir(), 'wc-git-'));
  const git = path.join(bin, 'git');
  await fs.writeFile(git, '#!/bin/sh\nprintf "archived plan\\n"\n');
  await fs.chmod(git, 0o755);
  const context = await setup({ env: { PATH: `${bin}:${process.env.PATH}` } });
  const made = await thread(context);
  const file = path.join(context.state, 'threads', `${made.id}.json`);
  const stored = JSON.parse(await fs.readFile(file, 'utf8'));
  stored.archived = true;
  stored.branch = `wc/${made.id}`;
  stored.slug = 'example';
  await fs.writeFile(file, `${JSON.stringify(stored)}\n`);
  return { context, made };
}

for (const file of ['MAP.md', 'IDEA.md', 'PLAN.md']) {
  test(`reads archived ${file} with git show from the thread branch`, async () => {
    const { context, made } = await archivedDocumentContext();
    try {
      const result = await api(context, `/threads/${made.id}/doc?file=${file}`);
      assert.equal(result.body.content, 'archived plan\n');
    } finally {
      await close(context);
    }
  });
}

test('refuses archived documents outside MAP, IDEA and PLAN', async () => {
  const { context, made } = await archivedDocumentContext();
  try {
    const result = await api(context, `/threads/${made.id}/doc?file=other.md`);
    assert.equal(result.status, 404);
  } finally {
    await close(context);
  }
});

test('finds a worktree plan slug on thread and chat routes', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const worktree = context.machine.sessions.get(made.sessions[0].name).worktree;
    await fs.mkdir(path.join(worktree, 'docs', 'plans', 'registered-feature'), { recursive: true });
    // A worktree is a git checkout; the thread's plan is the one its branch adds (untracked here).
    require('node:child_process').execFileSync('git', ['init', '-q', worktree]);
    await fs.writeFile(path.join(worktree, 'docs', 'plans', 'registered-feature', 'IDEA.md'), 'idea\n');
    const listed = await api(context, '/threads');
    assert.equal(listed.body.threads.find((item) => item.id === made.id).slug, 'registered-feature');
    const chat = await api(context, `/threads/${made.id}/chat`);
    assert.equal(chat.body.thread.slug, 'registered-feature');
  });
});

test('groups features by the current plan status and lists open needs', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const worktree = context.machine.sessions.get(made.sessions[0].name).worktree;
    const plan = path.join(worktree, 'docs', 'plans', 'example');
    await fs.mkdir(plan, { recursive: true });
    await fs.writeFile(path.join(plan, 'PLAN.md'), 'status: implementing\n');
    const file = path.join(context.state, 'threads', `${made.id}.json`);
    const stored = JSON.parse(await fs.readFile(file, 'utf8'));
    stored.slug = 'example';
    stored.cards.push({ id: 'q1', kind: 'question', question: 'Choose?', answered: false });
    await fs.writeFile(file, `${JSON.stringify(stored)}\n`);
    const result = await api(context, '/features');
    assert.equal(result.body.building[0].id, made.id);
    assert.equal(result.body.needs[0].card_id, 'q1');
  });
});

test('returns every machine session and persists its last-seen time', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const result = await api(context, '/sessions');
    assert.equal(result.body[0].reachable, true);
    assert.equal(result.body[0].sessions[0].name, made.sessions[0].name);
    assert.match(result.body[0].last_seen, /^\d{4}-\d{2}-\d{2}T/);
    const machines = JSON.parse(await fs.readFile(path.join(context.state, 'machines.json'), 'utf8'));
    assert.equal(machines.hub.last_seen, result.body[0].last_seen);
  });
});

test('proxies pane reads and raw terminal keys through the machine service', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const name = made.sessions[0].name;
    const pane = await api(context, `/sessions/${name}/pane`);
    const keys = await api(context, `/sessions/${name}/keys`, {
      method: 'POST',
      body: { keys: 'C-c' },
    });
    assert.equal(pane.body.pane, 'fake pane');
    assert.equal(keys.body.ok, true);
  });
});

test('reads an unrecorded service pane but refuses its keys', async () => {
  await withContext(async (context) => {
    context.machine.sessions.set('scratch-shell', { name: 'scratch-shell', status: 'ready', running: true });
    const pane = await api(context, '/sessions/scratch-shell/pane');
    const keys = await api(context, '/sessions/scratch-shell/keys', {
      method: 'POST', body: { keys: 'C-c' },
    });
    assert.equal(pane.status, 200);
    assert.equal(keys.status, 403);
  });
});

test('refuses a browser write from the wrong origin', async () => {
  await withContext(async (context) => {
    const response = await fetch(`${context.server.url}/api/threads`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-graph-token': context.server.token,
        origin: 'https://wrong.invalid',
      },
      body: JSON.stringify({ project: '/tmp/project', cli: 'codex' }),
    });
    assert.equal(response.status, 403);
  });
});

test('refuses a machine callback without its secret', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const response = await api(context, '/machine/events', {
      method: 'POST',
      body: { thread_id: made.id, session: made.sessions[0].name, type: 'turn-ended' },
    });
    assert.equal(response.status, 401);
  });
});

async function startSublead(context, made, lead, attempt = 'build-1') {
  const result = await machinePost(context, '/machine/session', {
    calling_session: lead.name,
    action: 'start',
    role: 'sub-lead',
    cli: 'codex',
    attempt_id: attempt,
  });
  assert.equal(result.status, 200);
  return result.body.session;
}

test('a verifier the lead starts is pointed at the thread branch', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    const result = await machinePost(context, '/machine/session', {
      calling_session: lead.name, action: 'start', role: 'verifier', cli: 'codex', attempt_id: 'verify-1',
    });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(context.machine.sessions.get(result.body.session.name).verify_ref, `wc/${made.id}`);
  });
});

test('the chat reads the lead transcript through the machine service', async () => {
  await withContext(async (context) => {
    const made = await thread(context, { cli: 'claude' });
    context.machine.sessions.get(made.sessions[0].name).transcript = [
      { type: 'user', origin: { kind: 'human' }, message: { role: 'user', content: 'Make it say All done!' } },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] } },
    ].map((row) => JSON.stringify(row)).join('\n');
    const result = await api(context, `/threads/${made.id}/chat`);
    assert.deepEqual(result.body.items.map((item) => item.text), ['Make it say All done!', 'Done.']);
  });
});

async function startVerifier(context, made) {
  const result = await machinePost(context, '/machine/session', {
    calling_session: made.sessions[0].name, action: 'start', role: 'verifier', cli: 'codex', attempt_id: 'v-1',
  });
  return result.body.session;
}

test('a verifier report from its transcript reaches the lead as its result', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    await event(context, made.id, lead.name, 'turn-ended');
    const verifier = await startVerifier(context, made);
    context.machine.sessions.get(verifier.name).transcript = [
      { type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Looking.' }] } },
      { type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'COMMIT: cbd916f\nVERDICT: PASS' }] } },
    ].map((row) => JSON.stringify(row)).join('\n');
    await event(context, made.id, verifier.name, 'turn-ended');
    const hub = new Hub({ stateDir: context.state });
    await hub.init();
    const after = await hub.thread(made.id);
    const result = after.cards.find((item) => item.kind === 'result');
    assert.equal(result.commit, 'cbd916f');
    assert.equal(result.session, verifier.name);
    assert.deepEqual(context.machine.sessions.get(lead.name).submits.at(-1), `[wc:from ${verifier.name}] result: COMMIT: cbd916f\nVERDICT: PASS`);
  });
});

test('a Codex verifier report comes from the notify payload when present, once', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const verifier = await startVerifier(context, made);
    await event(context, made.id, verifier.name, 'turn-ended', { 'last-assistant-message': 'COMMIT: abc1234\nVERDICT: FAIL\nGAP: x' });
    await event(context, made.id, verifier.name, 'turn-ended', { 'last-assistant-message': 'later chatter' });
    const hub = new Hub({ stateDir: context.state });
    await hub.init();
    const results = (await hub.thread(made.id)).cards.filter((item) => item.kind === 'result');
    assert.equal(results.length, 1);
    assert.match(results[0].summary, /VERDICT: FAIL/);
  });
});

test('a mapper works in the thread worktree; a worker branches from the thread branch', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    const mapper = await machinePost(context, '/machine/session', {
      calling_session: lead.name, action: 'start', role: 'mapper', cli: 'codex', attempt_id: 'map-1',
    });
    const started = context.machine.sessions.get(mapper.body.session.name);
    assert.equal(started.worktree, `/tmp/${lead.name}`);
    assert.equal(started.branch, `wc/${made.id}`);
    const sublead = await startSublead(context, made, lead, 'build-w');
    const worker = await machinePost(context, '/machine/session', {
      calling_session: sublead.name, action: 'start', role: 'worker', cli: 'codex', attempt_id: 'T1-1',
    });
    const workerStarted = context.machine.sessions.get(worker.body.session.name);
    assert.equal(workerStarted.base, `wc/${made.id}`);
    assert.equal(workerStarted.worktree, `/tmp/${worker.body.session.name}`);
  });
});
