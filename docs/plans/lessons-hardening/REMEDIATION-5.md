# Remediation 5 — lessons-hardening

Verification attempt 5 at commit db8a21d7: both verifiers FAIL, on S9 test strength only; both confirmed the code is correct. Merged list: 3 distinct gaps (the Waiting-match retry gap was reported by both). None rare (Spec validation items are always fixed). Gap 1 is the agent-side twin of Remediation 3 gap 2 (Settings removal) and the second fix on agent-removal history (first: Remediation 1 gap 6, which asserted `changed_by` only). Gaps 2 and 3 are new.

## Gaps (verbatim)

1. GAP: S9 — The agent removal test accepts a missing history snapshot. It checks the last version’s `changed_by`, which is already `agent` from the preceding replace. All 18 focused Node tests passed when an in-memory probe made removal set only the removal marker for lessons with existing history. (`viewer/test/app-lessons-history.test.js:46`)
2. GAP: S9 (S5 "match/skip/add/waiting … and running it twice") — No test checks that an incoming lesson matching a Waiting entry is skipped, so the "safe to run twice" rule is never tested once lessons have gone to Waiting. — removing the Waiting clause from the skip check in `mergeLessons` passed all tests; with it a second merge into a full role gave `{waiting: 1}` instead of `{skipped: 1}`. (Both verifiers; `viewer/test/app-lessons-history.test.js:50-61`)
3. GAP: S9 ("Add re-checking key and capacity") — The key re-check of Add is tested only by its result string. Nothing checks that the entry is removed or that no copy is added. — (a) on `already`, return without removing the Waiting entry; (b) on `already`, add the lesson anyway: each passed all tests. (`viewer/test/app-lessons-history.test.js:144`)

Not a gap (claude verifier): no test covers the trimmed-text part of the match key. Added to this round's task anyway.

## Task

- **R5-TESTS** (`--provider gpt`): `viewer/test/app-lessons-history.test.js` only.
