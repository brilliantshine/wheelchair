'use strict';

const { PROVIDERS, DISPLAY_NAMES, providerOf } = require('./providers.js');
const settings = require('./settings.js');
const usage = require('./usage.js');
const balancer = require('./balancer.js');
const ready = require('./ready.js');

function enabledLeadOrder(value) {
  return [...new Set(balancer.expandOrder(value.provider_orders.lead, value))].filter((p) => value.harnesses[p]);
}
function names(providers) { return providers.map((p) => DISPLAY_NAMES[p]).join(', ') || 'no harnesses'; }
async function describe(hub, fresh = false) {
  if (fresh) usage.clearCache(hub);
  const [value, states, configured, threads] = await Promise.all([settings.load(hub), usage.machineAccounts(hub), hub.machines(), hub.allThreads()]);
  const machines = Object.entries(states).map(([name, state]) => ({ name, reachable: state.reachable, harnesses: state.reachable ? Object.fromEntries(Object.keys(PROVIDERS).map((p) => [p, { ...state.harnesses[p], signed_in: value.accounts.some((a) => a.provider === p && !a.paused && state.logins[a.id]) }])) : {} }));
  const threads_using = Object.fromEntries(Object.keys(PROVIDERS).map((p) => [p, threads.filter((t) => t.sessions.some((s) => s.live && (s.provider || providerOf(s.cli) || t.provider) === p)).length]));
  const resolved = await hub.state.resolveMachine(configured, 'hub');
  const machine = Object.keys(configured).find((name) => resolved && (configured[name] === resolved || configured[name].name === resolved.name)) || 'hub';
  const state = states[machine];
  const can_start = { machine };
  for (const role of ['lead', 'worker']) {
    if (!state?.reachable) { can_start[role] = { ok: false, reason: `${machine} isn't reachable.` }; continue; }
    if (await ready.outOfDate(hub, state.status)) { can_start[role] = { ok: false, reason: `${machine} needs updating: re-run ./install.sh on it.` }; continue; }
    try {
      const selection = await balancer.choose(hub, { machine: 'hub', sessions: [] }, role, role === 'lead' ? 'top' : 'standard');
      if (selection.provider) { can_start[role] = { ok: true }; continue; }
      if (selection.wait?.reason?.endsWith('in Settings → Models')) { can_start[role] = { ok: false, reason: selection.wait.reason }; continue; }
      const order = role === 'lead' ? enabledLeadOrder(value) : value.worker_order.filter((p) => value.harnesses[p]);
      const signed = (p) => value.accounts.some((a) => a.provider === p && !a.paused && state.accounts[a.id]);
      let reason;
      if (!order.some(signed)) {
        reason = `New ${role === 'lead' ? 'leads' : 'workers'} try ${names(order)}; none is installed and signed in on ${machine}.`;
        const others = Object.keys(PROVIDERS).filter((p) => value.harnesses[p] && !order.includes(p) && signed(p));
        if (others.length) reason += ` Add ${names(others)} to ${role === 'worker' || value.provider_orders.lead === 'worker' || (value.provider_orders.lead === 'lead' && value.lead_order.includes('any')) ? 'Worker ladder' : value.provider_orders.lead === 'lead' ? 'Lead ladder' : 'Leads provider order'} in Settings.`;
      } else reason = `No account has room for a new ${role} right now (usage limits, or the share saved for leads).`;
      can_start[role] = { ok: false, reason };
    } catch (error) { can_start[role] = { ok: false, reason: error.message }; }
  }
  return { switches: value.harnesses, threads_using, machines, can_start };
}
async function onboarding(hub) {
  if ((await settings.load(hub)).onboarding_done) return { show: false, steps: [] };
  const data = await describe(hub);
  const reachable = data.machines.filter((m) => m.reachable);
  const any = (predicate) => reachable.some((m) => Object.entries(m.harnesses).some(([p, h]) => data.switches[p] && predicate(h)));
  const failure = !data.can_start.lead.ok ? data.can_start.lead.reason : !data.can_start.worker.ok ? data.can_start.worker.reason : null;
  const steps = [
    { id: 'install', label: 'Install an agent harness', done: any((h) => h.installed) },
    { id: 'signin', label: 'Sign in to it', done: any((h) => h.installed && h.signed_in) },
    { id: 'start', label: 'Agents can start', done: !failure, ...(failure ? { reason: failure } : {}) },
  ];
  if (steps.every((s) => s.done)) { await settings.update(hub, (value) => { value.onboarding_done = true; }); return { show: false, steps: [] }; }
  return { show: reachable.length > 0, steps };
}
module.exports = { describe, onboarding, enabledLeadOrder };
