# Remediation 4 — lessons-hardening

Verification attempt 4 at commit c88a155a: claude-opus-5-5 PASS; gpt-6.2-sol FAIL with 2 gaps. Both are S9 validation items whose tests pass under wrong behaviour; the verifier confirmed the built code itself evicts the oldest records and leaves an identical Restore unchanged. Not rare (Spec validation items are always fixed); neither repeats an earlier gap. Attempts 1-4 each found new weak tests, so this round also audits every S9 node item at once.

## Gaps (verbatim)

1. GAP: S9 — The cap tests accept eviction of the wrong records — Both focused lessons files passed all 18 tests with in-memory changes that evicted the second-oldest history version and the newest removed lesson. (`viewer/test/app-lessons-history.test.js:38`)
2. GAP: S9 / S2 — The identical-Restore retry test accepts changes to `saved_at` — Both focused lessons files passed all 18 tests when an in-memory change rewrote `saved_at` on the retry. The test checks only the history length. (`viewer/test/app-lessons-history.test.js:21`)

## Task

- **R4-TESTS** (`--provider gpt`): `viewer/test/app-lessons-history.test.js` only.
