---
slug: chat-refresh-leftovers
status: confirmed   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-22
---

# Chat refresh: three leftovers from the duplicate thread

## What we're building

Three small efficiency fixes to how the app refreshes a thread's chat, carried over from a
duplicate thread (PR #125, closed) onto the design main already has (PR #122):

1. The hub keeps only the parsed chat for each session in memory, not the raw transcript
   text as well.
2. The hub stops rewriting `machines.json` on every call to a machine; it updates the
   "last seen" time in memory every time and saves it to disk at most once a minute.
3. The machine drops a session's in-memory line fingerprints (used to skip lines it already
   copied) after they sit unused, even when nothing else is being copied.

## Why — the problem

- Every open session's raw transcript sits in hub memory next to its parsed form, roughly
  doubling what the chat cache holds.
- Every chat poll (and every other call to a machine) rewrites `machines.json` on disk,
  just to bump a timestamp that is only read when the hub starts.
- Main already keeps fingerprints in memory, but only clears idle ones when some other copy
  starts; on a quiet machine they stay forever.

## What good looks like

- Chat in the app looks and refreshes exactly as before, including after a session's CLI
  or the thread's parent title changes, and when a machine can't be reached.
- With a chat open and polling, `machines.json` changes at most once a minute per machine,
  and the machine list still shows a current "last seen" time.
- After a hub restart, "last seen" is at most about a minute older than it was.
- A session's fingerprints are gone from machine memory within minutes of going idle, and
  copying stays correct afterwards (no lost or doubled lines).

## Not doing

- Changing the chat refresh protocol between hub and machine beyond what item 1 needs.
- Merging the duplicate thread's branch; its code is reference only.
- Any change to how transcripts are copied or deduplicated beyond the idle cleanup.

## Constraints

- Builds on main's current design (conditional read, 10-minute idle eviction, parsed reuse).
- Existing tests keep passing; `viewer/test/app-hub.test.js` "persists its last-seen time"
  is updated to the once-a-minute rule.
