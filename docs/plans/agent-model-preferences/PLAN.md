---
slug: agent-model-preferences
status: planning
created: 2026-11-27
---

# Better agent model preferences in Settings

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

### Q1: How should Leads and Sub-leads relate to Model Tiers?
- **Context:** Today, Plan reviewers, Checker, Code mapping, Mockups, and Scouts all choose a tier (`Light`, `Standard`, `Heavy`, `Critical`), while Leads and Sub-leads have a completely separate list of raw per-provider model pickers (showing every provider, even turned-off ones).
- **Options:**
  - `tiers-only`: Leads and Sub-leads pick a tier just like every other agent (removing the separate per-provider Lead model pickers).
  - `tiers-plus-override`: Every agent (including Leads and Sub-leads) picks a tier by default, with an optional per-agent model override when needed.
  - `columns-in-tiers`: Keep separate per-provider Lead and Sub-lead model slots, but fold them into the Tiers setup (hiding turned-off providers).
- **Recommendation:** `tiers-only` — one mental model for every agent, eliminates the separate Leads block, and you set each provider's actual models once in Tiers.

### Q2: How should the reworked Models UI organize tiers, agents, and model pickers?
- **Context:** Currently Models has four stacked blocks (a wide provider×tier grid with two dropdowns per cell, a 10-row Leads list, Escalation switches, and Other agents dropdowns). Collin wants a reworked UI that unifies tiers and agent preferences and gives a better way to choose models and tiers.
- **Options:** To be tailored once Q1 is answered (e.g., tier-centric cards showing assigned agents + inline effort pills, vs unified Agent-role list + compact Tiers bar, vs provider tabs).
- **Recommendation:** Decide after Q1.

### Q3: Should Personal assistant and Project leads share the Lead preference or have their own?
- **Context:** Today Personal assistant and Project leads silently use the Lead slot with no mention on the Models page.
- **Options:**
  - `share-lead`: Keep sharing the Lead preference and label it clearly ("Leads, Personal assistant & Project leads").
  - `separate`: Give Personal assistant and/or Project leads their own tier/model preference on the Models page.
- **Recommendation:** `share-lead` unless Collin wants a lighter/different model for chat assistants.

### Q4: How should Escalation and Reviewers/Checkers family mix sit in the new layout?
- **Context:** Escalation governs worker step-ups (4 segmented controls) and Reviewers & checkers family mix governs cross-family review. Both live on the Models page today.
- **Options:** Keep them integrated cleanly (family mix beside Reviewer/Checker; Escalation in a compact secondary section or collapsible area).
- **Recommendation:** Decide once Q2 layout is chosen.

## Watch List

Things noticed that need looking into — not yet decisions for the user. Written down the
moment they're spotted so they can't be forgotten, surfaced to the user one line at a
time as they appear, and emptied before Stage 1 exits.

Each item ends up settled by the agent (noted in the Log), promoted to an Open Question,
promoted to a Constraint or Accepted Risk, or waved off by the user.

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | 2026-11-27 | Backward compatibility for existing `~/.wheelchair/models` `lead`/`sub-lead` pins and `codex/model.sh` tests if Leads/Sub-leads move to tiers. | no | open |
| 2 | 2026-11-27 | `viewer/app/API.md` omits `designer` and `project_leads` in preferences docs; update alongside any API changes. | no | open |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|

## Spec

To be filled as decisions land.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-11-27: Mapper completed (`1d29e050`); created `PLAN.md` in `planning` status.
