---
slug: quiet-card-close
status: draft   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-21
---

# Close the "agent stopped without reporting" card

## What we're building

When an agent keeps ending its turns without reporting back, the app puts an "An agent
stopped without reporting" card under "Needs you". This makes that card go away once it no
longer needs Collin: it closes on its own when the agent is clearly back at work or the
agent that started it has dealt with it, and Collin can dismiss it by hand.

## Why — the problem

Today the card closes only if the quiet agent itself sends a report or message, or is
stopped. In the agent-lessons thread the card was about the sub-lead: its lead nudged it,
it went back to work and started verifiers that reported back, yet the card stayed open and
kept the thread lit under "Needs you". There is no button to clear it, and leads cannot
close app-posted cards either.

## What good looks like

- When the agent that started the quiet one sends it a message after the warning, or the
  quiet agent starts another agent, the card dims and the thread stops showing "Needs you"
  for it.
- If that agent goes quiet again later, a fresh card can appear as before.
- The card has a button that lets Collin dismiss it; once pressed it dims and stops counting
  under "Needs you".
- Cards that still matter keep working as today: a stopped or replaced agent still closes it.

## Not doing

- Changing when the app first decides an agent has gone quiet, or the reminders it sends
  before posting the card.
- Letting leads resolve or retract app-posted cards.
- Redesigning the other app-posted cards beyond what the dismiss choice in planning covers.

## Constraints

- Dismissing a card never unblocks a session by itself: a permission prompt or startup
  hold stays held until the real event clears it.
