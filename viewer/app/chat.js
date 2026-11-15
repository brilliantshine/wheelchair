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

function cardBubble(text) {
  const match = text.match(/^\[card [^\]]+\] (.*)$/s);
  if (!match) return null;
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
function foldResult(calls, row, cli) {
  const payload = row.payload || row;
  const found = [];
  if (cli === 'claude' && row.type === 'user' && Array.isArray(row.message?.content)) {
    for (const part of row.message.content.filter((p) => p.type === 'tool_result')) {
      found.push([part.tool_use_id, resultText(part.content)]);
    }
  } else if (cli !== 'claude' && ['function_call_output', 'custom_tool_call_output'].includes(payload.type)) {
    found.push([payload.call_id, resultText(payload.output)]);
  }
  for (const [id, result] of found) {
    const call = calls.get(id);
    if (call) call.item.detail = toolDetail(call.input, result);
  }
  return found.length > 0;
}

function appendReply(turns, row, cli, calls = new Map()) {
  if (!turns.length) return;
  const payload = row.payload || row;
  const content = payload.type === 'message' ? payload.content : row.message?.content;
  const role = payload.type === 'message' ? payload.role : row.message?.role;
  const assistant = cli === 'claude'
    ? row.type === 'assistant' && role === 'assistant'
    : row.type === 'response_item' && role === 'assistant';
  const tool = cli === 'claude'
    ? Array.isArray(content) && content.some((item) => item.type === 'tool_use')
    : ['custom_tool_call', 'function_call'].includes(payload.type);
  if (assistant) {
    const text = unwrap(textOf(content));
    if (text) turns.at(-1).replies.push({ type: 'assistant', text, at: itemAt(row) });
    if (cli === 'claude' && Array.isArray(content)) {
      for (const item of content.filter((item) => item.type === 'tool_use')) {
        const tool = { type: 'tool', text: item.name || 'tool call', at: itemAt(row), detail: toolDetail(item.input) };
        turns.at(-1).replies.push(tool);
        if (item.id) calls.set(item.id, { item: tool, input: item.input });
      }
    }
  } else if (tool && cli !== 'claude') {
    // Claude's tool calls are listed from its assistant lines above; other lines that carry
    // tool_use content (progress echoes) would show the same call twice.
    const name = payload.name || payload.function?.name || 'tool call';
    const input = payload.arguments ?? payload.input;
    const tool = { type: 'tool', text: name, at: itemAt(row), detail: toolDetail(input) };
    turns.at(-1).replies.push(tool);
    if (payload.call_id) calls.set(payload.call_id, { item: tool, input });
  }
}

function renderTurn(turn, thread) {
  if (turn.human.startsWith('[wc:role]') || turn.human.startsWith('[wc:from ')) return [];
  if (turn.human.startsWith('[wc:context stub]')) {
    return [
      { type: 'context', text: `Started from ${thread.parent_title || 'parent thread'}`, context: 'stub', at: turn.at },
      ...turn.replies,
    ];
  }
  if (turn.human.startsWith('[wc:context restart]')) {
    return [{ type: 'context', text: 'Lead restarted', context: 'restart', at: turn.at }, ...turn.replies];
  }
  const bubble = cardBubble(turn.human);
  const human = bubble
    ? { type: 'human', text: bubble, card: true, at: turn.at }
    : { type: 'human', text: turn.human, at: turn.at };
  return [human, ...turn.replies];
}

function transcriptItems(cli, raw, thread) {
  lastAt = null;
  const turns = [];
  const calls = new Map();
  let codexTurn = false;
  for (const row of transcriptRows(raw)) {
    const payload = row.payload || row;
    const content = payload.type === 'message' ? payload.content : row.message?.content;
    const text = unwrap(textOf(content));
    const turnContext = row.type === 'turn_context' || payload.type === 'turn_context';
    const started = row.type === 'event_msg' && payload.type === 'task_started';
    if (cli === 'codex' && (started || turnContext)) {
      codexTurn = true;
      continue;
    }
    const claudeHuman = row.type === 'user' && row.origin?.kind === 'human';
    const human = cli === 'claude' ? claudeHuman : isCodexHuman(row, codexTurn, text);
    if (human) turns.push({ human: text, replies: [], at: itemAt(row) });
    else if (!foldResult(calls, row, cli)) appendReply(turns, row, cli, calls);
  }
  return turns.flatMap((turn) => renderTurn(turn, thread));
}

// The machine service keeps each session's transcript copy (a Claude Stop hook or a bound
// Codex rollout tells it where the source is), so the hub reads it from there; the hub's own
// record never learns the path.
async function sessionTranscript(hub, thread, session) {
  try {
    const result = await hub.call(thread.machine, `/v1/sessions/${encodeURIComponent(session.name)}/transcript`, 'GET');
    if (result?.data) return result.data;
  } catch { /* the service may be down or the session unknown to it: fall back below */ }
  if (!session.transcript_path) return '';
  return fs.readFile(session.transcript_path, 'utf8').catch(() => '');
}

// A reviewer's or verifier's report is the last assistant message of its turn.
function lastAssistantText(cli, raw) {
  let last = '';
  for (const row of transcriptRows(raw)) {
    const payload = row.payload || row;
    const assistant = cli === 'claude'
      ? row.type === 'assistant' && row.message?.role === 'assistant'
      : row.type === 'response_item' && payload.type === 'message' && payload.role === 'assistant';
    if (!assistant) continue;
    const text = unwrap(textOf(cli === 'claude' ? row.message.content : payload.content));
    if (text) last = text;
  }
  return last;
}

async function chat(hub, id) {
  const thread = await hub.thread(id);
  await require('./views.js').findSlug(hub, thread);
  const items = [];
  for (const session of thread.sessions.filter((item) => item.role === 'lead')) {
    const raw = await sessionTranscript(hub, thread, session);
    if (!raw) continue;
    items.push(...transcriptItems(session.cli, raw, thread));
  }
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
    thread: publicThread,
    items,
    cards: thread.cards.filter((card) => !card.replaced),
    pinned: Object.values(thread.pinned),
    queued: Object.values(thread.queues).flat().length,
  };
}

module.exports = { cardBubble, chat, lastAssistantText, sessionTranscript, textOf, transcriptItems, unwrap };
