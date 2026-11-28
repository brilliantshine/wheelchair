# Remediation 1 — google-model-levels

Verification attempt 1 checked commit 0eadce68 (verifiers: claude-opus-5-5 and gpt-6.2-sol). Full run on 0eadce68: all suites exit 0.

## Gap list (verbatim, merged)

- G1 (gpt verifier). GAP: S1.3 and S1.6 — A failed refresh can overwrite a newer catalog saved by a concurrent successful refresh, then hold the old list in place for 60 seconds — `codex/model.sh:338`, `codex/model.sh:373`, `codex/model.sh:380`. Two overlapping fake refreshes saved `new` first, then left `old` on disk with back-off active.
  - Judged a rare path (two overlapping runs, one failing); recorded in PLAN.md Accepted Risks, round verification-1. Not remediated.
- G2 (gpt verifier). GAP: S3.5 and the other-provider non-goal — Saving a GPT tier effort silently discards an open Claude lead model draft because the post-save read rebuilds both blocks — `viewer/pages/settings.js:225`, `viewer/pages/settings.js:237`, `viewer/pages/settings.js:2561`. Chromium showed the draft disappear after a successful PUT. The same action preserved it at the comparison commit.
- G3 (gpt verifier). GAP: S1.5 and S5.1 — A sub-lead start refreshes a complete catalog younger than an hour when its first configured Antigravity model is unlisted — `viewer/app/settings.js:477`, `codex/model.sh:348`. A complete two-minute-old catalog triggered one fake `agy models` run. The completion report records this deviation.
- G4 (claude verifier). GAP: Spec Validation (`node --test … viewer/test/app-hub.test.js …`) and the brief's rule that tests never run the real agy or touch the real `~/.wheelchair/agy-models.json` — the test "the real viewer keeps its boot commit when its clone moves before the first app request" starts a server with no `WHEELCHAIR_MODELS` and no `WHEELCHAIR_AGY`. With this branch, that server's `codex/model.sh gemini lead` read now calls `agy_models()` (`codex/model.sh:511-512`, `:320`, `:361`). Whenever the real list is missing, in the old format, or after a failed fetch, this runs the real `agy models` and writes `~/.wheelchair/agy-models.json` (or `.failed` beside it). — `viewer/test/app-hub.test.js:1613-1625`.

Also noted (not a gap): COMPLETION.md cites `app-hub.test.js` for the S6 scout cases; they are in `viewer/test/app-settings.test.js:589`. Corrected in COMPLETION.md.

## Tasks

### R1 — G3 (gpt, standard)

Task: R1 (remediation 1, gap G3) — the sub-lead start refreshes Antigravity's list only when it is over an hour old (Spec S5.1, S1.5).

Gap, verbatim from the verifier: "S1.5 and S5.1 — A sub-lead start refreshes a complete catalog younger than an hour when its first configured Antigravity model is unlisted — `viewer/app/settings.js:477`, `codex/model.sh:348`. A complete two-minute-old catalog triggered one fake `agy models` run."

Cause: `levelLines` (viewer/app/settings.js:459-488) refreshes by running `model.sh agy-launch <first set tier's model>` with no effort (line ~477). agy-launch also refreshes a list over 30 s old that does not list that model.

Fix:
1. codex/model.sh: add a command `model.sh agy-refresh` (no other arguments). It runs `agy models` (through the existing `agy_models` path, with its normal 10-second deadline, subject to the S1.6 back-off) only when the saved list is missing, in the old format, or over an hour old (3600 s); otherwise it does nothing. It prints nothing and exits 0 in every case (a failed run is recorded per S1.6 as today). Add it to USAGE (codex/model.sh:41). Keep it free of literal tool-name comparisons (machine/test/name-guard.test.js must pass; use `AGY` / `AGY_PROVIDER` as the file does).
2. viewer/app/settings.js `levelLines`: replace the `agy-launch` refresh call with `modelCommand(hub, ['agy-refresh'])` (or however the file calls model.sh), run once before the levels reads, ignoring its result and errors. Remove the now-unused code that read the tier cells only to pick the agy-launch argument. Nothing else in levelLines changes.
3. Tests. codex/test/run.sh (fake agy that counts calls, temp WHEELCHAIR_MODELS): agy-refresh with a complete list 120 s old makes 0 runs; with a list 3700 s old makes 1 run and rewrites the list; with no list makes 1 run; with an old-format list (fresh `at`) makes 1 run; within 60 s of a recorded failure makes 0 runs; always exits 0 with no output. viewer/test/app-settings.test.js: keep the existing "a sub-lead start refreshes an Antigravity list over an hour old" test passing, and add one where a complete list two minutes old whose entries do not include the first tier's pinned model causes no `agy models` run at sub-lead start. Each new test must fail when its behaviour breaks (break once, watch it fail, restore).

