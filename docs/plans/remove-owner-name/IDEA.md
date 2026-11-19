---
slug: remove-owner-name
status: confirmed   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-19
---

# Remove the owner's name from wheelchair

## What we're building

Wheelchair stops calling the person who uses it "Collin". The agent rules, the text the
app adds to agent prompts, and the messages the app shows talk about the person in a way
that fits whoever installed it.

## Why — the problem

The name "Collin" is written into the agent rules (`protocol/`) and a few app messages. It
is not read from the machine. So agents write things like "Collin wants this" in stub
summaries and cards, and anyone else who installs wheelchair gets agents talking about
someone who isn't them.

## What good looks like

- On a fresh install by someone else, no agent refers to "Collin" in replies, cards, stub
  summaries or plans, unless that person's name is actually Collin.
- The agent rules and every piece of text the app sends to agents or shows on screen
  contain no hard-coded owner name.
- Everything behaves as before; only the wording changes.

## Not doing

- Rewriting old plans and design proposals under `docs/`. They are records of past work.
- In this thread, renaming the internal names of stored data (such as `collin_at` and
  the message source tag `collin`) or rewriting code comments, tests and test fixtures.
  Those go in the follow-up thread, because renaming stored data means converting existing
  threads and keeping exported handoffs readable.

## Constraints

- Existing threads, saved state and exported handoffs keep working with no conversion
  step in this thread.
