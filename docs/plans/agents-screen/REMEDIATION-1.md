# Remediation 1 — agents-screen

Verification attempt 1 at `70668d4`, one GPT verifier. Verdict FAIL. Gap list verbatim:

> GAP: Unit validation must pass — full suite: 347 passed, 1 failed. Font route returned 404 instead of 200 (`viewer/test/routes.test.js:181`); this worktree lacks local font dependencies. A focused rerun also reproduced the acknowledged lifecycle failure (`viewer/test/lifecycle.test.js:449`).
> GAP: Browser validation must pass — 556 passed, 4 failed, 2 skipped. Both browsers failed font loading (`viewer/test/app-fonts.spec.js:46`) and the acknowledged arrow test (`viewer/test/browser.spec.js:2411`). Playwright was supplied through environment variables from the canonical clone.
>
> No additional functional spec gaps found.

## Tasks

None are code tasks:

- **Font 404s (`routes.test.js:181`, `app-fonts.spec.js:46`).** Environmental: the verifier's
  worktree had no `viewer/node_modules`, and fonts are served from `node_modules/@fontsource`.
  With `npm --prefix viewer ci` run first, both pass (sub-lead run at `5a0a2e2`: the unit suite's
  only failure was lifecycle, and the browser suite had no font failure). Fix: the re-verify
  brief says to run `npm --prefix viewer ci` first.
- **lifecycle port race and `browser.spec.js:2395` arrow test.** Both reproduce identically on
  the pre-build base `7f4c318`. The lead ruled them out of scope, and they are recorded in
  `docs/known-issues.md`. The re-verify brief names them as not counting against the build.
