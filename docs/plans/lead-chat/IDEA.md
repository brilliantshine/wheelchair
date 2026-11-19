---
slug: lead-chat
status: confirmed  # draft | confirmed
mode: two-part   # thorough | two-part | proof-of-concept
created: 2026-11-19
---

# Leads that know about each other

## What we're building

A thread's lead can ask for a short summary of what the other leads on the same machine,
working in the same project, are doing, and can send those leads a message and get a reply.
A lead can reach a lead in a different project only when the user allows it.

## Why — the problem

The user often runs several threads on one project at once, and sometimes two of them are
doing roughly the same thing in different ways. Today each lead can only see and message
agents inside its own thread, so neither knows about the other: they duplicate work, make
conflicting changes and step on each other's feet. The user has to notice and relay
between them by hand.

## What good looks like

- In a thread, a lead can find out which other threads in its project are active on this
  machine and, in a line or two each, what they are working on.
- A lead can message another lead in its project and get an answer back, without the user
  carrying it across.
- When two threads touch the same area, each lead learns about it and tells its user, and
  the user decides who does what; that shows in what they then build.
- A lead does not wander into threads of unrelated projects: they don't show up in its
  summary, and a message to a lead in another project goes only with the user's OK.

## Not doing

- No extra security or access control beyond the same-project rule and the user's OK for
  other projects. This is about keeping leads oriented, not about defending against them.
- Leads on other machines are not included.
- Only leads talk across threads: sub-leads, workers, reviewers and verifiers stay inside
  their own thread.
- No automatic merging or coordination of the threads' work; leads only talk.

## Constraints

- Cross-thread traffic between leads stays hidden from the user, like messages inside a
  thread today; anything that needs the user's decision still reaches them as a card.
