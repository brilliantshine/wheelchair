'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { appError, atomicWrite } = require('./state.js');

const TAKING_BACK = 'An earlier cancelled import or undo is still being taken back; try again in a few minutes';
const revokePath = (hub) => path.join(hub.stateDir, 'revoke.json');
async function revokes(hub) {
  try { const value = JSON.parse(await fs.readFile(revokePath(hub), 'utf8')); return Array.isArray(value) ? value : []; } catch { return []; }
}
function revokeLock(hub, fn) { return hub.state.queued(revokePath(hub), fn); }
async function writeRevokes(hub, entries) { await atomicWrite(revokePath(hub), `${JSON.stringify(entries, null, 2)}\n`); }
function operation(kind, parent, file) {
  return { kind, repository: file?.repository || null, carried: file ? { stage: file.stage, exported_at: file.exported_at, history: file.history, pr_url: file.pr_url || null } : null, parent, claim_sha: null, last_error: null, claim_landed: false, applied: false, started_at: new Date().toISOString() };
}
function request(hub, thread, action, fields = {}) {
  return hub.client.handoff(thread.machine, { action, thread_id: thread.id, project: thread.project, ...fields });
}
async function checked(hub, thread, action, fields) {
  const result = await request(hub, thread, action, fields);
  if (result.result === 'failed') throw new Error(result.error || `Couldn't ${action}`);
  return result;
}
async function preclaim(hub, thread, parent) {
  const branch = `wc/${thread.id}`;
  const inspect = await checked(hub, thread, 'inspect', { branch, head: parent, slug: thread.slug, ...(thread.worktree ? { worktree: thread.worktree } : {}) });
  if (inspect.worktree_exists) {
    const status = await checked(hub, thread, 'status', { worktree: thread.worktree, slug: thread.slug });
    if (status.branch !== branch) throw new Error("The thread here isn't on its branch");
    if (status.dirty) throw new Error('The thread here has uncommitted changes');
    if (!['same', 'ahead'].includes(inspect.relation)) throw new Error("The thread here has commits that aren't in the file");
  } else {
    const known = await checked(hub, thread, 'known', { head: parent });
    if (known.checked_out?.length) throw new Error(`Branch ${branch} is checked out in ${known.checked_out[0]}; switch away from it, then try again`);
    if (known.local_branch && !known.local_ancestor) throw new Error(`This project already has a branch ${branch} that differs from the file; delete it if you don't need it, then try again`);
  }
  return inspect.repository || null;
}
async function firstPreclaim(hub, thread, parent) {
  try { return await preclaim(hub, thread, parent); }
  catch (error) { throw appError(409, error.message); }
}
async function abandon(hub, thread) {
  if (thread.handoff_op.kind === 'create') { await fs.unlink(hub.threadPath(thread.id)).catch((error) => { if (error.code !== 'ENOENT') throw error; }); delete thread.handoff_op; }
  else { delete thread.handoff_op; await hub.save(thread); }
}
async function claim(hub, thread, reimport, prechecked = false) {
  const op = thread.handoff_op;
  if (!prechecked) {
    const repository = await preclaim(hub, thread, op.parent);
    if (!op.repository && repository) { op.repository = repository; await hub.save(thread); }
  }
  if (!op.claim_sha) {
    const message = `handoff: ${op.kind === 'undo' ? 'taken back' : 'picked up'} ${new Date().toISOString()} ${crypto.randomBytes(4).toString('hex')}`;
    const result = await checked(hub, thread, 'claim-commit', { parent: op.parent, message });
    op.claim_sha = result.sha; await hub.save(thread);
  }
  let result;
  try { result = await request(hub, thread, 'claim-push', { branch: `wc/${thread.id}`, parent: op.parent, sha: op.claim_sha }); }
  catch (error) { result = { result: 'unknown', error: error.message }; }
  if (result.result === 'landed') { op.claim_landed = true; op.last_error = null; await hub.save(thread); return; }
  if (result.result === 'moved') {
    const own = (await revokes(hub)).find((entry) => entry.thread_id === thread.id && entry.sha === result.remote_tip);
    if (own) { setImmediate(() => sweepEntry(hub, own).catch(() => {})); throw new Error(TAKING_BACK); }
    const text = op.kind === 'undo' ? `This was picked up elsewhere on ${result.picked_up_at}; import a newer file to continue here` : `This was already picked up elsewhere on ${result.picked_up_at}; ${reimport ? 'import that file again' : 'export again from wherever it is now'}`;
    await abandon(hub, thread); throw appError(409, text);
  }
  throw new Error(`Couldn't update the branch on GitHub: ${result.error || 'unknown error'}`);
}

