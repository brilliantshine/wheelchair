---
slug: silent-stops
status: confirmed   # draft | confirmed
created: 2026-11-15
---

# Catch agents that stop silently

## What we're building

Two fixes so an agent can't go quiet unnoticed. The rules make clear that an agent's own
commands for committing and reporting back are always allowed, and that an agent stuck on a
conflict says so. The app notices when an agent that owes a report ends its turn without
one, tells whoever started it, and tells Collin if that doesn't help.

## Why — the problem

A worker finished its task but never committed or reported back. Its brief said not to
contact the port the test harness uses; the worker took that to cover its own reporting
commands, which use the same port, and stopped. Nothing noticed: the agent that started it
waits only for a report, and the Agents tab rightly showed the worker idle. Collin found
it only by looking. Any brief worded too broadly can cause the same silent stall.

## What good looks like

- The role rules say plainly that no brief can forbid an agent's own reporting and commit
  commands, and that an agent facing a conflict it can't resolve reports itself blocked.
- When an agent ends a turn without reporting or messaging since it was last given work,
  the agent that started it hears about it from the app.
- If that doesn't get it moving, Collin sees it in the thread without having to look for it.
- An agent that did report is never flagged.
- Each fix has a test that fails without it.

## Not doing

- Restarting or stopping agents automatically: the app tells, it doesn't act.
- Changing how the lead itself is watched; it talks to Collin directly.
- Rewording existing briefs in other threads.

## Constraints

- Builds on what the app already tracks (the end of each turn, the cards each agent posts)
  and the notices it already sends for dead or stuck sessions.
- A report can reach the app slightly after the turn-end signal, so a report that is merely
  late must not be flagged as silence.
