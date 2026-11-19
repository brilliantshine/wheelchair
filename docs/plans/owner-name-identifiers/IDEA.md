---
slug: owner-name-identifiers
status: draft   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-19
---

# Finish removing the owner name

## What we're building

The last part of taking the owner's name out of wheelchair. The app still saves the
user's messages, button presses and last-activity time under a `collin` label in its
thread data and handoff files, and some code comments, tests and test data still use the
name. This replaces those with a neutral "user" wording.

## Why — the problem

The first pass (PR #123) took the name out of everything agents read and everything shown
on screen, but deliberately left the saved labels, comments and tests, because changing
saved data needs care. Until they change, the name is still baked into the project and into
every thread's saved files, so anyone else running wheelchair inherits it.

## What good looks like

- New threads, messages, presses and handoff exports no longer record `collin`.
- Threads saved before the change still open, sort, show queued messages and restart
  exactly as before.
- Handoff files exported before the change still import.
- A file exported after the change can still be imported by a wheelchair that hasn't been
  updated yet (or, if that can't be kept, the user agreed to drop it).
- Code comments and hand-written tests no longer use the name; all test suites pass.

## Not doing

- Changing what anything looks like on screen or how threads behave.
- Agent rules and prompts (done in the first pass).
- Git history, commit authors, the repository owner, or paths like `/home/collin`.

## Constraints

- No saved thread or downloaded handoff file may become unreadable.
