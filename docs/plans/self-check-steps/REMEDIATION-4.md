# Remediation 4 — self-check-steps

Verification attempt 4 on `5e693f8dc80d40c2fe201465debabec43ea8e98f`: claude verifier PASS;
gpt verifier FAIL with two gaps.

## Gaps, verbatim

GAP: Check-card update instructions — The renderer changes a valid command path. At 390 px, Chromium and Firefox both displayed `/opt/_release_/bin` as `/opt/release/bin` because the update text was parsed as Markdown. [Renderer](viewer/pages/thread.js:839) · [Browser probe](/tmp/wc-verifier-10.vzGAgPHA/probe-literal.log)
GAP: Queued Fix it now — The lead can treat a superseded press as current. An isolated hub accepted a press for version A, recorded Done and a check card for version B, then delivered the press for A. The lead rule looks for a Done after the latest check card, so it misses the version change and directs the lead to use B’s notes for A’s press. [Lead rule](protocol/app/lead.md:515) · [Queue probe](/tmp/wc-verifier-10.vzGAgPHA/probe-queued-gated.log)

## Status

- The queued-press gap is the same gap as attempt 2's "Fix it now after a newer Done" and
  attempt 3's "Fix it now for the current head", surviving two fix attempts (R5, R6). Per the
  two-attempt rule it is a plan defect: sent to the lead, no third attempt.
- The update-rendering gap is new (first attempt). Held until the lead answers.

Lead: fix the update gap meanwhile (plain text, browser test).

# R7 — check card: show the `update` text as plain text

Task id: R7. Tier: Light. Remediation of verification attempt 4.

Gap: `viewer/pages/thread.js:839` renders the check card's `update` with `prose('check-update', card.update)` (Markdown), so `/opt/_release_/bin` displays as `/opt/release/bin`. The Spec says all card text is set as text.

Exact change:
1. `viewer/pages/thread.js` line ~839: replace `box.appendChild(prose('check-update', card.update));` with `box.appendChild(el('div', 'check-update', card.update));` (the `el` helper sets text, as the step lines do).
2. `viewer/pages/thread.css`: keep `.card-check .check-update { ... overflow-wrap: anywhere; }` and add `white-space: pre-wrap;` to it so line breaks in `update` are kept; delete the now-unused rule `.card-check .check-update code { ... }` (just that line).
3. `viewer/test/app-check-card.spec.js`: add a test (inside the existing size loop, using the same `startWorld`/`postDone`/`check` helpers) posting a check card whose `update` is ``Run `cd /opt/_release_/bin` then **merge** it.`` and asserting `#card-<id> .check-update` has exactly that text (`toHaveText`, literal backticks and asterisks), and that the card contains no `code` or `strong` element. Then run the existing "long path and code span" wrap test unchanged; it must still pass at 390px.

## Ownership boundary
`viewer/pages/thread.js` (that one line), `viewer/pages/thread.css` (the check-update rules), `viewer/test/app-check-card.spec.js`, your report `docs/plans/self-check-steps/reports/R7.md`. Write scratch logs outside the repository.

## Validation (paste output tails)
```bash
npm --prefix viewer run test:browser -- app-check-card.spec.js
git status --short   # clean after your commit
```
