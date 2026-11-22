---
slug: lead-chat-solid
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-21
---

# Make lead-to-lead chat solid

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

Map: `MAP.md` → `docs/maps/lead-chat-delivery.md`. Earlier plan: `docs/plans/lead-chat/PLAN.md`
(its Deferred rows D1–D4 are this plan's scope).

## Open Questions

_None._

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode: thorough | Collin picked it; this thread is already the hardening follow-up | user |
| 2 | A message to a thread with no live lead is held on that thread (not refused) and delivered to its next lead, after the restart context; held messages never expire, and are dropped if the thread is archived or handed off | A restart can be minutes or days away; a held message is information, and leads never wait on each other | defaulted |
| 3 | The sender learns a message was held: `card.js` prints `"held":true` in its receipt | The sending lead should know no one has read it yet | defaulted |
| 4 | The live-lead check and the enqueue-or-hold happen under one target-thread step, so a lead stopping between them no longer loses the message | Closes the loss window the mapper found (`viewer/app/hub.js:203`) | defaulted |
| 5 | Cap: at most 20 cross-thread messages per pair of threads per rolling hour, both directions counted together, held messages included; the 21st is refused (422) with a reason naming the other thread and when sending is possible again | A typical overlap exchange is 2–6 messages; a loop hits 20 within minutes | defaulted |
| 6 | Hitting the cap also shows a small line in the sender's thread: "Message limit reached with <title>" | Collin sees a loop was stopped without a card to answer | defaulted |
| 7 | The restart context gains `cross_thread_messages`: the latest 20 cross-thread messages this thread's leads sent or received, each with time, direction, other thread id and title, and text; `recent_messages` is unchanged | Keeps user messages from being crowded out; outgoing ones were already in cards, incoming ones were missing (`viewer/app/threads.js:144`) | defaulted |
| 8 | The "Talked with" line links to the other thread | One tap to see what the other thread is doing | defaulted |
| 9 | Holding (Decision 2) also applies to a stub thread never opened: the message is delivered after its `[wc:context stub]` message | Same rule as a restarting lead; the stub's lead learns of it on first open | defaulted |
| 10 | "Talked with" lines: one line per conversation; messages with the same thread within 30 minutes of the previous one fold into one line, "Talked with <title> · N messages" | Collin picked it (Q1): fewer lines on a phone | user |
| 11 | Supersedes 9: a never-opened stub has no lead session, so a message to it stays refused ("no lead by that name"); adding to a stub is thread 2c25927136e1's work | Avoids a second way to feed a stub; a held message needs a lead session to wait on (Spec S1) | defaulted |
| 12 | A message may name any lead session of the target thread, live or ended; it goes to the latest live lead or is held. The overlap rules for `lead: null` entries in `session leads` are unchanged (still an overlap card) | Holding protects conversations already under way; changing the overlap path is out of scope | defaulted |
| 13 | Held messages wait in the latest lead session's queue, which `restartLead` already moves to the next lead; no new store | Reuses the existing move (`viewer/app/threads.js:178`) | defaulted |

## Spec

Scope: cross-thread `message` cards between leads (the path in `docs/maps/lead-chat-delivery.md`).
Same-thread messages, `reach` cards and `session leads` output are unchanged.

### S1. Holding a message for a lead that is not running

- Acceptance (`viewer/app/cards.js`, cross-thread branch): keep every existing check except
  `that thread has no live lead right now`, which is removed. `to` must still name a lead
  session that exists in the target thread (live or ended); otherwise `no lead by that name`
  as today. A never-opened stub has no session and stays refused.
- Delivery step (`viewer/app/hub.js` `acceptCard`, target-thread update): if the target is
  still reachable (`peers.reachable`), take `peers.latestLiveLead(thread)`; if there is none,
  take the target's most recently created lead session (live or not). Push the same queue
  entry as today (marker text, `source: 'session'`) onto that session's queue and
  `thread.queues`. Attempt delivery only when the chosen lead is live. The step returns
  `{ name, held }` with `held: true` when the lead was not live.
- A held message reaches the next lead because `restartLead` already moves every ended
  lead's queue to the new lead after the new restart context (both the normal and the
  imported path; `viewer/app/threads.js:159-195`). Verify that ordering in a test; change
  nothing there unless the test shows the message lost or placed before the context.
- Archive and hand-off: held messages are simply never delivered (no new code).
- Receipt: `acceptCard` returns the card plus `held: true` when held. The machine relays the
  hub body unchanged; `viewer/app/card.js` adds `"held":true` to its printed receipt when the
  body has `held === true` (alongside the existing `queued`). A machine-spooled card
  (`queued`) cannot report `held`.
- The loss window (map: sender card saved, target step returns null) now occurs only when
  the target stops being reachable (archived, handed off, moved machine) between the two
  steps. That is a rare path; see Accepted Risks.

### S2. Cap per pair of threads

- Every cross-thread message card stores `target_thread: <id>` on the sender's card.
- Before storing a cross-thread message, count message cards with `target_thread` equal to
  the other thread in the sender thread, plus message cards in the target thread whose
  `target_thread` is the sender thread, with `created_at`
  within the last 60 minutes. If the count is 20 or more, refuse with 422 and the reason
  `message limit reached with <target title>: 20 messages in the last hour; you can send again after <HH:MM> UTC`,
  where the time is the oldest counted message's time plus 60 minutes. Nothing is stored
  except the S3 limit entry.
- The count is read without the target thread's lock (no new lock ordering; the concurrent
  opposite-send test `viewer/test/app-lead-messages.test.js:79` must still pass).
