---
slug: retract-cards
status: confirmed   # draft | confirmed
created: 2026-11-17
---

# Retract cards that no longer apply

## What we're building

A lead agent can retract a card it posted once circumstances have made it obsolete. The
card stays in the thread, but it is dimmed, shows a short note saying why it was
withdrawn, and its buttons no longer do anything. The conversation then carries on.

## Why — the problem

Collin often answers a card by talking instead of pressing. Some examples:

- He has no clear pick on a decision card, so he talks it through.
- A plan is reviewed and ready to build, but he changes his mind and wants to talk first.
- He decides a root command on a sudo card isn't needed after all.

Today a lead can close only an open decision card or a "needs" card. Every other card
stays live: it keeps its buttons, still looks like it wants an answer, and a press on it
can start something nobody wants any more (a build, or a root command).

## What good looks like

- A lead can retract any open card that asks Collin for something: a decision, the
  "Take it into planning?" offer, the plan approval card, a "needs" card and a sudo card.
- A retracted card looks clearly different from an answered one. It is dimmed and shows
  the lead's one-line note.
- Pressing anything on a retracted card does nothing, even from a page that was already
  open before the card was retracted.
- A retracted card no longer counts as waiting on Collin.
- A retracted sudo card's command can no longer be run, including from the page where
  Collin types his password.
- The lead can post a fresh card later when the question comes back.
- The plan's approval card stays pinned at the top of the thread until Collin presses
  Start building or it is retracted; a fresh approval card replaces the pinned one.

## Not doing

- Collin retracting cards himself; he already answers or talks.
- Deleting cards: a retracted card stays in the thread history.
- Retracting cards that ask nothing of him (progress line, idea list, pictures, done
  cards, stubs).
- Undoing a retraction: the lead posts a new card instead.
- Cards the app posts itself (stuck, permission, "Sessions ended"): those close on their
  own.

## Constraints

- A sudo command that is already running when the card is retracted cannot be stopped;
  the card then reports what the command did as usual.
