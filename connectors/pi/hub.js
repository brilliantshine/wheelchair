'use strict';
const { textOf, unwrap, transcriptRows, itemAt, resetAt, toolDetail, resultText, foldResults, renderTurn } = require('../hub-common');

function hasPiEntry(raw, entryId) {
  return transcriptRows(raw).some((row) => row.id === entryId && row.type === 'message' && row.message?.role === 'assistant');
}

function piReport(raw, entryId) {
  if (entryId == null) return '';
  const row = transcriptRows(raw).find((item) => item.id === entryId && item.type === 'message' && item.message?.role === 'assistant');
  return row ? textOf(row.message.content) : '';
}

function parsePi(raw, thread, sessionName) {
  resetAt();
  const turns = [], calls = new Map();
  // The machine normally redacts its copy; also protect chat if it reads another copy.
  raw = raw.replace(/sk-or-[A-Za-z0-9_-]+/g, '[redacted key]');
  for (const row of transcriptRows(raw)) {
    if (row.type !== 'message') continue;
    const message = row.message || {};
    if (message.role === 'user') turns.push({ human: unwrap(textOf(message.content)), replies: [], at: itemAt(row) });
    else if (message.role === 'toolResult') foldResults(calls, [[message.toolCallId, message.content]]);
    else if (message.role === 'assistant' && turns.length) {
      const text = unwrap(textOf(message.content));
      if (text) turns.at(-1).replies.push({ type: 'assistant', text, at: itemAt(row) });
      for (const call of Array.isArray(message.content) ? message.content.filter((part) => part.type === 'toolCall') : []) {
        const tool = { type: 'tool', text: call.name || 'tool call', at: itemAt(row), detail: toolDetail(call.arguments) };
        turns.at(-1).replies.push(tool);
        if (call.id) calls.set(call.id, { item: tool, input: call.arguments });
      }
    }
  }
  if (sessionName) { let n = 0; for (const turn of turns) for (const reply of turn.replies) if (reply.type === 'assistant') reply.id = `${sessionName}#${n++}`; }
  return turns.flatMap((turn) => renderTurn(turn, thread));
}


function readReport(raw, payload = {}) { return { text: piReport(raw, payload.entry_id), settled: !payload.entry_id || hasPiEntry(raw, payload.entry_id) }; }
module.exports = { parseChat: parsePi, readReport };
