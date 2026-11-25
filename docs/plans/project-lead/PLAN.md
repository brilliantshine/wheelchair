---
slug: project-lead
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-24
---

# A project lead pinned in each project

**Idea:** `IDEA.md`. Map: `MAP.md` and `docs/maps/project-assistant-flow.md`.

## Open Questions

### Q3: How do the assistant and the project lead hand work to each other?
- **Options:** no handoff (each says where to ask); assistant passes project questions to the project lead; both directions.
- **Recommendation:** to settle after Q1–Q2.

### Q4: Agree the mockups

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Projects group by folder basename across machines (`viewer/pages/threads.js:104-107`) | What "a project" is for a project lead (machine + path) and how the list shows same-named folders | no | |
| 2 | Assistant actions have no project scope check (`viewer/app/assistant-actions.js:8-14`) | Hub-side refusal of out-of-project targets, not prompt-only | no | |
| 3 | Assistant runs on the hub in a folder with no project (`machine/service.js:634-638`) | Depth needs read access to the project's code, plans and git history on its own machine | no | |
| 4 | Singletons: status, seen key, preview, popup (`viewer/app/assistant.js:17-27`, `viewer/pages/assistant-popup.js:8`) | Each needs a per-project form | no | |

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is two-part. | Collin picked it. | user |
| 2 | Why: both less noise and deeper project knowledge. | Collin picked "Both" (after first picking "Too much noise" by mistake). | user |
| 3 | One Settings switch turns project leads on (off by default). When on, every project shows a pinned project lead; its agent starts only when Collin first writes to it. | Collin picked "One switch, starts on use": idle projects cost nothing. | user |
| 4 | On a project's pages the pop-up opens that project's lead, with a one-tap switch to the all-projects assistant; elsewhere it opens the assistant as today. | Collin picked "Project lead, with a switch". | user |

## Spec

### S1. Switch and lifecycle

- A Settings switch "Project leads", off by default, separate from the personal assistant switch.
- When on, every project in the threads list shows a pinned project lead row. No agent runs for it until Collin first sends it a message (from its thread or the pop-up); that message starts its lead.
- Turning the switch off stops every live project lead and hides the rows.

### S2. Pop-up

- On a page that belongs to a project (that project's threads, and its project lead thread's own page excepted as today), the pop-up opens that project's lead, with a one-tap switch at its top to the all-projects assistant and back.
- On every other page it opens the assistant as today.
- With only one of the two switches on, the pop-up opens that one and shows no switch.

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
