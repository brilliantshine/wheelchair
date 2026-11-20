'use strict';

const { frozen } = require('./handoff.js');
const { currentDone } = require('./cards.js');

async function sameMachine(hub, registry, a, b) {
  const first = await hub.state.resolveMachine(registry, a);
  const second = await hub.state.resolveMachine(registry, b);
  return Boolean(first && first === second);
}
function reachable(hub, thread) { return !thread.archived && !frozen(hub, thread); }
function linked(a, b) { return (a.lead_links || []).includes(b.id) || (b.lead_links || []).includes(a.id); }
function latestLiveLead(thread) { return [...(thread.sessions || [])].reverse().find(s => s.role === 'lead' && s.live); }

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
    if (!(isLinked || (sameProject && hasLead) || (allProjects && !sameProject && hasLead))) continue;
    const entry = { thread: thread.id, lead: latestLiveLead(thread)?.name || null, project: thread.project, title: thread.title, linked: isLinked };
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
    leads.push(entry);
  }
  return { leads };
}
module.exports = { sameMachine, reachable, linked, latestLiveLead, listLeads };
