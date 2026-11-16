# Remediation 2 — antigravity-cli

Verification attempt 2 (verifier `wc-9340ecf1256c-verifier-2`, gpt-6.1-sol, commit d4a2146) returned FAIL.

## Gaps, verbatim

> GAP: Phone-only sign-in — Google authentication taking over 30 seconds causes Settings to stop polling at the first onboarding screen, leaving subsequent screens unanswered. Evidence: viewer/pages/settings.js:977 applies the original timeout and :948 clears polling; machine/service.js:944 advances onboarding only during polls. Phone-width browser reproduction with a simulated 60-second OAuth delay showed “Couldn't read the sign-in screen”; poll count stayed at 2 five seconds later.

This is a new gap, not attempt 1's surviving. Attempt 1's fix (answering first-run screens during sign-in) relies on the card's polling, and the card's 30-second no-URL timeout, written for the pre-link wait, also fires after the code. Any real sign-in takes longer than 30 seconds from opening the card, so it isn't only slow OAuth.

## Tasks

### R2-1 — keep polling after the link; a separate, longer limit for finishing

- **Objective**: the 30-second limit applies only before the first URL. After it, a URL-less poll shows "Finishing sign-in on <machine>…" and keeps polling, up to a 10-minute finish limit.
- **Ownership**: `viewer/pages/settings.js` (`openSignin`), `viewer/test/app-accounts.spec.js`, `reports/R2-1.md`.
- **Lane**: standard, gpt (the provider that built T5).
- **Validation**: `npx playwright test test/app-accounts.spec.js` (slow-sign-in and finish-limit tests), full browser suite.
