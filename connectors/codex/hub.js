'use strict';
const { textOf, unwrap, transcriptRows, isCodexHuman, itemAt, resetAt, toolDetail, resultText, foldResults, claudeReply, codexReply, renderTurn, isClaudeMidTurnHuman, hasPiEntry, piReport, kimiReport } = require('../hub-common');

function parseCodex(raw, thread, sessionName) {
  resetAt();
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

function readReport(raw, payload = {}) { let last = ''; for (const row of transcriptRows(raw)) { const text = unwrap(textOf((() => { const payload = row.payload || row; return row.type === 'response_item' && payload.type === 'message' && payload.role === 'assistant' ? payload.content : null; })())); if (text) last = text; } return { text: last, settled: true }; }
module.exports = { parseChat: parseCodex, readReport };
