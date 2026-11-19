# Remediation 1 — owner-name-identifiers

Verification attempt 1 (claude / claude-opus-5-5, commit `1877e9f6`): FAIL with one gap. No gaps were judged rare paths.

## Gaps (verbatim)

GAP: S5 (comment at `test-support/smoke/live.js:44`, which S5 names) — the name was swapped but the comment still uses "his" and "His" for the owner, and the new sentence starts in lowercase. That falls short of S5's "rewrite comments naming the owner to say 'the user'" and the idea's neutral wording. It is comment-only; nothing behaves differently. — `test-support/smoke/live.js:44-46`: `// the user's choice (PLAN.md D10): … even when his accounts are below their reserve.` / `// His real Settings are never touched: …`. The second Validation grep misses it because it only searches for the name.

## Tasks

### R1-1 — reword the smoke comment (light, gpt)

Replace `test-support/smoke/live.js:44-46` with the exact text in the brief: "The user's choice …", "… even when the user's accounts …" and "The user's real Settings …". Validation: `node --check test-support/smoke/live.js` plus a read of the three lines. A sub-lead scan for other owner pronouns in comments under `viewer/` and `test-support/` found no other hits.
