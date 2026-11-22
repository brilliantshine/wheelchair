# Remediation 1 — easy-onboarding

Verification attempt 1 on `c281731a`. Claude verifier: PASS. GPT verifier: FAIL. Its gap list, verbatim:

- GAP: S4.1–S4.3 — Install can target the previous machine while the picker shows the newly selected machine — With `node-2` selected and its status refresh pending, clicking Install Codex sent `POST /machines/hub/harnesses/gpt/install`.
- GAP: S2.3 — The npm recipe checks the service process's Node version instead of `node --version` on the recipe's PATH — The Pi fixture ran with service Node 22.23.5 and PATH Node 20.19.0, below the required 22.19.0.
- GAP: S3.3 — Rare path: A JSON `null` body returns 500 where the switch route requires 400 for an invalid `enabled` value.
- GAP: S3.6 — Rare path: A Codex account named `Constructor` makes the harness report `signed_in: true` even when the machine reports zero signed-in accounts.
- GAP: S4.2 — Switching off a harness leaves its open sign-in controls actionable — The Codex device sign-in link stayed visible after Use was turned off.
- GAP: S4.2 — Rare path: Pi displays "Signed in" alongside Install when its executable is missing and its saved credentials remain.
- GAP: S4.3 — If the last install failed, a subsequent 502 leaves the row showing "Install failed" and "Try again" during polling.
- GAP: S4.6 — Editing the visible worker order moves hidden harnesses in the saved order — Moving Claude down with Codex off changed `gpt, claude, gemini, kimi` to `gemini, claude, kimi, gpt`.
- GAP: S5.1 — A delayed onboarding response can restore the checklist after a newer poll hides it — The card reappeared when an older `show: true` response arrived after `show: false`.

Rare paths (sub-lead judgment, recorded in PLAN.md Accepted Risks, round verification-1): S3.3 null body; S3.6 prototype-key account id; S4.2 Signed in with executable missing; S4.3 502 after a failed install; S5.1 delayed onboarding response.

Remaining 4, all fixed at the lead's answer (none deferred): S2.3 Node check → task R1-1 (gpt, built T2); S4.6 hidden order positions, S4.1–4.3 install machine, S4.2 sign-in on switch-off → task R1-2 (claude, built T4).

# Task R1-1 — npm recipe Node check reads the recipe's PATH node (remediation of S2.3)

**Gap (verifier, verbatim):** "S2.3 — The npm recipe checks the service process's Node version instead of `node --version` on the recipe's PATH — The Pi fixture ran with service Node 22.23.5 and PATH Node 20.19.0, below the required 22.19.0."

**Objective:** in `machine/lib/harness-install.js` `job()` (lines ~49-50 use `process.versions.node`), read the Node version that the recipe will actually use: run `node -e 'process.stdout.write(process.versions.node)'` with the job's own environment (`process.env`, whose PATH is the service PATH) via `spawnSync`, before running an npm recipe that has a `node` minimum. Compare that version with the existing `newer()`. If it is lower, do not run the recipe; the job ends `failed` with the exact S2.3 tail `<Harness> needs Node <min> or newer; this machine has <version>. Update Node, then try again.` (`<Harness>` from the existing `labels` map). If `node` cannot be run or prints nothing that parses as `x.y.z`, end `failed` with `<Harness> needs Node <min> or newer; this machine has no working node on its path. Update Node, then try again.` Recipes without a `node` minimum (script recipes) are unchanged.

**Test:** in `machine/test/harness-install.test.js`, replace the existing "npm recipe refuses an old Node before running" test (it fakes `process.versions` with a `NODE_OPTIONS` preload, which no longer exercises the real path) with one that puts a fake `node` script first on the job's PATH printing `20.19.0` for `-e` (the job itself still runs under the real `process.execPath`), with an `openrouter` override recipe that would create a marker file: assert `failed`, the exact message naming 20.19.0 and 22.19.0, and that the marker was not created. Add one case where the fake PATH node prints a version at or above the minimum and the recipe runs (marker created, `succeeded` or reaching validation — use a recipe that also drops a fake `pi` into `$HOME/.local/bin` so it succeeds). Keep the fake bin plus system dirs PATH pattern the file already uses (`${bin}:/usr/local/bin:/usr/bin:/bin`) so real user CLIs are not found.

