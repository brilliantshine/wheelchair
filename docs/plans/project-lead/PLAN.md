---
slug: project-lead
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-24
---

# A project lead pinned in each project

**Idea:** `IDEA.md`. Map: `MAP.md` and `docs/maps/project-assistant-flow.md`.

## Open Questions

### Q1: Which projects get a project lead, and when does it run?
- **Context:** each project lead is a live agent; one per project costs model usage. The assistant is opt-in by one Settings switch (`viewer/app/settings.js:56`).
- **Options:** every project, always on; a Settings switch for all projects, agent started only when Collin first writes to it; a per-project switch.
- **Recommendation:** one Settings switch; pinned row shown in every project; agent starts on first message.

### Q2: Which one does the pop-up open on a project's pages?
- **Context:** the pop-up always opens the single assistant and sends no page context (`viewer/pages/nav.js:171-180`, `viewer/pages/assistant-popup.js:337-345`).
- **Options:** project lead; assistant; project lead with a one-tap switch to the assistant.
- **Recommendation:** project lead with a switch.

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

## Spec

(grows as decisions land)

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
