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
    assert.equal(await fs.readFile(path.join(context.state, 'projects.json'), 'utf8'), '[\n  "/tmp/project"\n]\n');
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

test('posts a permission need and holds the session queue while the prompt is open', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    await event(context, made.id, lead.name, 'turn-ended');
    await event(context, made.id, lead.name, 'prompt', { notification_type: 'permission_prompt' });
    await api(context, `/threads/${made.id}/messages`, { method: 'POST', body: { text: 'Wait for the prompt.' } });
    assert.equal(context.machine.sessions.get(lead.name).submits, undefined);
    const chat = await api(context, `/threads/${made.id}/chat`);
    assert.equal(chat.body.cards.at(-1).title, 'Permission needed');
    assert.equal(chat.body.cards.at(-1).session, lead.name);
  });
});

test('a turn ending after a permission prompt clears the hold and the card', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    await event(context, made.id, lead.name, 'turn-ended');
    await event(context, made.id, lead.name, 'prompt', { notification_type: 'permission_prompt' });
    await api(context, `/threads/${made.id}/messages`, { method: 'POST', body: { text: 'After the prompt.' } });
    await event(context, made.id, lead.name, 'turn-ended');
    assert.deepEqual(context.machine.sessions.get(lead.name).submits, ['After the prompt.']);
    const chat = await api(context, `/threads/${made.id}/chat`);
    assert.equal(chat.body.cards.find((item) => item.title === 'Permission needed').answered, true);
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
  // The hub's own version check runs `git rev-parse HEAD` too; it gets the real commit.
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  await fs.writeFile(git, `#!/bin/sh\ncase "$*" in *rev-parse*) echo ${head};; *) printf "archived plan\\n";; esac\n`);
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

function pinned(tier) {
  return execFileSync(path.join(__dirname, '..', '..', 'codex', 'model.sh'), [tier], { encoding: 'utf8' }).trim();
}

async function startAs(context, lead, role, cli, tier) {
  return machinePost(context, '/machine/session', {
    calling_session: lead.name, action: 'start', role, cli, tier, attempt_id: `${role}-${cli}-${tier}`,
  });
}

test('models per role: a Codex lead runs on Sol and tiers resolve through codex/model.sh', async () => {
  await withContext(async (context) => {
    const made = await thread(context, { cli: 'codex' });
    const lead = made.sessions[0];
    assert.equal(context.machine.sessions.get(lead.name).model, pinned('sol'));
    for (const [tier, model] of [['terra', pinned('terra')], ['luna', pinned('luna')], ['top', pinned('sol')]]) {
      const result = await startAs(context, lead, 'reviewer', 'codex', tier);
      assert.equal(result.status, 200);
      assert.equal(context.machine.sessions.get(result.body.session.name).model, model);
    }
  });
});

test('models per role: Claude tiers pass by name and top means no model', async () => {
  await withContext(async (context) => {
    const made = await thread(context, { cli: 'claude' });
    const lead = made.sessions[0];
    assert.equal(context.machine.sessions.get(lead.name).model, undefined);
    const sonnet = await startAs(context, lead, 'reviewer', 'claude', 'sonnet');
    assert.equal(context.machine.sessions.get(sonnet.body.session.name).model, 'sonnet');
    const top = await startAs(context, lead, 'verifier', 'claude', 'top');
    assert.equal(context.machine.sessions.get(top.body.session.name).model, undefined);
  });
});

test('models per role: a tier that does not fit the CLI is refused with the reason', async () => {
  await withContext(async (context) => {
    const made = await thread(context, { cli: 'claude' });
    const lead = made.sessions[0];
    const wrong = await startAs(context, lead, 'reviewer', 'claude', 'luna');
    assert.equal(wrong.status, 400);
    assert.match(wrong.body.detail, /tier "luna" does not fit claude/);
    const other = await startAs(context, lead, 'reviewer', 'codex', 'haiku');
    assert.equal(other.status, 400);
    assert.match(other.body.detail, /does not fit codex/);
  });
});

test('no session starts while the machine service runs another commit', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    context.machine.status.version = 'not-the-hubs-commit';
    const refused = await startAs(context, made.sessions[0], 'reviewer', 'codex', 'top');
    assert.equal(refused.status, 409);
    assert.match(refused.body.detail, /machine service out of date/);
    const lead = await api(context, '/threads', { method: 'POST', body: { project: '/tmp/project', cli: 'codex' } });
    assert.equal(lead.status, 409);
  });
});

