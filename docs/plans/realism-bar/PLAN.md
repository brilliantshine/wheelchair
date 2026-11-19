---
slug: realism-bar
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-19
---

# A realism bar for plan review and verification

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

## Watch List

Things noticed that need looking into — not yet decisions for the user. Written down the
moment they're spotted so they can't be forgotten, surfaced to the user one line at a
time as they appear, and emptied before Stage 1 exits.

Each item ends up settled by the agent (noted in the Log), promoted to an Open Question,
promoted to a Constraint or Accepted Risk, or waved off by the user.

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is thorough | Collin picked it | user |
| 2 | Normal use means a healthy machine, ordinary user actions, and input the real tool actually produces. A plain restart, a killed session or a closed browser tab is normal use. Rare paths: a crash or restart combined with lost or corrupted state files, sub-second races between two actors, files swapped or edited mid-operation, tampering by a local user or agent, malformed input the source never writes, unusual screen layouts | Follows Collin's Kimi Code decision 59 (wc/01b8cb1bf051:docs/plans/kimi-code/PLAN.md) | defaulted |
| 3 | Always fixed regardless of how rare: security or secret leaks, permission bypass, building the wrong thing, anything a Spec validation command checks, and silent loss of Collin's work in normal use | IDEA.md Not doing; Collin's memory rules on leaks and wrong builds | defaulted |
| 4 | When the lead cannot tell whether a finding is normal use, it asks Collin with a question card; otherwise it decides without asking | IDEA.md What good looks like | defaulted |
| 5 | The clean test and review budget are unchanged: an accepted-risk finding already does not block a clean round | lead.md clean test counts only upheld blocking/major and open user-decisions | defaulted |
| 6 | Rare-path findings are still reported, marked rare; the lead records each in Accepted Risks without asking Collin, and later rounds treat them as settled | Collin picked "Record it, don't ask": the record is what stops re-raising | user |
| 7 | Rare paths go to Accepted Risks in every mode; Deferred keeps realistic hardening only | Collin picked "Accepted risks": a follow-up thread would otherwise repeat the loop | user |
| 8 | The definition lives once, in a new `protocol/app/realism.md`, loaded into the starting instructions of lead, sub-lead, reviewer and verifier by the same mechanism that loads card files | protocol/app/AGENTS.md "A rule lives in one file"; reviewers and verifiers get no card files today | defaulted |
| 9 | Reviewers mark rare findings with a `PATH: rare` field after LENS; verifiers report rare paths as `RISK:` lines that do not by themselves make the verdict FAIL | Keeps the old line forms valid; a RISK line never starts remediation | defaulted |
| 10 | Rare-path findings are not counted in the review progress line's found/fixed, like declined findings | The line should show real work only | defaulted |
| 11 | When unsure whether a path is normal use, reviewers and verifiers report it as normal (no PATH tag, a GAP line); the lead or sub-lead may reclassify with a reason | Errs toward checking; the classifier with the plan in hand decides | defaulted |
| 12 | IDEA.md "Not doing" amended: lighter modes send rare paths to Accepted Risks instead of Deferred | Collin's answer to the two-part question was this exact change; review round 1 found IDEA.md not updated | idea-change |
| 13 | No `PATH` field: a rare finding starts its finding text with `Rare path:`; the reviewer line format and the Agents-screen parser stay as they are | The tag was only a hint the lead re-judges anyway | review-round-1 |
| 14 | A verifier's `RISK:` label is a claim, not a verdict: the sub-lead (or lead for its own verifiers) judges every RISK and GAP line against realism.md; a RISK judged normal use or on the always-fixed list is handled as a GAP | A mislabelled regression must not pass | review-round-1 |
| 15 | Pull-backs win: a finding or gap about a pulled-back item is never accepted as rare; fix it or ask Collin, as today | Collin explicitly pulled it into the Spec | review-round-1 |
| 16 | Gaps accepted as rare count like deferred gaps for the lighter-mode exit and the all-deferred re-check | Gives the attempt a defined exit | review-round-1 |

## Spec

Protocol and prompt-composition change. No new cards, no UI.

### S1. `protocol/app/realism.md` (new)

One short section, the single source of the bar:

