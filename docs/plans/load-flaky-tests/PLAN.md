---
slug: load-flaky-tests
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-26
---

# Make the whole-project test run reliable when the machine is busy

**Idea:** `IDEA.md`. Map: `MAP.md`, `docs/maps/load-sensitive-tests.md`, `docs/maps/full-test-runs.md`.

## Open Questions

### Q1: Should the full run re-run a failed test before calling the run failed?
- **Context:** Fixing each named test removes the known flakes, but new ones will appear under load. A re-run rule would stop one-off failures from blocking a push, at the cost of letting a real race through when it passes on the second try.
- **Options:** (a) No re-run: fix tests only; a failure is a failure. (b) Re-run each failed test file once; the run passes if the re-run passes, and summary.txt names it as flaky so it can be fixed later. (c) Re-run once only to label the failure as "flaky" or "fails again" in summary.txt; the run still fails either way.
- **Recommendation:** (a), because IDEA.md rules out retries that hide failures, and (b) does exactly that.

### Q2: How should the install suite's check of the real wheelchair folder work?
- **Context:** `install/test/run.sh:234,705` hashes all of `~/.wheelchair` before and after the suite. Live AI sessions keep writing there (conversations, history, caches under `accounts/<name>/`), so on a machine running wheelchair it always fails. It exists to catch the suite or the code it runs writing into the real folder instead of its fake home.
- **Options:** (a) Byte-check only the files wheelchair's own code writes there (everything outside the AI tools' own folders and files under `accounts/<name>/`), and ignore what the AI tools write while running. (b) Give every fixture a unique marker and fail if any file under the real folder that changed during the suite contains or is named by it. (c) Both.
- **Recommendation:** (a): it keeps a byte-for-byte check on every file wheelchair could leak, and needs no marker plumbing.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Load is reproduced by pinning the test and some CPU-burning helper processes to one CPU, not by loading the whole machine | Reproduces heavy contention for the test under check without slowing other threads on the shared machine | defaulted |
| 2 | Flaky tests are fixed by widening the gap between the good and bad outcome (longer budgets, waiting on events instead of fixed sleeps, time deadlines instead of loop counts), never by removing or loosening an assertion | IDEA.md: tests stay as strong as before | defaulted |
| 3 | The full-run stop test is fixed in the runner too: after a stop signal the runner waits for every process in both suites to end before exiting | The runner leaves browser test processes running after it exits; the test is right to expect them stopped | defaulted |
| 4 | No mockups: nothing here is visible in an app | Test-only and runner change | defaulted |

## Spec

Draft; grows as decisions land.

### General rules for every fix

- No assertion is removed, and no expected value is loosened. A timing budget may grow; a
  check that "nothing happened" must wait past the timer it guards with margin, and that
  timer is set long enough that the steps before it fit under load.
- Waits poll against a time deadline, never a fixed number of iterations.
- A waiter for a request or response is registered before the action that causes it.
- When a fix's cause is a product race rather than a test race, the product is fixed.

### S1. A load harness

New `test-support/under-load.sh [--hogs N] [--repeat K] -- <command...>`: pins itself to
one CPU (`taskset`), starts N busy-loop helpers on that same CPU (default 3), runs the
command K times (default 5), prints `pass <p> of <k>`, and exits 0 only if all passed.
It kills the helpers on exit and on TERM/HUP/INT. A test under `test-support/test/`
checks the count line, the exit code and that no helper outlives it.

### S2. Full-run stop (`test-support/full-run.sh`, `test-support/test/full-run.test.js:50`)

Cause: the browser job's leader is a subshell; `wait` returns when it dies, before its
child has handled TERM, so the runner exits first. The fixture stub also writes `start`
before installing its trap. Fix: after TERM, the runner polls each stopped process group
until it is empty (up to 10 s, then KILL the group) before exiting 1; the stub installs its
trap before writing `start`. The test keeps both `stopped` assertions.

### S3. Pre-prefix holder (`viewer/test/lifecycle.test.js:57-77,255`)

Cause (likely): the port is probed free, released, then bound by the holder; another
process can take it in the gap and the holder exits 1 on EADDRINUSE. Fix: the holder
listens on port 0 and prints its bound port, which the test then uses; an early exit's
error includes the holder's stderr. Same for any other fixture in that file using the
probe-then-child-binds pattern.

### S4. Quiet test 6 (`viewer/test/app-quiet.test.js:41`) and its siblings

Cause: a 50 ms grace between the turn ending and the worker's message; under load the
message lands after the grace and the nudge fires. Fix: tests whose check is "no nudge"
run with a grace long enough for their steps (at least 2 s) and wait past it with margin
before checking.

### S5. Verifier report retry (`viewer/test/app-hub.test.js:1327`)

Fix: the 1 s polling deadline becomes 10 s; assertions unchanged.

### S6. Archive cancels a stalled upload (`viewer/test/app-uploads-archive.test.js:65`)

The test's "archive finished before the default machine timeout" check has under 5 s of
margin. Reproduce with S1, find which budget fails, and widen the gap: the machine timeout
the test distinguishes from is set long in this test, and the archive budget sits well
below it, so a slow machine still passes and a waiting archive still fails.

### S7. Switch HTTP (`machine/test/switch-http.test.js:107,136`)

Fix: `waitFor` polls to a 20 s time deadline instead of 300 iterations.

### S8. Browser specs (`viewer/test/app-threads.spec.js:573`, `viewer/test/app-agents-decks.spec.js:247`)

Reproduce each with S1 and a Playwright trace, find the cause, and fix it under the
general rules. Raising a test's time budget (`test.slow()`) is allowed only when the trace
shows plain slowness.

### S9. Install suite's real-folder check

Pending Q2.

### S10. Full-run pass rule

Pending Q1.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks
