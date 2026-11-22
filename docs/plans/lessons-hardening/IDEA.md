---
slug: lessons-hardening
status: confirmed   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-21
---

# Make agent lessons solid

## What we're building

Agents save short "lessons" that later agents of the same type read at start (built in
agent-lessons, PR #151). This adds three things around them: a history of every lesson
change you can restore from, a way to spot lessons that may no longer be true, and a way
for lessons to travel with you to another install or with a thread you hand off.

## Why — the problem

- A lesson an agent replaces or removes, or one you edit or remove in Settings, is gone for
  good. If the change was wrong, there is nothing to go back to.
- Lessons never age. Once saved, a lesson keeps reaching every agent of that type even
  after the rule or habit it describes has changed, and nothing points that out.
- Lessons live only in one machine's hub settings. A new install starts with none, and a
  thread handed off to another install arrives without the lessons its agents learned.

## What good looks like

- In Settings, each lesson shows its earlier versions (who changed it and when), and a
  removed lesson can be found again. One press restores any earlier version.
- Settings marks lessons that look stale, with a plain reason, so you can keep, edit or
  remove them. Keeping one clears the mark.
- You can export lessons from one install and import them into another; a handed-off
  thread can bring its lessons along. When an incoming lesson clashes with one already
  there, the result is predictable and nothing is silently overwritten.
- Agents' starting instructions are unchanged by any of this: they still get only the
  current lessons.

## Not doing

- Syncing lessons live between installs.
- Changing what lessons agents save, or when.
- Lessons kept in the project's repository.

## Constraints

- Lessons stay in the hub's settings, one hub per user; the cap of 12 per agent type stays.
- Lessons marked "(edited by the user)" stay protected from agents, including through
  restore and import.
- Handoffs from an install without this feature must still import.
