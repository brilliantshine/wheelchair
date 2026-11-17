---
slug: agents-screen-redesign
status: confirmed   # draft | confirmed
created: 2026-11-17
---

# Agents screen: layout and terminal

## What we're building

A new Agents screen. Leads sit in a left sidebar with their project, feature and stage.
Picking one shows its agents as a tree, each box saying in words what that agent is
doing. Picking an agent opens a side panel about it, and its terminal opens in a panel
along the bottom of the same screen, starting view only.

Source: `docs/proposals/app-shell/agents-screen.md` and the `Agents*.dc.html` designs
beside it. This thread builds the parts that run on data the app has or can cheaply keep.

## Why — the problem

- The nested list makes it hard to see who started whom.
- Boxes show raw session names, not what each agent is working on.
- Every session shows a tmux attach command the Open terminal button already covers.
- The terminal is a separate page, so looking at one agent loses the tree.
- Scrolling in the terminal can send stray characters into a session.
- Finished agents vanish from the screen, so a lead's history is lost.

## What good looks like

- The sidebar lists live leads with a project tag, feature, stage and agent count
  ("Building · 6 agents"); finished leads fold into "Finished today", also tagged.
- Picking a lead shows a tree: lead, then mapper, sub-lead and asides, then the sub-lead's
  workers. The heading repeats lead, feature and tag, with a one-line count
  ("6 agents · 2 working · 2 waiting on another agent · 1 not started · 1 finished").
- Each box says what the agent is doing; finished boxes use its result. Finished and
  not-started boxes have dashed borders.
- Only a lead can show "Needs you". An agent waiting on another shows a hollow dot and
  "Waiting on the sub-lead" (or whoever).
- The side panel shows role, title, model, machine, how long it has been working, and the
  buttons Open terminal and Read its brief.
- Open terminal opens a bottom panel with a height handle, Full screen, Pop out (today's
  page) and close. It starts view only: nothing reaches tmux, and scrolling never sends
  keys. With typing on, the switch, panel edge and cursor turn amber and a line says keys
  go straight to that agent. It returns to view only on close or when another agent is
  picked.
- No tmux commands anywhere on the screen.

## Not doing

- The activity map, Latest steps, "is this normal?" line, context ring and the amber path
  a question takes up the tree. They need an event per agent step and go to the thread
  "Agents screen: live activity per agent".
- Changing how agents ask each other questions; this only shows who is waiting on whom.

## Constraints

- The hub runs on Node 20; existing viewer and browser test suites keep passing.
