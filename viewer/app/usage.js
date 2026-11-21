'use strict';

const path = require('node:path');
const { atomicWrite, readJson } = require('./state.js');
const { PROVIDERS } = require('./providers.js');
const settingsModule = require('./settings.js');
const HOUR = 3600000;
const cache = new WeakMap();
function millis(now) { return new Date(now ?? Date.now()).getTime(); }
function effective(reading, now = Date.now()) {
  if (!reading) return null;
  const out = { ...reading };
  for (const key of ['five_hour', 'week']) if (reading[key]) {
    out[key] = { ...reading[key] };
    if (reading[key].resets_at && Date.parse(reading[key].resets_at) <= millis(now)) out[key] = { used: 0, resets_at: null };
  }
  return out;
}
function hasRoom(account, reading, { loggedIn, leave = 10, now = Date.now() }) {
  if (account.provider === 'openrouter') return !account.paused && loggedIn === true;
  const r = effective(reading, now);
  return !account.paused && loggedIn === true && !(r?.limited_until && Date.parse(r.limited_until) > millis(now)) && ['five_hour', 'week'].every((key) => !r?.[key] || r[key].used < 100 - leave);
}
function forecast(accounts, readingsById, now = Date.now()) {
  const active = accounts.filter((a) => !a.paused && a.provider !== 'openrouter');
  const capacity = active.reduce((n, a) => n + a.weight, 0);
  const withReadings = active.filter((a) => readingsById[a.id]?.week);
  const used = capacity ? active.reduce((n, a) => n + a.weight * (effective(readingsById[a.id], now)?.week?.used || 0) / 100, 0) / capacity : 0;
  const resets = active.map((a) => effective(readingsById[a.id], now)?.week?.resets_at).filter((r) => r && Date.parse(r) > millis(now)).sort();
  const first = resets[0] || null;
  const elapsed = first ? (millis(now) - (Date.parse(first) - 168 * HOUR)) / HOUR : 0;
  const pace = elapsed > 0 ? used / elapsed : 0;
  const left = withReadings.length && capacity ? 1 - used : null;
  const outAt = pace > 0 && left !== null ? new Date(millis(now) + left / pace * HOUR).toISOString() : null;
  return { left, used, pace, runs_out_at: outAt, first_refill: first, amber: Boolean(first && outAt && Date.parse(outAt) < Date.parse(first)), all_paused: !capacity };
}
function belowMargin(f, margin, now = Date.now()) {
  return Boolean(f.first_refill && f.left !== null && f.left - f.pace * (Date.parse(f.first_refill) - millis(now)) / HOUR < margin / 100);
}
async function store(hub) { return readJson(path.join(hub.state.dir, 'usage.json'), { readings: {}, seen: {} }); }
async function change(hub, fn) {
  const file = path.join(hub.state.dir, 'usage.json');
  return hub.state.queued(file, async () => { const data = await store(hub); data.readings ||= {}; data.seen ||= {}; const result = await fn(data); await atomicWrite(file, `${JSON.stringify(data, null, 2)}\n`); return result; });
}
async function record(hub, reading) { return change(hub, (data) => { const old = data.readings[reading.account]; if (!old || Date.parse(reading.at) > Date.parse(old.at)) data.readings[reading.account] = { ...reading, ...(!reading.limited_until && Date.parse(old?.limited_until) > Date.now() ? { limited_until: old.limited_until } : {}) };  }); }
async function readings(hub) { return (await store(hub)).readings || {}; }
async function lastChosen(hub) { return (await store(hub)).last_chosen || {}; }
async function recordChosen(hub, provider, id) { return change(hub, (data) => { (data.last_chosen ||= {})[provider] = id; }); }
async function machineAccounts(hub) {
  const previous = cache.get(hub);
  if (previous && Date.now() - previous.at < 15000) return previous.promise;
  const promise = (async () => {
    const machines = await hub.machines();
    const entries = await Promise.all(Object.keys(machines).map(async (name) => {
      try {
        const status = await Promise.race([hub.call(name, '/v1/status', 'GET', undefined, 3000), new Promise((_, reject) => { const t = setTimeout(() => reject(new Error('timeout')), 3000); t.unref(); })]);
        const accounts = {};
        const logins = {};
        const problems = {};
        const cliProblem = (cli) => (typeof status[cli]?.problem === 'string' && status[cli].problem ? status[cli].problem : null);
        if (Array.isArray(status.accounts)) {
          for (const row of status.accounts) {
            logins[row.id] = Boolean(row.logged_in);
            accounts[row.id] = Boolean(logins[row.id] && status[row.cli]?.installed);
            const text = cliProblem('kimi') && row.cli === 'kimi' ? cliProblem('kimi') : (!row.logged_in && typeof row.problem === 'string' && row.problem ? row.problem : null);
            if (text) problems[row.id] = text;
          }
        } else for (const [provider, info] of Object.entries(PROVIDERS)) {
          logins[`default-${provider}`] = Boolean(status[info.cli]?.logged_in);
          accounts[`default-${provider}`] = Boolean(logins[`default-${provider}`] && status[info.cli]?.installed);
          if (provider === 'kimi' && cliProblem('kimi')) problems['default-kimi'] = cliProblem('kimi');
        }
        const cliProblems = cliProblem('kimi') ? { kimi: cliProblem('kimi') } : {};
        const harnesses = Object.fromEntries(Object.entries(PROVIDERS).map(([p, info]) => [p, { installed: Boolean(status[info.cli]?.installed), version: status[info.cli]?.version || null, recipe: status.recipes ? Boolean(status.recipes[p]) : null }]));
        return [name, { reachable: true, accounts, logins, problems, cliProblems, harnesses, status }];
      } catch { return [name, { reachable: false, accounts: {}, problems: {}, cliProblems: {} }]; }
    }));
    return Object.fromEntries(entries);
  })();
  cache.set(hub, { at: Date.now(), promise });
  return promise;
}
// OpenRouter spend: asked of every known machine on each call and summed; nothing is kept.
async function spend(hub) {
  const machines = await hub.machines();
  const total = { today: 0, last_7_days: 0, last_30_days: 0, incomplete: false };
  await Promise.all(Object.keys(machines).map(async (name) => {
    try {
      const body = await Promise.race([hub.call(name, '/v1/spend', 'GET', undefined, 3000), new Promise((_, reject) => { const t = setTimeout(() => reject(new Error('timeout')), 3000); t.unref(); })]);
      if (!body || !Array.isArray(body.accounts)) throw new Error('bad spend answer');
      const rows = body.accounts.map((a) => [a?.today, a?.last_7_days, a?.last_30_days]);
      if (rows.some((r) => r.some((n) => typeof n !== 'number' || !Number.isFinite(n)))) throw new Error('bad spend answer');
      for (const [d, w, m] of rows) { total.today += d; total.last_7_days += w; total.last_30_days += m; }
    } catch { total.incomplete = true; }
  }));
  return total;
}
function rank(accounts, readingsById, machineState, settings, machine, now = Date.now(), lastChosen = {}) {
  const state = machineState?.[machine] || machineState || {};
  const ranked = accounts.map((account) => {
    const reading = effective(readingsById[account.id], now);
    const loggedIn = state.reachable === false ? undefined : state.accounts?.[account.id];
    let reason = 'has room';
    if (settings.harnesses?.[account.provider] === false) reason = 'skipped: left out in Settings';
    else if (account.paused) reason = 'skipped: paused';
    else if (loggedIn !== true) reason = `skipped: signed out on ${machine}`;
    else if (reading?.limited_until && Date.parse(reading.limited_until) > millis(now)) reason = `skipped: limit until ${new Date(reading.limited_until).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    else if (!hasRoom(account, reading, { loggedIn, leave: settings.leave, now })) reason = `skipped: under the ${settings.leave}% left for you`;
    return { ...account, next: false, reason };
  });
  const eligible = ranked.filter((a) => a.reason === 'has room');
  const room = (a) => a.weight * (1 - (effective(readingsById[a.id], now)?.week?.used || 0) / 100);
  const reset = (a) => Date.parse(effective(readingsById[a.id], now)?.week?.resets_at) || Infinity;
  eligible.sort((a, b) => settings.within === 'spread' ? room(b) - room(a) || (a.live_sessions || 0) - (b.live_sessions || 0) : reset(a) - reset(b) || room(b) - room(a));
  const lastId = typeof lastChosen === 'string' ? lastChosen : lastChosen?.[accounts[0]?.provider];
  const selected = settings.within === 'one' ? eligible.find((a) => a.id === lastId) || eligible[0] : eligible[0];
  if (selected) { selected.next = true; selected.reason = { soonest: 'next: refills soonest', spread: 'next: most room left', one: 'next: current account' }[settings.within]; }
  return ranked;
}
async function summary(hub, includeMachines = true, now = Date.now()) {
  const [settings, data, machines, threads] = await Promise.all([settingsModule.load(hub), store(hub), includeMachines ? machineAccounts(hub) : {}, includeMachines ? hub.allThreads() : []]);
  const providers = {};
  const knownMachines = includeMachines ? await hub.machines() : {};
  const local = includeMachines ? await hub.state.resolveMachine(knownMachines, 'hub') : null;
  const localName = Object.entries(knownMachines).find(([, m]) => local && (m.name === local.name || (m.address === local.address && m.port === local.port)))?.[0] || 'hub';
  for (const [provider, info] of Object.entries(PROVIDERS)) {
    const accounts = settings.accounts.filter((a) => a.provider === provider).map((a) => ({ ...a, live_sessions: threads.reduce((n, t) => n + t.sessions.filter((s) => s.live && s.account === a.id).length, 0) }));
    const f = forecast(accounts, data.readings || {}, now);
    const below_notify = f.left !== null && f.left < settings.notify_below / 100;
    const ranked = rank(accounts, data.readings || {}, machines, settings, localName, now, data.last_chosen);
    providers[provider] = { ...(provider === 'openrouter' && includeMachines ? { spend: await spend(hub) } : {}), label: info.label, left: f.left, amber: f.amber, runs_out_at: f.runs_out_at, first_refill: f.first_refill, below_notify, all_paused: provider === 'openrouter' ? accounts.every((a) => a.paused) : f.all_paused, accounts: ranked.map((a) => ({ ...a, machines: Object.fromEntries(Object.entries(machines).map(([name, m]) => [name, !m.reachable ? 'unknown' : m.accounts[a.id] ? 'signed_in' : a.provider === 'kimi' && m.cliProblems?.kimi ? { state: 'problem', text: m.cliProblems.kimi } : m.problems?.[a.id] ? { state: 'problem', text: m.problems[a.id] } : 'signed_out'])), reading: data.readings?.[a.id] || null })) };
  }
  return { providers, seen: data.seen || {} };
}
function weekKey(now) {
  const local = new Date(now);
  const date = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const year = date.getUTCFullYear();
  const week = Math.ceil(((date - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
async function alert(hub, now = Date.now()) { const { providers, seen } = await summary(hub, false, now); return { dot: Object.entries(providers).some(([p, f]) => (f.amber || f.below_notify) && seen[p] !== weekKey(now)) }; }
async function seen(hub, now = Date.now()) { const { providers } = await summary(hub, false, now); await change(hub, (data) => { for (const [p, f] of Object.entries(providers)) if (f.amber || f.below_notify) data.seen[p] = weekKey(now); }); return { ok: true }; }
function clearCache(hub) { cache.delete(hub); }
module.exports = { clearCache, effective, hasRoom, forecast, belowMargin, record, readings, lastChosen, recordChosen, machineAccounts, spend, rank, summary, alert, seen };
