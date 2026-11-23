---
slug: personal-assistant
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-23
---

# A personal assistant across all projects

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

**Map:** `MAP.md` and `docs/maps/personal-assistant-runtime.md`.

## Open Questions

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Plan mode is two-part. | Collin picked it. | user |
| 2 | The assistant acts for Collin, based on what Collin tells it to do. | Collin's answer to "act or only report". | user |
| 3 | Collin talks to it in a special pinned thread and a pop-up; both are the same conversation. | Collin's answer. | user |
| 4 | A per-project lead thread is split into its own follow-up thread (depends on this one). | Collin picked "Its own thread". | user |
| 5 | The assistant sees and acts across every machine the hub knows, not only one machine. | "All projects" means all; the hub already holds every thread record (MAP.md). | defaulted |
| 6 | Collin's instruction is the consent: the assistant needs no reach approval to message a lead in any project. The per-thread message limit still applies. | A reach card per project would defeat the point; the limit still guards against loops. | defaulted |
| 7 | The assistant runs on the hub machine on the lead model from Settings, in its own working folder outside any project. It never edits project code; work goes into threads. | Keeps it out of project worktrees; leads own code changes. | defaulted |
| 8 | Leads' questions stay in their own threads and under Needs you, as today; the assistant mentions them in its summaries. | Nothing changes for anyone not using the assistant (IDEA Constraints). | defaulted |
| 9 | When Collin's instruction leaves the project or machine unclear, the assistant asks in its chat before starting anything. | Avoids starting work in the wrong place. | defaulted |
| 10 | The assistant thread is never archived or listed under a project; it restarts like a lead, rebuilding its picture of all threads from the hub. | It is permanent and project-free. | defaulted |
| 11 | When told to, the assistant may do anything Collin can do with threads: start threads, message leads, answer leads' question cards, press Start building, restart leads, and archive threads. | Collin picked "Anything I can do". | user |
| 12 | Whatever the assistant does in a thread is visible there and marked as done by the assistant (its messages to a lead show as a bubble "From your assistant"; its card presses say "by your assistant"). | Collin must be able to see why a lead acted, without the assistant reporting it. | defaulted |
| 13 | The assistant acts on threads and projects only; changing Settings (models, accounts, project tools, auto-merge) is deferred to the follow-up. | Collin picked "Threads only, for now". | user |
| 14 | The assistant speaks only when Collin writes to it; telling Collin about changes on its own is deferred. | Collin picked "Later, not now". | user |
| 15 | Mockups agreed: mockup-threads, mockup-thread, mockup-popup, mockup-closed and mockup-thinking, each in -phone (390x844) and -desktop (1280x800) files under graphs/ (first and only version, commit face0aff). | Collin picked "Agree them". | user |
| 16 | The assistant is opt-in: a switch in Settings, off by default. While off there is no pinned thread, no pop-up and no assistant session. Turning it off later stops its session and hides both; its conversation is kept for when it is turned back on. | Collin: "the assistant will be an opt in, we won't force all users to have it" (new IDEA constraint). How it is switched on is defaulted. | user |

## Spec

Draft; grows as decisions land.

### What the assistant may do

On Collin's instruction, anything Collin can do with threads in the app: start a thread in any project on any machine (with its lead, seeded with what Collin said), message any thread's lead, answer a lead's open question card, press Start building on an approval card, restart a lead, archive a thread. It does not change Settings (Deferred 1). Every such action shows in the target thread, marked as the assistant's.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| 1 | The assistant changes Settings for Collin (models, accounts, project tools, auto-merge) | Settings changes are rare; threads are the everyday work | planning | Each Settings screen needs its own action for the assistant; reuse whatever action route this thread builds for thread actions |
| 2 | The assistant tells Collin on its own when a thread finishes, gets stuck or starts waiting on Collin | Needs you already flags what is waiting; ask-and-act comes first | planning | Needs a background trigger from hub thread events to the assistant session; mind model cost of waking it |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
