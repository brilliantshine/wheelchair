---
slug: remove-owner-name
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-19
---

# Remove the owner's name from wheelchair

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

### Q1: What do agents call the person instead of "Collin"?
- **Context:** About 100 mentions across `protocol/` (lead, sub-lead, cards, aside, verifier, worker, graphs, diagrams, sensitivity), plus `viewer/app/settings.js:144,145,158` and `machine/service.js:1952`. See MAP.md §1.
- **Options:** (a) "the user" everywhere; (b) a name set in Settings, substituted into the rules when a session starts, falling back to "the user".
- **Recommendation:** (a). It needs no new setting or prompt templating, and agents already get the person's name from their CLI context when it matters.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is two-part | Chosen on the mode card | user |
| 2 | Pronouns for the person become they/them/their | "he/his" assumes the owner; neutral fits any installer | defaulted |
| 3 | The sub-lead's Log marker `Deferred and finished at Collin's choice` is written with the new wording from now on, and the readers (sub-lead.md 1a, lead.md) accept both the old and new phrase | Existing plans already carry the old phrase (`protocol/app/sub-lead.md:32,257`) | defaulted |
| 4 | Example home paths in protocol (e.g. `protocol/graphs.md:493`) use a placeholder such as `/home/you` | Illustrative only | defaulted |
| 5 | Router files agents read (`AGENTS.md:17`, `sudo-helper/AGENTS.md:3`, `protocol/app/AGENTS.md`) are in this thread's scope | They reach agents like the role rules do | defaulted |
| 6 | Imported handoff history shows the stored `who: collin` value as "You" on screen; the stored value itself is not changed | Visible text (`viewer/pages/thread.js:231`) without touching data formats | defaulted |
| 7 | Tests that assert changed strings (e.g. `machine/test/sudo.test.js:91`, `viewer/test/app-settings.test.js:273,278`) are updated in this thread; other test mentions are deferred | Keeps the suites green | defaulted |

## Spec

(Grows as decisions land.)

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| D1 | Rename stored identifiers: `collin_at`, message source `'collin'`, `resolved_by: 'collin'`, handoff `who: 'collin'` | Never shown to agents or on screen; needs conversion of saved threads and handoff compatibility | planning | MAP.md §3 and `docs/maps/owner-name-state.md`: thread JSON, sent JSONL, handoff v1 enum (`viewer/app/handoff.js:29`, `handoff-import.js:13`), API.md:22. Old files must still import; decide old-reader export compatibility |
| D2 | Rewrite code comments that mention Collin | Not read by agents at runtime or shown on screen | planning | MAP.md §4 and the runtime files in §3 (e.g. `viewer/app/sessions.js:476`, `viewer/pages/thread.js:433`, `viewer/server.js:499`) |
| D3 | Rewrite remaining test and fixture mentions | Tests stay green either way; captured fixtures are historical | planning | MAP.md §4 list, minus the tests updated under Decision 7 |

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
