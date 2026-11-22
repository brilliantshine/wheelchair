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
- A Settings version row's "by an agent / by you" shows the version's own `saved_by` (who wrote that wording), not `changed_by` (`viewer/pages/settings.js:947`).
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
- Accepted Risks in PLAN.md stand.

## Remediation rounds