async function runLocked(hub, thread, reimport = false, prechecked = false) {
  const op = thread.handoff_op;
  if (!op) throw appError(409, 'No unfinished import or undo');
  hub.runningHandoffOps.add(thread.id);
  try {
    await revokeLock(hub, async () => {
      const entries = await revokes(hub);
      const keep = entries.filter((entry) => !(entry.thread_id === thread.id && entry.sha === op.claim_sha));
      if (keep.length !== entries.length) await writeRevokes(hub, keep);
    });
    if (!op.claim_landed) await claim(hub, thread, reimport, prechecked);
    if (!op.applied) {
      for (const session of thread.sessions || []) {
        if (!session.live) continue;
        try { await require('./sessions.js').stopManagedSession(hub, thread, session); }
        catch (error) {
          if (error.status !== 404 || error.message !== 'unknown managed session') throw error;
          session.live = false; session.status = 'stopped'; session.ended_at = new Date().toISOString(); await hub.save(thread);
        }
      }
      let running = await checked(hub, thread, 'running');
      if (running.names?.length) await checked(hub, thread, 'kill', { names: running.names });
      running = await checked(hub, thread, 'running');
      if (running.names?.length) throw new Error("Couldn't stop the agent working here");
      const branch = `wc/${thread.id}`;
      const inspect = await checked(hub, thread, 'inspect', { branch, head: op.claim_sha, slug: thread.slug, ...(thread.worktree ? { worktree: thread.worktree } : {}) });
      if (inspect.worktree_exists) await checked(hub, thread, 'fast-forward', { worktree: thread.worktree, branch, head: op.claim_sha });
      else { thread.worktree = null; await hub.save(thread); await checked(hub, thread, 'set-branch', { branch, sha: op.claim_sha }); }
      await checked(hub, thread, 'reopen');
      if (op.carried) thread.imported = { at: op.started_at, ...op.carried };
      if (op.kind === 'advance') {
        for (const card of thread.cards || []) require('./cards.js').retractCard(card, 'import', 'Replaced by an import');
        thread.pinned = {};
      }
      thread.handed_off = null; thread.archived = false; thread.checkout_sha = op.claim_sha; op.applied = true; op.last_error = null;
      await hub.save(thread);
    }
    delete thread.handoff_op; await hub.save(thread);
    await fs.unlink(path.join(hub.stateDir, 'handoffs', `${thread.id}.json`)).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    return { outcome: op.kind === 'create' ? 'created' : op.kind === 'advance' ? 'advanced' : 'undone', id: thread.id, ...(reimport ? { note: "Finished the earlier import; import this file again if it's newer" } : {}) };
  } catch (error) {
    if (thread.handoff_op) { thread.handoff_op.last_error = error.message; await hub.save(thread); }
    throw appError(409, error.message);
  } finally { hub.runningHandoffOps.delete(thread.id); }
}
async function runOperation(hub, id, { reimport = false } = {}) {
  const result = await hub.withThread(id, async () => runLocked(hub, await hub.thread(id), reimport));
  await hub.restartLead(id).catch(() => {});
  return result;
}
// The import route holds withThread across its decision and these helpers. The caller
// starts the lead after releasing that lock once the returned operation completed.
async function createLocked(hub, { file, machine, project }) {
  const id = file.thread.id, now = new Date().toISOString();
  const thread = { id, title: file.thread.title, slug: file.thread.slug, machine, project, branch: `wc/${id}`, stub: false, context: '', depends_on_parent: false, waiting_on_parent: false, sessions: [], cards: [], asides: [], pinned: {}, queues: {}, sent: [], archived: false, project_tools: require('./threads.js').defaultProjectTools(), created_at: now, updated_at: now };
  await firstPreclaim(hub, thread, file.head);
  thread.handoff_op = operation('create', file.head, file);
  await hub.save(thread);
  return runLocked(hub, thread, false, true);
}
async function advanceLocked(hub, thread, file) {
  await firstPreclaim(hub, thread, file.head);
  thread.handoff_op = operation('advance', file.head, file);
  await hub.save(thread);
  return runLocked(hub, thread, false, true);
}
async function startCreate(hub, input) {
  const result = await hub.withThread(input.file.thread.id, () => createLocked(hub, input));
  await hub.restartLead(result.id).catch(() => {}); return result;
}
async function startAdvance(hub, thread, file) {
  const result = await hub.withThread(thread.id, async () => advanceLocked(hub, await hub.thread(thread.id), file));
  await hub.restartLead(result.id).catch(() => {}); return result;
}
async function undo(hub, id) {
  const result = await hub.withThread(id, async () => {
    const thread = await hub.thread(id);
    if (thread.handoff_op) { if (thread.handoff_op.kind !== 'undo') throw appError(409, 'Retry the unfinished import first'); }
    else {
      if (!thread.handed_off) throw appError(409, 'This thread has not been handed off');
      const repository = await firstPreclaim(hub, thread, thread.handed_off.head);
      thread.handoff_op = operation('undo', thread.handed_off.head, null);
      thread.handoff_op.repository = repository; await hub.save(thread);
      return runLocked(hub, thread, false, true);
    }
    return runLocked(hub, thread);
  });
  await hub.restartLead(id).catch(() => {}); return result;
}
async function cancel(hub, id) {
  return hub.withThread(id, async () => {
    const thread = await hub.thread(id), op = thread.handoff_op;
    if (!op) throw appError(409, 'No unfinished import or undo');
    if (op.claim_landed) throw appError(409, 'The claim has already landed');
    if (op.claim_sha) await revokeLock(hub, async () => {
      const entries = await revokes(hub);
      entries.push({ thread_id: id, project: thread.project, machine: thread.machine, repository: op.repository || null, branch: `wc/${id}`, parent: op.parent, sha: op.claim_sha, until: new Date(Date.now() + 86400000).toISOString() });
      await writeRevokes(hub, entries);
    });
    await abandon(hub, thread); return { outcome: 'cancelled', id };
  });
}
async function sweepEntry(hub, target) {
  return hub.withThread(target.thread_id, () => revokeLock(hub, async () => {
    const entries = await revokes(hub), index = entries.findIndex((entry) => entry.thread_id === target.thread_id && entry.sha === target.sha);
    if (index < 0) return;
    const entry = entries[index];
    const thread = await hub.thread(entry.thread_id).catch((error) => { if (error.status === 404) return null; throw error; });
    if (thread?.handoff_op?.claim_sha === entry.sha || (entry.last_result !== 'failed' && Date.parse(entry.until) <= Date.now())) entries.splice(index, 1);
    else {
      let result;
      try { result = await hub.client.handoff(entry.machine, { action: 'claim-revoke', thread_id: entry.thread_id, project: entry.project, branch: entry.branch, parent: entry.parent, sha: entry.sha }); }
      catch (error) { result = { result: 'waiting', error: error.message }; }
      if (result.result === 'gone') entries.splice(index, 1);
      else { entry.last_result = result.result; if (result.error) entry.error = result.error; else if (result.result === 'failed') entry.error = 'unknown error'; else delete entry.error; if (result.result === 'revoked') entry.until = new Date(Date.now() + 86400000).toISOString(); }
    }
    await writeRevokes(hub, entries);
  }));
}
async function sweep(hub) { for (const entry of await revokes(hub)) await sweepEntry(hub, entry); }
function startSweep(hub) { sweep(hub).catch(() => {}); const timer = setInterval(() => sweep(hub).catch(() => {}), 600000); timer.unref(); }
async function dismiss(hub, target) {
  return hub.withThread(target.thread_id, () => revokeLock(hub, async () => {
    const entries = await revokes(hub); await writeRevokes(hub, entries.filter((entry) => !(entry.thread_id === target.thread_id && entry.sha === target.sha && entry.last_result === 'failed'))); return { ok: true };
  }));
}
module.exports = { operation, preclaim, claim, abandon, revokes, revokeLock, writeRevokes, request, checked, TAKING_BACK, runLocked, createLocked, advanceLocked, runOperation, startCreate, startAdvance, undo, cancel, sweepEntry, sweep, startSweep, dismiss };
