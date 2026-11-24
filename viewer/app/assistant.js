'use strict';

const settings = require('./settings.js');
const { appError } = require('./state.js');

async function isOn(hub) { return (await settings.load(hub)).assistant === 'on'; }
async function visible(hub, threads) {
  if (!threads.some((thread) => thread.assistant)) return threads;
  const on = await isOn(hub);
  return threads.filter((thread) => !thread.assistant || on);
}
async function guard(hub, id) {
  const thread = await hub.thread(id);
  if (thread.assistant && !(await visible(hub, [thread])).length) throw appError(404, 'the assistant is off');
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
      await hub.withThread(thread.id, async () => require('./sessions.js').startSession(hub, await hub.thread(thread.id), { role: 'lead', brief: '', tier: 'top' }));
    } else if (on && thread && !thread.sessions.some((s) => s.role === 'lead' && s.live)) {
      await hub.restartLead(thread.id);
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
module.exports = { isOn, visible, guard, status, change };
