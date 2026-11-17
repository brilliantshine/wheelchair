'use strict';

function buildAgents(threads) {
  return threads.filter((thread) => !thread.archived).sort((a, b) => String(b.collin_at || b.created_at || '').localeCompare(String(a.collin_at || a.created_at || ''))).flatMap((thread) => {
    const sessions = thread.sessions || [];
    const leads = sessions.filter((s) => s.role === 'lead').sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    if (!leads.length) return [];
    const lead = leads[0];
    const leadNames = new Set(leads.map((s) => s.name));
    const nonLeads = sessions.filter((s) => s.role !== 'lead');
    const nodes = new Map(sessions.map((s) => {
      const { token, ...publicSession } = s;
      return [s.name, { ...publicSession, children: [], waiting_on: s.turn_ended === true ? sessions.filter((child) => child.started_by === s.name && child.live === true && child.finished !== true).map((child) => child.name) : [] }];
    }));
    const root = nodes.get(lead.name);
    for (const s of nonLeads) {
      const parent = leadNames.has(s.started_by) ? root : nodes.get(s.started_by);
      (parent && parent !== nodes.get(s.name) ? parent : root).children.push(nodes.get(s.name));
    }
    const prune = (node, seen = new Set()) => {
      if (seen.has(node)) return false;
      const next = new Set(seen); next.add(node);
      node.children = node.children.filter((child) => prune(child, next));
      return node.live === true || node.children.length > 0;
    };
    if (!prune(root)) return [];
    return [{ thread_id: thread.id, thread_title: thread.title, lead_name: thread.lead_name, machine: thread.machine, session: root, children: root.children }];
  });
}

async function agents(hub) {
  const leads = buildAgents(await hub.allThreads());
  const registry = await hub.machines();
  const hubEntry = await hub.state.resolveMachine(registry, 'hub');
  const machines = await Promise.all(Object.entries(registry).map(async ([machine, entry]) => {
    let reachable = true;
    try { await hub.call(machine, '/v1/sessions', 'GET'); } catch { reachable = false; }
    return { machine, reachable, last_seen: hub.machineSeen(machine), hub: !!hubEntry && entry === hubEntry };
  }));
  return { leads, machines };
}

module.exports = { buildAgents, agents };
