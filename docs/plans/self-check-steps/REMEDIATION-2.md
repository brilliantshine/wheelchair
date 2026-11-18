# Remediation 2 — self-check-steps

Verification attempt 2 on `591ec3a3dc27e25ea14bf131b9f01dfd4d583309`: claude verifier PASS;
gpt verifier FAIL with three gaps.

## Gaps, verbatim

GAP: Fix it now after a newer Done — the lead must identify the pressed card’s head and broken-step notes, but the press delivers only the card ID and posting a card gives the lead no ID to associate with its head. The protocol supplies no way to look up that association when a press was queued before a newer Done. Evidence: `viewer/app/threads.js:322–334`, `viewer/app/card.js:291–295`, `protocol/app/lead.md:515–519`.
GAP: Fix it now after lead restart — restart context omits lead replies, so a replacement lead can replay a fix request the previous lead already handled. An isolated probe produced identical `recent_messages` and `answered_action` with and without a previous lead reply. Evidence: `viewer/app/threads.js:136–148`, `protocol/app/lead.md:526–529`, [probe output](/tmp/wc-verifier-6.K9jzMC/restart-probe.log).
GAP: One-line `note` — validation still accepts vertical tab and form feed inside a note. A direct validator probe returned `ok: true` for both U+000B and U+000C between two lines of text. Evidence: `viewer/app/card.js:144–145`.

The `note` gap is the second fix attempt for the one-line note (attempt 1 added U+2028/U+2029);
R4 closes every Unicode line terminator.

The restart gap contradicts the Spec's wording ("no lead reply after it" is not observable to
a restarted lead); asked the lead before writing its task.

## Tasks

| # | Gaps | Ownership | Lane |
|---|------|-----------|------|
| R4 | one-line note: all line terminators | viewer/app/card.js, viewer/test/app-check-card.test.js | light / gpt (built T1, R2) |
| R5 | fix press after a newer done; restart replay (per the lead's answer) | protocol/app/lead.md | light / claude (built T2, R3) |

# R4 — check card: a step `note` must reject every line terminator

Task id: R4. Tier: Light. Remediation of verification attempt 2.

Gap: `viewer/app/card.js` (the `check` steps rule, ~line 145) uses `/[\r\n  \u0085]/` for the one-line `note`, so vertical tab (U+000B) and form feed (U+000C) still pass.

Exact change:
1. In `viewer/app/card.js`, replace that regex with `/[\n\v\f\r\u0085  ]/` (nothing else in the file).
2. In `viewer/test/app-check-card.test.js`, in the first test's refused step changes, right after `{ agent: 'broken', note: 'x y' }`, add `{ agent: 'broken', note: 'x\u000by' }`, `{ agent: 'broken', note: 'x\u000cy' }` and `{ agent: 'broken', note: 'x\u0085y' }`. Write them with `\u` escapes in the source (not raw characters).

## Ownership boundary
`viewer/app/card.js` (that regex), `viewer/test/app-check-card.test.js`, your report `docs/plans/self-check-steps/reports/R4.md`.

## Validation (paste output tails)
```bash
node --test viewer/test/app-check-card.test.js
grep -nP '[\x{0b}\x{0c}\x{85}\x{2028}\x{2029}]' viewer/test/app-check-card.test.js viewer/app/card.js   # must print nothing
```

# R5 — lead.md: make the Fix-it-now press checks observable

Task id: R5. Tier: Light. Remediation of verification attempt 2. Wording only, in `protocol/app/lead.md` step 10 (`### 10. Check it yourself`).

Two exact replacements (keep the paragraph's existing ~90-column wrapping; rewrap only the lines you touch):

1. In the **Posting.** paragraph, replace the sentence
   "On `[card <id>] fix what the check found`, first check the card's `head` is still the current done head (a newer done may have been posted while the press was queued); if not, say in a line that a newer version replaced it and do nothing. Otherwise handle it as a problem Collin reported (step 9, which checks the PR state first), using the broken steps' notes as the report."
   with
   "On `[card <id>] fix what the check found`, first check the card's `head` is still the current done head (a newer done may have been posted while the press was queued): the press does not name the head, so if you have posted a `done` since your latest `check` card, a newer version replaced it; say so in a line and do nothing. Otherwise handle it as a problem Collin reported (step 9, which checks the PR state first), using your latest check card's broken steps' notes as the report."

2. In the **Restart.** paragraph, replace
   "A `fix what the check found` press in the recent messages with no lead reply after it is handled now, as in Posting (current-head check first)."
   with
   "A `fix what the check found` press in the recent messages is handled now, as in Posting (current-head check first, using the pressed card's `head` from the context's cards), unless a later `done` card is in the context (it was already fixed) or the local branch has commits past that card's `head` (a fix is in progress: carry on from them as step 9). The context carries no lead replies, so judge only by these."

Change nothing else.

## Ownership boundary
`protocol/app/lead.md` (those two sentences only), your report `docs/plans/self-check-steps/reports/R5.md`.

## Validation (paste output)
```bash
grep -n "since your latest \`check\` card\|commits past that card" protocol/app/lead.md
node --test viewer/test/protocol-rules.test.js
git diff --stat origin/main -- protocol/app/sub-lead.md protocol/app/worker.md   # must print nothing
```
