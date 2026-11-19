---
slug: finished-agent-decks
status: verifying   # planning | ready-for-review | approved | implementing | verifying | done
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
| 11 | Verification attempts numbered from the highest verifier round in session list | Durable across sub-lead crashes and the all-deferred re-check, which has no remediation file | review-round-2 |
| 10 | Verifier deck title uses the newest verifier's title (supersedes the verifier half of #8) | Matches the proposal's "Checked parts 1–4" example | review-round-1 |
| 12 | Deck titles end ", last round clean" from round H's progress line, not "then approved"/"passed" (supersedes the suffix rules in Spec §3) | Approval tracking kept breaking in review; the progress line is certain | user |
| 13 | IDEA.md's example title and Constraint updated to match Decision 12 | Keeps IDEA and the proposal reference consistent with Collin's choice | idea-change |
| 14 | Round squares are for reviewer decks only; verifier decks stack like worker decks; no change to verification numbering, sub-lead.md or cards.md. Supersedes the verifier parts of Decisions 2, 10 and 11, and removes Deferred D3 | Verifier numbering caused most of the review churn; builds rarely need more than two or three checks | user |
| 15 | IDEA.md updated: verifier decks have no squares | Follows Decision 14 | idea-change |
| 16 | Clarifies 14: verifier decks keep Decision 10's newest-member title, without " · N rounds" | Matches Spec §3 | review-round-7 |
| 17 | Fix the Agents page refresh now: restore the page scroll on every refresh (not only with an agent selected) and re-place an open deck popover against the restored deck; phone test with a long tree, no selection, an open popover, across a refresh. This changes refresh behaviour beyond decks, by Collin's choice | Verification attempt 4's surviving G5 symptom came from the pre-existing scroll reset (`viewer/pages/agents.js:246`); Collin picked fixing it over deferring | user |
| 18 | One more popover fix with an invariant test: restore the popover's scroll after its final placement; cap its height to the viewport minus margins and always clamp it fully on screen wherever the deck is; browser tests in both browsers at phone and desktop width assert, after a refresh, that the popover is fully inside the viewport and keeps its scrollTop (deck on screen, page scrolled, deck pushed off screen by a new finished member, long expanded popover) | Verification attempt 5's popover gaps (G5, Remediation 2 A) survived two fix attempts; Collin picked a final fix with an invariant over deferring or simplifying | user |
| 19 | Supersedes the scroll part of 18: after a refresh an open deck popover keeps its scroll position, or the nearest one the box allows; rows that were visible stay visible. No code change; add a boundary test (popover scrolled to the bottom, box grows on refresh, the previously visible last row is still visible) | Verification attempt 6 found the browser clamps scrollTop when the box grows (943 to 806), which no placement can avoid; Collin picked rewording the invariant over a code change or deferring | user |
| 9 | Popover shows the latest 5 rounds (or agents) before "Show all" | Proposal says "the latest few" | defaulted |

## Spec

```mermaid
flowchart TD
  A[Lead starts reviewers with the round number] --> B[Hub stores the round on each reviewer]
  C[Lead posts progress lines with what it upheld per round] --> D[Agents API: rounds and counts per lead]
  B --> E[Agents API: each agent with role, parent, round, report, finish time]
  D --> F
  E --> F{Hide finished agents?}
  F -- on --> G[Tree as today]
  F -- off --> H[Finished agents with same role and parent stack into a deck]
  H --> I{Reviewer deck with rounds?}
  I -- yes --> J[One colored square per round, title says if last round was clean]
  I -- no --> K[Count, newest title, finish time]
  J --> L[Click: rounds newest first, open a round to pick an agent]
  K --> M[Click: agents newest first, pick one]
```

### Scope
Viewer hub and Agents page (`viewer/app/sessions.js`, `viewer/app/agents.js`, `viewer/app/wc.js`, `viewer/app/API.md`, `viewer/pages/agents.js`, `viewer/pages/views.css`, tests in `viewer/test/`), plus protocol text in `protocol/app/lead.md`. `protocol/app/sub-lead.md` and `protocol/app/cards.md` are not changed (Decision 14). Also add Collin's proposal files to the repo unchanged: `docs/proposals/app-shell/finished-agents.md` and `docs/proposals/app-shell/design/AgentsFinishedDecks.dc.html` (sources: the attached copies the lead hands to the build). Routers (`viewer/AGENTS.md`) updated if a file's role changes.

