'use strict';

// Spec "Branches and checkouts", "Stub threads", and worktree archiving.
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const crypto = require('node:crypto');
const { appError } = require('./state.js');
const { truncateTitle } = require('./card.js');
const { publicSession, startSession } = require('./sessions.js');
const { check: readyCheck, same: sameReady } = require('./ready.js');

const ARCHIVED_DOCUMENTS = new Set(['MAP.md', 'IDEA.md', 'PLAN.md']);

const execFileAsync = promisify(execFile);

function newId() {
  return crypto.randomBytes(6).toString('hex');
}

function emptyThread(input) {
  return {
    id: newId(),
    project: input.project,
    machine: input.machine || 'hub',
    stub: false,
    context: '',
    depends_on_parent: false,
    waiting_on_parent: false,
    sessions: [],
    cards: [],
    asides: [],
    pinned: {},
    queues: {},
    sent: [],
    archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// Spec "Hub", Starting a thread: ask the machine itself whether `project` is a git repository
// there. The machine expands `~`; a missing answer is a 502, an older service a 502 too.
async function checkProject(hub, machine, project) {
  await hub.state.machine(machine);
  let result;
  try {
    result = await hub.call(machine, `/v1/projects?check=${encodeURIComponent(project)}`, 'GET');
  } catch (error) {
    if (error.status === 404) throw appError(502, `${machine} needs updating`);
    throw appError(502, `${machine} is not reachable`);
  }
  const checked = result && result.checked;
  if (!checked || typeof checked.ok !== 'boolean') throw appError(502, `${machine} needs updating`);
  return checked;
}

async function createThread(hub, input) {
  if (!input || typeof input.project !== 'string' || !input.project) {
    throw appError(400, 'project is required');
  }
  const machine = input.machine || 'hub';
  const checked = await checkProject(hub, machine, input.project);
  if (!checked.ok) throw appError(400, `${checked.path || input.project} ${checked.reason || 'is not usable'} on ${machine}`);
  const thread = emptyThread({ ...input, project: checked.path });
  if (typeof input.message === 'string') {
    const title = truncateTitle(input.message.split(/\r?\n/, 1)[0], 60);
    if (title) thread.title = title;
  }
  await hub.save(thread);
  await hub.state.addProject(thread.project);
  const lead = await hub.withThread(thread.id, async () => {
    const current = await hub.thread(thread.id);
    const started = await startSession(hub, current, { role: 'lead', cli: current.cli, brief: '', tier: 'top' });
    if (input.message) await hub.enqueue(current, started.name, input.message, 'collin');
    return started;
  });
  Object.assign(thread, await hub.thread(thread.id));
  return thread;
}

async function threadBySession(hub, name) {
  for (const thread of await hub.allThreads()) {
    if (thread.sessions.some((session) => session.name === name)) return thread;
  }
  throw appError(404, 'calling session is unknown');
}

async function createStub(hub, parent, card) {
  const child = {
    ...emptyThread({ project: parent.project, machine: parent.machine }),
    stub: true,
    title: card.title,
    context: card.summary,
    parent: parent.id,
    parent_title: parent.title || parent.id,
    depends_on_parent: card.depends_on_parent,
    commits: card.commits || [],
  };
  card.thread_id = child.id;
  await hub.withThread(child.id, () => hub.save(child));
  return child;
}

async function openStub(hub, id, input = {}) {
  const thread = await hub.thread(id);
  if (!thread.stub || thread.sessions.length) return thread;
  if (thread.depends_on_parent && !thread.ready && !input.start_now) {
    thread.waiting_on_parent = true;
    await hub.save(thread);
    return { waiting: true, thread };
  }
  const lead = await startSession(hub, thread, { role: 'lead', cli: thread.cli, brief: '', tier: 'top' });
  const commits = thread.commits?.length ? `\ncommits to cherry-pick: ${thread.commits.join(', ')}` : '';
  const context = `[wc:context stub] ${thread.context}${commits}`;
  await hub.enqueue(thread, lead.name, context, 'context', true);
  return thread;
}

async function restartLead(hub, id) {
  const thread = await hub.thread(id);
  const liveLead = thread.sessions.some((session) => session.role === 'lead' && session.live);
  if (liveLead) {
    throw appError(409, 'lead is still live');
  }
  const state = {
    slug: thread.slug,
    cards: thread.cards.filter((card) => !card.replaced),
    pinned: thread.pinned,
    recent_messages: (thread.sent || [])
      .filter((message) => message.source === 'collin' || message.source === 'card')
      .slice(-20),
  };
  const context = `[wc:context restart] Thread state:\n${JSON.stringify(state)}`;
  // The thread keeps its worktree across leads; asking for a new one would fail on the
  // existing wc/<thread-id> branch.
  const lead = await startSession(hub, thread, {
    role: 'lead', cli: thread.cli, brief: '', tier: 'top', worktree: thread.worktree, branch: thread.branch,
  });
  const endedLeads = thread.sessions.filter((session) => session.role === 'lead' && !session.live);
  // Move, not copy: each ended lead's waiting messages go to the new lead once, and an older
  // restart's context note is dropped because the fresh one below replaces it.
  const queued = endedLeads.flatMap((session) => session.queue || [])
    .filter((message) => message.source !== 'context');
  for (const session of endedLeads) {
    session.queue = [];
    delete thread.queues[session.name];
  }
  // The restart is the answer to every "Sessions ended" card the dead leads left open.
  for (const card of thread.cards) {
    if (card.kind === 'needs' && ['Sessions ended', "The lead's turn failed"].includes(card.title) && !card.answered) card.answered = true;
  }
  lead.queue.push(...queued);
  thread.queues[lead.name] = lead.queue;
  await hub.enqueue(thread, lead.name, context, 'context', true);
  return lead;
}

async function archive(hub, id) {
  const thread = await hub.thread(id);
  for (const aside of thread.asides || []) {
    if (aside.status === 'open') require('./asides.js').close(aside);
    if (aside.turn) {
      try { await hub.call(thread.machine, `/v1/aside-turns/${encodeURIComponent(aside.turn.id)}`, 'DELETE'); }
      catch (error) { if (error.status !== 404) throw error; }
    }
    aside.turn = null;
  }
  await hub.save(thread);
  const result = await hub.call(thread.machine, '/v1/archive', 'POST', { thread_id: thread.id });
  thread.archive = result;
  const rebases = (result.kept || []).filter((item) => item.reason === 'rebase in progress');
  if (rebases.length) {
    for (const kept of rebases) {
      const worktree = kept.worktree || kept.path || String(kept);
      const { addCard } = require('./cards.js');
      addCard(thread, { kind: 'needs', title: 'Rebase needs attention', body: `finish or abort the rebase in ${worktree}, then archive again` }, { system: true });
    }
    thread.archived = false;
    await hub.save(thread);
    return result;
  }
  thread.archived = true;
  for (const session of thread.sessions) session.live = false;
  await hub.save(thread);
  return result;
}

async function archivedDocument(hub, id, file) {
  const thread = await hub.thread(id);
  if (!thread.archived || !thread.branch || !thread.slug || !ARCHIVED_DOCUMENTS.has(file)) {
    throw appError(404, 'archived document not found');
  }
  const object = `${thread.branch}:docs/plans/${thread.slug}/${file}`;
  try {
    return (await execFileAsync(
      'git',
      ['-C', thread.project, 'show', object],
      { maxBuffer: 2 * 1024 * 1024 },
    )).stdout;
  } catch {
    throw appError(404, 'archived document not found');
  }
}

// Spec "Branches and checkouts": an archived thread's diagrams read from its branch too. Only a
// plain `*.json` name under the plan's graphs/ is accepted: no separators, no `..`.
async function archivedGraph(hub, id, file) {
  const thread = await hub.thread(id);
  if (!thread.archived || !thread.branch || !thread.slug || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/.test(String(file))
    || String(file).includes('..')) {
    throw appError(404, 'archived graph not found');
  }
  const object = `${thread.branch}:docs/plans/${thread.slug}/graphs/${file}`;
  try {
    const out = await execFileAsync('git', ['-C', thread.project, 'show', object], { maxBuffer: 2 * 1024 * 1024 });
    return JSON.parse(out.stdout);
  } catch {
    throw appError(404, 'archived graph not found');
  }
}

async function press(hub, id, cardId, input) {
  const thread = await hub.thread(id);
  const card = thread.cards.find((item) => item.id === cardId && !item.replaced);
  if (!card) throw appError(404, 'card not found');
  if (input.action === 'recheck') {
    if (card.kind !== 'approval') throw appError(400, 're-check requires an approval card');
    card.ready = await readyCheck(hub, thread);
    await hub.save(thread);
    return { queued: false, ready: card.ready };
  }
  if (input.action === 'start-building') {
    if (card.kind !== 'approval') throw appError(400, 'start building requires an approval card');
    const ready = await readyCheck(hub, thread);
    if (!sameReady(card.ready, ready)) {
      card.ready = ready;
      await hub.save(thread);
      return { queued: false, ready };
    }
    if (!ready.ok) return { queued: false, ready };
  }
  if (card.kind === 'needs' && (card.system || card.answered)) {
    throw appError(422, card.system ? 'a system needs card closes itself' : 'card is already answered');
  }
  if (input.action === 'keep-going' && card.kind !== 'needs') throw appError(400, 'keep going requires a needs card');
  const lead = [...thread.sessions].reverse().find((item) => item.role === 'lead' && item.live);
  if (!lead) throw appError(409, 'no live lead');
  const suffixes = {
    'keep-going': 'keep going',
    picked: `picked: ${input.value}`,
    removed: `removed: ${input.value}`,
    talk: `talk about: ${input.value}`,
    'start-building': 'start building',
    'start-thread': `start thread about: ${input.value}`,
  };
  if (!(input.action in suffixes)) throw appError(400, 'unknown card press');
  if (!(card.kind === 'approval' && input.action === 'talk')) {
    card.answered = true;
    card.answered_action = input.action;
    card.answered_value = input.value ?? null;
  }
  // A needs card Collin answers is closed by him, so it dims like a resolved one.
  if (card.kind === 'needs') {
    require('./cards.js').resolveCard(card, 'collin', input.action === 'keep-going' ? 'Keep going' : 'Talking it over');
  }
  await hub.enqueue(thread, lead.name, `[card ${card.id}] ${suffixes[input.action]}`, 'card');
  return { queued: true, text: suffixes[input.action] };
}

async function dismiss(hub, id, cardId) {
  const thread = await hub.thread(id);
  const found = require('./card.js').resolvable(thread, cardId);
  if (!found.ok) throw appError(found.reason === 'no such card in this thread' ? 404 : 422, found.reason);
  require('./cards.js').resolveCard(found.card, 'collin', null);
  await hub.save(thread);
  // A dismissal is Collin's answer, like a press: the live lead hears it so it stops waiting.
  const lead = [...thread.sessions].reverse().find((item) => item.role === 'lead' && item.live);
  if (lead) await hub.enqueue(thread, lead.name, `[card ${cardId}] dismissed`, 'card');
  return { ok: true };
}

async function pollWaiting(hub) {
  for (const listedThread of await hub.allThreads()) {
    await hub.withThread(listedThread.id, async () => {
      const thread = await hub.thread(listedThread.id);
    // Every stub that builds on an unmerged parent is watched, opened or not: leaving it alone
    // is waiting, and it shows "ready" once the parent's pull request merges.
    if (!thread.depends_on_parent || thread.ready || thread.archived || thread.sessions.length || !thread.parent) return;
    const parent = await hub.thread(thread.parent).catch(() => null);
    if (!parent?.branch) return;
    try {
      const result = await execFileAsync('gh', [
        'pr', 'list', '--head', parent.branch, '--state', 'merged', '--json', 'number',
      ], { cwd: thread.project }); // gh has no -C: it runs in the project's clone
      if (JSON.parse(result.stdout).length) {
        thread.waiting_on_parent = false;
        thread.ready = true;
        await hub.save(thread);
      }
    } catch {
      // A missing gh binary or an unavailable remote leaves the stub waiting.
    }
    });
  }
}

module.exports = {
  archive,
  archivedDocument,
  archivedGraph,
  checkProject,
  createStub,
  createThread,
  dismiss,
  openStub,
  pollWaiting,
  press,
  publicSession,
  restartLead,
  threadBySession,
};
