---
slug: settings-solid
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-26
---

# Make the Settings page solid

**Idea:** `IDEA.md` — read it first. **Map:** `MAP.md`. Source of the four items: Deferred
rows 1-4 of `docs/plans/settings-rework/PLAN.md`.

## Open Questions

### Q1: How should the phone Technical terms picker fit its selected option?
- **Context:** At 390px the closed select has ~306px of text room; "Build up to them, unless we've used them before" needs ~309px in 13px Inter (`viewer/pages/settings.js:1235`, `viewer/pages/settings.css:135-144`).
- **Options:** shorten that option's label (everywhere); smaller text in the select on phone; narrower phone gutters; a custom picker.
- **Recommendation:** shorten the label.

### Q2: Should the taller phone rows and boxes be tightened to the mockups?
- **Context:** Real Inter wraps the phone You list line and the assistant title onto an extra line (rows 7-37px taller); Writing style box and Diagrams stack are ~12px taller; desktop Threads folder hint wraps differently. Nothing is cut off or overlapping.
- **Options:** leave as is; tighten to match the mockups.
- **Recommendation:** leave as is.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is thorough | Collin picked it | user |
| 2 | No designer: no new screens, only matching or keeping the settings-rework mockups | The visible parts are a label/size tweak judged against existing mockups | defaulted |
| 3 | While a sign-in card is open in Accounts, usage answers do not repaint Accounts (its usage lines refresh once the card closes or the sign-in finishes); Usage still repaints | Certain fix for lost focus and dropped presses; the frozen numbers are only visible while signing in | defaulted |
| 4 | Any Settings block repaint holds the position of the focused control or the control under a pressed pointer when it lies below the repainted block and is on screen; a repaint that would land during a press waits until the press ends | Covers Lead order under Usage and any later case, not only the sign-in card | defaulted |

## Spec

(Drafted once the open questions are settled.)

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
