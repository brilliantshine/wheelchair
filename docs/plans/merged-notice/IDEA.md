---
slug: merged-notice
status: draft   # draft | confirmed
created: 2026-11-16
---

# Tell me when a thread's pull request is merged

## What we're building

When the pull request a thread opened is merged on GitHub, the app posts a card in that
thread saying it was merged. The card has a button that archives the thread.

## Why — the problem

Once a thread is done, nothing in the app says whether its pull request has been merged.
Collin has to check GitHub himself and then remember to archive the thread, so finished
threads pile up in the list.

## What good looks like

- Merge a thread's pull request on GitHub; shortly after, that thread shows a "merged" card
  without anyone typing anything.
- Pressing the card's archive button archives the thread, the same as archiving from the
  thread page.
- A thread whose pull request is still open, or was closed without merging, gets no
  such card.
- Each merge produces one card, not a new one on every check.

## Not doing

- Archiving automatically: the thread is only archived when Collin presses the button.
- Merging the pull request from the app.
- Telling Collin about a pull request closed without merging.

## Constraints

- No agent session has to be running for the card to appear: the app notices the merge
  itself.
