---
slug: settings-live-refresh
date: 2026-11-28
implemented-by: standard / gpt / gpt-6.1-terra (T1), standard / claude / claude-sonnet-5-5 (T2)
verified-by: []
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

## Known gaps / residual risks

- Deferred hardening items `d1`–`d5` remain locked in `PLAN.md`'s `## Deferred` table per `mode: two-part` (Decision 6).
- Accepted rare-path risks from Review Rounds 5, 8, and 9 remain recorded in `PLAN.md`'s `## Accepted Risks` table.

## Remediation rounds

*(None yet.)*
