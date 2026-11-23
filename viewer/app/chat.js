'use strict';

// Spec "How the app reads and drives a session": transcript-to-chat assembly.
const fs = require('node:fs/promises');
const { createHash } = require('node:crypto');
const { publicSession } = require('./sessions.js');

const connectors = require('../../connectors');
const { textOf, unwrap, stripStyleTrailer, cardBubble, hasPiEntry } = require('../../connectors/hub-common');

function transcriptItems(cli, raw, thread, sessionName) {
  const parser = connectors.manifest(cli) && connectors.hub(cli).parseChat;
  return parser ? parser(raw, thread, sessionName) : [{ type: 'notice', text: `This session's CLI (${cli}) has no transcript reader.`, at: new Date(0).toISOString() }];
}

// The machine service keeps each session's transcript copy (a Claude Stop hook or a bound
// Codex rollout tells it where the source is), so the hub reads it from there; the hub's own
// record never learns the path.
// Report reads never use the chat cache, so they cannot return a stale message.
async function sessionTranscript(hub, thread, session, { strict = false, timeout = 5000 } = {}) {
  if (strict) {
    let timer;
    const controller = new AbortController();
    try {
      return await Promise.race([
        (async () => {
          const result = await hub.client.passThrough(thread.machine, `/v1/sessions/${encodeURIComponent(session.name)}/transcript`, 'GET', undefined, timeout, controller.signal);
          if (result.status !== 404 && (result.status < 200 || result.status >= 300)) throw new Error('machine refused transcript');
          if (result.status !== 404 && result.body?.data) return result.body.data;
          return session.transcript_path ? fs.readFile(session.transcript_path, 'utf8') : '';
        })(),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('machine timeout')); }, timeout); }),
      ]);
    } finally { clearTimeout(timer); controller.abort(); }
  }
  const route = `/v1/sessions/${encodeURIComponent(session.name)}/transcript`;
  try {
    const result = await hub.call(thread.machine, route, 'GET');
    if (result?.data) return result.data;
  } catch { /* fall back to the local file */ }
  if (!session.transcript_path) return '';
  return fs.readFile(session.transcript_path, 'utf8').catch(() => '');
}

async function sessionChatItems(hub, thread, session) {
  const key = `${thread.machine}/${session.name}`;
  const route = `/v1/sessions/${encodeURIComponent(session.name)}/transcript`;
  const store = hub.transcripts ??= new Map();
  const parsedKey = session.cli + JSON.stringify([thread.parent_title]);
  const now = () => hub.now ? hub.now() : Date.now();
  try {
    const entry = store.get(key);
    const known = entry?.gen && entry.parsedKey === parsedKey ? `?known=${encodeURIComponent(`${entry.gen}:${entry.end}`)}` : '';
    let result = await hub.call(thread.machine, route + known, 'GET');
    if (result?.unchanged) {
      const current = store.get(key);
      if (current && current.gen === result.gen && current.end === result.end) { current.lastRead = now(); return current.parsed; }
      result = await hub.call(thread.machine, route, 'GET');
    }
    if (result?.data) {
      const hash = createHash('sha256').update(result.data).digest('hex');
      const current = store.get(key);
      const parsed = current?.hash === hash && current.parsedKey === parsedKey
        ? current.parsed : module.exports.transcriptItems(session.cli, result.data, thread, session.name);
      store.set(key, { gen: result.gen, end: result.end, hash, parsedKey, parsed, lastRead: now(), thread: thread.id });
      return parsed;
    }
  } catch { /* the service may be down or the session unknown to it */ }
  const entry = store.get(key);
  if (entry) { entry.lastRead = now(); return entry.parsed; }
  const text = session.transcript_path ? await fs.readFile(session.transcript_path, 'utf8').catch(() => '') : '';
  if (text || !connectors.manifest(session.cli)) return module.exports.transcriptItems(session.cli, text, thread, session.name);
  return [];
}

// A reviewer's or verifier's report is the last assistant message of its turn.
function lastAssistantText(cli, raw, turnId, entryId) {
  return connectors.manifest(cli) ? connectors.hub(cli).readReport(raw, { turn_id: turnId, entry_id: entryId }).text : '';
}

