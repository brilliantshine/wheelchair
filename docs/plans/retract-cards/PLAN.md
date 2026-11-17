---
slug: retract-cards
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-17
---

# Retract cards that no longer apply

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

### Q1: What happens to the plan when its approval card is retracted?
- **Context:** The lead sets PLAN.md `status: approved` and commits it before posting the
  approval card (`protocol/app/lead.md:256-280`). Retracting the card means Collin isn't
  building yet. Changing the Spec already returns the plan to `ready-for-review`.
- **Options:**
  - A. Status stays `approved`. When he's ready, the lead posts a fresh approval card (a
    new Ready check). If the talk changes the Spec, the existing rule sends it back to
    review.
  - B. Retraction always returns the plan to `ready-for-review`, so another review round
    runs before any build.
- **Recommendation:** A. Retraction alone changes nothing in the plan, so re-reviewing an
  unchanged Spec costs a round for nothing.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Retraction is a new hidden card kind, `retract` (`card`, `note`), separate from `resolve` | `resolve` means "answered in chat" and its label says so (MAP: `viewer/pages/thread.js:552-579`); IDEA requires a retracted card to look different from an answered one | defaulted |
| 2 | Retractable kinds: open `question`, `offer`, `approval`, lead-posted `needs`, and `sudo` while `waiting` | IDEA "What good looks like"; app-posted needs close on their own (IDEA "Not doing") | defaulted |
| 3 | Only a lead may retract, only in its own thread, with a required one-line note; any lead of the thread, including a later one, may retract an earlier lead's card | Mirrors `resolve` rules (MAP: `viewer/app/card.js:24-39`) | defaulted |
| 4 | A retracted card shows "Withdrawn" and the note, dimmed; all its controls are removed or disabled | IDEA; MAP shows approval Re-check, objection talk, and sudo controls ignore `answered`, so each needs an explicit check | defaulted |
| 5 | A sudo card can be retracted only while `waiting`. Retraction cancels the helper request through the existing machine cancel path (the one Decline uses), so the helper needs no change and no reinstall. If the helper reports the request already running or finished, the retraction is refused with that state and the card reports the outcome as usual | MAP: `machine/lib/sudo.js:77-84`, `sudo-helper/helper.py:306-322`; the helper is root-owned and reinstalled only by Collin; IDEA constraint on running commands | defaulted |
| 6 | A retracted offer lets the lead post one more offer, like "keep talking first" does; the hub's limit of two offers stays | MAP: `viewer/app/cards.js:72-76`; a retracted offer was never answered "take it into planning" | defaulted |
| 7 | Retraction is final; no un-retract. The lead posts a new card instead | IDEA "Not doing" | defaulted |

## Spec

_Grows as decisions land._

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
