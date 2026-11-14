'use strict';

// Spec lifecycle step 6: the hub, not the lead, owns the machine readiness gate.
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

async function hubVersion(root) {
  try {
    return (await execFileAsync('git', ['-C', root, 'rev-parse', 'HEAD'])).stdout.trim();
  } catch {
    return '';
  }
}

function missing(machine, text) {
  return `${machine}: ${text}`;
}

async function check(hub, thread) {
  const absent = [];
  let status;
  try {
    status = await hub.call(thread.machine, '/v1/status', 'GET');
  } catch {
    return { ok: false, missing: [missing(thread.machine, 'service down')] };
  }

  const expected = await hubVersion(hub.root);
  if (!expected || status.version !== expected) absent.push(missing(thread.machine, 'service out of date'));
  const cli = status[thread.cli] || {};
  if (!cli.installed) absent.push(missing(thread.machine, `${thread.cli} is not installed`));
  else if (!cli.logged_in) absent.push(missing(thread.machine, `${thread.cli} is not logged in`));
  if (thread.cli === 'codex' && cli.installed && cli.logged_in) {
    try {
      await hub.call(thread.machine, '/v1/preflight', 'POST', {});
    } catch {
      absent.push(missing(thread.machine, 'Codex preflight failed'));
    }
  }
  return { ok: absent.length === 0, missing: absent };
}

function same(left, right) {
  return Boolean(left) === Boolean(right)
    && JSON.stringify(left?.missing || []) === JSON.stringify(right?.missing || []);
}

module.exports = { check, same };
