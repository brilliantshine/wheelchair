---
slug: plan-handoffs
status: confirmed   # draft | confirmed
created: 2026-11-17
---

# Hand a thread off by exporting and importing it

## What we're building

A way to stop a wheelchair thread at a clean point between stages and export it as a single
file. In a new thread, importing that file recreates the thread and carries on from the same
stage. Code is not in the file: the work lives on a branch on GitHub, and the new thread
picks it up from there.

## Why — the problem

Today a thread lives only where it was started. Its plan, decisions and stage are tied to
that one thread on that one machine, and the only way to continue the work elsewhere or
later is to start over and re-explain it. There is no way to package where a thread got to
and pick it up somewhere else.

## What good looks like

- At a clean stopping point, the thread offers an export, and you get a file you can keep
  or send.
- At a point that is not clean (agents still working, a step half done), export is not
  offered, and you can see why.
- A new thread can take that file, and the lead in it says where things stand and continues
  from the same stage, without being re-told the idea or the decisions made so far.
- The new thread works from the exported branch on GitHub, so the plan documents and any
  committed code are there.
- Importing never makes a duplicate. If the file comes from a thread this app already has,
  the import points you back to that thread instead of making a new one. If the file is a
  later stage of that same thread (it went elsewhere, moved on, and came back), the
  existing thread is advanced to the newer stage.

## Not doing

- Carrying code or uncommitted files in the export. Anything not pushed to the branch does
  not travel.
- Stopping or resuming in the middle of a step.

## Constraints

- The thread's work must be committed and pushed to a branch on GitHub before export.