Ownership boundary: codex/model.sh, codex/test/run.sh, viewer/app/settings.js (levelLines only), viewer/test/app-settings.test.js (the sub-lead refresh tests only). Another worker is changing viewer/pages/settings.js, viewer/test/app-settings.spec.js and viewer/test/helpers/server.js at the same time: do not touch those.

Validation commands:
- bash codex/test/run.sh
- node --test machine/test/name-guard.test.js
- node --test viewer/test/app-settings.test.js
If the same gate fails twice, stop and report rather than iterating.

### R2 — G2 and G4 (claude, standard)

Task: R2 (remediation 1, gaps G2 and G4) — two fixes in viewer: a save must not wipe another cell's open model draft, and no viewer test may run the real agy or touch the real ~/.wheelchair.

Gap G2, verbatim from the verifier: "S3.5 and the other-provider non-goal — Saving a GPT tier effort silently discards an open Claude lead model draft because the post-save read rebuilds both blocks — `viewer/pages/settings.js:225`, `viewer/pages/settings.js:237`, `viewer/pages/settings.js:2561`. Chromium showed the draft disappear after a successful PUT. The same action preserved it at the comparison commit."
Fix G2: after a successful save, the re-read of GET /settings (S3.5) still updates the page's models and model_options, but redraws only the cell that was saved (its model select, Other… input and effort selector). Every other cell, in both the tiers block and the lead-models block, keeps its DOM state, including an open Other… input and its typed text. Other cells pick up the new options the next time they are drawn. The `Saved; the list could not be refreshed` behaviour stays as it is. Add a browser test (title containing 'effort') that types into one cell's Other… input, saves a different cell's effort, and asserts the typed draft is still there after the re-read; it must fail against the current code (check this before fixing).

Gap G4, verbatim from the verifier: "Spec Validation (`node --test … viewer/test/app-hub.test.js …`) and the brief's rule that tests never run the real agy or touch the real `~/.wheelchair/agy-models.json` — the test 'the real viewer keeps its boot commit when its clone moves before the first app request' starts a server with no `WHEELCHAIR_MODELS` and no `WHEELCHAIR_AGY`. With this branch, that server's `codex/model.sh gemini lead` read now calls `agy_models()` ... runs the real `agy models` and writes `~/.wheelchair/agy-models.json` (or `.failed` beside it). — `viewer/test/app-hub.test.js:1613-1625`."
Fix G4 at the shared helper, so no server a test starts can reach them: in viewer/test/helpers/server.js `startServer` (line ~69-83), when the caller's `env` does not set `WHEELCHAIR_AGY`, set it to '' (discovery off); when it does not set `WHEELCHAIR_MODELS`, point it at a file inside a temp directory (the stateDir if one is given, else a new temp dir) so model.sh never reads or writes the real ~/.wheelchair. A caller that passes either variable keeps its own value. Check whether the browser spec helpers start servers another way (grep viewer/test for other spawns of server.js or model.sh) and apply the same defaults there. Prove it: run the app-hub test above with a scratch HOME and a logging fake `agy` first on PATH, before and after the fix, and paste both results (before: an agy call; after: none, and nothing written under the scratch HOME's .wheelchair).

Ownership boundary: viewer/pages/settings.js, viewer/test/app-settings.spec.js, viewer/test/helpers/server.js, and any other viewer/test helper that starts a server. Another worker is changing viewer/app/settings.js and viewer/test/app-settings.test.js at the same time: do not touch those.

Validation commands:
- npm --prefix viewer run test:browser -- --grep 'effort'
- node --test viewer/test/model-options.test.js viewer/test/app-settings.test.js viewer/test/app-hub.test.js viewer/test/worker-effort-membership.test.js
- the scratch-HOME proof above

Both briefs end with the shared brief footer (plan, facts, fake-agy rule, report and choices request).