- **Normal use**: a healthy machine, ordinary actions by Collin and the agents, and input
  the real tool or service actually produces. A plain restart, a killed or crashed session,
  a closed browser tab, a network drop, two threads running at once are normal use.
- **Rare path**: needs two unlikely things together, or something that does not happen in
  ordinary running. Examples: a crash or restart that also loses or corrupts state files;
  races inside a sub-second window between two actors; files swapped or edited
  mid-operation; tampering by a local user or agent; malformed input the source never
  writes; unusual screen layouts or versions the tool does not ship.
- **Always fixed, however rare**: secret or token leaks, permission or sandbox bypass,
  building the wrong thing, anything a Spec validation command checks, silent loss of
  Collin's work in normal use.
- **Unsure**: treat as normal use (report it as a normal finding or GAP) and say why it
  might be rare; the lead (review) or sub-lead (verification) decides.
- **Pulled-back items**: a finding or gap about an item Collin pulled back from Deferred
  is never treated as a rare path; it is fixed, or Collin is asked, as `lead.md` says.
- **What happens to a rare path**: reported once, recorded in the plan's Accepted Risks
  without asking Collin, never fixed in this thread, never moved to Deferred, never
  re-raised. Applies in every mode.

### S2. Loading it

- `machine/service.js` `ROLE_CARDS` and `viewer/app/settings.js` `ROLE_CARD_FILES` add
  `realism.md` for `lead`, `sub-lead`, `reviewer`, `verifier` (not worker, mapper). The
  header wording for reviewer/verifier changes to the "role rules and card rules" form only
  if needed for consistency; the existing "role rules" header may stay.
- Rename nothing else. Update `machine/test/service.test.js`,
  `viewer/test/app-settings.test.js`, and `viewer/test/protocol-rules.test.js` expectations
  (if any assert the file list). `protocol/app/AGENTS.md` table gains a row for
  `realism.md` and its "Reviewer and verifier get neither card file" sentence stays true.
- The direct-read fallback line near the top of `lead.md`, `sub-lead.md`, `reviewer.md` and
  `verifier.md` ("If you opened … by its path") also tells the reader to read `realism.md`
  beside it.
- No new size check; `assertFits` measures only the Settings layers and is not involved.

### S3. `protocol/app/reviewer.md`

- Line format unchanged. A rare-path finding starts its finding text with `Rare path:`
  (e.g. `SEVERITY: minor — LENS: mechanics — Rare path: … — <evidence>`); its severity is
  still the worker consequence. `viewer/app/agents.js` is not changed.
- Say: apply the bar in `realism.md`; give a rare path one line.
- A rare path already in Accepted Risks, or a variant of one, is not raised again.

### S4. `protocol/app/verifier.md`

- Accepted Risks items are out of scope, like Deferred.
- New line form after GAP lines: `RISK: <spec item> — <rare path> — <evidence>`.
  A report whose only problems are RISK lines is `VERDICT: PASS` followed by its RISK
  lines. RISK lines never appear in steps-only reports.
- Anything on the "always fixed" list is a GAP even if rare.

### S5. `protocol/app/lead.md`

- Review triage: a finding the lead judges a rare path (whether or not it starts
  `Rare path:`) gets verdict
  `accepted-risk`, moves to Accepted Risks with the round, and is not counted in the
  progress `found`/`fixed`. A `Rare path:` finding the lead judges normal use is triaged as
  usual. Never a `user-decision` for a rare path; ask Collin only when the lead cannot tell
  whether it is normal use.
- Lighter modes: "hardening" for Deferred means realistic hardening; rare paths go to
  Accepted Risks, not Deferred. Verification per-gap answers gain a third option,
  "accept as rare", recorded in Accepted Risks.
