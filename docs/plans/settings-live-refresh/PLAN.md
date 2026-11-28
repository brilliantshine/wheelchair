---
slug: settings-live-refresh
status: planning
created: 2026-11-28
---

# Auto-refresh an open Settings page when settings change

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

### Q1: When an external change arrives while a section has unsaved edits, how should the section show it?
- **Context:** When you have unsaved edits in a Settings section and a newer value arrives from the assistant or another tab, we keep your draft untouched and show a short note that settings changed elsewhere.
- **Options:**
  1. **Keep draft + "Load latest" button:** Show an inline note ("Updated elsewhere") with a one-tap **Load latest** button that discards your draft and repaints that section. Pressing **Save** still saves your draft as usual.
  2. **Keep draft + passive note only:** Show an inline note ("Updated elsewhere — save or clear edits to refresh") with no extra button; the section updates once you save, clear your edits, or reload the page.
- **Recommendation:** Option 1 (Keep draft + "Load latest" button) — on a phone it gives a one-tap way to pull in what the assistant just changed without manually undoing a draft or reloading the whole page.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---|---|---|---|
| 1 | 2026-11-28 | Peer thread `11c53653de4e` ("Custom accent color and theme options") may touch `viewer/pages/settings.js` or `viewer/app/settings.js`; messaged its lead to check for overlap | no (waiting on peer reply) | open |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Skip designer mockups for this feature | Only visible addition is a compact inline note (and optional Load latest button) reusing existing Settings page styles; no new screen or layout redesign | defaulted |
| 2 | Track external changes with a lightweight hub revision token (`<boot-id>:<seq>`) polled every 5 seconds via `window.wcPoller` (paused when tab is hidden), bumped on every hub-handled Settings/background/diagram/harness/account/shared-key mutation, and fetch full data only when the token changes | Keeps idle tabs cheap (zero `model.sh` subprocesses or machine calls when unchanged) and prevents revision collisions after a hub restart | defaulted |
| 3 | Preserve typed edits with a clear conflict note if saving a lesson or template fails because it was modified or deleted externally (HTTP 409) | Matches existing lesson import/action draft retention and ensures user text is never silently wiped | defaulted |

## Spec

*To be filled once Open Questions and Watch List are settled.*

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log

- 2026-11-28: Created `PLAN.md` after `IDEA.md` confirmation and mapping (`MAP.md` at `86e9b02d`). Messaged peer lead `wc-11c53653de4e-lead` to check whether "Custom accent color and theme options" overlaps with Settings page/hub files.
