'use strict';

const { appError } = require('./state.js');
const projectLead = require('./project-lead.js');
const { special } = require('./assistant.js');

async function dispatch(hub, input) {
  if (!await projectLead.isOn(hub)) throw appError(403, 'project leads are off');
  const threads = await hub.allThreads();
  const source = threads.find((thread) => thread.project_lead &&
    thread.sessions.filter((s) => s.role === 'lead' && s.live).at(-1)?.name === input.calling_session);
  if (!source) throw appError(403, 'only a project lead may do that');
  const registry = await hub.machines();
  const key = await projectLead.identity(hub, registry, source.machine, source.project);
  const allowed = new Set();
  for (const thread of threads) {
    if (!special(thread) && key && await projectLead.identity(hub, registry, thread.machine, thread.project) === key) allowed.add(thread.id);
  }
  const outside = threads.filter((thread) => !allowed.has(thread.id));
  const forbidden = new Set(outside.flatMap((thread) => [thread.id, thread.project, ...thread.sessions.map((s) => s.name), thread.pr_url, typeof thread.target_pr === 'string' && /^https?:\/\//i.test(thread.target_pr) ? thread.target_pr : null, require('./handoff.js').donePr(thread)].filter(Boolean)));
  // Cross-thread queues and cards can contain the other lead's message without its id.
  for (const thread of threads.filter((t) => allowed.has(t.id))) {
    for (const entry of thread.peer_log || []) if (!allowed.has(entry.thread)) {
      for (const value of [entry.text, entry.session]) if (value) forbidden.add(value);
    }
  }
  for (const value of forbidden) {
    if (value === source.project || source.project.includes(value)) forbidden.delete(value);
  }
  const containsOutside = (value) => typeof value === 'string' && [...forbidden].some((part) => typeof part === 'string' && part.length >= 8 && value.includes(part));
  function clean(value, field) {
    if (typeof value === 'string') return containsOutside(value) ? undefined : value;
    if (Array.isArray(value)) return value.filter((item) => field !== 'cards' || !item.replaced && !item.answered && !item.retracted_at).map((item) => clean(item, field)).filter((item) => item !== undefined);
    if (!value || typeof value !== 'object') return value;
    if (['reach', 'permit'].includes(value.kind)) return { id: value.id, kind: value.kind, text: value.kind === 'reach' ? "a request to talk to another project's lead" : "a request to push to someone else's pull request" };
    if ((value.thread && containsOutside(value.thread)) || (value.thread_id && containsOutside(value.thread_id)) || (value.to && containsOutside(value.to)) || (value.text && containsOutside(value.text))) return undefined;
    const result = {};
    for (const [name, item] of Object.entries(value)) {
      if (containsOutside(name)) continue;
      const filtered = clean(item, name);
      if (filtered !== undefined) result[name] = filtered;
    }
    return result;
  }
  const policy = {
    source,
    include: (thread) => allowed.has(thread.id),
    target: async (id) => {
      if (!allowed.has(id)) throw appError(403, 'that thread is in another project; ask your assistant');
    },
    clean,
    cleanChat: (items) => clean(items),
    waitingText: (n) => n.kind === 'reach' ? "a request to talk to another project's lead" : n.kind === 'permit' ? "a request to push to someone else's pull request" : null,
    start: { project: source.project, machine: source.machine },
    press: async (request) => {
      const target = await hub.thread(request.thread);
      if (['sudo', 'reach', 'permit'].includes(target.cards.find((card) => card.id === request.card)?.kind)) throw appError(403, 'that needs you');
    },
  };
  if (!['threads', 'thread', 'start', 'message', 'press', 'restart', 'archive', 'refresh'].includes(input.action)) throw appError(400, 'unsupported project lead action');
  if (input.action === 'refresh') {
    try {
      const result = await hub.call(source.machine, '/v1/project-lead/refresh', 'POST', { thread_id: source.id, project_dir: source.project }, 100000);
      return { ok: true, commit: result.commit };
    } catch (error) { return { ok: false, error: error.message }; }
  }
  return require('./assistant-actions.js').run(hub, input, policy);
}
module.exports = { dispatch };
