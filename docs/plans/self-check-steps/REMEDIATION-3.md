# Remediation 3 — self-check-steps

Verification attempt 3 on `9af62467092ff630834aac2d90c7a896b0cc0d83`: claude verifier PASS;
gpt verifier FAIL with two gaps. Both refine Remediation 2's Decision 19 rules; this is the
second fix attempt for each. A third failure on either goes to the lead as a plan defect.

## Gaps, verbatim

GAP: Fix it now for the current head — Retrying Done at the same commit leaves the existing check card actionable, but the lead treats its next Fix it now press as stale and discards it. An isolated fixture confirmed the hub accepted the press and marked the card answered while the head still matched. The lead’s rule rejects it solely because another Done was posted after the check card. `viewer/app/threads.js:322–334`, `protocol/app/lead.md:512–520`.
GAP: Fix it now after a restart — If the PR is already merged, the lead handles the press by creating a follow-up thread. That leaves the branch head and Done history unchanged, so a restarted lead replays the same press and can create a second follow-up. An isolated fixture applying the restart rule produced two distinct child thread IDs. `protocol/app/lead.md:419–423`, `protocol/app/lead.md:527–533`, `viewer/app/cards.js:153–156`.

## Tasks

| # | Gaps | Ownership | Lane |
|---|------|-----------|------|
| R6 | both | protocol/app/lead.md | light / claude (built T2, R3, R5) |

# R6 — lead.md: two refinements to the Fix-it-now press rules

Task id: R6. Tier: Light. Remediation of verification attempt 3. Wording only, in `protocol/app/lead.md` step 10 (`### 10. Check it yourself`), **Posting.** and **Restart.** paragraphs.

1. **Posting.** Replace
   "so if you have posted a `done`
since your latest `check` card, a newer version replaced it;"
   with
   "so if you have posted a `done` with a different `head` since your latest `check` card, a newer version replaced it (a retried `done` at the same head does not);"

2. **Restart.** Replace
   "unless a later `done` card is in the context (it was already fixed) or the local
branch has commits past that card's `head` (a fix is in progress: carry on from them as
step 9)."
   with
   "unless the context has a `done` card with a different `head` or a `stub` card created after the press (it was already handled: fixed, or turned into a follow-up thread because the pull request was merged), or the local branch has commits past that card's `head` (a fix is in progress: carry on from them as step 9)."

Rewrap only the lines you touch, to the paragraph's ~90 columns. Change nothing else.

## Ownership boundary
`protocol/app/lead.md` (those two sentences only), your report `docs/plans/self-check-steps/reports/R6.md`. Write any scratch logs outside the repository (not under `docs/`).

## Validation (paste output)
```bash
grep -n "with a different \`head\`" protocol/app/lead.md      # two lines (one per paragraph, may wrap)
grep -n "created after the press" protocol/app/lead.md
node --test viewer/test/protocol-rules.test.js
git diff --stat origin/main -- protocol/app/sub-lead.md protocol/app/worker.md   # must print nothing
git status --short   # clean after your commit
```
