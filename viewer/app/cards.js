'use strict';

// Spec "How the app reads and drives a session" and protocol/app/cards.md.
const crypto = require('node:crypto');
const { appError } = require('./state.js');
const { validate } = require('./card.js');

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

async function acceptCard(hub, payload) {
  let createdStub = null;
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

    const card = addCard(thread, checked.card, { session: session.name });
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
    if (card.kind === 'stub') createdStub = { parent: thread, card };
    if (payload.delivery_id) thread.delivered_ids = [...thread.delivered_ids, payload.delivery_id].slice(-500);
    return card;
  });
  if (result.duplicate) return result;
  if (createdStub) {
    const child = await hub.createStub(createdStub.parent, createdStub.card);
    await hub.updateThread(payload.thread_id, async (thread) => {
      const card = thread.cards.find((item) => item.id === result.id);
      if (card) card.thread_id = child.id;
    });
    result.thread_id = child.id;
  }
  // Registration is the app equivalent of --register-plan: it happens before the card is
  // observable to a page, so its iframe never races an unregistered plan directory.
  if (result.kind === 'diagram' && hub.registerPlan) {
    const thread = await hub.thread(payload.thread_id);
    const plan = require('node:path').join(thread.worktree || thread.project, 'docs', 'plans', result.plan);
    await hub.registerPlan(plan);
  }
  const thread = await hub.thread(payload.thread_id);
  const targetName = result.kind === 'message' ? result.to : result.kind === 'result' ? thread.sessions.find((item) => item.name === payload.session)?.started_by : null;
  if (targetName) await hub.deliver(thread, targetName);
  return result;
}

module.exports = { SINGLETONS, addCard, acceptCard };
