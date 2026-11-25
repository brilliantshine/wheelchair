'use strict';

const path = require('node:path');
const settings = require('./settings.js');
const { special } = require('./assistant.js');
const { appError } = require('./state.js');

async function isOn(hub) { return (await settings.load(hub)).project_leads === 'on'; }

async function machineKey(hub, registry, name) {
  const machine = await hub.state.resolveMachine(registry, name);
  return machine ? machine.name || Object.keys(registry).find((key) => registry[key] === machine) : null;
}

async function identity(hub, registry, machine, projectPath) {
  if (typeof projectPath !== 'string' || !projectPath || typeof machine !== 'string') return null;
  const key = await machineKey(hub, registry, machine);
  return key ? JSON.stringify([key, projectPath]) : null;
}

async function projects(hub, registry, threads) {
  const groups = new Map();
  for (const thread of threads) {
    if (thread.archived || special(thread)) continue;
    const key = await identity(hub, registry, thread.machine, thread.project);
    if (key && !groups.has(key)) groups.set(key, { machine: thread.machine, path: thread.project, name: path.basename(thread.project) });
  }
  return groups;
}

async function find(hub, registry, threads, key) {
  for (const thread of threads) {
    if (thread.project_lead && await identity(hub, registry, thread.machine, thread.project) === key) return thread;
  }
  return null;
}

function serialize(hub, action) {
  const previous = hub.projectLeadChange || Promise.resolve();
  const work = previous.catch(() => {}).then(action);
  hub.projectLeadChange = work;
  return work;
}

function ensure(hub, { machine, path }) {
  return serialize(hub, async () => {
    if (!await isOn(hub)) throw appError(404, 'project leads are off');
    const [registry, threads] = await Promise.all([hub.machines(), hub.allThreads()]);
    const key = await identity(hub, registry, machine, path);
    const project = (await projects(hub, registry, threads)).get(key);
    if (!project) throw appError(404, 'no such project');
    const existing = await find(hub, registry, threads, key);
    if (existing) return existing;
    const thread = {
      ...require('./threads.js').emptyThread({ project: project.path, machine: project.machine }),
      project_lead: true,
      title: `${project.name} lead`,
    };
    await hub.save(thread);
    return thread;
  });
}

async function status(hub, id) {
  if (!await isOn(hub)) return { on: false };
  if (id == null) return { on: true };
  const threads = await hub.allThreads();
  const target = threads.find((thread) => thread.id === id);
  if (!target || special(target)) return { on: true, project: null };
  const registry = await hub.machines();
  const key = await identity(hub, registry, target.machine, target.project);
  const project = (await projects(hub, registry, threads)).get(key);
  if (!project) return { on: true, project: null };
  const thread = await find(hub, registry, threads, key);
  return {
    on: true, project, thread: thread?.id || null,
    lead_live: !!thread?.sessions.some((session) => session.live && session.role === 'lead'),
  };
}

async function message(hub, thread, text) {
  let lead = [...thread.sessions].reverse().find((item) => item.role === 'lead');
  const first = !lead;
  if (first) {
    const sessions = require('./sessions.js');
    lead = { name: sessions.newSessionName(thread, 'lead'), role: 'lead', token: require('node:crypto').randomBytes(32).toString('hex'), status: 'pending', live: false, ready: false, created_at: new Date().toISOString(), queue: [] };
    thread.sessions.push(lead);
  }
  await hub.enqueue(thread, lead.name, text, 'user');
  try {
    if (first) {
      const started = await require('./sessions.js').startSession(hub, thread, { role: 'lead', brief: '', tier: 'top', _waiting: lead });
      await hub.deliver(thread, started.name);
    } else await require('./threads.js').restartLead(hub, thread.id);
    return { queued: true };
  } catch (error) {
    return { queued: true, start_error: error.message };
  }
}

async function stop(hub, thread) {
  let pending = false;
  for (const session of thread.sessions.filter((item) => item.live)) {
    try {
      const result = await require('./sessions.js').stopManagedSession(hub, thread, session);
      if (result?.pending) pending = true;
    } catch { pending = true; }
  }
  if (pending) thread.stop_pending = true; else delete thread.stop_pending;
  await hub.save(thread);
}

function change(hub, on) {
  return serialize(hub, async () => {
    const threads = (await hub.allThreads()).filter((thread) => thread.project_lead);
    await Promise.all(threads.map((thread) => hub.withThread(thread.id, async () => {
      const current = await hub.thread(thread.id);
      if (on) { delete current.stop_pending; await hub.save(current); }
      else if (!await isOn(hub)) await stop(hub, current);
    })));
  });
}

// Run outside the machine call and thread lock; stop itself makes another machine call.
function machineSeen(hub, machine) {
  hub.projectLeadRetries ||= new Set();
  if (hub.projectLeadRetries.has(machine)) return;
  hub.projectLeadRetries.add(machine);
  setImmediate(async () => {
    try {
      if (await isOn(hub)) return;
      const registry = await hub.machines();
      const key = await machineKey(hub, registry, machine);
      if (!key) return;
      for (const thread of await hub.allThreads()) {
        if (!thread.project_lead || !thread.stop_pending || await machineKey(hub, registry, thread.machine) !== key) continue;
        await hub.withThread(thread.id, async () => {
          if (!await isOn(hub)) {
            const current = await hub.thread(thread.id);
            if (current.stop_pending) await stop(hub, current);
          }
        });
      }
    } catch {} finally { hub.projectLeadRetries.delete(machine); }
  });
}

async function guard(hub, thread) {
  if (thread.project_lead && !await isOn(hub)) throw appError(404, 'project leads are off');
}

async function inboundRefusal(hub) {
  return `a project lead takes messages only from ${(await settings.load(hub)).user_name || 'the user'}`;
}

module.exports = { isOn, machineKey, identity, projects, find, ensure, status, change, message, machineSeen, guard, inboundRefusal };
