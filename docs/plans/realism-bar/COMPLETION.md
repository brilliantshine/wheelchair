---
slug: realism-bar
date: 2026-11-19
implemented-by: "T1 standard (claude-sonnet-5-5); T1b light (gpt-6-luna); T2 light (gpt-6-luna)"
verified-by: []   # Stage 4 appends; Stage 3 leaves this empty. Shape below.
---

# Completion Report — A realism bar for plan review and verification

Written for a hostile reviewer: every claim checkable, no claim without evidence.
Line numbers are against commit `08250a2` (feature branch `wc/ac6641ae7c16`).

```yaml
verified-by:
  - round: <n>
    lane: <verifier lane/model>
    checks: <the implementing lane it checked>
```

## Spec coverage

All rows are `this run`; Prior Work was empty.

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 realism.md: normal use, rare path, always fixed, unsure, pulled-back, what happens to a rare path | this run | `protocol/app/realism.md:1-23` (28 lines total) | read; `protocol-rules` fallback test needs the file named |
| S2 separate list, lead/sub-lead/reviewer/verifier, after role file before cards — machine | this run | `machine/service.js:146`, `:154`; header still keyed on cards `:153` | `machine/test/service.test.js:870-876` (inclusion, content, order before `cards.md`; worker/mapper excluded) |
| S2 same — Settings preview | this run | `viewer/app/settings.js:22`, `:182`; header unchanged | `viewer/test/app-settings.test.js:82` (lead order), `:94` (reviewer), `:99` (worker excluded); reviewer header assert `:92` unchanged |
| S2 fallback lines in four role files | this run | `protocol/app/lead.md:8`, `sub-lead.md:9`, `reviewer.md:7`, `verifier.md:9` | `viewer/test/protocol-rules.test.js:60` |
| S2 router row; "neither card file" stays | this run | `protocol/app/AGENTS.md:3`, `:17` | grep below |
| S3 reviewer: `Rare path:` prefix, apply the bar, one line, settled rare paths and variants not re-raised | this run | `protocol/app/reviewer.md:54-57`, `:60-63` | read |
| S4 verifier: Accepted Risks out of scope; `GAP: … — Rare path:`; any GAP is FAIL; never on always-fixed list | this run | `protocol/app/verifier.md:31`, `:113-115` | read |
| S5 review triage: rare → `accepted-risk`, not counted, never `user-decision` | this run | `protocol/app/lead.md:304`, `:320`, `:326-329` | read |
| S5 lighter modes: Deferred is realistic hardening; always-fixed never deferrable; "every gap deferrable" counts Deferred only | this run | `protocol/app/lead.md:404-407`, `:412` | read |
| S5 lead's own verifiers: BLOCKED as today, judge GAPs, drop rare, `lead-check` record commit, no re-verification, no retry/budget/question | this run | `protocol/app/lead.md:103-110` | read |
| S5 pull-backs never rare; pending counts; applying removes Accepted Risks row; then fixed like a Spec item | this run | `protocol/app/lead.md:251-253` | read |
| S5 surviving-gap question covers every gap still requiring a fix | this run | `protocol/app/lead.md:400-402` | read |
| S6 verifier brief includes Accepted Risks and Check Once Built tables | this run | `protocol/app/sub-lead.md:233` | read |
| S6 merge all verifiers' GAPs, judge, record `verification-N`, commit (no re-verification), outcome on merged list, ask lead when unsure | this run | `protocol/app/sub-lead.md:241-247` | read |
| S6 PASS on empty merged list; step 4a trigger; always-fixed must-fix, never deferrable | this run | `protocol/app/sub-lead.md:248`, `:252`, `:255-257` | read |
| S6 rare gaps not counted in verify found/fixed | this run | `protocol/app/sub-lead.md:274-276` | read |
| S6 build result names rare-path count | this run | `protocol/app/sub-lead.md:291` | read |
| S7 template Accepted Risks text with three round labels | this run | `protocol/templates/PLAN.md:63-65` | read |
| S8 definition | this run | `protocol/app/realism.md:24-28` | read |
| S8 reviewer `Check once built:` prefix; settled sentence names `check-once-built` and the section | this run | `protocol/app/reviewer.md:54-57`, `:62-63` | read |
| S8 lead verdict `check-once-built`, Check Once Built section, not counted, does not block | this run | `protocol/app/lead.md:305`, `:320` | read |
| S8 verifier checks rows, `GAP: Check once built #<n>`, Accepted Risks/Deferred win | this run | `protocol/app/verifier.md:117-120` | read |
| S8 template section after Accepted Risks; verdict note; row stays as history | this run | `protocol/templates/PLAN.md:70-77`, `:97` | read |
| Non-goals: no change to `viewer/app/agents.js`, reviewer line format, cards, clean test, budget | this run | `git diff 770ea1c..08250a2 --stat` touches none of `viewer/app/agents.js`, `viewer/app/card.js`, `protocol/app/cards*.md` | stat below |

