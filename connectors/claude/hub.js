'use strict';
const { textOf, unwrap, transcriptRows, isCodexHuman, itemAt, resetAt, toolDetail, resultText, foldResults, claudeReply, codexReply, renderTurn, isClaudeMidTurnHuman, hasPiEntry, piReport, kimiReport } = require('../hub-common');

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
