---
slug: token-efficiency
date: 2026-11-16
implemented-by: "standard (gpt-6.1-terra) for T1, T2, T3; T2 requested Claude, hub placed it on GPT"
verified-by: []
---

# Completion Report — Make wheelchair use fewer tokens

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Settings: per-provider `sub-lead` model cell in `codex/model.sh` | this run | `codex/model.sh:15` (slot), `:16` (WORK_TIERS kept explicit), `:80` (pins regex accepts `-`), `:123-126` (`cell()`) | `codex/test/run.sh:56-75` (inherits pinned lead, lead effort, family, default lead; set/read/effort; show --json; save writes it) |
| Settings: sub-lead cell copies the lead cell when absent; written on next save | this run | `codex/model.sh:123-126`; `rendered()` writes every slot | `codex/test/run.sh` "save writes inherited sub-lead" |
| Settings: sub-lead cell in the API | this run | `viewer/app/routes.js:210`; `viewer/app/API.md:38,40,100-105` | `node --test viewer/test/*.test.js` |
| Settings: sub-lead cell on the Models page | this run | `viewer/pages/settings.js:406-408` ("Leads run on" / "Sub-leads run on" per provider) | `viewer/test/app-settings.spec.js:118` |
| Settings: `balancer.js` resolves sub-leads to `sub-lead`, leads to `lead` | this run | `viewer/app/balancer.js:12` | `viewer/test/app-balancer.test.js:440-442` |
| Settings: Other agents `scout`, tier, default `light` | this run | `viewer/app/settings.js:27`; `viewer/app/routes.js:277`; `viewer/pages/settings.js:451` | `viewer/test/app-settings.test.js:317`; `app-settings.spec.js:118` |
| Settings: Other agents `scout-heavy` ("Scout for bigger changes"), default `standard` | this run | `viewer/app/settings.js:27`; `viewer/app/routes.js:277`; `viewer/pages/settings.js:452` | same as above |
| Scout: hub resolves scout tier to a model for the session's provider and adds a layer for lead and sub-lead | this run | `viewer/app/sessions.js:35-43` (`resolveScout`), `:180-185`; `viewer/app/settings.js:154-162` | `app-settings.test.js:317` (lead and sub-lead layers, Claude and GPT, none) |
| Scout: sub-lead layer also names the bigger-changes scout | this run | `viewer/app/settings.js:159-161`; `sessions.js:183` | `app-settings.test.js:317` ("200 to 800 lines): sonnet.") |
| Scout: Claude model given as Agent tool family alias; a model with no alias means no scout | this run (uses pre-existing `model.sh family claude`) | `viewer/app/sessions.js:36` calls `model.sh family claude <tier>` (`codex/model.sh:331-338`, pre-existing); exit 3 → null | `app-settings.test.js:317` (`haiku`, `sonnet`) |
| Scout: lead.md and sub-lead.md rule (helper on scout model, conclusions with file:line, open files only to confirm, read yourself with no scout) | this run | `protocol/app/lead.md:138-145`; `protocol/app/sub-lead.md:66-73` | `node --test viewer/test/protocol-rules.test.js`; read |
| Sub-lead diff checks: rerun validation, read report, size by `--shortstat <feature>...<worker>`, bands 200/800/`tricky`, next-band fallback, three-part scout report, open only flagged lines | this run | `protocol/app/sub-lead.md:143-156`; `tricky` marker `:64` | read against the Spec |
| Sub-lead diff checks: choices step uses scout list (3) | this run | `protocol/app/sub-lead.md:164-166` | read |
| Final verifier unchanged | this run (no change) | `protocol/app/sub-lead.md` "Finishing and verifying" untouched | `git diff main -- protocol/app/verifier.md` empty |
| Boundaries: no new app role; role sets and start rules unchanged | this run (no change) | `viewer/app/sessions.js:45-57` unchanged | diff |
| Boundaries: reviewers, verifiers, mappers, workers get no scout | this run | `viewer/app/settings.js:154`; `sessions.js:181` | `app-settings.test.js:317` (no scout block for worker/reviewer/verifier/mapper) |
| Edge: tier `none` or Claude model with no alias → unavailable, layer says so | this run | `viewer/app/sessions.js:39-41`; `settings.js:158,161` | `app-settings.test.js:317` (none line) |
| Edge: lookups use only the Light scout; diff checks follow the band fallback | this run | `protocol/app/lead.md:144-145`; `sub-lead.md:72-73,149-150` | read |
| Edge: composed role instructions still fit 12000 characters | this run | `viewer/app/settings.js:176` (assertFits includes the scout block with 60-char placeholders) | `node --test viewer/test/*.test.js` |
| Validation: new tests listed in the Spec | this run | see the Validated by column | below |
| Prior Work: `model.sh family claude <slot>` prints the family alias | pre-existing | `codex/model.sh:331-338` | `codex/test/run.sh` "inherited sub-lead has Claude family" |

## Deviations from plan

- The Claude alias list includes `fable` as well as haiku, sonnet and opus, because `model.sh family claude` already prints it and the Agent tool accepts it.
- The Settings page's prompt preview (`GET /settings/prompt`, `fullPrompt`) shows no scout block: it has no provider to resolve one for. The block is added only at session start.
- The `tricky` marker goes in the Objective cell of the Implementation Tasks row (T3's choice; the Spec did not name a cell).
- In lead.md the scout section is its own heading between steps 2 (Ideation) and 3 (Mapping).

## Routers

- `codex/AGENTS.md`: the `model.sh` row now names the sub-lead cell.
- `viewer/app/API.md`: documents the `sub-lead` slot, slot resolution for sub-leads, `other_agents.scout` and `"scout-heavy"`, and the scout lines in lead and sub-lead role layers.
- No ownership moved; no other router named a changed file.

## Validation evidence

Run by the sub-lead on the feature branch after all three merges (commit 74cc769, plus this report):

```text
$ bash codex/test/run.sh | tail -1
RESULT 101 passed, 0 failed

$ bash machine/test/run.sh
# pass 114
# fail 0

$ node --test viewer/test/*.test.js
not ok 339 - a starter that loses the freed port registers through the new holder
# pass 471
# fail 1

$ npm --prefix viewer run test:browser   (run at 21:26 PST)
  6 failed   [chromium, firefox] app-accounts.spec.js:519, :527, :534 › lead waiting line
  2 skipped
  636 passed (2.7m)

$ npx playwright test test/app-settings.spec.js
  46 passed (19.6s)

$ node --test viewer/test/protocol-rules.test.js
# pass 15
# fail 0
```

The failures are pre-existing and unrelated:
- `lifecycle.test.js` "a starter that loses the freed port registers through the new holder" fails the same way on the feature branch before any T1 change (checked by the sub-lead).
- The six `app-accounts.spec.js` "lead waiting line" failures depend on the clock. They expect `about <digit>` for a time three hours ahead and get `about Tue 12:20 AM` when that time is past midnight. None of the touched files are involved.

## Known gaps / residual risks

- Whether a CLI actually runs its helper on the scout model is untested live (Accepted Risks).
- The diff-check rule applies to future threads; this build ran under the old rule.
- The two pre-existing failures above remain.

## Remediation rounds
