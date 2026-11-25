'use strict';

const settings = require('./settings.js');
const { appError } = require('./state.js');

async function isOn(hub) { return (await settings.load(hub)).assistant === 'on'; }
function special(thread) { return !!(thread.assistant || thread.project_lead); }

async function visible(hub, threads) {
  if (!threads.some(special)) return threads;
  const value = await settings.load(hub);
  return threads.filter((thread) => (!thread.assistant || value.assistant === 'on') && (!thread.project_lead || value.project_leads === 'on'));
}
async function guard(hub, id) {
  // A read-only snapshot: hub.thread() can save a provider migration, and this runs outside the thread's lock.
  const thread = await hub.threadSnapshot(id);
  if (thread.assistant && !await isOn(hub)) throw appError(404, 'the assistant is off');
  if (thread.project_lead) await require('./project-lead.js').guard(hub, thread);
}
async function status(hub) {
  if ((await settings.load(hub)).assistant !== 'on') return { on: false };
  const thread = (await hub.allThreads()).find((item) => item.assistant);
  return { on: true, thread: thread?.id || null, lead_live: !!thread?.sessions.some((s) => s.role === 'lead' && s.live) };
}
async function change(hub, on) {
  const previous = hub.assistantChange || Promise.resolve();
  const work = previous.catch(() => {}).then(async () => {
    let thread = (await hub.allThreads()).find((item) => item.assistant);
    if (on && !thread) {
      thread = { ...require('./threads.js').emptyThread({ project: null, machine: 'hub' }), assistant: true, title: 'Personal assistant' };
      await hub.save(thread);
      try { await hub.withThread(thread.id, async () => require('./sessions.js').startSession(hub, await hub.thread(thread.id), { role: 'lead', brief: '', tier: 'top' })); }
      catch (error) { error.assistantStart = true; throw error; }
    } else if (on && thread && !thread.sessions.some((s) => s.role === 'lead' && s.live)) {
      try { await hub.restartLead(thread.id); }
      catch (error) { error.assistantStart = true; throw error; }
    } else if (!on && thread) {
      await hub.withThread(thread.id, async () => {
        const current = await hub.thread(thread.id);
        for (const session of current.sessions.filter((s) => s.live)) await require('./sessions.js').stopManagedSession(hub, current, session);
      });
    }
  });
  hub.assistantChange = work;
  return work;
}
module.exports = { isOn, special, visible, guard, status, change };
