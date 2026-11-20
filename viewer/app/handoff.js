'use strict';

// The handoff is data, not a live card or session record.
const LIMIT = 10 * 1024 * 1024;
const KINDS = new Set(['message', 'press', 'offer', 'idea', 'question', 'reach', 'approval', 'progress', 'needs', 'done', 'check', 'diagram', 'image', 'stub', 'sudo', 'title', 'resolve', 'retract', 'result', 'merged']);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, required, optional = []) => object(value)
  && required.every((key) => Object.hasOwn(value, key))
  && Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
const iso = (value) => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value));

function validateHandoffFile(bytesOrString) {
  const bytes = Buffer.isBuffer(bytesOrString) ? bytesOrString : Buffer.from(typeof bytesOrString === 'string' ? bytesOrString : '');
  if (bytes.length > LIMIT) return { ok: false, what: 'file is over 10 MB' };
  let file;
  try { file = JSON.parse(bytes.toString('utf8')); } catch { return { ok: false, what: 'invalid JSON' }; }
  const fail = (what) => ({ ok: false, what });
  if (!keys(file, ['format', 'version', 'exported_at', 'thread', 'repository', 'branch', 'head', 'stage', 'history'], ['pr_url'])) return fail('invalid fields');
  if (file.format !== 'wheelchair-handoff' || ![1, 2].includes(file.version)) return fail('unknown format or version');
  if (!iso(file.exported_at)) return fail('invalid export time');
  if (!keys(file.thread, ['id', 'title', 'slug']) || typeof file.thread.id !== 'string' || !/^[0-9a-f]{12}$/.test(file.thread.id)
    || typeof file.thread.title !== 'string' || file.thread.title.length > 120 || typeof file.thread.slug !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(file.thread.slug)) return fail('invalid thread');
  if (typeof file.repository !== 'string' || !/^github\.com\/[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(file.repository)) return fail('invalid repository');
  if (file.branch !== `wc/${file.thread.id}`) return fail('invalid branch');
  if (typeof file.head !== 'string' || !/^[0-9a-f]{40}$/.test(file.head)) return fail('invalid head');
  if (!['idea-confirmed', 'approved', 'done'].includes(file.stage)) return fail('invalid stage');
  if (file.stage === 'done' ? typeof file.pr_url !== 'string' || !file.pr_url : Object.hasOwn(file, 'pr_url')) return fail('invalid pull request');
  if (!Array.isArray(file.history) || file.history.length > 2000 || !file.history.every((entry) => keys(entry, ['at', 'who', 'kind', 'text'])
    && iso(entry.at) && (file.version === 1 ? ['collin', 'lead', 'app'] : ['user', 'lead', 'app']).includes(entry.who) && KINDS.has(entry.kind)
    && typeof entry.text === 'string' && entry.text.length <= 20000)) return fail('invalid history');
  if (file.version === 1) for (const entry of file.history) if (entry.who === 'collin') entry.who = 'user';
  return { ok: true, file };
}

function historyText(card) {
  const answer = card.retracted_at ? 'withdrawn' : card.answered_value || card.resolved_note || card.answered_action || (card.answered ? 'answered' : '');
  const lines = (...items) => items.flat(Infinity).filter((item) => typeof item === 'string' && item.length).join('\n');
  switch (card.kind) {
    case 'reach': return lines(`Talk to ${card.target_title} (${String(card.target_project || '').split('/').filter(Boolean).at(-1) || ''})`, card.why, card.allow_failed ? `allow failed: ${card.allow_failed}` : (answer || 'withdrawn'));
    case 'question': return lines(card.question, (card.options || []).map((option) => option.label), answer || 'withdrawn');
    case 'idea': return lines((card.bullets || []).map((bullet) => bullet.text));
    case 'approval': return lines((card.objections || []).map((item) => lines(item.finding, item.reason)), answer);
    case 'done': return lines(card.title, card.can_do || [], card.left_as_is || [], card.pr_url);
    case 'check': return lines(card.update, (card.steps || []).map((step, i) => lines(`${i + 1}. [${step.where}] ${step.do} — see: ${step.see}`, step.command, step.agent === 'not-tried' ? `(not tried: ${step.note})` : step.agent === 'broken' ? `(didn't work: ${step.note})` : '')));
    case 'needs': return lines(card.title, card.body, card.items || []);
    case 'offer': return lines(card.summary, answer);
    case 'stub': case 'diagram': case 'image': return card.title || '';
    case 'sudo': return lines(card.command, card.state, card.exit_code === undefined ? '' : `exit ${card.exit_code}`, card.reason);
    default: return null;
  }
}

function handoffFileName(title) {
  const stem = String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
  return `${stem || 'thread'}.wheelchair.json`;
}

function buildHandoffFile(thread, { head, stage, repository, pr_url }) {
  const since = thread.imported?.at;
  const newer = (at) => !since || at > since;
  const history = (thread.imported?.history || []).map((entry) => ({ ...entry }));
  for (const sent of thread.sent || []) {
    if (['user', 'card'].includes(sent.source) && newer(sent.at)) history.push({ at: sent.at, who: 'user', kind: sent.source === 'card' ? 'press' : 'message', text: sent.text });
  }
  for (const card of thread.cards || []) {
    const at = card.created_at || card.at;
    if (card.replaced || !newer(at)) continue;
    const text = historyText(card);
    if (text !== null) history.push({ at, who: card.system ? 'app' : 'lead', kind: card.kind, text });
  }
  history.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  for (const entry of history) if (typeof entry.text === 'string' && entry.text.length > 20000) entry.text = `${entry.text.slice(0, 19990)}… (cut)`;
  const file = { format: 'wheelchair-handoff', version: 2, exported_at: new Date().toISOString(), thread: { id: thread.id, title: thread.title || '', slug: thread.slug }, repository, branch: `wc/${thread.id}`, head, stage, ...(stage === 'done' ? { pr_url } : {}), history };
  let dropped = 0;
  let size = Buffer.byteLength(JSON.stringify(file));
  const omission = () => ({ at: history[0].at, who: 'app', kind: 'message', text: `${dropped} earlier entries were left out` });
  while (history.length && (history.length + (dropped ? 1 : 0) > 2000
    || size + (dropped ? Buffer.byteLength(JSON.stringify(omission())) + 1 : 0) > LIMIT)) {
    const removed = history.shift();
    size -= Buffer.byteLength(JSON.stringify(removed)) + (history.length ? 1 : 0);
    dropped++;
  }
  if (dropped && history.length) history.unshift(omission());
  return file;
}

const NOT_POINT = 'Not at a stopping point: export after the idea is confirmed, once the plan is approved, or when it’s done'.replace('it’s', "it's");
function unfinished(hub, thread) { return Boolean(thread.handoff_op && !hub.runningHandoffOps?.has(thread.id)); }
function frozen(hub, thread) { return Boolean(thread.handed_off || unfinished(hub, thread)); }
function refuseFrozen(hub, thread) {
  if (unfinished(hub, thread)) throw require('./state.js').appError(409, 'Retry the unfinished import first');
  if (thread.handed_off) throw require('./state.js').appError(409, 'handed off');
}
function quietReason(hub, thread) {
  const sessions = thread.sessions || [];
  if (sessions.some((s) => s.role !== 'lead' && s.live) || (thread.asides || []).some((aside) => aside.status === 'open' || aside.turn)) return 'Agents are still working';
  if (sessions.some((s) => (s.role === 'lead' && s.live && s.turn_ended !== true)
    || ((s.live || s.status === 'pending' || s.role === 'lead') && (s.queue || thread.queues?.[s.name] || []).length))) return 'The lead is busy';
  if ((thread.cards || []).some((card) => card.kind === 'sudo' && ['waiting', 'running'].includes(card.state))) return 'A root command is waiting';
  if ((thread.cards || []).some((card) => card.kind === 'reach' && !card.answered && !card.retracted_at)) return 'A request to talk to another project is waiting';
  if ((hub.uploadsInFlight?.get(thread.id) || 0) > 0) return 'A file is still uploading';
  return null;
}
function answerAt(card, thread) {
  if (card.retracted_at || !card.answered) return null;
  const sent = (thread.sent || []).filter((item) => item.source === 'card' && item.text?.startsWith(`[card ${card.id}] `)).at(-1);
  return sent?.at || card.resolved_at || card.at || card.created_at;
}
function donePr(thread, { includeReplaced = false, valid = (url) => Boolean(url) } = {}) {
  return [...(thread.cards || [])].reverse().find((card) => card.kind === 'done' && (includeReplaced && !thread.imported || !card.replaced) && valid(card.pr_url) && (!thread.imported || Date.parse(card.created_at || card.at) > Date.parse(thread.imported.at)))?.pr_url || thread.imported?.pr_url || null;
}
function stageFor(thread, status) {
  const cards = thread.cards || [];
  if (status.plan_status === 'approved' && !cards.some((c) => c.kind === 'approval' && !c.retracted_at && c.answered_action === 'start-building')) return 'approved';
  if (status.plan_status === 'done' && donePr(thread)) return 'done';
  if (status.idea_status !== 'confirmed' || !status.map_committed || ![null, undefined, 'planning'].includes(status.plan_status)) return null;
  const questions = cards.filter((card) => card.kind === 'question' && answerAt(card, thread));
  const anchor = questions.filter((card) => card.doc === 'IDEA.md').map((card) => answerAt(card, thread)).sort().at(-1) || thread.imported?.at;
  if (questions.some((card) => !anchor || answerAt(card, thread) > anchor)) return null;
  return 'idea-confirmed';
}
function exportReason(hub, thread, status, { pressed = false } = {}) {
  if (thread.archived) return "Archived threads can't be exported";
  if (thread.handed_off) return 'Already handed off';
  if (unfinished(hub, thread)) return "An import or undo didn't finish";
  if ((thread.cards || []).some((card) => card.kind === 'merged') || (pressed && status && stageFor(thread, status) === 'done' && status.pr_state != null && status.pr_state !== 'OPEN')) return 'The pull request is merged or closed; nothing left to hand off';
  if (pressed && status && stageFor(thread, status) === 'done' && (status.pr_error || status.pr_state == null)) return "Couldn't check the pull request";
  if (status && !status.repository) return "This project's origin isn't on GitHub";
  const quiet = quietReason(hub, thread);
  if (quiet) return quiet;
  if (status?.dirty) return "Some changes aren't committed yet";
  if (pressed && status && stageFor(thread, status) === 'done' && status.head !== status.remote_tip) return 'A fix is still being checked';
  if (!status || status.branch !== `wc/${thread.id}` || !stageFor(thread, status)) return NOT_POINT;
  return null;
}
async function exportThread(hub, id) {
  const fs = require('node:fs/promises');
  const path = require('node:path');
  const { appError } = require('./state.js');
  return hub.withThread(id, async () => {
    let thread = await hub.thread(id);
    let status;
    try {
      const pr_url = donePr(thread);
      status = await hub.client.handoff(thread.machine, { action: 'status', thread_id: id, project: thread.project, worktree: thread.worktree, slug: thread.slug, ...(pr_url ? { pr_url } : {}) });
      if (status.result === 'failed') throw new Error(status.error);
      hub.handoffStatus.set(id, status);
    } catch (error) { throw appError(409, error.message || 'Could not check the worktree'); }
    const reason = exportReason(hub, thread, status, { pressed: true });
    if (reason) throw appError(409, reason);
    const stage = stageFor(thread, status);
    const pr_url = donePr(thread);
    const file = buildHandoffFile(thread, { head: status.head, stage, repository: status.repository, pr_url });
    const bytes = Buffer.from(JSON.stringify(file));
    const checked = validateHandoffFile(bytes);
    if (!checked.ok) throw appError(500, `Could not build the handoff file: ${checked.what}`);
    let pushed;
    try { pushed = await hub.client.handoff(thread.machine, { action: 'push', thread_id: id, project: thread.project, worktree: thread.worktree, branch: `wc/${id}`, sha: status.head }); }
    catch (error) { throw appError(409, `Couldn't push the branch to GitHub: ${error.message}`); }
    if (pushed.result === 'failed') throw appError(409, `Couldn't push the branch to GitHub: ${pushed.error}`);
    const dir = path.join(hub.stateDir, 'handoffs');
    const next = path.join(dir, `${id}.json.new`), dest = path.join(dir, `${id}.json`);
    try {
      await fs.mkdir(dir, { recursive: true, mode: 0o700 });
      await fs.writeFile(next, bytes, { mode: 0o600 });
      thread.handed_off = { at: file.exported_at, head: file.head, stage: file.stage };
      for (const aside of thread.asides || []) {
        if (aside.status === 'open') require('./asides.js').close(aside);
        if (aside.turn) { const pending = thread.pending_cancels ||= []; if (!pending.includes(aside.turn.id)) pending.push(aside.turn.id); }
        aside.turn = null;
      }
      try { await hub.save(thread); }
      catch (error) {
        const stored = await hub.thread(id);
        if (stored.handed_off?.head !== file.head) throw error;
        thread = stored;
      }
    } catch {
      await fs.unlink(next).catch(() => {});
      throw appError(500, "The branch was pushed, but the export didn't finish; try again");
    }
    try { await (hub.renameHandoff || fs.rename)(next, dest); }
    catch {
      const existing = await fs.readFile(dest).catch(() => null);
      if (existing?.equals(bytes)) await fs.unlink(next).catch(() => {});
      // The handed-off record and matching .new remain available for recovery.
    }
    for (const turnId of [...(thread.pending_cancels || [])]) {
      try { await hub.call(thread.machine, `/v1/aside-turns/${encodeURIComponent(turnId)}`, 'DELETE'); }
      catch (error) { if (error.status !== 404) continue; }
      thread.pending_cancels = thread.pending_cancels.filter((value) => value !== turnId);
    }
    for (const session of thread.sessions || []) if (session.live) {
      try { await require('./sessions.js').stopManagedSession(hub, thread, session); }
      catch { /* Frozen even if the machine could not stop it. */ }
    }
    await hub.save(thread).catch(() => {});
    return { bytes, filename: handoffFileName(thread.title) };
  });
}

async function savedFile(hub, thread) {
  const fs = require('node:fs/promises'); const path = require('node:path');
  const { appError } = require('./state.js');
  if (!thread.handed_off) throw appError(404, 'handoff file not found');
  const base = path.join(hub.stateDir, 'handoffs', `${thread.id}.json`);
  const read = async (file) => {
    const bytes = await fs.readFile(file).catch(() => null);
    if (!bytes) return null;
    const checked = validateHandoffFile(bytes);
    return checked.ok && checked.file.head === thread.handed_off.head ? bytes : null;
  };
  const next = await read(`${base}.new`);
  if (next) {
    try { await fs.rename(`${base}.new`, base); }
    catch (error) { const current = await read(base); if (!current || !current.equals(next)) throw error; await fs.unlink(`${base}.new`).catch(() => {}); }
    return next;
  }
  const bytes = await read(base);
  if (!bytes) throw appError(404, 'handoff file not found');
  return bytes;
}
async function sweepFiles(hub) {
  const fs = require('node:fs/promises'); const path = require('node:path');
  const dir = path.join(hub.stateDir, 'handoffs');
  const names = await fs.readdir(dir).catch((error) => { if (error.code === 'ENOENT') return []; throw error; });
  const threads = new Map((await hub.allThreads()).map((thread) => [thread.id, thread]));
  for (const name of names) {
    const match = name.match(/^(.*)\.json(?:\.new)?$/);
    if (!match) continue;
    const thread = threads.get(match[1]);
    if (!thread?.handed_off && !thread?.handoff_op) await fs.unlink(path.join(dir, name)).catch(() => {});
  }
  for (const thread of threads.values()) if (thread.handed_off) await hub.withThread(thread.id, async () => {
    const current = await hub.thread(thread.id);
    if (current.handed_off) await savedFile(hub, current).catch(() => {});
  });
}
async function banner(hub, thread) {
  const fs = require('node:fs/promises'); const path = require('node:path');
  const { appError } = require('./state.js');
  if (!thread.handed_off) throw appError(404, 'thread has not been handed off');
  const value = { state: 'inspect-failed', at: thread.handed_off.at };
  try {
    const result = await hub.client.handoff(thread.machine, { action: 'inspect', thread_id: thread.id, project: thread.project, branch: `wc/${thread.id}`, head: thread.handed_off.head, slug: thread.slug, fallback_head: thread.handed_off.head, ...(thread.worktree ? { worktree: thread.worktree } : {}) });
    if (result.result === 'failed') throw new Error(result.error);
    if (result.remote_tip === thread.handed_off.head) value.state = 'unchanged';
    else {
      let entries = [];
      try { const parsed = JSON.parse(await fs.readFile(path.join(hub.stateDir, 'revoke.json'), 'utf8')); if (Array.isArray(parsed)) entries = parsed; } catch {}
      value.state = entries.some((entry) => entry.thread_id === thread.id && entry.sha === result.remote_tip) ? 'own-cancelled' : 'moved';
      if (result.picked_up_at) value.picked_up_at = result.picked_up_at;
    }
  } catch { /* Undo repeats the check. */ }
  return value;
}

module.exports = { donePr, historyText, buildHandoffFile, validateHandoffFile, handoffFileName, unfinished, frozen, refuseFrozen, quietReason, stageFor, exportReason, exportThread, savedFile, sweepFiles, banner };

