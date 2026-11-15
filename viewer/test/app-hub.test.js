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
const { startMachine } = require('./helpers/app-machine.js');
const { ROOT, startServer } = require('./helpers/server.js');

async function withContext(work, options = {}) {
  const context = await setup(options);
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

test('derives an opening title and lets only the lead rename it with title cards', async () => {
  await withContext(async (context) => {
    const made = await thread(context, {
      message: '  First  line title has enough words to demonstrate the sixty character cut exactly here today  \nSecond line is ignored.',
    });
    assert.equal(made.title, 'First line title has enough words to demonstrate the sixty…');
    const untitled = await thread(context);
    assert.equal(Object.hasOwn(untitled, 'title'), false);

    const lead = made.sessions[0];
    const first = await card(context, made.id, lead.name, { kind: 'title', title: '  A concise name  ' });
    assert.equal(first.status, 202);
    const second = await card(context, made.id, lead.name, { kind: 'title', title: 'A later name' });
    assert.equal(second.status, 202);
    const after = await api(context, `/threads/${made.id}/chat`);
    assert.equal(after.body.thread.title, 'A later name');
    assert.equal(after.body.cards.some((item) => item.kind === 'title'), false);

    const sublead = await startSublead(context, made, lead);
    const refused = await card(context, made.id, sublead.name, { kind: 'title', title: 'Nope' });
    assert.equal(refused.status, 422);
  });
});

test('validates the optional question document name', () => {
  const question = {
    fits: 'This confirms the idea.', question: 'Does this fit?',
    options: [{ id: 'yes', label: 'Yes', consequence: 'Continue.' }, { id: 'no', label: 'No', consequence: 'Change it.' }],
    leaning: 'yes', why: 'It matches the request.', doc: 'IDEA.md',
  };
  assert.equal(validate('question', question, 'lead').ok, true);
  assert.equal(validate('question', { ...question, doc: 'x.md' }, 'lead').ok, false);
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
    await card(context, made.id, lead.name, { kind: 'idea', bullets: [{ id: 'one', text: 'First.' }] });
    await card(context, made.id, lead.name, { kind: 'idea', bullets: [{ id: 'two', text: 'Second.' }] });
    const stored = JSON.parse(
      await fs.readFile(path.join(context.state, 'threads', `${made.id}.json`), 'utf8'),
    );
    assert.equal(stored.pinned.idea.bullets[0].text, 'Second.');
    assert.equal(stored.cards.filter((item) => !item.replaced).length, 1);
  });
});

test('records a press and lets a lead resolve an open question only in its thread', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    const question = {
      kind: 'question', fits: 'This settles the approach.', question: 'Which?',
      options: [{ id: 'a', label: 'A', consequence: 'Use A.' }, { id: 'b', label: 'B', consequence: 'Use B.' }],
      leaning: 'a', why: 'It is simpler.',
    };
    const pressedQuestion = await card(context, made.id, lead.name, question);
    const pressed = await api(context, `/threads/${made.id}/cards/${pressedQuestion.body.id}/press`, {
      method: 'POST', body: { action: 'picked', value: 'A' },
    });
    assert.equal(pressed.status, 202);
    const pressedCard = (await api(context, `/threads/${made.id}/chat`)).body.cards.find((item) => item.id === pressedQuestion.body.id);
    assert.equal(pressedCard.answered_action, 'picked');
    assert.equal(pressedCard.answered_value, 'A');

    const openQuestion = await card(context, made.id, lead.name, question);
    const resolved = await card(context, made.id, lead.name, {
      kind: 'resolve', card: openQuestion.body.id, note: 'Collin chose A in chat.',
    });
    assert.equal(resolved.status, 202);
    const resolvedCard = (await api(context, `/threads/${made.id}/chat`)).body.cards.find((item) => item.id === openQuestion.body.id);
    assert.equal(resolvedCard.resolved_note, 'Collin chose A in chat.');

    const answered = await card(context, made.id, lead.name, {
      kind: 'resolve', card: openQuestion.body.id, note: 'Again.',
    });
    assert.equal(answered.status, 422);
    const other = await thread(context);
    const foreignQuestion = await card(context, other.id, other.sessions[0].name, question);
    const foreign = await card(context, made.id, lead.name, {
      kind: 'resolve', card: foreignQuestion.body.id, note: 'Wrong thread.',
    });
    assert.equal(foreign.status, 422);
    const systemNeed = await event(context, made.id, lead.name, 'prompt', { notification_type: 'permission_prompt' });
    assert.equal(systemNeed.status, 202);
    const chat = await api(context, `/threads/${made.id}/chat`);
    const system = chat.body.cards.find((item) => item.kind === 'needs' && item.system);
    const systemRefused = await card(context, made.id, lead.name, {
      kind: 'resolve', card: system.id, note: 'No.',
    });
    assert.equal(systemRefused.status, 422);
    const dismissed = await api(context, `/threads/${made.id}/cards/${pressedQuestion.body.id}/dismiss`, {
      method: 'POST', body: {},
    });
    assert.equal(dismissed.status, 422);
  });
});

