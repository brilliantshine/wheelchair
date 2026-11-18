---
slug: plan-modes
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-17
---

# Plan modes: thorough, two-part, proof of concept

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

None.

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
|   |          |           | user / defaulted / adopted / idea-change / review-round-N |
| D1 | The lead suggests a mode with a one-line reason when a thread becomes a feature; Collin accepts it or picks another | The lead has read the request and can tell a proof of concept from lasting work; Collin keeps the final say | user |
| D2 | In two-part and proof-of-concept, plan review still runs. Findings that would build the wrong thing or cannot be built must be fixed; findings that only make it sturdier are deferred to the follow-up plan (two-part) or accepted as risks (proof of concept) | Keeps the check that stops a wrong build, drops only the hardening Collin chose to postpone | user |
| D3 | Deferred items show on a pinned running list, like "Your idea so far", updated as items are added in planning or review. Removing one pulls it back into the first build | Collin sees deferrals as they happen and can reverse one with a press, without a card per item | user |
| D4 | The follow-up plan is a head start: this thread hands over the deferred items with notes, and the new thread plans them with its own questions and full review | Planning it fully here would slow the first build; it plans better against built code | user |
| D5 | The mode can change during planning when Collin asks. Moving to thorough pulls every deferred item back into the Spec; moving to a lighter mode lets the lead sort Spec items into deferred. Once building starts, the mode is fixed | Obvious behaviour; locking it only at build start keeps the build's scope stable | defaulted |
| D6 | The follow-up thread's lead suggests its mode like any feature (D1) | Same rule everywhere | defaulted |
| D7 | A gap found in verification that is not needed for the feature to work may be deferred by the lead (two-part: to the follow-up; proof of concept: to Accepted Risks) and added to the running list; a gap that stops it working is fixed as today | Matches IDEA.md: verification unchanged, big extras may land in the follow-up | defaulted |
| D8 | In proof of concept, the done card's "left as is" lists the accepted risks, each with the usual "Start a thread about it" | Collin can still pick one up later without a follow-up plan existing | defaulted |
| D9 | The mode suggestion is an ordinary `question` card posted right after the offer is accepted; no change to the offer card | Uses an existing card with no app change; settles watch item W1 | defaulted |
| D10 | The mode is recorded as `mode:` in IDEA.md's frontmatter. Changing it (D5) is not a scope change | IDEA.md exists from the start of planning, every role already reads it, and a restarted lead recovers it from the file with no app storage | defaulted |
| D11 | Deferred items live in one `## Deferred` section of PLAN.md in both lighter modes. In proof-of-concept that section is the record of accepted hardening risks (refines D2's "Accepted Risks"); Accepted Risks keeps its existing meaning | One place for the running list, the reviewers, the verifier and the handoff to read | defaulted |
| D12 | The two-part follow-up thread is an ordinary `stub` card posted at done, `depends_on_parent: true`, whose summary carries the Deferred items and links to this plan and pull request. No second plan directory | Avoids the app's one-new-plan-directory slug rule and document allowlist (MAP.md); a head start (D4) needs only the list | defaulted |
| D13 | The running list is a new lead-only card kind, `deferred`, pinned like `idea` | The idea card is already pinned for a different list; a second kind keeps both visible | defaulted |
| D14 | In a lighter mode, a review finding moved to Deferred does not keep a round from being clean | Otherwise each round's new hardening findings would keep review running as long as thorough, defeating "a working build sooner" | review-round-1 |

## Spec

The settled design, grown as decisions land. Bar: a fresh agent with no conversation
history can implement from this section alone — behavior, boundaries, edge cases,
non-goals, and concrete validation commands.

A Mermaid diagram of the flow belongs here, added by Stage 2 at approval — not while the
Spec is still churning. See `protocol/diagrams.md`.

### Modes

Three modes, recorded as `mode:` in IDEA.md's frontmatter (D10):

| Mode | Plan | Hardening found in planning, review or verification | When done |
|---|---|---|---|
| `thorough` | As today, unchanged | Fixed in the Spec as today | As today |
| `two-part` | Covers what the feature needs to work | Moved to PLAN.md `## Deferred` | A stub thread holds the Deferred list as a head start |
| `proof-of-concept` | Same as two-part | Moved to PLAN.md `## Deferred`, which is the accepted-risk record | Done card lists the Deferred items under "left as is" |

A missing or unknown `mode:` means `thorough`. Small fixes have no plan and no mode.

"Hardening" means anything not needed for the feature to work for its normal use: edge
cases, unusual inputs, error handling beyond the obvious, polish, extra tests beyond the
Spec's validation commands. Anything that would build the wrong thing, or that the
feature cannot work without, is never deferred.

### Choosing the mode (lead.md step 2)

Right after the offer is accepted (or the thread becomes a feature by Collin talking on),
the lead posts a `question` card (D9): "How thorough should the plan be?", options
Thorough / Two-part / Proof of concept, each `consequence` in plain words, `leaning` set to
the lead's suggestion, `why` a one-line reason (D1). The lead does not post the IDEA.md
confirmation card until the mode is answered. It writes `mode:` into IDEA.md when it writes
IDEA.md (default `thorough` if the card was never answered, for example on a restart with
no answer recorded).

### Changing the mode (D5)

While PLAN.md `status:` is `planning`, `ready-for-review` or `approved`, Collin may ask in
chat to change the mode. The lead edits `mode:` in IDEA.md (not a scope change; no
Decision Log `idea-change` entry, a `user` entry instead) and:
- to `thorough`: moves every Deferred item back into the Spec, deletes the section, and
  retracts nothing (the `deferred` card is reposted empty, see below);
- from `thorough` to a lighter mode: may move Spec items to Deferred, each announced in
  its reply and shown on the `deferred` card;
- between the two lighter modes: the Deferred section stays; only its meaning changes.
A change after `approved` returns the plan to `ready-for-review` (step 5), as any Spec
change after approval does today. From `implementing` on, the mode is fixed; a request to
change it is answered with that.

### PLAN.md `## Deferred` (D11)

A section placed after Spec and before Accepted Risks, present only in the lighter modes.
One row per item:

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|

`Source` is `planning`, `review-round-N` or `verification`. `Notes` are what the
follow-up's lead will need (file:line, the case that breaks, the reviewer's evidence).
Pulling an item back deletes its row and folds it into the Spec, with a Decision Log entry.

