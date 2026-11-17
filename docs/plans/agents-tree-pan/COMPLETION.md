---
slug: agents-tree-pan
date: 2026-11-17
implemented-by: "standard, gpt-6.1-terra (T1, T2; claude was asked for, the hub sent gpt); sub-lead: claude-opus-5-5"
verified-by:
  - round: 1
    lane: verifier, claude-opus-5-5
    checks: "standard, gpt-6.1-terra"
---

# Completion Report — Drag the Agents tree to see all of it

Written for a hostile reviewer: every claim checkable, no claim without evidence.

```yaml
verified-by:
  - round: <n>
    lane: <verifier lane/model>
    checks: <the implementing lane it checked>
```

Line numbers are on the feature branch at the commit this report is committed in. `agents.js` keeps
the file's one-statement-per-line style, so several Spec items share a long line.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Layout: `.agents-view` fixed-height column, `.agents-layout` flexes (banners shorten it), sidebar and side panel scroll (dec. 15) | this run | `viewer/pages/views.css:183-186` | full browser suite (existing banner/sidebar tests) |
| Layout: `.agents-main` column; tree area takes the rest, `overflow: auto`, min 160px | this run | `viewer/pages/views.css:187,189` | `viewer/test/app-views.spec.js:92` |
| Layout: sizer at natural size × zoom, tree `scale(zoom)` from `0 0`, centred horizontally when narrower, top-aligned | this run | `viewer/pages/agents.js:17`; `viewer/pages/views.css:191-192` | `app-views.spec.js:57` (narrow-tree centring kept) |
| Layout: terminal open and not full screen → `.agents-main` bottom padding = panel height via CSS variable (dec. 13) | this run | `viewer/pages/agents.js:10-12`; `viewer/pages/views.css:187` | `app-views.spec.js:92` (Validation 11) |
| Moving the tree is scrollLeft/scrollTop: wheel, trackpad and scrollbars stay native (dec. 2) | this run | `viewer/pages/views.css:189`; `viewer/pages/agents.js:25` (only Ctrl+wheel intercepted) | `app-views.spec.js:57` (direct scroll reaches the right edge) |
| Toolbar: −, zoom %, +, Fit, 100%; accessible names Zoom out / Zoom in / Fit / Full size; above the tree; hidden under 900px | this run | `viewer/pages/agents.js:74-77`; `viewer/pages/views.css:188,195` | `app-views.spec.js:92`, `:212` |
| Zoom: 20–200% clamp; ± by 1.25 around the area's centre | this run | `viewer/pages/agents.js:19,29` | `app-views.spec.js:92` (Validation 6) |
| Zoom: Ctrl+wheel, non-passive, `preventDefault` only with Ctrl, keeps the point under the pointer | this run | `viewer/pages/agents.js:19,25` | `app-views.spec.js:92` (Validation 5) |
| Zoom: two-finger touch pinch around the midpoint | this run | `viewer/pages/agents.js:26-27` | not covered by a browser test (see risks) |
| Fit: min(1, w/natural, h/natural) less 16px, clamped to 20%, top, centred | this run | `viewer/pages/agents.js:21` | `app-views.spec.js:92` (Validation 7) |
| 100%: zoom 1, top, lead box centred; also the opening view (dec. 10) | this run | `viewer/pages/agents.js:20,23` | `app-views.spec.js:57` (Validation 1), `:92` |
| Drag: primary mouse / pen / one finger anywhere; >5px → capture, `dragging` class, scroll follows | this run | `viewer/pages/agents.js:26-27`; `viewer/pages/views.css:190` | `app-views.spec.js:92`, `:149` (Validation 2, both axes within 2px) |
| Drag on a box selects nothing (capture-phase click suppressor); still click selects as today | this run | `viewer/pages/agents.js:28` | `app-views.spec.js:92` (Validation 3), `:163`, `:229` (Validation 4) |
| Gesture lasts until every pointer is up; a second touch makes it a pinch and suppresses clicks from all its pointers (dec. 16) | this run | `viewer/pages/agents.js:13,26` | not covered by a browser test (see risks) |
| Release outside the tree area still ends the gesture (window-level pointerup/cancel; T2 fix) | this run | `viewer/pages/agents.js:13-14` | `app-views.spec.js:196` |
| `touch-action: none`, `grab` cursor on the tree area; boxes keep their own cursor | this run | `viewer/pages/views.css:189` | — (CSS only) |
| Asides dragged through like empty space | this run | `viewer/pages/agents.js:26` (pointerdown on the tree area, any target) | — |
| View record `{lead, zoom, left, top, mainTop}` updated on tree and `.agents-main` scroll and zoom | this run | `viewer/pages/agents.js:18,24` | `app-views.spec.js:92` (Validation 9), `:163` |
| After each rebuild: same lead → restore zoom, tree scroll, main scroll; different lead → 100% view | this run | `viewer/pages/agents.js:16,23` | `app-views.spec.js:92`, `:163` (Validation 9), `:181` (Validation 10) |
| Rebuild deferred from any pointer down until all are up, flushed with `setTimeout(…,0)` after the click; `go()` clears pending (dec. 14, 15) | this run | `viewer/pages/agents.js:13,41,81` | `app-views.spec.js:92` (Validation 8, still press held across a poll) |
| Terminal, its height, full screen and side panel behave as today | this run (unchanged code) | `viewer/pages/agents.js:34-40` untouched apart from observers at `:11-12` | existing terminal tests in `app-views.spec.js` |
| Phones under 900px: no toolbar, no fixed-height column, no transform, no handlers | this run | `viewer/pages/agents.js:8,78`; `viewer/pages/views.css:183,194-196` | `app-views.spec.js:212` (Validation 12) and existing phone tests |
| No change to `.agents-children`, `.agents-branch`, `.agents-box` geometry | this run | `viewer/pages/views.css:132-149` unchanged; only `.agents-sizer > .agents-branch` gets `width: max-content; transform-origin` at `:192` | `git diff 58255df -- viewer/pages/views.css` |

