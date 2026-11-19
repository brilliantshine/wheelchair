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
  const at = row.timestamp || row.payload?.timestamp || row.message?.timestamp || row.created_at;
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
  if (humanText.startsWith('[wc:context import]')) {
    return [{ type: 'context', text: 'Imported from a handoff', context: 'import', at: turn.at }, ...turn.replies];
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

// A message typed while the lead is mid-turn ("Send now") is recorded only as a queued_command
// attachment, never as a user row; it opens a turn like any other message from Collin.
function isClaudeMidTurnHuman(row) {
  const item = row.type === 'attachment' ? row.attachment : null;
  return Boolean(item && item.type === 'queued_command' && item.commandMode === 'prompt' && item.origin?.kind === 'human');
}

function parseClaude(raw, thread, sessionName) {
  lastAt = null;
  const turns = [], calls = new Map();
  for (const row of transcriptRows(raw)) {
    if (row.type === 'user' && row.origin?.kind === 'human') turns.push({ human: unwrap(textOf(row.message?.content)), replies: [], at: itemAt(row) });
    else if (isClaudeMidTurnHuman(row)) turns.push({ human: unwrap(textOf(row.attachment.prompt)), replies: [], at: itemAt(row) });
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
function parseAgy(raw, thread, sessionName) {
  lastAt = null;
  const turns = [], calls = [];
  let recognised = false;
  for (const row of transcriptRows(raw)) {
    if (!row || !['USER_INPUT', 'PLANNER_RESPONSE', 'GENERIC'].includes(row.type)) continue;
    recognised = true;
    if (row.type === 'USER_INPUT') {
      const content = typeof row.content === 'string' ? row.content : '';
      const request = content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
      turns.push({ human: unwrap((request ? request[1] : content).trim()), replies: [], at: itemAt(row) });
    } else if (turns.length && row.type === 'PLANNER_RESPONSE') {
      const text = typeof row.content === 'string' ? unwrap(row.content) : '';
      if (text) turns.at(-1).replies.push({ type: 'assistant', text, at: itemAt(row) });
      for (const call of Array.isArray(row.tool_calls) ? row.tool_calls : []) {
        const tool = { type: 'tool', text: call.name || 'tool call', at: itemAt(row), detail: toolDetail(call.args) };
        turns.at(-1).replies.push(tool);
        calls.push({ item: tool, input: call.args });
      }
    } else if (turns.length && row.type === 'GENERIC') {
      const call = calls.shift();
      if (call) call.item.detail = toolDetail(call.input, resultText(row.content).replace(/^(?:(?:Created At|Completed At):[^\r\n]*(?:\r?\n|$))+/, ''));
    }
  }
  if (!recognised && raw.trim()) return [{ type: 'notice', text: "Couldn't read this Antigravity transcript", at: new Date(0).toISOString() }];
  if (sessionName) { let n = 0; for (const turn of turns) for (const reply of turn.replies) if (reply.type === 'assistant') reply.id = `${sessionName}#${n++}`; }
  return turns.flatMap((turn) => renderTurn(turn, thread));
}
function parseKimi(raw, thread, sessionName) {
  const turns = [], calls = new Map(), steps = new Map();
  let recognised = false;
  const at = (row) => Number.isFinite(row.time) ? new Date(row.time).toISOString() : new Date(0).toISOString();
  for (const row of transcriptRows(raw)) {
    if (row.type === 'turn.prompt' && row.origin?.kind === 'user') {
      recognised = true;
      turns.push({ human: unwrap(textOf(row.input)), replies: [], at: at(row) });
    } else if (row.type === 'context.append_loop_event') {
      const event = row.event || {};
      if (!['content.part', 'tool.call', 'tool.result'].includes(event.type)) continue;
      if (event.type !== 'content.part' || event.part?.type === 'text') recognised = true;
      if (!turns.length) continue;
      if (event.type === 'content.part' && event.part?.type === 'text') {
        let reply = steps.get(event.stepUuid);
        if (!reply) {
          reply = { type: 'assistant', text: '', at: at(row) };
          steps.set(event.stepUuid, reply);
          turns.at(-1).replies.push(reply);
        }
        reply.text += event.part.text || '';
      } else if (event.type === 'tool.call') {
        const tool = { type: 'tool', text: event.name || 'tool call', at: at(row), detail: toolDetail(event.args) };
        turns.at(-1).replies.push(tool);
        if (event.toolCallId) calls.set(event.toolCallId, { item: tool, input: event.args });
      } else if (event.type === 'tool.result') foldResults(calls, [[event.toolCallId, event.result?.output]]);
    }
  }
  if (!recognised) return [{ type: 'notice', text: "Couldn't read this Kimi Code transcript", at: new Date(0).toISOString() }];
  if (sessionName) { let n = 0; for (const turn of turns) for (const reply of turn.replies) if (reply.type === 'assistant') reply.id = `${sessionName}#${n++}`; }
  return turns.flatMap((turn) => renderTurn(turn, thread));
}

function kimiReport(raw, turnId) {
  const turns = [];
  let turn;
  for (const row of transcriptRows(raw)) {
    if (row.type === 'turn.prompt' && row.origin?.kind === 'user') {
      turn = { id: row.turnId, steps: new Map() };
      turns.push(turn);
    } else if (row.type === 'turn.ended' && row.turnId === turn?.id && (row.agentId === undefined || row.agentId === 'main')) {
      turn = null;
    } else if (turn && row.type === 'context.append_loop_event') {
      const event = row.event || {};
      if (event.type === 'step.begin' && !turn.steps.has(event.uuid)) turn.steps.set(event.uuid, []);
      if (event.type === 'content.part' && event.part?.type === 'text' && turn.steps.has(event.stepUuid)) {
        turn.steps.get(event.stepUuid).push({ block: event.block, text: event.part.text || '' });
      }
    }
  }
  const selected = turnId == null ? turns.at(-1) : turns.find((item) => item.id === turnId);
  const parts = selected && [...selected.steps.values()].filter((step) => step.length).at(-1);
  return parts ? parts.sort((a, b) => a.block - b.block).map((part) => part.text).join('') : '';
}
const PARSERS = { claude: parseClaude, codex: parseCodex, agy: parseAgy, kimi: parseKimi };
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
  agy: (row) => row.type === 'PLANNER_RESPONSE' && typeof row.content === 'string' ? row.content : null,
};
function lastAssistantText(cli, raw, turnId) {
  if (cli === 'kimi') return kimiReport(raw, turnId);
  const content = Object.hasOwn(ASSISTANT_CONTENT, cli) && ASSISTANT_CONTENT[cli];
  if (!content) return '';
  let last = '';
  for (const row of transcriptRows(raw)) {
    const text = unwrap(textOf(content(row)));
    if (text) last = text;
  }
  return last;
}

// Threads from before an answered offer and a started build left the pin still carry them there.
function shownPins(thread) {
  const built = thread.cards.some((card) => card.kind === 'approval' && card.answered_action === 'start-building');
  return Object.values(thread.pinned).filter((card) => {
    if (card.kind === 'offer') return !thread.cards.find((item) => item.id === card.id)?.answered;
    if (card.kind === 'idea') return !built;
    return true;
  });
}

async function chat(hub, id) {
  let thread = await hub.readSnapshot(id);
  const views = require('./views.js');
  if (await views.discoverSlug(thread)) {
    thread = await hub.thread(id);
    await views.findSlug(hub, thread);
  }
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
  const prOf = (item) => item ? require('./handoff.js').donePr(item, { includeReplaced: true }) : null;
  const parent = thread.parent ? await hub.readSnapshot(thread.parent).catch(() => null) : null;
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
    pinned: shownPins(thread),
    queued: Object.values(thread.queues).flat().length,
  };
}

module.exports = { cardBubble, chat, lastAssistantText, sessionTranscript, stripStyleTrailer, textOf, transcriptItems, unwrap };
