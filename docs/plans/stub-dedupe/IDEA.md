---
slug: stub-dedupe
status: confirmed   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-21
---

# No duplicate stubs

## What we're building

Before an agent makes a stub (a waiting thread for work that belongs on its own), it looks
at the stubs that already exist in the project, opened or not. If one already covers the
same thing, it makes nothing new. If one is basically the same, it adds its part to that
stub instead of making a second one.

## Why — the problem

Today agents can't see stubs nobody has opened yet, can't read what an existing stub is
for, and have no way to add to one. So two threads that run into the same problem each
make their own stub, and Collin ends up with several threads for the same work.

## What good looks like

- When a thread would make a stub that matches an existing one, no new stub appears; the
  thread says it already exists and points to it.
- When the work is close to an existing stub, that stub's description gains the new part,
  visibly, and no second stub appears.
- If the stub was already opened, its agent is told about the added part.
- Genuinely different work still gets its own stub, as today.

## Not doing

- Merging or cleaning up duplicate stubs that already exist.
- Checking for duplicates among threads Collin starts directly (only agent-made stubs).
- Looking across projects or machines.

## Constraints

- An agent adding to an existing stub must not undo what that
  stub's thread has already decided or built.
