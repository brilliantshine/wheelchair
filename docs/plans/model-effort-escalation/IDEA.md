---
slug: model-effort-escalation
status: draft   # draft | confirmed
created: 2026-11-15
---

# Effort and escalation rules in Settings

## What we're building

Settings lets Collin choose how hard each model thinks (its effort) for every model he
picks there, not only some of them. Settings also explains, in plain words, when a build
moves a task to more effort or a stronger model, with a few switches that set the limits
the build has to follow. Effort is part of those switches, not only the model.

## Why — the problem

Today effort can be set only for Claude's tier models. The lead and sub-lead's model has
no effort setting, and GPT has none at all. The escalation rules exist only in the
instructions agents read, so Collin can't see them from the app or put limits on them,
such as how far up a build may climb, in model or in effort.

## What good looks like

- Every model choice in Settings has an effort choice beside it, for Claude and GPT,
  including the lead's.
- A session started after a change runs at the effort he picked.
- Settings has a short, readable account of when and how a build escalates.
- The escalation switches cover effort as well as the model, and changing one changes
  what the next build does.

## Not doing

- A full editor for escalation rules. Only the few switches agreed in planning.
- Changing how a running session behaves: settings apply to sessions started afterwards.
- Changing the escalation rules for terminal commands run outside the app.

## Constraints

- Settings stays the one source: the page, the hub and the agents read the same saved values.
- Works on a phone.
