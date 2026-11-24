'use strict';

const { appError } = require('./state.js');
const { publicSession } = require('./sessions.js');
const assistantHelpers = require('./assistant.js');
const routes = require('./routes.js');

async function dispatch(hub, input) {
  if (!await assistantHelpers.isOn(hub)) throw appError(403, 'the assistant is off');
  const assistant = (await hub.allThreads()).find((thread) => thread.assistant);
  const lead = assistant?.sessions.filter((s) => s.role === 'lead' && s.live).at(-1);
  if (!lead || lead.name !== input.calling_session) throw appError(403, 'only the personal assistant may do that');
  const action = input.action;
  if (input.thread && input.thread === assistant.id) throw appError(403, 'the assistant thread cannot be a target');
  if (action === 'projects') {
    const initial = await routes.newThread(hub, 'hub');
    const machines = await Promise.all(initial.machines.map(async (name) => {
      const data = name === 'hub' ? initial : await routes.newThread(hub, name);
      const seen = new Set();
      const projects = [...data.saved, ...data.found, ...data.previous.map((path) => ({ path }))].filter((entry) => entry.path && !seen.has(entry.path) && seen.add(entry.path)).map((entry) => ({ path: entry.path, name: entry.name || require('node:path').basename(entry.path) }));
      return { name, projects };
    }));
    return { machines };
  }
  if (action === 'threads' || action === 'thread') {
    const list = (await routes.listThreads(hub)).filter((t) => !t.assistant && (action === 'thread' || input.archived || !t.archived));
    const rows = await Promise.all(list.map(async (summary) => {
      const thread = await hub.thread(summary.id), needs = [];
      require('./views.js').addNeeds(needs, thread);
      return { ...summary, lead_live: thread.sessions.some((s) => s.role === 'lead' && s.live), waiting: needs.map((n) => ({ id: n.card_id, kind: n.kind, text: n.title.split('\n')[0] })) };
    }));
    if (action === 'threads') return { threads: rows };
    const row = rows.find((t) => t.id === input.thread);
    if (!row) throw appError(404, 'thread not found');
    const thread = await hub.thread(input.thread), chat = await hub.chat(input.thread);
    return { ...row, cards: thread.cards.filter((c) => !c.replaced && !c.answered && !c.retracted_at), queued: Object.entries(thread.queues || {}).filter(([name]) => thread.sessions.some((s) => s.name === name && s.role === 'lead')).flatMap(([, queue]) => queue.map((entry) => entry.text)), recent: chat.items.slice(-30) };
  }
  if (action === 'start') {
    if (typeof input.message !== 'string' || !input.message.trim() || !input.machine || !input.project) throw appError(400, 'project, machine and message are required');
    try {
      const thread = await hub.createThread({ project: input.project, machine: input.machine, message: `[wc:assistant] ${input.message}`, _assistant_title: input.title ?? input.message });
      return { ok: true, thread: thread.id, url: `/wheelchair/app/thread?id=${thread.id}` };
    } catch (error) {
      if (!error.savedThread) throw error;
      return { ok: false, error: error.message, thread: error.savedThread, url: `/wheelchair/app/thread?id=${error.savedThread}` };
    }
  }
  if (!['message', 'press', 'restart', 'archive'].includes(action)) throw appError(400, 'unsupported assistant action');
  if (!input.thread || typeof input.thread !== 'string') throw appError(400, 'thread is required');
  if (action === 'message') return hub.withThread(assistant.id, async () => {
    const source = await hub.thread(assistant.id);
    const { PAIR_LIMIT, PAIR_WINDOW_MS, append } = require('./peer-log.js');
    const since = Date.parse(source.user_at) || 0;
    const count = (source.peer_log || []).filter((entry) => entry.direction === 'sent' && entry.thread === input.thread && Date.parse(entry.at) > since && Date.parse(entry.at) > Date.now() - PAIR_WINDOW_MS).length;
    if (count >= PAIR_LIMIT || Date.parse(source.peer_pauses?.[input.thread]) > since) { source.peer_pauses ||= {}; if (!(Date.parse(source.peer_pauses[input.thread]) > since)) source.peer_pauses[input.thread] = new Date().toISOString(); await hub.save(source); throw appError(422, 'message limit reached: 20 messages within an hour'); }
    if (typeof input.text !== 'string' || !input.text.trim()) throw appError(400, 'text is required');
    await hub.withThread(input.thread, async () => {
      const target = await hub.thread(input.thread);
      require('./handoff.js').refuseFrozen(hub, target);
      if (target.archived) throw appError(409, 'this thread is archived');
      const targetLead = target.sessions.filter((s) => s.role === 'lead' && s.live).at(-1);
      if (!targetLead) throw appError(409, 'that thread has no live lead; restart it first');
      await hub.enqueue(target, targetLead.name, `[wc:assistant] ${input.text}`, 'user');
      append(source, { at: new Date().toISOString(), thread: target.id, direction: 'sent', session: targetLead.name, text: input.text });
      await hub.save(source);
    });
    return { ok: true, queued: true };
  });
  if (action === 'restart') {
    const target = await hub.thread(input.thread);
    require('./handoff.js').refuseFrozen(hub, target);
    if (target.archived) throw appError(409, 'this thread is archived');
    return { ok: true, result: publicSession(await hub.restartLead(input.thread, 'assistant')) };
  }
  if (action === 'archive') return { ok: true, result: await hub.archive(input.thread, 'assistant') };
  return { ok: true, result: await hub.press(input.thread, input.card, { action: input.press_action, value: input.value }, 'assistant') };
}
module.exports = { dispatch };
