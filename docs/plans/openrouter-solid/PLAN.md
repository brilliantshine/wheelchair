---
slug: openrouter-solid
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-20
---

# Make OpenRouter agents solid

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first. Map: `MAP.md`
and `docs/maps/openrouter-hardening.md`. Prior plan: `docs/plans/openrouter-harness/PLAN.md`.

## Open Questions

(none)

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Plan mode is proof-of-concept | User's pick | user |
| 2 | Spend per thread and per agent is out of scope | User removed it from the idea | user |
| 3 | Spend line on the usage view is in scope | User reported it as a bug (screenshot) | user |
| 4 | OpenRouter thinking levels map 1:1 to Pi's `--thinking` for the app's existing low, medium, high, xhigh, max; Pi's off and minimal are not offered | Keeps one set of levels across providers | defaulted |
| 5 | OpenRouter asides use Pi's `--fork` for the first turn and `--session` to resume, in non-interactive JSON mode, with read-only asides limited to Pi's read tools as reviewers are today | Mirrors Claude/Codex aside flow; reuses the existing reviewer tool allowlist | defaulted |
| 6 | A failed transcript read when a turn ends is retried and never treated as an empty report; only a transcript that is truly absent or has no reply counts as empty | Losing a report in normal use is always fixed | defaulted |
| 7 | Pi older than 1.5.2 is refused; newer versions run, Settings marks them untested, and a Pi start or turn failure on an untested version names the version as the likely cause | User picked run-with-warning over blocking | user |

## Spec

(Written once the open questions are settled.)

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
