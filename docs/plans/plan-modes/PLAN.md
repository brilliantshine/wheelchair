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
| D15 | IDEA.md reworded: the two-part follow-up thread starts with the deferred items and notes, ready to plan, not a written plan | Matches D4 | idea-change |
| D16 | Switching to thorough retracts the `deferred` card (made retractable); switching between lighter modes reposts it | An empty repost could not be told apart from a lighter mode with nothing deferred | review-round-1 |
| D17 | Mode change or pull-back after approval retracts the approval card first; a late start-building press is ignored with a reply | Otherwise Start building stays live on a plan back in review | review-round-1 |
| D18 | Verification gaps the lead defers are committed to Deferred by the sub-lead; remaining gaps go through remediation; if all are deferred a fresh verifier re-checks with no remediation, not counted as a fix attempt | Defines a path to PASS when gaps are deferred | review-round-1 |
| D19 | Mode change or pull-back during a running round stops it; the round restarts under the same number, untriaged and uncounted | Reviewers would otherwise report on a superseded plan | review-round-1 |
| D20 | Locked or stale `deferred` cards refuse `removed` presses at the hub; the lead ignores a late one; the card is locked before the sub-lead starts | Closes the window between Start building and the locked repost | review-round-1 |
| D21 | Deferred bullet ids and texts must be unique within the card | The press carries the text, so duplicates would be ambiguous | review-round-1 |
| D22 | Restart recovers the mode from cards before IDEA.md exists; no silent default | Avoids bypassing Collin's choice | review-round-1 |
| D23 | A restarted lead in a done two-part thread posts the follow-up stub only if none exists | Neither misses nor duplicates the handoff | review-round-1 |
| D24 | The empty `deferred` card is posted as soon as a lighter mode is chosen | Keeps the mode visible from the start (IDEA: "the mode in use is clear") | review-round-2 |
| D25 | (superseded by D35) Only the first all-deferred re-check in a build is free; later ones count toward the two-attempt rule | Keeps verification bounded as today | review-round-2 |
| D26 | All-deferred re-check verifies the post-deferral commit with the normal verifier selection; deferral triage waits for every verifier of the attempt | One snapshot; no lane skipped | review-round-2 |
| D27 | The lead acts on Start building only for its latest approval card while status is `approved`; a refused retract of an already-pressed approval is fine | A queued press can't be un-recorded at the hub | review-round-2 |
| D28 | `removed` on `deferred` does not mark it answered; stale pull-backs are ignored by the lead | Keeps the card retractable and pressable | review-round-2 |
| D29 | Lead reposts the deferred card only after the sub-lead reports the commit of the rows | The pin never claims an unsaved deferral | review-round-2 |
| D30 | After a restarted round, only reports from the restart's sessions are triaged | Stale reports can't approve a changed Spec | review-round-2 |
| D31 | The follow-up stub's summary starts with `Two-part follow-up for plan <slug>.`; a restarted lead finishes publishing before checking for it | Durable marker; the PR link exists first | review-round-2 |
| D32 | The mode is written only when one supported mode is named; otherwise a follow-up question | No silent fallback from free text | review-round-2 |
| D33 | Mode and Deferred list are fixed once the lead accepts Start building, not at `implementing` | Closes the window before the sub-lead writes its status | review-round-3 |
| D34 | A pulled-back item is never deferred again in the thread | Collin's explicit choice must stand | review-round-3 |
| D35 | (supersedes D25) A second all-deferred re-check goes to Collin as today's surviving-gap question with "defer" as an extra answer; failing validation commands are never deferrable | Bounded verification with a defined exit; deferral can't mask a failing check | review-round-3 |
| D36 | A mode change or pull-back during a running round waits for that round's triage (supersedes D19 and D30) | No half-triaged round to roll back | review-round-3 |
| D37 | The lead reconciles the deferred pin from PLAN.md before the done card; a retracted deferred card renders dimmed with no controls | Stale pin after a sub-lead death; clear chat history | review-round-3 |

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
IDEA.md, and only one of the three supported values. If the answer was typed into the
card's box (or in chat) and does not name exactly one mode, the lead asks a follow-up
`question` card before writing IDEA.md.

Restart before IDEA.md is written: the restarted lead reads the cards it is given. If the
mode question was answered with a press, it uses that mode; if answered in its box or
resolved with a note, it uses the mode only if the text names exactly one, and otherwise
asks the follow-up question above. If it is open, it leaves it open and waits. If it was never posted, it
posts it. `thorough` is assumed only when reading an IDEA.md with no `mode:` line (plans
from before this feature).

### Changing the mode (D5)

