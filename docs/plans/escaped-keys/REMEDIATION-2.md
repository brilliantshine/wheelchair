# Remediation 2 — escaped-keys

Verification attempt 2 on `9ccd916d9965de7e9c2133bc844c3e3ab6a7c677`: verifier (claude / claude-opus-5-5) VERDICT: FAIL.

## Gaps (verbatim)

- GAP: E1 pinned fixture (c) and the Spec validation command — Remediation 1 switched the limit from wall time to CPU time, assuming CPU time ignores machine load. It doesn't. Under load, fixture (c) uses more than its 3000 ms CPU limit, so the Spec command fails as written. (4 of 4 runs at load 28–56 on 16 cores: 3416.8, 3348.1, 3164.4, 3416.0 ms CPU; (d) 2638–2836 ms.) The starter's full run on the same commit failed the same way ((c) 3189.0 ms CPU).

The gap survived Remediation 1. The lead chose option A: PLAN.md Decision 13 changes E1's limits to CPU time, (o) under 3 s, (a)-(d) under 10 s, with the budget and all output checks unchanged.

Not sent to remediation (files this change does not touch; the lead handles them in its full run against main): viewer-node `6 message clears debt` (`viewer/test/app-quiet.test.js:41`) and `archive through the hub cancels a stalled upload to the real machine`; test-support `HUP stops both suites`.

## R2-T1. Test limits match Decision 13

In `machine/test/key-redact.test.js`, the `timed(...)` limit for (o) goes from `1000` to `3000` (line 204), and for (a), (b), (c), (d) from `3000` to `10000` (lines 210, 216, 233, 259). Nothing else changes.