test('limits offers to a second request after keep talking first', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    const first = await card(context, made.id, lead.name, { kind: 'offer', summary: 'First offer.' });
    assert.equal(first.status, 202);
    const keptTalking = await api(context, `/threads/${made.id}/cards/${first.body.id}/press`, {
      method: 'POST', body: { action: 'picked', value: 'keep talking first' },
    });
    assert.equal(keptTalking.status, 202);
    const second = await card(context, made.id, lead.name, { kind: 'offer', summary: 'Clearer offer.' });
    assert.equal(second.status, 202);
    const chat = await api(context, `/threads/${made.id}/chat`);
    assert.equal(chat.body.pinned.find((item) => item.kind === 'offer').id, second.body.id);
    const third = await card(context, made.id, lead.name, { kind: 'offer', summary: 'Third offer.' });
    assert.equal(third.status, 422);
    assert.equal(third.body.detail, 'the offer was already asked');

    const planned = await thread(context);
    const plannedFirst = await card(context, planned.id, planned.sessions[0].name, { kind: 'offer', summary: 'Plan it.' });
    await api(context, `/threads/${planned.id}/cards/${plannedFirst.body.id}/press`, {
      method: 'POST', body: { action: 'picked', value: 'take it into planning' },
    });
    const afterPlanning = await card(context, planned.id, planned.sessions[0].name, { kind: 'offer', summary: 'Again.' });
    assert.equal(afterPlanning.status, 422);
    assert.equal(afterPlanning.body.detail, 'the offer was already asked');

    const unanswered = await thread(context);
    await card(context, unanswered.id, unanswered.sessions[0].name, { kind: 'offer', summary: 'Waiting.' });
    const whileOpen = await card(context, unanswered.id, unanswered.sessions[0].name, { kind: 'offer', summary: 'Too soon.' });
    assert.equal(whileOpen.status, 422);
    assert.equal(whileOpen.body.detail, 'the offer was already asked');
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

function pinned(context, provider, tier) {
  return execFileSync(path.join(__dirname, '..', '..', 'codex', 'model.sh'), [provider, tier], {
    encoding: 'utf8', env: { ...process.env, WHEELCHAIR_MODELS: context.models, WHEELCHAIR_MODELS_CACHE: context.modelsCache },
  }).trim();
}

async function startAs(context, lead, role, cli, tier) {
  return machinePost(context, '/machine/session', {
    calling_session: lead.name, action: 'start', role, cli, tier, attempt_id: `${role}-${cli}-${tier}`,
  });
}

test('models per role: leads, other agents, workers, aliases, and critical resolve through their provider cells', async () => {
  await withContext(async (context) => {
    const made = await thread(context, { cli: 'codex' });
    const lead = made.sessions[0];
    assert.equal(context.machine.sessions.get(lead.name).model, pinned(context, 'gpt', 'lead'));
    for (const tier of ['light', 'standard', 'heavy', 'critical', 'luna', 'terra', 'sol', 'astra', 'top']) {
      const result = await startAs(context, lead, 'reviewer', 'codex', tier);
      assert.equal(result.status, 200);
      assert.equal(context.machine.sessions.get(result.body.session.name).model, pinned(context, 'gpt', 'heavy'));
    }
    const sublead = await startSublead(context, made, lead, 'models-worker');
    const worker = await machinePost(context, '/machine/session', { calling_session: sublead.name, action: 'start', role: 'worker', cli: 'codex', tier: 'critical', attempt_id: 'critical-worker' });
    assert.equal(context.machine.sessions.get(worker.body.session.name).model, pinned(context, 'gpt', 'critical'));
    const alias = await machinePost(context, '/machine/session', { calling_session: sublead.name, action: 'start', role: 'worker', cli: 'codex', tier: 'terra', attempt_id: 'alias-worker' });
    assert.equal(context.machine.sessions.get(alias.body.session.name).model, pinned(context, 'gpt', 'standard'));
  });
});

test('models per role: Claude always gets a model and effort, and preferences reach the machine', async () => {
  await withContext(async (context) => {
    await api(context, '/settings/models', { method: 'PUT', body: { provider: 'claude', slot: 'lead', model: 'claude-opus-5-5', effort: 'high' } });
    await api(context, '/settings/preferences', { method: 'PUT', body: { permission_mode: 'bypass', other_agents: { reviewer: 'critical' } } });
    const made = await thread(context, { cli: 'claude' });
    const lead = made.sessions[0];
    assert.equal(context.machine.sessions.get(lead.name).model, 'claude-opus-5-5');
    assert.equal(context.machine.sessions.get(lead.name).effort, 'high');
    assert.equal(context.machine.sessions.get(lead.name).permission_mode, 'bypass');
    const reviewer = await startAs(context, lead, 'reviewer', 'claude', 'haiku');
    assert.equal(context.machine.sessions.get(reviewer.body.session.name).model, pinned(context, 'claude', 'critical'));
  });
});

test('models per role: Claude family aliases do not become Codex tiers', async () => {
  await withContext(async (context) => {
    const codex = await thread(context, { cli: 'codex' });
    const codexSublead = await startSublead(context, codex, codex.sessions[0], 'codex-aliases');
    const codexAlias = await machinePost(context, '/machine/session', {
      calling_session: codexSublead.name, action: 'start', role: 'worker', cli: 'codex', tier: 'haiku', attempt_id: 'codex-haiku',
    });
    assert.equal(codexAlias.status, 400);
    assert.match(codexAlias.body.detail, /light, standard, heavy, critical/);

    const claude = await thread(context, { cli: 'claude', project: '/tmp/claude-aliases' });
    const claudeSublead = await machinePost(context, '/machine/session', {
      calling_session: claude.sessions[0].name, action: 'start', role: 'sub-lead', cli: 'claude', attempt_id: 'claude-aliases',
    });
    assert.equal(claudeSublead.status, 200);
    const claudeAlias = await machinePost(context, '/machine/session', {
      calling_session: claudeSublead.body.session.name, action: 'start', role: 'worker', cli: 'claude', tier: 'haiku', attempt_id: 'claude-haiku',
    });
    assert.equal(claudeAlias.status, 200);
    assert.equal(context.machine.sessions.get(claudeAlias.body.session.name).model, pinned(context, 'claude', 'light'));

    const oldClaudeAlias = await api(context, '/settings/preferences', { method: 'PUT', body: { other_agents: { reviewer: 'haiku' } } });
    assert.equal(oldClaudeAlias.status, 400);
    const oldTierAlias = await api(context, '/settings/preferences', { method: 'PUT', body: { other_agents: { reviewer: 'luna' } } });
    assert.equal(oldTierAlias.status, 200);
    assert.equal(oldTierAlias.body.other_agents.reviewer, 'light');
  });
});

test('models per role: unknown tiers and unused provider cells are refused', async () => {
  await withContext(async (context) => {
    const made = await thread(context, { cli: 'codex' });
    const lead = made.sessions[0];
    const sublead = await startSublead(context, made, lead, 'bad-tier');
    const wrong = await machinePost(context, '/machine/session', { calling_session: sublead.name, action: 'start', role: 'worker', cli: 'codex', tier: 'wrong', attempt_id: 'wrong-tier' });
    assert.equal(wrong.status, 400);
    assert.match(wrong.body.detail, /light, standard, heavy, critical/);
    await api(context, '/settings/models', { method: 'PUT', body: { provider: 'gpt', slot: 'heavy', model: null } });
    const unused = await startAs(context, lead, 'reviewer', 'codex', 'light');
    assert.equal(unused.status, 400);
    assert.match(unused.body.detail, /gpt is not used at heavy; use the other CLI/);
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
    const post = (text, delivery_id) => machinePost(context, '/machine/cards', {
      thread_id: made.id, session: lead.name, kind: 'idea', bullets: [{ id: delivery_id, text }], delivery_id,
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

test('a failed event submit records its delivery id and leaves its queue for a later retry', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    await api(context, `/threads/${made.id}/messages`, { method: 'POST', body: { text: 'Deliver on retry.' } });
    context.machine.submitOk = false;
    const first = await event(context, made.id, lead.name, 'turn-ended', { delivery_id: 'event-retry' });
    assert.equal(first.status, 202);
    let stored = await (new Hub({ stateDir: context.state })).thread(made.id);
    assert.equal(stored.delivered_ids?.includes('event-retry'), true);
    assert.equal(stored.sessions.find((session) => session.name === lead.name).queue.length, 1);
    context.machine.submitOk = true;
    const retry = await event(context, made.id, lead.name, 'turn-ended');
    assert.equal(retry.status, 202);
    assert.deepEqual(context.machine.sessions.get(lead.name).submits, ['Deliver on retry.']);
    stored = await (new Hub({ stateDir: context.state })).thread(made.id);
    assert.deepEqual(stored.delivered_ids.filter((id) => id === 'event-retry'), ['event-retry']);
    assert.equal(stored.sessions.find((session) => session.name === lead.name).queue.length, 0);
  });
});

test('a failed result-card submit is accepted, queued, and never rejected', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    const sublead = await startSublead(context, made, lead);
    await event(context, made.id, lead.name, 'turn-ended');
    const payload = {
      thread_id: made.id,
      session: sublead.name,
      kind: 'result',
      task: 'build',
      outcome: 'done',
      summary: 'Send this once.',
      delivery_id: 'card-retry',
    };
    context.machine.submitOk = false;
    const first = await machinePost(context, '/machine/cards', payload);
    assert.equal(first.status, 202);
    const stored = await (new Hub({ stateDir: context.state })).thread(made.id);
    assert.deepEqual(stored.delivered_ids.filter((id) => id === 'card-retry'), ['card-retry']);
    assert.equal(stored.cards.filter((item) => item.kind === 'result' && item.summary === 'Send this once.').length, 1);
    const queued = stored.sessions.find((session) => session.name === lead.name);
    assert.equal(queued.queue[0].text, `[wc:from ${sublead.name}] result: Send this once.`);
    assert.match(queued.delivery_error.text, /temporarily unavailable/);
    assert.match(queued.delivery_error.at, /^\d{4}-\d{2}-\d{2}T/);
    await assert.rejects(fs.access(path.join(context.state, 'spool', 'rejected', 'cards')));
  });
});

test('a browser message stays queued and reports delivery failure without failing its route', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    await event(context, made.id, lead.name, 'turn-ended');
    context.machine.submitOk = false;
    const failed = await api(context, `/threads/${made.id}/messages`, { method: 'POST', body: { text: 'Keep me.' } });
    assert.equal(failed.status, 202);
    const stored = await (new Hub({ stateDir: context.state })).thread(made.id);
    assert.equal(stored.sessions[0].queue[0].text, 'Keep me.');
    assert.equal(stored.sessions[0].turn_ended, true);
    assert.match(stored.sessions[0].delivery_error.text, /temporarily unavailable/);
  });
});

