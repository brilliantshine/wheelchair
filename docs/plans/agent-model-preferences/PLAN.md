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
| 5 | Place Personal assistant and Project leads in their own separate block at the bottom of **Settings → Models** (separate from thread/build agents). | They don't build code directly, so keeping them in their own block keeps the main Agents block focused on thread/build roles. | user |
| 6 | Add per-role provider ladders (dropdown/collapsible custom provider order, defaulting to the global order in Usage and balancing) for each applicable agent role (`lead`, `reviewer`, `verifier`, `mapper`, `designer`, `assistant`, `project-lead`), updating `IDEA.md` scope accordingly. `sub-lead` (follows thread provider) and `scout`/`scout-heavy` (built-in CLI helpers on lead's provider) do not have provider ladders. | Gives full per-role provider preference control right alongside tier selection while keeping rows uncluttered until opened. | idea-change |
| 7 | Give `sub-lead` its own provider ladder too instead of forcing sub-leads onto the thread lead's provider (superseding the `sub-lead` exclusion in Decision 6). Only `scout` and `scout-heavy` have no provider ladder (they run as built-in CLI helpers inside the lead's or sub-lead's own CLI). | Collin wants sub-leads to be able to pick their own provider order independently of the lead. | user |
| 8 | Make "Default" provider order self-explanatory in the Models UI: show what Default currently resolves to and link directly to **Usage and balancing** (`#usage`) where the global Lead and Worker provider orders are set. | Removes ambiguity about where "Default" is configured. | user |
| 9 | Move the global Lead and Worker provider orders (`lead_order`, `worker_order`) out of **Usage and balancing** into a **Provider ladders** block on **Settings → Models** (superseding the Usage and balancing link in Decision 8). Each applicable agent role can choose `Default: Lead`, `Default: Worker`, or a `Custom` provider ladder. | Puts all model and provider-picking controls in **Models**, leaves **Usage and balancing** focused on quotas and reserves, and lets any agent reuse either shared ladder. | idea-change |

## Spec

### 1. Unified tier-based agent model preferences & per-role provider ladders
- Every configurable agent role picks a model tier (`light`, `standard`, `heavy`, `critical`): Leads, Sub-leads, Plan reviewers, Checker, Code mapping, Mockups, Scout, Scout for bigger changes, plus Personal assistant and Project leads (in their own block).
- The separate per-provider `Leads` model-picker block is removed from **Settings → Models**.
- Session placement for `lead`, `sub-lead`, Personal assistant, and Project leads resolves through each role's configured tier.
- Global default provider ladders (`lead_order` and `worker_order`) move from **Settings → Usage and balancing** to a **Provider ladders** block in **Settings → Models**. **Usage and balancing** keeps usage bars, account splitting, and reserves (including *Save `<provider>` for leads*, which continues to read the top enabled/signed-in provider from `lead_order`).
- Every standalone session role (`lead`, `sub-lead`, `reviewer`, `verifier`, `mapper`, `designer`, `assistant`, `project-lead`) has a provider ladder preference: `'lead'` (`Default: Lead`), `'worker'` (`Default: Worker`), or a custom ordered provider array (with optional `'any'` tail for lead-like roles or any custom ladder — exact validation to be detailed in final Spec). Defaults: `lead`, `sub-lead`, `assistant`, `project-lead` default to `'lead'`; `reviewer`, `verifier`, `mapper`, `designer` default to `'worker'`. Only `scout` and `scout-heavy` have no provider ladder because they run as built-in helpers inside the lead/sub-lead CLI.
- `sub-lead` is no longer forced onto `thread.provider` when starting; it uses its own provider ladder preference.
- For `reviewer` and `verifier`, when `review_families` is `both` (Mix families), their per-role ladder orders candidate providers (respecting `--provider` / `--not-provider` constraints); when `review_families` is locked to a single provider, that single provider still takes precedence.

### 2. Reworked Settings → Models layout
- **Agents block (top):** Thread/build agent roles (`Leads`, `Sub-leads`, `Plan reviewers`, `Checker` + `Reviewers and checkers` family mix, `Code mapping`, `Mockups`, `Scout`, `Scout for bigger changes`), each with a 4-way segmented tier control (`Light | Standard | Heavy | Critical`), live resolved model preview, and (for every role except Scouts) a compact collapsible/dropdown provider ladder control choosing `Default: Lead`, `Default: Worker`, or `Custom`.
- **Provider ladders block:** The two default ladders (`Lead ladder` and `Worker ladder`) right on **Settings → Models**, side-by-side on desktop and stacked on phone, with Up/Down/Remove/`+ Provider` controls (and `"then whatever's left"` on Lead ladder) and a Save button (or immediate save — to be finalized in Spec).
- **Tier models block:** Tabs for each enabled provider (`Claude`, `GPT`, `Antigravity`, etc.); the active provider tab shows its 4 tiers (`Light`, `Standard`, `Heavy`, `Critical`), each with a model picker (including `Not used` and `Other…`) and inline segmented effort pills (`CLI default` plus the model's supported effort levels) instead of a second dropdown, plus any heads-up actions for that provider/tier.
- **Escalation block:** Compact block with the 4 worker step-up segmented controls and live summary text.
- **Assistants block (bottom):** Separate block for `Personal assistant` and `Project leads` (since they don't build directly), each with its own 4-way tier switch, live model preview, and collapsible provider ladder control (`Default: Lead`, `Default: Worker`, or `Custom`).

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
