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

### Q1: How should the picker treat files tests reach without importing them?
- **Context:** MAP.md "Dependency shape and non-import readers": `viewer/test/helpers/server.js:81`
  spawns `viewer/server.js`, so every module the server imports is used by all 53 viewer
  tests that use the helper, with no import chain from those tests. Machine tests spawn
  `machine/lib/tool-bridge.js`, `hook-post.js`, `statusline.sh` by built path; one uses
  `require(process.env.CHAR_MACHINE_SERVICE || '../service')`. A deeper import match marks
  a file covered and switches off today's whole-suite fallback (`pick-tests.js:89-96`).
- **Options:** (a) treat a file name written as text in a test or helper as a link too,
  like an import, so spawned and path-read files and everything they import count;
  (b) use deeper imports only for files no test or helper names as text anywhere, else
  keep today's behaviour; (c) deeper imports only, plus hand-written map entries for
  spawned files.
- **Recommendation:** (a).

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

## Spec

To be written as decisions land.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
