---
slug: design-in-threads
status: confirmed   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-22
---

# Design work inside a thread

## What we're building

A way to design how something looks inside a wheelchair thread: the lead drafts real
visual mockups of screens during planning, the user refines them from their phone, and
the build follows the agreed mockup. While the build runs, screenshots of the real thing
reach the thread as each visible piece lands, checked against the mockup.

## Why — the problem

Today Collin designs in Claude Design and drops the artifact into a thread. Not everyone
has Claude, Collin would rather not leave wheelchair to do it, and only about 70-80% of
the design survives the build. The thread's diagrams show structure, not what a screen
actually looks like, and screenshots are rare and arrive only near the end, when changing
direction is expensive.

## What good looks like

- During planning, the thread shows mockups that look like the real screens, and the user
  can ask for changes and see the new version in the thread.
- This works whichever AI the lead runs on; no outside design tool is needed.
- During the build, screenshots of the built screens appear in the thread as visible tasks
  finish, not only at the end.
- The finished screens match the agreed mockups closely, and a visible difference is caught
  and fixed rather than shipped.

## Not doing

- Importing from Claude Design or other outside design tools as a dedicated path.
- Clickable, interactive prototypes in the thread (mockups are pictures of screens and states).

## Constraints

- Must work on every AI provider wheelchair supports, not only Claude.
- Must be usable from a phone.
