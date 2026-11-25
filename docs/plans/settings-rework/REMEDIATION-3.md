# Remediation 3 — settings-rework

Verification attempt 3 checked commit `cb54ddb3`. Claude verifier (`wc-d14474dffb25-verifier-5`): PASS. GPT verifier (`wc-d14474dffb25-verifier-6`): FAIL. One rare path went to Accepted Risks; the Preview-hint wrap is Deferred row 1. The full run found a regression. The lead's answers: fix all three below (PLAN.md Log, 2026-11-25). This is the second fix attempt for lost presses caused by a repaint above (the first was Remediation 1's R2, `holdPlace`).

## Gaps

From the starter's full run (sub-lead):

- GAP: S5 / S6 — `[firefox] app-accounts.spec.js:179` "a failed key on an OpenRouter account clears the key and offers one Start again": the second "Send code" press is lost (`expect.poll(... '/code' calls).toBe(2)` received 1, line 195). Reproduced 4 of 120 on the branch (`--project=firefox -g "failed key on an OpenRouter" --repeat-each=60 --workers=8`), 0 of 180 at `8440ad72`.

From the GPT verifier (verbatim):

- GAP: S4 phone You — At 390 px, the closed Technical terms selector clips "before" from the selected option. The mockup shows the full label — `viewer/pages/settings.js:1287` and the phone You screenshots below.
- GAP: S5 — The page-wide background refresh rebuilds the hidden editor behind the phone category list — saving 42% visibility through the isolated hub replaced the hidden editor while the list stayed visible. `viewer/pages/settings.js:1960` and `viewer/pages/settings.js:2064`.

## Tasks

One brief, one worker (claude standard), in this order.

### T1 — no press lost to a repaint above an open sign-in card
Objective: find the repaint that moves (or replaces) the sign-in card's buttons between mouse-down and mouse-up after a failed key (candidates: the status reload after the failed key, a Harnesses answer growing or shrinking Harnesses while it is partly on screen, an Accounts repaint re-mounting the card, the usage refresh). Settled by the lead: a repaint above an open sign-in card must not move or replace it. Generalise R2's `holdPlace` (which only covers a block wholly above the screen) or otherwise keep the card in place, and make sure no Accounts repaint replaces the card's DOM or its focused field. Prove it with a deterministic browser check that holds the offending answer until the button is pressed, and by repeat runs on both trees.

### T2 — Technical terms picker shows its whole option at 390px
Objective: at 390px the closed Technical terms select shows the selected option's full text, as in `mockup-phone-you.html` (wrap or widen as the mockup's CSS does). Nothing else changes.

### T3 — background refresh does not rebuild the hidden You editor
Objective: the page-wide background refresh (and `backgroundrestore`) repaints the editor only while You is visible (`youShown()`), not behind the phone list; when You is shown again it shows the current saved background.
