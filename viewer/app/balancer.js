'use strict';
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const settingsStore = require('./settings.js');
const usage = require('./usage.js');
const { PROVIDERS, DISPLAY_NAMES, providerOf } = require('./providers.js');
const { appError } = require('./state.js');
const exec = promisify(execFile);

async function slotFor(hub, role, requestedTier = 'top') {
  if (['lead', 'sub-lead'].includes(role)) return role;
  const settings = await settingsStore.load(hub);
  if (['reviewer', 'verifier', 'mapper'].includes(role)) return settings.other_agents[role];
  const tier = ({ haiku: 'light', sonnet: 'standard', opus: 'heavy' })[requestedTier] || requestedTier;
  try { const slot = settingsStore.tier(tier, 'tier', true); return slot === 'top' ? 'heavy' : slot; }
  catch { throw appError(400, `unknown tier "${requestedTier}"; use light, standard, heavy, critical, or top`); }
}
function signedIn(settings, machines, machineName, provider) {
  const states = machineName == null ? Object.values(machines) : [machines[machineName]];
  return settings.accounts.some((a) => a.provider === provider && !a.paused && states.some((m) => m?.accounts?.[a.id]));
}
function reservedProvider(settings, machines, machineName) {
  const order = [...new Set(settings.lead_order.flatMap((p) => p === 'any' ? settings.worker_order : [p]))];
  return order.find((p) => settings.harnesses[p] && signedIn(settings, machines, machineName, p)) || null;
}
async function machineNameOf(hub, thread) {
  const configured = await hub.machines();
  const resolvedMachine = await hub.state.resolveMachine(configured, thread.machine);
  return Object.keys(configured).find((name) => configured[name] === resolvedMachine || configured[name].name === resolvedMachine?.name) || thread.machine;
}
// What leads and sub-leads are told about review families. "Mix families" with only one
// family signed in means one reviewer per round on that family, not two on it. Only sign-in
// counts, not per-tier models, so verifier choices for multi-family setups are unchanged.
// Placement uses the same answer, so a lone family outside the worker order still gets them.
function effectiveFamilies(settings, machines, machineName) {
  if (settings.review_families !== 'both') return settings.review_families;
  const signed = Object.keys(PROVIDERS).filter((p) => settings.harnesses[p] && signedIn(settings, machines, machineName, p));
  return signed.length === 1 ? signed[0] : 'both';
}
async function reviewFamilies(hub, thread) {
  const [settings, machines, machineName] = await Promise.all([settingsStore.load(hub), usage.machineAccounts(hub), machineNameOf(hub, thread)]);
  return effectiveFamilies(settings, machines, machineName);
}
function providerAccounts(settings, threads, provider) {
  return settings.accounts.filter(a => a.provider === provider).map(a => ({ ...a, live_sessions: threads.reduce((n, t) => n + t.sessions.filter(s => s.live && s.account === a.id).length, 0) }));
}
function heldBack(settings, reserved, role, provider, accounts, readings, now) {
  return provider === reserved && !['lead', 'sub-lead'].includes(role) && settings.held_back[role] === true && usage.belowMargin(usage.forecast(accounts, readings, now), settings.margin, now);
}
async function chooseSwitch(hub, thread, target) {
  const [settings, readings, machines, last, threads, machineName] = await Promise.all([settingsStore.load(hub), usage.readings(hub), usage.machineAccounts(hub), usage.lastChosen(hub), hub.allThreads(), machineNameOf(hub, thread)]);
  const now = Date.now(), provider = target.provider;
  const accounts = providerAccounts(settings, threads, provider);
  if (heldBack(settings, reservedProvider(settings, machines, machineName), target.role, provider, accounts, readings, now)) return null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const account = usage.rank(accounts, readings, machines, settings, machineName, now, last).find(a => a.next);
    if (!account) return null;
    if (provider !== 'gpt') return { account };
    const dir = account.id === `default-${provider}` ? null : `~/.wheelchair/accounts/${account.id}`;
    try { await hub.call(thread.machine, '/v1/preflight', 'POST', { dir }); return { account }; }
    catch { if (machines[machineName]) machines[machineName].accounts[account.id] = false; }
  }
  return null;
}
async function choose(hub, thread, role, tier, constraints = {}) {
  let { provider, not_provider: excluded } = constraints;
  if ((provider || excluded) && (!['worker', 'reviewer', 'verifier'].includes(role) || (provider && excluded) || (provider && !Object.hasOwn(PROVIDERS, provider)) || (excluded && !Object.hasOwn(PROVIDERS, excluded)))) throw appError(400, 'invalid provider constraint');
  const slot = await slotFor(hub, role, tier);
  const [settings, readings, machines, last, threads] = await Promise.all([settingsStore.load(hub), usage.readings(hub), usage.machineAccounts(hub), usage.lastChosen(hub), hub.allThreads()]);
  const now = Date.now();
  const machineName = await machineNameOf(hub, thread);
  const reserved = reservedProvider(settings, machines, machineName);
  let fallbackReview = null, droppedProvider = null, strictReview = null;
  const families = effectiveFamilies(settings, machines, machineName);
  if (['reviewer', 'verifier'].includes(role) && families !== 'both') {
    const family = families;
    let used = settings.harnesses[family] && signedIn(settings, machines, machineName, family);
    if (used) {
      try { await exec(path.join(hub.root, 'codex', 'model.sh'), [family, slot]); }
      catch (e) { if (e.code === 3) used = false; else throw e; }
    }
    provider = undefined; excluded = undefined;
    if (used) strictReview = family; else if (settings.review_families !== 'both') fallbackReview = family;
  }
  if (role === 'worker' && provider && (!settings.harnesses[provider] || !signedIn(settings, machines, machineName, provider))) { droppedProvider = provider; provider = undefined; }
  if (!thread.provider && thread.cli && thread.sessions?.length) thread.provider = providerOf(thread.cli);
  let order = role === 'lead' && !thread.provider ? settings.lead_order.flatMap((p) => p === 'any' ? settings.worker_order : [p]) : ['lead', 'sub-lead'].includes(role) ? [thread.provider] : [...settings.worker_order];
  if (['lead', 'sub-lead'].includes(role) && thread.provider && !settings.harnesses[thread.provider]) return { wait: { provider: thread.provider, until: new Date(now + 60000).toISOString(), reason: `${DISPLAY_NAMES[thread.provider]} is left out in Settings` } };
  order = (strictReview ? [strictReview] : [...new Set(order.filter(Boolean))]).filter((p) => settings.harnesses[p]);
  if (provider && role === 'worker') {
    try { await exec(path.join(hub.root, 'codex', 'model.sh'), [provider, slot]); }
    catch (e) { if (e.code === 3) throw appError(400, `${PROVIDERS[provider].label} is not used at ${slot}`); throw e; }
  }
  const available = {};
  const margin = {};
  for (const p of provider === 'openrouter' && !order.includes(provider) ? [...order, provider] : order) {
    try { await exec(path.join(hub.root, 'codex', 'model.sh'), [p, slot]); } catch (e) { if (e.code === 3) continue; throw e; }
    const accounts = providerAccounts(settings, threads, p);
    margin[p] = heldBack(settings, reserved, role, p, accounts, readings, now);
    available[p] = usage.rank(accounts, readings, machines, settings, machineName, now, last).find((a) => a.next);
  }
  const normal = (exclude) => {
    let list = order.filter((p) => p !== exclude && !margin[p]);
    if (settings.save_for_leads && !['lead', 'sub-lead'].includes(role)) list = [...list.filter((p) => p !== reserved), ...list.filter((p) => p === reserved)];
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
  if (picked && droppedProvider) note = `Could not use ${droppedProvider}; using ${picked}.`;
  // Mix families narrowed to one signed-in family still reports a constraint it could not meet.
  if (picked && settings.review_families === 'both' && strictReview) {
    if (constraints.provider && constraints.provider !== picked) note = `Could not use ${constraints.provider}; using ${picked}.`;
    else if (constraints.not_provider === picked) note = `Could not avoid ${picked}; using ${picked}.`;
  }
  if (picked && fallbackReview) note = `Reviewers and checkers are set to ${PROVIDERS[fallbackReview].label}, but ${PROVIDERS[fallbackReview].label} is not available; using ${PROVIDERS[picked].label}.`;
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
  const waitingProvider = strictReview || (['lead', 'sub-lead'].includes(role) && thread.provider ? thread.provider : role === 'worker' && provider && !margin[provider] ? provider : role === 'lead' ? order[0] || null : null);
  return { wait: { provider: waitingProvider, until: resets[0] || new Date(now + 60000).toISOString(), reason: `no ${relevant.length === 1 ? relevant[0] + ' account' : 'account'} has room` } };
}
module.exports = { chooseSwitch, choose, slotFor, reservedProvider, reviewFamilies };
