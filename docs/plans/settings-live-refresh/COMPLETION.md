---
slug: settings-live-refresh
date: 2026-11-28
implemented-by: standard / gpt / gpt-6.1-terra (T1), standard / claude / claude-sonnet-5-5 (T2), light / gpt / gpt-6-luna (R1-1), standard / claude / claude-sonnet-5-5 (R1-2), standard / claude / claude-sonnet-5-5 (R2-1)
verified-by:
  - round: 1
    lane: claude / claude-opus-5-5
    checks: standard / gpt / gpt-6.1-terra (T1), standard / claude / claude-sonnet-5-5 (T2)
  - round: 1
    lane: gpt / gpt-6.2-sol
    checks: standard / gpt / gpt-6.1-terra (T1), standard / claude / claude-sonnet-5-5 (T2)
  - round: 2
    lane: claude / claude-opus-5-5
    checks: light / gpt / gpt-6-luna (R1-1), standard / claude / claude-sonnet-5-5 (R1-2)
  - round: 2
    lane: gpt / gpt-6.2-sol
    checks: light / gpt / gpt-6-luna (R1-1), standard / claude / claude-sonnet-5-5 (R1-2)
  - round: 3
    lane: claude / claude-opus-5-5
    checks: standard / claude / claude-sonnet-5-5 (R2-1)
  - round: 3
    lane: gpt / gpt-6.2-sol
    checks: standard / claude / claude-sonnet-5-5 (R2-1)
  - round: 4
    lane: claude / claude-opus-5-5
    checks: standard / claude / claude-sonnet-5-5 (R2-1)
  - round: 4
    lane: gpt / gpt-6.2-sol
    checks: standard / claude / claude-sonnet-5-5 (R2-1)
---

# Completion Report — Auto-refresh an open Settings page when settings change

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| §1.1 Per-boot revision state on `Hub` (`settingsBootId`, `settingsRevs`, `settingsRevisions()`, `bumpSettingsRevision()`; no `background` domain) | this run | `viewer/app/hub.js:21-22,63-70` | `viewer/test/app-settings.test.js` (`settings revisions track successful writes by domain and change on hub restart`) |
| §1.2 `GET /wheelchair/api/settings/revision` (zero I/O), pre-`describe` `settings_revision` stamp on `GET /settings`, and `API.md` docs | this run | `viewer/app/routes.js:266-269`, `viewer/app/API.md:46,48,127` | `viewer/test/app-settings.test.js` (`settings snapshot keeps the revision from before describe starts`) |
| §1.3 Revision bumps on write sites (`settings.update`, `POST /settings/models/heads-up` `skip`/`reset`, `diagramSensitivity.write`, `POST /shared-keys/save` & `remove`) | this run | `viewer/app/settings.js:435`, `viewer/app/routes.js:110,401`, `viewer/app/diagram-sensitivity.js:48` | `viewer/test/app-settings.test.js`, `viewer/test/app-diagram-sensitivity.test.js` |
| §2.1 Settings-scoped `withMutationRequest`/`withLocalWrite`, `parseRev`/`isOlderRev`, monotonic `applySettingsSnapshot` (with `saved_dirs` invalidation and secondary refreshes), `skipBlocks` on local save rereads, `renderedTiers` per-cell tracking in `refreshModels()`, and `startGen` on all `/settings` rereads | this run | `viewer/pages/settings.js:101-106,127-195,574-644,1066-1071,1243-1258,1293,1438-1515,1676-1715,1742-1765,1871-1895,2352-2380,2445-2460,2587-2595,2767-2790` | `viewer/test/app-settings.spec.js`, `viewer/test/app-accounts.spec.js`, `viewer/test/app-lessons.spec.js` |
| §2.2 Non-blocking per-domain `window.wcPoller(pollSettings, 5000)` with `lastRev`, best-effort `startupRev`, `revRunning`, and per-domain `domainRunning` | this run | `viewer/pages/settings.js:140-145,197-224,3493-3508` | `viewer/test/app-settings.spec.js`, `viewer/test/app-diagram-sensitivity.spec.js` |
| §3.1 `blockFocused(name)` excluding buttons/checkboxes/radios/summaries/links, exact-match `swapKeepingFocus`, stable `data-focus` keys, and routing `drawDiagram`/`refreshUsage`/`paintKeys` through `swapKeepingFocus` | this run | `viewer/pages/settings.js:261-265,492-506,587-604,2182-2196,2390-2470,2509,2626,3296-3312` | `viewer/test/app-settings.spec.js`, `viewer/test/app-accounts.spec.js`, `viewer/test/app-diagram-sensitivity.spec.js` |
| §3.2 Editor baselines (`nameBaseline`, `folderBaseline`, `styleBaseline`, `balBaseline`, `draftBaseline`, `lessonEdit.baseList` lazily initialized), `lessonDirty()`/`saveLessons()`/`renderLessonEditor()` using `baseList`, template editable-field diff, and `accountsDirty()` separated from focus | this run | `viewer/pages/settings.js:72-78,266-295,893-950,1413-1430,1676-1727,1906-1925,2045-2125,2544-2565` | `viewer/test/app-settings.spec.js`, `viewer/test/app-accounts.spec.js`, `viewer/test/app-lessons.spec.js` |
| §3.3 Per-block `renderedSlice` and `blockSlice(name, d)` (with `stripVolatileTemplate`, default fallback `return d`, `UNTRACKED` exclusion for `enter`/`tools`/`diagrams`/`background`), `paint()` banner persistence, and `readHash` leave / `renderCategory()` `enterBlocks()` | this run | `viewer/pages/settings.js:228-259,423-446,3399-3416,3462-3486` | `viewer/test/app-settings.spec.js`, `viewer/test/background-editor.spec.js` |
| §3.4 `reconcileVisibleBlocks()`, `.stale-banner` / `Load latest`, `input`/`change`/`click`/`focusout` handlers, Save clearing stale/deferred state, and secondary read completion guards (`loadDiagram`, `loadHarnesses`, `loadSharedProjects`, `readKeys`, `syncBackground`) | this run | `viewer/pages/settings.js:296-421,511-530,2719-2855,2886-2930,3170-3320,3345-3370`, `viewer/pages/settings.css:30-33` | `viewer/test/app-settings.spec.js`, `viewer/test/app-accounts.spec.js`, `viewer/test/app-lessons.spec.js`, `viewer/test/app-diagram-sensitivity.spec.js`, `viewer/test/background-editor.spec.js` |
| §4.1 Node unit/API tests (`app-settings.test.js`, `app-diagram-sensitivity.test.js`, `name-guard.test.js`) | this run | `viewer/test/app-settings.test.js`, `viewer/test/app-diagram-sensitivity.test.js` | 37/37 pass |
| §4.2 Playwright browser tests (`app-settings.spec.js`, `app-accounts.spec.js`, `app-lessons.spec.js`, `app-diagram-sensitivity.spec.js`, `background-editor.spec.js`) | this run | `viewer/test/app-settings.spec.js`, `viewer/test/app-accounts.spec.js`, `viewer/test/app-lessons.spec.js`, `viewer/test/app-diagram-sensitivity.spec.js`, `viewer/test/background-editor.spec.js` | 378 passed, 2 skipped (Chromium & Firefox) |

