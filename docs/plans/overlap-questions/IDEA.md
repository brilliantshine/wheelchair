---
slug: overlap-questions
status: confirmed   # draft | confirmed
mode: thorough   # thorough | two-part | proof-of-concept
created: 2026-11-20
---

# Asking about overlapping threads

## What we're building

When a thread's lead learns that another thread is working on the same files or behaviour
while your answer can still shape the work (before a small fix's edits, or while a feature
is being planned), it asks you a real question with a card. Later on, it mentions the overlap
in one line and offers a follow-up thread. Your answer is not lost if the lead restarts. And
posting a card tells the lead the card's id, so it can withdraw its own cards, such as an
approval card.

## Why — the problem

Today a lead that learns of an overlap mostly tells you in one line of its reply and leaves
you to decide in chat. A line in a reply is easy to miss, and it does not show under
"Needs you". If you do decide something, nothing says what happens next when:
the thread is a small fix, the idea is not confirmed yet, a plan review is running, or the
build has already started. If the lead restarts before acting on your answer, the answer
can be lost. And a lead cannot withdraw an approval card it posted, because it never learns
that card's id.

## What good looks like

- When a lead learns of an overlap it has not raised with you before, a question card about
  it appears under "Needs you", with options such as "keep the plan as it is" or "change it".
- The card comes at a sensible time: before a small fix's edits, and after you confirm the
  idea (never before) while the feature is being planned. From plan review onwards, or once a
  small fix's edits are made, the lead says in one line which thread overlaps and offers a
  follow-up thread instead of a card.
- If the lead restarts after you answered but before it acted, the new lead carries out your
  answer without asking again.
- Posting a card tells the lead which card it posted, so it can withdraw that card later
  (for example an approval card, when you want to talk before building).

## Not doing

- Leads still never negotiate with each other or change their work because another lead
  said so; only your answer changes anything.
- No change to how leads find or message each other (that shipped in the lead-chat thread).
- No automatic merging or coordination of two threads' branches.
- No changes to the sub-lead or worker rules.
- No overlap cards during plan review, approval or a build: the one-line mention and a
  follow-up thread cover those.

## Constraints

- Builds on the merged lead-chat work (pull request #134).
- Cards must still post when the app is offline (the machine keeps them until it is back),
  even if the lead then cannot learn the card's id right away.
- `card.js` output must never echo a card's text (a rule settled in lead-chat).