test('the Ready check covers the other family and takes Codex login from the preflight', async () => {
  await withContext(async (context) => {
    const made = await thread(context, { cli: 'claude' });
    const approval = await card(context, made.id, made.sessions[0].name, {
      kind: 'approval', objections: [], ready: { ok: true, missing: [] },
    });
    const press = () => api(context, `/threads/${made.id}/cards/${approval.body.id}/press`, {
      method: 'POST', body: { action: 'recheck' },
    });
    assert.deepEqual((await press()).body.ready, { ok: true, missing: [] });
    context.machine.preflightOk = false;
    const failed = (await press()).body.ready;
    assert.equal(failed.ok, false);
    assert.match(failed.missing[0], /Codex preflight failed/);
    context.machine.preflightOk = true;
    context.machine.status.codex = { installed: false, logged_in: false };
    assert.equal((await press()).body.ready.ok, true);
    context.machine.status.codex = { installed: true, logged_in: true };
    context.machine.status.claude.logged_in = false;
    assert.match((await press()).body.ready.missing[0], /claude is not logged in/);
  });
});

test('projects.json records each thread project once and GET /projects lists them', async () => {
  await withContext(async (context) => {
    await thread(context, { project: '/tmp/proj-a' });
    await thread(context, { project: '/tmp/proj-a' });
    await thread(context, { project: '/tmp/proj-b' });
    const result = await api(context, '/projects');
    assert.deepEqual(result.body.projects, ['/tmp/proj-a', '/tmp/proj-b']);
    const stored = JSON.parse(await fs.readFile(path.join(context.state, 'projects.json'), 'utf8'));
    assert.deepEqual(stored, result.body.projects);
  });
});

test('the sessions list passes unmanaged tmux sessions through as read-only', async () => {
  await withContext(async (context) => {
    await thread(context);
    const result = await api(context, '/sessions');
    assert.deepEqual(result.body[0].sessions.at(-1), { name: 'other-shell', managed: false });
  });
});

test('serializes concurrent cards and de-duplicates a delivered card', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    const post = (summary, delivery_id) => machinePost(context, '/machine/cards', {
      thread_id: made.id, session: lead.name, kind: 'offer', summary, delivery_id,
    });
    const [one, two] = await Promise.all([post('One.', 'd-one'), post('Two.', 'd-two')]);
    assert.equal(one.status, 202); assert.equal(two.status, 202);
    const duplicate = await post('One again.', 'd-one');
    assert.equal(duplicate.status, 200); assert.equal(duplicate.body.duplicate, true);
    const stored = await (new Hub({ stateDir: context.state })).thread(made.id);
    assert.equal(stored.cards.length, 2);
    assert.deepEqual(stored.delivered_ids.sort(), ['d-one', 'd-two']);
  });
});

test('keeps a queued message idle and retryable when submit fails', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    await event(context, made.id, lead.name, 'turn-ended');
    context.machine.submitOk = false;
    const failed = await api(context, `/threads/${made.id}/messages`, { method: 'POST', body: { text: 'Keep me.' } });
    assert.equal(failed.status, 503);
    const stored = await (new Hub({ stateDir: context.state })).thread(made.id);
    assert.equal(stored.sessions[0].queue[0].text, 'Keep me.');
    assert.equal(stored.sessions[0].turn_ended, true);
  });
});

test('runs Codex preflight before a lead start and records its failure as a need', async () => {
  await withContext(async (context) => {
    context.machine.preflightOk = false;
    const result = await api(context, '/threads', { method: 'POST', body: { project: '/tmp/project', cli: 'codex' } });
    assert.equal(result.status, 409);
    const [stored] = await (new Hub({ stateDir: context.state })).allThreads();
    assert.equal(stored.cards.at(-1).title, 'Codex preflight failed');
    assert.ok(context.machine.calls.some((call) => call.path === '/v1/preflight'));
  });
});

test('terminal Enter marks its session busy before the next hook event', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    await api(context, `/sessions/${made.sessions[0].name}/keys`, { method: 'POST', body: { keys: 'Enter' } });
    const stored = await (new Hub({ stateDir: context.state })).thread(made.id);
    assert.equal(stored.sessions[0].turn_ended, false);
  });
});