Until the lead accepts a Start building press (D27), Collin may ask in chat to change the
mode. The lead edits `mode:` in IDEA.md (not a scope change; no
Decision Log `idea-change` entry, a `user` entry instead) and:
- to `thorough`: moves every Deferred item back into the Spec, deletes the section, and
  retracts the `deferred` card (see below);
- from `thorough` to a lighter mode: may move Spec items to Deferred, each announced in
  its reply and shown on the `deferred` card;
- between the two lighter modes: the Deferred section stays; only its meaning changes,
  and the `deferred` card is reposted with the new `mode`.

A mode change or a pull-back (below) after `approved` first retracts the open approval
card, then returns the plan to `ready-for-review` (step 5). If the retract is refused
because a Start building press was already recorded, the lead carries on. The lead acts
on a `[card <id>] start building` press only when `<id>` is the approval card it posted
last and PLAN.md `status:` is `approved`; any other such press (a late or stale one)
starts nothing, and the lead says in its reply that the plan changed and is back in
review. The rule applies only after a mode change or a pull-back; a thorough thread with
neither keeps today's step 7 unchanged (IDEA constraint).

A mode change or a pull-back asked for while a review round's reviewers are running is
applied after that round's triage is finished, never during it; the lead says so in its
reply. The round runs and is triaged as normal against the plan its reviewers were
briefed with; the change then goes into the next round's "Changed since" list.

The moment the lead accepts a Start building press (before it starts the sub-lead), the
mode and the Deferred list are fixed: a later request to change the mode, or a
pull-back, is answered with that and changes nothing. If starting the sub-lead then
fails, they stay fixed; the lead retries the start as lead.md already says.

### PLAN.md `## Deferred` (D11)

A section placed after Spec and before Accepted Risks, present only in the lighter modes.
One row per item:

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|

`Source` is `planning`, `review-round-N` or `verification`. `Notes` are what the
follow-up's lead will need (file:line, the case that breaks, the reviewer's evidence).
Pulling an item back deletes its row and folds it into the Spec, with a Decision Log entry
(source `user`). An item Collin pulled back is never deferred again in this thread, by
review triage or verification: findings about it are fixed, or come to Collin as a
`question` card if fixing is not possible.

### The `deferred` card (D3, D13)

New lead-only kind, pinned (one per thread, a new one replaces the old in the pin, like
`idea`).

| Field | Type | Required | Meaning |
|---|---|---|---|
| `mode` | `two-part` \| `proof-of-concept` | yes | Sets the heading |
| `bullets` | array of `{id, text}` | yes, may be empty | One per Deferred row; `id` stable (`d1`, `d2`), `text` short and in Collin's terms. Both `id` and `text` must be unique within the card, or the card is refused |
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

A `removed` press on a `deferred` card does not set `answered` on it (in `press` in
`viewer/app/threads.js`, the block that sets `answered` skips `deferred`, as it already
skips an approval's `talk`), so the card stays retractable and can take further
pull-backs. `deferred` is added to the kinds `retract` accepts (cards-lead.md refusal 2
and `retractable` in `viewer/app/card.js`). Retracting it removes it from the pin, as for
any retracted pinned card. This is how a change to thorough clears it. A retracted `deferred`
card stays in the chat dimmed with "Withdrawn · <note>" like other retracted cards, and
renders with no remove buttons.

The hub refuses a `removed` press on a `deferred` card whose `locked` is true, or on one
that has been replaced or retracted, with the same refusal shape as other stale presses.

Lead behaviour: post it, empty, as soon as a lighter mode is chosen (so the mode is
visible from then on), and again whenever a row is added or removed. On a `removed:` press, fold that item back into the Spec, delete its row,
log it, repost the card. If the plan was `approved`, that Spec change returns it to
`ready-for-review`. On a `[card <id>] start building` press, the lead reposts it with `locked: true` before
starting the sub-lead. A `removed:` press that still reaches the lead after that (an
already-queued one) changes nothing: the lead says building has started and the item
stays deferred. The same holds for a `removed:` press whose card id is not the `deferred`
card the lead posted last, or that arrives after the card was retracted: the lead
changes nothing and says the list has moved on. On a change to thorough, retract it.

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
Deferred item is out of scope and is not a gap. Nothing else about how it checks changes. When an attempt's verification has failed in a lighter mode (after every verifier of the
attempt has reported, as in sub-lead.md step 4–5), before step 5:
1. Using all reports of the attempt, with duplicates merged, the sub-lead sends the lead one `message` (`asks: true`) listing each gap it judges
   hardening, with the verifier's evidence. The lead answers per gap: defer or fix.