test('a verifier report survives a failed submit and the queue timer retries it', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    await event(context, made.id, lead.name, 'turn-ended');
    const verifier = await startVerifier(context, made);
    context.machine.submitOk = false;
    const report = await event(context, made.id, verifier.name, 'turn-ended', {
      delivery_id: 'verifier-report',
      'last-assistant-message': 'COMMIT: abc1234\nVERDICT: PASS',
    });
    assert.equal(report.status, 202);
    let stored = await (new Hub({ stateDir: context.state })).thread(made.id);
    assert.equal(stored.sessions.find((session) => session.name === verifier.name).finished, true);
    assert.equal(stored.sessions.find((session) => session.name === lead.name).queue.length, 1);
    assert.match(stored.sessions.find((session) => session.name === lead.name).delivery_error.text, /temporarily unavailable/);
    context.machine.submitOk = true;
    const deadline = Date.now() + 1_000;
    while (!(context.machine.sessions.get(lead.name).submits || []).length && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.deepEqual(context.machine.sessions.get(lead.name).submits, [
      `[wc:from ${verifier.name}] result: COMMIT: abc1234\nVERDICT: PASS`,
    ]);
    stored = await (new Hub({ stateDir: context.state })).thread(made.id);
    assert.equal(stored.sessions.find((session) => session.name === lead.name).queue.length, 0);
    assert.equal(stored.sessions.find((session) => session.name === lead.name).delivery_error, undefined);
  }, { env: { WHEELCHAIR_QUEUE_RETRY_MS: '10' } });
});

