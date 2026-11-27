---
slug: new-thread-stubs
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-27
---

# Save an idea as a stub from the New thread screen

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

### Q1: Can a saved stub carry attached files?
- **Context:** uploads and messages need a live lead today (`viewer/app/routes.js:160`, `viewer/app/routes.js:755`); a stub has none until opened.
- **Options:** (a) allow: upload files into the unopened stub and add their `[attached: path]` lines to its saved context; (b) not with a stub: the save button is off while files are attached, with a hint.
- **Recommendation:** (a) — ideas parked from a phone often come with a screenshot.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode: thorough | Collin's pick | user |
| 2 | No designer: the visible change is one button and a hint on an existing form | Trivial visible part; follows the form's existing button style | defaulted |
| 3 | Saving a stub needs a non-empty message; the save button is disabled otherwise | An empty stub has nothing for its lead to start from | defaulted |
| 4 | The stub's title is the message's first line cut to 60 characters, as Start does; its context is the full message | Same naming as threads started now | defaulted |
| 5 | The stub has no parent, `depends_on_parent: false`, no commits; it opens straight away with the existing Open button | Nothing to wait on | defaulted |
| 6 | A parentless stub's transcript marker reads "Started from a saved idea" instead of "Started from parent thread"; parent-only text on its page is not shown | IDEA: nothing may claim another thread made it | defaulted |
| 7 | Other leads may add to it (`adds_to`) like any unopened stub | Same rules as other unopened stubs; additions are what stubs are for | defaulted |
| 8 | Button label "Save for later", beside Start; after saving, the browser goes to the stub's page | Plain words; the stub page already shows the context and Open | defaulted |

## Spec

(grows as decisions land)

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