- Brief reviewers and verifiers with the Accepted Risks table (already true for
  reviewers; add for the sub-lead's verifier brief via S6).
- Small-fix, after-done and repair verifiers: the lead judges each RISK line by
  `realism.md`. One judged normal use or on the always-fixed list is handled as a failed
  check (GAP); the rest are not acted on and no plan records them. The lead may mention a
  notable one in the done card `note`.
- Pulled-back items follow S1: never accepted as rare.
- Surviving-gap question cards are only for normal-use gaps.

### S6. `protocol/app/sub-lead.md`

- Verifier briefs include the plan's Accepted Risks table.
- After each attempt the sub-lead judges every RISK and GAP line by `realism.md`. A RISK
  judged normal use or on the always-fixed list becomes a GAP (the attempt is a FAIL).
  RISK lines judged rare, and any GAP the sub-lead judges a rare path by
  `realism.md` (with a one-line reason), are written to PLAN.md Accepted Risks with round
  `verification-N`, committed, and do not go to remediation or count toward the two-attempt
  rule. If every GAP was moved this way, the attempt counts as PASS. When the sub-lead
  cannot tell, it asks the lead with a `message` (`asks: true`).
- Step 4a's lighter-mode list marks gaps `hardening`, `must-fix` or `rare`; rare ones are
  saved as Accepted Risks, not Deferred. For step 4a's exits, a gap accepted as rare counts
  like a deferred gap: if no gaps remain after saving deferred rows and accepted risks, the
  all-deferred re-check (or, once used, Collin's "Fix them" / "Defer them and finish"
  choice) applies exactly as it does today for all-deferred gaps. Accepted rare gaps
  never count toward the two-attempt rule.
- The build `result` summary names how many rare paths were accepted.

### S7. `protocol/templates/PLAN.md`

Accepted Risks table header: `| Risk | Why accepted | Round |` keeps its shape; the
explanatory text adds that rare paths per `protocol/app/realism.md` land here in every mode
with round `review-round-N` or `verification-N`.

### Non-goals

No change to severity meanings, the reviewer line format, `viewer/app/agents.js`, the clean test, the review budget, cards, the approval
card, or Deferred card validation.

### Validation

```bash
node --test viewer/test/*.test.js
bash machine/test/run.sh
grep -n "realism.md" machine/service.js viewer/app/settings.js protocol/app/AGENTS.md protocol/app/lead.md protocol/app/sub-lead.md protocol/app/reviewer.md protocol/app/verifier.md
```

Both suites pass; the grep shows the file in both role lists, the router and each of the
four role files.

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them.

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-19

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Spec contradicts IDEA "Not doing" on lighter-mode deferral | upheld | IDEA amended; decision 12 |
| intent | minor | `PATH` field costs a parser change for a hint the lead re-judges | upheld | Dropped; `Rare path:` prefix; decision 13 |
| mechanics | blocking | Verifier `RISK:` label bypasses triage | upheld | S5, S6; decision 14 |
| mechanics | major | Lighter-mode exit undefined when gaps are accepted as rare | upheld | S6; decision 16 |
| mechanics | major | Pull-back precedence unresolved | upheld | S1, S5; decision 15 |
| mechanics | minor | `assertFits` does not measure protocol files | upheld | S2 reference removed |
| mechanics | minor | Direct-read fallback skips realism.md | upheld | S2 fallback lines |

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`user-decision`) is what gates the
exit. Downgrades and declines cite evidence.

### Round 2 — 2026-11-19

**Lanes:** pending.

**Changed since Round 1:** IDEA.md "Not doing" amended (decision 12); reviewer `PATH` field dropped for a `Rare path:` prefix, agents.js untouched (S3, decision 13); RISK lines judged by sub-lead/lead before accepting a verdict (S5, S6, decision 14); pull-backs never accepted as rare (S1, S5, decision 15); lighter-mode exit with rare-accepted gaps (S6, decision 16); S2 fallback lines, `assertFits` reference removed; validation grep widened.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

Parts of the Spec already built before this plan reached Stage 3 — adopted from outside
with work already done, or left behind by an implementation run that died partway.

Stage 3 does not re-implement `pre-existing` items and does not touch their code. Stage 4
verifies them exactly as rigorously as everything else: this code has never been through
the gate, so skipping it would leave the least-trustworthy part of the change as the only
part nobody checked.

Ambiguous evidence means **not done**. A wrong "done" is a silent hole; a wrong "not done"
costs a worker one look.

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|
|           | pre-existing / partial | | high / low |

`partial` items are implemented by Stage 3 — the brief names what exists so the worker
completes it instead of restarting it.

## Implementation Tasks

Filled by Stage 3. One row per worker brief.

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

Session id = the `thread_id` of a `codex exec` lane, so remediation can resume it.

## Log

Free-form running notes: deviations discovered mid-implementation, scope events,
anything a future session needs that fits nowhere above.
