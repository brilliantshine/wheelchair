'use strict';

const { PROVIDERS, providerOf } = require('./providers.js');
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
  let status;
  try {
    status = await hub.call(thread.machine, '/v1/status', 'GET');
  } catch {
    return { ok: false, missing: [missing(thread.machine, 'service down')] };
  }

  if (await outOfDate(hub, status)) absent.push(missing(thread.machine, 'service out of date'));
  // The thread's own family is required. The other family, when installed, serves the cross-family
  // reviewers and verifier, so it has to be logged in too; absent, the thread just runs on one family.
  const other = Object.values(PROVIDERS).map((p) => p.cli).find((cli) => cli !== thread.cli);
  const accounts = hub.state ? (await settings.load(hub)).accounts : settings.defaults().accounts;
  let preflight = null;
  for (const cli of [thread.cli, other]) {
    const provider = PROVIDERS[providerOf(cli)];
    const state = status[cli] || {};
    if (!state.installed) {
      if (cli === thread.cli) absent.push(missing(thread.machine, `${cli} is not installed`));
      continue;
    }
    let loggedIn = Array.isArray(status.accounts)
      ? accounts.some((account) => account.provider === providerOf(cli) && !account.paused && status.accounts.some((entry) => entry.id === account.id && entry.cli === cli && entry.logged_in))
      : Boolean(state.logged_in);
    if (provider?.preflight && !Array.isArray(status.accounts)) {
      preflight ??= await preflightFailed(hub, thread.machine);
      loggedIn = !preflight;
    }
    if (!loggedIn) absent.push(missing(thread.machine, !Array.isArray(status.accounts) && provider?.preflight ? 'Codex preflight failed' : `${provider?.label || cli} is not logged in`));
  }
  return { ok: absent.length === 0, missing: absent };
}

function same(left, right) {
  return Boolean(left) === Boolean(right)
    && JSON.stringify(left?.missing || []) === JSON.stringify(right?.missing || []);
}

module.exports = { check, outOfDate, same };
