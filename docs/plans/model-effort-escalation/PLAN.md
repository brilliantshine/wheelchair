---
slug: model-effort-escalation
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# Effort and escalation rules in Settings

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows. How the code works today: `MAP.md`.

## Open Questions

### Q1: Are the four escalation switches the right set?
- **Context:** IDEA.md says "a few switches", including effort. Proposed to Collin in chat:
  (1) what steps up first, effort or model; (2) highest effort; (3) highest tier;
  (4) ask me before: never / before Critical / before any step. Left out: number of failed
  tries before stepping up (stays one).
- **Options:** the four as proposed; drop "ask me"; add failed-tries count.
- **Recommendation:** the four as proposed.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Escalation in Settings: plain-words explanation plus a few switches, not a full editor | Collin picked "Show, plus a few switches" | user |
| 2 | Escalation switches cover effort as well as model | Collin: "include model effort as well in escalation settings" | idea-change (folded into IDEA.md before confirmation) |
| 3 | Every model cell in Settings gets an effort select: Claude and GPT tiers, and both providers' lead slot | IDEA "What good looks like" bullet 1; store, API and `sessions.js:33` already support the lead slot (MAP.md) | defaulted |
| 4 | GPT efforts offered: `low medium high xhigh` (no `max`, which Codex's `model_reasoning_effort` does not take); Claude keeps `low medium high xhigh max`. Unset stays "CLI default" for both | Matches each CLI's own value set; unset keeps today's behavior for anyone who never touches it | defaulted |
| 5 | Codex sessions get effort as `-c model_reasoning_effort=<e>` in `machine/service.js` argv, only when set | Same flag `protocol/lanes.md:43` already uses for terminal lanes; `codex exec --help` (0.169.0) confirms `-c key=value` | defaulted |
| 6 | Escalation steps: with "effort first", effort climbs one level at a time to the ceiling at the current tier, then the tier moves up one rung and starts at that tier's pinned effort, and so on up to the highest tier; with "model first", the tier climbs to the ceiling at pinned effort, then effort climbs at the top tier. Unset effort counts as `high` for stepping. Each step still comes after a brief rewrite and in a fresh session; one failed try per step | Keeps today's "rewrite brief first, fresh session, one rung at a time" (`sub-lead.md:122-132`) and gives the switches a definite meaning | defaulted |
| 7 | Switches live in hub `settings.json` under `escalation`; the hub renders them into plain sentences that (a) the Settings page shows and (b) go into the sub-lead's role layers. `protocol/app/sub-lead.md` "Escalation" section is rewritten to defer to those sentences and include the effort rung | One source (IDEA constraint); reuses the existing role-layers path (MAP.md "How Settings content reaches agents") | defaulted |
| 8 | `wc.js session start` gains `--effort <e>`; the hub accepts it for worker starts only, and refuses (with the reason) a worker start above the highest tier or highest effort switch | Without it the app sub-lead cannot raise effort at all (MAP.md "Things that do not line up"); enforcing the ceilings in the hub makes the limits real, not advice | defaulted |
| 9 | "Ask me before …" travels as today's escalation path for questions: sub-lead sends the lead a `message`, the lead posts a `question` card (step up / stop and report the task as blocked) | `lead.md` step 7 already routes sub-lead questions this way; no new card kind | defaulted |
| 10 | Terminal workflow (`protocol/lanes.md`, `implementation.md`, `verification.md`) unchanged | IDEA "Not doing" | defaulted |

## Spec

Draft; grows as decisions land.

### Effort in Settings
- Tiers table: every cell, Claude and GPT, has model select + effort select ("CLI default" + the provider's list, Decision 4). Effort select disabled when the cell is "Not used".
- Leads row: same pair for both providers.
- `codex/model.sh`: parser and writer accept `@effort` on `gpt.*` lines with the GPT list; `effort gpt <slot>` prints it.
- `PUT /settings/models` accepts `effort` for `gpt` (`viewer/app/routes.js:57`), validated per provider.
- `viewer/app/sessions.js resolveModel` reads effort for both providers; `machine/service.js` adds `-c model_reasoning_effort=<e>` to the codex argv when set (Decision 5).

### Escalation switches
- Stored: `settings.json` `escalation: { first: "effort"|"model", max_effort, max_tier: "standard"|"heavy"|"critical", ask_before: "never"|"critical"|"any" }`. Defaults: `effort`, `xhigh`, `critical`, `critical`.
- Settings page: a new "Escalation" section with the plain-words rendering at top and the switches below; changes save immediately like the other preferences and apply to sub-leads started afterwards.
- Behavior: Decision 6, enforced per Decision 8, asking per Decision 9.

### Non-goals
- No full rules editor; no change to terminal lanes; running sessions keep what they started with.

### Validation
- To be written at the final pass.

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them.

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — <date>

**Lanes:** <family / model>; <family / model>; cross-family: <yes|no>.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most. `protocol/plan-review.md` shows a filled example.

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
