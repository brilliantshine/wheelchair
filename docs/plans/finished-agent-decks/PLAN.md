---
slug: finished-agent-decks
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-18
---

# Finished agents stack into decks on the Agents screen

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

Ordered by leverage; discussed one at a time. A settled question moves to the Decision
Log and is deleted from here.

(none)

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
| 1 | Mode: two-part | Collin picked it on the mode card | user |
| 2 | Round numbers are recorded at start: reviewer and verifier `session start` take a round number, stored on the session | MAP: no existing record ties a session to a round; attempt ids are per start, not per round (MAP.md) | defaulted |
| 3 | Objection and problem text comes from the stored report's `SEVERITY:` / `GAP:` lines | Reports already use these exact line forms | defaulted |
| 4 | Decks group only what the tree shows today; closed asides, which the tree never shows (`viewer/app/agents.js:115`), stay out | Adding them is a separate change to which agents appear | defaulted |
| 5 | A round's square is colored by the lead's upheld count for that round (the progress line's `found`), not the raw count in reports | Measures convergence, not reviewer chattiness; same number the progress line shows | user |
| 6 | A round with no counted progress line gets a grey "not counted" square | Happens for an interrupted round or one still in triage; inventing a number would mislead | defaulted |
| 7 | Objection text is shown only when the upheld count is 1 and the round's reports hold exactly one finding line; otherwise the count | Raw text can't be matched to the upheld finding otherwise | defaulted |
| 8 | Reviewer decks are titled "Plan review", verifier decks "Checks"; other decks take their newest agent's title | Agent titles vary per start; the proposal's example titles are role-based | defaulted |
| 10 | Verifier deck title uses the newest verifier's title (supersedes the verifier half of #8) | Matches the proposal's "Checked parts 1–4" example | review-round-1 |
| 9 | Popover shows the latest 5 rounds (or agents) before "Show all" | Proposal says "the latest few" | defaulted |

## Spec

### Scope
Viewer hub and Agents page (`viewer/app/sessions.js`, `viewer/app/agents.js`, `viewer/app/wc.js`, `viewer/app/API.md`, `viewer/pages/agents.js`, `viewer/pages/views.css`, tests in `viewer/test/`), plus protocol text in `protocol/app/lead.md` and `protocol/app/sub-lead.md`. Also add Collin's proposal files to the repo unchanged: `docs/proposals/app-shell/finished-agents.md` and `docs/proposals/app-shell/design/AgentsFinishedDecks.dc.html` (sources: the attached copies the lead hands to the build). Routers (`viewer/AGENTS.md`) updated if a file's role changes.

### 1. Round number on reviewer and verifier sessions
- `wc.js session start` accepts `--round <N>` (integer >= 1). The hub stores it on the session as `round`. Accepted only for roles `reviewer` and `verifier`; any other role, or a non-integer / < 1 value, is refused with a reason naming the flag. Absent means no round.
- Retries keep today's attempt dedupe (`viewer/app/sessions.js:606-611`): a start whose `--attempt` matches a live or unanswered session returns that session unchanged (its stored round kept, the new `--round` ignored); otherwise a new session is created carrying the `--round` of its own start call. No other change to dedupe.
- `round` is included in the public session and in the Agents API node.
- Protocol: lead.md step 5 tells the lead to pass `--round <N>` (the review round number, same as the progress `pass`) when starting reviewers, including restarts within a round. sub-lead.md tells the sub-lead to pass `--round <N>` (the verification attempt number, same as the verify progress `pass`) when starting build verifiers. Small-fix, after-done and steps-only verifiers are started without `--round`.

### 2. Per-round counts and outcome in the Agents API
For each lead in `GET /wheelchair/api/agents`, add `rounds: { review: {<N>: R}, verify: {<N>: R} }` built from the thread's `progress` cards (including replaced ones) with `stage` `review` / `verify`. For each pass N, use the latest card for that stage and pass whose phase is `fixing` or `clean`:
- `fixing` → `found: F`.
- `clean` → `found` = its `found` if present, else 0; `clean: true`.
- Only `checking` cards for that pass → no entry (count unknown).

Per reviewer/verifier node add `report: { findings: <int>, first: <string|null> }` parsed from the newest result summary: reviewers count lines starting `SEVERITY:` and take the finding text (third ` — `-separated field) of the first; verifiers count lines starting `GAP:` and take its second field (what is missing). No result → no `report`.

### 3. Decks on the tree (Hide finished agents OFF)
- Among one parent's children, finished nodes with the same `role` form a deck when there are 2 or more. A single finished node stays a normal box. Live (working, waiting, idle) nodes are never in a deck. "Finished" is the existing page definition.
- The deck replaces those boxes, placed at the position of its newest member in the existing creation order. The deck is a parent in its own right: the children of all its members are merged into one child list under the deck (sorted by creation), and grouping under it uses the deck as their parent. So the verifiers of two decked sub-leads can share one deck. This is the meaning of "same parent" for agents under a deck.
- Deck card: role, count (`×40`), one-line title, and "finished <relative time>" from the newest member's `ended_at` (falling back to its last activity time when absent). Drawn with two offset outlines behind it (CSS only), dashed like finished boxes.
- Title: reviewer → "Plan review · N rounds" plus ", then approved" when *approved* (below); verifier → "<newest member's title> · N rounds" plus ", passed" (e.g. "Checked parts 1–4 · 3 rounds"; "Checks" when it has no title) when *passed*.
  - *approved*: the thread has a review progress card for the deck's highest round with phase `clean`, an `approval` card (retracted or not) posted after it, and no review progress card for a higher pass. A later round starting (its `checking` card) clears it.
  - *passed*: the thread has a verify progress card for the deck's highest round with phase `clean`, and no verify progress card for a higher pass.
  - The API exposes what the page needs for this: `rounds.review[N].approved: true` and `rounds.verify[N].passed: true` on the qualifying entry only. N = number of distinct `round` values among members. Members with no `round` are not counted in N; if no member has a round, reviewer/verifier decks use the other-deck title. Other decks: the newest member's title (role when it has none).
- Hide finished agents ON: behaviour unchanged (decks never shown; a selected finished agent and needed ancestors still shown as boxes).

### 4. Round squares
- Reviewer and verifier decks with at least one member `round` show one square per distinct round, oldest to newest, wrapping to further lines.
- Color from `rounds.<review|verify>[N].found`: 5+ red `#d9645a`, 3–4 orange `#e0904a`, 1–2 yellow `#d9c45a`, 0 green `#4ea87b`; no entry → grey, meaning not counted.
- The square row has an accessible label: "<N> rounds; objections went from <first counted> to <last counted>" (verifiers: "problems"); with fewer than two counted rounds, "<N> rounds".

### 5. Deck popover
- Clicking a deck (button, keyboard-activatable) opens a popover anchored under it; Escape, clicking outside or clicking the deck again closes it. Only one open at a time. It survives the 5-second refresh (stays open, content updates).
- Reviewer/verifier decks with rounds list rounds newest first: square, "Round N", "<k> reviewers · <text>" (verifiers: "<k> verifiers"). <text> is "1 objection: <first>" when found is 1 and the round's *current* members' reports total exactly one finding line (current members: those whose `created_at` is at or after the newest `checking` progress card for that stage and pass; when that round has no checking card, all members); else "<found> objections" (singular for 1; "problems" for verifiers); "no objections" for 0; "not counted" with no entry. Members without a round are listed as a final group "Other". Shows the latest 5 rounds, then a "Show all N rounds" button that expands in place.
- Opening a round lists its agents (title, finished time); each is selectable exactly like a box: sets `?agent=` and shows that agent in the right panel. The deck containing the selected agent is drawn selected.
- Other decks list their agents newest first, latest 5 then "Show all N agents", each selectable the same way.
- Works at phone width (popover fits the viewport width).

### 6. Info popout
A `?` button next to "Hide finished agents" opens "How to read this tree": one line on stacked cards; the color key (four colors plus grey "not counted"); two example rows of squares, "Settling down" (red → orange → yellow → green) and "Going in circles" (orange/red alternating). Closes like the deck popover.

### Non-goals
Changing Hide finished agents ON; decking live agents; closed asides; changing how review/verification runs; backfilling rounds for agents started before this change (they show as decks without squares).

### Edge cases
- Restarted reviewer in the same round: both members counted under that round; the reviewer count includes it.
- Dead/stopped sessions with no result count as finished members; no `report`.
- A deck whose members change (one more finishes) updates on the next refresh without closing an open popover.
- Two leads in a thread (old lead's children attach to newest lead today): unchanged; decks follow displayed parent.

### Validation
- `node --test viewer/test/*.test.js` (unquoted glob) passes, with new tests for: `--round` accepted for reviewer/verifier, refused for other roles and bad values, kept on attempt re-run; `rounds` built from progress cards (fixing, clean with and without found, checking-only); `report` parsing for reviewer and verifier summaries.
- `npm --prefix viewer run test:browser` passes, with new desktop and phone cases: 3 finished reviewers under one lead show one deck `×3` with squares in the right colors; one finished worker stays a box; a live reviewer is not decked; deck popover lists rounds newest first and selecting an agent opens the right panel; "Show all" expands; `?` popout opens and closes; Hide finished ON shows no decks; with a deck popover open and a round expanded, a poll that adds a finished member keeps the popover and round open and shows the new member.
- `bash machine/test/run.sh` still passes if `wc.js` changes touch machine-side forwarding.

## Deferred

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| D1 | Full keyboard handling in the deck popover: arrow keys between rows, focus moved into the popover and returned to the deck on close | Mouse/tap, Enter/Space to open and Escape to close already work | planning | Follow the proposal's popover; check with Playwright keyboard tests on both browsers |
| D2 | Deck squares for agents started before this change (backfilling round numbers from old cards and plans) | New threads get rounds from now on; old ones still deck, just without squares | planning | Membership can't be recovered reliably from timestamps (MAP.md); would need a best-effort match against progress `checking` cards |

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them.

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | API `report` field duplicates what the page could parse from `result_summary` | declined | Parsing in the API keeps it under the Node unit tests (`viewer/test/app-agents.test.js`) and the page stays drawing-only; no extra behaviour |
| intent | minor | Accessible label says "fell" even when counts rise | upheld | §4 now says "went from X to Y" |
| intent | minor | Verifier deck title "Checks" drifts from proposal's "Checked parts 1–4" | upheld | §3 uses newest verifier's title; Decision 10 |
| intent | minor | Dropping asides from decks not approved by Collin | declined | Told to Collin in chat when the default was made, with the reason (closed asides never reach the tree, `viewer/app/agents.js:115`); IDEA Not doing covers changes to which agents appear |
| mechanics | blocking | Children of different decked parents: grouping key unclear | downgraded (minor) | Spec already said "merged and decked by the same rule"; a worker would not stop. Clarified §3: the deck is the parent for its members' children |
| mechanics | blocking | Single-objection text could come from a report discarded by a lead restart | downgraded (minor) | Only a restart mid-round with exactly one stale finding; shows wrong text, builds nothing wrong. §5 now uses only members started after the round's newest checking card |
| mechanics | blocking | "then approved" can show before approval and stay after the plan returns to review | upheld (major) | §3 defines approved/passed from approval card and later progress cards; API flags added |
| mechanics | major | Verifier round N not durable across a sub-lead crash | declined | N is the verify `pass`, defined as REMEDIATION-N's N + 1 (`protocol/app/cards.md` progress table), from committed files; a replacement restarting the same attempt reuses N correctly, and `rounds` is keyed by progress cards, not sessions, so nothing is overwritten |
| mechanics | major | Retry of a finished attempt id: what round does it get | upheld | §1 now states today's dedupe and that a new session carries its own start's round |
| mechanics | minor | Accessible label says "fell" | upheld | Same as intent finding; fixed |
| mechanics | minor | No browser case polls with a deck open | upheld | Added to Validation |

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
