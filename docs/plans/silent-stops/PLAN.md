---
slug: silent-stops
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# Catch agents that stop silently

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows. **Map:** `MAP.md`.

## Open Questions

### Q2: When does Collin see it?
- **Context:** Order is fixed by decision 7: the agent is nudged, then its starter. Something must then
  decide the starter's step "did not move it". The starter may message the agent (giving it a new turn)
  or do nothing (a sub-lead that is itself idle, waiting).
- **Options:** (a) after the starter is told: the agent ends another quiet turn, or 10 minutes pass with
  no card from it; (b) timer only; (c) the agent's next quiet turn only.
- **Recommendation:** (a): (c) alone never fires if the starter does nothing; (b) alone waits even when
  the agent has visibly stalled again.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Watched roles: worker, mapper, sub-lead (post `result` cards) and reviewer, verifier (result synthesized from their last text). Never the lead. | Every role that owes its starter a report can stall; reviewer/verifier stall when their turn ends with no text (MAP.md §5). Lead excluded by IDEA "Not doing". | defaulted |
| 2 | "Owes a reply" starts when a message is delivered to the session, including its initial brief, and is cleared by any `result` or `message` card it posts (or, for reviewer/verifier, by a synthesized result). A `finished` session never owes one. | A `message` means it is waiting on someone (a question to the lead) and is legitimate. The initial brief bypasses `thread.sent` (MAP.md §1, §3), so it must be counted explicitly. | defaulted |
| 3 | A quiet turn is judged after a grace period (30 s) from the turn-end event, not at the event, and only if the session is still idle, live, owes a reply, has an empty queue and no open permission/stuck hold. | Card and event spools drain independently, so a result can land after its turn end (MAP.md §4). An agent with a queued message, or blocked on a prompt, is not silent. | defaulted |
| 4 | App posts the nudge as `[wc:from app] ...` messages and Collin's alert as an app (system) `needs` card that closes itself when the session posts a `result` or `message`, or is stopped or ends. | Reuses the existing turn-failed / dead-session / stuck patterns (MAP.md §6); system needs cards cannot be resolved by a lead, matching "Sessions ended". | defaulted |
| 5 | Rules: worker.md, sub-lead.md, lead.md say a session's own `wc.js` and `card.js` calls are always allowed and no brief can forbid them; briefs restricting ports or the network must exempt them; a worker (and mapper, sub-lead) facing a conflict between its brief and finishing posts `result` `blocked` with the reason, never stops silently. cards.md gets the same one-line rule. | IDEA "What good looks like". | defaulted |
| 6 | No Agents tab change. | Collin sees the alert in the thread (IDEA); the tab's idle state is correct. | defaulted |
| 7 | Escalation order: on a quiet turn the app first messages the quiet agent itself (it ended without reporting; its own wc.js and card.js calls are always allowed; post a `result`, or `blocked` with the reason, or a `message` if it needs an answer). If its next turn is quiet too, the app messages the session that started it. | Fixes the common case (an agent that forgot or misread a brief) without spending the starter's turn. | user |

## Spec

(Grows as decisions land.)

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