test('unreachable sessions are public and marked unreachable', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    context.machine.sessionsAvailable = false;
    const result = await api(context, '/sessions');
    const session = result.body[0].sessions.find((item) => item.name === made.sessions[0].name);
    assert.equal(result.body[0].reachable, false);
    assert.equal(session.state, 'unreachable');
    assert.equal(Object.hasOwn(session, 'token'), false);
  });
});

test('a kept rebase makes a need and leaves the thread open', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    context.machine.archiveKept = [{ worktree: '/tmp/wc-rebase', reason: 'rebase in progress' }];
    const result = await api(context, `/threads/${made.id}/archive`, { method: 'POST', body: {} });
    assert.equal(result.status, 200);
    const stored = await (new Hub({ stateDir: context.state })).thread(made.id);
    assert.equal(stored.archived, false);
    const need = stored.cards.find((card) => card.title === 'Rebase needs attention');
    assert.match(need.body, /finish or abort the rebase in \/tmp\/wc-rebase/);
  });
});

test('serializes concurrent card and event arrivals without losing either', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    const turns = 12;
    await Promise.all([...Array(turns)].flatMap((_, index) => [
      card(context, made.id, lead.name, { kind: 'offer', summary: `Offer ${index}.` }),
      event(context, made.id, lead.name, 'prompt', { notification_type: 'permission_prompt' }),
    ]));
    const stored = await (new Hub({ stateDir: context.state })).thread(made.id);
    assert.equal(stored.cards.filter((card) => card.kind === 'offer').length, turns);
    assert.equal(stored.cards.filter((card) => card.kind === 'needs' && card.title === 'Permission needed').length, turns);
    assert.equal(stored.sessions.find((session) => session.name === lead.name).permission_open, true);
  });
});

test('Features includes an opened stub but not an unopened one, and needs need no slug', async () => {
  await withContext(async (context) => {
    const opened = await thread(context);
    const worktree = context.machine.sessions.get(opened.sessions[0].name).worktree;
    await fs.mkdir(path.join(worktree, 'docs', 'plans', 'opened'), { recursive: true });
    await fs.writeFile(path.join(worktree, 'docs', 'plans', 'opened', 'PLAN.md'), 'status: implementing\n');
    const openedFile = path.join(context.state, 'threads', `${opened.id}.json`);
    const openedState = JSON.parse(await fs.readFile(openedFile, 'utf8'));
    Object.assign(openedState, { stub: true, slug: 'opened', worktree });
    await fs.writeFile(openedFile, JSON.stringify(openedState));
    const unopened = await thread(context);
    const unopenedFile = path.join(context.state, 'threads', `${unopened.id}.json`);
    const unopenedState = JSON.parse(await fs.readFile(unopenedFile, 'utf8'));
    unopenedState.stub = true;
    unopenedState.slug = 'unopened';
    unopenedState.sessions = [];
    unopenedState.cards.push({ id: 'ended', kind: 'needs', title: 'Sessions ended', answered: false });
    await fs.writeFile(unopenedFile, JSON.stringify(unopenedState));
    const result = await api(context, '/features');
    assert.equal(result.body.building.some((feature) => feature.id === opened.id), true);
    assert.equal(result.body.building.some((feature) => feature.id === unopened.id), false);
    assert.equal(result.body.needs.some((need) => need.thread_id === unopened.id && need.card_id === 'ended'), true);
  });
});

test('stub commits persist and reach the opened lead context', async () => {
  await withContext(async (context) => {
    const parent = await thread(context);
    const result = await card(context, parent.id, parent.sessions[0].name, {
      kind: 'stub', title: 'Carry commit', summary: 'Pick up the partial fix.', depends_on_parent: false, commits: ['1234567'],
    });
    const child = await (new Hub({ stateDir: context.state })).thread(result.body.thread_id);
    assert.deepEqual(child.commits, ['1234567']);
    const opened = await api(context, `/threads/${child.id}/open`, { method: 'POST', body: {} });
    const lead = opened.body.sessions[0];
    await event(context, child.id, lead.name, 'turn-ended');
    assert.match(context.machine.sessions.get(lead.name).submits[0], /commits to cherry-pick: 1234567/);
  });
});

