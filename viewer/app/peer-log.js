'use strict';
const PAIR_LIMIT = 20;
const PAIR_WINDOW_MS = 3600000;
function append(thread, entry) { thread.peer_log = [...(thread.peer_log || []), entry].slice(-200); }
function heldEntry(session, entry) { return !session.live && session.status !== 'pending' && Boolean(entry.peer); }
function dropHeld(thread) {
  for (const session of thread.sessions || []) {
    if (session.live || session.status === 'pending') continue;
    if (session.queue) session.queue = session.queue.filter(entry => !heldEntry(session, entry));
    if (thread.queues?.[session.name]) thread.queues[session.name] = thread.queues[session.name].filter(entry => !heldEntry(session, entry));
  }
}
module.exports = { PAIR_LIMIT, PAIR_WINDOW_MS, append, heldEntry, dropHeld };
