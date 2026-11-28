# Remediation 1 — settings-live-refresh

Verification attempt 1 (commit `81dadd4494663cbafe60f8d35329805ba889b42d`, mode: `two-part`).
- Accepted rare path recorded in `PLAN.md` (`verification-1`): delayed pre-restart `/settings` response arriving after a post-restart response.
- Deferred as `d6` per lead decision: clean Behavior Scope picker refresh when a saved directory is removed elsewhere.

## Gap list (verbatim)

1. Full-run regression (`viewer/test/app-usage.test.js:494`): `TypeError: hub.bumpSettingsRevision is not a function` at `viewer/app/settings.js:435` when `settings.update(hub, ...)` is called with a minimal stub `hub` (`viewer/test/app-usage.test.js:508`).
2. `GAP: §3.1 exact-match focus — Deleting the open template in another tab moves keyboard focus from its Delete button to the replacement template’s Delete button — viewer/pages/settings.js:333, viewer/pages/settings.js:594, viewer/pages/settings.js:1619. Chromium switched from template Alpha to Bravo with #delete still focused.`
3. `GAP: §4.2 delayed-read coverage — The required delayed refreshDiffs() case has only manual coverage — docs/plans/settings-live-refresh/PLAN.md:247, docs/plans/settings-live-refresh/COMPLETION.md:29. The manual probe confirmed that this delayed response preserves a newer local save.`
4. `GAP: §3.1 background focus — An external opacity save drops keyboard focus from Remove background even though the button remains available — viewer/pages/settings.js:2828, viewer/pages/settings.js:2850. Reproduced with two tabs in Chromium and Firefox.`
5. `GAP: §3.4 Shared tools reconciliation — Saving a key after an external project change clears the banner and leaves the project picker on its old value — viewer/pages/settings.js:3277 clears the banner and rereads only the keys. With an isolated machine stub, the picker still showed None after the next poll while the hub reported sample/example.`

## Tasks

### R1-1 (Gap 1 — routed to `gpt`, matching T1 builder)
- **Objective:** Guard `hub.bumpSettingsRevision?.(...)` at all 4 hub bump sites (`viewer/app/settings.js:435`, `viewer/app/diagram-sensitivity.js:48`, `viewer/app/routes.js:110`, `viewer/app/routes.js:401`) so minimal stub `hub` objects (such as `viewer/test/app-usage.test.js:508`) do not throw `TypeError`.
- **Ownership boundary:** `viewer/app/settings.js`, `viewer/app/diagram-sensitivity.js`, `viewer/app/routes.js`
- **Validation:** `node --test viewer/test/app-usage.test.js viewer/test/app-settings.test.js viewer/test/app-diagram-sensitivity.test.js machine/test/name-guard.test.js`

### R1-2 (Gaps 2, 3, 4, 5 — routed to `claude`, matching T2 builder)
- **Objective:**
  - Gap 2 (§3.1 template Delete focus): Add template-scoped `data-focus="tpl:${draft.id}:delete"` to the template `#delete` button (`viewer/pages/settings.js:1619`) so deleting the open template elsewhere leaves focus unset instead of moving it to the replacement template's `#delete` button. Add a browser test in `viewer/test/app-settings.spec.js`.
  - Gap 3 (§4.2 delayed `refreshDiffs()` test): Add a Playwright browser test in `viewer/test/app-settings.spec.js` verifying that a delayed `refreshDiffs()` `GET /settings` response never overwrites a newer local save.
  - Gap 4 (§3.1 background focus): Add `data-focus="background:remove"` to the `Remove background` button in `viewer/pages/settings.js` (`renderBackground`) so an external opacity save preserves keyboard focus on it. Add an assertion in `viewer/test/background-editor.spec.js`.
  - Gap 5 (§3.4 Shared tools key save after external project change): In `viewer/pages/settings.js` `change()` (around line 3277), when saving/removing a shared key while `staleBlocks.has('shared-tools')` (or when `renderedSlice.get('shared-tools') !== sliceKey('shared-tools')`), clear stale and repaint `'shared-tools'` (updating the project `<select>` from `data.shared_tools_repo`) in addition to acknowledging/reading keys. Add a browser test in `viewer/test/app-settings.spec.js`.
- **Ownership boundary:** `viewer/pages/settings.js`, `viewer/test/app-settings.spec.js`, `viewer/test/background-editor.spec.js`
- **Validation:** `npm --prefix viewer run test:browser -- viewer/test/app-settings.spec.js viewer/test/background-editor.spec.js`