## Deviations from plan

- Never-deferrable sentences (`lead.md:404-407`, `sub-lead.md:255-257`) name "any gap on the
  always-fixed list in `realism.md`" rather than repeating the list, so the list lives in one file.
- `realism.md` adds two short framing sentences: "It applies in every plan mode." and
  "Problems in normal use are fixed."
- `reviewer.md` holds the bar under its own `## The realism bar` heading.
- Wording fixes after review are in T1b; every worker choice is logged in PLAN.md Log.

## Routers

`protocol/app/AGENTS.md`: the opening paragraph now says the machine also puts `realism.md`
into the lead, sub-lead, reviewer and verifier starting instructions; the file table has a
`realism.md` row (`:3`, `:17`). "Reviewer and verifier get neither card file." is unchanged.
No ownership moved; the root, `machine/` and `viewer/` routers name no file list this changed.

## Validation evidence

Run by the sub-lead on the merged feature branch at `08250a2`:

```
$ node --test viewer/test/*.test.js
# tests 685
# pass 685
# fail 0

$ bash machine/test/run.sh        # exit 0
# tests 345
# pass 345
# fail 0

$ grep -n "realism.md" machine/service.js viewer/app/settings.js protocol/app/AGENTS.md protocol/app/lead.md protocol/app/sub-lead.md protocol/app/reviewer.md protocol/app/verifier.md
machine/service.js:154:  if (ROLE_REALISM.has(input.role)) parts.push(`--- realism.md ---\n${read('realism.md')}`);
viewer/app/settings.js:182:  const files = [`[full text of protocol/app/${role}.md]`, ...(ROLE_REALISM.has(role) ? ['[full text of protocol/app/realism.md]'] : []), ...ROLE_CARD_FILES[role].map((file) => `[full text of protocol/app/${file}]`)];
protocol/app/AGENTS.md:3:  ... and for the lead, sub-lead, reviewer and verifier `realism.md`, into each session's starting instructions ...
protocol/app/AGENTS.md:17:| `realism.md` | lead, sub-lead, reviewer, verifier | The realism bar: ...
protocol/app/lead.md:8, :104, :251, :304, :305, :407
protocol/app/sub-lead.md:9, :242, :256
protocol/app/reviewer.md:7, :61
protocol/app/verifier.md:9, :113
```

The grep shows `realism.md` in both role lists (the `settings.js` line and the `service.js`
push read the `ROLE_REALISM` sets at `:22` and `:146`), the router and all four role files.

## Known gaps / residual risks

- Protocol text has no behavioural test suite (AGENTS.md: "There is no protocol document test
  suite"); S3–S8 are checked by reading, not by a run.
- A few re-wrapped prose lines in `lead.md` (~320-323, ~406-409) and `sub-lead.md` (~248-251)
  break unevenly. Cosmetic.
- `realism.md` adds 28 lines to four roles' starting instructions every session.

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.

### Remediation 1 — 2026-11-19

Attempt 1 (claude-opus-5-5, gpt-6.2-sol on `648d1d3`): FAIL, 3 distinct gaps, all judged normal
use (no rare paths). See `REMEDIATION-1.md`. Fixed by R1 (light, claude-haiku-5-5):

| Gap | Fix at |
|-----|--------|
| `RE-RAISE:` evidence exception lost (T1b brief text) | `protocol/app/reviewer.md:54-59` |
| Review `fixed` could exceed `found` for rare Accepted Risks | `protocol/app/lead.md:319-322` |
| Lighter-mode plan review sent rare hardening to Deferred | `protocol/app/lead.md:286-288` |

Validation after the merge: `node --test viewer/test/*.test.js` 685 pass, 0 fail;
`bash machine/test/run.sh` exit 0, 345 pass, 0 fail; the Validation grep matches all seven files.
