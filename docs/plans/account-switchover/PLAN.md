---
slug: account-switchover
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-21
---

# Switch accounts when one hits its limit

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here.

**Map:** `MAP.md` and `docs/maps/account-switchover-runtime.md`.

## Open Questions

### Q1: How does a switched agent carry on its work?
- **Context:** Today a limited session stays on its account and gets `Continue.` after
  reset (`viewer/app/sessions.js:593-608`, `:886-893`). CLI conversation state lives in the
  account directory (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`); the machine keeps its own copy of
  transcripts (`machine/service.js:1376-1423`). Nobody has checked whether a conversation
  from one account can be resumed under another.
- **Options:** (a) Resume the same conversation on the new account (copy the CLI's
  conversation file into the new account directory and relaunch with resume), falling back
  to (b) when resume fails; (b) always start a fresh session on the new account, briefed
  with the original brief plus where the old transcript is.
- **Recommendation:** (a) with (b) as fallback; the build's first task proves resume works
  per CLI.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is two-part. | Chosen on the mode card. | user |
| 2 | The new account is picked by the existing placement rules (`viewer/app/balancer.js`), limited to the same provider and excluding the limited account. | Reuses the existing usage, reserve and sign-in checks; IDEA.md rules out crossing providers. | defaulted |
| 3 | Switching applies to every role the hub starts (lead, sub-lead, worker, reviewer, verifier, mapper). | IDEA.md "What good looks like". | defaulted |
| 4 | With no other account of that provider having room, today's hold-until-reset then `Continue.` is kept unchanged. | IDEA.md fallback. | defaulted |
| 5 | The switched session keeps its session name and role, so cards, messages and the starter relationship carry on. | Other sessions address it by name; renaming would break messages in flight. | defaulted |

## Spec

(Grows as decisions land.)

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
