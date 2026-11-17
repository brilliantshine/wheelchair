'use strict';

const settings = require('./settings.js');
const usage = require('./usage.js');
const sessions = require('./sessions.js');
const { PROVIDERS } = require('./providers.js');
const INTERVAL = 9 * 60_000;

function live(threads, id) {
  return threads.some((thread) => thread.sessions?.some((session) => session.live && session.account === id));
}

async function pollIdle(hub) {
  const [initial, readings] = await Promise.all([settings.load(hub), usage.readings(hub)]);
  const attempts = hub.usageAttempts ||= new Map();
  const now = Date.now();
  const candidates = initial.accounts.filter((a) => ['claude', 'gpt'].includes(a.provider) && !a.paused &&
    (!readings[a.id] || now - Date.parse(readings[a.id].at) >= INTERVAL) &&
    (!attempts.has(a.id) || now - attempts.get(a.id) >= INTERVAL));
  let recorded = false;
  for (const candidate of candidates) {
    const [current, threads, states, machines] = await Promise.all([
      settings.load(hub), hub.allThreads(), usage.machineAccounts(hub), hub.machines(),
    ]);
    const account = current.accounts.find((a) => a.id === candidate.id);
    if (!account || !['claude', 'gpt'].includes(account.provider) || account.paused || live(threads, account.id)) continue;
    const local = await hub.state.resolveMachine(machines, 'hub');
    const localName = Object.entries(machines).find(([, m]) => local && (m.name === local.name || (m.address === local.address && m.port === local.port)))?.[0] || 'hub';
    const eligible = Object.keys(states).filter((name) => states[name].reachable && states[name].accounts[account.id]).sort();
    const machine = eligible.includes(localName) ? localName : eligible[0];
    if (!machine) continue;
    const started = new Date().toISOString();
    attempts.set(account.id, Date.parse(started));
    try {
      const { reading } = await hub.call(machine, '/v1/usage', 'POST', {
        account: account.id, cli: PROVIDERS[account.provider].cli,
        dir: account.id === `default-${account.provider}` ? null : `~/.wheelchair/accounts/${account.id}`,
      }, 35000);
      const [after, afterThreads] = await Promise.all([settings.load(hub), hub.allThreads()]);
      if (!after.accounts.some((a) => a.id === account.id) || live(afterThreads, account.id)) continue;
      await usage.record(hub, { ...reading, at: started, machine });
      recorded = true;
    } catch { /* A failed probe leaves the previous reading in place. */ }
  }
  if (recorded) await sessions.retryWaiting(hub);
}

module.exports = { pollIdle };
