---
slug: test-temp-cleanup
status: draft   # draft | confirmed
created: 2026-11-15
---

# Tests clean up their temp folders

## What we're building

Every test suite in this repo removes the temporary folders it creates once it is done
with them, whether the tests pass, fail, or the run is interrupted. A run of the full
test suite leaves the machine's temp space as it found it.

## Why — the problem

On 2026-11-15 the machine's `/tmp` ran out of room for new files: not out of space, but out
of entries (it holds about a million files and folders). Every test that needed a temp
folder then failed, and builds stalled in every thread on the machine. About 16,000
leftover test folders were the cause, mostly from the machine service's tests (about
12,700) and the viewer's tests (about 3,400). A one-off cleanup freed room, but each test
run adds more, so it will happen again.

The shell-script suites (install, codex, seen, sensitivity) already remove their folder
when they exit. The leaks are in the JavaScript suites: the machine tests and the viewer
tests, both the unit tests and the browser tests.

## What good looks like

- Run any suite, pass or fail: no new test folders remain afterwards.
- Stop a run with Ctrl-C: its folders are removed too.
- Folders that a crashed or force-killed run left behind do not pile up forever.
- No test gets slower or flakier because of the cleanup.

## Not doing

- Cleaning temp files that the code under test creates on its own (outside the test's
  folder), or that external tools like git or the CLIs create.
- Changing product code to fix test hygiene.
- Any cleanup done by an agent step: cleanup is code in the suites themselves.

## Constraints

- Subagents never delete files: the removal must be part of the suites' own code.
- A folder may only be removed once every process the test started has stopped writing
  to it.
- The viewer unit suite must keep working on Node 20 (the always-on service) and Node 26.
- Nothing may delete another run's folder that is still in use (several threads run tests
  on the same machine at once).
