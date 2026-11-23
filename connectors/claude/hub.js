'use strict';
const { textOf, unwrap, transcriptRows, itemAt, resetAt, toolDetail, resultText, foldResults, renderTurn } = require('../hub-common');

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

function isClaudeMidTurnHuman(row) {
  const item = row.type === 'attachment' ? row.attachment : null;
  return Boolean(item && item.type === 'queued_command' && item.commandMode === 'prompt' && item.origin?.kind === 'human');
}

function parseClaude(raw, thread, sessionName) {
  resetAt();
  const turns = [], calls = new Map();
  for (const row of transcriptRows(raw)) {
    if (row.type === 'user' && row.origin?.kind === 'human') turns.push({ human: unwrap(textOf(row.message?.content)), replies: [], at: itemAt(row) });
    else if (isClaudeMidTurnHuman(row)) turns.push({ human: unwrap(textOf(row.attachment.prompt)), replies: [], at: itemAt(row) });
    else claudeReply(turns, row, calls);
  }
  if (sessionName) { let n = 0; for (const turn of turns) for (const reply of turn.replies) if (reply.type === 'assistant') reply.id = `${sessionName}#${n++}`; }
  return turns.flatMap((turn) => renderTurn(turn, thread));
}

function readReport(raw, payload = {}) { let last = ''; for (const row of transcriptRows(raw)) { const text = unwrap(textOf(row.type === 'assistant' && row.message?.role === 'assistant' ? row.message.content : null)); if (text) last = text; } return { text: last, settled: true }; }
module.exports = { parseChat: parseClaude, readReport };
