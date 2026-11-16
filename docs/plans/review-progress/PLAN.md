---
slug: review-progress
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# See progress while a plan is reviewed and a build is verified

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

**Map:** `MAP.md` and `docs/maps/app-review-progress.md`.

## Open Questions

### Q1: Counts per pass, or a running total?
- **Context:** The line carries "issues found / fixed". Per pass, a converging review reads
  8 → 3 → 0 and a stuck one stays flat; a running total only grows, so convergence is
  hidden. A running total shows overall effort.
- **Options:** (a) this pass only; (b) running total across passes; (c) both, e.g.
  "pass 3 · 2 new · 13 so far, 12 fixed".
- **Recommendation:** (a): it answers the IDEA's "converging or going round in circles"
  directly, in the shortest line.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Show stage plus counts, never finding text | Collin picked "where it stands plus counts" | user |
| 2 | Reuse the one pinned `progress` card, adding a stage, rather than a new card kind | One pinned line per thread that moves Building → Verifying, or shows Review before a build; pinning and replacement already work (`viewer/app/cards.js:22-25`) | defaulted |
| 3 | During review the lead posts the line; during verification the sub-lead posts it | Only the lead triages review findings; only the sub-lead runs verifiers (`protocol/app/sub-lead.md:161-195`) | defaulted |
| 4 | Review counts only findings the lead judged real (upheld, downgraded, accepted-risk), not declined ones | Counting declined findings makes "fixed" never catch up, so a healthy review looks stuck | defaulted |
| 5 | Pass numbers count every review round in the thread, never reset when Collin settles a fork | Reset numbering would make pass 1 appear twice; the budget reset is internal | defaulted |
| 6 | Shown in the thread only; Threads and Features lists unchanged | IDEA scopes it to the thread page; list labels come from PLAN status and are out of scope | defaulted |
| 7 | Small fixes and after-done fixes get no progress line | IDEA covers plan review and a feature build's verification only; those verifiers are one quick check | defaulted |
| 8 | A progress card without a stage renders as today's "Building" line | Older threads keep working with no migration | defaulted |

## Spec

(Draft; final pass written when the Open Questions and Watch List are empty.)

### Card

`progress` gains optional fields, validated in `viewer/app/card.js` and documented in
`protocol/app/cards.md`:

- `stage`: `build` (default when absent), `review` or `verify`.
- `pass`: positive integer, required for `review` and `verify` (review round / verification attempt).
- `phase`: for `review`, `checking` (reviewers running) or `fixing` (lead triaging and
  revising); for `verify`, `checking` or `fixing` (remediation).
- `found`, `fixed`: non-negative integers, `fixed <= found`, for `review` and `verify`.
- `done`/`total` stay required for `build`; for `review` and `verify` they are omitted.
  `choice_waiting` stays required on every stage.

### Who posts, when

- Lead, review: on launching a round (`phase: checking`, counts from the previous pass per
  Q1), after triage (`phase: fixing`, counts), and when the Spec fix for that round is saved.
- Sub-lead, verify: on starting a verifier (`phase: checking`), on a FAIL (`phase: fixing`,
  gaps counted as found), as remediation tasks are accepted (`fixed` rises).
- `choice_waiting` as today, set by the lead while a question card waits.

### Rendering (`viewer/pages/thread.js`, `thread.css`)

- `build`: unchanged.
- `review`: label "Reviewing plan", text "pass N · checking|fixing · F found, X fixed".
- `verify`: label "Verifying", same text pattern with "attempt N".
- No finding text, reviewer names or severities anywhere.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Prior Work

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
