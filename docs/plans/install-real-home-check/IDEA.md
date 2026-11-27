---
slug: install-real-home-check
status: confirmed   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-26
---

# Install tests: only check wheelchair's own files in the real folder

## What we're building

A change to the install test suite's check that the real wheelchair folder
(`~/.wheelchair`) is left untouched. The check will compare only the files wheelchair
itself writes there, and ignore what the AI tools write.

## Why — the problem

The check fails on every machine that is running wheelchair, including on main. Live AI
sessions and wheelchair's own services keep writing into the real folder while the suite
runs, so the before and after copies never match. A check that always fails can't catch
anything. Its job is to catch the suite, or code it runs, writing into the real folder
instead of the suite's fake home.

## What good looks like

- The install suite passes on a machine with wheelchair and AI sessions running.
- If a test (or the code under test) writes a wheelchair file into the real folder, the
  check still fails and names the file.
- The suite's other uses of the same compare helper (fixture isolation, running the
  installer twice) still compare everything, as today.

## Not doing

- Checking files only the AI tools write (their names change by version).
- Changing what wheelchair writes or where.
- The other flaky-test fixes from the "Make flaky full-run tests reliable under load"
  thread (docs/plans/load-flaky-tests/).

## Constraints

- The check must run while a real hub, machine service and AI sessions are live on the
  same machine.
