'use strict';

const path = require('node:path');
const { readStatus, STATUS_GROUP, addNeeds } = require('./views.js');
const { publicSession } = require('./sessions.js');

function displayTitle(session, thread) {
  if (session.role === 'lead') return thread.title;
  if (session.title) return session.title;
  return (session.brief || '').split(/\r?\n/).map((line) => line.trim())
    .find((line) => line && !line.startsWith('[wc:') && !line.startsWith('Read ') && !line.startsWith('Nothing below overrides'))?.slice(0, 80) || session.role;
}

function buildAgents(threads, stages = {}) {
  return threads.filter((thread) => !thread.archived).sort((a, b) => String(b.collin_at || b.created_at || '').localeCompare(String(a.collin_at || a.created_at || ''))).flatMap((thread) => {
    const sessions = thread.sessions || [];
    const leads = sessions.filter((s) => s.role === 'lead').sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    if (!leads.length) return [];
    const lead = leads[0], leadNames = new Set(leads.map((s) => s.name));
    const visible = sessions.filter((s) => s.role !== 'lead' || s === lead);
    const cards = thread.cards || [];
    const needs = []; addNeeds(needs, { ...thread, cards });
    const nodes = new Map(visible.map((s) => [s.name, { ...publicSession(s), children: [], has_brief: typeof s.brief === 'string' && !!s.brief }]));
    const root = nodes.get(lead.name);
    for (const s of visible.filter((item) => item !== lead)) {
      let parent = leadNames.has(s.started_by) ? root : nodes.get(s.started_by);
      // A parent chain that loops cannot be attached safely; put its node under the lead.
      const seen = new Set([s.name]); let cursor = s;
      while (cursor && cursor !== lead && !leadNames.has(cursor.started_by)) {
        if (seen.has(cursor.started_by)) { parent = root; break; }
        seen.add(cursor.started_by); cursor = sessions.find((item) => item.name === cursor.started_by);
      }
      (parent && parent !== nodes.get(s.name) ? parent : root).children.push(nodes.get(s.name));
    }
    const counts = { total: 0, working: 0, waiting: 0, not_started: 0, finished: 0, idle: 0 };
    for (const s of visible) {
      const node = nodes.get(s.name);
      if (s.turn_ended !== true && !node.turn_started_at && s.created_at) node.turn_started_at = s.created_at;
      node.children.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
      let waiting = null;
      if (s.turn_ended === true) {
        const starter = leadNames.has(s.started_by) ? lead : sessions.find((item) => item.name === s.started_by);
        const lastIndex = cards.findLastIndex ? cards.findLastIndex((card) => card.session === s.name) : (() => { for (let i = cards.length - 1; i >= 0; i--) if (cards[i].session === s.name) return i; return -1; })();
        const last = cards[lastIndex];
        if (starter && last?.kind === 'message' && (last.to === s.started_by || last.to === starter.name) && !cards.slice(lastIndex + 1).some((card) => card.kind === 'message' && (card.session === starter.name || (starter === lead && leadNames.has(card.session))) && card.to === s.name)) {
          waiting = { name: starter.name, label: `Waiting on the ${starter.role}` };
        } else {
          const children = node.children.filter((child) => child.live === true && child.finished !== true);
          if (children.length) waiting = { names: children.map((child) => child.name), label: children.length === 1 ? `Waiting on the ${children[0].role}` : `Waiting on ${children.length} agents` };
        }
      }
      node.waiting_on = waiting;
      node.state = !s.live || s.finished === true ? 'finished' : s.status === 'starting' || s.status === 'waiting' ? 'not-started' : s === lead && needs.length ? 'needs-you' : waiting ? 'waiting' : s.turn_ended !== true ? 'working' : 'idle';
      const result = [...cards].reverse().find((card) => card.kind === 'result' && card.session === s.name && card.summary);
      node.display_title = displayTitle(s, thread);
      if (s.role !== 'lead' && result) node.result_summary = result.summary;
      counts.total++; counts[node.state === 'needs-you' ? 'waiting' : node.state.replace('-', '_')]++;
    }
    const finished = !sessions.some((s) => s.live === true);
    const finishedAt = sessions.map((s) => s.ended_at).filter(Boolean).sort().pop();
    return [{ thread_id: thread.id, thread_title: thread.title, lead_name: thread.lead_name, machine: thread.machine, project: path.basename(thread.project || ''), stage: stages[thread.id] || 'idea', finished, ...(finished && finishedAt ? { finished_at: finishedAt } : {}), asides: (thread.asides || []).filter((a) => a.status === 'open').map((a) => ({ kind: 'aside', id: a.id, number: a.number, display_title: `Side conversation ${a.number}`, state: a.turn || a.pending?.length ? 'working' : 'idle' })), counts, session: root, children: root.children }];
  });
}

async function agents(hub) {
  const threads = await hub.allThreads();
  const stages = Object.fromEntries(await Promise.all(threads.map(async (thread) => [thread.id, !thread.slug ? 'idea' : STATUS_GROUP[thread.worktree ? await readStatus(thread) : thread.last_status] || 'idea'])));
  const leads = buildAgents(threads, stages);
  const registry = await hub.machines();
  const hubEntry = await hub.state.resolveMachine(registry, 'hub');
  const machines = await Promise.all(Object.entries(registry).map(async ([machine, entry]) => {
    let reachable = true;
    try { await hub.call(machine, '/v1/sessions', 'GET'); } catch { reachable = false; }
    return { machine, reachable, last_seen: hub.machineSeen(machine), hub: !!hubEntry && entry === hubEntry };
  }));
  return { leads, machines };
}

module.exports = { buildAgents, agents, displayTitle };
