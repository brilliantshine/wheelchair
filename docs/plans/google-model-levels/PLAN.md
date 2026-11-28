---
slug: google-model-levels
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-27
---

# Google model list and levels

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first.

## Open Questions

### Q1: A step up asks for an effort the model does not have
- **Context:** Live `agy` (checked 2026-11-27) refuses a start whose effort a model lacks: `gemini-4-argon --effort xhigh` → "gemini-4-argon has no "xhigh" effort (available: low, medium, high)"; `gemini-4-hydrogen --effort max` likewise. No listed model has a `max` level, and wheelchair's default effort ceiling is xhigh.
- **Options:** (a) the hub caps the effort at the model's top level, and the escalation rules treat a model at its top level as having no effort step left, so the next step moves tier; (b) the hub refuses such a start with the model's levels in the reason, and the sub-lead moves tier.
- **Recommendation:** (a): no wasted failed start, and the rule matches the existing "a tier already at the ceiling takes no effort step".

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Use agy's own base model ids plus `--effort` (e.g. `--model gemini-4-hydrogen --effort high`) rather than mapping effort to suffixed ids. | Live checks 2026-11-27: `agy -p … --model gemini-4-hydrogen --effort high`, `gemini-4-neon --effort low` and `gemini-3.8-flash --effort medium` succeed; `gemini-4-hydrogen` with no effort succeeds; `gemini-4-hydrogen-low --effort xhigh` fails ("conflicts with --effort=xhigh"), so today's suffixed pins break effort escalation outright. | defaulted |
| 2 | Group levels generically from `agy models`: an id `<base>-<level>` with level in low, medium, high, xhigh, max, whose display name ends in `(<Level>)`, belongs to model `<base>` (label = name without the level part). Ids that do not fit stay single models with no levels. | IDEA requires a general rule, not a list of names. | defaulted |
| 3 | Models with no levels (Orchestrator variants, Claude and GPT-OSS inside agy) never get `--effort`; their effort choice in Settings is only "CLI default", and escalation skips their effort step. | agy refuses `--effort` for them ("--effort is not supported for model …"). | defaulted |
| 4 | Saved pins with a level suffix (including shipped defaults `gemini-3.8-flash-low/-medium/-high`) are read as base + that effort when the pin has no effort of its own; shipped defaults change to base ids with effort. | IDEA: saved settings keep working. | defaulted |
| 5 | The model list is fetched fresh from `agy models` whenever Settings loads it (about 1 s); the saved copy is only a fallback when agy fails. | IDEA: new models appear the next time Settings opens. | defaulted |
| 6 | No designer: the only visible change is fewer, plainer entries in an existing dropdown. | Trivial visible part. | defaulted |

## Spec

(Written once the open questions are settled.)

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
