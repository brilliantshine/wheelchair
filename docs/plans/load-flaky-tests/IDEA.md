---
slug: load-flaky-tests
status: draft   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-26
---

# Make the whole-project test run reliable when the machine is busy

## What we're building

A whole-project test run (`bash test-support/full-run.sh`) that gives the same answer
whether the machine is idle or busy with other threads. Each test that now fails only
under load gets its cause found and fixed, and the install test stops failing because
live sessions write to the real wheelchair folder.

## Why — the problem

Every pushed commit needs a passing full run. When other threads load the machine (load
averages of 14 to 56 seen on 16 cores), a different test fails on almost every run and
then passes when run again or alone. Seen in the "Hide keys printed in escaped form"
thread (PR #201), which touched none of these files:

- browser: `viewer/test/app-threads.spec.js:573` phone approval / offer press (30 s wait
  for a request, Firefox); `viewer/test/app-agents-decks.spec.js:247` popover across a
  refresh, page scrolled (Chromium)
- viewer-node: `viewer/test/lifecycle.test.js:255` pre-prefix holder ("holder exited 1");
  `viewer/test/app-quiet.test.js:41` "6 message clears debt"; the archive / stalled
  upload test; a verifier-report retry test
- machine: a switch-http test
- test-support: `test-support/test/full-run.test.js:50` "HUP stops both suites"
- install: `install/test/run.sh:705` "real wheelchair directory is byte-identical after
  suite" fails even on main, because live sessions write to `~/.wheelchair` during it

Each false failure costs a re-run, a confirm-on-main check, or a wrong "this change broke
something" signal to leads, sub-leads and verifiers.

## What good looks like

- On a busy machine, full runs of an unchanged commit pass, as they do on an idle one.
- Each named test still catches the bug it was written for: a test made to pass by
  dropping or loosening its check does not count.
- The install suite passes while wheelchair sessions are running, and still catches the
  suite writing into the real wheelchair folder.
- Where a failure is real (a product race, not a test race), it is fixed in the product
  or reported, not hidden.

## Not doing

- Adding blanket retries that hide failures.
- Speeding up the full run or changing which suites it runs, beyond what reliability needs.
- Fixing flaky tests not named here, unless found to share the same cause.

## Constraints

- Follow `CONTRIBUTING.md`: tests stay as strong as before.
- Tests must still run on a loaded, shared machine alongside other threads' full runs.
