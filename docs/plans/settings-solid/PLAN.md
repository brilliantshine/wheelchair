---
slug: settings-solid
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-26
---

# Make the Settings page solid

**Idea:** `IDEA.md` — read it first. **Map:** `MAP.md`. Source of the four items: Deferred
rows 1-4 of `docs/plans/settings-rework/PLAN.md`.

## Open Questions

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Collin prefers his own wording to the `build-up` sentence: plain words first; a technical term only when truly needed, then built up to; never tack a term's name onto a plain explanation | Scope change: rewrite the agent sentence at `viewer/app/settings.js:144` (and the label) to say that | Yes, after Q2 | |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is thorough | Collin picked it | user |
| 2 | No designer: no new screens, only matching or keeping the settings-rework mockups | The visible parts are a label/size tweak judged against existing mockups | defaulted |
| 3 | While a sign-in card is open in Accounts, usage answers do not repaint Accounts (its usage lines refresh once the card closes or the sign-in finishes); Usage still repaints | Certain fix for lost focus and dropped presses; the frozen numbers are only visible while signing in | defaulted |
| 4 | Any Settings block repaint holds the position of the focused control or the control under a pressed pointer when it lies below the repainted block and is on screen; a repaint that would land during a press waits until the press ends | Covers Lead order under Usage and any later case, not only the sign-in card | defaulted |
| 5 | Q1: shorten the Technical terms option to "Build up to them, unless already used" (label only; stored value `build-up` and the agent sentence at `viewer/app/settings.js:144` unchanged). Collin: "we can do shorter wording" | The label is display only; agents get the fixed sentence from the stored value | user |
| 6 | Q2: leave the taller phone rows and boxes (and the desktop Threads folder hint) as they are; no change to match the settings-rework mockups' heights | Collin picked "Leave them"; nothing is cut off or overlapping | user |

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
