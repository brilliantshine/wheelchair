---
slug: implementation-view
---

# How this works today

What happens during an implementation run now, and what the graph viewer can already draw.
Written before planning starts, and extended as questions dig deeper.

## End to end

```
plan approved → lead splits the Spec into briefs → Implementation Tasks table in PLAN.md
                                                          ↓
                                  workers run in the background (GPT or Claude)
                                                          ↓
                         each worker hands back one final report → lead re-runs its checks
                                                          ↓
                                 COMPLETION.md written → status: verifying

viewer:  agent PUTs a graph JSON → server lays it out top to bottom → page polls every second
```

## What happens

1. `/implement` refuses unless `PLAN.md` says `status: approved`, then registers the plan
   with the viewer (`protocol/implementation.md:7-20`). Registering only puts the plan on the
   viewer's list page. It draws nothing.
2. The lead sets `status: implementing` and splits the Spec into worker briefs. Each brief
   is one row of the Implementation Tasks table in `PLAN.md`: objective, the files that
   worker owns, lane, session id, check commands, status (`protocol/implementation.md:52-56`,
   `protocol/templates/PLAN.md:106-111`). This table is the only record of who is doing
   what.
3. Workers run in the background. A GPT worker is a `codex exec` call whose only output
   the lead reads is one final message in a file (`protocol/lanes.md:43-46`, `:95`). A
   Claude worker is an Agent-tool call that likewise returns one final report
   (`protocol/lanes.md:140`). Neither reports anything while it runs.
4. When a worker finishes, the lead re-runs that task's checks and reads the diff
   (`protocol/implementation.md:98-99`). Nothing asks a worker to list decisions it made
   that its brief left open. The nearest things are COMPLETION.md's "Deviations from plan"
   section (`protocol/templates/COMPLETION.md:36`), written once at the end, and the
   rule that a brief with an unmade decision in it should have had it made by the lead
   (`protocol/implementation.md:58-64`).
5. At the end the lead writes COMPLETION.md, including one Mermaid diagram of what the
   change does, and sets `status: verifying` (`protocol/implementation.md:108-119`).

The graph viewer, separately:

6. An agent writes a graph as one JSON file under `docs/plans/<slug>/graphs/` by `PUT`ting
   it to a local server (`protocol/graphs.md:423-505`). The page re-reads it every second
   and redraws when it changes (`viewer/index.html:2090-2101`).
7. What a graph can hold today (`protocol/graphs.md:46-303`): boxes with a plain-language
   label, a kind tag (`file`, `module`, `step`, `decision`, `external`, `note`) and a file
   pointer; arrows marked either "data moves along this" (with a name for what moves) or
   "this comes after that"; drawn groups, which are named rectangles around a set of boxes;
   and container boxes that open into a separate child graph.
8. The server chooses every position. A graph's author is not allowed to send coordinates
   (`protocol/graphs.md:296-297`). Its layout stacks boxes in rows, so a graph reads **top
   to bottom** (`viewer/server.js:568-600`). An arrow attaches to the middle of whichever
   side of a box faces the other box (`viewer/index.html:997-1004`).
9. Collin rules on boxes and arrows in the browser (`agreed` or `rejected`), and an agent
   may never erase a ruling (`protocol/graphs.md:600-640`).
10. The list page shows every registered plan with its status word, and the document page
    renders each plan's `.md` files (`viewer/server.js:1488-1502`, `:1575-1596`).

## What matters for this change

- The viewer already has groups, containers, data-vs-order arrows and a one-second live
  refresh. What it lacks is anything saying how far along a piece of work is: a box has no
  in-progress or done state, and nothing about an arrow ties it to a task.
- Workers are silent until they finish. So "show what's in progress" can mean at most
  "the lead has dispatched this, and it hasn't come back yet". Seeing inside a running
  worker would need the worker itself to write progress somewhere, and today nothing does.
- Graphs are deliberately disposable, pictures of a conversation, and never documentation
  (`protocol/graphs.md:13-44`). A picture that the lead keeps up to date for a whole run is
  a different kind of thing, and it conflicts with the rule that each redraw lays out the
  whole picture from scratch.

## Problems found

- The layout runs top to bottom and has no concept of a box's input or output sockets. A
  left-to-right, Blender-style view with sockets is new layout and new drawing, not a
  setting to change.
- Workers never report the decisions they made where their brief left a gap. Without that,
  nothing could update a picture with "the worker chose X here". It would have to be a new
  line in every brief.

## Not checked

- How the document page renders `PLAN.md` tables, including whether Implementation Tasks
  is readable in the browser today.
- How much of `viewer/index.html` (2,140 lines) assumes rows run top to bottom, beyond the
  side-of-box arrow code.
- Whether any past run's `Log` section in a `PLAN.md` holds mid-run progress notes someone
  could have read.
