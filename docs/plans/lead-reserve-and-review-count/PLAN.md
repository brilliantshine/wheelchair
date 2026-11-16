---
slug: lead-reserve-and-review-count
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# Reserve the lead's provider, and one-family review

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows. **Map:** `MAP.md`.

## Open Questions

### Q1: What shape is the review-and-check setting?
- **Context:** Today the app always starts two plan reviewers (one Claude, one GPT when it
  can) and a checker from the other family than whoever built it (`protocol/app/lead.md`
  step 5, `protocol/app/sub-lead.md` verification step 3). Collin wants a setting for "one
  reviewer and one type of verifier".
- **Options:**
  - A. One setting, "Reviewers and checkers": *Both families* (default, today's behaviour),
    *Claude only*, *GPT only*. A single-family choice gives one reviewer per round,
    covering both lenses, and one checker, all from that family.
  - B. Two settings: reviewer count (one or two) and checker family (other than the
    builder, Claude, or GPT), set independently.
- **Recommendation:** A. It is one choice instead of two, and matches the ask.

### Q2: With "Both families" chosen but only one family signed in, how many reviewers?
- **Context:** The CLI workflow runs two same-family reviewers in this case
  (`protocol/plan-review.md:49-52`). The app today starts two and the second lands on the
  same family with a note.
- **Options:** two same-family reviewers (two independent reads); or behave as that
  family's single-family setting (one reviewer).
- **Recommendation:** two same-family reviewers.

### Q3: When the reserved provider is the only family there is, are other sessions still held back?
- **Context:** The hold-back sends workers, reviewers and so on elsewhere when the lead's
  provider is projected to run short (`viewer/app/balancer.js:45`, `held_back`). With one
  family there is nowhere else, so they wait until usage resets.
- **Options:** keep holding back (leads stay protected, other work waits for the reset); or
  skip the hold-back when no other family is usable (nothing waits, leads may run short).
- **Recommendation:** keep holding back; the wait ends at the reset, and the ticks in
  Settings already let him turn it off per role.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | The reserved provider is the first provider in the lead order (with `any` expanded to the worker order, as for leads) that has an unpaused account signed in on the thread's machine. If none, nothing is reserved. | "Selected" in Collin's words means a provider he actually has; an order entry with no account would reserve nothing useful. | defaulted |
| 2 | `save_claude_for_leads` is renamed `save_for_leads`; a saved settings file with the old key carries its value over on load. The Settings label names the reserved provider ("Save GPT for leads"), or reads "Save the lead's provider for leads" when none is resolvable. | IDEA constraint: existing settings keep working. | defaulted |
| 3 | The per-role margin hold-back (`held_back`) follows the same reserved provider instead of `PROVIDERS.claude.saveForLeads`; the `saveForLeads` provider flag is removed. | Same reserve, same provider; otherwise the two halves of the reserve disagree. | defaulted |
| 4 | The Ready check requires only the thread's own family. The other family being installed but signed out no longer fails it. | The fallback rules already land reviewers and checkers on the available family; failing Ready blocks one-account users for a family they never meant to use (`viewer/app/ready.js:38-58`). | defaulted |
| 5 | A worker's `--provider` preference for a family with no unpaused, signed-in account on the machine is dropped with a note, instead of waiting. A family that is signed in but out of room still waits as today. | Critical and taste-sensitive work asks for Claude by name (`protocol/app/sub-lead.md:63-69`); a GPT-only setup would otherwise wait forever. | defaulted |
| 6 | Scope is the app (hub, Settings page, `protocol/app/`). The CLI `/plan-review` and `/verify` stages keep their own rules. | IDEA "Not doing"; they already handle one family. | defaulted |

## Spec

(Grown as decisions land.)

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
