---
slug: faster-full-runs
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-25
---

# Faster full test runs

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first.
**Map:** `MAP.md`, plus `docs/maps/full-test-runs.md`.

## Open Questions

### Q1: When does a build run the full run?
- **Context:** Today the sub-lead starts a full run on the verification commit alongside
  the verifiers, and every remediation commit starts a new one (`protocol/app/sub-lead.md:249-256`,
  `:273-283`). The Settings rework ran six, most failing on something. Verifiers already
  run picker-selected tests on every round.
- **Options:** (A) one full run, only once the verifiers pass, on the final commit;
  (B) as today, one per round.
- **Recommendation:** A.

### Q2: Which browsers run which browser tests?
- **Context:** Every one of the 52 browser spec files runs in Chromium and in Firefox
  (`viewer/playwright.config.js:12-20`); that doubling is about half of the 9–11 minute
  browser suite. Only some specs are browser-sensitive (graph geometry, touch, pixels).
- **Options:** (A) Chromium for all, Firefox only for marked browser-sensitive specs;
  (B) both for everything (today).
- **Recommendation:** A.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | Mode two-part, chosen before PLAN.md existed. | Time savings now; smaller leftovers later. | user |
| D2 | `full-run.sh` runs the browser suite and the other suites side by side instead of one after another. | Logs show browser ~10 min and machine ~6 min running in sequence, with nothing making them wait for each other. | defaulted |
| D3 | Fix the free-port race in `viewer/test/helpers/server.js` (probe closes before the viewer binds, `:15-23`, `:73-76`). | Pre-existing flake that grows with more workers; blocks raising the worker count. | defaulted |
| D4 | After the port fix, the lone full-run browser worker cap is set from a measured comparison rather than kept at 6. | The cap of 6 was chosen because parallel servers clashed. | defaulted |
| D5 | `summary.txt` records each suite's seconds (old Deferred row 3). | Small, and needed to aim further speedups. | defaulted |
| D6 | Qualify lead.md repair step 7's full-run phrase with the `Test picker and full run` heading (old Deferred row 5). | Protocol edits all map to every suite; batch it here. | defaulted |

## Spec

_Filled in as decisions land._

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| 1 | Follow imports transitively so picks are smaller | The fallback already runs more, never less | planning | `test-support/pick-tests.js:55-74` reads only direct relative imports in non-browser test files |
| 2 | Flag test-map.json entries pointing at missing files or globs matching nothing | A stale entry only makes picks larger or falls back | planning | Missing targets are skipped silently (`test-support/pick-tests.js:33`, `:76-80`); could live in pick-tests.test.js against the real tree |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds
