# Remediation 1 — lessons-hardening

Verification attempt 1 at commit 63510ee6: two verifiers (claude-opus-5-5, gpt-6.2-sol), both FAIL. Merged gap list (the 72-lesson waiting gap was reported by both). No gap was judged a rare path: each happens in normal use (an agent removing a lesson while Collin edits; a Settings tab left open while the lesson changes) or is a Spec S3 / S9 requirement.

## Gaps (verbatim)

1. GAP: S4 / T5 — Keep can silently discard unsaved text in another row — I typed a draft, had an agent remove that lesson, then pressed Keep on a different lesson. The draft disappeared and Settings said “Saved, applies to new sessions.” The reply replaces the lesson list before draft cleanup drops text for missing IDs (`viewer/pages/settings.js:915–936`).
2. GAP: S3 — The Removed row’s Restore can restore different wording from what the user clicked — In a stale tab, Restore showed “Will be removed” but restored “Different wording from another tab” after that lesson was restored, edited, and removed again. The browser sent only `id`, so the server selected the newest version at request time (`viewer/pages/settings.js:975–985`, `viewer/app/settings.js:371–375`).
3. GAP: S3 — History shows who wrote the old wording where the spec calls for who changed it — I edited an agent’s lesson in Settings. The stored version had `changed_by: 'user'`, but its history row displayed “by an agent” because it reads `saved_by` (`viewer/pages/settings.js:950–956`).
4. GAP: S9 — The 72-lesson overflow test leaves the existing Waiting list empty — It asserts the number queued, but cannot detect eviction of an existing waiting entry (`viewer/test/app-lessons-history.test.js:27–41`). (Reported by both verifiers.)
5. GAP: S9 — The Node export/import round-trip exercises an empty store and checks HTTP status only — It never checks that a lesson survives transfer (`viewer/test/app-lessons-history.test.js:43–49`).
6. GAP: S9 — The history tests do not assert the recorded `changed_by` for agent removal or Restore (`viewer/test/app-lessons-history.test.js:15–22`, `:29–34`).

## Tasks

- **R1-UI** (gaps 1, 2, 3; built by Claude, so `--provider claude`): `viewer/pages/settings.js` lessons parts and `viewer/test/app-lessons.spec.js`. Brief: scratch `R1-UI.md`.
- **R1-TESTS** (gaps 4, 5, 6; built by GPT, so `--provider gpt`): `viewer/test/app-lessons-history.test.js` only. Brief: scratch `R1-TESTS.md`.
