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
| 17 | A verification attempt whose gaps are all rare is a PASS in every mode; rare gaps never reach the all-deferred re-check or Collin's fix-or-finish choice | Supersedes the exit part of decision 16; keeps rare paths away from Collin | review-round-2 |
| 18 | realism.md is loaded through its own list, not the card-file lists; reviewer/verifier headers unchanged | It is not a card file | review-round-2 |
| 19 | The lead judges GAP and RISK lines alike for its own verifiers before acting | An old or unsure verifier may report a rare path as GAP | review-round-2 |
| 20 | Pending pull-backs count during triage; applying a pull-back removes a matching Accepted Risks row | Keeps an accepted risk from hiding a pulled-back item | review-round-2 |
| 21 | Surviving-gap escalation covers every gap still requiring a fix | Always-fixed and pulled-back gaps can be on rare paths | review-round-2 |
| 22 | The lead gives no "accept as rare" answer at step 4a; rare judgment is the sub-lead's, before step 4a, asking the lead when unsure | Removes a second route into step 4a's exits | review-round-3 |
| 23 | BLOCKED verifier reports are handled as today and never judged as lines | A BLOCKED report has no lines; it must not read as a pass | review-round-3 |
| 24 | An attempt's outcome is decided on the merged lines of all its verifiers after rare judgment | Avoids one verifier passing while another fails | review-round-3 |
| 25 | The always-fixed list governs what agents may accept without asking; it does not remove Collin's existing choices on a gap that survives two fixes | Collin owns the decision; IDEA.md only says the bar does not class these as rare | review-round-3 |
| 26 | Add "check once built": a review finding that only the built code can settle is noted for verification instead of reworking the plan | Collin asked for it in chat after seeing review loop on guesses about unwritten code | idea-change |

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

- `realism.md` is not a card file. Add a separate list beside `ROLE_CARDS` in
  `machine/service.js` and beside `ROLE_CARD_FILES` in `viewer/app/settings.js` naming the
  roles that get it: `lead`, `sub-lead`, `reviewer`, `verifier` (not worker, mapper). It is
  appended after the role file and before any card files, as `--- realism.md ---` in
  `composeRolePrompt` and `[full text of protocol/app/realism.md]` in `fullPrompt`. The
  header choice stays keyed on card files only, so reviewer and verifier keep "Your role
  rules are below" (`viewer/test/app-settings.test.js:92` stays as is).
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
  Accepted Risks, not Deferred. The lead's per-gap answers at step 4a stay defer or fix;
  rare judgment happens before step 4a (S6), where the sub-lead asks the lead when unsure.
- "Every gap is deferrable hardening" (the Fix them / Defer them choice) counts only
  Deferred hardening, never accepted rare gaps.
