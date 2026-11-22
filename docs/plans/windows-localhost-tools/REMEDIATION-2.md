# Remediation 2 — windows-localhost-tools

Verification attempt 2 on `af3e6d5c` (verifiers: claude-opus-5-5 PASS, gpt-6.2-sol FAIL). Gap list as reported:

1. GAP: §7 Project tools page — An open editor can silently undo a switch change made on the tool card — In Chromium and Firefox, I opened a marked tool for editing, switched it off on the card, edited its URL, and saved. The request still sent `windows: ["loc"]` because the editor wrote back the switch value it captured when it opened. (`viewer/pages/project-tools.js:787`)
2. GAP: §7 dirty check — Rare path: duplicate names in `wheelchair.windows` enable Save before any edit. (`viewer/pages/project-tools.js:275`)

Gap 2 is a rare path, recorded in PLAN.md Accepted Risks (verification-2).

## R2-1 (gap 1)

Task T8, brief below; lane standard, `--provider claude` (the page was built on Claude).
# Task T8 (remediation 2) — an open Edit form must not undo a switch change made on the tool card

Spec §7 (Project tools page) and §6 (status line follows the switch). Verifier finding, verbatim: "An open editor can silently undo a switch change made on the tool card — In Chromium and Firefox, I opened a marked tool for editing, switched it off on the card, edited its URL, and saved. The request still sent `windows: ["loc"]` because the editor wrote back the switch value it captured when it opened." Source: `viewer/pages/project-tools.js:787` (`const markNow = wsl() && windowsEligible(entry.type, entry.url) ? f.winOn : hadMark;` — `f.winOn` is captured when the form opens).

## Ownership boundary

- `viewer/pages/project-tools.js` (the edit form's switch handling only)
- `viewer/test/app-project-tools.spec.js` (add tests)
- your report file

## Required behaviour

The mark that Keep changes writes must reflect the user's latest choice, wherever they made it:
- If the user did not touch the form's switch, Keep changes keeps whatever the tool's mark is *at that moment* (so a card-switch change made while the form was open survives, in both directions: card on→off and off→on).
- If the user did touch the form's switch, the form's value wins (that is the latest choice).
- While the form is open, a card-switch change should also be reflected in the form's own switch if it hasn't been touched (so the screen doesn't show a stale value). Do this only if it fits the page's existing render flow cleanly; otherwise record why not.
- A rename via the form still carries the mark (existing behaviour); Cancel still discards only the form's own changes and never undoes a card-switch change.

## Validation

```bash
npm --prefix viewer run test:browser -- app-project-tools
node --test viewer/test/app-project-tools.test.js viewer/test/win-mark-parity.test.js
```

Add browser tests: (1) the verifier's exact sequence (open editor on a marked tool, switch off on the card, edit URL in the form, Keep changes, Save) sends `windows` without the tool; (2) the reverse (unmarked, open editor, switch on via the card, edit URL, Keep, Save) sends the tool; (3) touching the form switch after a card change makes the form's value win; (4) Cancel after a card-switch change keeps the card's value. Show each fails without your fix (temporarily revert and say so). Never start a viewer server by hand.

## Rules
