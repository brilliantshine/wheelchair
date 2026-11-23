'use strict';
const { textOf, unwrap, transcriptRows, isCodexHuman, itemAt, resetAt, toolDetail, resultText, foldResults, claudeReply, codexReply, renderTurn, isClaudeMidTurnHuman, hasPiEntry, piReport, kimiReport } = require('../hub-common');

function parseAgy(raw, thread, sessionName) {
  resetAt();
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

function readReport(raw, payload = {}) { let last = ''; for (const row of transcriptRows(raw)) { const text = unwrap(textOf(row.type === 'PLANNER_RESPONSE' && typeof row.content === 'string' ? row.content : null)); if (text) last = text; } return { text: last, settled: true }; }
module.exports = { parseChat: parseAgy, readReport };
