# R3-UI report

## Changed
- `viewer/pages/settings.js` (lessons editor only): `setLessonsBusy(false)` now re-applies the renderer's rules by calling `refreshRestore()` (Restore disabled while `lessonDirty()`, hint shown) and a new `refreshAdd()` (Add disabled with title "Remove one first" while `lessonFull(role)`). New `lessonFull` helper is also used by the waiting-section renderer (single source). Other rule-disabled buttons checked: `.lesson-text` (removed rows; already handled in `setLessonsBusy`); every other lesson button (Undo, Really remove, Remove, Keep, Discard, Save) is disabled only by `saving`, so needs no rule.
- `viewer/test/app-lessons.spec.js`: new test "a refused Save keeps Restore disabled with unsaved edits and Add disabled while the role is full" (12 lessons, history on A, waiting entry; draft in A; server removes A and adds another; Save → 409; asserts Restore disabled + hint, Add disabled + title, Save enabled).

## Validation
`npx playwright test test/app-lessons.spec.js`: exit 0, `46 passed (23.9s)`.

Reverted settings.js, new test only: exit 1, `2 failed` (chromium, firefox):
`Error: expect(locator).toBeDisabled() failed  Expected: disabled  Received: enabled`. Fix restored afterwards.

`npm test`: 845 tests, 844 pass, 1 fail: `/whoami supplies pid and code...` in `test/lifecycle.test.js` (untouched; "Refused to use a port held by a process it cannot identify"). Re-run with `node --test test/lifecycle.test.js`: see below.
    # tests 31
    # pass 31
    # fail 0

## Choices
- Added `lessonFull` and `refreshAdd` helpers in settings.js rather than re-rendering after a refused Save, so typed drafts and open history stay as they are.
