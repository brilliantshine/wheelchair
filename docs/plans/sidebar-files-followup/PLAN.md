---
slug: sidebar-files-followup
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-20
---

# Thread files: the parts saved for later

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here.

Background: `docs/plans/thread-sidebar-files/PLAN.md` (Deferred D1–D7, Accepted Risks,
Review Rounds) and this plan's `MAP.md`.

## Open Questions

### Q1: How long are sent files kept after a thread is archived?
- **Context:** Today archive deletes the whole uploads folder (`machine/service.js:1209-1217`).
  There is no thread deletion, so "kept" with no rule means kept for good. Each sent file is
  at most 25 MiB (`machine/service.js:38`).
- **Options:** for good; 30 days after archive, then removed; for good, with a way to delete
  them by hand.
- **Recommendation:** for good. Agent-sent files are few and small; a timer would surprise.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is two-part | User's pick | user |
| 2 | Picture downloads are PNG | Opens in every phone gallery and app; SVG often does not | defaulted |
| 3 | "Download all" is one zip of the thread's existing MAP.md, IDEA.md and PLAN.md | IDEA asks for project documents; pictures have their own image download, sent files their own rows | defaulted |
| 4 | In-app preview covers Markdown (rendered like the doc page) and plain text types (.txt, .log, .csv, .json and similar, shown as text) | IDEA's "text or Markdown"; other types keep downloading | defaulted |
| 5 | Threads on another computer read documents and pictures through that thread's machine service, with the network call made outside the per-thread locks | Required by IDEA's "must not freeze the thread list" and the lock rules in MAP.md | defaulted |
| 6 | Files already deleted by past archives are not recovered | They no longer exist anywhere | defaulted |

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
