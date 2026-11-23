'use strict';

const { frozen } = require('./handoff.js');
const { currentDone } = require('./cards.js');

async function sameMachine(hub, registry, a, b) {
  const first = await hub.state.resolveMachine(registry, a);
  const second = await hub.state.resolveMachine(registry, b);
  return Boolean(first && first === second);
}
function reachable(hub, thread) { return !thread.archived && !frozen(hub, thread); }
function candidateStub(hub, thread) { return thread.stub === true && reachable(hub, thread) && !currentDone(thread) && !(thread.cards || []).some(card => card.kind === 'merged'); }
function linked(a, b) { return (a.lead_links || []).includes(b.id) || (b.lead_links || []).includes(a.id); }
function latestLiveLead(thread) { return [...(thread.sessions || [])].reverse().find(s => s.role === 'lead' && s.live); }
function threadName(thread) { return thread.title || thread.slug || String(thread.project || '').split('/').filter(Boolean).at(-1) || thread.id; }

async function reachTarget(hub, thread, id) {
  const match = (await hub.state.allThreads()).find(item => item.id === id);
  if (!match) return { reason: 'no such thread' };
  let target;
  try { target = await hub.state.thread(match.id); }
  catch (error) { if (error.status === 404) return { reason: 'no such thread' }; throw error; }
  if (target.id === thread.id) return { reason: 'that is this thread' };
  if (!(await sameMachine(hub, await hub.machines(), thread.machine, target.machine))) return { reason: 'that thread is on another machine' };
  if (target.archived) return { reason: 'that thread is archived' };
  if (!reachable(hub, target)) return { reason: 'that thread was handed off' };
  return { target };
}

// Mirrors progressWords and pinLabel in pages/thread.js, which are private to the page.
function progressLabel(card) {
  if (card.stage !== 'review' && card.stage !== 'verify') return `Building ${card.done} of ${card.total}${card.choice_waiting ? ': choice for you' : ''}`;
  const review = card.stage === 'review';
  const label = review ? (card.phase === 'clean' ? 'Plan reviewed' : 'Reviewing plan') : (card.phase === 'clean' ? 'Verified' : 'Verifying');
  let text = `${review ? 'pass' : 'attempt'} ${card.pass} · `;
  if (card.phase === 'checking') text += review ? 'reviewers reading' : 'checking';
  else if (card.phase === 'fixing') text += review ? `${card.found} found, ${card.fixed} resolved` : `${card.found} gaps, ${card.fixed} fixed`;
  else text += 'passed' + (review && card.found !== undefined ? `, ${card.found} resolved` : '');
  if (!review && (card.machines || []).length) text += ` · ${card.machines.join(', ')}`;
  return `${label} · ${text}${card.choice_waiting ? ': choice for you' : ''}`;
}
async function listLeads(hub, callerThread, { allProjects = false } = {}) {
  const registry = await hub.state.machines();
  const leads = [];
  for (const thread of await hub.state.allThreads()) {
    if (thread.id === callerThread.id || !reachable(hub, thread) || !(await sameMachine(hub, registry, callerThread.machine, thread.machine))) continue;
    const sameProject = thread.project === callerThread.project;
    const isLinked = !sameProject && linked(callerThread, thread);
    const hasLead = (thread.sessions || []).some(s => s.role === 'lead');
    if (!(isLinked || (sameProject && (hasLead || (candidateStub(hub, thread) && !(thread.sessions || []).length))) || (allProjects && !sameProject && hasLead))) continue;
    const entry = { thread: thread.id, lead: latestLiveLead(thread)?.name || null, project: thread.project, title: threadName(thread), linked: isLinked };
    if (sameProject || isLinked) {
      const idea = thread.pinned?.idea;
      const progress = thread.pinned?.progress;
      Object.assign(entry, {
        stage: thread.last_status || (thread.slug ? 'unknown' : 'no plan'),
        idea: (idea?.bullets || []).slice(0, 6).map(bullet => bullet.text),
        progress: progress ? progressLabel(progress) : null,
        branch: thread.branch || null,
        pr_url: currentDone(thread)?.pr_url || null,
      });
    }
    if (sameProject && candidateStub(hub, thread)) Object.assign(entry, { stub: true, summary: thread.context, takes_additions: !(thread.sessions || []).length, waits_on_parent: Boolean(thread.depends_on_parent && !thread.ready) });
    leads.push(entry);
  }
  return { leads };
}
module.exports = { candidateStub, sameMachine, reachable, linked, latestLiveLead, listLeads, reachTarget, threadName };
