---
slug: thread-sidebar-files
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-19
---

# Thread sidebar: project documents and files from agents

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

### Q1: Which files count as project documents?
- **Context:** A plan folder holds MAP.md, IDEA.md, PLAN.md and graphs, and after a build
  also COMPLETION.md, REMEDIATION-N.md and `reports/` (worker and verifier notes). The
  sidebar today shows only map, idea, plan and pictures.
- **Options:** A) map, idea, plan and pictures only; B) everything in the plan folder;
  C) A, plus the rest folded under "More".
- **Recommendation:** A — matches "starting with today's map, idea, plan"; the rest are
  agents' working notes.

### Q2: Do files agents sent survive archiving the thread?
- **Context:** Archive deletes the thread's uploads folder on its machine today
  (`machine/service.js:1181-1189`); map, idea and plan survive because they are committed.
- **Options:** A) removed on archive, like attachments; B) kept after archive.
- **Recommendation:** A for now; keeping them is hardening.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is two-part | User's pick | user |
| 2 | Only the lead sends documents to the user, through a new lead-only card kind; sub-leads and workers ask the lead with a `message` | Same rule as the `image` card; keeps one voice to the user | defaulted |
| 3 | A sent document is a copy taken at send time into the thread's uploads on its machine, like `image` | Reuses the existing copy, stream and safety path; later edits to the source do not change what the user got | defaulted |
| 4 | A sent document also shows as a small card in the chat, besides the sidebar listing | The user notices it arrived without watching the sidebar | defaulted |
| 5 | Plan documents are read through the thread's machine, so remote threads work | IDEA constraint; uploads already stream through the machine (`viewer/app/routes.js:104-117,501-510`) | defaulted |
| 6 | Each document gets its own open and download control; no "download all" | Simplest form of "easily downloadable" | defaulted |
| 7 | On a phone, both sections live where the plan links sit today, under the thread header | No right column on phones (`viewer/pages/thread.js:260`) | defaulted |

## Spec

_Grows as decisions land._

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| D1 | Download pictures (diagrams) as image files | Pictures still open full size; the map, idea and plan downloads carry the content | planning | Graphs are JSON/HTML rendered client-side; needs a render-to-PNG or SVG export |
| D2 | Download all documents at once (zip) | Per-file download works | planning | |
| D3 | In-app preview for sent documents other than images | Download opens them with the phone's own viewer | planning | Markdown could reuse the doc page renderer |

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