2. The sub-lead writes the deferred gaps into PLAN.md Deferred (source `verification`),
   commits PLAN.md (the worktree is the sub-lead's), and sends the lead a `message`
   naming the commit and the rows saved. Only on that message does the lead repost the
   `deferred` card (still `locked`).
3. If gaps remain to fix, step 5 runs as today on the remaining gaps only: `found` counts
   only those, and REMEDIATION-N.md lists only those.
4. If every gap was deferred, there is no remediation: the sub-lead starts a new
   verification attempt on the commit from step 2 (the failed commit plus the Deferred
   rows), using the same verifier selection rules as sub-lead.md step 3.
   At most one such re-check per build.
A deferred gap never counts toward the two-attempt rule. If a build would need a second
all-deferred re-check, the sub-lead does not start it: it stops and messages the lead as
in sub-lead.md step 6, and the lead asks Collin today's surviving-gap `question` (push as
it is, or drop), with these gaps deferred as one more answer. "Push as it is" or
"defer" ends verification without another verifier pass, exactly as "push as it is"
does today; deferring also adds the rows to PLAN.md.

Never deferrable in verification: a failing validation command from the Spec's
Validation section, and a gap in an item Collin pulled back. These go to remediation.

Gaps deferred during verification are decided by the lead, not Collin: building has
started and the card is locked. Before posting the `done` card, the lead reads PLAN.md's Deferred rows and reposts the
`deferred` card if it differs (covers a sub-lead that died before sending its commit
message). Collin sees them on the `deferred` card as they are added
and accepts them after the fact (two-part: the follow-up thread; proof-of-concept: the
done card's "left as is").

### Done (D4, D6, D8, D12)

- `two-part`: right after the `done` card, if Deferred has rows, the lead posts a `stub` card:
  title "Make <feature> solid", `depends_on_parent: true`, summary whose first line is
exactly `Two-part follow-up for plan <slug>.` (the handoff marker; no other stub uses
it), then: what was
  built and the pull request link, the plan path (`docs/plans/<slug>/PLAN.md` on branch
  `wc/<thread-id>`), every Deferred row with its notes, and the instruction that its lead
  plans these from step 1, suggesting a mode as for any feature. With no rows, no stub,
  and the `done` card's `note` says nothing was deferred.
  Restart in a two-part thread whose PLAN.md is `done`: the lead first finishes step 8
  as today (push, open the pull request if `gh pr view` finds none, post the `done` card
  if none was posted after the `done` commit), then checks the cards it was given for a
  `stub` whose summary starts with the handoff marker. If none exists and Deferred has
  rows, it posts it; if one exists, it posts nothing.
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
- `viewer/app/card.js` (kind, `lead` only, fields with unique ids and texts, retractable),
  `viewer/app/cards.js` (singleton), `viewer/app/threads.js` (refuse `removed` on a
  locked `deferred` card; replaced and retracted cards are already refused for every kind
  at `threads.js:274-276`, so add only the `locked` check),
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
  `[card <id>] removed: <text>`; a card with a duplicate bullet id or text is refused; a
  `removed` press on a locked, replaced or retracted `deferred` card is refused; a
  `retract` of a `deferred` card succeeds and removes it from the pins.
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
| A failed parent save after the child thread is saved could let a restarted lead post a second follow-up stub | Shared by every stub today; needs a disk write failure between two consecutive saves | 3 |

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
| intent (claude) | minor | IDEA.md says the follow-up thread holds a written plan; D4/D12 make it a head start | user-decision | Collin agreed; IDEA.md reworded (D15) |
| mechanics (gpt) | blocking | Switching to thorough leaves a visible empty deferred card; lighter-mode switch needs a repost | downgraded (major) | Real, but a worker would ask, not build wrong; fixed by D16 |
| mechanics (gpt) | blocking | Approval card stays actionable after a change returns the plan to review | upheld | D17 |
| mechanics (gpt) | blocking | All verification gaps deferred leaves no path to PASS | upheld | D18 |
| mechanics (gpt) | major | Mode change during running review has no rule | upheld | D19 |
| mechanics (gpt) | major | Lock timing and stale removed presses unhandled | upheld | D20 |
| mechanics (gpt) | major | Pull-back press identifies a row by text; duplicates ambiguous | upheld | D21 |
| mechanics (gpt) | major | Mode recovery on restart before IDEA.md is written is undefined | upheld | D22 |
| mechanics (gpt) | major | Restart between done and follow-up stub can miss or duplicate it | upheld | D23 |
| intent (claude) | minor | IDEA says PoC skips are "recorded as accepted risk" but D11 uses Deferred | declined | Spec table and D11 already state Deferred is the accepted-risk record in proof-of-concept |

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`user-decision`) is what gates the
exit. Downgrades and declines cite evidence.

### Round 2 — 2026-11-17

**Lanes:** intent: claude; mechanics: other family; cross-family: yes.

