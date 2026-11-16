'use strict';

// Spec "How the app reads and drives a session": transcript-to-chat assembly.
const fs = require('node:fs/promises');
const { publicSession } = require('./sessions.js');

function textOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((item) => item && ['text', 'input_text', 'output_text'].includes(item.type))
    .map((item) => item.text || '')
    .join('');
}

function unwrap(text) {
  return String(text || '')
    .replace(/<pasted_content\s+id=[^>]*>/g, '')
    .replace(/<\/pasted_content\s+id=[^>]*>/g, '')
    .trim();
}

function stripStyleTrailer(text) {
  return String(text || '').replace(/\n\n\[wc:style\]\n[\s\S]*$/, '');
}

function cardBubble(text) {
  const match = text.match(/^\[card [^\]]+\] (.*)$/s);
  if (!match) return null;
  // A sudo result carries the command's whole output; the bubble keeps its first line.
  if (/^sudo ran:/.test(match[1])) return match[1].split('\n', 1)[0];
  return match[1]
    .replace(/^picked:\s*/i, 'Picked ')
    .replace(/^removed:\s*/i, 'Removed ')
    .replace(/^talk about:\s*/i, 'Talk about: ');
}

function transcriptRows(raw) {
  return raw.split('\n').flatMap((line) => {
    if (!line) return [];
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
}

function isCodexHuman(row, codexTurn, text) {
  const payload = row.payload || row;
  const role = payload.type === 'message' ? payload.role : row.message?.role;
  if (row.type !== 'response_item' || role !== 'user' || !codexTurn) return false;
  return !text.startsWith('# AGENTS.md') && !text.startsWith('<environment_context>');
}

// A line without a timestamp takes the previous line's: stamping it "now" would sort it after
// every card, and the page places cards by time.
let lastAt = null;
function itemAt(row) {
  const at = row.timestamp || row.payload?.timestamp || row.message?.timestamp;
  if (at) lastAt = at;
  return at || lastAt || new Date(0).toISOString();
}

// Spec "tool calls": a call is one line, expandable, with its result folded in. `detail` is the
// call's input and, once it arrives, its result, each cut to DETAIL_LIMIT characters.
const DETAIL_LIMIT = 2000;
function clip(value) {
  let text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  text = text === undefined ? '' : text;
  if (text.length <= DETAIL_LIMIT) return text;
  return `${text.slice(0, DETAIL_LIMIT)}\n[cut: ${text.length - DETAIL_LIMIT} more characters]`;
}

function toolDetail(input, result) {
  const parts = [];
  if (input !== undefined && input !== '') parts.push(`Input:\n${clip(input)}`);
  if (result !== undefined) parts.push(`Result:\n${clip(result)}`);
  return parts.join('\n\n');
}

function resultText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return textOf(content);
  return content === undefined ? '' : JSON.stringify(content);
}

// Folds a result row into the tool item its id names. Returns true when the row was a result.
function foldResults(calls, found) {
  for (const [id, result] of found) {
    const call = calls.get(id);
    if (call) call.item.detail = toolDetail(call.input, resultText(result));
  }
  return found.length > 0;
}
function claudeReply(turns, row, calls) {
  if (row.type === 'user' && Array.isArray(row.message?.content) && foldResults(calls, row.message.content.filter((p) => p.type === 'tool_result').map((p) => [p.tool_use_id, p.content]))) return;
  if (!turns.length || row.type !== 'assistant' || row.message?.role !== 'assistant') return;
  const content = row.message.content;
  const text = unwrap(textOf(content));
  if (text) turns.at(-1).replies.push({ type: 'assistant', text, at: itemAt(row) });
  for (const item of Array.isArray(content) ? content.filter((p) => p.type === 'tool_use') : []) {
    const tool = { type: 'tool', text: item.name || 'tool call', at: itemAt(row), detail: toolDetail(item.input) };
    turns.at(-1).replies.push(tool);
    if (item.id) calls.set(item.id, { item: tool, input: item.input });
  }
}
function codexReply(turns, row, calls) {
  const payload = row.payload || row;
  if (['function_call_output', 'custom_tool_call_output'].includes(payload.type)) { foldResults(calls, [[payload.call_id, payload.output]]); return; }
  if (!turns.length) return;
  const content = payload.type === 'message' ? payload.content : row.message?.content;
  const role = payload.type === 'message' ? payload.role : row.message?.role;
  if (row.type === 'response_item' && role === 'assistant') {
    const text = unwrap(textOf(content));
    if (text) turns.at(-1).replies.push({ type: 'assistant', text, at: itemAt(row) });
  } else if (['custom_tool_call', 'function_call'].includes(payload.type)) {
    const input = payload.arguments ?? payload.input;
    const tool = { type: 'tool', text: payload.name || payload.function?.name || 'tool call', at: itemAt(row), detail: toolDetail(input) };
    turns.at(-1).replies.push(tool);
    if (payload.call_id) calls.set(payload.call_id, { item: tool, input });
  }
}

function renderTurn(turn, thread) {
  const humanText = stripStyleTrailer(turn.human);
  if (humanText.startsWith('[wc:role]') || humanText.startsWith('[wc:from ')) return [];
  if (humanText.startsWith('[wc:context stub]')) {
    return [
      { type: 'context', text: `Started from ${thread.parent_title || 'parent thread'}`, context: 'stub', at: turn.at },
      ...turn.replies,
    ];
  }
  if (humanText.startsWith('[wc:context restart]')) {
    return [{ type: 'context', text: 'Lead restarted', context: 'restart', at: turn.at }, ...turn.replies];
  }
  const bubble = cardBubble(humanText);
  const human = bubble
    ? { type: 'human', text: bubble, card: true, at: turn.at }
    : { type: 'human', text: humanText, at: turn.at };
  return [human, ...turn.replies];
}

function parseClaude(raw, thread, sessionName) {
  lastAt = null;
  const turns = [], calls = new Map();
  for (const row of transcriptRows(raw)) {
    if (row.type === 'user' && row.origin?.kind === 'human') turns.push({ human: unwrap(textOf(row.message?.content)), replies: [], at: itemAt(row) });
    else claudeReply(turns, row, calls);
  }
  if (sessionName) { let n = 0; for (const turn of turns) for (const reply of turn.replies) if (reply.type === 'assistant') reply.id = `${sessionName}#${n++}`; }
  return turns.flatMap((turn) => renderTurn(turn, thread));
}
function parseCodex(raw, thread, sessionName) {
  lastAt = null;
  const turns = [], calls = new Map();
  let codexTurn = false, codexHumanSeen = false;
  for (const row of transcriptRows(raw)) {
    const payload = row.payload || row;
    const content = payload.type === 'message' ? payload.content : row.message?.content;
    const text = unwrap(textOf(content));
    if (row.type === 'event_msg' && payload.type === 'task_started') { codexTurn = false; codexHumanSeen = false; continue; }
    if (row.type === 'turn_context' || payload.type === 'turn_context') { codexTurn = true; codexHumanSeen = false; continue; }
    const user = row.type === 'response_item' && (payload.type === 'message' ? payload.role : row.message?.role) === 'user';
    if (user && codexHumanSeen) { codexTurn = false; codexHumanSeen = false; }
    if (isCodexHuman(row, codexTurn, text)) { turns.push({ human: text, replies: [], at: itemAt(row) }); codexHumanSeen = true; }
    else codexReply(turns, row, calls);
  }
  if (sessionName) { let n = 0; for (const turn of turns) for (const reply of turn.replies) if (reply.type === 'assistant') reply.id = `${sessionName}#${n++}`; }
  return turns.flatMap((turn) => renderTurn(turn, thread));
}
const PARSERS = { claude: parseClaude, codex: parseCodex };
function transcriptItems(cli, raw, thread, sessionName) {
  const parser = Object.hasOwn(PARSERS, cli) && PARSERS[cli];
  return parser ? parser(raw, thread, sessionName) : [{ type: 'notice', text: `This session's CLI (${cli}) has no transcript reader.`, at: new Date(0).toISOString() }];
}

// The machine service keeps each session's transcript copy (a Claude Stop hook or a bound
// Codex rollout tells it where the source is), so the hub reads it from there; the hub's own
// record never learns the path.
// With `keepLast` (the chat page), a read that fails or times out, as when the service is busy
// while the agent works, falls back to the last copy this hub read, so the chat never empties
// for one poll and refills on the next. A report reader passes nothing: a stale copy could
// hand it an earlier message as the report.
async function sessionTranscript(hub, thread, session, { keepLast = false } = {}) {
  hub.transcriptCache ??= new Map();
  const key = `${thread.machine}/${session.name}`;
  try {
    const result = await hub.call(thread.machine, `/v1/sessions/${encodeURIComponent(session.name)}/transcript`, 'GET');
    if (result?.data) { hub.transcriptCache.set(key, result.data); return result.data; }
  } catch { /* the service may be down or the session unknown to it: fall back below */ }
  if (keepLast && hub.transcriptCache.has(key)) return hub.transcriptCache.get(key);
  if (!session.transcript_path) return '';
  return fs.readFile(session.transcript_path, 'utf8').catch(() => '');
}

// A reviewer's or verifier's report is the last assistant message of its turn.
const ASSISTANT_CONTENT = {
  claude: (row) => row.type === 'assistant' && row.message?.role === 'assistant' ? row.message.content : null,
  codex: (row) => { const payload = row.payload || row; return row.type === 'response_item' && payload.type === 'message' && payload.role === 'assistant' ? payload.content : null; },
};
function lastAssistantText(cli, raw) {
  const content = Object.hasOwn(ASSISTANT_CONTENT, cli) && ASSISTANT_CONTENT[cli];
  if (!content) return '';
  let last = '';
  for (const row of transcriptRows(raw)) {
    const text = unwrap(textOf(content(row)));
    if (text) last = text;
  }
  return last;
}

async function chat(hub, id) {
  const thread = await hub.thread(id);
  await require('./views.js').findSlug(hub, thread);
  const items = [];
  for (const session of thread.sessions.filter((item) => item.role === 'lead')) {
    const raw = await sessionTranscript(hub, thread, session, { keepLast: true });
    if (!raw && Object.hasOwn(PARSERS, session.cli)) continue;
    items.push(...transcriptItems(session.cli, raw, thread, session.name));
  }
  // Settings "Tool steps: Hide" drops the lead's tool calls (commands, file reads) entirely.
  const { tool_steps: toolSteps } = await require('./settings.js').load(hub);
  const shown = toolSteps === 'hide' ? items.filter((item) => item.type !== 'tool') : items;
  // The pull request each thread produced, from its latest done card, so the page can link it
  // and a stub can link the one it waits on.
  const prOf = (item) => [...(item?.cards || [])].reverse().find((card) => card.kind === 'done' && card.pr_url)?.pr_url || null;
  const parent = thread.parent ? await hub.thread(thread.parent).catch(() => null) : null;
  const publicThread = {
    ...thread,
    sessions: thread.sessions.map(publicSession),
    pr_url: prOf(thread),
    parent_pr_url: prOf(parent),
  };
  return {
    thread: { ...publicThread, asides: (thread.asides || []).map(require('./asides.js').brief) },
    asides: (thread.asides || []).map(require('./asides.js').brief),
    items: shown,
    cards: thread.cards.filter((card) => !card.replaced),
    pinned: Object.values(thread.pinned),
    queued: Object.values(thread.queues).flat().length,
  };
}

module.exports = { cardBubble, chat, lastAssistantText, sessionTranscript, stripStyleTrailer, textOf, transcriptItems, unwrap };
