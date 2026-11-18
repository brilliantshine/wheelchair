'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { appError, atomicWrite, json } = require('./state.js');

const TAKING_BACK = 'An earlier cancelled import or undo is still being taken back; try again in a few minutes';
const revokePath = (hub) => path.join(hub.stateDir, 'revoke.json');
async function revokes(hub) {
  try { const value = JSON.parse(await fs.readFile(revokePath(hub), 'utf8')); return Array.isArray(value) ? value : []; } catch { return []; }
}
function revokeLock(hub, fn) { return hub.state.queued(revokePath(hub), fn); }
async function writeRevokes(hub, entries) { await atomicWrite(revokePath(hub), `${JSON.stringify(entries, null, 2)}\n`); }
function operation(kind, parent, file) {
  return { kind, carried: file ? { stage: file.stage, exported_at: file.exported_at, history: file.history, pr_url: file.pr_url || null } : null, parent, claim_sha: null, last_error: null, claim_landed: false, applied: false, started_at: new Date().toISOString() };
}
function request(hub, thread, action, fields = {}) {
  return hub.client.handoff(thread.machine, { action, thread_id: thread.id, project: thread.project, ...fields });
}
async function checked(hub, thread, action, fields) {
  const result = await request(hub, thread, action, fields);
  if (result.result === 'failed') throw new Error(result.error || `Couldn't ${action}`);
  return result;
}
async function preclaim(hub, thread, op) {
  const branch = `wc/${thread.id}`;
  const inspect = await checked(hub, thread, 'inspect', { branch, head: op.parent, slug: thread.slug, ...(thread.worktree ? { worktree: thread.worktree } : {}) });
  if (inspect.worktree_exists) {
    const status = await checked(hub, thread, 'status', { worktree: thread.worktree, slug: thread.slug });
    if (status.branch !== branch) throw new Error("The thread here isn't on its branch");
    if (status.dirty) throw new Error('The thread here has uncommitted changes');
    if (!['same', 'ahead'].includes(inspect.relation)) throw new Error("The thread here has commits that aren't in the file");
  } else {
    const known = await checked(hub, thread, 'known', { head: op.parent });
    if (known.checked_out?.length) throw new Error(`Branch ${branch} is checked out in ${known.checked_out[0]}; switch away from it, then try again`);
    if (known.local_branch && !known.local_ancestor) throw new Error(`This project already has a branch ${branch} that differs from the file; delete it if you don't need it, then try again`);
  }
}
async function abandon(hub, thread) {
  if (thread.handoff_op.kind === 'create') await fs.unlink(hub.threadPath(thread.id)).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  else { delete thread.handoff_op; await hub.save(thread); }
}
async function claim(hub, thread, reimport) {
  const op = thread.handoff_op;
  await preclaim(hub, thread, op);
  if (!op.claim_sha) {
    const message = `handoff: ${op.kind === 'undo' ? 'taken back' : 'picked up'} ${new Date().toISOString()} ${crypto.randomBytes(4).toString('hex')}`;
    const result = await checked(hub, thread, 'claim-commit', { parent: op.parent, message });
    op.claim_sha = result.sha; await hub.save(thread);
  }
  const result = await request(hub, thread, 'claim-push', { branch: `wc/${thread.id}`, parent: op.parent, sha: op.claim_sha });
  if (result.result === 'landed') { op.claim_landed = true; op.last_error = null; await hub.save(thread); return; }
  if (result.result === 'moved') {
    const own = (await revokes(hub)).find((entry) => entry.thread_id === thread.id && entry.sha === result.remote_tip);
    if (own) { setImmediate(() => sweepEntry(hub, own).catch(() => {})); throw new Error(TAKING_BACK); }
    const text = op.kind === 'undo' ? `This was picked up elsewhere on ${result.picked_up_at}; import a newer file to continue here` : `This was already picked up elsewhere on ${result.picked_up_at}; ${reimport ? 'import that file again' : 'export again from wherever it is now'}`;
    await abandon(hub, thread); throw appError(409, text);
  }
  throw new Error(`Couldn't update the branch on GitHub: ${result.error || 'unknown error'}`);
}

module.exports = { operation, preclaim, claim, abandon, revokes, revokeLock, writeRevokes, request, checked, TAKING_BACK };
