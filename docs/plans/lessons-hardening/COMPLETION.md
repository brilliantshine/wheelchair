---
slug: lessons-hardening
date: 2026-11-21
implemented-by: "standard: gpt-6.1-terra (T1 server, T3 handoff, T4 handoff tests); standard: claude-sonnet-5-5 (T2 Settings UI, T5 UI fixes); sub-lead: claude-opus-5-5"
verified-by: []
---

# Completion Report — Make agent lessons solid

Written for a hostile reviewer: every claim checkable, no claim without evidence.
All paths are relative to the repository root; line numbers are at the commit this report is committed in.

```yaml
verified-by: []
```

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 storage: `kept_at`, `lesson_history`, `lesson_waiting`, caps (20 versions, 50 removed), normalize keeps/drops | this run | `viewer/app/settings.js:23` (constants), `:291-308` (normalize history and waiting), `:344-351` (`recordHistory`, 20-version cap), `:343` (`trimRemoved`, 50 removed), `defaults()` `:54` | `viewer/test/app-lessons-history.test.js:13`, `:27`, `:69` |
| S1 new ids avoid history ids | this run | `viewer/app/settings.js:213`, `:342` (`newLessonId`) | `viewer/test/app-lessons-history.test.js:84` |
| S2 history recorded for agent replace/remove (`agent`), Settings edit/removal (`user`), restore; no-ops record nothing; scope-only replace records | this run | `viewer/app/settings.js:205`, `:215` (applyLesson); `viewer/app/routes.js:250-251` (PUT lessons); `viewer/app/settings.js:371-383` (restore) | `viewer/test/app-lessons-history.test.js:13` (scope-only replace, repeated identical restore), `:52` (user edit/removal) |
| S2 history never reaches agents (`lessonBlocks` unchanged) | this run | `lessonBlocks` untouched (`viewer/app/settings.js:181`) | `viewer/test/app-lessons-history.test.js:52` (roleLayers text equal before/after `kept_at` + waiting) |
| S3 restore by `vid`, removed restore (newest version), 409 when gone, 422 at 12, `saved_by: 'user'`, `thread` restored | this run | `viewer/app/settings.js:371-383`; route `viewer/app/routes.js:240` | `viewer/test/app-lessons-history.test.js:13`, `:27`, `:52` |
| S3 Settings: History (N) toggle, versions newest first with markers, Removed section, Restore, disabled while unsaved ("Save or undo your changes first"), 409 reload with sentence, Templates item shown with current/removed/waiting | this run | `viewer/pages/settings.js:947` (`versionRows`), `:974` (Removed), `:910-937` (`lessonAction`, `keepLessonEdits`), `:1082` (restore hint), `:1100-1107` (Templates item) | `viewer/test/app-lessons.spec.js:128`, `:168`, `:195`, `:211`, `:233` |
| S4 stale at 90 days since max(saved_at, kept_at); Keep sets `kept_at` (no history, saved_by unchanged); Templates counts | this run | `viewer/app/settings.js:335` (`isLessonStale`), `:384` (`keepLesson`), route `viewer/app/routes.js:241`; `viewer/pages/settings.js:896`, `:1069`, `:1102` | `viewer/test/app-lessons-history.test.js:13`; `viewer/test/app-lessons.spec.js:219` |
| S4 agents unchanged | this run | no prompt, card or rule text changed (diff touches no `protocol/` or `card.js`) | `viewer/test/app-lessons-history.test.js:52` |
| S5 merge: validation/invalid, match key (role+trimmed text+provider+project) vs current, history versions and waiting; add with new id and `kept_at`; waiting overflow uncapped; idempotent | this run | `viewer/app/settings.js:352-368` (`matchKey`, `mergeLessons`), `:369` (`mergeIncoming`) | `viewer/test/app-lessons-history.test.js:27` (match/skip/add/invalid, twice, 72 waiting), `:84` (different project kept), `:52` (skip vs older history version) |
| S5 Waiting to add: Add (re-check key and capacity, 422 "Remove one first", "already"), Discard, 409 on gone `wid`; UI section | this run | `viewer/app/settings.js:385`; route `viewer/app/routes.js:242`; `viewer/pages/settings.js:995` | `viewer/test/app-lessons-history.test.js:27`, `:69`; `viewer/test/app-lessons.spec.js:233`, `:249` |
| S6 Export (`wheelchair-lessons.json`, no ids/threads/history/waiting) | this run | `viewer/app/settings.js:370`; route `viewer/app/routes.js:233-235`; button `viewer/pages/settings.js:1038` | `viewer/test/app-lessons-history.test.js:43`; `viewer/test/app-lessons.spec.js:257` |
| S6 Import (own raw route, 1 MB → 413, not-a-lessons-file → 400, unknown project counted, saved directory kept, summary message) | this run | `viewer/app/routes.js:66-74`; `viewer/app/settings.js:369`; `viewer/pages/settings.js:1039` | `viewer/test/app-lessons-history.test.js:43`, `:69`; `viewer/test/app-lessons.spec.js:257` |
| S7 export v3 with this thread's lessons, `project: true` filter | this run | `viewer/app/handoff.js:72-82` | `viewer/test/app-handoff.test.js:402` |
| S7 validate v1/v2/v3; `lessons` only for v3; non-array refuses | this run | `viewer/app/handoff.js:18-20` | `viewer/test/app-handoff.test.js:384`, `:402`; `viewer/test/app-handoff-import.test.js:330` |
| S7 import merges after `firstPreclaim`, before `handoff_op` saved; `project: true` → target project; `thread` kept; Retry, resume, pending path, `opened`, startCreate/startAdvance never merge | this run | `viewer/app/handoff-ops.js:127-137`; `viewer/app/handoff-import.js:63`, `:67` | `viewer/test/app-handoff-import.test.js:220` (dirty Advance unchanged), `:330`, `:350`, `:366`, `:379`, `:390`, `:403` |
| S7 v1/v2 files import as before | this run | `viewer/app/handoff.js:18-20` | `viewer/test/app-handoff.test.js:384`; `viewer/test/app-handoff-import.test.js:308`, `:330` |
| S8 lesson card, receipts, applyLesson rules unchanged; restore marks user; import keeps incoming `saved_by` | this run | `viewer/app/settings.js:194-219` (only history calls added), `:378` | `viewer/test/app-lessons.test.js` (existing, unchanged, passing); `viewer/test/app-lessons-history.test.js:13` |

