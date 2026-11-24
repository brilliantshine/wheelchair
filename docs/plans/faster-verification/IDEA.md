---
slug: faster-verification
status: confirmed   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-23
---

# Faster verification checks

## What we're building

Verification checks that run the tests covering what changed instead of the whole suite every time, with one full run before a push. Browser tests use more of the machine when nothing else is testing. The flaky one-second timing test stops failing under load.

## Why — the problem

Each check runs every test (about 945 Node tests, about 1,500 browser tests in two browsers, plus the machine tests), often twice to compare failures with main. A check takes 15–25+ minutes, and one thread needed five checks. One timing test fails under load even on main, so every check spends time proving that failure isn't new.

## What good looks like

- A re-check after a small fix finishes in a few minutes, not 15–25.
- A clean merge of already-tested main changes doesn't trigger a full run.
- A full run still happens before anything is pushed.
- With no other tests running, the browser suite finishes noticeably faster; when runs overlap, the machine isn't saturated.
- The timing test no longer fails just because the machine is busy.

## Not doing

- Making individual tests faster beyond the flaky timing test.
- Changing which tests exist or what they check.
- Changing CI on GitHub.

## Constraints

- Concurrent test runs from several threads must not saturate the machine (the reason for today's 2-worker cap).
- Nothing gets pushed without a full test run, except a conflict-free merge of main into work whose full run passed (Collin asked for that merge to get a targeted run).
