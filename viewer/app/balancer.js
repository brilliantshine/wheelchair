'use strict';
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const settingsStore = require('./settings.js');
const usage = require('./usage.js');
const { PROVIDERS, providerOf } = require('./providers.js');
const { appError } = require('./state.js');
const exec = promisify(execFile);

async function slotFor(hub, role, requestedTier = 'top') {
  if (['lead', 'sub-lead'].includes(role)) return 'lead';
  const settings = await settingsStore.load(hub);
  if (['reviewer', 'verifier', 'mapper'].includes(role)) return settings.other_agents[role];
  const tier = ({ haiku: 'light', sonnet: 'standard', opus: 'heavy' })[requestedTier] || requestedTier;
  try { const slot = settingsStore.tier(tier, 'tier', true); return slot === 'top' ? 'heavy' : slot; }
  catch { throw appError(400, `unknown tier "${requestedTier}"; use light, standard, heavy, critical, or top`); }
}
async function choose(hub, thread, role, tier, constraints = {}) {
  const { provider, not_provider: excluded } = constraints;
  if ((provider || excluded) && (!['worker', 'reviewer', 'verifier'].includes(role) || (provider && excluded) || (provider && !Object.hasOwn(PROVIDERS, provider)) || (excluded && !Object.hasOwn(PROVIDERS, excluded)))) throw appError(400, 'invalid provider constraint');
  const slot = await slotFor(hub, role, tier);
  const [settings, readings, machines, last, threads] = await Promise.all([settingsStore.load(hub), usage.readings(hub), usage.machineAccounts(hub), usage.lastChosen(hub), hub.allThreads()]);
  const now = Date.now();
  const configured = await hub.machines();
  const resolvedMachine = await hub.state.resolveMachine(configured, thread.machine);
  const machineName = Object.keys(configured).find((name) => configured[name] === resolvedMachine || configured[name].name === resolvedMachine?.name) || thread.machine;
  if (!thread.provider && thread.cli && thread.sessions?.length) thread.provider = providerOf(thread.cli);
  let order = role === 'lead' && !thread.provider ? settings.lead_order.flatMap((p) => p === 'any' ? settings.worker_order : [p]) : ['lead', 'sub-lead'].includes(role) ? [thread.provider] : [...settings.worker_order];
  order = [...new Set(order.filter(Boolean))];
  if (provider && role === 'worker') {
    try { await exec(path.join(hub.root, 'codex', 'model.sh'), [provider, slot]); }
    catch (e) { if (e.code === 3) throw appError(400, `${PROVIDERS[provider].label} is not used at ${slot}`); throw e; }
  }
  const available = {};
  const margin = {};
  for (const p of order) {
    try { await exec(path.join(hub.root, 'codex', 'model.sh'), [p, slot]); } catch (e) { if (e.code === 3) continue; throw e; }
    const accounts = settings.accounts.filter((a) => a.provider === p).map((a) => ({ ...a, live_sessions: threads.reduce((n, t) => n + t.sessions.filter((s) => s.live && s.account === a.id).length, 0) }));
    margin[p] = PROVIDERS[p].saveForLeads && !['lead', 'sub-lead'].includes(role) && usage.belowMargin(usage.forecast(accounts, readings, now), settings.margin, now);
    available[p] = usage.rank(accounts, readings, machines, settings, machineName, now, last).find((a) => a.next);
  }
  const normal = (exclude) => {
    let list = order.filter((p) => p !== exclude && !margin[p]);
    if (settings.save_claude_for_leads && !['lead', 'sub-lead'].includes(role)) list = [...list.filter((p) => !PROVIDERS[p].saveForLeads), ...list.filter((p) => PROVIDERS[p].saveForLeads)];
    return list.find((p) => available[p]);
  };
  let picked, note;
  if (provider && !margin[provider] && available[provider]) picked = provider;
  else if (provider && role === 'worker' && !margin[provider]) picked = undefined;
  else if (excluded) {
    picked = normal(excluded);
    if (!picked && role !== 'worker') { picked = normal(); if (picked) note = `Could not avoid ${excluded}; using ${picked}.`; }
  } else {
    picked = normal();
    if (provider && picked) note = `Could not use ${provider}; using ${picked}.`;
  }
  if (picked) return { provider: picked, account: available[picked], ...(note ? { note } : {}) };
  const relevant = provider && role === 'worker' && !margin[provider] ? [provider] : excluded && role === 'worker' ? order.filter((p) => p !== excluded) : order;
  const resets = settings.accounts.filter((a) => relevant.includes(a.provider) && !a.paused && machines[machineName]?.accounts?.[a.id]).flatMap((a) => {
    const reading = usage.effective(readings[a.id], now);
    const blockers = [];
    if (Date.parse(reading?.limited_until) > now) blockers.push(Date.parse(reading.limited_until));
    for (const key of ['five_hour', 'week']) if (reading?.[key] && reading[key].used >= 100 - settings.leave) {
      const reset = Date.parse(reading[key].resets_at);
      if (!(reset > now)) return [];
      blockers.push(reset);
    }
    return blockers.length ? [new Date(Math.max(...blockers)).toISOString()] : [];
  }).sort();
  const waitingProvider = ['lead', 'sub-lead'].includes(role) && thread.provider ? thread.provider : role === 'worker' && provider && !margin[provider] ? provider : role === 'lead' ? settings.lead_order.find((p) => p !== 'any') || null : null;
  return { wait: { provider: waitingProvider, until: resets[0] || new Date(now + 60000).toISOString(), reason: `no ${relevant.length === 1 ? relevant[0] + ' account' : 'account'} has room` } };
}
module.exports = { choose, slotFor };
