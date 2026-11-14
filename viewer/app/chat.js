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

function itemAt(row) {
  return row.timestamp || row.payload?.timestamp || row.message?.timestamp || new Date().toISOString();
}

function appendReply(turns, row, cli) {
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
        turns.at(-1).replies.push({ type: 'tool', text: item.name || 'tool call', at: itemAt(row) });
      }
    }
  } else if (tool) {
    const name = payload.name || payload.function?.name || 'tool call';
    turns.at(-1).replies.push({ type: 'tool', text: name, at: itemAt(row) });
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
  const turns = [];
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
    else appendReply(turns, row, cli);
  }
  return turns.flatMap((turn) => renderTurn(turn, thread));
}

async function chat(hub, id) {
  const thread = await hub.thread(id);
  await require('./views.js').findSlug(hub, thread);
  const items = [];
  for (const session of thread.sessions.filter((item) => item.role === 'lead')) {
    if (!session.transcript_path) continue;
    const raw = await fs.readFile(session.transcript_path, 'utf8').catch(() => '');
    items.push(...transcriptItems(session.cli, raw, thread));
  }
  const publicThread = { ...thread, sessions: thread.sessions.map(publicSession) };
  return {
    thread: publicThread,
    items,
    cards: thread.cards.filter((card) => !card.replaced),
    pinned: Object.values(thread.pinned),
    queued: Object.values(thread.queues).flat().length,
  };
}

module.exports = { cardBubble, chat, textOf, transcriptItems, unwrap };
