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



function renderTurn(turn, thread) {
  const humanText = stripStyleTrailer(turn.human);
  if (humanText.startsWith('[wc:role]') || humanText.startsWith('[wc:from ')) return [];
  if (humanText.startsWith('[wc:context switch]')) return turn.replies;
  if (humanText.startsWith('[wc:context stub]')) {
    return [
      { type: 'context', text: thread.parent ? `Started from ${thread.parent_title || 'parent thread'}` : 'Started from a saved idea', context: 'stub', at: turn.at },
      ...turn.replies,
    ];
  }
  if (humanText.startsWith('[wc:context import]')) {
    return [{ type: 'context', text: 'Imported from a handoff', context: 'import', at: turn.at }, ...turn.replies];
  }
  if (humanText.startsWith('[wc:context restart]')) {
    let text = 'Lead restarted';
    try {
      const state = JSON.parse(humanText.replace(/^\[wc:context restart\] Thread state:\n/, ''));
      if (state?.assistant === true) text = 'Assistant restarted · starting fresh';
      else if (state?.project_lead === true) text = 'Project lead restarted · starting fresh';
      else if (state?.by === 'assistant') text = 'Lead restarted by your assistant';
    } catch { /* Older or malformed restart contexts keep the original label. */ }
    return [{ type: 'context', text, context: 'restart', at: turn.at }, ...turn.replies];
  }
  if (humanText.startsWith('[wc:assistant] ')) {
    const text = humanText.slice('[wc:assistant] '.length);
    const bubble = cardBubble(text);
    const human = bubble
      ? { type: 'human', text: `Your assistant: ${bubble}`, card: true, by: 'assistant', at: turn.at }
      : { type: 'human', text, by: 'assistant', at: turn.at };
    return [human, ...turn.replies];
  }
  const bubble = cardBubble(humanText);
  const human = bubble
    ? { type: 'human', text: bubble, card: true, at: turn.at }
    : { type: 'human', text: humanText, at: turn.at };
  return [human, ...turn.replies];
}









module.exports = { textOf, unwrap, stripStyleTrailer, cardBubble, transcriptRows, itemAt, resetAt, toolDetail, resultText, foldResults, renderTurn };
