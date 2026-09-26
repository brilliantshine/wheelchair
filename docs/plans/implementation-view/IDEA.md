---
slug: implementation-view
status: confirmed   # draft | confirmed
created: 2026-09-25
---

# A live picture of an implementation run

## What we're building

A picture of the change being built, which the implementation lead draws when it splits
the plan into worker tasks and keeps up to date until the run ends. It reads left to
right like a Blender node editor. The parts of the change are boxes, with what goes into
each one and what comes out, and the boxes are wired to each other and to the files, stores
and outside systems they touch. Related parts sit together inside a named group. Every
part shows whether it hasn't started yet, is being worked on, is done, or has hit a
problem that needs Collin. When a worker
finishes and made choices its instructions didn't cover, the picture shows those choices
on the parts they affected.

The problem state is meant to be rare. It covers two cases. The first is a part that is
stuck because something is missing that only Collin can supply, such as a tool that isn't
installed or a login that has expired. The second is a part that went wrong badly enough
that trying a stronger model didn't fix it, so a person has to step in. Most of the first
case is headed off before any work starts: the lead checks what the run will need and asks
for all of it at the beginning, not partway through.

## Why — the problem

An implementation run can go on for a long time, and while it does Collin can't tell what
is happening. The workers say nothing until they finish. The only record of who is doing
what is a table in `PLAN.md`. Asking the lead "how is progress?" gets back a status report
written in task numbers and file names, which is hard to follow without the plan already
in your head. So Collin ends up waiting on a run he can't see into, and he finds out
what the workers decided on their own only at the end, if at all.

## What good looks like

- Partway through a long run, Collin opens the picture and in a few seconds can say which
  parts of the change are done, which are being worked on right now, and which haven't
  started, without reading any table or asking the lead.
- He can see how the parts fit together: what feeds what, and which files, databases or
  outside services each part reads or writes.
- When a worker made a choice its instructions left open, that choice shows up on the
  picture, on the part it belongs to, soon after the worker finishes and not only in the
  final write-up.
- When a part needs him, he can see that on the picture, along with what it needs. That
  should almost never be a surprise mid-run: anything the run needs from him (installs,
  logins, access) he is asked for once, at the start of implementation, before the
  workers go.
- A part is shown as needing him only when it really does. Ordinary failures that the
  lead fixes itself, such as a check that fails and then passes on a retry or a stronger
  model, never show up as a problem.
- The picture stays in step with the run. It never shows something as being worked on
  after it came back, or as done when the lead's own checks failed it.
- It works the same whether the run is driven from Claude Code or from Codex.

## Not doing

- Controlling the run from the picture while it's going. It shows what is happening.
  Nothing here starts, stops, reassigns or redirects a worker. The one exception: a worker
  choice Collin strikes becomes a follow-up task, which the lead sends at the end of the
  run, before the final write-up.
- Replacing what happens at the end of a run. COMPLETION.md, its evidence, and the blind
  verification stage all stay exactly as they are. The picture is something to look at,
  not proof that anything works.
- Changing how the lead splits work, which workers it picks, or what a worker is told to
  build, apart from those follow-up tasks.
- A general code-architecture diagram of the whole repository. The picture covers the
  change this plan makes and what that change touches, nothing wider.

## Constraints

- A broken or missing picture must never stop, slow down or fail an implementation run.
  Showing progress is the extra here. The run is the job.
- It runs in the existing local viewer, which the always-on service runs on Node 20.
- Both harnesses read the same stage rules from `protocol/`, so whatever the lead does to
  keep the picture current is written there once, not per harness.
- Labels on the picture are in plain language, the same rule the current graphs follow.
  Words from the code go in the detail, not on the box.