## Deviations from plan

- PUT `/settings/lessons/:role` with an edit whose text is unchanged is now a full no-op: it records no history (S2) and also no longer sets `saved_by: 'user'` / `saved_at` as before (`viewer/app/routes.js:250`).
- (Superseded by Remediation 1: History now shows `changed_by`.)
- Other worker choices are logged in PLAN.md's Log.

## Routers

None — this change moved no ownership and no router named a file it touched.

## Validation evidence

At the feature tip (merge of T5, `f60b635c`), from `viewer/`:

`npm test`
```
# tests 844
# pass 844
# fail 0
```

`npx playwright test test/app-lessons.spec.js test/app-handoff.spec.js`
```
  70 passed (33.1s)
```

Earlier runs during the build: under heavy machine load `npm test` showed one or two failures per run in unrelated files (app-quiet, routes, server, app-hub: ports and timing), different each run, each passing alone. The final run above was clean.

Screenshots: `docs/plans/lessons-hardening/reports/T2-lessons-history.png` (editor before T5's fixes); after T5, `/tmp/claude-1000/shots/lessons-history.png`, `/tmp/claude-1000/shots/templates-list-1280.png`, `/tmp/claude-1000/shots/templates-list-390.png`.

## Known gaps / residual risks

- The Retry test (`viewer/test/app-handoff-import.test.js:366`) cannot detect a merge, because a saved handoff operation carries no lessons at all (`viewer/app/handoff-ops.js` `operation()`); Retry has no lesson source by construction. The pending-upload test (`:350`) does guard the reachable path.
- The 409 browser test (`viewer/test/app-lessons.spec.js:168`) asserts that a message is shown, not its exact wording.
- After a 409 reload, unsaved typed text for a lesson still present is kept and Save writes it, even if the server text changed meanwhile (the existing Save has no per-lesson conflict check).
- After a Save refused with 409, the editor keeps its last-loaded list (unchanged pre-existing behaviour), so if an agent filled the role meanwhile, Add to it shows enabled; pressing it gets the server's "Remove one first" (422).
- Accepted Risks in PLAN.md stand.

## Remediation rounds

### Remediation 1 — 2026-11-21

Verification attempt 1 (63510ee6, claude-opus-5-5 and gpt-6.2-sol) failed with 6 gaps, none rare; see `REMEDIATION-1.md`.

| Gap | Fix | Where | Test |
|-----|-----|-------|------|
| 1 Keep/Add/Discard after an agent removed the lesson being edited dropped the draft and said "Saved" | the dropped draft is shown back: "An agent removed a lesson you were editing. Your unsaved text was: “…”" | `viewer/pages/settings.js` `lessonAction`, `keepLessonEdits` (~910-952) | `viewer/test/app-lessons.spec.js` (R1-UI test a) |
| 2 Removed Restore sent only `id` | sends the newest version's `vid` shown in the row | `viewer/pages/settings.js` Removed row (~999) | `viewer/test/app-lessons.spec.js` (R1-UI test b) |
| 3 History showed `saved_by` | shows "replaced by you/an agent <date>" from `changed_by` | `viewer/pages/settings.js` `versionRows` (~970) | `viewer/test/app-lessons.spec.js` (R1-UI test c) |
| 4 72-lesson overflow test had an empty Waiting list | two waiting entries kept unchanged, 74 total | `viewer/test/app-lessons-history.test.js` | itself |
| 5 export/import round-trip on an empty store | three lessons round-trip with fields preserved; re-import skips 3 | `viewer/test/app-lessons-history.test.js` | itself |
| 6 `changed_by` unasserted for agent remove / restore | asserted | `viewer/test/app-lessons-history.test.js` | itself |

Validation after remediation, from `viewer/`:

```
npm test: # tests 844  # pass 844  # fail 0
npx playwright test test/app-lessons.spec.js test/app-handoff.spec.js: 76 passed (37.9s)
```

### Remediation 2 — 2026-11-21

Verification attempt 2 (685f3967): claude-opus-5-5 PASS, gpt-6.2-sol FAIL with 6 gaps, none rare; see `REMEDIATION-2.md`.

| Gap | Fix | Where | Test |
|-----|-----|-------|------|
| 1 Import dropped an unsaved draft for a lesson an agent removed | `importLessons` reconciles drafts like `lessonAction`: surviving drafts stay, dropped ones are shown with the import counts; shared helper `showLessonLost` | `viewer/pages/settings.js` `importLessons`, `showLessonLost`, `keepLessonEdits` | `viewer/test/app-lessons.spec.js` (draft survives import / dropped draft shown) |
| 2 Settings removal `changed_by` unasserted | edit and removal versions asserted `changed_by: 'user'` with old wording | `viewer/test/app-lessons-history.test.js` | fails under routes recording `'agent'` |
| 3 Restore thread test could not tell threads apart | `thread-old` / `thread-new` | `viewer/test/app-lessons-history.test.js` | fails when restore keeps the current thread |
| 4 prompt test could not see history | baseline without history; markers in history, removed and waiting; prompt equal and marker-free | `viewer/test/app-lessons-history.test.js` | fails when `lessonBlocks` appends history (re-checked by the sub-lead) |
| 5 Keep test never started stale | lesson saved 100 days ago; stale before Keep, fresh after; `kept_at` 10 days ago not stale | `viewer/test/app-lessons-history.test.js` | fails when `isLessonStale` ignores `kept_at` |
| 6 Retry test checked only lists | spy on `mergeIncoming` asserts zero calls in Retry, pending and opened imports | `viewer/test/app-handoff-import.test.js` | fails when `runLocked` calls `mergeIncoming(hub, [])` |

Validation after remediation, from `viewer/`:

```
npm test: # tests 845  # pass 844  # fail 1  (lifecycle.test.js "--service gives up after three takeovers", untouched file; alone: # pass 31 # fail 0)
npx playwright test test/app-lessons.spec.js test/app-handoff.spec.js: 78 passed (48.1s)
```

### Remediation 3 — 2026-11-22

Verification attempt 3 (81b9ddbd): claude-opus-5-5 PASS, gpt-6.2-sol FAIL with 3 gaps, none rare; see `REMEDIATION-3.md`.

| Gap | Fix | Where | Test |
|-----|-----|-------|------|
| 1 a refused Save re-enabled Restore while edits were unsaved (and Add while full) | `setLessonsBusy(false)` re-applies `refreshRestore()` and `refreshAdd()` (shared `lessonFull`); Add after a refused Save with a stale list is refused by the server (see residual risks) | `viewer/pages/settings.js` `setLessonsBusy`, `refreshAdd`, `lessonFull` | `viewer/test/app-lessons.spec.js` (refused Save keeps guards; fails on revert for Restore) |
| 2 Settings removal test passed without a removal version | count grows by one, version text is the pre-removal wording, `changed_by`/`removed.by` user | `viewer/test/app-lessons-history.test.js` | fails when removal sets only the marker |
| 3 merge test had a one-version history | three versions; oldest and middle (and a removed lesson's oldest) skipped, nothing added | `viewer/test/app-lessons-history.test.js` | fails when only the newest version is matched (re-checked by the sub-lead) |

### Remediation 4 — 2026-11-22

Verification attempt 4 (c88a155a): claude-opus-5-5 PASS, gpt-6.2-sol FAIL with 2 S9 test gaps (the code was correct); see `REMEDIATION-4.md`.

| Gap | Fix | Where | Test |
|-----|-----|-------|------|
| 1 cap tests accepted eviction of the wrong records | exact surviving version texts (oldest dropped); removals with increasing times, exactly the oldest removed entry deleted | `viewer/test/app-lessons-history.test.js` | fails when the second-oldest version or the newest removed entry is dropped (re-checked by the sub-lead) |
| 2 identical-Restore retry accepted a changed `saved_at` | whole lesson and history entry deep-equal before and after | `viewer/test/app-lessons-history.test.js` | fails when the no-op restore rewrites `saved_at` (re-checked by the sub-lead) |
| audit | exact-state asserts for merge adds, scoped records, normalized history/waiting, restored removed lesson, 422 refusals, waiting Add, user edit | `viewer/test/app-lessons-history.test.js` | 5 of 7 mutations caught; the other two cannot change stored state (normalize / rolled-back update) |

Validation after remediation, from `viewer/`:

```
npm test: # tests 846  # pass 846  # fail 0
npx playwright test test/app-lessons.spec.js test/app-handoff.spec.js: 80 passed (46.3s)
```

### Remediation 5 — 2026-11-22

Verification attempt 5 (db8a21d7): both verifiers FAIL on S9 test strength only (code correct per both); see `REMEDIATION-5.md`.

| Gap | Fix | Test fails when |
|-----|-----|-----------------|
| 1 agent removal accepted a missing history snapshot | count +1, version text is the pre-removal wording, `changed_by`/`removed.by` agent | removal sets only the marker (re-checked by the sub-lead) |
| 2 no merge retry once lessons are in Waiting | second merge into a full role: exact counts `skipped: 1`, Waiting unchanged | the Waiting clause is dropped from the skip check (re-checked) |
| 3 Add `already` checked only by result string | entry gone and no copy added | `already` keeps the entry (re-checked) or adds a copy |
| extra | trimmed text matches | `.trim()` dropped from the match key (re-checked) |

All in `viewer/test/app-lessons-history.test.js`. Validation, from `viewer/`: focused 21/21; `npm test` 847/849 with two failures in untouched files (app-quiet, server) that pass alone (74/74).

### Remediation 6 — 2026-11-22

Verification attempt 6 (9a595e40): claude-opus-5-5 PASS, gpt-6.2-sol FAIL with 3 S9 test gaps (code correct); see `REMEDIATION-6.md`.

| Gap | Test fails when |
|-----|-----------------|
| 1 restore must keep the version's project/provider (and a global version stays global) | restore takes scope from the current lesson (re-checked by the sub-lead) |
| 2 import and Waiting Add ids avoid history ids | `newLessonId` ignores `lesson_history` (re-checked) |
| 3 export has exactly the specified fields | history or waiting are added to the export (re-checked) |
| sweep | 22 deliberate breaks across `recordHistory`, `mergeLessons`, `restoreLesson`, `keepLesson`, `waitingAction`, `normalize` and the import route; each break that went unnoticed now has a test that fails on it (`reports/R6-TESTS.md`) |

All in `viewer/test/app-lessons-history.test.js`. Validation, from `viewer/`: focused 30/30; `npm test` 857/858 (lifecycle.test.js, untouched, passes alone 31/31); browser specs 80/80.

### Remediation 7 — 2026-11-22

Verification attempt 7 (f08d2017): claude-opus-5-5 PASS, gpt-6.2-sol FAIL with 2 S9 test gaps (code correct); see `REMEDIATION-7.md`.

| Gap | Test fails when |
|-----|-----------------|
| 1 restore must archive the current lesson, not the chosen version | restore records the chosen version (re-checked by the sub-lead) |
| 2 the real handoff download carries exactly the thread's saved lessons | the export caller passes no lessons (re-checked) |
| sweep | 13 deliberate breaks across the handoff export filter, validation and import; all caught (`reports/R7-TESTS.md`) |

Validation, from `viewer/`: lessons + handoff node tests 123/123; `npm test` 859/859.

