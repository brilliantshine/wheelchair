'use strict';

// Spec "How the app reads and drives a session" and protocol/app/cards.md.
const crypto = require('node:crypto');
const path = require('node:path');
const { appError } = require('./state.js');
const { resolvable, retractable, truncateTitle, validate } = require('./card.js');

const REPLAY = Symbol('replay');
const SINGLETONS = new Set(['offer', 'idea', 'deferred', 'progress']);

function addCard(thread, card, meta = {}) {
  const at = new Date().toISOString();
  const record = {
    ...card,
    id: meta.deliveryId || crypto.randomUUID(),
    session: meta.session || null,
    at,
    created_at: at,
    answered: false,
    system: Boolean(meta.system),
  };
  if (SINGLETONS.has(card.kind)) {
    const old = [...thread.cards].reverse().find((item) => item.kind === card.kind && !item.replaced && !item.retracted_at);
    // An answered offer is history: a second offer leaves it in the conversation.
    if (old && !(card.kind === 'offer' && old.answered)) old.replaced = true;
    thread.pinned[card.kind] = record;
  }
  if (card.kind === 'approval') {
    const old = [...thread.cards].reverse().find((item) => item.kind === 'approval' && !item.replaced && !item.answered && !item.retracted_at);
    if (old) old.replaced = true;
    thread.pinned.approval = record;
  }
  thread.cards.push(record);
  return record;
}

function resolveCard(card, by, note) {
  card.answered = true;
  card.resolved_by = by;
  card.resolved_note = note || null;
  card.resolved_at = new Date().toISOString();
}

function retractCard(card, by, note) {
  card.answered = true;
  card.retracted_by = by;
  card.retracted_note = note;
  card.retracted_at = new Date().toISOString();
}

function currentDone(thread) {
  return [...(thread.cards || [])].reverse().find((card) => card.kind === 'done' && !card.retracted_at
    && (!thread.imported?.at || Date.parse(card.created_at || card.at) > Date.parse(thread.imported.at)));
}

