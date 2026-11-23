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

### Q1: What may the assistant do when Collin tells it to?
- **Context:** Today agents can only start helpers inside their own thread and message leads on the same machine; other projects need a reach approval each time (MAP.md, "Starting and steering").
- **Options:** (a) anything Collin can do in the app, including archiving; (b) start threads, message leads, answer a lead's question card with the answer Collin gives, press Start building, restart a dead lead, but not archive; (c) only start threads and message leads.
- **Recommendation:** (b).

### Q2: Agree the mockups
- **Context:** The pinned thread and the pop-up are new visible surfaces. A designer drafts them.
- **Options:** agree, or ask for changes.
- **Recommendation:** n/a.

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

## Spec

To be written as decisions land.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