test('talking about an approval keeps it open for Needs you and Start building', async () => {
  await withContext(async (context) => {
    context.machine.status.version = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const made = await thread(context);
    const approval = await card(context, made.id, made.sessions[0].name, {
      kind: 'approval', objections: [], ready: { ok: true, missing: [] },
    });
    const talked = await api(context, `/threads/${made.id}/cards/${approval.body.id}/press`, {
      method: 'POST', body: { action: 'talk', value: 'One more concern.' },
    });
    assert.equal(talked.status, 202);
    let stored = await (new Hub({ stateDir: context.state })).thread(made.id);
    assert.equal(stored.cards.find((card) => card.id === approval.body.id).answered, false);
    const features = await api(context, '/features');
    assert.equal(features.body.needs.some((need) => need.card_id === approval.body.id), true);
    const started = await api(context, `/threads/${made.id}/cards/${approval.body.id}/press`, {
      method: 'POST', body: { action: 'start-building' },
    });
    assert.equal(started.status, 202);
    stored = await (new Hub({ stateDir: context.state })).thread(made.id);
    assert.equal(stored.cards.find((card) => card.id === approval.body.id).answered, true);
  });
});

test('successful submits record their destination, source, text, and time', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    await event(context, made.id, lead.name, 'turn-ended');
    await api(context, `/threads/${made.id}/messages`, { method: 'POST', body: { text: 'Remember this.' } });
    const stored = await (new Hub({ stateDir: context.state })).thread(made.id);
    assert.deepEqual({
      to: stored.sent[0].to,
      text: stored.sent[0].text,
      source: stored.sent[0].source,
    }, { to: lead.name, text: 'Remember this.', source: 'collin' });
    assert.match(stored.sent[0].at, /^\d{4}-\d{2}-\d{2}T/);
  });
});

