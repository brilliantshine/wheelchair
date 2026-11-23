'use strict';
const { textOf, unwrap, transcriptRows, isCodexHuman, itemAt, resetAt, toolDetail, resultText, foldResults, claudeReply, codexReply, renderTurn, isClaudeMidTurnHuman, hasPiEntry, piReport, kimiReport } = require('../hub-common');

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


function readReport(raw, payload = {}) { return { text: kimiReport(raw, payload.turn_id), settled: true }; }
module.exports = { parseChat: parseKimi, readReport };
