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
- The composed role instructions must stay under the existing size check in
  `viewer/app/settings.js` `assertFits`.

### S3. `protocol/app/reviewer.md`

- Add the optional field: `SEVERITY: <s> — LENS: <l> — PATH: rare — <finding> — <evidence>`.
  Omit `PATH` for normal-use findings (old form stays valid). Severity rules unchanged.
- Say: apply the bar in `realism.md`; a rare-path finding gets one line, tagged, and its
  severity is still the worker consequence.
- Accepted Risks already settles findings; add that a rare path already listed there or
  a variant of the same rare path is not raised again.
- `viewer/app/agents.js` reviewer report parse: skip a `PATH: …` field when picking the
  finding text for the Agents screen, so `first` shows the finding, not `PATH: rare`.
  Add a test in the existing agents/viewer test file.

### S4. `protocol/app/verifier.md`

- Accepted Risks items are out of scope, like Deferred.
- New line form after GAP lines: `RISK: <spec item> — <rare path> — <evidence>`.
  A report whose only problems are RISK lines is `VERDICT: PASS` followed by its RISK
  lines. RISK lines never appear in steps-only reports.
- Anything on the "always fixed" list is a GAP even if rare.

### S5. `protocol/app/lead.md`

- Review triage: a finding the lead judges a rare path (tagged or not) gets verdict
  `accepted-risk`, moves to Accepted Risks with the round, and is not counted in the
  progress `found`/`fixed`. A `PATH: rare` finding the lead judges normal use is triaged as
  usual. Never a `user-decision` for a rare path; ask Collin only when the lead cannot tell
  whether it is normal use.
- Lighter modes: "hardening" for Deferred means realistic hardening; rare paths go to
  Accepted Risks, not Deferred. Verification per-gap answers gain a third option,
  "accept as rare", recorded in Accepted Risks.
- Brief reviewers and verifiers with the Accepted Risks table (already true for
  reviewers; add for the sub-lead's verifier brief via S6).
- Small-fix, after-done and repair verifiers: RISK lines are read and not acted on; no plan
  records them. The lead may mention a notable one in the done card `note`.
- Surviving-gap question cards are only for normal-use gaps.

### S6. `protocol/app/sub-lead.md`

- Verifier briefs include the plan's Accepted Risks table.
- After each attempt: RISK lines, and any GAP the sub-lead judges a rare path by
  `realism.md` (with a one-line reason), are written to PLAN.md Accepted Risks with round
  `verification-N`, committed, and do not go to remediation or count toward the two-attempt
  rule. If every GAP was moved this way, the attempt counts as PASS. When the sub-lead
  cannot tell, it asks the lead with a `message` (`asks: true`).
- Step 4a's lighter-mode list marks gaps `hardening`, `must-fix` or `rare`; rare ones are
  saved as Accepted Risks, not Deferred.
- The build `result` summary names how many rare paths were accepted.

### S7. `protocol/templates/PLAN.md`

Accepted Risks table header: `| Risk | Why accepted | Round |` keeps its shape; the
explanatory text adds that rare paths per `protocol/app/realism.md` land here in every mode
with round `review-round-N` or `verification-N`.

### Non-goals

No change to severity meanings, the clean test, the review budget, cards, the approval
card, or Deferred card validation.

### Validation

```bash
node --test viewer/test/*.test.js
bash machine/test/run.sh
grep -n "realism.md" machine/service.js viewer/app/settings.js protocol/app/AGENTS.md
```

All pass; the grep shows the file in both role lists and the router.

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

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`user-decision`) is what gates the
exit. Downgrades and declines cite evidence.

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
