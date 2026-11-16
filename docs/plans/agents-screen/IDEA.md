---
slug: agents-screen
status: confirmed   # draft | confirmed
created: 2026-11-15
---

# An Agents screen with named leads

## What we're building

A new Agents screen that replaces the Sessions page. Every lead gets a short name (Greek
letters by default, or names from a list in a settings file), so leads can be told apart.
The Agents screen shows each lead with the family of agents under it as a tree, and the
Threads screen shows which lead is working on each thread, with a link to that lead.

## Why — the problem

The Sessions page is a wall of cards with internal names like `wc-85d38701e785-lead-2`.
It does not show who started whom, what each agent is doing or waiting on, or which lead
belongs to which piece of work. Every lead is just "lead", so there is no easy way to talk
about or find one.

## What good looks like

- Each lead has a name like Alpha or Beta, shown wherever the lead appears.
- If a names list is set in a settings file, new leads take names from it instead.
- Workers, reviewers, verifiers, mappers and sub-leads have no names.
- A stub thread has no lead and no name until it is opened and its lead starts.
- The Threads screen shows each thread's lead name; clicking it jumps to that lead on the
  Agents screen.
- The Agents screen lists every agent. Each lead's family (sub-lead, its workers,
  reviewers, verifiers, mapper) shows as a tree under it.
- Each agent is a card like the ones on Sessions today: a way to open its terminal, plus
  its model and effort.
- When an agent is waiting on one of its subagents, the card says so.
- The Sessions page is gone; its nav entry points to Agents.

## Not doing

- Names for anything other than leads.
- Changing how sessions are started, balanced or restarted.
- Controls to start or stop agents from the Agents screen.

## Constraints

- The hub's settings file drops fields it does not know, so a names list needs to be added
  to what it keeps.
- Works on a phone-width screen, like the other app pages.
