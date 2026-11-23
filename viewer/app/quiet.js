'use strict';

const roles = new Set(['worker', 'mapper', 'sub-lead', 'reviewer', 'verifier']);
const reportRole = s => ['reviewer', 'verifier'].includes(s.role);
const watched = s => Boolean(s.live && s.started_by && roles.has(s.role) && !(reportRole(s) && s.finished));
const waiting = (thread, s) => thread.sessions.some(c => c.started_by === s.name && c.live && (c.owes_reply || c.awaiting_answer || c.status === 'waiting' || c.queue?.length));
const isQuiet = (thread, s) => watched(s) && !s.switching && s.owes_reply && s.turn_ended && !s.queue?.length && !s.permission_open && !s.needs_open && !(Date.parse(s.limited_until) > Date.now()) && !waiting(thread, s);
const agentText = s => reportRole(s)
  ? '[wc:from app] Your turn ended with no report. If you ended it to wait on your own background work, wait for it in the foreground now. End your next turn with your report as your last message.'
  : '[wc:from app] Your turn ended without a result or a question (a message card with asks: true), and the session that started you is waiting for one. A status message does not count: it leaves you looking idle. Your own wc.js and card.js commands are always allowed, whatever your brief says about ports or the network. If your task is done, post your result. If you cannot finish, post a result with outcome blocked and the reason. If you need an answer, send a message with asks: true. If work remains, carry on with it. If you ended your turn to wait on your own background work, wait for it in the foreground now and report when it is done. If you already posted a result or a question, ignore this.';
const starterText = s => `[wc:from app] your session ${s.name} ended two turns ${reportRole(s) ? 'with no report' : 'without a result or question'}, one of them after a reminder from the app. Check on it: message it, or stop and replace it.`;
function arm(hub, s) { if (watched(s) && !s.switching && s.owes_reply) s.quiet_check_at = new Date(Date.now() + hub.quietGraceMs).toISOString(); }
function reset(thread, s, stopped = false) {
  if (!stopped) { s.quiet_stage = 0; delete s.quiet_starter_at; }
  delete s.quiet_check_at;
  const card = thread.cards.find(c => c.id === s.quiet_card);
  if (card && !card.answered) card.answered = true;
  delete s.quiet_card;
  for (const target of thread.sessions) {
    if (!target.queue) continue;
    target.queue = target.queue.filter(q => !(target.name === s.name && q.quiet === 'agent') && !(q.quiet === 'starter' && q.about === s.name));
    if (thread.queues) thread.queues[target.name] = target.queue;
  }
}
function alert(hub, thread, s, reason) {
  const body = reason === 'dead' ? `${s.name} ended its turns without reporting back, and a reminder to it didn't help. ${s.started_by}, which started it, is no longer running.`
    : reason === 'timer' ? `${s.name} hasn't reported back in the ${Math.round(hub.quietEscalateMs / 60000)} minutes since ${s.started_by} was told it had gone quiet.`
      : `${s.name} keeps ending its turns without reporting back; reminders to it and to ${s.started_by} didn't help.`;
  s.quiet_card = require('./cards.js').addCard(thread, { kind: 'needs', title: 'An agent stopped without reporting', body: `${body} Open it from the Agents tab to see what it's doing, or tell the lead.` }, { system: true, session: s.name }).id;
  s.quiet_stage = 3; delete s.quiet_check_at;
}
async function checkQuiet(hub) {
  const threads = await hub.allThreads();
  await Promise.all(threads.filter(t => !t.archived).map(async listed => {
    try { await hub.withThread(listed.id, async () => {
      const thread = await hub.thread(listed.id); if (thread.archived) return;
      const { enqueue, deliver } = require('./sessions.js');
      let changed = false; const targets = new Set();
      for (const s of thread.sessions) {
        if (s.switching) continue;
        const stage = s.quiet_stage || 0;
        const starter = thread.sessions.find(x => x.name === s.started_by);
        if (s.quiet_check_at && (!watched(s) || !s.owes_reply)) { delete s.quiet_check_at; changed = true; }
        if (stage === 2 && !s.quiet_starter_at && !starter?.live && watched(s) && s.owes_reply) { alert(hub, thread, s, 'dead'); changed = true; continue; }
        if (s.quiet_check_at && Date.parse(s.quiet_check_at) <= Date.now() && isQuiet(thread, s)) {
          if (stage === 2 && !s.quiet_starter_at) continue;
          delete s.quiet_check_at; changed = true;
          if (stage === 0) { s.quiet_stage = 1; await enqueue(hub, thread, s.name, agentText(s), 'app', false, { save: false, deliver: false, quiet: 'agent' }); targets.add(s.name); }
          else if (stage === 1) {
            if (!starter?.live) alert(hub, thread, s, 'dead');
            else { s.quiet_stage = 2; await enqueue(hub, thread, starter.name, starterText(s), 'app', false, { save: false, deliver: false, quiet: 'starter', about: s.name }); targets.add(starter.name); }
          } else if (stage === 2) alert(hub, thread, s, 'turn');
        } else if (stage === 2 && s.quiet_starter_at && Date.parse(s.quiet_starter_at) + hub.quietEscalateMs <= Date.now() && watched(s) && s.owes_reply && !waiting(thread, s)) { alert(hub, thread, s, 'timer'); changed = true; }
      }
      if (changed) await hub.save(thread);
      for (const name of targets) await deliver(hub, thread, thread.sessions.find(s => s.name === name));
    }); } catch { /* retry on the next tick */ }
  }));
}
module.exports = { watched, waiting, isQuiet, arm, reset, checkQuiet };