// Threads from before an answered offer and a started build left the pin still carry them there.
function shownPins(thread) {
  const built = thread.cards.some((card) => card.kind === 'approval' && card.answered_action === 'start-building');
  return Object.values(thread.pinned).filter((card) => {
    if (card.kind === 'offer') return !thread.cards.find((item) => item.id === card.id)?.answered;
    if (card.kind === 'idea') return !built;
    return true;
  });
}

// Lead-to-lead traffic as "Talked with" lines (no message text). Entries before an import cutoff
// drop first (the page's rule), then sent/received entries to one thread fold while each is within
// 30 minutes of the previous one for that thread; each limit entry is its own item.
const PEER_FOLD_MS = 30 * 60 * 1000;
function peerItems(thread) {
  const cutoff = thread.imported ? Date.parse(thread.imported.at) : NaN;
  const log = (Array.isArray(thread.peer_log) ? thread.peer_log : []).filter((entry) => {
    if (!entry || typeof entry.at !== 'string' || typeof entry.thread !== 'string') return false;
    const when = Date.parse(entry.at);
    return !Number.isFinite(when) || !Number.isFinite(cutoff) || when >= cutoff;
  });
  const out = [], open = new Map();
  for (const entry of log) {
    if (entry.direction === 'limit') { out.push({ type: 'peer', at: entry.at, thread: entry.thread, title: entry.title, limit: true }); continue; }
    if (entry.direction !== 'sent' && entry.direction !== 'received') continue;
    const last = open.get(entry.thread);
    const when = Date.parse(entry.at);
    if (last && Number.isFinite(when) && when - last.lastAt <= PEER_FOLD_MS) {
      last.item.count++; last.item.title = entry.title; last.lastAt = when;
    } else {
      const item = { type: 'peer', at: entry.at, thread: entry.thread, title: entry.title, count: 1 };
      out.push(item);
      open.set(entry.thread, { item, lastAt: when });
    }
  }
  return out;
}
function withPeerItems(items, thread) {
  const result = items.slice();
  for (const peer of peerItems(thread)) {
    const when = Date.parse(peer.at);
    const at = result.findIndex((item) => Date.parse(item.at) > when);
    if (at < 0) result.push(peer); else result.splice(at, 0, peer);
  }
  return result;
}

async function chat(hub, id) {
  let thread = await hub.readSnapshot(id);
  const views = require('./views.js');
  if (await views.discoverSlug(thread, hub)) {
    thread = await hub.thread(id);
    await views.findSlug(hub, thread);
  }
  const items = [];
  for (const session of thread.sessions.filter((item) => item.role === 'lead')) {
    items.push(...await sessionChatItems(hub, thread, session));
  }
  // Settings "Tool steps: Hide" drops the lead's tool calls (commands, file reads) entirely.
  const { tool_steps: toolSteps } = await require('./settings.js').load(hub);
  const shown = withPeerItems(toolSteps === 'hide' ? items.filter((item) => item.type !== 'tool') : items, thread);
  // The pull request each thread produced, from its latest done card, so the page can link it
  // and a stub can link the one it waits on.
  const prOf = (item) => item ? require('./handoff.js').donePr(item, { includeReplaced: true }) : null;
  const parent = thread.parent ? await hub.readSnapshot(thread.parent).catch(() => null) : null;
  const cards = thread.cards.map((card) =>
    !card.replaced && card.kind === 'needs' && card.system && require('./card.js').blockingNeeds(thread, card.id) ? { ...card, blocking: true } : card);
  const publicThread = {
    ...thread,
    sessions: thread.sessions.map(publicSession),
    cards,
    pr_url: prOf(thread),
    parent_pr_url: prOf(parent),
  };
  return {
    thread: { ...publicThread, asides: (thread.asides || []).map(require('./asides.js').brief) },
    asides: (thread.asides || []).map(require('./asides.js').brief),
    documents: await require('./documents.js').list(thread, hub),
    items: shown,
    cards: cards.filter((card) => !card.replaced),
    pinned: shownPins(thread),
    queued: Object.entries(thread.queues || {}).flatMap(([name, queue]) => { const session = (thread.sessions || []).find((item) => item.name === name); return session ? queue.filter((entry) => !require('./peer-log.js').heldEntry(session, entry)) : queue; }).length,
  };
}

module.exports = { cardBubble, chat, hasPiEntry, lastAssistantText, sessionChatItems, sessionTranscript, stripStyleTrailer, textOf, transcriptItems, unwrap };
