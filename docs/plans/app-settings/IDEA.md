---
slug: app-settings
status: draft   # draft | confirmed
created: 2026-11-15
---

# A Settings page for how agents run and behave

## What we're building

A Settings page in the app where Collin chooses which model each provider uses at each
level of work (Light, Standard, Heavy, Critical), how agents in each role behave, how leads
write to him, and which permission mode sessions run in. Agents started after he saves
follow what the page says.

## Why — the problem

Today all of this is fixed in code or in files only an agent's terminal sees. Model choices
live in a pins file and hard-coded tier names; the Critical tier is on the build rules but
the app refuses it; leads run on whatever model the Claude CLI defaults to. Collin cannot
tell an agent how to behave, or tell leads how to write to him, without editing the
workflow's own rules. Sessions run in a permission mode he can't see or change, and the
newer-model heads-up never reaches him.

## What good looks like

- He opens Settings from the app's navigation, on his phone or a desktop.
- The models table shows a row per provider (Claude, GPT) and the four tiers; he changes a
  cell, or marks it Not used, and the next session started at that tier uses it.
- A Critical part of a build actually runs on a Critical model.
- Leads run on Claude Opus 5.5.
- He writes a template for a role (for one project or all) and the next agent in that role
  follows it, on top of wheelchair's own rules, which it cannot override.
- He writes a style, and the next lead's messages and cards follow it; a before-and-after
  preview shows the difference.
- He sees the permission mode and can change it; sessions still start and count as ready.
- When a newer model is available, the page says so with switch or skip.

## Not doing

- Accounts, usage, balancing, and providers beyond Claude and GPT: their own thread
  ("Accounts, usage and balancing").
- Asides: the side-conversations thread owns them.
- Writing rules for any agent other than leads; the old wording list stays dropped.
- Changing an agent that is already running.

## Constraints

- Nothing in a template or style overrides wheelchair's built-in rules for a role.
- The tier rename reaches the workflow rules under `protocol/`, which are used outside the
  app too, so it must not break the terminal workflow.
