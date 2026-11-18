---
slug: self-check-steps
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-18
---

# Check-it-yourself steps after Done

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

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
| 1 | Plan mode: thorough | Collin's pick on the mode card | user |
| 2 | Steps fit the change, phone first: a change visible in the app gets steps done in the app on a phone; only a change with nothing to see there (scripts, machine service, protocol docs) gets commands to run on the machine | Most changes show in the app; the rest can only be checked by running something | user |
| 3 | The steps are a card of their own, posted right after the done card, not a section of it | Easier to spot and lays out step by step; Collin picked it over the leaning (part of Done) | user |
| 4 | An agent follows the steps before Collin sees them: a verifier tries each step and reports what it saw; the lead fixes any step that does not match | The point is not having to trust; untried steps would be one more thing to trust | user |
| 5 | The steps are for after Collin merges and updates; the card says so. Before merging he relies on the agent having tried them. A live preview of the branch is not part of this | Works for every project today; a preview is its own thread | user |
| 6 | Kind name `check`, not pinned, tied to its done card by `head` | A done card can be followed by fixes with their own done cards; `head` says which one a set of steps belongs to | defaulted |
| 7 | One combined verifier for small fixes and after-done fixes (it checks the fix and tries the steps); a separate steps verifier for a planned build, started by the lead after the sub-lead's result | Small paths already start one verifier; a planned build's verification is the sub-lead's and is finished by then | defaulted |
| 8 | A step that shows the work itself is wrong is fixed by the lead in the worktree, like an after-done fix, before any push | The sub-lead's result already handed the worktree back; restarting a sub-lead for one gap costs more than the fix | defaulted |
| 9 | A step no agent could try is still shown, marked "Not tried by an agent" with the reason | Hiding it loses a check Collin can still do; marking it keeps the card honest | defaulted |
| 10 | No buttons for "it worked" or "it didn't" on the check card; he reports a problem by typing in the thread as today | IDEA.md: not recording whether he did them | defaulted |

## Spec

### What Collin gets

Right after every accepted `done` card, the lead posts a `check` card: "Check it yourself".
It says first how to get the change running (merge, then how this project updates), then
gives numbered steps. Each step says where it is done (in the app, or on the machine), what
to do, and what he should see. Steps an agent followed say nothing extra; a step no agent
could try carries "Not tried by an agent" and the reason. All three done paths get one:
small fix, planned build, and a fix after done (whose steps cover only what that fix
changed). Steps are for after merging (Decision 5).

### Where the steps are done (Decision 2)

- A change Collin can see in an app (wheelchair's own app, or the project's) gets steps he
  follows there on his phone: what to open or tap, and what he should see.
- Only a change with nothing to see in an app (scripts, the machine service, protocol
  documents) gets commands to run on the machine, each with the output to look for.
- One card may mix both; app steps first.
- A protocol-only change (how agents behave) is checked by what he would see agents do in
  a thread, when that is observable; otherwise by a machine command (for example a `grep`
  of the rule in the installed file) with the line to look for.

### The `check` card

Lead-only, shown, not pinned, no presses. Fields:

| Field | Type | Required | Rule |
|---|---|---|---|
| `head` | string | yes | 40-char lowercase hex. Must equal the `head` of the most recent non-replaced `done` card in the thread; the hub refuses otherwise (422 `check head must match the latest done card`), and refuses when the thread has no `done` card (422 `post the done card first`) |
| `update` | string | yes | How to get the merged change running, e.g. "Merge the pull request, then on the machine run `cd /home/collin/projects/personal/wheelchair && git pull && ./install.sh`". At most 600 chars |
| `steps` | array | yes | 1 to 10 items, each `{where, do, see, command?, tried, why_not?}` |

Each step:

| Field | Type | Required | Rule |
|---|---|---|---|
| `where` | `app` \| `machine` | yes | |
| `do` | string | yes | What to do, at most 600 chars |
| `see` | string | yes | What he should see if it worked, at most 600 chars |
| `command` | string | no | Only with `where: machine`; the exact command, full paths, at most 2000 chars; may span lines |
| `tried` | boolean | yes | true when an agent followed the step and saw `see` |
| `why_not` | string | when `tried` is false | Forbidden when `tried` is true. One line, at most 300 chars |

Unknown fields are refused, as for every kind. The card is posted through the normal
spooled path (not synchronous like `done`); the head rule is checked at the hub when the
card is accepted (`viewer/app/cards.js` `acceptCard`, under the thread lock).

Rendering (`viewer/pages/thread.js` `renderCard`): heading "Check it yourself", an eyebrow
"After you merge", the `update` text, then an ordered list. Each item shows a small label
"In the app" or "On the machine", the `do` text, the `command` in a monospace block with a
Copy button (hidden when `navigator.clipboard` is unavailable; copying never posts
anything), then "You should see:" and the `see` text. An untried step shows a muted line
"Not tried by an agent: <why_not>". All text is set as text, never HTML. It must read at
phone width (390px) without horizontal page scroll; a long command scrolls inside its own
block.

Other app touch points:
- `viewer/app/card.js`: add `check` to `shown`, `roles` (`['lead']`) and `fields`, with the
  rules above and the cross-field checks (`command` only with `machine`; `why_not` required
  iff `tried` is false).
- `viewer/app/handoff.js`: add `check` to `KINDS`; `historyText` returns the `update` line
  and one line per step: `<n>. [app|machine] <do> — see: <see>`, plus the command and
  "(not tried: <why_not>)" where present.
- `machine/service.js`: no change beyond what the generic card path already does (confirm
  `check` is spooled and forwarded like other shown kinds).