test('sent history keeps 500 entries and appends older entries beside the thread file', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const file = path.join(context.state, 'threads', `${made.id}.json`);
    const before = JSON.parse(await fs.readFile(file, 'utf8'));
    before.sent = Array.from({ length: 500 }, (_, index) => ({
      to: made.sessions[0].name, text: `old-${index}`, source: 'collin', at: `2026-01-01T00:00:${String(index % 60).padStart(2, '0')}.000Z`,
    }));
    await fs.writeFile(file, `${JSON.stringify(before)}\n`);
    await event(context, made.id, made.sessions[0].name, 'turn-ended');
    await api(context, `/threads/${made.id}/messages`, { method: 'POST', body: { text: 'newest' } });
    const stored = await (new Hub({ stateDir: context.state })).thread(made.id);
    assert.equal(stored.sent.length, 500);
    assert.equal(stored.sent[0].text, 'old-1');
    assert.equal(stored.sent.at(-1).text, 'newest');
    const archived = (await fs.readFile(path.join(context.state, 'threads', `${made.id}.sent.jsonl`), 'utf8'))
      .trim().split('\n').map((line) => JSON.parse(line));
    assert.deepEqual(archived, [before.sent[0]]);
  });
});

test('restart context includes the latest twenty Collin and card messages', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const oldLead = made.sessions[0];
    const file = path.join(context.state, 'threads', `${made.id}.json`);
    const before = JSON.parse(await fs.readFile(file, 'utf8'));
    before.sent = Array.from({ length: 28 }, (_, index) => ({
      to: oldLead.name,
      text: `message-${index}`,
      source: index % 4 === 0 ? 'app' : (index % 2 ? 'collin' : 'card'),
      at: `2026-01-01T00:00:${String(index).padStart(2, '0')}.000Z`,
    }));
    await fs.writeFile(file, `${JSON.stringify(before)}\n`);
    context.machine.sessions.get(oldLead.name).running = false;
    const hub = new Hub({ stateDir: context.state });
    await hub.init();
    await hub.pollDead();
    const restarted = await api(context, `/threads/${made.id}/restart`, { method: 'POST', body: {} });
    const after = await hub.thread(made.id);
    const replacement = after.sessions.find((session) => session.name === restarted.body.name);
    const contextMessage = replacement.queue.find((message) => message.source === 'context');
    const state = JSON.parse(contextMessage.text.replace(/^\[wc:context restart] Thread state:\n/, ''));
    const expected = before.sent.filter((message) => ['collin', 'card'].includes(message.source)).slice(-20);
    assert.deepEqual(state.recent_messages, expected);
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

test('a second archive records the thread after a retained rebase worktree is removed', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    context.machine.archiveKept = [{ worktree: '/tmp/wc-rebase', reason: 'rebase in progress' }];
    await api(context, `/threads/${made.id}/archive`, { method: 'POST', body: {} });
    context.machine.archiveKept = [];
    const second = await api(context, `/threads/${made.id}/archive`, { method: 'POST', body: {} });
    assert.equal(second.status, 200);
    const stored = await (new Hub({ stateDir: context.state })).thread(made.id);
    assert.equal(stored.archived, true);
    assert.deepEqual(stored.archive.kept, []);
  });
});