async function acceptCard(hub, payload) {
  const result = await hub.updateThread(payload.thread_id, async (thread) => {
    const session = hub.session(thread, payload.session);
    require('./handoff.js').refuseFrozen(hub, thread);
    if (thread.archived) throw appError(409, 'thread is archived');
    thread.delivered_ids ||= [];
    if (payload.delivery_id && (thread.delivered_ids.includes(payload.delivery_id) || thread.cards.some((card) => card.id === payload.delivery_id))) {
      return { replay: { ok: true, duplicate: true, id: payload.delivery_id } };
    }
    const { session: ignoredSession, thread_id: ignoredThread, delivery_id: ignoredDelivery, ...input } = payload;
    if (payload.kind === 'lesson' && typeof input.for === 'string' && !['lead', 'sub-lead', 'worker', 'mapper'].includes(session.role)) {
      throw appError(422, `a ${session.role} may not save lessons for ${input.for}s`);
    }
    const checked = validate(payload.kind, input, session.role, { machine: true });
    if (!checked.ok) throw appError(payload.kind === 'lesson' ? 400 : 422, checked.reason);

    if (checked.card.kind === 'lesson') {
      const lesson = await require('./settings.js').applyLesson(hub, checked.card, session.role, thread.project, thread.id);
      if (!lesson.changed) return { card: { ok: true, lesson: lesson.id }, targetName: null };
      checked.card.lesson = lesson.id;
      checked.card.snapshot = lesson.snapshot;
    }

    if (checked.card.passes_on !== undefined && !thread.cards.some((item) => item.id === checked.card.passes_on && item.kind === 'message' && item.asks === true)) {
      throw appError(422, 'passes_on names no question in this thread');
    }

    // A diagram iframe must never observe its card before its plan is registered.
    if (checked.card.kind === 'diagram' && hub.registerPlan) {
      const plan = path.join(thread.worktree || thread.project, 'docs', 'plans', checked.card.plan);
      await hub.registerPlan(plan);
      if ((!checked.card.format || checked.card.format === 'graph') && hub.registerGraph) await hub.registerGraph(path.join(plan, 'graphs', `${checked.card.graph}.json`));
    }

    if (checked.card.kind === 'resolve') {
      // A resolve is an instruction, never a card: it marks its target and is not stored.
      const found = resolvable(thread, checked.card.card, 'lead');
      if (!found.ok) throw appError(422, found.reason);
      resolveCard(found.card, session.name, checked.card.note);
      if (payload.delivery_id) thread.delivered_ids = [...thread.delivered_ids, payload.delivery_id].slice(-500);
      return { card: { ok: true, resolved: found.card.id }, targetName: null };
    }

    if (checked.card.kind === 'retract') {
      const found = retractable(thread, checked.card.card);
      if (!found.ok) throw appError(422, found.reason);
      const target = found.card;
      if (target.kind === 'sudo') {
        if (target.state !== 'waiting') throw appError(422, `the sudo request is already ${target.state}`);
        let status;
        try { status = await hub.client.sudoCancel(thread.machine, target.request_id); } catch {}
        if (!validSudoStatus(status)) throw appError(422, `couldn't reach ${thread.machine} to cancel the sudo request; try again`);
        if (status.state !== 'declined') throw appError(422, `the sudo request is already ${status.state}`);
        target.state = 'declined';
      }
      retractCard(target, session.name, checked.card.note);
      if (thread.pinned[target.kind]?.id === target.id) delete thread.pinned[target.kind];
      if (payload.delivery_id) thread.delivered_ids = [...thread.delivered_ids, payload.delivery_id].slice(-500);
      return { card: { ok: true, retracted: target.id }, targetName: null };
    }

    if (checked.card.kind === 'title') {
      thread.title = truncateTitle(checked.card.title, 80);
      if (payload.delivery_id) thread.delivered_ids = [...thread.delivered_ids, payload.delivery_id].slice(-500);
      return { card: { ok: true, title: thread.title }, targetName: null };
    }

    if (checked.card.kind === 'offer') {
      const offers = thread.cards.filter((item) => item.kind === 'offer');
      if (offers.length > 1 || (offers.length === 1 && offers[0].answered_value !== 'keep talking first' && !offers[0].retracted_at)) {
        throw appError(422, 'the offer was already asked');
      }
    }

    if (checked.card.kind === 'check') {
      const done = currentDone(thread);
      if (!done) throw appError(422, 'post the done card first');
      if (done.head !== checked.card.head) throw appError(422, 'check head must match the latest done card');
      if (thread.cards.some((item) => item.kind === 'check' && !item.retracted_at && item.head === checked.card.head)) throw appError(422, 'this done card already has a check card');
    }

    if (checked.card.kind === 'sudo') {
      // The request_id → card id index is written in the same save as the card itself.
      thread.sudo_index ||= {};
      if (Object.hasOwn(thread.sudo_index, checked.card.request_id)) throw appError(422, 'that sudo request already has a card');
    }

    if (checked.card.kind === 'reach') {
      if (thread.cards.some(item => item.kind === 'reach' && !item.answered && !item.retracted_at)) throw appError(422, 'a reach request is already open');
      const peers = require('./peers.js');
      const { target, reason } = await peers.reachTarget(hub, thread, checked.card.thread);
      if (reason) throw appError(422, reason);
      if (target.project === thread.project) throw appError(422, 'already in your project; no OK needed');
      if (peers.linked(thread, target)) throw appError(422, 'already allowed');
      const targetName = peers.threadName(target);
      Object.assign(checked.card, { target_title: targetName, target_project: target.project, title: `Let this lead talk to ${targetName}?` });
    }

    let crossThread = null;
    if (checked.card.kind === 'message' && !thread.sessions.some((item) => item.name === checked.card.to) && session.role === 'lead') {
      const peers = require('./peers.js');
      const match = (await hub.state.allThreads()).find((item) => item.sessions?.some((s) => s.name === checked.card.to));
      if (!match || !match.sessions.some((s) => s.name === checked.card.to && s.role === 'lead')) throw appError(422, 'no lead by that name');
      const target = await hub.state.thread(match.id);
      if (!(await peers.sameMachine(hub, await hub.machines(), thread.machine, target.machine))) throw appError(422, 'that lead is on another machine');
      if (target.archived) throw appError(422, 'that thread is archived');
      if (require('./handoff.js').frozen(hub, target)) throw appError(422, 'that thread was handed off');
      if (target.project !== thread.project && !peers.linked(thread, target)) throw appError(422, 'that lead is in another project; ask the user with a reach card first');
      const { PAIR_LIMIT, PAIR_WINDOW_MS, append } = require('./peer-log.js');
      const now = new Date().toISOString(), since = Date.parse(thread.user_at) || 0;
      const paused = Date.parse(thread.peer_pauses?.[target.id]) > since;
      const count = (thread.peer_log || []).filter(item => item.direction === 'sent' && item.thread === target.id && Date.parse(item.at) > since && Date.parse(item.at) > Date.now() - PAIR_WINDOW_MS).length;
      if (paused || count >= PAIR_LIMIT) {
        const title = peers.threadName(target);
        if (!paused) {
          thread.peer_pauses ||= {}; thread.peer_pauses[target.id] = now;
          append(thread, { at: now, thread: target.id, title, session: checked.card.to, direction: 'limit', text: '' });
        }
        return { refusal: `message limit reached with ${title}: 20 messages within an hour; messaging that thread is paused until the user writes in this thread` };
      }
      crossThread = target.id;
      checked.peerTitle = peers.threadName(target);
    }

    if (checked.card.kind === 'stub' && checked.card.adds_to !== undefined) {
      const peers = require('./peers.js');
      await hub.withThread(checked.card.adds_to, async () => {
        let target;
        try { target = await hub.thread(checked.card.adds_to); }
        catch (error) { if (error.status === 404) throw appError(422, 'no such stub'); throw error; }
        if (!target.stub || target.project !== thread.project || !(await peers.sameMachine(hub, await hub.machines(), thread.machine, target.machine))) throw appError(422, 'no such stub');
        if (!peers.candidateStub(hub, target)) throw appError(422, 'that stub is archived, handed off or finished');
        if ((target.sessions || []).length) throw appError(422, 'that stub has started; post your own stub');
        const label = checked.card.duplicate ? 'Also came up in' : 'Added from';
        target.context += `\n\n${label} "${peers.threadName(thread)}" (${new Date().toISOString().slice(0, 10)}): ${checked.card.summary}`;
        await hub.save(target);
        Object.assign(checked.card, { thread_id: target.id, target_title: peers.threadName(target) });
      });
    }

    const stored = ['image', 'file'].includes(checked.card.kind) ? { ...checked.card, file: path.basename(checked.card.path) } : checked.card;
    const card = addCard(thread, checked.card.kind === 'sudo' ? { ...stored, state: 'waiting' } : stored, { session: session.name, deliveryId: payload.delivery_id });
    if (crossThread) require('./peer-log.js').append(thread, { at: card.at, thread: crossThread, title: checked.peerTitle, session: card.to, direction: 'sent', text: card.text, ...(card.asks === true ? { question: card.id } : {}) });
    if (card.kind === 'done') {
      for (const needs of thread.cards) if (needs.kind === 'needs' && needs.auto_merge === true && !needs.answered && needs.auto_merge_head !== card.head) resolveCard(needs, 'app', 'Replaced by a newer version');
    }
    if (card.kind === 'sudo') thread.sudo_index[card.request_id] = card.id;
    // A plain status message mid-task is not a reply the starter can act on: only a question or a result
    // clears the debt. A finished agent answering a follow-up has nothing left to do, so any message does.
    if ((card.kind === 'message' && (card.asks === true || session.finished === true)) || card.kind === 'result') { session.owes_reply = false; require('./quiet.js').reset(thread, session); }
    // A live agent waiting on someone other than its starter (a worker's question to the lead) still
    // counts as work its starter is waiting on; the next message delivered to it clears this.
    if (card.kind === 'message' && card.asks === true && card.to !== session.started_by && session.finished !== true) session.awaiting_answer = true;
    if (card.kind === 'result') delete session.awaiting_answer;
    if (card.kind === 'message' && !crossThread) {
      const target = hub.session(thread, card.to);
      target.queue ||= [];
      const message = { text: `[wc:from ${session.name}] ${card.asks === true ? `[question ${card.id}] ` : ''}${card.text}`, source: 'session', at: new Date().toISOString() };
      target.queue.push(message);
      if (target.started_by === session.name && target.quiet_card) require('./quiet.js').reset(thread, target);
      thread.queues[target.name] = target.queue;
    }
    if (card.kind === 'result') {
      session.finished = true;
      if (session.started_by) {
        const target = hub.session(thread, session.started_by);
        target.queue ||= [];
        target.queue.push({ text: `[wc:from ${session.name}] result${card.commit ? ` (commit ${card.commit})` : ''}: ${card.summary}`, source: 'result', at: new Date().toISOString() });
        thread.queues[target.name] = target.queue;
      }
    }
    if (card.kind === 'stub' && !card.adds_to) {
      const child = await hub.createStub(thread, card);
      card.thread_id = child.id;
    }
    const targetName = card.kind === 'message'
      ? (crossThread ? null : card.to)
      : card.kind === 'result'
        ? thread.sessions.find((item) => item.name === payload.session)?.started_by
        : null;
    if (payload.delivery_id) thread.delivered_ids = [...thread.delivered_ids, payload.delivery_id].slice(-500);
    // The card, queue and durable delivery id commit together. Delivery happens afterwards:
    // a dead target must not turn a valid card into a rejected one.
    return { card, targetName, ...(crossThread ? { targetThread: crossThread, senderTitle: require('./peers.js').threadName(thread) } : {}) };
  });
  if (result.refusal) throw appError(422, result.refusal);
  if (result.replay) return Object.defineProperty(result.replay, REPLAY, { value: true });
  if (result.card?.kind === 'check') require('./auto-merge.js').afterCheck(hub, payload.thread_id, result.card.id);
  if (result.targetName) {
    const thread = await hub.thread(payload.thread_id);
    await hub.deliver(thread, result.targetName);
  }
  if (result.targetThread) return { card: result.card, targetThread: result.targetThread, senderTitle: result.senderTitle };
  return result.card;
}

