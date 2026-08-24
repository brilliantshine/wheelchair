---
slug: <slug>
status: draft   # draft | confirmed
created: <YYYY-MM-DD>
---

# <Plain-language title>

The north star. Written before any design questions, confirmed by the user, then held
stable while PLAN.md churns. Anyone — including a fresh agent mid-project — should be able
to read this alone and understand what is being built and why.

Plain language throughout. No jargon, no implementation detail, no design decisions.

## What we're building

Two or three sentences. Someone who has never seen this repo should understand it.

## Why — the problem

What is wrong or missing today, and who it affects. Concrete, not abstract.

## What good looks like

How we would know it worked, described in things you could observe from outside — not
internal mechanics.

## Not doing

Explicit non-goals: the things someone might reasonably assume are included but aren't.
This section prevents more scope drift than any other.

## Constraints

Hard limits that exist before any design happens — runtime, compatibility, deadlines,
non-negotiables. Newly discovered hard constraints may be appended during planning; that
is the one part of this file that grows without a scope-change conversation.
