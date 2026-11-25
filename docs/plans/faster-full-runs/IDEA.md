---
slug: faster-full-runs
status: draft   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-25
---

# Faster full test runs

## What we're building

Make the "full run" (the one run of every test suite that must pass before a build's
work is pushed) take less time, and make a build need fewer of them. Along the way, fix
the flaky clash where two test servers grab the same port, and tidy the leftovers from the
earlier faster-verification work that help with this.

## Why — the problem

A full run feels like about 30 minutes, and a build can need one per round of fixes: the
Settings rework ran six. Recent logs show a single run takes 15 to 20 minutes on its own:
the browser tests (every test twice, once in Chromium and once in Firefox) take about 10,
the machine tests about 6, and the suites run one after another. Runs also fail now and
then because test servers started in parallel pick the same port, which forces a re-run.

## What good looks like

- One full run finishes in clearly less time than today on the same machine.
- A build that needs several rounds of fixes spends far less total time on full runs.
- The port clash between test servers no longer fails runs.
- A full run's summary says how long each suite took, so the next speedup can be aimed.
- Nothing that a full run catches today slips through unnoticed.

## Not doing

- Moving tests to another machine or a cloud CI service.
- Rewriting or deleting tests to make them faster, beyond fixing the port clash.
- Making the test picker smarter (following imports more than one level deep) or adding a
  check for stale test-map entries: these go to the follow-up thread.

## Constraints

- Runs on Collin's 16-core machine, possibly while other threads also run tests.
- Builds must still get a full run before their work reaches a pull request.
