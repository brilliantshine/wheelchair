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
  return run(hub, input, { allowSettings: true, source: assistant, target: async (id) => {
    if (id === assistant.id) throw appError(403, 'the assistant thread cannot be a target');
    const target = (await hub.allThreads()).find((thread) => thread.id === id);
    if (target?.project_lead) throw appError(403, "that's a project lead; talk to it directly");
  }, include: (t) => !assistantHelpers.special(t) });
}

async function run(hub, input, policy) {
  const assistant = policy.source;
  const action = input.action;
  if (action === 'settings' || action === 'setting') {
    if (policy.allowSettings !== true) throw appError(403, 'only the personal assistant may do that');
    if (action === 'settings') {
      const base = (await routes.invokeSettings(hub, 'GET', '')).body;
      if (input.include_history !== true) delete base.lesson_history;
      return { ...base, diagram_sensitivity: await require('./diagram-sensitivity.js').read(hub), background: await require('./background.js').metadata(hub) };
    }
    return changeSetting(hub, input);
  }
  if (input.thread) await policy.target(input.thread);
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
    const list = (await routes.listThreads(hub)).filter((t) => policy.include(t) && (action === 'thread' || input.archived || !t.archived));
    const rows = await Promise.all(list.map(async (summary) => {
      let thread = await hub.thread(summary.id);
      if (policy.clean) thread = policy.clean(thread);
      const needs = [];
      require('./views.js').addNeeds(needs, thread);
      const { asides, ...visibleSummary } = policy.clean ? policy.clean(summary) : summary;
      const status = thread.slug ? await require('./views.js').currentStatus(hub, thread) : summary.last_status;
      return { ...visibleSummary, last_status: status, lead_live: thread.sessions.some((s) => s.role === 'lead' && s.live), waiting: needs.map((n) => ({ id: n.card_id, kind: n.kind, text: policy.waitingText?.(n) || n.title.split('\n')[0] })) };
    }));
    if (action === 'threads') return { threads: rows };
    const row = rows.find((t) => t.id === input.thread);
    if (!row) throw appError(404, 'thread not found');
    let thread = await hub.thread(input.thread);
    if (policy.clean) thread = policy.clean(thread);
    const chat = await hub.chat(input.thread);
    if (policy.cleanChat) chat.items = policy.cleanChat(chat.items);
    return { ...row, cards: thread.cards.filter((c) => !c.replaced && !c.answered && !c.retracted_at), queued: Object.entries(thread.queues || {}).filter(([name]) => thread.sessions.some((s) => s.name === name && s.role === 'lead')).flatMap(([, queue]) => queue.map((entry) => entry.text)), recent: chat.items.filter((item) => ['human', 'assistant', 'context'].includes(item.type)).slice(-30) };
  }
  if (action === 'start') {
    if (policy.start) input = { ...input, ...policy.start };
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
  if (policy.press) await policy.press(input);
  return { ok: true, result: await hub.press(input.thread, input.card, { action: input.press_action, value: input.value }, 'assistant') };
}
const preferenceKeys = new Set('lead_names lead_name_list permission_mode shared_tools_repo codex_mode aside_access project_leads auto_merge auto_merge_delete_branch review_families tool_steps escalation default_project_folder user_name other_agents provider_orders lead_tier_notice_dismissed'.split(' '));
const param = (payload, key) => {
  if (typeof payload[key] !== 'string' || !payload[key].trim()) throw appError(400, `${key} is required`);
  return encodeURIComponent(payload[key]);
};
const withoutId = ({ id, ...rest }) => rest;
const routeTable = {
  style: ['PUT', () => '/style'],
  harness: ['PUT', p => `/harnesses/${param(p, 'provider')}`, p => ({ enabled: p.enabled })],
  'account-add': ['POST', () => '/accounts'],
  'account-update': ['PUT', p => `/accounts/${param(p, 'id')}`, withoutId],
  'account-remove': ['DELETE', p => `/accounts/${param(p, 'id')}`, () => ({})],
  'account-restore': ['POST', p => `/accounts/${param(p, 'id')}/restore`, () => ({})],
  balancing: ['PUT', () => '/balancing'], model: ['PUT', () => '/models'],
  'models-heads-up': ['POST', () => '/models/heads-up'],
  'template-create': ['POST', () => '/templates'],
  'template-update': ['PUT', p => `/templates/${param(p, 'id')}`, withoutId],
  'template-delete': ['DELETE', p => `/templates/${param(p, 'id')}`, () => ({})],
  'lessons-update': ['PUT', p => `/lessons/${param(p, 'role')}`, p => ({ edits: p.edits, removals: p.removals })],
  'lesson-restore': ['POST', p => `/lessons/${param(p, 'role')}/restore`, p => ({ id: p.id, vid: p.vid })],
  'lesson-keep': ['POST', p => `/lessons/${param(p, 'role')}/keep`, p => ({ id: p.id })],
  'lesson-waiting': ['POST', p => `/lessons/${param(p, 'role')}/waiting`, p => ({ wid: p.wid, action: p.action })],
};
async function changeSetting(hub, input) {
  const { target, payload } = input;
  if (typeof target !== 'string' || !target.trim() || !payload || typeof payload !== 'object' || Array.isArray(payload) || ![Object.prototype, null].includes(Object.getPrototypeOf(payload))) throw appError(400, 'target and object payload are required');
  if (target === 'preferences') {
    if (Object.hasOwn(payload, 'assistant')) throw appError(403, 'the assistant cannot change its own on/off setting; change it under Settings → Assistant and project leads');
    const keys = Object.keys(payload);
    if (!keys.length) throw appError(400, 'preferences payload must name at least one setting');
    for (const key of keys) if (!preferenceKeys.has(key)) throw appError(400, `unsupported preference key: ${key}`);
    return { ok: true, result: (await routes.invokeSettings(hub, 'PUT', '/preferences', payload)).body };
  }
  if (target === 'diagram-sensitivity') {
    const res = await routes.invokeSettings(hub, 'POST', '/diagram-sensitivity', payload);
    return res.status === 200 ? { ok: true, result: res.body } : { ok: false, error: 'one or more machines did not update diagram sensitivity', result: res.body };
  }
  if (target === 'background') {
    const background = require('./background.js');
    let result;
    if (payload.action === 'opacity') {
      if (!Number.isInteger(payload.opacity) || payload.opacity < 0 || payload.opacity > 100 || (payload.revision !== undefined && (!Number.isSafeInteger(payload.revision) || payload.revision < 0))) throw appError(400, 'invalid background opacity or revision');
      const current = await background.metadata(hub);
      if (!current.image_id) throw appError(400, 'no background image is set');
      result = await background.commit(hub, payload.revision ?? current.revision, payload.opacity, current.image_id, current.media_type, null);
    } else if (payload.action === 'remove') {
      if (!Number.isSafeInteger(payload.revision) || payload.revision < 0) throw appError(400, 'background remove requires revision');
      result = await background.commit(hub, payload.revision, 35, null, null, null);
    } else throw appError(400, 'background action must be opacity or remove');
    return { ok: true, result };
  }
  if (!Object.hasOwn(routeTable, target)) throw appError(400, 'unsupported setting target');
  const [method, path, body = p => p] = routeTable[target];
  return { ok: true, result: (await routes.invokeSettings(hub, method, path(payload), body(payload))).body };
}
module.exports = { dispatch, run };
