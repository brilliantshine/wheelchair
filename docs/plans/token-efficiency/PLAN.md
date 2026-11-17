---
slug: token-efficiency
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-16
---

# Make wheelchair use fewer tokens

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

### Q1: Is the scout the CLI's built-in helper or a new app session?
- **Context:** MAP.md. Claude, Codex and Antigravity each document a built-in subagent that can take a cheaper model; the app does not disable it. A new app role needs a role file, both role sets, start rules, placement, worktree policy and Settings UI (`viewer/app/sessions.js:35-47,461-498`, `viewer/app/balancer.js:11-17`). Claude's Agent tool takes model aliases (haiku/sonnet/opus), not arbitrary ids. Codex/Gemini helper behaviour inside app sessions is untested.
- **Options:** (a) built-in helper: the hub tells the lead/sub-lead its scout model in its starting instructions; the agent calls its own helper with that model and gets the answer inside the same turn. (b) new `scout` app role: the lead starts it with `wc.js session start --role scout`; the answer arrives later as a `result`.
- **Recommendation:** (a). Answers come back in the same turn, so asking the scout costs no extra waiting, and it is far less code. Where a provider's helper can't use the model, the agent reads code itself as today.

### Q2: How does the sub-lead's context stay small?
- **Context:** sub-lead.md:129-152 makes it read every worker diff and rerun validation; diffs are its largest input (~3M chars across past builds). Restart already rebuilds from PLAN.md and reports (sub-lead.md:25-36).
- **Options:** (a) the scout reads each diff against the worker's brief and reports; the sub-lead still reruns validation itself. (b) the hub gives the sub-lead a fresh context between tasks. (c) both.
- **Recommendation:** pending Q1.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Codex and Antigravity subagent model choice untested in app sessions | live check before approval | no | |

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Scout model is a Settings choice | Collin, on confirming IDEA.md | user |
| 2 | Sub-lead gets its own model cell per provider, initially equal to the lead cell, so nothing changes until Collin changes it | no behaviour change on upgrade | defaulted |
| 3 | Scout setting sits in Other agents as a tier selector like reviewer/verifier/mapper, default Light | matches the existing pattern and Collin's "light tier" | defaulted |

## Spec

(grows as decisions land)

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