There was no Prior Work, so no row is pre-existing.

## Deviations from plan

- Validation items 2–11 are asserted in one combined desktop test (`app-views.spec.js:92`) plus four separate tests T2 added (`:149`, `:163`, `:181`, `:196`), rather than one test per item.
- `.agents-sizer > .agents-branch { width: max-content }` (`views.css:192`) is a rule on a direct child `.agents-branch` that the Spec did not name; without it the tree shrinks to the sizer's width. It sets no box or connector geometry.

## Routers

None. This change moved no ownership, and no router names a file by a role the change alters.

## Validation evidence

On the feature branch after both merges (b680e63), run one after the other:

```text
$ node --test viewer/test/*.test.js
# tests 493
# pass 493
# fail 0
exit 0

$ npm --prefix viewer run test:browser
  16 skipped
  676 passed (4.1m)
exit 0
```

Earlier runs on the T2 branch each had one different failure in a file this change does not touch
(`run.test.js` port refusal, `server.test.js` write-lock, `app-settings.spec.js`,
`app-threads.spec.js` phone chips). Another session's test suite was running on the same machine
at the time. Those files passed when re-run alone (`node --test viewer/test/run.test.js
viewer/test/server.test.js`: 58/58; `playwright test app-settings app-threads app-views`: 244
passed).

## Known gaps / residual risks

- Touch pinch and its click suppression (dec. 16) have no browser test; Playwright's desktop
  projects have no multi-touch. They are checked only by reading `agents.js:26-28`.
- Ctrl+wheel is tested with a synthetic `wheel` event. A real trackpad pinch in Firefox and Chromium
  has not been tried by hand.
- The other open thread ("Agents tree: straight connectors, shorter boxes") changes box CSS;
  the sizer measures `offsetWidth`/`offsetHeight` each render, so it should not depend on box sizes.
  The two have not been combined and tested.
- `docs/plans/agents-tree-pan/reports/T1.md` carries about 5,000 lines of pasted test log.

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.
