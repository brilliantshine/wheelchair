---
slug: project-tools-screen
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-18
---

# A screen for a project's tools

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

**Map:** `MAP.md` and `docs/maps/project-tools.md`.

## Open Questions

### Q1: How does a saved change reach the branch threads start from?
- **Context:** Threads start from `origin/<default branch>` (`machine/service.js:529-542`), so
  editing a local checkout does nothing. No app path commits to a project's default branch today.
- **Options:** (a) the machine commits and pushes straight to the default branch; (b) the
  machine pushes a branch and opens a pull request Collin merges; (c) the screen starts a
  small-fix thread that makes the change through the normal lead flow.
- **Recommendation:** (b): reviewable, works with branch protection, one tap to merge on GitHub.

### Q2: Where do a tool's keys live?
- **Context:** No per-project secret store exists; `.mcp.json` is committed. Codex passes
  `${SAME_NAME}` env through from the CLI environment (`machine/adapters/codex.js:84-92`).
- **Options:** a mode-600 per-project file on the machine, entered on the screen and
  injected as env at session start; or entered only on the machine by hand.
- **Recommendation:** entered on the screen, stored on the machine, never in the hub or repo.

### Q3: Where does the screen live in the app?
- **Options:** a new Projects page; a section in Settings.
- **Recommendation:** decide after Q1/Q2; possibly defaulted.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Antigravity agents get no project tools (`machine/adapters/agy.js:30-32`) | Say so on the screen, or leave | no | |
| 2 | Codex rejects headers and most `${...}` (`machine/adapters/codex.js:58-102`) | Screen should flag entries Codex would skip | no | |
| 3 | Project record is only a path; machine and default branch live on threads | How the screen identifies a project | no | |
| 4 | Form vs raw JSON; unknown fields in existing files | Keep fields the form doesn't know | no | |

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is thorough | Collin picked it | user |

## Spec

To be written as decisions land.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
