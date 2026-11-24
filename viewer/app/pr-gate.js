'use strict';

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);
const unavailable = "couldn't reach GitHub to check the pull request; try again in a minute";

function judgePr(view, thread, card) {
  const refuse = (reason) => ({ ok: false, reason });
  const branch = thread.target_pr && card.pr_url === thread.target_pr.url ? thread.target_pr.head_branch : thread.branch;
  if (branch && view.headRefName !== branch) return refuse(`that pull request is not this thread's (its branch is ${view.headRefName})`);
  if (thread.default_branch && view.baseRefName !== thread.default_branch) return refuse(`that pull request targets ${view.baseRefName}`);
  if (view.headRefOid !== card.head) return refuse(`the pull request is at ${String(view.headRefOid).slice(0, 7)}, not ${card.head.slice(0, 7)}`);
  if (view.state === 'MERGED') return { ok: true };
  if (view.state !== 'OPEN') return refuse('the pull request is closed');
  const checks = (view.statusCheckRollup || []).map((check) => {
    let result;
    if (check.__typename === 'CheckRun') {
      result = check.status !== 'COMPLETED' ? 'running' : !['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(check.conclusion) ? 'failed' : null;
    } else if (check.__typename === 'StatusContext') {
      result = ['FAILURE', 'ERROR'].includes(check.state) ? 'failed' : ['PENDING', 'EXPECTED'].includes(check.state) ? 'running' : null;
    }
    return result ? `${check.name || check.context}: ${result}` : null;
  }).filter(Boolean);
  if (['CLEAN', 'HAS_HOOKS'].includes(view.mergeStateStatus) || (view.mergeStateStatus === 'BLOCKED' && !checks.length)) return { ok: true };
  if (view.mergeStateStatus === 'DIRTY') return refuse(`the pull request conflicts with ${view.baseRefName}`);
  if (view.mergeStateStatus === 'BEHIND') return refuse(`${view.baseRefName} moved on and must be merged in`);
  if (['UNSTABLE', 'BLOCKED'].includes(view.mergeStateStatus)) return refuse(`checks not passed yet: ${checks.slice(0, 5).join(', ')}`);
  return refuse('GitHub is still working out whether it can merge; try again in a minute');
}

async function checkPr(thread, card) {
  if (!/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+$/.test(card.pr_url)) return { ok: false, reason: 'the pull request link is not a GitHub pull request' };
  let view;
  try {
    const result = await execFileAsync('gh', ['pr', 'view', card.pr_url, '--json', 'state,mergeStateStatus,headRefName,baseRefName,headRefOid,statusCheckRollup'], { timeout: 15000 });
    view = JSON.parse(result.stdout);
    if (!view || typeof view !== 'object' || Array.isArray(view)) throw new Error('invalid response');
  } catch (error) {
    const stderr = String(error.stderr || '');
    if (/authentication|gh auth login|HTTP 401|HTTP 403|HTTP 404|Could not resolve to/i.test(stderr)) return { ok: false, reason: `the app's GitHub login can't read this pull request: ${stderr.split(/\r?\n/)[0]}` };
    return { ok: false, reason: unavailable };
  }
  return judgePr(view, thread, card);
}

module.exports = { checkPr, judgePr };
