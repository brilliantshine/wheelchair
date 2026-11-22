---
slug: stub-dedupe
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-21
---

# No duplicate stubs

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first. Map: `MAP.md`.

## Open Questions

### Q2: Ask Collin before adding to a stub
- **Context:** Judging "same" vs "close" vs "different" is the lead's call.
- **Options:** (A) the lead adds and says so, visible in both threads. (B) the lead asks with a question card each time.
- **Recommendation:** A.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is two-part | Collin picked it | user |
| 2 | Candidates are stubs (threads created from a stub card) in the same project on the same machine, not archived or handed off, and whose own work is not done (no `done` card, no merged PR) | Only these can still take the work | defaulted |
| 3 | `session leads` lists candidate stubs even with no lead (`lead: null`), and every stub entry carries `stub: true` and `summary` (its current context, additions included) | Agents can't compare without the summary; MAP.md shows both are missing today | defaulted |
| 4 | Adding uses the existing `stub` card with a new optional `adds_to: <thread id>` field; the card's `summary` is the addition. Exact duplicates use it too, with a one-line summary ("Also came up in this thread") | One card kind, and the target stub records every thread that hit the same problem | defaulted |
| 5 | An addition with `depends_on_parent: true` or `commits` is refused; such work gets its own stub | A stub waits on exactly one parent branch | defaulted |
| 6 | An agent may add only to a stub that is unopened, or opened and still planning (its PLAN.md `status` is `planning`, or it has no plan status and no `progress` card yet). Otherwise it makes a new stub as today, whose summary names the related stub | Keeps approved or in-progress work from changing underneath Collin (IDEA.md constraint) | user |

## Spec

(Grows as decisions land.)

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
