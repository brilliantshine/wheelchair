---
slug: local-checkout-handoff
status: confirmed   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-18
---

# Try a thread's work in my own checkout

## What we're building

A way to put a thread's work into Collin's own local copy of the project, so he can run
and try it (for example in a game engine) without pulling the pull request by hand.

## Why — the problem

Wheelchair is hard to use for local applications and game engines. Agents work in their
own copies and finish with a pull request; to try the result, Collin has to fetch and
switch branches himself in his own checkout.

## What good looks like

- From a thread's page on his phone, Collin presses one button and the thread's latest
  work lands in his own copy of the project on that machine.
- He then opens that copy as usual (an editor, a game engine, a local app) and sees the
  thread's changes, without typing any git commands.
- If his copy has unsaved or uncommitted work, nothing of his is lost or overwritten; the
  app tells him plainly what it did or why it did not.
- He can get back to what his copy had before, just as easily.
- When it cannot be done (machine offline, git fails), the app says so in plain words.

## Not doing

- Merging, pushing or closing the pull request.
- Starting or building his app or game engine for him.
- Changing how agents work: they still never write git outside their own copy. Only
  Collin's press does this.

## Constraints

- Never lose Collin's uncommitted, untracked or ignored files in his copy.
- Usable from a phone browser.
- Agents' git writes stay confined to their own worktree.
