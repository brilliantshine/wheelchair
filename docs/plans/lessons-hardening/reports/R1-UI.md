# R1-UI report

## Files changed
- `viewer/pages/settings.js` (lessons editor only): `keepLessonEdits` returns drafts dropped because their lesson is gone; `lessonAction` shows `An agent removed a lesson you were editing. Your unsaved text was: “<text>”` (one per draft, line-break joined) in `.lesson-err` instead of the Saved note, on both the success and 409 paths; Removed Restore sends `{ id, vid: <newest version vid> }`; History rows read `replaced by you|an agent <date>` from `changed_by`.
- `viewer/test/app-lessons.spec.js`: three new tests (vanished draft; Removed Restore 409 with a changed newest version; "replaced by you" with `saved_by: agent`), existing history test updated to the new wording, stale-count test uses valid id `L0000a1` and asserts "1 may be out of date".
- `docs/plans/lessons-hardening/reports/R1-UI.md`.

## Validation
`npx playwright test test/app-lessons.spec.js` → exit 0, `42 passed (16.6s)` (chromium + firefox).

`npm test` → exit 0; `# tests 844 / # pass 844 / # fail 0`.

Revert check: with the old `settings.js`, chromium run stops at the first failure (serial mode): the History test fails (`toContainText` on the new wording); `1 failed, 5 passed`. The later new tests were not reached in that run, so only the gap-3 assertion was shown failing under revert; gaps 1-2 tests were not individually revert-checked.

## Choices
- Multiple dropped drafts / 409 path: on 409 the lost-draft sentences come first, then the server's 409 sentence, in one line-break-joined block (`white-space: pre-line` set inline).
- An empty-string draft is not treated as a draft to report.
- Test lesson ids use valid hex (`L0000a5`–`L0000a8`).
