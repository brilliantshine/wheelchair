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

function activity(session) {
  const steps = session.steps || [];
  const counts = Object.fromEntries(['files', 'shell', 'helpers', 'web', 'starter', 'thinking'].map(k => [k, session.step_counts?.[k] || 0]));
  const trail = [];
  for (const step of steps.slice(-5)) if (trail[trail.length - 1] !== step.kind) trail.push(step.kind);
  const latest = steps.slice(-4).reverse().map(step => ({ label: (step.failed === true ? 'Failed: ' : '') + step.label, at: step.started_at, state: !step.ended_at ? 'running' : step.failed === true ? 'failed' : 'done' }));
  let current = null;
  if (session.live && !session.ended_at) {
    const active = steps.filter(step => !step.ended_at).at(-1);
    if (active) current = { kind: active.kind, label: active.label, since: active.started_at, id: active.id };
    else if (session.turn_started_at && session.turn_started_at > (session.turn_ended_at || '') && !session.turn_ended) {
      const since = steps.filter(step => step.ended_at && step.ended_at >= session.turn_started_at).map(step => step.ended_at).sort().pop() || session.turn_started_at;
      current = { kind: 'thinking', label: 'Thinking', since };
    }
  }
  return { counts, trail, current, latest };
}

// Follow stored links, stopping before a repeated card or sender.
function questionChain(card, cards) {
  const chain = [], seen = new Set();
  let current = card;
  while (current && !seen.has(current.id)) {
    seen.add(current.id); chain.unshift(current);
    current = current.passes_on && cards.find(c => c.id === current.passes_on && c.kind === 'message' && c.asks === true);
  }
  const names = new Set(), unique = [];
  for (const item of chain) { if (names.has(item.session)) break; names.add(item.session); unique.push(item); }
  return unique;
}
function questionFor(session, cards, sessions) {
  const index = cards.findLastIndex(c => c.kind === 'message' && c.asks === true && c.session === session.name && sessions.some(s => s.name === c.to));
  if (index < 0) return null;
  const asked = cards[index];
  if (cards.slice(index + 1).some(c => c.session === asked.to && ((c.kind === 'message' && c.to === session.name) || (c.kind === 'result' && sessions.find(s => s.name === c.session)?.started_by === session.name)))) return null;
  const forwarded = cards.slice(index + 1).filter(c => (c.kind === 'message' && c.passes_on || c.kind === 'question') && questionChain(c, cards).some(h => h.id === asked.id));
  if (forwarded.some(c => c.kind === 'question' && (c.answered || c.retracted_at))) return null;
  const last = forwarded.at(-1) || asked;
  const chain = questionChain(last, cards);
  const start = chain.findIndex(c => c.id === asked.id);
  const trail = chain.slice(start < 0 ? 0 : start).map(c => {
    const line = String(c.kind === 'question' ? c.question : c.text || '').split(/\r?\n/)[0];
    return { who: c.session, at: c.at || c.created_at, text: line.length > 80 ? line.slice(0, 79) + '…' : line };
  });
  const open = forwarded.findLast(c => c.kind === 'question' && !c.answered && !c.retracted_at);
  return { asked_at: asked.at || asked.created_at, to: asked.to, trail, card_id: open?.id || null };
}

const REMOVED_ACCOUNT = 'a removed account';
function accountLabels(session, accounts) {
  const name = (id) => accounts.find((a) => a.id === id)?.name || REMOVED_ACCOUNT;
  const last = Array.isArray(session.switches) ? session.switches.at(-1) : null;
  return { account_name: session.account ? name(session.account) : null, moved_from: last && last.from ? name(last.from) : null };
}

function buildAgents(threads, stages = {}, accounts = []) {
  return threads.filter((thread) => !thread.archived).sort((a, b) => String(b.user_at || b.created_at || '').localeCompare(String(a.user_at || a.created_at || ''))).flatMap((thread) => {
    const sessions = thread.sessions || [];
    const leads = sessions.filter((s) => s.role === 'lead').sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    if (!leads.length) return [];
    const lead = leads[0], leadNames = new Set(leads.map((s) => s.name));
    const visible = sessions.filter((s) => s.role !== 'lead' || s === lead);
    const cards = thread.cards || [];
    const review = {};
    for (const card of cards) {
      if (card.kind === 'progress' && card.stage === 'review' && ['fixing', 'clean'].includes(card.phase)) {
        review[card.pass] = { found: card.found ?? 0, ...(card.phase === 'clean' ? { clean: true } : {}) };
      }
    }
    const needs = []; addNeeds(needs, { ...thread, cards });
    const nodes = new Map(visible.map((s) => [s.name, { ...publicSession(s), ...accountLabels(s, accounts), context: s.context || null, activity: activity(s), children: [], has_brief: typeof s.brief === 'string' && !!s.brief }]));
    const root = nodes.get(lead.name);
    const question_paths = cards.filter(c => c.kind === 'question' && c.passes_on && !c.answered && !c.retracted_at).map(c => questionChain(c, cards).map(h => h.session));
    for (const s of visible) {
      const node = nodes.get(s.name);
      node.question = questionFor(s, cards, sessions);
      delete node.switches; delete node.steps; delete node.pending_ends; delete node.turns; delete node.step_counts;
    }
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
      if (s.role === 'reviewer' && result) {
        const lines = result.summary.split(/\r?\n/).filter(line => /^(?:RE-RAISE: )?SEVERITY:/.test(line));
        const fields = lines[0]?.replace(/^RE-RAISE: /, '').split(' — ');
        node.report = { findings: lines.length, first: fields ? (fields.length >= 4 ? fields.slice(2, -1) : fields.slice(1)).join(' — ').trim() || null : null };
      }
      if (node.state === 'finished') node.finished_at = s.ended_at || result?.created_at || s.created_at;
      counts.total++; counts[node.state === 'needs-you' ? 'waiting' : node.state.replace('-', '_')]++;
    }
    const finished = !sessions.some((s) => s.live === true);
    const finishedAt = sessions.map((s) => s.ended_at).filter(Boolean).sort().pop();
    return [{ thread_id: thread.id, thread_title: thread.title, lead_name: thread.lead_name, machine: thread.machine, project: path.basename(thread.project || ''), stage: stages[thread.id] || 'idea', finished, ...(finished && finishedAt ? { finished_at: finishedAt } : {}), question_paths, rounds: { review }, asides: (thread.asides || []).filter((a) => a.status === 'open').map((a) => ({ kind: 'aside', id: a.id, number: a.number, display_title: `Side conversation ${a.number}`, state: a.turn || a.pending?.length ? 'working' : 'idle' })), counts, session: root, children: root.children }];
  });
}

async function agents(hub) {
  const threads = await hub.allThreads();
  const stages = Object.fromEntries(await Promise.all(threads.map(async (thread) => [thread.id, !thread.slug ? 'idea' : STATUS_GROUP[thread.worktree ? await readStatus(thread) : thread.last_status] || 'idea'])));
  const leads = buildAgents(threads, stages, typeof hub.state?.settings === 'function' ? (await require('./settings.js').load(hub)).accounts || [] : []);
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
