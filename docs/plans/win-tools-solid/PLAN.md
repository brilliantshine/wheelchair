---
slug: win-tools-solid
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-22
---

# Make Windows tools solid

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

### Q1: How should a stop catch the programs a Windows tool starts?
- **Context:** A Windows tool often starts other Windows programs (`cmd /c npx ...` starts `node`, which is the real server). Today a stop ends only the direct child (`machine/lib/win-tool-proxy.js:53-64`), so those programs can keep writing past the final sync. The last full design (`9d5a5511:docs/plans/win-tool-gobetween/PLAN.md:206-256`, a PowerShell launcher putting the tool in a named Windows Job Object) drew three review rounds of findings before the user moved it out (D9 there).
- **Options:** (A) Job Object launcher: every descendant is tracked and ended; most complete, most moving parts. (B) Direct child only, plus wait until the Windows copy stops changing (a quiet period, bounded) before the final sync: no Windows launcher; a stray grandchild is not ended but its writes are waited out up to the limit. (C) Direct child only: simplest; grandchildren can still write after the sync.
- **Recommendation:** A. It is the only option that actually ends what the tool started; B leaves orphan servers running on Windows after every stop.

## Watch List

Things noticed that need looking into — not yet decisions for the user. Written down the
moment they're spotted so they can't be forgotten, surfaced to the user one line at a
time as they appear, and emptied before Stage 1 exits.

Each item ends up settled by the agent (noted in the Log), promoted to an Open Question,
promoted to a Constraint or Accepted Risk, or waved off by the user.

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|
| W1 | Idle read-end closure (IDEA item 4) | Which mechanism Node on Linux can use to see a closed reader on an idle stdout pipe (poll for POLLERR, a probe write, parent-process check); needs a local experiment before it can be specified | no | |
| W2 | Crashed or handoff-killed sessions (IDEA item 2) | Whether their go-betweens and tools actually exit when the CLI dies (stdin end) or are orphaned; decides whether the copy-wide gate also has to end leftovers | no | |

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | Mode is thorough | User's choice; this thread is the follow-up for win-tool-gobetween's Deferred items | user |
| D2 | Restart recovery follows the parent design: a durable per-session launch record (wrapped, copy key) in `win-sessions.json` written before tmux starts; on service start, every live wrapped session whose ready file is not `ready` gets a fresh attempt token and readying | Already reviewed in windows-bridge-solid (`5950541c^:docs/plans/windows-bridge-solid/PLAN.md:194-211`); no user-visible choice in it | defaulted |
| D3 | Every new wait is bounded: a stop, sweep or archive waits at most 15 s for Windows tools, then logs and goes ahead | IDEA constraint; matches the last reviewed design's 15 s `onStop` wait | defaulted |

## Spec

The settled design, grown as decisions land. Bar: a fresh agent with no conversation
history can implement from this section alone — behavior, boundaries, edge cases,
non-goals, and concrete validation commands.

A Mermaid diagram of the flow belongs here, added by Stage 2 at approval — not while the
Spec is still churning. See `protocol/diagrams.md`.

## Deferred

Optional; present only in the lighter modes.

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them. Rare paths per `protocol/app/realism.md` land here in every mode, with round
`review-round-N`, `verification-N` or `lead-check`.

| Risk | Why accepted | Round |
|------|--------------|-------|

## Check Once Built

Review findings only the built code can settle, per `protocol/app/realism.md`. Verifiers
check each row against the build; a listed row is settled for later review rounds and
stays as review history.

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — <date>

**Lanes:** <family / model>; <family / model>; cross-family: <yes|no>.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`check-once-built`/`user-decision`) is what gates the
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
