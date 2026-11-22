# Remediation 2 — lessons-hardening

Verification attempt 2 at commit 685f3967: claude-opus-5-5 PASS; gpt-6.2-sol FAIL with 6 gaps. No gap judged a rare path: gap 1 is silent loss of Collin's typed text in normal use (an agent removing a lesson while he edits, then importing a file), always fixed; gaps 2-6 are S9 validation items whose tests cannot fail. Gap 1 is the import path of attempt 1's gap 1 class (Keep/Add/Discard were fixed; Import was not covered), so this is its first fix on this path.

## Gaps (verbatim)

1. GAP: S6 — Import can silently lose an unsaved draft when an agent has removed that lesson — In Chromium and Firefox, I edited a lesson, removed it through the agent path, then imported a valid lessons file. Settings showed the import counts and dropped the draft from view. Pressing Save cleared the draft without recovering it. (`viewer/pages/settings.js:1042`)
2. GAP: S9 — Settings removal never asserts `changed_by` on the archived version — The test checks `removed.by`. All 16 focused Node tests still passed when a scratch probe made user removal record the version as changed by an agent. `viewer/test/app-lessons-history.test.js:81`
3. GAP: S9 — The Restore thread test cannot tell whether Restore recovered the version’s thread — The original and replacement use the same thread. All 16 focused Node tests still passed when Restore used the current lesson’s thread. `viewer/test/app-lessons-history.test.js:14–20`
4. GAP: S9 — The prompt test cannot detect history appearing in agent instructions — Its before and after snapshots contain the same history. All 16 focused Node tests still passed when a scratch probe appended history text to the prompt. `viewer/test/app-lessons-history.test.js:84–86`
5. GAP: S9 — The Node Keep test never starts with a stale lesson — It keeps a lesson restored moments earlier, so the final freshness assertion would pass even if the stale calculation ignored `kept_at`. `viewer/test/app-lessons-history.test.js:18–24`
6. GAP: S9 — The Retry test checks only the resulting lesson lists — It still passed when a scratch probe made Retry invoke the merge with an empty list. `viewer/test/app-handoff-import.test.js:366–375`

## Tasks

- **R2-UI** (gap 1; `--provider claude`): `viewer/pages/settings.js` lessons parts, `viewer/test/app-lessons.spec.js`.
- **R2-TESTS** (gaps 2-6; `--provider gpt`): `viewer/test/app-lessons-history.test.js`, `viewer/test/app-handoff-import.test.js`.