test('serializes concurrent card and event arrivals without losing either', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0];
    const turns = 12;
    await Promise.all([...Array(turns)].flatMap((_, index) => [
      card(context, made.id, lead.name, {
        kind: 'question', fits: 'Concurrent card.', question: `Question ${index}?`, leaning: 'yes', why: 'Test concurrency.',
        options: [{ id: 'yes', label: 'Yes', consequence: 'Continue.' }, { id: 'no', label: 'No', consequence: 'Wait.' }],
      }),
      event(context, made.id, lead.name, 'prompt', { notification_type: 'permission_prompt' }),
    ]));
    const stored = await (new Hub({ stateDir: context.state })).thread(made.id);
    assert.equal(stored.cards.filter((card) => card.kind === 'question').length, turns);
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

test('a diagram card registers its graph for the real viewer iframe route', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const worktree = path.join(context.state, 'diagram-worktree');
    const graph = path.join(worktree, 'docs', 'plans', 'demo', 'graphs', 'flow.json');
    await fs.mkdir(path.dirname(graph), { recursive: true });
    await fs.copyFile(path.join(__dirname, 'fixtures', 'canonical.json'), graph);
    const file = path.join(context.state, 'threads', `${made.id}.json`);
    const stored = JSON.parse(await fs.readFile(file, 'utf8'));
    stored.worktree = worktree;
    await fs.writeFile(file, JSON.stringify(stored));
    const posted = await card(context, made.id, made.sessions[0].name, {
      kind: 'diagram', plan: 'demo', graph: 'flow', title: 'Flow',
    });
    assert.equal(posted.status, 202);
    const signIn = await fetch(`${context.server.url}/?token=${context.server.token}`, { redirect: 'manual' });
    assert.equal(signIn.status, 303);
    const cookie = signIn.headers.get('set-cookie').split(';')[0];
    const iframe = await fetch(`${context.server.url}/?path=${encodeURIComponent(graph)}`, { headers: { cookie } });
    assert.equal(iframe.status, 200);
  });
});

