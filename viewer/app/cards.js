'use strict';

// Spec "How the app reads and drives a session" and protocol/app/cards.md.
const crypto = require('node:crypto');
const { appError } = require('./state.js');
const { validate } = require('./card.js');

const SINGLETONS = new Set(['offer', 'idea', 'progress']);

function addCard(thread, card, meta = {}) {
  const record = {
    ...card,
    id: crypto.randomUUID(),
    session: meta.session || null,
    created_at: new Date().toISOString(),
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
  const thread = await hub.thread(payload.thread_id);
  const session = hub.session(thread, payload.session);
  if (thread.archived) throw appError(409, 'thread is archived');

  const { session: ignoredSession, thread_id: ignoredThread, ...input } = payload;
  const checked = validate(payload.kind, input, session.role);
  if (!checked.ok) throw appError(422, checked.reason);

  const card = addCard(thread, checked.card, { session: session.name });
  if (card.kind === 'message') {
    const target = hub.session(thread, card.to);
    await hub.enqueue(thread, target.name, `[wc:from ${session.name}] ${card.text}`, 'session');
  }
  if (card.kind === 'result') {
    session.finished = true;
    if (session.started_by) {
      const text = `[wc:from ${session.name}] result: ${card.summary}`;
      await hub.enqueue(thread, session.started_by, text, 'result');
    }
  }
  if (card.kind === 'stub') await hub.createStub(thread, card);
  await hub.save(thread);
  return card;
}

module.exports = { SINGLETONS, addCard, acceptCard };
