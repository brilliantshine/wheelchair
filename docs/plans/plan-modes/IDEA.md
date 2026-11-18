---
slug: plan-modes
status: confirmed   # draft | confirmed
created: 2026-11-17
---

# Plan modes: thorough, two-part, proof of concept

## What we're building

A choice of how thoroughly a feature is planned. Today every feature gets the same
exhaustive plan review. This adds two lighter modes beside it:

1. **Thorough** — today's behaviour and the default. Reviewers check the whole plan for
   faults extremely thoroughly.
2. **Two-part** — the plan is split in two as it is written. The first part covers what
   the feature needs to work; anything not urgent to basic functionality is moved into a
   second, follow-up plan for making it solid. The first part is built and verified as
   today. If verification turns up something big that is not needed for it to work, that
   can go into the follow-up too. When the first part is done, a new thread is created
   holding the follow-up plan.
3. **Proof of concept** — the same as two-part, but the deferred items are accepted as
   risks and no follow-up plan or thread is made.

## Why — the problem

Not everything needs the most thorough plan. Today a quick experiment or a first working
version pays the same planning and review cost as a feature meant to be finished, and
waits just as long before anything can be used. Collin wants a working app sooner when
that is what matters, with the hardening either scheduled for later or knowingly skipped.

## What good looks like

- Starting a feature, the mode in use is clear, and thorough is what happens if nothing
  else is chosen.
- In two-part mode, Collin gets a working build sooner than with a thorough plan, may hit
  edge cases that break, and when the thread is done a new thread is waiting with the
  follow-up plan already written.
- In proof-of-concept mode, he gets the working build the same way and no follow-up
  thread appears; what was skipped is recorded as accepted risk.
- Verification of what is built works as it does today in every mode.

## Not doing

- Changing how verification checks a build.
- Building the follow-up automatically: the follow-up thread waits until Collin opens it,
  like any other new thread.
- Changing small fixes, which have no plan.

## Constraints

- Thorough stays the default and behaves exactly as today.