const SUDO_STATES = ['running', 'ran', 'declined', 'expired', 'failed'];
const SUDO_RANK = { waiting: 0, running: 1, ran: 2, declined: 2, expired: 2, failed: 2 };

// Spec "One state handler in the hub": every sudo card state change goes through here. It
// ignores `waiting` and any state not newer than the card's, sets the state and result, and on
// the card's first terminal state queues exactly one message to the lead, in the same save.
// The caller holds the thread's lock. Returns true when the card changed.
async function applySudoState(hub, thread, requestId, status) {
  const cardId = thread.sudo_index?.[requestId];
  const card = cardId && thread.cards.find((item) => item.id === cardId && item.kind === 'sudo');
  if (!card) throw appError(409, 'unknown sudo request');
  const next = status && SUDO_RANK[status.state];
  if (!next || next <= (SUDO_RANK[card.state] ?? 0)) return false;
  card.state = status.state;
  if (next === 1) {
    await hub.save(thread);
    return true;
  }
  for (const key of ['exit_code', 'output', 'truncated', 'reason']) {
    if (status[key] !== undefined && status[key] !== null) card[key] = status[key];
  }
  const leads = thread.sessions.filter((item) => item.role === 'lead');
  const lead = [...leads].reverse().find((item) => item.live) || leads.find((item) => item.name === card.session) || leads[leads.length - 1];
  if (!lead) {
    await hub.save(thread);
    return true;
  }
  const line = {
    ran: `sudo ran: exit ${card.exit_code}\n${card.output || ''}`,
    declined: 'declined',
    expired: 'sudo expired',
    failed: `sudo failed: ${card.reason || 'no reason given'}`,
  }[status.state];
  await hub.enqueue(thread, lead.name, `[card ${card.id}] ${line}`, 'card');
  return true;
}

