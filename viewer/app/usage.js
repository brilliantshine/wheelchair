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
  const r = effective(reading, now);
  return !account.paused && loggedIn === true && !(r?.limited_until && Date.parse(r.limited_until) > millis(now)) && ['five_hour', 'week'].every((key) => !r?.[key] || r[key].used < 100 - leave);
}
function forecast(accounts, readingsById, now = Date.now()) {
  const active = accounts.filter((a) => !a.paused);
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
        if (Array.isArray(status.accounts)) for (const row of status.accounts) accounts[row.id] = Boolean(row.logged_in);
        else for (const [provider, info] of Object.entries(PROVIDERS)) accounts[`default-${provider}`] = Boolean(status[info.cli]?.logged_in);
        return [name, { reachable: true, accounts }];
      } catch { return [name, { reachable: false, accounts: {} }]; }
    }));
    return Object.fromEntries(entries);
  })();
  cache.set(hub, { at: Date.now(), promise });
  return promise;
}
function rank(accounts, readingsById, machineState, settings, machine, now = Date.now(), lastChosen = {}) {
  const state = machineState?.[machine] || machineState || {};
  const ranked = accounts.map((account) => {
    const reading = effective(readingsById[account.id], now);
    const loggedIn = state.reachable === false ? undefined : state.accounts?.[account.id];
    let reason = 'has room';
    if (account.paused) reason = 'skipped: paused';
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
async function summary(hub, includeMachines = true) {
  const [settings, data, machines, threads] = await Promise.all([settingsModule.load(hub), store(hub), includeMachines ? machineAccounts(hub) : {}, includeMachines ? hub.allThreads() : []]);
  const providers = {};
  const knownMachines = includeMachines ? await hub.machines() : {};
  const local = includeMachines ? await hub.state.resolveMachine(knownMachines, 'hub') : null;
  const localName = Object.entries(knownMachines).find(([, m]) => local && (m.name === local.name || (m.address === local.address && m.port === local.port)))?.[0] || 'hub';
  for (const [provider, info] of Object.entries(PROVIDERS)) {
    const accounts = settings.accounts.filter((a) => a.provider === provider).map((a) => ({ ...a, live_sessions: threads.reduce((n, t) => n + t.sessions.filter((s) => s.live && s.account === a.id).length, 0) }));
    const f = forecast(accounts, data.readings || {});
    const below_notify = f.left !== null && f.left < settings.notify_below / 100;
    const ranked = rank(accounts, data.readings || {}, machines, settings, localName, Date.now(), data.last_chosen);
    providers[provider] = { label: info.label, left: f.left, amber: f.amber, runs_out_at: f.runs_out_at, first_refill: f.first_refill, below_notify, all_paused: f.all_paused, accounts: ranked.map((a) => ({ ...a, machines: Object.fromEntries(Object.entries(machines).map(([name, m]) => [name, !m.reachable ? 'unknown' : m.accounts[a.id] ? 'signed_in' : 'signed_out'])), reading: data.readings?.[a.id] || null })) };
  }
  return { providers, seen: data.seen || {} };
}
async function alert(hub) { const { providers, seen } = await summary(hub, false); return { dot: Object.entries(providers).some(([p, f]) => (f.amber || f.below_notify) && f.first_refill && seen[p] !== f.first_refill) }; }
async function seen(hub) { const { providers } = await summary(hub, false); await change(hub, (data) => { for (const [p, f] of Object.entries(providers)) if ((f.amber || f.below_notify) && f.first_refill) data.seen[p] = f.first_refill; }); return { ok: true }; }
module.exports = { effective, hasRoom, forecast, belowMargin, record, readings, lastChosen, recordChosen, machineAccounts, rank, summary, alert, seen };
