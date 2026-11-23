# Remediation 7 — lessons-hardening

Verification attempt 7 at commit f08d2017: claude-opus-5-5 PASS (no gaps); gpt-6.2-sol FAIL with 2 S9 test-strength gaps (code correct). Neither is rare or a repeat. Remediation 6 swept the settings functions; this round also sweeps the handoff lessons code, which that sweep did not cover.

## Gaps (verbatim)

1. GAP: S9 / S2 — The Restore test checks who made the change but misses which lesson was archived. All 30 focused Node tests passed when an in-memory probe archived the selected older version instead of the current lesson. (`viewer/test/app-lessons-history.test.js:18`)
2. GAP: S9 / S7 — The handoff export test supplies lessons directly to the file builder, leaving the download path untested with saved lessons. All 92 handoff Node tests passed when an in-memory probe disconnected the lessons store from the download and produced an empty `lessons` array. (`viewer/test/app-handoff.test.js:402`)

## Task

- **R7-TESTS** (`--provider gpt`): `viewer/test/app-lessons-history.test.js`, `viewer/test/app-handoff.test.js`, `viewer/test/app-handoff-import.test.js`.
