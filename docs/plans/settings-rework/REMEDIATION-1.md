# Remediation 1 — settings-rework

Verification attempt 1 checked commit `6d7c4f03`. Both verifiers: FAIL. The gap lines below are as the verifiers wrote them (duplicates merged). Rare path `#behavior/lessons/constructor` went to Accepted Risks. The mockup line-wrap gaps (GPT verifier's four S4 lines on wrapping) were deferred by the lead (PLAN.md Deferred row 1). The lead's answers are in PLAN.md's Log (2026-11-25).

## Gaps (verbatim)

From the GPT verifier (`wc-d14474dffb25-verifier-2`):

- GAP: S5 — The phone category list reads Diagrams while You is hidden. Opening You can show that earlier reading — at 390 × 844, I changed the fixture from Default to High while the list was open. Tapping You still showed Default and issued no new read. Returning to the list issued another hidden read. `viewer/pages/settings.js:2366`, `:2416`, `:2446`.
- GAP: S2 — Usage and balancing shows the 5-hour reading in its account table but omits the specified 5-hour bar — with both windows populated, the built page showed `42%` in the 5-hour column and rendered only the weekly bar. `viewer/pages/settings.js:1837`, `:1843`.
- GAP: S3 — A browser test still calls the category "models and preferences" — `viewer/test/app-settings.spec.js:623`.
- GAP: S4 phone You — The preview panes use filled backgrounds and a blue outline absent from the mockup. The Visibility slider also spans the card rather than using the mockup's short track.

From the Claude verifier (`wc-d14474dffb25-verifier`):

- GAP: S6 validation (browser list) — On the first run of the Spec browser command, `[firefox] app-accounts.spec.js:237` "a second Claude account warns once, and Cancel saves nothing" failed: after `#add-cancel` the `.add-form` was still there for 5s (`expect(locator('.add-form')).toHaveCount(0)`, line 246). This is the second time the Add account form has flaked in Firefox on this branch (`app-accounts.spec.js:262` failed once after T1). This branch rewrote the Add account repaint path (`settings.js:1402` accountsBusy, `:1686` Cancel, `:2200-2202` setHarness), so a real race under load can't be ruled out.
- GAP: S6 validation (browser list) — In the same first run, `[chromium] background-settings-surfaces.spec.js:25` "all Settings categories keep content solid and outer gutters visible" failed: "content needs an opaque ancestor above the decorative image" (spec line 22, called at line 49 while walking the categories). Not reproduced in ~90 reruns; passes at the comparison commit. It may be a block repaint landing during the check (`settings.js:2359` paint).

## Tasks

All six touch `viewer/pages/settings.js`, `settings.css` and Settings specs, so they are dispatched as one brief to one worker (lane: claude standard, the provider that built T1/T2), done in this order.

### R1 — 5-hour bar in Usage and balancing (S2)
Objective: in the per-account table (`accountTable`), the "5-hour used" and "Week used" cells show the small meter bar the account cards had before T2 (the removed `.meter` style: 90px track, accent fill, width = percent used, 0 when the window has reset) beside the percentage, with an `aria-label` like "42% of the 5-hour window used". A browser check in `app-settings.spec.js`: with both windows populated, the open provider's table shows a 5-hour bar and a week bar with the right widths, and account cards still show none.

### R2 — Add account form flake in Firefox (S6)
Objective: find why `.add-form` can survive `#add-cancel` (and why `:262` "adding a GPT account does not warn" failed once). Likely suspects: a `refreshUsage`/`refreshStatus` answer or a harness poll repainting Accounts with a stale `adding`, or `accountsBusy()` holding a repaint that then lands after Cancel. Fix the cause in `settings.js` if there is one. If the code is sound, report the evidence (what you traced, `--repeat-each` runs under parallel load in Firefox).

### R3 — background surfaces check flake in Chromium (S6)
Objective: find whether a block repaint (e.g. Harnesses poll, usage refresh, Diagrams draw) can leave content briefly without its opaque ancestor while `background-settings-surfaces.spec.js:25` walks the categories. Fix the cause in `settings.js`/`settings.css` if there is one; otherwise report the evidence.

### R4 — re-read Diagrams each time You is shown (S5)
Objective: on a phone at the list (no hash), the hidden You must not read Diagrams; each time You becomes visible (opening `#you` from the list, opening You on desktop, a no-hash desktop load, crossing from phone list to desktop), Diagrams is read again and drawn. Returning to the list issues no read. Browser check: at 390px, change the stubbed level while the list shows, tap You, see the new level (and the read count goes up by one).

### R5 — test name (S3)
Objective: rename `app-settings.spec.js:623` "models and preferences fits at 390px" to name the new categories (e.g. "Models fits at 390px"), checking what it actually opens.

### R6 — phone You matches the mockup (S4)
Objective: in `docs/plans/settings-rework/graphs/mockup-phone-you.html` (390 x 844), the Writing style before/after preview panes and the Background Visibility slider look as drawn there: preview panes without the filled background and blue outline, Visibility as the mockup's short track. Match the mockup's CSS for those elements; keep every other part of the page as it is.
