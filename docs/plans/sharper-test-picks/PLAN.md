---
slug: sharper-test-picks
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-25
---

# Sharper test picks

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

### Q2: How to make the machine suite faster
- **Context:** waiting on per-file timings (being measured).

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is thorough | Collin picked it on the mode card | user |
| 2 | Machine suite speed-up is in scope | Collin picked "Include it" | user |
| 3 | The map check is a test in `test-support/test/pick-tests.test.js` against the real tracked tree and the working `test-map.json`, failing with a message naming each entry whose test target is a missing file or unknown suite, or whose glob matches no tracked file | Runs with the test-support suite the picker already selects for picker changes; the map has no stale entries today (MAP.md), so it passes on landing | defaulted |
| 4 | Files named as text in tests and helpers count as links, like imports: a spawned or path-read file, and everything it imports, is covered by the tests that name it (directly or through a helper) | Collin picked "Names count as links" over deeper-imports-only-for-unnamed-files and a hand-kept list; it covers the server and machine scripts the map found without anyone maintaining entries, and the full run before each push catches a name built only at run time | user |

## Spec

To be written as decisions land.

### S1. Deeper links in the picker (draft)

- The picker builds a link graph at `head` over tracked files. Links from a file are its
  literal relative imports (today's regex, `pick-tests.js:67-71`) and every string
  literal in it that names another tracked file (Decision 4). Roots are the non-browser
  test files the picker reads today.
- A changed source file is covered by every root that reaches it through any chain of
  links; cycles are handled with a visited set. Each reached root is selected as today's
  `import` reason does, and sets `mapped`/`covered` the same way.
- How a string literal "names" a file, how `test/` helpers are walked, and what happens
  with a link that cannot be resolved are to be settled in the final Spec pass.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
