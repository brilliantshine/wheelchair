# Remediation 3 — lessons-hardening

Verification attempt 3 at commit 81b9ddbd: claude-opus-5-5 PASS; gpt-6.2-sol FAIL with 3 gaps. None judged rare: gap 1 is a Spec S3/S5 guard lost after a Save refused in normal use (an agent removing a lesson while Collin edits); gaps 2-3 are S9 items whose tests cannot fail. None repeats an earlier gap.

## Gaps (verbatim)

1. GAP: S3 / S5 — A rejected Save re-enables Restore while edits are unsaved and enables Add while the role is full — In Chromium and Firefox, I edited a lesson, removed it through the agent path, and refilled the role to 12. Save returned 409. Both buttons became enabled, and clicking Restore changed the saved lesson while the draft was still pending. The Save error handler clears the disabled state without reapplying either guard. `viewer/pages/settings.js:879–891`
2. GAP: S9 — The Settings removal test can pass when removal records no version — It checks the last version’s `changed_by`, which is already `user` from the preceding edit. All 17 focused Node tests passed with an in-memory change that suppressed the removal snapshot while preserving the removal marker. `viewer/test/app-lessons-history.test.js:88–91`
3. GAP: S9 — The merge test uses a history with only one version, so it misses regressions that check only the newest version — All 17 focused Node tests passed when I limited matching to the newest version in memory. `viewer/test/app-lessons-history.test.js:88–90`

## Tasks

- **R3-UI** (gap 1; `--provider claude`): `viewer/pages/settings.js` lessons parts, `viewer/test/app-lessons.spec.js`.
- **R3-TESTS** (gaps 2-3; `--provider gpt`): `viewer/test/app-lessons-history.test.js`.
