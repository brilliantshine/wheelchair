---
slug: finished-agent-decks
status: draft   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-18
---

# Finished agents stack into decks on the Agents screen

## What we're building

On the Agents screen, finished agents with the same role and the same parent stack into one
"deck" card instead of one box each. Reviewer and verifier decks also show one colored
square per round, so you can see at a glance whether review is settling down or going in
circles. Clicking a deck opens a list of its rounds or agents, and a `?` button explains how
to read the tree.

## Why — the problem

A lead can end up with dozens of finished agents (one thread had 57 agents, 54 finished,
mostly plan reviewers). Laid out side by side they push the tree far off screen, so the
working agents are hard to find and the review history is unreadable.

## What good looks like

- With "Hide finished agents" off, a thread with 40 finished reviewers under one lead shows
  one reviewer deck reading `×40`, not 40 boxes.
- A single finished agent still shows as a normal box; working or waiting agents never
  disappear into a deck.
- A reviewer deck shows one square per round, oldest to newest, colored by how many
  objections that round had (5+ red, 3–4 orange, 1–2 yellow, none green), and a title such
  as "Plan review · 20 rounds, then approved".
- A verifier deck does the same with problems found per attempt.
- Clicking a deck opens a popover under it: rounds newest first (square, "Round 18",
  reviewers and objections) for reviewers and verifiers, agents newest first for the rest.
  Opening a round lists its agents, and picking one shows it in the right-hand panel like
  any box.
- A `?` next to "Hide finished agents" opens "How to read this tree" with the color key and
  two example rows.

## Not doing

- Changing what "Hide finished agents" does when it is on.
- Grouping agents that are still working or waiting.
- Changing how review or verification itself runs.

## Constraints

- Follows Collin's proposal `docs/proposals/app-shell/finished-agents.md` and its screen
  `design/AgentsFinishedDecks.dc.html` (an addendum to `agents-screen.md`).
