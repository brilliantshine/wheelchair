'use strict';

// Spec "Branches and checkouts", "Stub threads", and worktree archiving.
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const crypto = require('node:crypto');
const path = require('node:path');
const { appError } = require('./state.js');
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
    project: path.resolve(input.project),
    cli: input.cli,
    machine: input.machine || 'hub',
    stub: false,
    context: '',
    depends_on_parent: false,
    waiting_on_parent: false,
    sessions: [],
    cards: [],
    pinned: {},
    queues: {},
    archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function createThread(hub, input) {
  if (!input || typeof input.project !== 'string' || !input.project) {
    throw appError(400, 'project and cli are required');
  }
  if (!['claude', 'codex'].includes(input.cli)) {
    throw appError(400, 'project and cli are required');
  }
  const thread = emptyThread(input);
  await hub.save(thread);
  const lead = await startSession(hub, thread, { role: 'lead', cli: thread.cli, brief: '' });
  if (input.message) await hub.enqueue(thread, lead.name, input.message, 'collin');
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
    ...emptyThread({ project: parent.project, cli: parent.cli, machine: parent.machine }),
    stub: true,
    title: card.title,
    context: card.summary,
    parent: parent.id,
    parent_title: parent.title || parent.id,
    depends_on_parent: card.depends_on_parent,
  };
  card.thread_id = child.id;
  await hub.save(child);
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
  const lead = await startSession(hub, thread, { role: 'lead', cli: thread.cli, brief: '' });
  const context = `[wc:context stub] ${thread.context}`;
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
  };
  const context = `[wc:context restart] Thread state:\n${JSON.stringify(state)}`;
  // The thread keeps its worktree across leads; asking for a new one would fail on the
  // existing wc/<thread-id> branch.
  const lead = await startSession(hub, thread, {
    role: 'lead', cli: thread.cli, brief: '', worktree: thread.worktree, branch: thread.branch,
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
    if (card.kind === 'needs' && card.title === 'Sessions ended' && !card.answered) card.answered = true;
  }
  lead.queue.push(...queued);
  thread.queues[lead.name] = lead.queue;
  await hub.enqueue(thread, lead.name, context, 'context', true);
  return lead;
}

async function archive(hub, id) {
  const thread = await hub.thread(id);
  const result = await hub.call(thread.machine, '/v1/archive', 'POST', { thread_id: thread.id });
  thread.archive = result;
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
  const lead = [...thread.sessions].reverse().find((item) => item.role === 'lead' && item.live);
  if (!lead) throw appError(409, 'no live lead');
  const suffixes = {
    picked: `picked: ${input.value}`,
    removed: `removed: ${input.value}`,
    talk: `talk about: ${input.value}`,
    'start-building': 'start building',
    'start-thread': `start thread about: ${input.value}`,
  };
  if (!(input.action in suffixes)) throw appError(400, 'unknown card press');
  card.answered = true;
  await hub.enqueue(thread, lead.name, `[card ${card.id}] ${suffixes[input.action]}`, 'card');
  return { queued: true, text: suffixes[input.action] };
}

async function pollWaiting(hub) {
  for (const thread of await hub.allThreads()) {
    // Every stub that builds on an unmerged parent is watched, opened or not: leaving it alone
    // is waiting, and it shows "ready" once the parent's pull request merges.
    if (!thread.depends_on_parent || thread.ready || thread.archived || thread.sessions.length || !thread.parent) continue;
    const parent = await hub.thread(thread.parent).catch(() => null);
    if (!parent?.branch) continue;
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
  }
}

module.exports = {
  archive,
  archivedDocument,
  createStub,
  createThread,
  openStub,
  pollWaiting,
  press,
  publicSession,
  restartLead,
  threadBySession,
};