### The `deferred` card (D3, D13)

New lead-only kind, pinned (one per thread, a new one replaces the old in the pin, like
`idea`).

| Field | Type | Required | Meaning |
|---|---|---|---|
| `mode` | `two-part` \| `proof-of-concept` | yes | Sets the heading |
| `bullets` | array of `{id, text}` | yes, may be empty | One per Deferred row; `id` stable (`d1`, `d2`), `text` short and in Collin's terms |
| `locked` | boolean | no | True once building starts: no remove buttons |

Shown heading: "Saved for the follow-up · N things" (two-part) or "Skipped for this proof
of concept · N things" (proof-of-concept); with zero bullets, the heading and "Nothing
deferred yet". Hint line under the heading: two-part "These go into a new thread when this
one is done."; proof-of-concept "These are accepted as risks; nothing will fix them
later.". Folding over three bullets, the remove button (`×`, aria-label "Pull back in"), and
its press form `[card <id>] removed: <bullet text>` work exactly as `idea`'s. With `locked`
true or the thread archived, no remove buttons. It stays pinned for the life of the thread
(unlike `idea`, it is not hidden once building starts), and is never shown in a thread
whose mode is thorough, because no lead posts one there.

Lead behaviour: post it the first time an item is deferred, and again whenever a row is
added or removed. On a `removed:` press, fold that item back into the Spec, delete its row,
log it, repost the card. If the plan was `approved`, that Spec change returns it to
`ready-for-review`. When building starts, repost with `locked: true`. On a change to
thorough, post it once more with `bullets: []` and then never again.

### Plan review in the lighter modes (D2)

