---
slug: account-switchover
status: confirmed   # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-21
---

# Switch accounts when one hits its limit

## What we're building

When a Claude or Codex account runs out of usage while an agent is working, that agent
carries on under another signed-in account of the same kind, without Collin stepping in.

## Why — the problem

Today the app picks an account only when an agent starts. If that account hits its usage
limit mid-work, the agent just waits until the limit resets (often hours) and is then told
to continue, even when another signed-in account has plenty of room. Threads stall for no
good reason, and the only fix is for Collin to notice and restart things by hand.

## What good looks like

- An agent whose account hits its limit is moved to another signed-in account of the same
  kind (Claude to Claude, Codex to Codex) and keeps working on the same task.
- It works the same way for leads, sub-leads, workers, reviewers, verifiers and mappers.
- Collin does not have to press anything for it to happen; the thread keeps moving.
- When no other account has room, it falls back to today's behaviour: wait for the reset,
  then continue.

## Not doing

- Switching to a different kind of AI (Claude to Codex or back) when a limit hits.
- Spreading work across accounts ahead of time to avoid limits.
- Adding new ways to sign in or manage accounts.

## Constraints

- Uses only accounts already signed in on the machine.
- Claude and Codex report limits differently, so each needs its own way of noticing.
