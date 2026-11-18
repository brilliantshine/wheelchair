'use strict';

// The handoff is data, not a live card or session record.
const LIMIT = 10 * 1024 * 1024;
const KINDS = new Set(['message', 'press', 'offer', 'idea', 'question', 'approval', 'progress', 'needs', 'done', 'diagram', 'image', 'stub', 'sudo', 'title', 'resolve', 'retract', 'result', 'merged']);
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
  if (file.format !== 'wheelchair-handoff' || file.version !== 1) return fail('unknown format or version');
  if (!iso(file.exported_at)) return fail('invalid export time');
  if (!keys(file.thread, ['id', 'title', 'slug']) || typeof file.thread.id !== 'string' || !/^[0-9a-f]{12}$/.test(file.thread.id)
    || typeof file.thread.title !== 'string' || file.thread.title.length > 120 || typeof file.thread.slug !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(file.thread.slug)) return fail('invalid thread');
  if (typeof file.repository !== 'string' || !/^github\.com\/[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(file.repository)) return fail('invalid repository');
  if (file.branch !== `wc/${file.thread.id}`) return fail('invalid branch');
  if (typeof file.head !== 'string' || !/^[0-9a-f]{40}$/.test(file.head)) return fail('invalid head');
  if (!['idea-confirmed', 'approved', 'done'].includes(file.stage)) return fail('invalid stage');
  if (file.stage === 'done' ? typeof file.pr_url !== 'string' || !file.pr_url : Object.hasOwn(file, 'pr_url')) return fail('invalid pull request');
  if (!Array.isArray(file.history) || file.history.length > 2000 || !file.history.every((entry) => keys(entry, ['at', 'who', 'kind', 'text'])
    && iso(entry.at) && ['collin', 'lead', 'app'].includes(entry.who) && KINDS.has(entry.kind)
    && typeof entry.text === 'string' && entry.text.length <= 20000)) return fail('invalid history');
  return { ok: true, file };
}

function historyText(card) {
  const answer = card.retracted_at ? 'withdrawn' : card.answered_value || card.resolved_note || card.answered_action || (card.answered ? 'answered' : '');
  const lines = (...items) => items.flat(Infinity).filter((item) => typeof item === 'string' && item.length).join('\n');
  switch (card.kind) {
    case 'question': return lines(card.question, (card.options || []).map((option) => option.label), answer);
    case 'idea': return lines((card.bullets || []).map((bullet) => bullet.text));
    case 'approval': return lines((card.objections || []).map((item) => lines(item.finding, item.reason)), answer);
    case 'done': return lines(card.title, card.can_do || [], card.left_as_is || [], card.pr_url);
    case 'needs': return lines(card.title, card.body);
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
    if (['collin', 'card'].includes(sent.source) && newer(sent.at)) history.push({ at: sent.at, who: 'collin', kind: sent.source === 'card' ? 'press' : 'message', text: sent.text });
  }
  for (const card of thread.cards || []) {
    const at = card.created_at || card.at;
    if (card.replaced || !newer(at)) continue;
    const text = historyText(card);
    if (text !== null) history.push({ at, who: card.system ? 'app' : 'lead', kind: card.kind, text });
  }
  history.sort((a, b) => String(a.at).localeCompare(String(b.at)));
  for (const entry of history) if (typeof entry.text === 'string' && entry.text.length > 20000) entry.text = `${entry.text.slice(0, 19990)}… (cut)`;
  const file = { format: 'wheelchair-handoff', version: 1, exported_at: new Date().toISOString(), thread: { id: thread.id, title: thread.title || '', slug: thread.slug }, repository, branch: `wc/${thread.id}`, head, stage, ...(stage === 'done' ? { pr_url } : {}), history };
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
  if ((hub.uploadsInFlight?.get(thread.id) || 0) > 0) return 'A file is still uploading';
  return null;
}
function answerAt(card, thread) {
  if (card.retracted_at || !card.answered) return null;
  const sent = (thread.sent || []).filter((item) => item.source === 'card' && item.text?.startsWith(`[card ${card.id}] `)).at(-1);
  return sent?.at || card.resolved_at || card.at || card.created_at;
}
function stageFor(thread, status) {
  const cards = thread.cards || [];
  if (status.plan_status === 'approved' && !cards.some((c) => c.kind === 'approval' && !c.retracted_at && c.answered_action === 'start-building')) return 'approved';
  if (status.plan_status === 'done' && ([...cards].reverse().find((c) => c.kind === 'done' && !c.replaced && c.pr_url)?.pr_url || thread.imported?.pr_url)) return 'done';
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
  if ((thread.cards || []).some((card) => card.kind === 'merged') || (pressed && status?.pr_state && status.pr_state !== 'OPEN')) return 'The pull request is merged or closed; nothing left to hand off';
  if (status && !status.repository) return "This project's origin isn't on GitHub";
  const quiet = quietReason(hub, thread);
  if (quiet) return quiet;
  if (status?.dirty) return "Some changes aren't committed yet";
  if (pressed && status && stageFor(thread, status) === 'done' && status.head !== status.remote_tip) return 'A fix is still being checked';
  if (!status || status.branch !== `wc/${thread.id}` || !stageFor(thread, status)) return NOT_POINT;
  return null;
}
module.exports = { historyText, buildHandoffFile, validateHandoffFile, handoffFileName, unfinished, frozen, refuseFrozen, quietReason, stageFor, exportReason };

