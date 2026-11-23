'use strict';

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
function resetAt() { lastAt = null; }
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
  if (humanText.startsWith('[wc:context switch]')) return turn.replies;
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
// attachment, never as a user row; it opens a turn like any other message from the user.
function isClaudeMidTurnHuman(row) {
  const item = row.type === 'attachment' ? row.attachment : null;
  return Boolean(item && item.type === 'queued_command' && item.commandMode === 'prompt' && item.origin?.kind === 'human');
}

function hasPiEntry(raw, entryId) {
  return transcriptRows(raw).some((row) => row.id === entryId && row.type === 'message' && row.message?.role === 'assistant');
}

function piReport(raw, entryId) {
  if (entryId == null) return '';
  const row = transcriptRows(raw).find((item) => item.id === entryId && item.type === 'message' && item.message?.role === 'assistant');
  return row ? textOf(row.message.content) : '';
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

module.exports = { textOf, unwrap, stripStyleTrailer, cardBubble, transcriptRows, isCodexHuman, itemAt, resetAt, toolDetail, resultText, foldResults, claudeReply, codexReply, renderTurn, isClaudeMidTurnHuman, hasPiEntry, piReport, kimiReport };