### 1. Round number on reviewer sessions
- `wc.js session start` accepts `--round <N>` (integer >= 1). A bare `--round` with no value (last argument, or followed by another `--flag`) is refused by `wc.js` itself before calling the hub. The hub stores it on the session as `round`. Accepted only for role `reviewer`; any other role, or a non-integer / < 1 value, is refused with a reason naming the flag. This validation runs before the attempt dedupe below, so an invalid `--round` is refused even when the attempt matches an existing session. Absent means no round.
- Retries keep today's attempt dedupe (`viewer/app/sessions.js:606-611`): a start whose `--attempt` matches a live or unanswered session returns that session (an unanswered one is retried as today); its stored `round` never changes, and the new call's `--round` is ignored; otherwise a new session is created carrying the `--round` of its own start call. No other change to dedupe.
- `round` is included in the public session and in the Agents API node.
- Protocol: lead.md step 5 tells the lead to pass `--round <N>` (the review round number, same as the progress `pass`) when starting reviewers, including restarts within a round. Verifiers are never started with `--round`.

### 2. Per-round counts and outcome in the Agents API
For each lead in `GET /wheelchair/api/agents`, add `rounds: { review: {<N>: R} }` built from the thread's `progress` cards (including replaced ones) with `stage` `review`. For each pass N, use the latest such card for that pass whose phase is `fixing` or `clean`:
- `fixing` → `found: F`.
- `clean` → `found` = its `found` if present, else 0; `clean: true`.
- Only `checking` cards for that pass → no entry (count unknown).

Per reviewer node add `report: { findings: <int>, first: <string|null> }` parsed from the newest result summary: reviewers count lines starting `SEVERITY:` or `RE-RAISE: SEVERITY:` (strip the `RE-RAISE: ` prefix before parsing) and take the finding text of the first: split on ` — `, drop the first two fields (severity, lens) and the last (evidence), and rejoin the rest with ` — `. A line with too few fields uses everything after the first field. No result → no `report`.

Every node with `state === 'finished'` gets `finished_at`: its `ended_at`, else the `created_at` of its newest result card, else its own `created_at`. The page uses only `finished_at` for finish times.

### 3. Decks on the tree (Hide finished agents OFF)
- Among one parent's children, finished nodes with the same `role` form a deck when there are 2 or more. A single finished node stays a normal box. Live (working, waiting, idle) nodes are never in a deck. Deck eligibility is exactly the node's `state === 'finished'` from the API (not `live`), the same test the page uses today.
- The deck replaces those boxes, placed at the position of its newest member in the existing creation order. The deck is a parent in its own right: the children of all its members are merged into one child list under the deck (sorted by creation), and grouping under it uses the deck as their parent. So the workers of two decked sub-leads can share one deck. This is the meaning of "same parent" for agents under a deck.
- Deck card: role, count (`×40`), one-line title, and "Finished <clock time, HH:MM, same format as `clock()` in viewer/pages/agents.js>" from the latest `finished_at` across all members (§2). Drawn with two offset outlines behind it (CSS only), dashed like finished boxes.
- Title: reviewer → "Plan review · N rounds", with the suffix ", last round clean" when `rounds.review[H]` has `clean: true`. N (the count shown) = number of distinct `round` values among members; H = the highest of them. Members with no `round` are not counted in N; if no member has a round, a reviewer deck uses the other-deck title. Other decks (including verifiers): the newest member's title (role when it has none).
  - No approval tracking: the suffix reports only what round H's progress line says.
- Hide finished agents ON: behaviour unchanged (decks never shown; a selected finished agent and needed ancestors still shown as boxes).

### 4. Round squares
- Reviewer decks with at least one member `round` show one square per distinct round, oldest to newest, wrapping to further lines.
- Color from `rounds.review[N].found`: 5+ red `#d9645a`, 3–4 orange `#e0904a`, 1–2 yellow `#d9c45a`, 0 green `#4ea87b`; no entry → grey, meaning not counted.
- The square row has an accessible label: "<N> rounds; objections went from <first counted> to <last counted>"; with fewer than two counted rounds, "<N> rounds".

### 5. Deck popover
- Clicking a deck (button, keyboard-activatable) opens a popover anchored under it; Escape, clicking outside or clicking the deck again closes it. Only one open at a time. It survives the 5-second refresh (stays open, content updates). The open popover, and any expanded round, is remembered by the name of one member session (the newest at opening); after a refresh it reopens on whichever deck now contains that session (for example after two child decks merge), with the same round expanded if it still exists and "Show all" restored if it was pressed (if the remembered round would fall past the five-row cutoff, the list opens in Show all); if no deck contains it, the popover closes.
- Reviewer decks with rounds list rounds newest first: square, "Round N", "<k> reviewers · <text>". <text> is "1 objection: <first>" when found is 1 and the round's members' reports total exactly one finding line; else "<found> objections" (singular for 1); "no objections" for 0; "not counted" with no entry. A round whose entry has `clean: true` and found > 0 appends " · round clean" (a clean round can still hold counted findings, minor or moved to Deferred, so its square may be yellow or worse while the title says "last round clean"; that is intended). Shows the latest 5 rounds, then a "Show all N rounds" button that expands in place. Members without a round are listed after the rounds as a final group "Other", always shown regardless of the cutoff.
- Opening a round lists its agents (title, finished time); each is selectable exactly like a box: sets `?agent=` and shows that agent in the right panel. The deck containing the selected agent is drawn selected.
- Other decks (verifiers included) list their agents newest first, latest 5 then "Show all N agents", each selectable the same way.
- Works at phone width (popover fits the viewport width).

