---
slug: quiet-card-close
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-21
---

# Close the "agent stopped without reporting" card

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows. Code map: `MAP.md` and `docs/maps/system-needs-quiet.md`.

## Open Questions

None.

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
| 5 | Dismiss goes on every system needs card except "Permission needed" and "Session stuck at startup" | Collin picked "All but blocking ones": other app cards such as "Session ended" never close today; the two blocking ones mean a session is held and close themselves | user |
| 6 | Blocking cards are recognised by title ("Permission needed", "Session stuck at startup"), so cards already in existing threads are covered without a migration | Titles are fixed strings posted in one place (`viewer/app/sessions.js` ~638) | defaulted |

## Spec

### S1. Auto-close of the quiet card
The quiet card is the system needs card "An agent stopped without reporting" raised by `alert()` in `viewer/app/quiet.js`, whose id is stored on the quiet session as `s.quiet_card`.

While `s.quiet_card` names an unanswered card, the hub calls `quiet.reset(thread, s)` (normal reset, not `stopped`) when either happens:
- **Starter message delivered:** `deliver()` in `viewer/app/sessions.js` successfully submits to `s` a queued item that came from a `message` card posted by the session named `s.started_by`. The app's own messages (`source: 'app'`, quiet reminders, "turn failed" notices, card presses) do not count. If queue items do not record the sending session today, record it (for example a `from` field) when `viewer/app/cards.js` enqueues a `message` card; items queued before the change simply lack it and do not trigger.
- **Child started:** `s` successfully starts a session through the hub's session-start path (`viewer/app/sessions.js` ~699, where `started_by: caller.name`). A start refused by the hub, or one that comes back `waiting`, still counts once the hub has recorded the new session; a refused start does not.

Reset already answers the card, clears queued quiet reminders and returns `s` to stage 0, so a later quiet turn goes through the usual reminders and may raise a fresh card. With no open quiet card, neither event changes the quiet state (the ladder before the card is unchanged). The existing closers (message/result from `s`, a reviewer/verifier report, stop, death) are unchanged.

### S2. Dismiss button on app cards
- **Which cards:** an unanswered, unreplaced `needs` card with `system: true` whose title is neither "Permission needed" nor "Session stuck at startup". Cards already in existing threads qualify the same way.
- **Thread page** (`viewer/pages/thread.js`, needs case ~1009): such a card shows a "Dismiss" button in its actions row, after the "Open terminal" link when that is present. It is disabled for an archived thread, like other card buttons. Pressing it posts to the existing route `POST /wheelchair/api/threads/<id>/cards/<card>/dismiss` (`viewer/app/routes.js:631`) and refreshes like other presses; an error is shown the way other press errors are.
- **Hub** (`viewer/app/threads.js` `dismiss`, ~440): for a card that qualifies, mark it with `resolveCard(card, 'user', 'Dismissed')`, set `thread.user_at`, save, and enqueue nothing to any session. For a blocking card return 422 `a session is waiting on this; it closes itself`. Non-system needs cards keep today's dismiss behaviour (resolved and the lead told `[card <id>] dismissed`). An already-answered card stays 422 `card is already answered`; frozen threads are refused as today.
- **Not changed:** `resolvable`/`retractable` in `viewer/app/card.js` still refuse system cards for leads (lead `resolve` and `retract` keep "a system needs card closes itself"). The press route in `threads.js` (~394) still refuses Keep going / Talk about it on system cards. Dismissing never touches `needs_open`, `permission_open`, `quiet_stage`, `quiet_card`, `needs_card` or any queue. If a dismissed quiet card's session is later reset, reset finds the card already answered and leaves it.
- **Result:** the card dims as resolved ("Dismissed") and drops out of the Needs you count (`viewer/app/views.js:140-149`), so the thread stops showing "needs you" for it.

### S3. Docs
`protocol/app/cards-lead.md` (needs section and `retract` rule 3) and `cards.md` say system needs cards close themselves; add one sentence that the user can dismiss any of them except "Permission needed" and "Session stuck at startup", and that the quiet card also closes when its agent's starter messages it or the agent starts another agent. Update `docs/maps/system-needs-quiet.md` closure lines.

### Non-goals
No change to when an agent counts as quiet or to the reminders before the card; no lead resolve/retract of system cards; no change to the blocking cards' own closing.

### Validation
- New tests in `viewer/test/app-quiet.test.js`: a raised quiet card closes and the stage returns to 0 when (a) a message card from the starter is delivered, (b) the quiet session starts a child; an app reminder delivery does not close it; with no card open, a starter message does not change `quiet_stage`.
- New tests in `viewer/test/app-hub.test.js` (next to the system dismiss refusal ~1805): dismissing a quiet card and a "Session ended" card succeeds, marks resolved by user with note "Dismissed", enqueues nothing to the lead; dismissing "Permission needed" and "Session stuck at startup" returns 422 and leaves `needs_open`/`permission_open` unchanged; lead resolve/retract of a system card still refused. Update the existing refusal test to the new behaviour.
- A browser test (or extend an existing thread-page one) that an open system needs card shows Dismiss and a permission card does not.
- `node --test viewer/test/*.test.js` (unquoted glob) and `npm --prefix viewer run test:browser` pass.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-21

**Lanes:** claude (intent); other family (mechanics); cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