function validSudoStatus(body) {
  const optional = (value, check) => value === undefined || value === null || check(value);
  return Boolean(body && typeof body === 'object' && !Array.isArray(body)
    && SUDO_STATES.includes(body.state)
    && optional(body.exit_code, Number.isInteger)
    && optional(body.output, (value) => typeof value === 'string')
    && optional(body.truncated, (value) => typeof value === 'boolean')
    && optional(body.reason, (value) => typeof value === 'string')
    && (body.state !== 'ran' || Number.isInteger(body.exit_code)));
}

// POST /api/machine/sudo-outcome: find the thread by request_id and apply the state.
async function sudoOutcome(hub, body) {
  if (!body || typeof body.request_id !== 'string' || !/^[0-9a-f]{32}$/.test(body.request_id)
    || typeof body.delivery_id !== 'string' || !body.delivery_id || !validSudoStatus(body)) {
    throw appError(400, 'invalid sudo outcome');
  }
  const owner = (await hub.allThreads()).find((item) => item.sudo_index && Object.hasOwn(item.sudo_index, body.request_id));
  if (!owner) throw appError(409, 'unknown sudo request');
  return hub.withThread(owner.id, async () => {
    const thread = await hub.thread(owner.id);
    return { ok: true, changed: await applySudoState(hub, thread, body.request_id, body) };
  });
}

module.exports = { REPLAY, currentDone, SINGLETONS, addCard, acceptCard, applySudoState, resolveCard, retractCard, sudoOutcome, validSudoStatus };
