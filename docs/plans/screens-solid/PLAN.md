---
slug: screens-solid
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-18
---

# Make agent screens solid

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

Map: `MAP.md` and `docs/maps/agent-screens.md`. Parent plan:
`docs/plans/drive-local-app/PLAN.md` on branch `wc/940599e3df66` (merged as PR #113).

## Open Questions

### Q1: Window manager — which, if any?
- **Context:** No small window manager is installed on hearth (MAP.md). `openbox` and
  `matchbox-window-manager` are both in Debian trixie. Starting one "if present on PATH"
  does nothing on hearth until Collin installs one.
- **Options:** (a) support one named WM (openbox), started per screen when on PATH, and
  the installer/Ready say it is optional and how to install it; (b) drop the item.
- **Recommendation:** (a).

### Q2: Missing screen tools — block Start building or just warn?
- **Context:** Ready `missing` makes `ok: false`, which disables Start building for every
  plan, including ones that never use a screen.
- **Options:** (a) informational only (status reports it; Ready shows a note; installer
  warns); (b) blocks Start building.
- **Recommendation:** (a).

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is thorough | Collin picked Thorough | user |
| 2 | Archive deletion of screenshots already exists; the screenshot item becomes pruning while the thread is open | MAP.md: archive removes `<stateDir>/screens/<thread>/` (`machine/lib/screen.js:72`) | defaulted |
| 3 | Screen cap is machine-wide, 8 running-or-starting screens, overridable by `WHEELCHAIR_MAX_SCREENS`; past the cap `start`/`run` return 422 naming the cap and how many run | hearth: 16 cores, 27 GB; Xvfb plus an app is a few hundred MB | defaulted |
| 4 | Pruning keeps the newest 50 screenshots per session, pruned after each new shot | Agents read the latest shots; image cards copy the file, so older ones are safe to delete | defaulted |
| 5 | Launch failure and drag overrun use the approaches in the parent's Deferred rows 7 and 8 | Already evidenced and agreed there | adopted |
| 6 | App pid and process group recorded in state.json from the scope's MainPID once active; unread by teardown (still by slice) | Parent Spec Ownership line; Decision 21 there | adopted |

## Spec

_Filled as decisions land._

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
