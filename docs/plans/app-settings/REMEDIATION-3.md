# Remediation 3 — app-settings

Verification attempt 3 checked commit `f833864`. The Claude verifier passed it and the Codex
verifier failed it with one new gap; it repeats nothing from Remediations 1 or 2. The
attempt fails.

## Gap (verbatim, Codex verifier)

GAP: Phone layout must preserve usable navigation — adding Settings pushes New thread almost entirely outside a 390px viewport, where horizontal clipping hides it — `viewer/pages/nav.js:42`, `viewer/pages/app.css:170`. Isolated Playwright checks measured the button at x389–421 in Chromium and x386.6–418.7 in Firefox; removing the added link restores it fully inside both viewports.

## Tasks

### R3-1 — the nav fits a phone with four links (Claude, Standard; built by T4's family)

- Objective: at viewport widths up to 480px, every item in `#app-nav` fits entirely inside
  the viewport, with no horizontal page scroll, on every app page: threads, thread,
  features, sessions, settings, doc. That covers the brand mark, the four view links, Needs
  you and New thread. Check down to 360px.
- Approach (settled): under the existing `@media (max-width: 480px)` block in
  `viewer/pages/app.css`, the Settings link shows a small inline gear icon instead of its
  text label. Add the icon in `viewer/pages/nav.js` as a fixed inline SVG, the same way the
  brand logo is built (`nav.js:20-23`). The link keeps `aria-label="Settings"` and its
  `href`. Above 480px the link reads "Settings" exactly as now. If the gear alone does not
  make every item fit at 360px, also tighten the 480px block's `.seg a` padding or `gap`.
  Change nothing else in the nav's look above 480px.
- Ownership: `viewer/pages/nav.js`, `viewer/pages/app.css` (the 480px block only),
  `viewer/test/app-settings.spec.js`.
- Test: for widths 390 and 360, on the threads page and the settings page, assert that each
  `#app-nav` child's bounding box lies within `[0, viewport width]`, that New thread is
  fully visible, and that `document.documentElement.scrollWidth <= window.innerWidth`. Also
  assert that the Settings link still has the accessible name "Settings" at 390px, and the
  visible text "Settings" at 1280px.
- Validation: `npm --prefix viewer run test:browser`. Only the known "no drawn arrow's line"
  failures may remain.