Reviewer briefs in a lighter mode name the mode and include the Deferred table as
settled, like Accepted Risks. reviewer.md gains: in a lighter mode, do not raise a
Deferred item as missing; do raise a Deferred item that the feature cannot work without
(that is a finding against the deferral). Lead triage: a finding that is hardening is
moved to Deferred with source `review-round-N`; its verdict is `upheld` or `downgraded`
as usual and it counts as found, and as fixed once its Deferred row is saved. In a
lighter mode, a finding moved to Deferred does not count against the clean test: a round
is clean when triage upholds no blocking or major finding that stays in the Spec and no
`user-decision` is open. The budget rule is otherwise unchanged.

### Verification in the lighter modes (D7)

The verifier is briefed with the mode and the Deferred table; verifier.md gains: a
Deferred item is out of scope and is not a gap. Nothing else about how it checks changes. The sub-lead, before remediating a
verification report in a lighter mode, sends the lead one `message` (`asks: true`) listing
each gap it judges hardening. The lead answers per gap: defer or fix. Gaps the lead
defers are written by the sub-lead into PLAN.md Deferred (source `verification`), since
the worktree is the sub-lead's; the lead reposts the `deferred` card (still `locked`). The
rest are remediated as today. A deferred gap is not counted as a failed check.

### Done (D4, D6, D8, D12)

- `two-part`: after the `done` card, if Deferred has rows, the lead posts a `stub` card:
  title "Make <feature> solid", `depends_on_parent: true`, summary containing: what was
  built and the pull request link, the plan path (`docs/plans/<slug>/PLAN.md` on branch
  `wc/<thread-id>`), every Deferred row with its notes, and the instruction that its lead
  plans these from step 1, suggesting a mode as for any feature. With no rows, no stub,
  and the `done` card's `note` says nothing was deferred.
- `proof-of-concept`: the `done` card's `left_as_is` lists every Deferred item (each gets
  the usual "Start a thread about it"). No stub unless Collin presses one.
- `thorough`: unchanged.

### Where the changes go

- `protocol/app/lead.md`: steps 2, 4, 5, 6, 7, 8 as above; restart reads `mode:`.
- `protocol/app/reviewer.md`, `verifier.md`, `sub-lead.md`: the rules above.
- `protocol/app/cards.md` (kind table) and `cards-lead.md` (a `deferred` section).
- `protocol/templates/IDEA.md` (`mode:` frontmatter line with the three values and default)
  and `PLAN.md` (an optional `## Deferred` section with the table and a note that it
  exists only in the lighter modes).
- `viewer/app/card.js` (kind, `lead` only, fields), `viewer/app/cards.js` (singleton),
  `viewer/app/chat.js` `shownPins` (not hidden after build), the press path that routes
  `removed` for `idea` (accept it for `deferred` too), `viewer/pages/thread.js` (pinned
  kind and rendering).

### Not changing

The offer card, the approval card, the Ready check, the progress line, small fixes,
thorough mode, the stub mechanism, the app's slug and document rules.

### Validation

- `node --test viewer/test/*.test.js` passes, with new tests: `deferred` accepted from a
  lead with both modes and an empty list, refused from a sub-lead, refused with an unknown
  mode or extra field; it is pinned and a second replaces the first; it stays in the pins
  after Start building; a `removed` press on it reaches the lead as
  `[card <id>] removed: <text>`.
- `protocol-rules.test.js` passes with the new kind documented in cards.md/cards-lead.md.
- `npm --prefix viewer run test:browser` passes, with a test that renders a `deferred` card
  in both modes (heading, hint, bullets, remove button) and with `locked: true` (no remove
  button).
- Read-through: a fresh lead following lead.md in each mode reaches the right done step.

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them.

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-17

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent (claude) | major | Hardening findings moved to Deferred still block the clean test, so review may run as long as thorough | upheld | D14; Spec "Plan review in the lighter modes" |
| intent (claude) | minor | Verifier rule reading "What good looks like" as the working version loosens checks, against IDEA's non-goal | upheld | Rule removed from Spec "Verification in the lighter modes" |
| intent (claude) | minor | IDEA.md says the follow-up thread holds a written plan; D4/D12 make it a head start | user-decision | IDEA wording change proposed to Collin |
| intent (claude) | minor | IDEA says PoC skips are "recorded as accepted risk" but D11 uses Deferred | declined | Spec table and D11 already state Deferred is the accepted-risk record in proof-of-concept |

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
