'use strict';

const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const { judgePr } = require('./pr-gate.js');
const { currentDone, addCard } = require('./cards.js');
const settings = require('./settings.js');
const { special } = require('./assistant.js');
const timing = { retryMs: 20000, waitMs: 120000, mergeTimeoutMs: 60000 };
const runs = new Set();
const unavailable = "couldn't reach GitHub to check the pull request; try again in a minute";

function notice(thread, head, reason, outcome) {
  const sentence = reason ? reason.charAt(0).toUpperCase() + reason.slice(1).replace(/[.!?]+$/, '') + '.' : '';
  const body = outcome === 'unknown' ? "GitHub didn't answer in time; check the pull request on GitHub." : `${sentence} The pull request is still open; you can merge it on GitHub.`;
  return addCard(thread, { kind: 'needs', title: 'Not merged automatically', body, auto_merge: true, auto_merge_head: head }, { system: true });
}

async function attempt(hub, threadId, checkCardId) {
  let context;
  await hub.withThread(threadId, async () => {
    const thread = await hub.thread(threadId);
    // Gates 1–4: silently stop when the setting, head, attempt or check disallows it.
    if (special(thread) || (await settings.load(hub)).auto_merge !== 'on') return;
    const check = thread.cards.find(c => c.id === checkCardId && c.kind === 'check');
    const done = currentDone(thread);
    if (!check || !done || check.head !== done.head) return;
    if (thread.target_pr && done.pr_url === thread.target_pr.url) return;
    const head = done.head;
    if (thread.auto_merge_attempts?.[head]) return;
    if (check.steps.some(s => s.agent === 'broken')) return;
    // Gates 5–7: retain a reason for a held attempt and notify in the same save.
    let reason;
    if (thread.imported) reason = "this thread was handed over from another machine, so its earlier checks can't be confirmed";
    else if (thread.cards.some(c => c.kind === 'done' && c.verified !== true)) reason = 'not every change in this pull request has a recorded passing check';
    else if (!check.steps.some(s => s.agent === 'matched')) reason = 'no agent could try any of the Check it yourself steps';
    thread.auto_merge_attempts ||= {};
    const at = new Date().toISOString();
    if (reason) {
      const record = thread.auto_merge_attempts[head] = { at, outcome: 'held', reason };
      if (!thread.cards.some(c => c.kind === 'merged' && c.pr_url === done.pr_url)) record.card = notice(thread, head, reason, 'held').id;
    } else {
      thread.auto_merge_attempts[head] = { at, outcome: 'started' };
      context = { thread, done, head, url: done.pr_url };
    }
    await hub.save(thread);
  });
  if (!context) return;
  const { thread, done, head, url } = context;
  let outcome, reason, branch, branchDeleted;
  const match = /^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)$/.exec(url);
  if (!match) { outcome = 'not-ready'; reason = 'the pull request link is not a GitHub pull request'; }
  // Step 8: check GitHub until ready or the retry window expires.
  const start = Date.now();
  while (!outcome) {
    let view;
    try {
      const result = await run('gh', ['pr', 'view', url, '--json', 'state,mergeStateStatus,headRefName,baseRefName,headRefOid,statusCheckRollup,isCrossRepository,headRepository,headRepositoryOwner'], { timeout: 15000 });
      view = JSON.parse(result.stdout);
      if (!view || typeof view !== 'object' || Array.isArray(view)) throw new Error('invalid response');
    } catch { reason = unavailable; }
    if (view) {
      if (view.state === 'MERGED') { outcome = 'already-merged'; break; }
      if (view.state === 'CLOSED') { outcome = 'closed'; break; }
      // The branch lives in the head repository: the base one, or a fork's when the pull request crosses repositories.
      const owner = view.isCrossRepository === true ? view.headRepositoryOwner?.login : view.isCrossRepository === false ? match[1] : undefined;
      const repo = view.isCrossRepository === true ? view.headRepository?.name : view.isCrossRepository === false ? match[2] : undefined;
      branch = typeof owner === 'string' && owner && typeof repo === 'string' && repo && typeof view.headRefName === 'string' && view.headRefName ? { owner, repo, name: view.headRefName } : undefined;
      const judged = judgePr(view, thread, done);
      if (judged.ok) {
        if (!['CLEAN', 'HAS_HOOKS'].includes(view.mergeStateStatus)) { outcome = 'not-ready'; reason = 'GitHub needs something before it can merge, such as a review'; }
        break;
      }
      reason = judged.reason;
      if (!reason.startsWith('GitHub is still working out')) { outcome = 'not-ready'; break; }
    }
    const remaining = timing.waitMs - (Date.now() - start);
    if (remaining <= 0) { outcome = 'not-ready'; break; }
    await new Promise(resolve => setTimeout(resolve, Math.min(timing.retryMs, remaining)));
  }
  // Step 9: honor a switch changed during the readiness wait.
  if (!outcome && (await settings.load(hub)).auto_merge !== 'on') outcome = 'switched-off';
  // Step 10: GitHub atomically checks the exact head and merges immediately.
  if (!outcome) {
    let stdout = '', stderr = '', error;
    try { ({ stdout, stderr } = await run('gh', ['api', '-X', 'PUT', `repos/${match[1]}/${match[2]}/pulls/${match[3]}/merge`, '-f', `sha=${head}`, '-f', 'merge_method=merge'], { timeout: timing.mergeTimeoutMs })); }
    catch (e) { error = e; stdout = e.stdout || ''; stderr = e.stderr || ''; }
    let response; try { response = JSON.parse(stdout); } catch {}
    if (error?.killed) outcome = 'unknown';
    else if (!error && response?.merged === true) outcome = 'merged';
    else { outcome = 'failed'; reason = response?.message || String(stderr).split(/\r?\n/).find(line => line.trim()) || 'GitHub refused the merge'; }
  }
  // Optional: delete the merged head branch on GitHub. A failure (for example GitHub already deleted it) is only recorded.
  // Skipped when GitHub did not say which repository holds the branch.
  if (outcome === 'merged' && branch && (await settings.load(hub)).auto_merge_delete_branch === 'on') {
    try { await run('gh', ['api', '-X', 'DELETE', `repos/${encodeURIComponent(branch.owner)}/${encodeURIComponent(branch.repo)}/git/refs/heads/${branch.name.split('/').map(encodeURIComponent).join('/')}`], { timeout: 15000 }); branchDeleted = true; }
    catch { branchDeleted = false; }
  }
  // Finishing: reload so a concurrent writer's cards survive.
  await hub.withThread(threadId, async () => {
    const fresh = await hub.thread(threadId);
    const record = fresh.auto_merge_attempts[head] = { ...fresh.auto_merge_attempts[head], at: new Date().toISOString(), outcome, reason, ...(branchDeleted === undefined ? {} : { branch_deleted: branchDeleted }) };
    const latest = currentDone(fresh);
    if (['not-ready', 'failed', 'unknown'].includes(outcome) && !fresh.cards.some(c => c.kind === 'merged' && c.pr_url === url) && (!latest || latest.head === head)) record.card = notice(fresh, head, reason, outcome).id;
    await hub.save(fresh);
  });
}

function afterCheck(hub, threadId, checkCardId) {
  const promise = attempt(hub, threadId, checkCardId).catch(error => console.error('auto-merge:', error)).finally(() => runs.delete(promise));
  runs.add(promise);
}
async function settled() { while (runs.size) await Promise.all([...runs]); }
module.exports = { afterCheck, settled, timing };
