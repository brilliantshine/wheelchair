---
slug: sharper-test-picks
status: confirmed   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-25
---

# Sharper test picks

## What we're building

Two changes to how wheelchair checks its own work. A check flags test-map entries (the
list telling the test picker which tests cover which files) that point at tests that no
longer exist, or at file patterns that match nothing. And the machine tests finish
faster, so a full run takes less time.

## Why — the problem

Every push waits for a full run. A stale test-map entry is skipped without a
word, so nobody learns that a mapping stopped meaning anything. The machine suite takes
about 6.5 of a full run's 9 minutes, so it decides how long a push waits.

## What good looks like

- A test-map entry pointing at a missing test, or a pattern matching no file, makes a
  test fail with a message naming the entry.
- A full run on this machine takes noticeably less than today's 9 minutes 21 seconds,
  with the machine suite no longer the longest part on its own.

## Not doing

- Changing which tests the picker chooses. Following imports deeper was planned, but it
  mostly made picks larger and could skip tests it could not see (review round 1);
  Collin chose to leave the picker as it is.
- Changing which suites exist or what a full run covers.
- Speeding up the browser or viewer Node suites, beyond whatever the new scheduling
  gives them.

## Constraints

- Works on Node 20, which the always-on service runs.
- No test is dropped or weakened to save time.
