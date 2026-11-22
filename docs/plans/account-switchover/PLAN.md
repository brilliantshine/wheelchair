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

### Q2: Should Collin see when a switch happens?
- **Context:** IDEA.md asks for no action from Collin; it does not say whether a switch is shown.
- **Options:** (a) shown only on the agent's box on the Agents screen (which account it is on now);
  (b) also a one-line note in the thread; (c) not shown at all.
- **Recommendation:** (a).

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
| 6 | A switched agent resumes its same conversation on the new account; if resume fails for that CLI, it restarts fresh with its original brief and a pointer to the old transcript. | Picked on Q1: resuming keeps the agent's working memory. | user |
| 7 | The fresh-restart fallback reuses today's restart paths: a lead gets the `[wc:context restart]` context, a worker `--replaces`, a sub-lead resumes from PLAN.md and `reports/`, reviewers, verifiers and mappers start fresh with their original brief. | These paths already exist and are tested. | defaulted |
| 8 | A switch happens only when a limit is actually hit, never ahead of it. | IDEA.md Not doing: no spreading work ahead of time. | defaulted |

## Spec

(Grows as decisions land.)

### Switching on a limit

1. When the machine reports a limit hit for a live session (Claude: StopFailure
   `rate_limit`, `machine/adapters/claude.js:94-96`; Codex: reached limit read from
   transcript usage at turn end, `machine/adapters/codex.js:149-151`), the hub looks for
   another signed-in account of the same provider with room (Decision 2).
2. None found: today's hold-until-reset and `Continue.` (Decision 4).
3. Found: the hub stops the CLI, copies the CLI's conversation file into the new account's
   directory, and relaunches the session under the new account with resume, keeping the
   session name and role (Decisions 5, 6). The relaunched session is told the conversation
   was moved and to carry on.
4. Resume fails (the CLI refuses or the session does not become ready): fresh restart per
   Decision 7.

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
