# Remediation 6 — lessons-hardening

Verification attempt 6 at commit 9a595e40: claude-opus-5-5 PASS; gpt-6.2-sol FAIL with 3 S9 test-strength gaps (code correct). None rare, none a repeat. Since attempts 3-6 found only weak tests, one at a time, this round also runs a full mutation sweep over the lessons server code so every surviving break gets a test now.

## Gaps (verbatim)

1. GAP: S9 / S3 — The Restore tests allow a project-only version to become global. An in-memory change that reused the current lesson’s project instead of restoring the version’s project passed all 21 focused Node tests and the History Restore case in Chromium and Firefox. `viewer/test/app-lessons-history.test.js:18` and `viewer/test/app-lessons.spec.js:148`
2. GAP: S9 / S1 — The ID collision test covers agent-created lessons but misses the separate ID generator used by Import and Waiting Add. Removing the history-ID check from that generator passed all 21 focused Node tests. `viewer/app/settings.js:342` and `viewer/test/app-lessons-history.test.js:181`
3. GAP: S9 / S6 — The export round-trip tests allow lesson history and Waiting entries into the downloaded file. Adding both fields to the export in memory passed all 21 focused Node tests and the Export/Import case in Chromium and Firefox. `viewer/test/app-lessons-history.test.js:104` and `viewer/test/app-lessons.spec.js:316`

## Task

- **R6-TESTS** (`--provider gpt`): `viewer/test/app-lessons-history.test.js` only (node-level tests cover all three gaps).