- Constant `PAIR_LIMIT = 20`, `PAIR_WINDOW_MS = 3600000` in one place, exported for tests.

### S3. Per-thread record of lead-to-lead traffic

- New thread field `peer_log`: array of `{ at, thread, title, direction, text }`, newest last,
  capped at 200 (oldest dropped). `direction` is `sent`, `received` or `limit`. `thread` is the
  other thread's id and `title` its `peers.threadName` at that moment. `text` is the message
  text (empty for `limit`).
- `sent` entry: added to the sender thread when the card is stored. `received` entry: added to
  the target thread in the delivery step (S1), whether delivered or held. `limit` entry: added
  to the sender thread when S2 refuses (it is the only change that refusal makes; it must still
  respond 422).
- Old threads with no `peer_log` read as empty.

### S4. Restart context

- `restartLead` adds `cross_thread_messages`: the last 20 `peer_log` entries with direction
  `sent` or `received`, each as `{ at, direction, thread, title, text }`. Omit the field when
  there are none. `recent_messages` and every other field are unchanged.
- `protocol/app/lead.md` "Restarting what died" gains one sentence: the restart context's
  `cross_thread_messages` holds recent messages with other threads' leads; reread them before
  answering a peer.

### S5. "Talked with" lines in the thread

- `viewer/app/chat.js` builds, from `peer_log`, items of a new type `peer`, interleaved by time
  with the other items:
  - Walk entries in order. `sent` and `received` entries with the same `thread` fold into one
    item while each is within 30 minutes of the previous entry for that thread; otherwise a new
    item starts. Item: `{ type: 'peer', at: <first entry's at>, thread, title: <latest entry's title>, count }`.
  - Each `limit` entry is its own item `{ type: 'peer', at, thread, title, limit: true }`.
- `viewer/pages/thread.js` renders a `peer` item like a context line (class `ctx`): text
  `Talked with <title> · <count> message(s)` ("1 message", "N messages") or
  `Message limit reached with <title>`, with `<title>` a link to
  `/wheelchair/app/thread?id=<thread>`. All text via `textContent` (never HTML). No message
  text is shown anywhere.
- The hidden `[wc:from ...]` turns stay hidden exactly as today (`viewer/app/chat.js:125`).

### S6. Protocol text

- `protocol/app/cards.md`, `message` section: a lead's message to another thread's lead may
  name any lead of that thread, live or ended; if none is live it is held for that thread's
  next lead and the receipt shows `"held":true`; at most 20 messages per pair of threads per
  hour, both directions, refused with the reason. Add `held` to the receipt description in
  "Posting a card".
- `protocol/app/lead.md`, "Other leads on this machine", Replies or Overlap bullet: a held
  message is normal; never resend it. On a limit refusal, stop messaging that thread and tell
  the user in a line if something still needs saying. Keep `lead: null` threads' overlap rule
  as it is.
- Any copy of these files the repo keeps elsewhere (for example a generated prompt) is updated
  the same way; `grep -rn "no live lead right now" .` must return nothing outside tests and
  old plans.

### Non-goals

Showing message text in the thread; messages between machines; changing who may message whom,
the `reach` flow or `session leads`; messaging never-opened stubs; a user-facing card for the
cap.

### Validation

- `node --test viewer/test/app-lead-messages.test.js viewer/test/app-hub.test.js viewer/test/app-chat.test.js viewer/test/app-handoff-restart.test.js`
- `bash machine/test/run.sh`
- `npm --prefix viewer run test:browser`
- New tests (in `viewer/test/app-lead-messages.test.js` unless noted):
  1. Message to a thread whose only lead has ended: accepted, receipt has `held: true`, entry
     sits on that lead's queue; `restartLead` then puts it on the new lead's queue after the
     restart context (normal and imported restart).
  2. Lead dies between acceptance and delivery step: message is held, not lost.
  3. 20 messages in an hour across both directions succeed; the 21st in either direction gets
     422 with the reason text above, stores no card, and adds one `limit` entry to the sender's
     `peer_log`; a message 61 minutes after the oldest succeeds.
  4. `peer_log` gets `sent` on the sender and `received` on the target; capped at 200.
  5. Restart context includes `cross_thread_messages` (both directions, last 20) and omits it
     when empty (`viewer/test/app-hub.test.js`).
  6. Chat builds folded `peer` items: 3 messages within 30 minutes → one item count 3; a gap
     over 30 minutes → two items; a limit entry → its own item (`viewer/test/app-chat.test.js`).
  7. Browser: a `peer` item renders as a line with a link to the other thread and no message
     text.
  8. `card.js` prints `"held":true` when the body has it.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| A message is stored on the sender but never queued if the target is archived, handed off or moved machine between acceptance and the delivery step | Needs a user action inside a sub-second window; rare path (`realism.md`) | planning |
| The pair count is read without the target's lock, so two opposite sends in the same instant can exceed 20 by one | Sub-second race between two actors; the cap still stops a loop | planning |
| A card spooled during a hub outage and refused later by the cap reaches no sender | Needs an outage plus a loop; the `limit` line still shows in the thread | planning |

## Review Rounds

### Round 1 — 2026-11-21

**Lanes:** intent — claude / claude-opus-5-5; mechanics — gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-11-21: lead of thread 2c25927136e1 (Avoid duplicate stubs) asked about clashes; it changes `listLeads` output and adds an app message to stub leads. Not an overlap: this plan does not touch `listLeads`; answered the peer.
