'use strict';

const { PROVIDERS, DISPLAY_NAMES, providerOf } = require('./providers.js');
const settings = require('./settings.js');

// Spec lifecycle step 6: the hub, not the lead, owns the machine readiness gate.
function missing(machine, text) {
  return `${machine}: ${text}`;
}

// The one comparison of a machine service's commit with the hub's. An unknown hub version
// counts as out of date, so the gate fails closed.
async function outOfDate(hub, status) {
  const expected = hub.codeVersion;
  return !expected || status.version !== expected;
}

// Codex's login is what `codex/preflight.sh` (the service's /v1/preflight) says; the service has
// no Claude preflight, so Claude's comes from the status's login flag.
async function preflightFailed(hub, machine) {
  try {
    await hub.call(machine, '/v1/preflight', 'POST', {});
    return false;
  } catch {
    return true;
  }
}

async function check(hub, thread) {
  const absent = [];
  const ownProvider = thread.provider || providerOf(thread.cli);
  if (hub.state && ownProvider && !(await settings.load(hub)).harnesses[ownProvider]) return { ok: false, missing: [`${DISPLAY_NAMES[ownProvider]} is left out in Settings`] };
  let status;
  try {
    status = await hub.call(thread.machine, '/v1/status', 'GET');
  } catch {
    return { ok: false, missing: [missing(thread.machine, 'service down')] };
  }

  if (await outOfDate(hub, status)) absent.push(missing(thread.machine, 'service out of date'));
  // Only the thread's own CLI is checked for installation and login.
  const accounts = hub.state ? (await settings.load(hub)).accounts : settings.defaults().accounts;
  let preflight = null;
  for (const cli of [thread.cli]) {
    const provider = PROVIDERS[providerOf(cli)];
    const state = status[cli] || {};
    if (!state.installed) {
      if (cli === thread.cli) absent.push(missing(thread.machine, `${cli} is not installed`));
      continue;
    }
    if (state.problem) {
      absent.push(missing(thread.machine, state.problem));
      continue;
    }
    let loggedIn = Array.isArray(status.accounts)
      ? accounts.some((account) => account.provider === providerOf(cli) && !account.paused && status.accounts.some((entry) => entry.id === account.id && entry.cli === cli && entry.logged_in))
      : Boolean(state.logged_in);
    if (provider?.preflight && !Array.isArray(status.accounts)) {
      preflight ??= await preflightFailed(hub, thread.machine);
      loggedIn = !preflight;
    }
    if (!loggedIn) {
      let line = !Array.isArray(status.accounts) && provider?.preflight ? 'Codex preflight failed' : `${provider?.label || cli} is not logged in`;
      if (Array.isArray(status.accounts)) {
        for (const account of accounts) {
          if (account.provider !== providerOf(cli) || account.paused) continue;
          const entry = status.accounts.find((item) => item.id === account.id && item.cli === cli);
          if (entry?.problem) { line = `${account.name}: ${entry.problem}`; break; }
        }
      }
      absent.push(missing(thread.machine, line));
    }
  }
  return { ok: absent.length === 0, missing: absent };
}

function same(left, right) {
  return Boolean(left) === Boolean(right)
    && JSON.stringify(left?.missing || []) === JSON.stringify(right?.missing || []);
}

module.exports = { check, outOfDate, same };
