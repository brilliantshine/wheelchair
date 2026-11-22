'use strict';

const { appError } = require('./state.js');
const { checkProject } = require('./threads.js');
const { validateHandoffFile, quietReason } = require('./handoff.js');
const ops = require('./handoff-ops.js');

async function importHandoff(hub, bytes, machine, project) {
  if (!project) throw appError(400, 'project is required');
  const checked = await checkProject(hub, machine, project);
  if (!checked.ok) throw appError(400, `${checked.path || project} ${checked.reason || 'is not usable'} on ${machine}`);
  project = checked.path;
  const validation = validateHandoffFile(bytes);
  if (!validation.ok) throw appError(422, `This isn't a handoff file wheelchair can read: ${validation.what}`);
  const file = validation.file, id = file.thread.id;
  let revoke;
  let result;
  try {
    result = await hub.withThread(id, async () => {
      const lockedValidation = validateHandoffFile(bytes);
      if (!lockedValidation.ok) throw appError(422, `This isn't a handoff file wheelchair can read: ${lockedValidation.what}`);
      let thread;
      try { thread = await hub.thread(id); } catch (error) { if (error.status !== 404) throw error; }
      const prefix = thread && (thread.machine !== machine || thread.project !== project) ? `This thread lives on ${thread.machine}, ${thread.project}` : '';
      const note = (value) => [prefix, value].filter(Boolean).join(' ');
      if (thread?.handoff_op) {
        if (thread.handoff_op.kind === 'undo') return { outcome: 'opened', id, note: note("An undo of this thread didn't finish; press Retry on it, then import this file again") };
        const kind = thread.handoff_op.kind;
        const saved = await ops.runLocked(hub, thread, true);
        if (kind === 'create') await hub.state.addProject(thread.project);
        saved.note = note(saved.note); return saved;
      }
      const targetMachine = thread?.machine || machine, targetProject = thread?.project || project;
      const call = (action, extra = {}) => hub.client.handoff(targetMachine, { action, thread_id: id, project: targetProject, ...extra });
      const inspect = await call('inspect', { branch: file.branch, head: file.head, slug: file.thread.slug, ...(thread?.worktree ? { worktree: thread.worktree } : {}), ...(thread?.handed_off?.head ? { fallback_head: thread.handed_off.head } : {}) });
      if (inspect.result === 'failed') throw appError(409, inspect.error);
      if (!inspect.repository) throw appError(422, "That project's origin isn't on GitHub");
      if (inspect.repository !== file.repository) throw appError(422, `This file is for ${file.repository}, but that project is ${inspect.repository}`);
      if (!inspect.remote_has_branch || !inspect.remote_contains_head) throw appError(409, "The branch on GitHub doesn't have the exported work");
      const stageOk = file.stage === 'idea-confirmed' ? inspect.idea_status === 'confirmed' && inspect.map_committed && [null, 'planning'].includes(inspect.plan_status) : inspect.plan_status === file.stage;
      if (!stageOk) throw appError(422, `The file says ${file.stage}, but the branch doesn't`);
      const own = (await ops.revokes(hub)).find((entry) => entry.thread_id === id && entry.sha === inspect.remote_tip);
      if (!thread) {
        const known = await call('known', { head: file.head });
        if (known.result === 'failed') throw appError(409, known.error);
        if (known.known) throw appError(409, 'This machine already has this thread from another wheelchair app; import it on another machine');
        if (known.checked_out?.length) throw appError(409, `Branch ${file.branch} is checked out in ${known.checked_out[0]}; switch away from it, then import again`);
        if (known.local_branch && !known.local_ancestor) throw appError(409, `This project already has a branch ${file.branch} that differs from the file; delete it if you don't need it, then import again`);
      } else if (inspect.relation !== 'ahead') {
        let message = inspect.relation === null ? 'This thread here has no checkout to compare with, so nothing was changed.' : inspect.relation === 'behind' ? 'This file is older than the thread here' : inspect.relation === 'diverged' ? 'This thread and the file have each moved on separately, so nothing was changed. Bring the branches together yourself, then import again.' : 'You already have this thread here';
        if (inspect.relation === 'same') {
          if (own) message += ' An earlier cancelled import or undo is still being taken back; try again in a few minutes.';
          else if (thread.handed_off && inspect.remote_tip === thread.handed_off.head) message += " It's handed off: press Undo on it to carry on here.";
        }
        return { outcome: 'opened', id, note: note(message) };
      }
      if (inspect.remote_tip !== file.head) {
        if (own) { revoke = own; throw appError(409, ops.TAKING_BACK); }
        throw appError(409, `This was already picked up elsewhere on ${inspect.picked_up_at}; export again from wherever it is now`);
      }
      if (thread) {
        if (quietReason(hub, thread)) throw appError(409, 'The thread here is busy');
        const advanced = await ops.advanceLocked(hub, thread, file, { lessons: file.lessons?.map((item) => item && typeof item === 'object' && !Array.isArray(item) ? { ...item, thread: id } : item), targetProject });
        if (prefix) advanced.note = prefix;
        return advanced;
      }
      const created = await ops.createLocked(hub, { file, machine, project, lessons: file.lessons?.map((item) => item && typeof item === 'object' && !Array.isArray(item) ? { ...item, thread: id } : item) });
      await hub.state.addProject(project);
      return created;
    });
  } finally {
    if (revoke) setImmediate(() => ops.sweepEntry(hub, revoke).catch(() => {}));
  }
  if (['created', 'advanced'].includes(result.outcome)) await hub.restartLead(id).catch(() => {});
  return result;
}
module.exports = { importHandoff };
