---
slug: project-lead
status: confirmed   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-24
---

# A project lead pinned in each project

## What we're building

A lead thread pinned at the top of each project in the threads list. It works like the
all-projects personal assistant, but only for one project: it knows where that project's
threads stand, starts new threads with their own leads, and passes Collin's instructions to
existing leads. Unlike the assistant, it also knows that one project well: its code, plans
and history, and how its threads fit together.

## Why — the problem

The personal assistant sees every project at once. When Collin is working inside one
project, its answers and status reports mix in threads from all the others, so he has to
filter out the noise himself. And because it spreads across everything, it knows no
project deeply: it can say a thread exists but not how it relates to the project's code,
its past plans or the other threads touching the same parts. He wants help with only that
project in view, and that knows the project well.

## What good looks like

- Each project in the threads list has a project lead pinned at its top.
- Asking it "where do things stand?" covers only that project's threads.
- It can start a new thread in that project and pass instructions to that project's
  existing leads, just as the assistant can.
- It can answer questions about the project itself (where something lives in the code,
  what an earlier plan decided, which threads touch the same part) without Collin pointing
  it at files.
- It cannot start, read or instruct threads in other projects.
- The all-projects assistant keeps working as it does today.

## Not doing

- Replacing or changing what the all-projects assistant can do.

## Constraints

- Builds on the personal assistant (PR #186): reuse its special thread, role and powers,
  narrowed to one project.
- The fence around a project lead is for focus and catching mistakes: the app blocks what it
  asks the app to do outside its project, but it is not sealed against an agent that
  deliberately ignores its rules.