test('the real viewer keeps its boot commit when its clone moves before the first app request', async () => {
  const clone = await fs.mkdtemp(path.join(os.tmpdir(), 'wheelchair-viewer-version-'));
  execFileSync('git', ['clone', '--quiet', '--no-local', ROOT, clone]);
  // The test worktree has uncommitted implementation changes; give the temporary clone the
  // running server and hub sources while retaining its own independent Git HEAD.
  await fs.copyFile(path.join(ROOT, 'viewer', 'server.js'), path.join(clone, 'viewer', 'server.js'));
  await fs.copyFile(path.join(ROOT, 'viewer', 'app', 'hub.js'), path.join(clone, 'viewer', 'app', 'hub.js'));
  const machine = await startMachine();
  const state = await fs.mkdtemp(path.join(os.tmpdir(), 'wheelchair-viewer-state-'));
  await fs.writeFile(path.join(state, 'machines.json'), JSON.stringify({
    hub: { name: 'hub', address: '127.0.0.1', port: machine.port, secret: machine.secret },
  }));
  const server = await startServer({ stateDir: state, cwd: clone });
  try {
    await fs.writeFile(path.join(clone, 'boot-version-test.txt'), 'new head\n');
    execFileSync('git', ['-C', clone, 'config', 'user.email', 'test@example.com']);
    execFileSync('git', ['-C', clone, 'config', 'user.name', 'Viewer test']);
    execFileSync('git', ['-C', clone, 'add', 'boot-version-test.txt']);
    execFileSync('git', ['-C', clone, 'commit', '--quiet', '-m', 'move HEAD after server boot']);
    machine.status.version = execFileSync('git', ['-C', clone, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const firstAppRequest = await api({ server }, '/threads', {
      method: 'POST', body: { project: clone, cli: 'codex' },
    });
    assert.equal(firstAppRequest.status, 409);
    assert.match(firstAppRequest.body.detail, /out of date/);
  } finally {
    await server.stop();
    await machine.stop();
  }
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

async function openNeed(context, made, extra = {}) {
  const posted = await card(context, made.id, made.sessions[0].name, {
    kind: 'needs', title: 'Runaway loop', body: 'The loop kept failing.', ...extra,
  });
  assert.equal(posted.status, 202);
  return posted.body.id;
}

const needsStrip = async (context) => (await api(context, '/features')).body.needs;

test('validates a resolve card and the targets it may close', () => {
  assert.equal(validate('resolve', { card: 'c1', note: 'Fixed itself.' }, 'lead').ok, true);
  assert.equal(validate('resolve', { card: 'c1' }, 'lead').ok, false);
  assert.equal(validate('resolve', { note: 'x' }, 'lead').ok, false);
  assert.equal(validate('resolve', { card: 'c1', note: 'x' }, 'worker').ok, false);
  const { resolvable } = require('../app/card.js');
  const thread = {
    cards: [
      { id: 'open', kind: 'needs', answered: false, system: false },
      { id: 'sys', kind: 'needs', answered: false, system: true },
      { id: 'q', kind: 'question', answered: false, system: false },
      { id: 'done', kind: 'needs', answered: true, system: false },
    ],
  };
  assert.equal(resolvable(thread, 'open').ok, true);
  assert.match(resolvable(thread, 'sys').reason, /system/);
  assert.match(resolvable(thread, 'q').reason, /needs card/);
  assert.match(resolvable(thread, 'missing').reason, /no such card/);
  assert.match(resolvable(thread, 'done').reason, /already answered/);
});

test('a lead resolve closes its needs card and removes it from the Needs strip', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0].name;
    const id = await openNeed(context, made);
    assert.ok((await needsStrip(context)).some((item) => item.card_id === id));
    const resolved = await card(context, made.id, lead, { kind: 'resolve', card: id, note: 'It fixed itself.' });
    assert.equal(resolved.status, 202);
    assert.equal((await needsStrip(context)).some((item) => item.card_id === id), false);
    const chat = await api(context, `/threads/${made.id}/chat`);
    const closed = chat.body.cards.find((item) => item.id === id);
    assert.equal(closed.answered, true);
    assert.equal(closed.resolved_by, lead);
    assert.equal(closed.resolved_note, 'It fixed itself.');
    assert.ok(closed.resolved_at);
    assert.equal(chat.body.cards.some((item) => item.kind === 'resolve'), false);
    const again = await card(context, made.id, lead, { kind: 'resolve', card: id, note: 'Twice.' });
    assert.equal(again.status, 422);
  });
});

