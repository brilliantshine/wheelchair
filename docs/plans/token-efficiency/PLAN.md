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

### Q1: How does the sub-lead's context stay small?
- **Context:** sub-lead.md:129-152 makes it read every worker diff and rerun validation; diffs are its largest input (~3M chars across past builds). Restart already rebuilds from PLAN.md and reports (sub-lead.md:25-36).
- **Options:** (a) the scout reads each diff against the worker's brief and reports; the sub-lead still reruns validation itself. (b) the hub gives the sub-lead a fresh context between tasks. (c) both.
- **Recommendation:** (a). The verifier still checks the whole build at the end, so a cheaper diff read does not weaken the gate. (b) is hard to time: workers run in parallel, so there is rarely a quiet moment between tasks, and each restart re-reads IDEA, PLAN and MAP. Revisit (b) only if re-measuring shows sub-lead context still grows.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Codex and Antigravity subagent model choice untested in app sessions | live check before approval | no | |

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Scout model is a Settings choice | Collin, on confirming IDEA.md | user |
| 2 | Sub-lead gets its own model cell per provider, initially equal to the lead cell, so nothing changes until Collin changes it | no behaviour change on upgrade | defaulted |
| 4 | Scout is the CLI's built-in helper (Claude Agent tool, Codex subagent, Antigravity subagent), not a new app role | answers return in the same turn; far less code | user |
| 3 | Scout setting sits in Other agents as a tier selector like reviewer/verifier/mapper, default Light | matches the existing pattern and Collin's "light tier" | defaulted |

## Spec

### Settings
- New per-provider `sub-lead` model cell beside `lead` in `codex/model.sh`, the API and the Models page; on first load it copies the lead cell. `balancer.js` resolves sub-leads to it.
- New Other agents selector `scout`, a tier (`light` default), stored with reviewer/verifier/mapper.

### Scout
- At start, the hub resolves the scout tier to a model for the session's provider and adds one layer to the lead's and sub-lead's starting instructions: the scout model, and the rule below. For Claude the model is given as the Agent tool alias for its family (haiku, sonnet, opus); a model with no alias means no scout.
- lead.md and sub-lead.md rule: questions that need reading more than a couple of files go to the built-in helper on the scout model, with a brief asking for conclusions with file:line evidence, not file dumps. The agent acts on those conclusions and opens a file itself only to confirm a specific line. With no scout model, read code as today.

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
