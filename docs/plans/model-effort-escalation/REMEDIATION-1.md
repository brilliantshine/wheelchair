# Remediation 1 — model-effort-escalation

Verification attempt 1 on commit 57aea286f730117e00bce413537c3466f9f467ef: three verifiers
(two Codex, one Claude), all FAIL on the same Spec §3 point.

## Gaps, verbatim

From wc-70d7c545bb47-verifier-3 (codex):

> GAP: Spec §3, stepping rule — The generated escalation instructions omit “unset counts as high,” leaving escalation from “CLI default” without a defined starting effort. Neither provider receives this rule — viewer/app/settings.js:122; protocol/app/sub-lead.md:136 delegates escalation moves to that generated block.

From wc-70d7c545bb47-verifier (codex):

> GAP: §3 unset-effort stepping — Generated instructions never say unset effort counts as `high`, leaving the next escalation rung undefined for default pins — viewer/app/settings.js:122; protocol/app/sub-lead.md:136 explicitly makes this block the sole source of escalation moves.
>
> GAP: §3 model-first stepping — The model-first instructions omit the required one-level-at-a-time effort climb at the highest tier — viewer/app/settings.js:129 says only “then raise effort at the top tier.”

From wc-70d7c545bb47-verifier-2 (claude):

> GAP: §3 stepping rule / Decision 6 — the rule that an unset effort counts as `high` for stepping, and that a tier already at or above the effort ceiling takes no effort step, appears nowhere the sub-lead reads. The rendered sentences and `sub-lead.md` say only "Raise effort first, one level at a time, up to <effort> … A tier's own effort setting is used as is." `sub-lead.md` also names that block as "the one source of escalation moves and limits". So with an unset pin, the sub-lead has no defined starting level. Under a `high` ceiling it would spend a failed try on `--effort high`, which the hub accepts, instead of stepping tier as the Spec intends — evidence: `viewer/app/settings.js:122-136` (`escalationSentences`), `protocol/app/sub-lead.md:149-151`.

Not gaps (each passed on an isolated re-run, outside this build's files): a message-queue
timer test in app-hub.test.js, Firefox thread-page timeouts in app-threads.spec.js.

## Tasks

### R1 — Escalation sentences state the full stepping rule (one task for all three gaps)

Family that built it: Codex (T3). Lane: codex light (gpt-6-luna): the brief gives the exact
strings, so it is transcription. Brief, verbatim:

# Task R1 — Escalation sentences state the full stepping rule

## Objective
Verification found that the sentence the hub renders for the sub-lead (`escalationSentences`, viewer/app/settings.js:122-136) leaves out two parts of Spec §3's stepping rule: an unset effort ("CLI default") counts as `high`; a tier already at or above the effort ceiling takes no effort step; and, in the model-first variant, effort climbs one level at a time. Change only sentence 2 (the `escalation.first` ternary), to exactly these strings. `${effort}` is the existing variable (it carries the GPT clause when max_effort is max); `${escalation.max_effort}` is the plain value; `${tier}` is the existing capitalized tier.

- first=effort:
  `Raise effort first, one level at a time from the tier's own effort ("CLI default" counts as high), up to ${effort}, then move to the next tier and repeat, up to ${tier}. A tier's own effort setting is used as is, and a tier already at ${escalation.max_effort} or above takes no effort step.`
- first=model:
  `Move up one tier at a time, up to ${tier}, at each tier's own effort; then raise effort at the top tier, one level at a time from its own effort ("CLI default" counts as high), up to ${effort}. A tier already at ${escalation.max_effort} or above takes no effort step.`

With the defaults, sentence 2 reads: Raise effort first, one level at a time from the tier's own effort ("CLI default" counts as high), up to xhigh, then move to the next tier and repeat, up to Critical. A tier's own effort setting is used as is, and a tier already at xhigh or above takes no effort step.

Nothing else in settings.js changes.

## Ownership boundary
viewer/app/settings.js, viewer/test/app-settings.test.js.

## Deliverable
The two strings above, and the test "escalation settings, sentences, and role layers" in viewer/test/app-settings.test.js updated to assert the new default sentence 2 verbatim and the new model-first/max variant verbatim (the variant currently asserted at about line 245). Check that viewer/test/app-settings.spec.js still matches the new text (it looks for "up to xhigh", "up to Critical" and a sentence starting "Move up one tier"); you do not own that file, so if it would break, stop and report.

## Validation
node --test viewer/test/app-settings.test.js
node --test viewer/test/*.test.js     # unquoted glob; "a starter that loses the freed port registers through the new holder" is a known pre-existing failure (docs/known-issues.md), and queue-timer tests in app-hub.test.js are occasionally flaky; report any other failure
