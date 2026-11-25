---
slug: project-lead
status: draft   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-24
---

# A project lead pinned in each project

## What we're building

A lead thread pinned at the top of each project in the threads list. It works like the
all-projects personal assistant, but only for one project: it knows where that project's
threads stand, starts new threads with their own leads, and passes Collin's instructions to
existing leads.

## Why — the problem

The personal assistant sees every project at once. When Collin is working inside one
project, its answers and status reports mix in threads from all the others, so he has to
filter out the noise himself. He wants the same help with only that project in view.

## What good looks like

- Each project in the threads list has a project lead pinned at its top.
- Asking it "where do things stand?" covers only that project's threads.
- It can start a new thread in that project and pass instructions to that project's
  existing leads, just as the assistant can.
- It cannot start, read or instruct threads in other projects.
- The all-projects assistant keeps working as it does today.

## Not doing

- Deeper project knowledge than the assistant has (for example reading the project's code
  or history on its own): the project lead is the same help with a smaller view.
- Replacing or changing what the all-projects assistant can do.

## Constraints

- Builds on the personal assistant (PR #186): reuse its special thread, role and powers,
  narrowed to one project.