**Changed since Round 1:**
- Clean test in lighter modes ignores findings moved to Deferred (D14).
- Verifier rule narrowed to "Deferred is out of scope" only.
- IDEA.md follow-up wording (D15).
- Deferred card retractable; switch handling (D16); approval retracted on change (D17).
- Verification deferral path to PASS (D18); mode change during review (D19).
- Lock and stale presses (D20); unique bullets (D21); restart recovery for mode (D22) and follow-up stub (D23).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent (claude) | minor | Mode invisible in a lighter mode until something is deferred | upheld | D24 |
| intent (claude) | minor | All-deferred re-checks make verification unbounded | upheld | D25 |
| intent (claude) | minor | Verification-time deferrals in proof of concept are only seen after the fact; say so | upheld | Stated in Spec "Verification in the lighter modes" |
| intent (claude) | minor | Hub already refuses replaced/retracted presses; only the lock check is new | upheld | Spec "Where the changes go" clarified |
| mechanics (gpt) | blocking | All-deferred re-check: failed commit vs updated tip | upheld | D26 |
| mechanics (gpt) | blocking | Queued Start building makes the approval unretractable | downgraded (major) | Only the lead acts on the press, so a lead rule closes it; no wrong build follows from the card state. D27 |
| mechanics (gpt) | major | Queued pull-back marks the deferred card answered, blocking retract | upheld | Confirmed at threads.js `press` (sets answered for every non-talk press). D28 |
| mechanics (gpt) | major | Pin refreshed before rows are committed | upheld | D29 |
| mechanics (gpt) | major | Deferral triage on first FAIL; single re-check skips second lane | upheld | D26 |
| mechanics (gpt) | major | Stale reports from a cancelled round | upheld | D30 |
| mechanics (gpt) | major | Restart may post the stub before the PR exists | upheld | D31 |
| mechanics (gpt) | major | Title match can't identify the handoff stub | upheld | D31 |
| mechanics (gpt) | major | Free-text mode answer can fall back silently | upheld | D32 |

### Round 3 — 2026-11-17

**Lanes:** intent: claude; mechanics: other family; cross-family: yes.

**Changed since Round 2:**
- Empty deferred card posted when a lighter mode is chosen (D24); bounded re-checks (D25); after-the-fact acceptance of verification deferrals stated.
- Verification deferral: snapshot, all reports, selection rules (D26); commit-then-repost (D29).
- Start building only on the latest approval while approved (D27).
- `removed` doesn't mark `deferred` answered; stale pull-backs (D28).
- Restarted round uses only its own reports (D30).
- Handoff stub marker and restart order (D31); unambiguous mode answer (D32).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent (claude) | minor | D27 written "for every mode" changes thorough, against IDEA's constraint | upheld | Rule limited to after a mode change or pull-back |
| mechanics (gpt) | blocking | Mode change can reopen review after the sub-lead was queued | upheld | D33 |
| mechanics (gpt) | blocking | A pulled-back item can be deferred again | upheld | D34 |
| mechanics (gpt) | major | No exit for successive all-deferred re-checks | upheld | D35 |
| mechanics (gpt) | major | A gap behind a failing validation command could be deferred | upheld | D35 |
| mechanics (gpt) | major | Sub-lead death before notifying leaves the pin stale | downgraded (minor) | Only the pin is stale; PLAN.md is right and the done step reads it. D37 |
| mechanics (gpt) | major | Partial hub save could duplicate the follow-up thread | accepted-risk | Same failure applies to every stub today (cards.js saves child then parent); needs a disk write failure between two saves |
| mechanics (gpt) | major | A cancelled round may already have changed the plan | upheld | D36 replaces cancellation with waiting |
| mechanics (gpt) | minor | Withdrawn deferred card's rendering unspecified | upheld | D37 |

### Round 4 — 2026-11-17

**Lanes:** intent: claude; mechanics: other family; cross-family: yes.

**Changed since Round 3:**
- D27 limited to after a mode change or pull-back (thorough unchanged).
- Mode and Deferred fixed once Start building is accepted (D33).
- Pulled-back items never re-deferred (D34).
- Second all-deferred re-check goes to Collin; failing validation never deferrable (D35).
- Mode change during a round waits for triage, replacing cancellation (D36; D19 and D30 superseded).
- Pin reconciled before done; withdrawn deferred card rendering (D37). New Accepted Risk on duplicate follow-up after a partial save.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent (claude) | minor | D25 and D35 wording both remain and contradict | upheld | D25 wording removed and marked superseded |
| intent (claude) | minor | "Defer and finish" exit undefined against today's verification exit | upheld | Folded into today's surviving-gap question (D35) |

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
