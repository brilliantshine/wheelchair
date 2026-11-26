---
slug: settings-solid
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-26
---

# Make the Settings page solid

**Idea:** `IDEA.md` — read it first. **Map:** `MAP.md`. Source of the four items: Deferred
rows 1-4 of `docs/plans/settings-rework/PLAN.md`.

## Open Questions

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| 1 | Collin prefers his own wording to the `build-up` sentence: plain words first; a technical term only when truly needed, then built up to; never tack a term's name onto a plain explanation | Scope change: rewrite the agent sentence at `viewer/app/settings.js:144` (and the label) to say that | Yes | Added to scope, Decision 7 |

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
| 7 | Rewrite the `build-up` agent sentence to: "Use plain words when they work. Use a technical term only when it's truly needed, and then build up to it and ground it first. Don't add a term's name to something already said plainly." Its picker label becomes "Plain words first, build up if needed" (supersedes the label in Decision 5; the stored value stays `build-up`). IDEA.md What/Why/What good looks like updated | Collin pressed "Add it" after saying agents explain plainly then tack on the jargon name | idea-change |

## Spec

Law: `CONTRIBUTING.md` (Validation, Editing conventions). A spec that tests scroll or
pixels goes on `viewer/test/firefox-specs.js`.

### S1. Technical terms option wording

- `viewer/pages/settings.js:1235`: the `build-up` option's label becomes exactly
  `Plain words first, build up if needed`. The other two labels, the stored values
  (`build-up`, `freely`, `avoid`) and saved settings are unchanged; no migration.
- On a 390px-wide page with You open, the closed Technical terms select shows that label
  in full (its text width fits inside the select's content box).
- `viewer/app/settings.js:144` (`renderStyle`): the `build-up` sentence becomes exactly
  `Use plain words when they work. Use a technical term only when it's truly needed, and then build up to it and ground it first. Don't add a term's name to something already said plainly.`
  `freely` and `avoid` sentences are unchanged. It reaches sessions the way the style
  already does (sessions started after the change). The default free text at
  `viewer/app/settings.js:36` is unchanged.

### S2. Sign-in card is never rebuilt by a usage answer

- `accountsBusy()` (`viewer/pages/settings.js:1422`) is also true while a sign-in card is
  open inside the Accounts block (`signCard` set and its element inside the Accounts
  host). Then `refreshUsage` repaints Usage but not Accounts, on the 30-second timer and
  on every other usage answer.
- Nothing else changes: `closeSignin` already calls `refreshStatus`, which repaints
  Accounts with the latest usage once the card closes (finished, cancelled or expired).
  Repaints caused by Collin's own actions (account edits, turning a harness on or off,
  opening the card) still repaint Accounts.

### S3. A refresh waits for a press to end

- While a pointer is down inside the Settings panel (from `pointerdown` until `pointerup`
  or `pointercancel` on the window, or the window losing focus), `paint` calls made by
  timers or by answers arriving (usage, Harnesses polling, the sign-in card's status
  poll's repaints of other blocks) are queued, not run. When the press ends, the queued
  block names run once each, in first-queued order, after the click event has been
  dispatched (for example on the next task after `pointerup`).
- `paint` calls made directly by Collin's own action (a click or change handler) run as
  today. Simplest acceptable shape: queue every `paint` while the press is down; a click
  handler runs after `pointerup`, so it is unaffected.
- `renderCategory` (switching categories) is not delayed.

### S4. Whatever is in use holds its place

`holdPlace(host)` (`viewer/pages/settings.js:2487`) picks the first anchor that exists,
is outside `host`, comes after `host` in the page, and is at least partly on screen below
the sticky nav:

1. the focused element, if inside the Settings panel;
2. with a mouse (not touch or pen), the element at the last known pointer position
   (`document.elementFromPoint` from the latest `pointermove` over the panel), if inside
   the panel;
3. the open sign-in card (today's rule);
4. otherwise today's next-sibling rule, unchanged.

After the repaint it scrolls by the anchor's change in `getBoundingClientRect().top`, so
the anchor stays at the same screen position. If the page cannot scroll far enough
(near the top), the anchor may still move; no other compensation. An anchor inside the
host being replaced is not held (S2 keeps the sign-in card out of that case).

Concrete case this must fix: Usage and balancing open, page scrolled so Lead order's
buttons are on screen under the Usage block, mouse resting on a Lead order button; the
first usage answer adds the bars; the button stays under the mouse.

### Non-goals

No change to what usage shows, how often it refreshes, the phone row heights, the
category layout or the old `#` addresses (Decision 6, IDEA.md Not doing).

### Validation

New browser spec `viewer/test/app-settings-hold.spec.js`, added to
`viewer/test/firefox-specs.js` (it tests scroll position), with these tests:

- Sign-in card open in Accounts, code box focused with text typed; a usage answer
  arrives (and the 30-second refresh fires): the card is the same node, the code box
  keeps focus and text, and the Accounts block was not rebuilt; after the card is closed,
  Accounts shows the newer usage.
- Pointer down on Send code while a usage answer is held, then released; then pointer up:
  Send code's click handler runs once.
- The Lead order concrete case in S4: the hovered button's on-screen top changes by at
  most 1px across the first usage answer.
- A focused Lead order button below Usage keeps its on-screen top within 1px across a
  usage answer.
- At 390px wide, `#you`: the Technical terms select shows `Plain words first, build up if needed`
  and the label's text width is not wider than the select's content box.

Update `viewer/test/app-settings.test.js` so a `build-up` style renders the new S1
sentence exactly.

Commands:

```bash
node --test viewer/test/app-settings.test.js
npm --prefix viewer run test:browser -- app-settings-hold.spec.js app-settings.spec.js app-accounts.spec.js app-harnesses.spec.js
```

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-26

**Lanes:** TBD

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