test('a resolve is refused for a system card, another kind, another thread and a missing card', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const other = await thread(context);
    const lead = made.sessions[0].name;
    const otherNeed = await openNeed(context, other);
    const idea = await card(context, made.id, lead, { kind: 'idea', bullets: [{ id: 'one', text: 'A choice.' }] });
    // A hub-posted needs card: a permission prompt.
    await event(context, made.id, lead, 'turn-ended');
    await event(context, made.id, lead, 'prompt', { notification_type: 'permission_prompt' });
    const chat = await api(context, `/threads/${made.id}/chat`);
    const system = chat.body.cards.find((item) => item.system && item.kind === 'needs');
    assert.ok(system);
    for (const target of [system.id, idea.body.id, otherNeed, 'no-such-card']) {
      const refused = await card(context, made.id, lead, { kind: 'resolve', card: target, note: 'no' });
      assert.equal(refused.status, 422, target);
      assert.ok(refused.body.error);
    }
    const after = await api(context, `/threads/${made.id}/chat`);
    assert.equal(after.body.cards.find((item) => item.id === system.id).answered, false);
    assert.equal((await api(context, `/threads/${other.id}/chat`)).body.cards.find((item) => item.id === otherNeed).answered, false);
  });
});

test('a resolve retried with the same delivery id is a duplicate', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0].name;
    const id = await openNeed(context, made);
    const body = { thread_id: made.id, session: lead, kind: 'resolve', card: id, note: 'Done.', delivery_id: 'r-1' };
    assert.equal((await machinePost(context, '/machine/cards', body)).status, 202);
    const retry = await machinePost(context, '/machine/cards', body);
    assert.equal(retry.status, 200);
    assert.equal(retry.body.duplicate, true);
  });
});

test('dismiss closes a lead needs card as collin and refuses a system one', async () => {
  await withContext(async (context) => {
    const made = await thread(context);
    const lead = made.sessions[0].name;
    const id = await openNeed(context, made);
    await event(context, made.id, lead, 'turn-ended');
    await event(context, made.id, lead, 'prompt', { notification_type: 'permission_prompt' });
    const system = (await api(context, `/threads/${made.id}/chat`)).body.cards.find((item) => item.system);
    const refused = await api(context, `/threads/${made.id}/cards/${system.id}/dismiss`, { method: 'POST', body: {} });
    assert.equal(refused.status, 422);
    const missing = await api(context, `/threads/${made.id}/cards/nope/dismiss`, { method: 'POST', body: {} });
    assert.equal(missing.status, 404);
    const ok = await api(context, `/threads/${made.id}/cards/${id}/dismiss`, { method: 'POST', body: {} });
    assert.equal(ok.status, 200);
    const closed = (await api(context, `/threads/${made.id}/chat`)).body.cards.find((item) => item.id === id);
    assert.equal(closed.answered, true);
    assert.equal(closed.resolved_by, 'collin');
    assert.equal((await needsStrip(context)).some((item) => item.card_id === id), false);
    // The live lead hears the dismissal (held here behind the open permission prompt).
    const stored = JSON.parse(await fs.readFile(path.join(context.state, 'threads', `${made.id}.json`), 'utf8'));
    assert.ok(stored.queues[lead].some((message) => message.text === `[card ${id}] dismissed`));
    const twice = await api(context, `/threads/${made.id}/cards/${id}/dismiss`, { method: 'POST', body: {} });
    assert.equal(twice.status, 422);
  });
});
