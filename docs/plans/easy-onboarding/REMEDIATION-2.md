# Remediation 2 — easy-onboarding

Verification attempt 2 on `279fc36b`. Claude verifier: PASS. GPT verifier: FAIL. Its gap list, verbatim:

- GAP: S4.6 — With Claude Code switched off, Add account displays GPT but submits `provider: "claude"` unless the user changes the picker — reproduced at phone size. The form keeps a hard-coded Claude default after filtering Claude out of the picker.
- GAP: S4.6 — A Claude sign-in card opened from Accounts stays visible after Claude Code is switched off — reproduced by opening sign-in, switching Claude off in Harnesses, then returning to Accounts. The switch closes cards opened from Harnesses only.

No rare paths. The lead had both fixed, neither deferred. The second gap is the same gap as attempt 1's S4.2 sign-in gap, so this is its second fix attempt.

# Task R2-1 — Settings: no hidden provider in Add account; switch-off closes every sign-in card (remediation 2)

Two gaps from verification attempt 2, both in `viewer/pages/settings.js`. Verifier text verbatim, then the exact fix.

1. "S4.6 — With Claude Code switched off, Add account displays GPT but submits `provider: "claude"` unless the user changes the picker — reproduced at phone size. The form keeps a hard-coded Claude default after filtering Claude out of the picker. [settings.js:1289]"
   **Fix:** the Add account button (`addForm`, ~`:1289`) currently sets `adding = { provider: 'claude', … }`. Set `provider` to the first provider the form's picker actually offers: the same list the `<select>` renders (~`:1298`: `Object.entries(PROVIDER_NAME).filter(([v]) => v !== 'gemini' && harnessOn(v))`). Put that list in one small helper used by both places, so they cannot drift. Also, whenever the switches change (after a successful `setHarness`, ~`:1590`) and the form is open with `adding.provider` no longer offered, reset `adding.provider` to the first offered one and re-render. If the list is empty, do not render the Add account button.
2. "S4.6 — A Claude sign-in card opened from Accounts stays visible after Claude Code is switched off — reproduced by opening sign-in, switching Claude off in Harnesses, then returning to Accounts. The switch closes cards opened from Harnesses only. [settings.js:1596]"
   **Fix:** `setHarness` (~`:1596`) closes the card only when `signCard.harness === provider`. Change the condition so it also closes a card opened from Accounts for that provider: `signCard && (signCard.harness === provider || signCard.account?.provider === provider)`. Check that the card object assigned at ~`:1123` (`signCard = card`) carries `account` (the comment at `:1020` says `{account, machine, el, timers…}`); if it does not, add it there.

This is the second fix attempt for gap 2; it must be closed for every place a sign-in card can be opened (`openSignin` callers at ~`:1236`, `:1272`, `:1643`).

**Tests:** add to `viewer/test/app-harnesses.spec.js`, using the stubbing the file already does:
(a) Claude switched off in the stubbed settings: open Add account, do not touch the picker, fill a name, submit; assert the POSTed body has `provider` equal to the first offered provider (`gpt` with defaults), never `claude`.
(b) Form open with Codex selected, then switch Codex off in Harnesses (confirm if asked) and go back to Accounts; assert the form's picker value and the submitted `provider` are an offered, switched-on provider.
(c) Open Sign in for a Claude account from the **Accounts** panel, go to Harnesses, switch Claude Code off (confirm if asked), return to `#accounts`; assert no `.signin-card` is present.

**Ownership boundary:** `viewer/pages/settings.js`, `viewer/test/app-harnesses.spec.js`, your report `docs/plans/easy-onboarding/reports/R2-1.md`. Nothing else.

**Validation (paste summary lines):**
```bash
cd viewer && npx playwright test test/app-harnesses.spec.js test/app-settings.spec.js test/app-accounts.spec.js --reporter=line
npm --prefix viewer run test:browser
```

