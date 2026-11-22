# Remediation 3 — easy-onboarding

Verification attempt 3 on `2cf9fa84`. Both verifiers FAIL. Gaps, verbatim:

- (Claude and GPT) GAP: S5.2 / Validation command `npm --prefix viewer run test:browser` — the new R2-1 test "switching off the provider chosen in an open Add account form resets it" (`viewer/test/app-harnesses.spec.js:402`) fails some of the time … `route.fetch: Test ended … while running route callback`.
- (GPT) GAP: S4.6 — An open Add account draft retains a provider switched off in another tab. → rare path, Accepted Risks (verification-3).
- (GPT) GAP: S4.2/S4.6 — A Claude sign-in card opened from Accounts stays visible after a fresh fetch confirms Claude was switched off in another tab. → the lead judged it a rare path (two Settings tabs), not the same-tab gap surviving; Accepted Risks (verification-3).

# Task R3-1 — make the Add account browser tests stop racing their settings reload (remediation 3)

**Gap (verifiers, verbatim):** "S5.2 / Validation command `npm --prefix viewer run test:browser` — the new R2-1 test "switching off the provider chosen in an open Add account form resets it" (`viewer/test/app-harnesses.spec.js:402`) fails some of the time, which makes the whole browser suite fail. The product behaviour it checks is correct: every assertion in the test passes. The failure comes from the test itself. Its `stubAccounts` route (`app-harnesses.spec.js:363-368`) calls `r.fetch()` for `GET /api/settings`. When that request is still in flight as the test ends (the page reloads settings after the POST), Playwright reports `route.fetch: Test ended … while running route callback` and fails the test." Focused repeat: 4 of 32 runs failed (chromium); a firefox run also failed with `apiResponse.json: Response has been disposed` at `:365:43`.

**Objective:** test-only fix in `viewer/test/app-harnesses.spec.js`; no product code changes.
1. In each test that uses `stubAccounts` (~`:392`, `:407`, `:429`) and in any other test in this file whose route handler calls `r.fetch()` (~`:246`, `:275`, `:299`), make sure no route callback is still running when the test ends: after the test's last assertion, wait for the page's follow-up `GET /api/settings` to finish where the test triggers one (e.g. `page.waitForResponse` set up before the click that triggers it), and in all cases end with `await page.unrouteAll({ behavior: 'ignoreErrors' })` (in the test body's end or an `afterEach` for this describe block).
2. Make the `r.fetch()` handlers tolerant of a disposed response: wrap the fetch+json in try/catch and, on failure, return without fulfilling (or `r.abort()` inside a try), so a late callback cannot throw.
Do not weaken any assertion.

**Ownership boundary:** `viewer/test/app-harnesses.spec.js` and your report `docs/plans/easy-onboarding/reports/R3-1.md`. Nothing else.

**Validation (paste summary lines; all must pass with 0 failed):**
```bash
cd viewer && npx playwright test test/app-harnesses.spec.js --repeat-each=10 --reporter=line
npm --prefix viewer run test:browser
```

