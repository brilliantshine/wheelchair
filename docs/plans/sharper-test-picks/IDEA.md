---
slug: sharper-test-picks
status: draft   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-25
---

# Sharper test picks

## What we're building

Three changes to how wheelchair checks its own work. The test picker (the script that
chooses which tests cover a change) follows imports through helper files, so a change
reached only through a helper picks the tests that use it instead of a whole suite. A
check flags test-map entries that point at tests that no longer exist, or at file
patterns that match nothing. And the machine tests finish faster, so a full run takes
less time.

## Why — the problem

Agents run the picker's tests on every check, and every push waits for a full run. When
the picker cannot see that a test uses a file, it falls back to the whole suite, so
targeted checks run far more than they need. A stale test-map entry is skipped without a
word, so nobody learns that a mapping stopped meaning anything. The machine suite takes
about 6.5 of a full run's 9 minutes, so it decides how long a push waits.

## What good looks like

- A change to a file that tests reach only through a helper picks those tests, not a
  whole suite.
- A change still picks every test that uses the file, including tests that start it as a
  separate program, read it by path, or reach it in some other way an import does not
  show. When the picker cannot be sure, it runs more, never less.
- A test-map entry pointing at a missing test, or a pattern matching no file, makes a
  test fail with a message naming the entry.
- A full run on this machine takes noticeably less than today's 9 minutes 21 seconds,
  with the machine suite no longer the longest part on its own.

## Not doing

- Changing which suites exist or what a full run covers.
- Speeding up the browser or viewer Node suites, beyond whatever the new scheduling
  gives them.
- Rewriting the picker as a full JavaScript parser.

## Constraints

- Works on Node 20, which the always-on service runs.
- No test is dropped or weakened to save time.
