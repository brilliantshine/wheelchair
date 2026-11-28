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

### Q2: How should the reworked Models page organize tiers, agents, and model pickers?
- **Context:** With every agent picking a tier, we can eliminate the separate Leads section and rethink how tiers, agent assignments, and model/effort pickers are laid out so the page feels unified and uncluttered on both desktop and phone.
- **Options:**
  - `tier-cards`: One card per tier (`Light`, `Standard`, `Heavy`, `Critical`) showing the agents assigned to it (as clickable chips you can move between tiers) and each enabled provider's model + effort pills.
  - `agents-plus-provider-tabs`: Top block has every agent role with a 4-way segmented tier picker (`Light | Standard | Heavy | Critical`) and a subtle preview of its models; bottom block has provider tabs (`Claude`, `GPT`, etc.) so you configure one provider's 4 tiers at a time.
  - `cleaned-up-split`: Streamlined Tiers grid (all enabled providers visible at once, effort pills instead of effort dropdowns) directly paired with one unified Agents list using segmented tier buttons.
- **Recommendation:** `agents-plus-provider-tabs` — one-tap tier switching for every agent with live model previews, and provider tabs keep the tier pickers uncluttered as more providers are enabled.

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
| 1 | Every agent role — including Leads and Sub-leads — picks a model tier (`light`, `standard`, `heavy`, `critical`) rather than maintaining separate per-provider Lead/Sub-lead model pickers. | One unified tier system for all agents removes the separate Leads block and lets you define each provider's models once in Tiers. | user |

## Spec

### 1. Unified tier-based agent model preferences
- Every configurable agent role picks a model tier (`light`, `standard`, `heavy`, `critical`): Leads, Sub-leads, Plan reviewers, Checker, Code mapping, Mockups, Scout, and Scout for bigger changes.
- The separate per-provider `Leads` model-picker block is removed from **Settings → Models**.
- Session placement for `lead` and `sub-lead` resolves through their configured tier (defaulting to `heavy` for existing/new setups unless migrated or configured otherwise — exact migration/backward-compatibility rules to be specified after remaining design decisions).

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
