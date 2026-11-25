---
slug: faster-full-runs
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-25
---

# Faster full test runs

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first.
**Map:** `MAP.md`, plus `docs/maps/full-test-runs.md`.

## Open Questions

### Q1b: When does the full run start (revisits D7)?
- **Context:** Collin: the slow part is the wait after verification passes. D7 makes that wait the whole run. Today the run overlaps the verifiers.
- **Options:** (A) alongside the verifiers each round, as today; (B) once after they pass (D7).
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
| D7 | A build runs one full run, only after its verifiers pass, on the final commit; remediation rounds rely on the picked tests. A failing full run is handled as a failed verification (one more round). | Six full runs in the Settings rework; the picker already checks each round. | user |
| D8 | Every browser spec runs in Chromium; only specs marked browser-sensitive (graph geometry, touch, pixel sampling and the like) also run in Firefox. | Running everything twice is about half the browser suite's time. | user |
| D9 | When full runs overlap (another thread's full run is live), browser workers are shared fairly across them instead of dropping each to 2. | `test-support/browser-workers.js:8` drops overlapping runs to 2 workers, likely why runs feel like 30 minutes. | defaulted |
## Spec

_Filled in as decisions land._

- **Full run timing (D7):** the sub-lead starts no full run alongside the verifiers. It starts one full run on the commit the verifiers passed. Its failure counts as a failed verification and leads to remediation; the next full run waits again for that round's verifiers to pass. Role rules (`protocol/app/sub-lead.md`, `lead.md`, `verifier.md`, `AGENTS.md`) change to match.

- **Browsers (D8):** `viewer/playwright.config.js` runs every spec in Chromium; Firefox runs only specs marked browser-sensitive. The marking mechanism and the initial list (at least graph geometry in `browser.spec.js`, `touch.spec.js`, `background-rendering.spec.js`) are settled in the final Spec pass.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| 1 | Follow imports transitively so picks are smaller | The fallback already runs more, never less | planning | `test-support/pick-tests.js:55-74` reads only direct relative imports in non-browser test files |
| 2 | Flag test-map.json entries pointing at missing files or globs matching nothing | A stale entry only makes picks larger or falls back | planning | Missing targets are skipped silently (`test-support/pick-tests.js:33`, `:76-80`); could live in pick-tests.test.js against the real tree |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds
