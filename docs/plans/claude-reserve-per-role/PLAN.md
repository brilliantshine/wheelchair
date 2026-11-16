---
slug: claude-reserve-per-role
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# Separate Claude reserve settings for workers and reviewers

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

**Map:** `MAP.md` and `docs/maps/app-provider-placement.md`.

## Open Questions

### Q1: What shape do the new settings take?
- **Context:** Today one `margin` (%) excludes Claude from every worker, reviewer, verifier
  and mapper when the week's forecast says Claude's remaining share at refill will fall
  under it (`viewer/app/balancer.js:40`). The margin answers "how much Claude do leads
  need kept back"; the problem is who gets turned away for it.
- **Options:**
  - A. Keep one margin; add a tick per role (workers, reviewers, verifiers, mappers) for
    who is held back when Claude runs short.
  - B. Two margins: one for workers, one for reviewers/verifiers/mappers; 0 means never
    held back.
  - C. Four margins, one per role.
- **Recommendation:** A. One amount to protect for leads, one choice per role of who
  gives way. B/C allow tiering (hold workers back early, reviewers only near the end)
  at the cost of more numbers to reason about.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Existing saved settings migrate so behaviour is unchanged: every role held back today stays held back until Collin edits the new settings. | IDEA.md Constraint. | defaulted |
| 2 | "Save Claude for leads" stays an ordering preference only (non-lead sessions without a provider preference try GPT before Claude); its hint is reworded to say it does not turn the reserve on or off. The reserve is governed only by the new settings. | Fixes the confusion IDEA.md names without removing a setting he uses. | defaulted |
| 3 | Leads and sub-leads stay exempt from the reserve; forecast math is unchanged. | IDEA.md Not doing. | defaulted |
| 4 | API.md, protocol/app/lead.md and protocol/app/sub-lead.md wording about "the Claude margin exception" is updated to match. | Docs must not describe the old single rule. | defaulted |

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
