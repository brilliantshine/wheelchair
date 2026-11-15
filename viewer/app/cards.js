'use strict';

// Spec "How the app reads and drives a session" and protocol/app/cards.md.
const crypto = require('node:crypto');
const path = require('node:path');
const { appError } = require('./state.js');
const { resolvable, truncateTitle, validate } = require('./card.js');

const SINGLETONS = new Set(['offer', 'idea', 'progress']);

function addCard(thread, card, meta = {}) {
  const at = new Date().toISOString();
  const record = {
    ...card,
    id: crypto.randomUUID(),
    session: meta.session || null,
    at,
    created_at: at,
    answered: false,
    system: Boolean(meta.system),
  };
  if (SINGLETONS.has(card.kind)) {
    const old = [...thread.cards].reverse().find((item) => item.kind === card.kind && !item.replaced);
    if (old) old.replaced = true;
    thread.pinned[card.kind] = record;
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

async function acceptCard(hub, payload) {
  const result = await hub.updateThread(payload.thread_id, async (thread) => {
    const session = hub.session(thread, payload.session);
    if (thread.archived) throw appError(409, 'thread is archived');
    thread.delivered_ids ||= [];
    if (payload.delivery_id && thread.delivered_ids.includes(payload.delivery_id)) {
      return { ok: true, duplicate: true };
    }
    const { session: ignoredSession, thread_id: ignoredThread, delivery_id: ignoredDelivery, ...input } = payload;
    const checked = validate(payload.kind, input, session.role);
    if (!checked.ok) throw appError(422, checked.reason);

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

    if (checked.card.kind === 'title') {
      thread.title = truncateTitle(checked.card.title, 80);
      if (payload.delivery_id) thread.delivered_ids = [...thread.delivered_ids, payload.delivery_id].slice(-500);
      return { card: { ok: true, title: thread.title }, targetName: null };
    }

    if (checked.card.kind === 'offer') {
      const offers = thread.cards.filter((item) => item.kind === 'offer');
      if (offers.length > 1 || (offers.length === 1 && offers[0].answered_value !== 'keep talking first')) {
        throw appError(422, 'the offer was already asked');
      }
    }

    const stored = checked.card.kind === 'image' ? { ...checked.card, file: path.basename(checked.card.path) } : checked.card;
    const card = addCard(thread, stored, { session: session.name });
    if (card.kind === 'message') {
      const target = hub.session(thread, card.to);
      target.queue ||= [];
      const message = { text: `[wc:from ${session.name}] ${card.text}`, source: 'session', at: new Date().toISOString() };
      target.queue.push(message);
      thread.queues[target.name] = target.queue;
    }
    if (card.kind === 'result') {
      session.finished = true;
      if (session.started_by) {
        const target = hub.session(thread, session.started_by);
        target.queue ||= [];
        target.queue.push({ text: `[wc:from ${session.name}] result: ${card.summary}`, source: 'result', at: new Date().toISOString() });
        thread.queues[target.name] = target.queue;
      }
    }
    if (card.kind === 'stub') {
      const child = await hub.createStub(thread, card);
      card.thread_id = child.id;
    }
    const targetName = card.kind === 'message'
      ? card.to
      : card.kind === 'result'
        ? thread.sessions.find((item) => item.name === payload.session)?.started_by
        : null;
    if (payload.delivery_id) thread.delivered_ids = [...thread.delivered_ids, payload.delivery_id].slice(-500);
    // The card, queue and durable delivery id commit together. Delivery happens afterwards:
    // a dead target must not turn a valid card into a rejected one.
    return { card, targetName };
  });
  if (result.duplicate) return result;
  if (result.targetName) {
    const thread = await hub.thread(payload.thread_id);
    await hub.deliver(thread, result.targetName);
  }
  return result.card;
}

module.exports = { SINGLETONS, addCard, acceptCard, resolveCard };