## Deviations from plan

- `viewer/pages/settings.js` (`showHarnesses(awaited)`): When the user explicitly picks a machine in Harnesses (`hz.pending !== null`), the awaited status read repaints even while the machine `<select>` retains focus, departing from §3.4's blanket focus-defer on `loadHarnesses()`. Otherwise "Checking…" would stay stuck until blur; `repaint('harnesses')` preserves focus on `#h-machine` via `swapKeepingFocus`. Unawaited/background `loadHarnesses()` calls still obey the dirty and focus guards.
- No separate browser test was added specifically for a delayed `refreshDiffs()` response; `refreshDiffs()` uses the same `applySettingsSnapshot(await api('/settings'), { startGen, source: 'diffs' })` guard covered by the other delayed-read tests.

## Routers

None — this change moved no ownership and no router named a file it touched in a way that became false.

## Validation evidence

### T1 — Node unit/API tests (re-run by sub-lead)

```text
$ node --test viewer/test/app-settings.test.js viewer/test/app-diagram-sensitivity.test.js machine/test/name-guard.test.js
ℹ tests 37
ℹ suites 0
ℹ pass 37
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 51169.031075
```

### T2 — Playwright browser tests

Worker T2 full targeted run (`docs/plans/settings-live-refresh/reports/T2.md`):
```text
$ npm --prefix viewer run test:browser -- viewer/test/app-settings.spec.js viewer/test/app-accounts.spec.js viewer/test/app-lessons.spec.js viewer/test/app-diagram-sensitivity.spec.js viewer/test/background-editor.spec.js
378 passed, 2 skipped (Chromium & Firefox), exit 0
```

Sub-lead independent runs (note: host `/tmp` tmpfs was at 100% / load avg ~100 during re-runs, so `TMPDIR` was pointed at `/home` scratch):
- `viewer/test/background-editor.spec.js`: `22 passed (1.3m)`, exit 0 (Chromium & Firefox).
- `live refresh` tests in `app-settings.spec.js`, `app-accounts.spec.js`, `app-lessons.spec.js`, `app-diagram-sensitivity.spec.js`: all tests passed across Chromium & Firefox (full suite run also scheduled via `bash test-support/full-run.sh`).