test('registers a diagram plan before persisting its card', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const file = path.join(context.state, 'threads', `${made.id}.json`);
    const stored = JSON.parse(await fs.readFile(file, 'utf8'));
    stored.worktree = '/tmp/diagram-worktree';
    await fs.writeFile(file, JSON.stringify(stored));
    let observed;
    const hub = new Hub({ stateDir: context.state, registerPlan: async (plan) => {
      observed = { plan, thread: await hub.thread(made.id) };
    } });
    await hub.init();
    await hub.acceptCard({ thread_id: made.id, session: made.sessions[0].name, kind: 'diagram', plan: 'demo', graph: 'flow', title: 'Flow' });
    assert.equal(observed.plan, '/tmp/diagram-worktree/docs/plans/demo');
    assert.equal(observed.thread.cards.some((card) => card.kind === 'diagram'), false);
    assert.equal((await hub.thread(made.id)).cards.some((card) => card.kind === 'diagram'), true);
  });
});

test('reachable Sessions responses do not expose tokens', async () => {
  await withContext(async (context) => {
    await thread(context);
    const result = await api(context, '/sessions');
    assert.ok(result.body[0].sessions.every((session) => !Object.hasOwn(session, 'token')));
  });
});

test('a replacement sub-lead stops its predecessor worker, but a worker cannot stop a worker child', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const first = await startSublead(context, made, made.sessions[0], 'first');
    const worker = (await machinePost(context, '/machine/session', {
      calling_session: first.name, action: 'start', role: 'worker', cli: 'codex', attempt_id: 'worker',
    })).body.session;
    const file = path.join(context.state, 'threads', `${made.id}.json`);
    const stored = JSON.parse(await fs.readFile(file, 'utf8'));
    stored.sessions.find((session) => session.name === first.name).live = false;
    stored.sessions.find((session) => session.name === worker.name).worktree = '/tmp/reused-worker';
    stored.sessions.find((session) => session.name === worker.name).branch = 'wc/reused-worker';
    await fs.writeFile(file, JSON.stringify(stored));
    const second = await startSublead(context, made, made.sessions[0], 'second');
    const stopped = await machinePost(context, '/machine/session', { calling_session: second.name, action: 'stop', name: worker.name });
    assert.equal(stopped.status, 200);
    const current = JSON.parse(await fs.readFile(file, 'utf8'));
    const other = { ...current.sessions.find((session) => session.name === worker.name), name: 'wc-other-worker', started_by: second.name, role: 'worker', live: true };
    const child = { ...other, name: 'wc-worker-child', started_by: other.name, live: true };
    current.sessions.push(other, child);
    await fs.writeFile(file, JSON.stringify(current));
    const denied = await machinePost(context, '/machine/session', { calling_session: worker.name, action: 'stop', name: child.name });
    assert.equal(denied.status, 403);
  });
});

test('worker replacement reuses a dead worker worktree and branch only', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const sublead = await startSublead(context, made, made.sessions[0], 'build');
    const worker = (await machinePost(context, '/machine/session', {
      calling_session: sublead.name, action: 'start', role: 'worker', cli: 'codex', attempt_id: 'original',
    })).body.session;
    const file = path.join(context.state, 'threads', `${made.id}.json`);
    const stored = JSON.parse(await fs.readFile(file, 'utf8'));
    const old = stored.sessions.find((session) => session.name === worker.name);
    Object.assign(old, { live: false, worktree: '/tmp/reused-worker', branch: 'wc/reused-worker' });
    await fs.writeFile(file, JSON.stringify(stored));
    const replacement = await machinePost(context, '/machine/session', {
      calling_session: sublead.name, action: 'start', role: 'worker', cli: 'codex', attempt_id: 'replacement', replaces: worker.name,
    });
    assert.equal(replacement.status, 200);
    const start = context.machine.calls.filter((call) => call.path === '/v1/sessions' && call.method === 'POST').at(-1).body;
    assert.equal(start.worktree, '/tmp/reused-worker');
    assert.equal(start.branch, 'wc/reused-worker');
    const current = JSON.parse(await fs.readFile(file, 'utf8'));
    current.sessions.find((session) => session.name === worker.name).live = true;
    await fs.writeFile(file, JSON.stringify(current));
    const live = await machinePost(context, '/machine/session', {
      calling_session: sublead.name, action: 'start', role: 'worker', cli: 'codex', attempt_id: 'live', replaces: worker.name,
    });
    assert.equal(live.status, 400);
    const nonWorker = await machinePost(context, '/machine/session', {
      calling_session: sublead.name, action: 'start', role: 'worker', cli: 'codex', attempt_id: 'non-worker', replaces: sublead.name,
    });
    assert.equal(nonWorker.status, 400);
  });
});