**Ownership boundary:** `machine/lib/harness-install.js`, `machine/test/harness-install.test.js`, your report `docs/plans/easy-onboarding/reports/R1-1.md`. Nothing else.

**Validation (paste output):**
```bash
node --test machine/test/harness-install.test.js
bash machine/test/run.sh
```
Never let a test start a real tmux session or a real CLI: keep fake binaries first on PATH.


# Task R1-2 — Settings Harnesses fixes (remediation of S4.1–S4.3, S4.2, S4.6)

Three gaps found by verification, all in `viewer/pages/settings.js`. Verifier text verbatim, then the fix the lead chose:

1. "S4.6 — Editing the visible worker order moves hidden harnesses in the saved order — Moving Claude down with Codex off changed `gpt, claude, gemini, kimi` to `gemini, claude, kimi, gpt`."
   **Fix:** in `orderEditor` (`settings.js` ~`:1351-1360`, where `real`/`left` split visible from switched-off providers), when the visible order is edited, build the saved value by keeping every switched-off provider (and `any`) at its saved index and filling the remaining slots with the edited visible providers in their new order. Example: saved `gpt, claude, gemini, kimi`, Codex off, visible `claude, gemini, kimi`; moving Claude down gives visible `gemini, claude, kimi` and saved `gpt, gemini, claude, kimi`. Adding a provider appends it to the visible ones (before `any`), without moving hidden ones. Applies to both Workers try first and Lead order editors.
2. "S4.1–S4.3 — Install can target the previous machine while the picker shows the newly selected machine — With `node-2` selected and its status refresh pending, clicking Install Codex sent `POST /machines/hub/harnesses/gpt/install`."
   **Fix:** Install / Try again (and the install poll it starts) must always use the machine currently shown in the picker (`hz.machine`), never a machine captured from an earlier render or the previous `/harnesses` data; and while the shown machine's status has not loaded yet after a picker change, show its rows as loading with no Install button (or disable it) until that machine's data arrives. Also make sure a poll started for machine A never updates rows while machine B is shown.
3. "S4.2 — Switching off a harness leaves its open sign-in controls actionable — The Codex device sign-in link stayed visible after Use was turned off."
   **Fix:** when a harness's Use switch is turned off (after the PUT succeeds), close the sign-in card opened from that harness's row (the existing `closeSignin()` path, ~`:1083`), so no sign-in link or code box for it remains.

**Tests:** add to `viewer/test/app-harnesses.spec.js`, with stubbed responses as the file already does: (a) with Codex off, move Claude down in Workers try first and assert the saved `worker_order` body is `['gpt','gemini','claude','kimi']`; same idea for Lead order with a hidden entry; (b) two machines, pick the second while its `/harnesses?fresh=1` response is held, assert no Install is clickable for it until released, then press Install and assert the POST goes to `/machines/<second>/harnesses/...`; (c) open Sign in on a harness row, switch that harness off (confirm), assert the sign-in card and its link are gone.

**Ownership boundary:** `viewer/pages/settings.js`, `viewer/pages/settings.css` if needed, `viewer/test/app-harnesses.spec.js`, your report `docs/plans/easy-onboarding/reports/R1-2.md`. Nothing else.

**Validation (paste summary lines):**
```bash
npx --prefix viewer playwright test --config viewer/playwright.config.js viewer/test/app-harnesses.spec.js viewer/test/app-settings.spec.js
npm --prefix viewer run test:browser
```
(If the first command's path form doesn't work from the repo root, run the equivalent from `viewer/` and say what you ran.)

