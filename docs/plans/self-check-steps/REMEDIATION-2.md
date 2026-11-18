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
