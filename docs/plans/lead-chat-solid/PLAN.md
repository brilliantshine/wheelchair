---
slug: lead-chat-solid
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-21
---

# Make lead-to-lead chat solid

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

Map: `MAP.md` → `docs/maps/lead-chat-delivery.md`. Earlier plan: `docs/plans/lead-chat/PLAN.md`
(its Deferred rows D1–D4 are this plan's scope).

## Open Questions

### Q1: How much should the thread show when its lead talks with another thread's lead?
- **Context:** IDEA.md promises a small line without message text. Leads can exchange
  several messages in a few minutes.
- **Options:** (a) one line per conversation: messages with the same thread within 30
  minutes fold into one line, "Talked with <title> · N messages", updated as more arrive;
  (b) one line per message, "Sent a message to <title>" / "Got a message from <title>".
- **Recommendation:** (a): fewer lines on a phone, same information.

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

## Spec

_Written once Open Questions are settled._

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-11-21: lead of thread 2c25927136e1 (Avoid duplicate stubs) asked about clashes; it changes `listLeads` output and adds an app message to stub leads. Not an overlap: this plan does not touch `listLeads`; answered the peer.