- Brief reviewers and verifiers with the Accepted Risks table (already true for
  reviewers; add for the sub-lead's verifier brief via S6).
- Small-fix, after-done and repair verifiers: a `VERDICT: BLOCKED` report is handled as
  today (fix the setup, start a fresh verifier) and is never judged here. For a PASS or FAIL
  report, before acting on the verdict, the lead judges every RISK and GAP line by `realism.md`. A RISK judged normal use or on the always-fixed
  list is a failed check; a GAP judged a rare path is not (with a one-line reason in the
  lead's reply). If no failing lines remain, the check passed. Rare lines are not acted on
  and no plan records them. A rare-only check never counts toward a retry, the repair
  budget or a question to Collin. The lead may mention a
  notable one in the done card `note`.
- Pulled-back items follow S1: never accepted as rare. A pull-back pending during a review
  round already counts during that round's triage. Applying a pull-back removes any
  Accepted Risks row about the same item; the item is then fixed like any Spec item.
- The surviving-gap question (a gap surviving two fixes) applies to every gap still
  requiring a fix: normal use, always-fixed or pulled-back. Never to a gap accepted as rare.

### S6. `protocol/app/sub-lead.md`

- Verifier briefs include the plan's Accepted Risks table.
- After every verifier of an attempt has reported (BLOCKED handled as today first), the
  sub-lead merges all verifiers' RISK and GAP lines into one list and judges each by
  `realism.md`. The attempt's outcome is decided on that merged list, not per verifier. A RISK
  judged normal use or on the always-fixed list becomes a GAP (the attempt is a FAIL).
  RISK lines judged rare, and any GAP the sub-lead judges a rare path by
  `realism.md` (with a one-line reason), are written to PLAN.md Accepted Risks with round
  `verification-N`, committed, and do not go to remediation or count toward the two-attempt
  rule. If no gap remains in the merged list, the attempt counts as PASS (step 4). When the sub-lead
  cannot tell, it asks the lead with a `message` (`asks: true`).
- Rare gaps are settled by the sub-lead before step 4a, in every mode, and never reach
  step 4a's list, the all-deferred re-check or Collin's "Fix them" / "Defer them and
  finish" choice. Step 4a's list marks the remaining gaps `hardening` or `must-fix` as
  today. If every gap of an attempt was accepted as rare, the attempt is a PASS (step 4).
  If some were rare and the rest deferred, step 4a runs as today on the deferred ones
  only. Accepted rare gaps never count toward the two-attempt rule.
- The build `result` summary names how many rare paths were accepted.

### S7. `protocol/templates/PLAN.md`

Accepted Risks table header: `| Risk | Why accepted | Round |` keeps its shape; the
explanatory text adds that rare paths per `protocol/app/realism.md` land here in every mode
with round `review-round-N` or `verification-N`.

### S8. Check once built

- **What it is** (defined in `realism.md`): a finding about how code not yet written might
  behave ("this could race if the poller is written like X"), where the Spec is clear and
  correct and only the built code can show whether the problem exists. A finding that the
  Spec itself is wrong, contradictory or leaves a worker needing to ask is not this; it is
  a normal finding.
- **Reviewer** (`reviewer.md`): such a finding starts its finding text with
  `Check once built:`; line format unchanged.
- **Lead triage** (`lead.md`): a finding the lead judges to be check-once-built (prefixed or
  not) gets the new verdict `check-once-built`, is added as one row to a new PLAN.md
  section `## Check Once Built` (`| # | What to check | Round |`), does not count in
  `found`/`fixed`, and does not block a clean round. Later rounds treat a listed item as
  settled, like Accepted Risks. Add the verdict to lead.md's verdict table and the template's
  Review Rounds note.
- **Verification** (`sub-lead.md`, `verifier.md`): the sub-lead's verifier brief includes the
  Check Once Built table; the verifier checks each row against the built code like a Spec
  item and reports a confirmed problem as a GAP, which then goes through the realism bar
  like any other gap.
- **Template** (`protocol/templates/PLAN.md`): add the `## Check Once Built` section after
  Accepted Risks, with one line saying what it holds.

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

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 1:** IDEA.md "Not doing" amended (decision 12); reviewer `PATH` field dropped for a `Rare path:` prefix, agents.js untouched (S3, decision 13); RISK lines judged by sub-lead/lead before accepting a verdict (S5, S6, decision 14); pull-backs never accepted as rare (S1, S5, decision 15); lighter-mode exit with rare-accepted gaps (S6, decision 16); S2 fallback lines, `assertFits` reference removed; validation grep widened.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Rare-only lighter-mode attempt reaches the fix-or-finish card | upheld | S6; decision 17 |
| intent | minor | Header switches when realism.md joins the card list | upheld | S2; decision 18 |
| mechanics | major | Same as intent major (duplicate) | upheld | S6; decision 17 |
| mechanics | blocking | Lead's own verifiers: GAP lines not judged | downgraded to major | A worker would have to ask, not build wrong; S5, decision 19 |
| mechanics | major | Pending pull-back vs accepted risk in same round | downgraded to minor | Needs a pull-back and a rare finding on the same item in one round; fixed anyway in one sentence; S5, decision 20 |
| mechanics | major | Surviving-gap escalation scope | upheld | S5; decision 21 |

### Round 3 — 2026-11-19

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 2:** rare-only attempts PASS in every mode and never reach the re-check or choice card (S5, S6, decision 17); realism.md loaded by its own list, headers unchanged (S2, decision 18); lead judges GAP and RISK lines for its own verifiers (S5, decision 19); pending pull-backs and accepted-risk rows (S5, decision 20); surviving-gap escalation scope (S5, decision 21).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Lead's 4a "accept as rare" reopens the exit problem | upheld | Dropped; S5, decision 22 |
| mechanics | blocking | Lead verifier BLOCKED report could read as a pass | downgraded to minor | lead.md's BLOCKED rule is explicit and unchanged; clarified anyway, S5, decision 23 |
| mechanics | major | Multi-verifier attempt stuck when one verifier's gaps are all rare | upheld | S6; decision 24 |
| mechanics | blocking | Collin could push a fix with a surviving always-fixed gap | declined | Collin owns that choice; the bar limits agents, not him (IDEA.md Not doing); decision 25 |

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