### Full run (`bash test-support/full-run.sh`, exit 0 — all 8 suites passed)

```text
commit 31186cbba1f1c48a390c6c9e8a730d5a5d093cc0
suite viewer-browser exit 0 seconds 490
suite viewer-node exit 0 seconds 133
suite machine exit 0 seconds 134
suite test-support exit 0 seconds 27
suite sensitivity exit 0 seconds 3
suite codex exit 0 seconds 23
suite install exit 0 seconds 50
suite sudo-helper exit 0 seconds 9
```

## Known gaps / residual risks

- Deferred hardening items `d1`–`d10` are recorded in `PLAN.md`'s `## Deferred` table (`d1`–`d5` from planning, `d6`–`d10` from verification; `d10` deferred and finished at Collin's choice after Verification Attempt 4).
- Accepted rare-path risks: 2 recorded during build verification (`verification-1`, `verification-2`) and 3 from plan review (`review-round-5`, `review-round-8`, `review-round-9`), all in `PLAN.md`'s `## Accepted Risks` table.

## Remediation rounds

### Remediation 1 (after Verification Attempt 1 on `81dadd44`)

- **Accepted rare path (`PLAN.md` Accepted Risks, `verification-1`):** delayed pre-restart `/settings` response arriving after a post-restart response.
- **Deferred (`PLAN.md` Deferred, `d6`, source `verification`):** refresh clean Behavior template Scope picker when a saved directory is removed elsewhere.
- **R1-1 (`773285e9`, `light / gpt / gpt-6-luna`):** guarded `hub.bumpSettingsRevision?.(...)` at `viewer/app/settings.js:435`, `viewer/app/diagram-sensitivity.js:48`, and `viewer/app/routes.js:110,401` so minimal stub hubs (e.g. `viewer/test/app-usage.test.js:494`) do not throw.
  - Validation: `node --test viewer/test/app-usage.test.js viewer/test/app-settings.test.js viewer/test/app-diagram-sensitivity.test.js machine/test/name-guard.test.js` -> `71/71 pass`, exit 0.
- **R1-2 (`25e396f8`, `standard / claude / claude-sonnet-5-5`):**
  - Gap 2 (§3.1 template Delete focus): added template-scoped `data-focus="tpl:<id>:delete"` and `tpl:<id>:confirm-delete` in `viewer/pages/settings.js`, plus Playwright test in `viewer/test/app-settings.spec.js`.
  - Gap 3 (§4.2 delayed `refreshDiffs()` test): added Playwright test in `viewer/test/app-settings.spec.js` (supersedes the earlier manual-only note in Deviations above).
  - Gap 4 (§3.1 background focus): added `data-focus="background:remove"` on Remove background in `viewer/pages/settings.js`, plus Playwright test in `viewer/test/background-editor.spec.js`.
  - Gap 5 (§3.4 Shared tools key save after external project change): added `rereadAfterWrite()` in `viewer/pages/settings.js` so saving/removing a key (200 and 409) repaints `shared-tools` when `shared_tools_repo`/`saved_dirs` moved, plus Playwright tests (200 and 409) in `viewer/test/app-settings.spec.js`.
  - Validation: worker run `npm --prefix viewer run test:browser -- viewer/test/app-settings.spec.js viewer/test/background-editor.spec.js` -> `232 passed, 2 skipped` (Chromium & Firefox), exit 0; sub-lead independent run of `live refresh` (`44/44`) + `background-editor.spec.js` (`24/24`) -> `68/68 passed`, exit 0.

### Remediation 2 (after Verification Attempt 2 on `c4ae6592`)

- **Accepted rare path (`PLAN.md` Accepted Risks, `verification-2`):** delayed `/threads?view=list` response repainting a focused lesson textarea after a deferred settings poll.
- **Deferred (`PLAN.md` Deferred, `d7`, source `verification`):** refresh Lead names cleanly when Custom is selected without an uploaded file and another tab changes the list.
- **R2-1 (`d27b4621`, `standard / claude / claude-sonnet-5-5`):**
  - Gap 1 (§3.1 template action buttons focus): added template-scoped `data-focus` keys on `#save-template`, `#duplicate`, `#toggle-use`, and `#see-full` in `viewer/pages/settings.js`, and extended the template-deletion focus tests in `viewer/test/app-settings.spec.js` to cover all 5 buttons.
  - Gap 2 (§4.2 Worker ladder assertion): added Worker ladder order assertion in `viewer/test/app-settings.spec.js`.
  - Validation: worker run `npm --prefix viewer run test:browser -- viewer/test/app-settings.spec.js` -> `216 passed, 2 skipped` (Chromium & Firefox), exit 0; sub-lead independent run of modified tests -> `12/12 passed`, exit 0.
