---
slug: quiet-card-close
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-21
---

# Close the "agent stopped without reporting" card

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows. Code map: `MAP.md` and `docs/maps/system-needs-quiet.md`.

## Open Questions

### Q1: Which app-posted cards get the Dismiss button?
- **Context:** Besides the quiet card, several app-posted ("system") needs cards never close on their own today: "Session ended", "Codex preflight failed", and the archive failure cards (MAP: docs/maps/system-needs-quiet.md, Other system needs). "Permission needed" and "Session stuck at startup" close themselves when the session moves on, and while open they mean a session is actually blocked.
- **Options:** (a) only the quiet card; (b) every system needs card except "Permission needed" and "Session stuck at startup"; (c) every system needs card.
- **Recommendation:** (b).

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is two-part | Collin picked it | user |
| 2 | The open quiet card closes automatically when (a) a message from the quiet session's starter is delivered to it, or (b) the quiet session starts another session. Either does a full quiet reset, so a later quiet episode can raise a fresh card | These are the two signals from the agent-lessons case: the lead dealt with it, and the sub-lead went back to work. Both are already observable in the hub | defaulted |
| 3 | Auto-close triggers act only while a quiet card is open; the reminders before the card are unchanged | IDEA "Not doing": no change to the ladder before the card | defaulted |
| 4 | Dismissing closes the card only: no quiet reset, no message to the lead, no change to any session hold | Nobody is waiting on an app card's answer; real activity still resets the ladder; IDEA constraint on holds | defaulted |

## Spec

(Draft, grown as decisions land.)

### S1. Auto-close of the quiet card
In `viewer/app/quiet.js` terms: a session `s` with an open quiet card (`s.quiet_card` set and that card unanswered) gets `reset(thread, s)` when:
- **Starter message delivered:** `deliver()` in `viewer/app/sessions.js` successfully submits to `s` a queued message whose sender is `s.started_by` (a `message` card from that session; the app's own `[wc:from app]` reminders do not count). If queue items do not record the sender today, add a field when enqueuing a session message.
- **Child started:** `s` successfully starts a session through the session start path (`viewer/app/sessions.js` ~699, the `started_by: caller.name` call).
Reset already answers the card, clears queued quiet reminders, and returns the ladder to stage 0, so a new quiet turn later goes through the normal reminders and can raise a fresh card. The card dims as answered; it no longer counts in Needs you (`viewer/app/views.js:140-149`).

### S2. Dismiss control
(Scope depends on Q1.) An open system needs card in scope shows a "Dismiss" button on the thread page next to any "Open terminal" link. Pressing it calls the existing `POST .../cards/<id>/dismiss` route; the hub accepts it for in-scope system cards, marks the card resolved by `user` with note "Dismissed", saves, and enqueues nothing to the lead. Lead `resolve`/`retract` refusals for system cards are unchanged. Dismissing never touches `needs_open`, `permission_open`, `quiet_stage` or any queue.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
