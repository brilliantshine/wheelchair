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

### Agree the mockups
- **Context:** Designer started for desktop (`1280x900`) and phone (`390x844`) mockups of the reworked **Settings → Models** page.
- **Options:** Agree the mockups or request changes.
- **Recommendation:** Review with Collin once the designer finishes.

## Watch List

Things noticed that need looking into — not yet decisions for the user. Written down the
moment they're spotted so they can't be forgotten, surfaced to the user one line at a
time as they appear, and emptied before Stage 1 exits.

Each item ends up settled by the agent (noted in the Log), promoted to an Open Question,
promoted to a Constraint or Accepted Risk, or waved off by the user.

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | 2026-11-27 | Backward compatibility for existing `~/.wheelchair/models` `lead`/`sub-lead` pins and `codex/model.sh` tests if Leads/Sub-leads move to tiers. | no | settled — keep `lead`/`sub-lead` tolerated in `codex/model.sh` so existing `~/.wheelchair/models` files never read as malformed; hub placement reads tiers from `settings.json` |
| 2 | 2026-11-27 | `viewer/app/API.md` omits `designer` and `project_leads` in preferences docs; update alongside any API changes. | no | settled — will update `viewer/app/API.md` as part of the Spec |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Every agent role — including Leads and Sub-leads — picks a model tier (`light`, `standard`, `heavy`, `critical`) rather than maintaining separate per-provider Lead/Sub-lead model pickers. | One unified tier system for all agents removes the separate Leads block and lets you define each provider's models once in Tiers. | user |
| 2 | Layout for **Settings → Models**: **Agent tier buttons + Provider tabs** — top **Agents** block with 4-way segmented tier switches (`Light | Standard | Heavy | Critical`) and live model previews per role, followed by **Tier models** with tabs per enabled provider and inline effort pills instead of a second dropdown. | One-tap tier switching for every agent and single-provider tabs keep the page clean on both desktop and phone. | user |
| 3 | Place the `Reviewers and checkers` family mix control in the Agents block alongside Plan reviewers and Checker, and keep `Escalation` as a compact block below Tier models. | Keeps review/check settings together and keeps worker escalation visible without competing with the main tier/agent controls. | defaulted |
| 4 | Give Personal assistant and Project leads their own tier switches in the Agents block (separate from thread Leads). | Lets Collin run Personal assistant and Project leads on a different tier from thread Leads. | user |

## Spec

### 1. Unified tier-based agent model preferences
- Every configurable agent role picks a model tier (`light`, `standard`, `heavy`, `critical`): Leads, Sub-leads, Personal assistant, Project leads, Plan reviewers, Checker, Code mapping, Mockups, Scout, and Scout for bigger changes.
- The separate per-provider `Leads` model-picker block is removed from **Settings → Models**.
- Session placement for `lead`, `sub-lead`, Personal assistant, and Project leads resolves through each role's configured tier.

### 2. Reworked Settings → Models layout
- **Agents block (top):** Lists each agent role with a 4-way segmented tier control (`Light | Standard | Heavy | Critical`) and a subtle live preview of the models that tier resolves to across enabled providers. Includes the `Reviewers and checkers` family mix control alongside Plan reviewers and Checker.
- **Tier models block (middle):** Tabs for each enabled provider (`Claude`, `GPT`, `Antigravity`, etc.); the active provider tab shows its 4 tiers (`Light`, `Standard`, `Heavy`, `Critical`), each with a model picker (including `Not used` and `Other…`) and inline segmented effort pills (`CLI default` plus the model's supported effort levels) instead of a second dropdown, plus any heads-up actions for that provider/tier.
- **Escalation block (bottom):** Compact block with the 4 worker step-up segmented controls and live summary text.

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
