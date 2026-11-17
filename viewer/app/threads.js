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
  // `title` names a thread whose first message comes later (the New thread screen sends it
  // after uploading attachments, which need the thread's id first).
  const named = typeof input.message === 'string' ? input.message : input.title;
  if (typeof named === 'string') {
    const title = truncateTitle(named.split(/\r?\n/, 1)[0], 60);
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
      const pending = thread.pending_cancels ||= [];
      if (!pending.includes(aside.turn.id)) pending.push(aside.turn.id);
    }
    aside.turn = null;
  }
  await hub.save(thread);
  for (const turnId of [...(thread.pending_cancels || [])]) {
    try { await hub.call(thread.machine, `/v1/aside-turns/${encodeURIComponent(turnId)}`, 'DELETE'); }
    catch (error) { if (error.status !== 404) continue; }
    thread.pending_cancels = thread.pending_cancels.filter((id) => id !== turnId);
  }
  await hub.save(thread);
  const result = await hub.call(thread.machine, '/v1/archive', 'POST', { thread_id: thread.id });
  thread.archive = result;
  const rebases = (result.kept || []).filter((item) => item.reason === 'rebase in progress');
  if (rebases.length || result.uploads_removed === false) {
    for (const kept of rebases) {
      const worktree = kept.worktree || kept.path || String(kept);
      const { addCard } = require('./cards.js');
      addCard(thread, { kind: 'needs', title: 'Rebase needs attention', body: `finish or abort the rebase in ${worktree}, then archive again` }, { system: true });
    }
    if (result.uploads_removed === false) {
      const { addCard } = require('./cards.js');
      addCard(thread, { kind: 'needs', title: 'Uploads could not be removed', body: `Could not remove ~/.local/state/wheelchair/uploads/${thread.id}/ on ${thread.machine}: ${result.uploads_error || 'unknown error'}. Archive again to retry.` }, { system: true });
      for (const session of thread.sessions) { session.live = false; session.ended_at ||= new Date().toISOString(); }
    }
    thread.archived = false;
    await hub.save(thread);
    return result;
  }
  thread.archived = true;
  for (const card of thread.cards) {
    if (card.kind === 'merged' && !card.answered) require('./cards.js').resolveCard(card, 'collin', 'Archived');
  }
  for (const session of thread.sessions) { session.live = false; session.ended_at ||= new Date().toISOString(); }
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

async function archivedHtml(hub, id, file) {
  const thread = await hub.thread(id);
  if (!thread.archived || !thread.branch || !thread.slug || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.html$/.test(String(file)) || String(file).includes('..')) throw appError(404, 'archived diagram not found');
  try {
    return (await execFileAsync('git', ['-C', thread.project, 'show', `${thread.branch}:docs/plans/${thread.slug}/graphs/${file}`], { maxBuffer: 2 * 1024 * 1024 })).stdout;
  } catch { throw appError(404, 'archived diagram not found'); }
}

// Spec "Decline" and "What reaches the lead": a sudo card has two presses. Talk about it tells
// the lead and leaves the card waiting and open (nothing runs). Decline is one synchronous call
// to the lead's machine; nothing is saved on the card until the machine answers, and the card's
// state then moves only through applySudoState, which tells the lead.
async function pressSudo(hub, thread, card, input) {
  if (!['talk', 'decline'].includes(input.action)) throw appError(400, 'unknown card press');
  if (card.state !== 'waiting') throw appError(409, 'this sudo request is no longer waiting');
  if (input.action === 'talk') {
    const lead = [...thread.sessions].reverse().find((item) => item.role === 'lead' && item.live);
    if (!lead) throw appError(409, 'no live lead');
    await hub.enqueue(thread, lead.name, `[card ${card.id}] talk about: sudo request`, 'card');
    return { queued: true, text: 'talk about: sudo request' };
  }
  const failure = () => appError(502, `Couldn't reach ${thread.machine} to decline. Try again.`);
  let status;
  try {
    status = await hub.client.sudoCancel(thread.machine, card.request_id);
  } catch {
    throw failure();
  }
  if (!require('./cards.js').validSudoStatus(status)) throw failure();
  await require('./cards.js').applySudoState(hub, thread, card.request_id, status);
  return { queued: false, state: card.state };
}

async function press(hub, id, cardId, input) {
  const thread = await hub.thread(id);
  const card = thread.cards.find((item) => item.id === cardId && !item.replaced);
  if (!card) throw appError(404, 'card not found');
  if (card.retracted_at) throw appError(422, 'this card was withdrawn');
  if (card.kind === 'merged') {
    if (input.action !== 'keep') throw appError(400, 'a merged card takes keep');
    if (card.answered) throw appError(422, 'card is already answered');
    require('./cards.js').resolveCard(card, 'collin', 'Kept');
    await hub.save(thread);
    return { queued: false };
  }
  if (card.kind === 'sudo') return pressSudo(hub, thread, card, input);
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
  // A question or offer takes one answer: a second press (a double tap, a stale tab) is not news for the lead.
  if (card.kind === 'question' || card.kind === 'offer') {
    if (input.action === 'answered' && card.kind !== 'question') throw appError(400, 'a typed answer requires a question card');
    if (card.answered) throw appError(422, 'card is already answered');
  }
  if (input.action === 'answered') {
    if (card.kind !== 'question') throw appError(400, 'a typed answer requires a question card');
    input = { ...input, value: typeof input.value === 'string' ? input.value.trim() : '' };
    if (!input.value) throw appError(400, 'a typed answer needs text');
  }
  const lead = [...thread.sessions].reverse().find((item) => item.role === 'lead' && item.live);
  if (!lead) throw appError(409, 'no live lead');
  const suffixes = {
    'keep-going': 'keep going',
    picked: `picked: ${input.value}`,
    answered: `answered: ${input.value}`,
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
  if (card.kind === 'approval' && input.action === 'start-building' && thread.pinned.approval?.id === card.id) delete thread.pinned.approval;
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

function mergedPr(thread) {
  return [...(thread.cards || [])].reverse().find((card) =>
    card.kind === 'done' && !card.replaced && typeof card.pr_url === 'string' && card.pr_url.trim())?.pr_url || null;
}

async function pollMerged(hub) {
  const eligible = (await hub.allThreads()).map((thread) => ({ thread, url: mergedPr(thread) }))
    .filter(({ thread, url }) => !thread.archived && url && /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+$/.test(url) && thread.merge_noticed_url !== url);
  let next = 0;
  async function worker() {
    while (next < eligible.length) {
      const { thread, url } = eligible[next++];
      try {
        const result = await execFileAsync('gh', ['pr', 'view', url, '--json', 'state'], { timeout: 15000 });
        if (JSON.parse(result.stdout).state !== 'MERGED') continue;
        await hub.withThread(thread.id, async () => {
          const current = await hub.thread(thread.id);
          if (current.archived || mergedPr(current) !== url || current.merge_noticed_url === url) return;
          current.merge_noticed_url = url;
          current.merge_noticed_at = new Date().toISOString();
          require('./cards.js').addCard(current, { kind: 'merged', title: 'Pull request merged', pr_url: url }, { system: true });
          await hub.save(current);
        });
      } catch {
        // An unavailable GitHub or a changed thread can be retried on the next sweep.
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, eligible.length) }, worker));
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
  archivedHtml,
  checkProject,
  createStub,
  createThread,
  dismiss,
  openStub,
  pollWaiting,
  pollMerged,
  press,
  publicSession,
  restartLead,
  threadBySession,
};