### 6. Info popout
A `?` button next to "Hide finished agents" opens "How to read this tree": one line on stacked cards; the color key (four colors plus grey "not counted"); two example rows of squares, "Settling down" (red → orange → yellow → green) and "Going in circles" (orange/red alternating). Closes like the deck popover.

### Non-goals
Changing Hide finished agents ON; decking live agents; closed asides; changing how review/verification runs; backfilling rounds for agents started before this change (they show as decks without squares).

### Edge cases
- Question paths (`drawQuestionPaths`, `viewer/pages/agents.js:72-88`): every decked session resolves to its deck's element (the deck carries `data-session` for each member, or a lookup maps member names to the deck); a hop between two members of the same deck is skipped. A live worker's question path through a decked sub-lead still draws its segments to and from the deck. The same member-to-deck mapping applies to the phone path highlight (the classes set on cards and child lists, `viewer/pages/agents.js:125`, `viewer/pages/views.css:183`).
- Restarted reviewer in the same round: both members counted under that round; the reviewer count includes it.
- Dead/stopped sessions with no result count as finished members; no `report`.
- A deck whose members change (one more finishes) updates on the next refresh without closing an open popover.
- Two leads in a thread (old lead's children attach to newest lead today): unchanged; decks follow displayed parent.

### Validation
- `node --test viewer/test/*.test.js` (unquoted glob) passes, with new tests for: `--round` accepted for reviewer, refused for verifier and other roles and bad values, kept on attempt re-run; `rounds` built from progress cards (fixing, clean with and without found, checking-only); `report` parsing for reviewer summaries.
- `npm --prefix viewer run test:browser` passes, with new desktop and phone cases: 3 finished reviewers under one lead show one deck `×3` with squares in the right colors; one finished worker stays a box; 2 finished verifiers show a deck with no squares; a live reviewer is not decked; deck popover lists rounds newest first and selecting an agent opens the right panel; "Show all" expands; `?` popout opens and closes; Hide finished ON shows no decks; with a deck popover open and a round expanded, a poll that adds a finished member keeps the popover and round open and shows the new member.
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
| A finding or gap whose evidence itself contains ` — ` can show part of the evidence in the one-objection text | Reports have no escaping; the line is still counted, only the shown text is longer than ideal | 5 |
| After a lead restart mid-round, a stale report's single finding can be shown as the round's one objection | Rare (restart mid-round with exactly one leftover finding); only the text is wrong, the count and color are right | 2 |

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

### Round 2 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 1:**
- §1: retry/dedupe wording replaced (new session carries its own `--round`).
- §3: deck is the parent for its members' merged children; "then approved" / "passed" defined from approval and later progress cards; API `approved` / `passed` flags; verifier deck title from newest verifier's title.
- §4: accessible label "went from X to Y".
- §5: single-objection text uses only the round's current members.
- Validation: polling case with an open deck.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Retracted approval still earns "then approved" | upheld | §3 now requires an approval not retracted |
| intent | minor | "Current members" timestamp rule is heavier than needed | declined | Rounds normally have two reviewers; the suggested one-member rule would almost never show text, losing the proposal's "objection text when there's one" |
| mechanics | blocking | "Current members" filter excludes the normal cohort (checking is posted after starts) | upheld | Filter removed (§5); the restart case moved to Accepted Risks |
| mechanics | major (RE-RAISE) | All-deferred re-check has no REMEDIATION file, so its attempt number is ambiguous | upheld | §1 numbers attempts from the highest verifier `round` in session list and updates cards.md's `pass` wording; supersedes Round 1's decline of the related finding |
| mechanics | major | N used for both round count and outcome key | upheld | §3 separates N (count) and H (highest) |
| mechanics | major | Withdrawn approval still counts while back in review | upheld | Same fix as intent row (not retracted); discussion-only withdrawal behaviour stated in §3 |
| mechanics | major | Question paths through a decked sub-lead lose segments | upheld | Edge cases: decked sessions resolve to the deck element |
| mechanics | minor | Unanswered retry is retried, not returned unchanged | upheld | §1 wording fixed; stored round never changes |

### Round 3 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 2:**
- §1: unanswered-retry wording; new verification attempt numbering rule (highest verifier `round` + 1) and cards.md `pass` wording.
- §3: N (count) vs H (highest round) separated; "then approved" needs a non-retracted approval; behaviour while an approval is being discussed.
- §5: single-objection text no longer filters by checking time; restart case in Accepted Risks.
- Edge cases: question paths through decked sessions.
- Scope adds `protocol/app/cards.md`.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | "then approved" lingers after a Spec change during Talk about it | accepted-risk | Moved to Accepted Risks: window lasts until the next round starts |
| mechanics | blocking | A replaced approval still satisfies "then approved" | upheld | §3 now uses the current, non-replaced approval |
| mechanics | blocking | Builds straddling the update can reuse verify pass numbers | upheld (moved to Deferred) | Hardening for a one-time transition; Deferred D3 |
| mechanics | major | Invalid `--round` vs dedupe order unclear | upheld | §1: validation runs before dedupe |
| mechanics | minor | Parser skips `RE-RAISE:` findings | upheld | §2 counts and parses them |
| mechanics | minor | Phone path highlight not mapped to decks | upheld | Edge cases extended to phone classes |

### Round 4 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 3:**
- §3: title suffix is now ", last round clean" from round H's progress entry (Decision 12); all approval tracking and the API `approved`/`passed` flags removed; the related Accepted Risk removed.
- §1: invalid `--round` refused before attempt dedupe.
- §2: `RE-RAISE: SEVERITY:` lines counted and parsed.
- Edge cases: phone path highlight maps members to decks.
- Deferred D3 added (builds straddling the update).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | IDEA.md and the proposal still say "then approved" | upheld | IDEA example and Constraint updated (Decision 13) |
| mechanics | blocking | New attempt numbering could rewrite an existing REMEDIATION-N.md | upheld | §1 numbering also counts committed remediation files; D3 narrowed |
| mechanics | minor | Bare `--round` indistinguishable from absent | upheld | §1: wc.js refuses it |
| mechanics | minor | Finding text containing ` — ` truncated | upheld | §2 takes the middle fields rejoined |
| mechanics | minor | Popover anchor lost when child decks merge | upheld | §5 remembers a member session and reopens on its deck |

### Round 5 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 4:**
- IDEA.md example and Constraint now say "last round clean" (Decision 13).
- §1: verification numbering also counts committed REMEDIATION-N.md files; bare `--round` refused by wc.js. D3 narrowed.
- §2: finding/gap text parsing keeps text containing ` — `.
- §5: popover remembered by a member session across refreshes and deck merges.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | "last round clean" next to a yellow/orange square looks contradictory | upheld | §5 popover row appends " · none serious" for clean rounds with minor objections; stated as intended |
| mechanics | major | A sub-lead restart could push the first failure into attempt 2, skipping the "attempt 1 sharpens the brief" rule | upheld | §1: unreported attempt reused on sub-lead restart; sub-lead.md rule reworded to "first remediation" |
| mechanics | minor | Remembered expanded round hidden past the five-row cutoff | upheld | §5 restores Show all |
| mechanics | minor | Evidence containing ` — ` leaks into the shown text | accepted-risk | Accepted Risks; count unaffected |
| mechanics | minor | Deck finish time from newest-created member, not latest finish | upheld | §3 uses latest `ended_at` across members |

### Round 6 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 5:**
- §1: unreported attempt reused by a replacement sub-lead; sub-lead.md first-remediation wording.
- §3: deck finish time is the latest across members.
- §5: " · none serious" (since renamed " · round clean") on clean rounds with minor objections; Show all restored on refresh.
- Accepted Risks: ` — ` inside evidence.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Relative finish time differs from the screen's clock time | upheld | §3 uses clock time like the design |
| mechanics | major | Replacement sub-lead can't tell whether the last attempt has a verdict | upheld | §1 simplified: a replacement always takes a new number; the unreported attempt shows grey. No lookup needed |
| mechanics | major | Surviving verifiers of a dead sub-lead vs the replacement's numbering | upheld | Same simplification: numbering no longer depends on them; their handling is unchanged from today's restart rules |
| mechanics | minor | "none serious" wrong when a major finding moved to Deferred | upheld | Text is now " · round clean" |
| mechanics | minor | "last activity time" fallback undefined | upheld | §3 uses newest result card time, else creation time |

### Round 7 — 2026-11-18

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 6:**
- Decision 14: squares, rounds, `--round`, `rounds.verify` and GAP parsing removed for verifiers; verifier decks behave like worker decks; sub-lead.md and cards.md out of scope; Deferred D3 removed.
- §3: "Finished HH:MM" with fallback via newest result card time.
- §5: " · round clean" text.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | Decision 14 wording suggests verifier decks lost the newest-member title | upheld | Decision 16 clarifies |
| mechanics | major | API lacks the per-member finish time the deck needs | downgraded (minor) | The Spec named the source (newest result card time) and `viewer/app/agents.js` and API.md are in scope, so a worker would add it without stopping; §2 now names `finished_at` explicitly |
| mechanics | minor | Deck eligibility should be `state === 'finished'`, not `live` | upheld | §3 states it |
| mechanics | minor | "Other" group could be hidden by the five-round cutoff | upheld | §5: always shown |

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
| T0 | Add Collin's proposal files unchanged (done by sub-lead: c8a9c9d, 792e07f) | `docs/proposals/app-shell/finished-agents.md`, `design/AgentsFinishedDecks.dc.html` | sub-lead | — | `cmp` against the zip | done |
| T1 | `--round` on reviewer starts; Agents API `rounds`, `report`, `finished_at`; API.md; lead.md step 5 (Spec §1, §2) | `viewer/app/{wc,sessions,routes,agents}.js`, `viewer/app/API.md`, `protocol/app/lead.md`, `viewer/test/*.test.js` | standard · gpt-6.1-terra | wc-d268e3df9c50-worker (t1-a1) | `node --test viewer/test/*.test.js` | done |
| T2 | tricky — decks, squares, deck popover, `?` popout on the Agents page (Spec §3–§6, edge cases) | `viewer/pages/{agents.js,views.css,agents.html}`, `viewer/test/*.spec.js` | standard · claude-sonnet-5-5 | wc-d268e3df9c50-worker-2 (t2-a1) | `npm --prefix viewer run test:browser`; `node --test viewer/test/*.test.js` | done |
| R1 | Remediation 1, G1+G2: refuse non-scalar `round`; relay passes the hub's `detail` reason | `viewer/app/sessions.js`, `viewer/test/app-session-meta.test.js`, `machine/service.js` (forwardSession), `machine/test/service.test.js` | standard · gpt-6.1-terra | wc-d268e3df9c50-worker-3 (r1-a1) | `node --test viewer/test/*.test.js`; `bash machine/test/run.sh` | done |
| R2 | tricky — Remediation 1, G3-G5: one-line deck title, outlines behind the card, popover inside the viewport | `viewer/pages/{agents.js,views.css}`, `viewer/test/app-agents-decks.spec.js` | standard · claude-sonnet-5-5 | wc-d268e3df9c50-worker-4 (r2-a1) | `npm --prefix viewer run test:browser`; `node --test viewer/test/*.test.js` | done |
| R3 | tricky — Remediation 2 (second attempt for G4/G5): popover scroll, phone outlines, wider deck title | `viewer/pages/{agents.js,views.css}`, `viewer/test/app-agents-decks.spec.js` | standard · claude-sonnet-5-5 | wc-d268e3df9c50-worker-5 (r3-a1) | `npm --prefix viewer run test:browser`; `node --test viewer/test/*.test.js` | done |
| R4 | Remediation 3: deck connectors meet the card (drop deck margin); page uses only `finished_at` | `viewer/pages/agents.js:83`, `viewer/pages/views.css` `.agents-deck`, `viewer/test/app-agents-decks.spec.js` | light · claude-haiku-5-5 | wc-d268e3df9c50-worker-6 (r4-a1) | `npm --prefix viewer run test:browser` | done |
| R5 | Remediation 4 (Decision 17): keep page scroll across the Agents refresh, re-place an open popover | `viewer/pages/agents.js` lines 6 and 246, `viewer/test/app-agents-decks.spec.js` | light · claude-haiku-5-5 | wc-d268e3df9c50-worker-7 (r5-a1) | `npm --prefix viewer run test:browser` | done |
| R6 | tricky — Remediation 5 (Decision 18): popover scroll restored after final placement, height capped and clamped on screen; invariant tests | `viewer/pages/agents.js` lines 6, 228, 230-243, 246; `viewer/test/app-agents-decks.spec.js` | standard · claude-sonnet-5-5 | wc-d268e3df9c50-worker-8 (r6-a1) | `npm --prefix viewer run test:browser` | done |
| R7 | Remediation 6 gap 2: refuse a bare `--round` only in flag position | `viewer/app/wc.js`, `viewer/test/app-session-meta.test.js` | light · gpt-6-luna | wc-d268e3df9c50-worker-9 (r7-a1) | `node --test viewer/test/*.test.js` | done |
| R8 | Remediation 6 gap 1 (Decision 19): boundary test, a popover scrolled to the bottom grows on refresh | `viewer/test/app-agents-decks.spec.js` | standard · claude-sonnet-5-5 | wc-d268e3df9c50-worker-10 (r8-a1) | `npm --prefix viewer run test:browser` | done |

Session id = the `thread_id` of a `codex exec` lane, so remediation can resume it.

## Log

Free-form running notes: deviations discovered mid-implementation, scope events,
anything a future session needs that fits nowhere above.

Build accepted: approval 408048b5-0427-443e-9d5e-4fc6d2b09c7d
- 2026-11-18 — Proposal files added unchanged from the upload; not added to `design/canvas.json` (the proposal only says where the screen lives, and the other Agents screens are not in canvas.json either).
- 2026-11-18 — Choice: T1, `viewer/app/sessions.js` round validation: accepts decimal digit strings (CLI) and JSON integers, stores an integer; refuses unsafe integers; the round check runs before the role-permission check.
- 2026-11-18 — Choice: T1, `viewer/app/wc.js`: a value starting with `--` counts as a missing `--round` value, so `--round -1` reaches the hub and is refused there.
- 2026-11-18 — Choice: T1, `viewer/app/agents.js` `finished_at`: the result-card fallback uses the newest result card with a summary (the same card `result_summary` uses).
- 2026-11-18 — Choice: T1, `viewer/app/agents.js` `report`: a reviewer with a result but no finding lines gets `{ findings: 0, first: null }`.
- 2026-11-18 — Choice: T1, `viewer/app/API.md` and `protocol/app/lead.md`: doc wording and placement (round sentence opens step 5).
- 2026-11-18 — T1 accepted (band: scout): diff matches Spec §1-§2 and the brief's test list. The worker's gate failures (`app-quiet` "6 message clears debt", `app-uploads-archive` stalled upload, a held port) are intermittent on the feature branch without T1 as well; re-run here: `app-uploads-archive` 3/3 pass on both branches, `app-quiet` fails 1 of 2 runs on both. Sub-lead fix after merge: empty first-finding text is `null`, not `''` (contract `string|null`); lead.md step 5 line rewrapped.
- 2026-11-18 — Choice: T2, `viewer/pages/agents.js` deck titles: counts pluralise ("1 round", "1 reviewer").
- 2026-11-18 — Choice: T2, `viewer/pages/agents.js` popover: closes when an agent row is picked.
- 2026-11-18 — Choice: T2, `viewer/pages/agents.js` popover: `position: fixed` on `document.body`, repositioned on scroll and resize, so tree zoom and scroll don't clip it.
- 2026-11-18 — Choice: T2, `viewer/pages/agents.js` `?` button: always shown, in a new `.agents-finished-bar` wrapper with the toggle.
- 2026-11-18 — Choice: T2, `viewer/pages/agents.js` popover: the "Other" group uses a dashed empty square; one round expanded at a time.
- 2026-11-18 — Choice: T2, `viewer/pages/agents.js` popover headers: reviewer decks "Plan review · N reviewers" with a "Grouped by round" line; other decks reuse the deck title.
- 2026-11-18 — Choice: T2, `viewer/pages/agents.js` decks: open asides are never decked (they are live; closed asides never reach the tree, Decision 4). (Seen in the diff, not in the report.)
- 2026-11-18 — Choice: T2, `viewer/pages/agents.js` info popout: a second line "Squares are rounds of review..." before the color key; example rows use 9 squares each. (Seen in the diff, not in the report.)
- 2026-11-18 — Choice: T2, `viewer/test/app-views.spec.js`: existing finished-toggle case now expects 4 boxes (was 13) because 10 finished workers stack into one deck.
- 2026-11-18 — T2 accepted (band: self, tricky): diff read in full against Spec §3-§6 and edge cases. Re-run here: `npm --prefix viewer run test:browser` 833 passed, 28 skipped, 1 failed: `app-ui.spec.js:138` (thread page), the test server refused a held port, unrelated to this change, the same port flake T1 met. The worker's report pasted only `exit 0` for the browser run.
- 2026-11-18 — Verification attempt 1 on 6cee582: Claude verifier PASS, GPT verifier FAIL with 5 gaps (REMEDIATION-1.md). The lead said fix all five, defer none, and widened scope for G2 to `machine/service.js` forwardSession plus its test. No Deferred rows saved.
- 2026-11-18 — worker didn't report its choices accurately (wrote "none"); I listed 4 from the scout's read:
- 2026-11-18 — Choice: R1, `viewer/app/sessions.js:602`: digit strings with leading zeros (`"007"`) are accepted.
- 2026-11-18 — Choice: R1, `machine/service.js` forwardSession: a detail counts as present when it is a truthy string (no trim).
- 2026-11-18 — Choice: R1, `machine/test/service.test.js` hubServer: new `answer` option used as the default response body for every route of that fake hub (nothing mutates it).
- 2026-11-18 — Choice: R1, `machine/test/service.test.js`: the new test asserts only the error message, not the status.
- 2026-11-18 — R1 accepted (band: scout): G1 and G2 fixed as briefed. Re-run here: `bash machine/test/run.sh` 170/170 pass. `node --test viewer/test/*.test.js` 639/641; the failures were known `app-quiet` "6 message clears debt" and `routes.test.js` "PUT /wheelchair/graph accepts a remember cookie only from a permitted origin", which passed 22/22 twice when run alone (intermittent, untouched area).
- 2026-11-18 — Choice: R2, `viewer/pages/views.css`: removed `isolation: isolate` from `.agents-deck` (the cause of the outlines painting over the face) and gave the deck an opaque background (`--panel`, `--accent-soft` when selected).
- 2026-11-18 — Choice: R2, `viewer/pages/agents.js` `placePop`: 40px minimum height when neither side has room; deck `aria-label` is "<role> ×N: <full title>".
- 2026-11-18 — Choice: R2, `viewer/test/app-agents-decks.spec.js`: phone viewport 360 → 390 to match the gap's 390×844; the bottom-of-viewport case pushes the deck down with an injected margin.
- 2026-11-18 — R2 accepted (band: self, tricky): G3-G5 fixed as briefed; diff read in full. Re-run here on the merged branch: browser 846 passed, 28 skipped, 0 failed (exit 0); node 640/641 (only the known `app-quiet` case); `bash machine/test/run.sh` 170/170. The worker's 29 "did not run" did not recur.
- 2026-11-18 — Verification attempt 2 on 151b5c2: both verifiers FAIL; 2 distinct gaps (popover scroll = G5 again, phone outlines = G4 again), REMEDIATION-2.md. Lead: fix both, defer neither; fold in a wider deck card (about 280px max) so the example title fits at 1280px. No Deferred rows saved. Second fix attempt for G4/G5.
- 2026-11-18 — Choice: R3, `viewer/pages/views.css`: desktop deck `max-width: 290px` (280px could not fit the example title; brief allowed up to 300px).
- 2026-11-18 — Choice: R3, `viewer/pages/agents.js` `render()`: saves the popover's member and scrollTop in `popKeep` before the full re-render removes it, so the scroll survives the poll.
- 2026-11-18 — Choice: R3, `viewer/test/app-agents-decks.spec.js`: the outline pixel test's empty reference area is 8px above the deck, because the phone deck is full width.
- 2026-11-18 — R3 accepted (band: self, tricky): A (popover scroll), B (phone outlines) and C (wider deck) fixed as briefed; diff read in full. Re-run here on the merged branch: browser 856 passed, 30 skipped, 0 failed; machine 170/170; node 640/641, the failure `app-hub.test.js` "a verifier report survives a failed submit…" passed 114/114 twice alone (intermittent; the file and its code are untouched by this build except one line in sessions.js round validation).
- 2026-11-18 — Verification attempt 3 on ca38d35: Claude verifier PASS; GPT verifier FAIL with 2 new gaps (connector offset from deck margin, `ended_at` fallback), REMEDIATION-3.md. Lead: fix both as one small task. No Deferred rows saved.
- 2026-11-18 — Choice: R4, `viewer/test/app-agents-decks.spec.js` D test: checks geometry (the deck's edges against its branch, and its bottom against the children list) rather than the `::before` connectors, finds the children list by XPath sibling, and checks a `toHaveCount(1)` precondition.
- 2026-11-18 — Choice: R4, `viewer/test/app-agents-decks.spec.js` E test: runs at both viewports, opens the popover by clicking the deck, and adds a control row that does show "Finished HH:MM". (The report left out three of these; the scout listed them.)
- 2026-11-18 — Choice: R4, `viewer/pages/views.css`: removing the deck margin applies to every deck, so the gap between sibling decks drops from 26px to 16px and the outlines overflow into it.
- 2026-11-18 — R4 accepted (band: scout): D and E fixed exactly as briefed; the scout confirmed both new tests fail on the old code. Re-run here: browser 862 passed, 32 skipped, 0 failed (worker branch); node 641/641 (merged).
- 2026-11-18 — Verification attempt 4 on 8f4a9e0: Claude verifier PASS; GPT verifier FAIL with 1 gap, which it ties to G5: on phone the 5-second refresh scrolls the page to the top when no agent is selected (`viewer/pages/agents.js:246`, behaviour from before this build), leaving an open popover off screen. G5 has had two fix attempts, so this went to the lead as a surviving gap (sub-lead.md step 6); the build is waiting on Collin's choice.
- 2026-11-18 — Collin chose option 1 (fix now) for the attempt-4 gap; logged as Decision 17. It changes the Agents page's refresh behaviour beyond decks. REMEDIATION-4.md, task R5.
- 2026-11-18 — Choice: R5, `viewer/pages/agents.js`: `placePopNow?.()` runs at the end of every render, after the side panel is attached. `lastLead` is set on every render, so the first render after load restores nothing.
- 2026-11-18 — Choice: R5, `viewer/pages/agents.js`: the restore condition also keeps the page scroll when Show/Hide finished agents is pressed (same lead, same selection). Before, that jumped to the top when no agent was selected. Not mentioned in the report; the scout found it.
- 2026-11-18 — Choice: R5, `viewer/test/app-agents-decks.spec.js`: the new phone case records only the popover's top, not its whole box, and waits a fixed 5500 ms for a refresh.
- 2026-11-18 — R5 accepted (band: scout): the code is exactly the two dictated edits. I ran the new test against the old `agents.js`: it failed (scroll moved by 1230px), and it passes with the fix. Re-runs on the merged branch: node 641/641. Full browser run under heavy load from another session's tests: 858 passed, 6 failed, all in files this build doesn't touch. Those four files (app-handoff, app-threads, pages, browser) re-run alone: 338 passed, 0 failed.
- 2026-11-18 — Verification attempt 5 on 55abd18: the Claude verifier passed; the GPT verifier failed with 2 popover gaps. Popover scroll reset on refresh: the R5 order of restores. Popover taller than the viewport when its deck is pushed off screen: `placePop` room calculation. These are G5 and Remediation 2 A surviving two fix attempts, so they went to the lead for Collin (sub-lead.md step 6), with three options: one more fix with an invariant test, defer, or close the popover when its deck leaves the screen.
- 2026-11-18 — Collin chose option 1 for the attempt-5 popover gaps: one more fix with an invariant test (Decision 18). REMEDIATION-5.md, task R6.
- 2026-11-18 — Choice: R6, `viewer/test/app-agents-decks.spec.js`: on desktop the agents lay out side by side, so the page-scrolled and off-screen scenarios grow a spacer div above the layout (1000px, then 3000px, with `overflow-anchor: none`) instead of adding workers. Phone uses the real 12 + 12 live workers.
- 2026-11-18 — Choice: R6, `viewer/test/app-agents-decks.spec.js`: scenario 3 checks with `expect.poll` after the refresh that the deck is off screen. The layout change counts as the data change before waiting for the refresh.
- 2026-11-18 — R6 accepted (band: self, tricky): the code is exactly the four dictated edits and I read the test diff in full. The invariant tests fail 6 of 16 on the old code and pass 16 of 16 on the new. Re-run on the merged branch: browser 873 passed, 34 skipped, 7 failed. Six are `app-accounts.spec.js:519/527/534`, which fail identically on the feature branch without R6 (a time-of-day line in thread.js that this build doesn't touch). One is the known `app-handoff.spec.js:227`. Node: 639 of 642 under load 24-30; `app-machines.test.js` and `app-uploads-archive.test.js` pass alone (8/8, 3/3).
- 2026-11-18 — Verification attempt 6 on eacd33d: the Claude verifier passed; the GPT verifier failed with 2 gaps. Gap 1: popover scrollTop clamped from 943 to 806 when the popover grows, which is G5 / Decision 18 surviving and went to the lead for Collin. Gap 2 is new: `wc.js` refuses `--title '--round'`, from the raw-argument scan at wc.js:75. I'm waiting on Collin and the lead for both answers.
- 2026-11-19 — Collin chose (a) for attempt 6's gap 1: reword the invariant (Decision 19), no code change, add a boundary test. The lead said to fix gap 2. REMEDIATION-6.md, tasks R7 (gap 2) and R8 (gap 1).
- 2026-11-19 — Choice: R7, none (the worker reported none; the scout found no design choice beyond the dictated text).
- 2026-11-19 — R7 accepted (band: scout): the diff is exactly the two dictated edits plus the test line. I re-ran app-session-meta and wc-cli: 12 pass, 0 fail. The scout noted the check now also covers `session stop`/`list --round` with no value. This is harmless, because neither takes `--round`.
- 2026-11-19 — Choice: R8, visible-row check: rows are measured against the popover's client box (`clientTop`, `clientHeight`), so borders don't count.
- 2026-11-19 — Choice: R8, visible-row check: only top and bottom are checked, not left and right (found by the scout, not reported).
- 2026-11-19 — Choice: R8, test output: a `console.log` line prints the before and after scrollTop and clientHeight (found by the scout, not reported).
- 2026-11-19 — R8 accepted (band: scout): one new test, 36 lines, no source change, and the existing scenarios are unchanged. I re-ran the deck spec: 78 passed, 6 skipped, in both browsers and both widths. The new case showed phone 997→850 and desktop 1211→894 with the box growing, and the visible rows stayed visible. The worker's full-suite run failed only on app-threads:538 in Firefox, a known-intermittent chat test.