- `protocol/app/cards.md`: add `check` to the kinds table (shown, lead, not pinned).
- `protocol/app/cards-lead.md`: a `check` section with the fields, rendering summary and
  refusals.

### How the lead writes and tries the steps (`protocol/app/lead.md`)

Writing: after the work's own verification passes, the lead drafts 1 to 10 steps from what
the change is for (IDEA.md's "What good looks like" for a feature; Collin's request for a
small fix; the reported problem for an after-done fix). Steps follow "Where the steps are
done". Each `see` is something he can observe, not "it works". Commands use full paths and
name the output to look for. `update` says how this project picks up a merged change; when
the lead does not know (no README guidance, nothing obvious), it says so plainly and gives
its best guess marked as such.

Trying (Decision 4), before the push that leads to `done`:
- Small fix and after-done fix: the verifier the lead already starts gets the draft steps
  in the same brief; it checks the fix as today and also tries the steps (one session).
- Planned build: after the sub-lead's `result` (sub-lead stopped as today), and before
  setting `status: done`, the lead starts a fresh verifier on the verified commit,
  briefed with the plan slug and the draft steps only, using step 9's provider rule
  (`--not-provider <lead's provider>` when `review_families` is `both`). It posts no
  progress line. Then status `done`, push and PR as today.
- The verifier reports one line per step:
  `STEP <n>: MATCH|DIFFERS|COULD NOT TRY — <what it saw or why>`.
- MATCH → `tried: true`. COULD NOT TRY → `tried: false`, `why_not` from the reason in his
  terms. DIFFERS where what it saw is what the change should do (the step's wording was
  wrong) → the lead rewrites `see`/`do` to match; a rewritten `do` is re-tried once by a
  fresh verifier, and a step still not matching after that is posted `tried: false` with
  `why_not` "an agent saw something different". DIFFERS where what it saw shows the work is
  wrong → a gap: the lead fixes it in the worktree (Decision 8; never starts a sub-lead or
  workers; if the fix needs parallel workers, a `question` card offering a stub instead),
  commits, and starts a fresh verifier on the fix plus all steps. Two failed attempts → a
  `question` card: finish with that step marked not matching, or drop the fix (revert) and
  finish without that step.
- A `VERDICT: BLOCKED` from a steps verifier is a setup problem, as today: fix it and start
  a fresh one; not a failed attempt.

Posting: immediately after the `done` card is accepted, post the `check` card with the
same `head` as that done card (including a done posted at a merged head other than the
pushed commit, per "Making the pull request mergeable" step 4). The `check` card is never a
condition for `done`; `done` keeps its own gate unchanged.

Restart: after `[wc:context restart]`, if the latest accepted `done` card has no `check`
card with its `head`, the lead writes the steps afresh and has them tried (as above) before
posting. A stub that missed the merge (step 4, exit 1) posts no check card; its own thread
will.

Imported threads: no check card is posted retroactively on import.

### How the verifier tries steps (`protocol/app/verifier.md`)

A new section, used only when the brief includes check steps:
- Try each step against the commit being checked, in the throwaway worktree. Run any app in
  isolation: start it from the worktree on a free port that is not 7374, with its own temp
  state directory (as `viewer/test/helpers/server.js` does), never against Collin's live app,
  its state under `~/.local/state/wheelchair/`, or his projects. App steps are followed in a
  headless browser at phone size (390×844), using the repo's Playwright. Machine commands
  are run as written unless they would touch Collin's live state or install system-wide;
  then try the closest isolated equivalent and say so, or report COULD NOT TRY.
- A step that needs state the isolated app lacks (for example a thread at Done) may be
  set up in the isolated copy; if it cannot be, COULD NOT TRY with the reason.
- The `update` text is not run.
- Report the STEP lines after the verdict lines. A step that DIFFERS is not by itself a
  `GAP`; a `GAP` is still only about the work (Spec, request or reported problem).

### Non-goals

- No pass/fail buttons or tracking of whether he followed the steps (Decision 10).
- No preview of the unmerged branch (Decision 5).
- No change to the done card, its fields, its GitHub gate or "Making the pull request
  mergeable", beyond posting `check` after `done` is accepted.
- No check cards for threads finished before this ships, or on import.
- The sub-lead and worker protocols do not change.

### Edge cases

- Several done cards in one thread (fixes after done): each gets its own check card; older
  ones stay in the conversation unchanged.
- A `check` with a head matching an older, not latest, done card is refused.
- An archived or handed-off thread refuses `check` like any card.
- More than 10 steps needed: the lead picks the 10 that best show the change works.

### Validation

- `cd viewer && npm test` passes, including new node tests:
  - `card.js` validation: accepts a valid card; refuses each missing required field,
    `command` with `where: app`, `why_not` with `tried: true`, missing `why_not` with
    `tried: false`, 0 or 11 steps, over-length fields, unknown fields, a non-lead role.
  - hub acceptance: refused with no done card; refused when `head` differs from the latest
    done; accepted when it matches; accepted after a second done only with the second head.
  - handoff: a thread with a `check` card exports and the file validates; `historyText`
    output matches the format above.
- `cd viewer && npx playwright test` passes, including a new browser test: a posted check
  card renders the heading, "After you merge", the update text, numbered steps with "In the
  app"/"On the machine" labels, the command block with Copy, "You should see:", and the
  "Not tried by an agent" line; at 390px wide the page has no horizontal scroll.
- `grep -n "check" protocol/app/cards.md protocol/app/cards-lead.md protocol/app/lead.md protocol/app/verifier.md`
  shows the new kind row, its section, the lead's writing/trying/posting rules on all three
  done paths and the restart rule, and the verifier's steps section.

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them.

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: see table; cross-family: yes.

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
