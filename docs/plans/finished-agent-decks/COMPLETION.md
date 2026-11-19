---
slug: finished-agent-decks
date: 2026-11-18
implemented-by: "T1 standard (gpt-6.1-terra); T2 standard (claude-sonnet-5-5); T0 and two small post-merge fixes by the sub-lead (claude-opus-5-5)"
verified-by: []
---

# Completion Report — Finished agents stack into decks on the Agents screen

Written for a hostile reviewer: every claim checkable, no claim without evidence.

```yaml
verified-by:
  - round: <n>
    lane: <verifier lane/model>
    checks: <the implementing lane it checked>
```

All line numbers are at the commit this report is committed in. Nothing came from Prior Work
(the table was empty); every row is `this run`.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Scope: Collin's proposal files added unchanged | this run | `docs/proposals/app-shell/finished-agents.md`, `docs/proposals/app-shell/design/AgentsFinishedDecks.dc.html` (commits 792e07f, c8a9c9d) | byte-identical to the uploaded zip entries (`cmp`); not added to `design/canvas.json` (PLAN Log) |
| §1 `--round <N>` on `wc.js session start`; bare `--round` refused by wc.js before calling the hub | this run | `viewer/app/wc.js:75` (refusal), `:92` (forwarded), `:100` (compact list field) | `viewer/test/app-session-meta.test.js:122` |
| §1 Hub accepts round for reviewers only; refuses other roles and non-integer / < 1 values with a reason naming the flag; validation before attempt dedupe | this run | `viewer/app/sessions.js:602` (validation, before the dedupe that follows it) | `viewer/test/app-session-meta.test.js:122` (verifier, worker, `0`, `-1`, `1.5`, `abc`) |
| §1 Dedupe hit keeps stored round; new session stores its own start's round | this run | `viewer/app/sessions.js:624` (payload), `:231` (queued), `:296` (started) | `viewer/test/app-session-meta.test.js:122` (re-run with another `--round` keeps the first) |
| §1 `round` in the public session and the Agents API node | this run | `publicSession` passes non-secret fields through (`viewer/app/sessions.js:141`); nodes are built from it (`viewer/app/agents.js` node map) | `viewer/test/app-session-meta.test.js:122` |
| §1 lead.md step 5: pass `--round <N>` for reviewers, restarts included; never for verifiers | this run | `protocol/app/lead.md:253-254` | `viewer/test/protocol-rules.test.js` still passes |
| §2 `rounds.review` per lead from progress cards (replaced included; latest fixing/clean per pass; checking-only → no key) | this run | `viewer/app/agents.js:70-75` (build), `:127` (`rounds: { review }` on the lead) | `viewer/test/app-agents.test.js:132` |
| §2 Reviewer `report: {findings, first}` (SEVERITY / RE-RAISE lines, middle-field text) | this run | `viewer/app/agents.js:117-121` | `viewer/test/app-agents.test.js:145` |
| §2 `finished_at` on finished nodes (ended_at → newest result card → created_at) | this run | `viewer/app/agents.js:122` | `viewer/test/app-agents.test.js:145` |
| §2 API.md documents `round`, `rounds`, `report`, `finished_at` | this run | `viewer/app/API.md:138`, `:142`, `:165` | read |
| §3 Decks: 2+ finished same-role siblings, at newest member's place; singles and live nodes stay boxes; deck is the parent of its members' merged children | this run | `viewer/pages/agents.js:174-181` (`arrange`), `:192-196` (`branch`) | `viewer/test/app-agents-decks.spec.js:23`, `:105` |
| §3 Deck card: role, `×N`, title, "Finished HH:MM" via `clock()` on latest `finished_at`; two offset dashed outlines (CSS) | this run | `viewer/pages/agents.js:183-191` (`deckCard`), `:94-98` (`deckTitle`); `viewer/pages/views.css:144-147` | `viewer/test/app-agents-decks.spec.js:23` |
| §3 Titles: "Plan review · N rounds[, last round clean]" from round H; other decks (verifiers included) newest member's title | this run | `viewer/pages/agents.js:94-98` | `viewer/test/app-agents-decks.spec.js:23` |
| §3 Hide finished ON unchanged (no decks) | this run | `viewer/pages/agents.js:175` (`arrange` returns plain nodes) | `viewer/test/app-agents-decks.spec.js:45`; existing `viewer/test/app-views.spec.js` cases |
| §4 Squares for reviewer decks with rounds, oldest→newest, wrapping; colors; grey "not counted"; accessible label | this run | `viewer/pages/agents.js:81` (colors), `:87-93` (`squares`); `viewer/pages/views.css` `.agents-squares` (flex-wrap) | `viewer/test/app-agents-decks.spec.js:23` (computed colors and aria-label) |
| §4 Verifier decks have no squares (Decision 14) | this run | `viewer/pages/agents.js:94-98`, `deckCard` squares only when `role === 'reviewer'` | `viewer/test/app-agents-decks.spec.js:23` |
| §5 Popover: deck is a button; Escape, outside click, deck click close; one at a time | this run | `viewer/pages/agents.js:44-50` (document handlers), `:183-184` (deck toggle) | `viewer/test/app-agents-decks.spec.js:69` |
| §5 Survives the 5 s refresh, keyed by a member name; reopens on whichever deck holds it; expanded round and Show all restored | this run | `viewer/pages/agents.js:205-229` (`redrawPop`, called at the end of every `render`) | `viewer/test/app-agents-decks.spec.js:91` |
| §5 Rounds newest first; row text ("1 objection: …", counts, "no objections", "not counted", " · round clean"); 5 then "Show all N rounds"; "Other" group always shown | this run | `viewer/pages/agents.js:99-105` (`roundText`), `:214-222` (`roundRow`, round loop, Other at `:221`) | `viewer/test/app-agents-decks.spec.js:52` |
| §5 Agent rows select like a box (`?agent=`, right panel); deck holding the selected agent drawn selected | this run | `viewer/pages/agents.js:211` (`agentRow` → `go`), `:184` (selected class) | `viewer/test/app-agents-decks.spec.js:52` |
| §5 Other decks list agents newest first, 5 then "Show all N agents" | this run | `viewer/pages/agents.js:223-227` | `viewer/test/app-agents-decks.spec.js:69` (worker deck opens) |
| §5 Fits phone width | this run | `viewer/pages/agents.js:230` (`placePop`, width ≤ viewport − 16) | `viewer/test/app-agents-decks.spec.js:52` (bounds check, phone and desktop) |
| §6 `?` button and "How to read this tree": stacked-cards line, color key with grey, "Settling down" and "Going in circles" rows; closes like the popover | this run | `viewer/pages/agents.js:107-116`, `:165-166`; `viewer/pages/views.css:132-140` | `viewer/test/app-agents-decks.spec.js:80` |
| Edge: question paths and phone highlight map member names to the deck; hops inside one deck skipped | this run | `viewer/pages/agents.js:120`, `:125`; `:185` (deck `question-path`); `:196` (child list `question-path-line`) | existing question-path cases in `viewer/test/app-views.spec.js` still pass. No deck-specific path case (see risks) |
| Edge: restarted reviewer in a round counted under it; dead/stopped sessions without result are finished members without `report` | this run | `viewer/pages/agents.js:220` (members filtered by round); `viewer/app/agents.js:117` (report only with a result) | `viewer/test/app-agents.test.js:145` (no result → no report) |

## Deviations from plan

- Titles and row texts pluralise: "1 round", "1 reviewer". The Spec writes "N rounds".
- A reviewer with a result but no finding lines gets `report: { findings: 0, first: null }`
  instead of having no `report`. The Spec says no `report` only when there is no result, so this is consistent.
- The `finished_at` fallback uses the newest result card that has a summary. This is the same card
  `result_summary` already uses.
- The `?` button is always shown, even when the finished toggle is not.
- These choices were logged per task in PLAN.md's Log. None of them changes what the Spec asks to be visible.

## Routers

None. This change moved no ownership, and `viewer/AGENTS.md` already describes `pages/agents.js`, `app/agents.js`
and `app/sessions.js`, `wc.js` in roles that still hold. The new test file
`viewer/test/app-agents-decks.spec.js` falls under `test/` as the router describes it.

## Validation evidence

Run on the merged feature branch at a56bab3, before this report was committed:

```text
$ node --test viewer/test/*.test.js
# tests 641
# pass 641
# fail 0
(exit 0)

$ npm --prefix viewer run test:browser
  ✓  862 [firefox] › test/app-threads.spec.js:925:3 › working indicator › dots show under the chat and the list dot pulses while the lead is mid-turn (5.1s)

  28 skipped
  834 passed (6.1m)
(exit 0)
```

`bash machine/test/run.sh` was not run. The wc.js change adds one field to the start payload,
and the machine service forwards the start body unchanged (`forwardSession` in `machine/service.js`), so no machine-side
forwarding was touched (Spec Validation, third bullet).

Intermittent failures seen during the build and judged unrelated:
- `app-quiet.test.js` "6 message clears debt" failed 1 of 2 runs on the feature branch before T1 too.
- `app-uploads-archive.test.js` failed once in a full run, and passes alone.
- `app-ui.spec.js:138` failed once because the test server refused a held port.

These are recorded in PLAN.md's Log.

## Known gaps / residual risks

- Deferred D1 (keyboard navigation inside the popover) and D2 (backfilling rounds for older sessions)
  are not done, per plan. The popover is rebuilt on every 5 s poll, so keyboard focus inside it is
  lost on refresh. That falls under D1.
- On a phone the popover overlays any decks below it. The test switches decks with a dispatched
  click for that reason.
- No browser case draws a question path through a decked sub-lead. The member-to-deck mapping is in
  code (`viewer/pages/agents.js:120,125`) but is checked only by reading it.
- Accepted Risks in PLAN.md stand: ` — ` inside evidence can lengthen the one-objection text,
  and a stale report after a mid-round lead restart can show the wrong single-objection text.

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.

### Remediation 1 — 2026-11-18

Verification attempt 1, on commit 6cee582: the Claude verifier passed and the GPT verifier failed with five gaps, all recorded in `REMEDIATION-1.md`. The lead chose to fix all five and defer none. For G2 it widened the scope to `machine/service.js` `forwardSession`.

| Gap | Fix | Where | Validated by |
|-----|-----|-------|--------------|
| G1 round value given as a JSON list was accepted | Only an integer number or a string of digits is accepted | `viewer/app/sessions.js:602` | `viewer/test/app-session-meta.test.js:133` (`[2]`, `[[3]]`, `{}`, `true`, `null` refused) |
| G2 the relay dropped the hub's flag-specific reason | The relay prefers the hub's `detail` when it is a non-empty string | `machine/service.js` `forwardSession` (about line 1081) | `machine/test/service.test.js` "a hub refusal detail reaches the agent" |
| G3 deck title wrapped to two lines | One line with an ellipsis; the full title is in the tooltip and in the deck's accessible name | `viewer/pages/agents.js` `deckCard`; `viewer/pages/views.css` `.agents-deck .agents-box-title` | `viewer/test/app-agents-decks.spec.js` "deck title is one ellipsized line…" |
| G4 outlines painted over the deck face | `isolation: isolate` removed; the deck face is opaque; the outlines sit behind it | `viewer/pages/views.css` `.agents-deck` | `viewer/test/app-agents-decks.spec.js` "deck face is opaque…"; checked against a screenshot by the R2 worker |
| G5 popover opened below the screen | Placed below the deck, above it, or on whichever side has more room, with its height capped and its position kept inside the viewport | `viewer/pages/agents.js` `placePop` | `viewer/test/app-agents-decks.spec.js` "popover stays inside the viewport…" (390×844 and 1280×800) |

The lanes were R1 on standard gpt-6.1-terra and R2 on standard claude-sonnet-5-5.

Validation on the merged branch after remediation:

```text
$ npm --prefix viewer run test:browser
  28 skipped
  846 passed (6.2m)
(exit 0)

$ node --test viewer/test/*.test.js
not ok 349 - 6 message clears debt      # known intermittent; app-quiet.test.js passes alone
# tests 641
# pass 640
# fail 1

$ bash machine/test/run.sh
# tests 170
# pass 170
# fail 0
```

Routers: none changed. The `machine/service.js` change keeps that file's existing role.

### Remediation 2 — 2026-11-18

Verification attempt 2 ran on commit 151b5c2, and both verifiers failed it. After merging duplicates there were two gaps: A, the popover could not be scrolled (G5 again), and B, the stacked outlines did not show on phone (G4 again). The lead also added C: widen the deck card so the example title fits at 1280px. The details are in `REMEDIATION-2.md`. This was the second fix attempt for G4 and G5.

| Gap | Fix | Where | Validated by |
|-----|-----|-------|--------------|
| A popover snapped back to the top when scrolled | The scroll listener ignores the popover's own scroll events. `placePop` measures without clearing `maxHeight` and restores `scrollTop`. The scroll position is carried across the 5-second refresh. | `viewer/pages/agents.js` (scroll listener; `render`; `redrawPop`; `placePop`) | `viewer/test/app-agents-decks.spec.js`, "popover scrolls, keeps its scroll across a poll, and a bottom row is clickable" (phone and desktop) |
| B outlines hidden on phone | The deck's branch wrapper gets `isolation: isolate`, so the outlines no longer depend on any ancestor | `viewer/pages/agents.js` `branch`; `viewer/pages/views.css` `.agents-deck-branch` | `viewer/test/app-agents-decks.spec.js`, "stacked outlines are painted outside the deck edge" (pixel comparison, phone and desktop) |
| C example title cut off at 1280px | On desktop the deck is `max-content`, between 190px and 290px wide, and longer titles still end in an ellipsis | `viewer/pages/views.css`, `min-width: 900px` block | `viewer/test/app-agents-decks.spec.js`, "desktop deck title is not truncated for the full example" |

Lane: R3, standard, claude-sonnet-5-5.

Validation on the merged branch:

```text
$ npm --prefix viewer run test:browser
  30 skipped
  856 passed (5.0m)
(exit 0)

$ node --test viewer/test/*.test.js
not ok 258 - a verifier report survives a failed submit and the queue timer retries it   # app-hub.test.js passes 114/114 alone, twice
# tests 641
# pass 640
# fail 1

$ bash machine/test/run.sh
# tests 170
# pass 170
# fail 0
```

### Remediation 3 — 2026-11-18

Verification attempt 3 ran on ca38d35. The Claude verifier passed. The GPT verifier failed with two new gaps, recorded in `REMEDIATION-3.md`. The lead said to fix both.

| Gap | Fix | Where | Validated by |
|-----|-----|-------|--------------|
| D connectors missed the deck by 5px sideways and 10px below | The deck's `margin: 0 10px 10px 0` is removed, so the card fills its branch | `viewer/pages/views.css` `.agents-deck` | `viewer/test/app-agents-decks.spec.js` desktop geometry case (fails on the old CSS) |
| E page fell back to `ended_at` | `finishedAt` reads only `finished_at` | `viewer/pages/agents.js:83` | `viewer/test/app-agents-decks.spec.js` case where a member has `ended_at` but no `finished_at` |

This was done in lane R4 (light, claude-haiku-5-5).

Validation after the fix:

```text
$ npm --prefix viewer run test:browser      # worker branch 5f04746, merged fast-forward
  32 skipped
  862 passed (7.1m)
(exit 0)

$ node --test viewer/test/*.test.js         # merged
# tests 641
# pass 641
# fail 0
```

### Remediation 4 — 2026-11-18

Verification attempt 4 ran on 8f4a9e0. The Claude verifier passed it. The GPT verifier failed it with one gap: on a phone, the 5-second refresh scrolled the page to the top when no agent was selected, which left an open popover off screen. That scroll reset predates this build (`viewer/pages/agents.js:246`). Because it was tied to G5, which had already had two fix attempts, it went to Collin. He chose to fix it now (PLAN.md Decision 17), which changes how the Agents page behaves on refresh beyond decks. See `REMEDIATION-4.md`.

| Gap | Fix | Where | Validated by |
|-----|-----|-------|--------------|
| Phone page jumps to the top on refresh, and the popover is left off screen | The page scroll is restored whenever the refresh shows the same lead with the same selection (none or the same agent). The open popover is then placed again. | `viewer/pages/agents.js` (the `lastLead` declaration on line 6; the restore at the end of `render`) | `viewer/test/app-agents-decks.spec.js` "page scroll and an open popover survive a refresh with no agent selected" (phone). It fails on the old code with a 1230px jump. |

Lane: R5, light, claude-haiku-5-5.

Validation on the merged branch (187260f, plus this report):

```text
$ node --test viewer/test/*.test.js
# tests 641
# pass 641
# fail 0

$ npm --prefix viewer run test:browser      # while another session's suites loaded the machine
  6 failed      # app-handoff:205, app-threads:401/340/538, pages:360, browser:875; none on the Agents page
  34 skipped
  858 passed (8.9m)
$ npx playwright test test/app-handoff.spec.js test/app-threads.spec.js test/pages.spec.js test/browser.spec.js
  338 passed (2.5m)
```

### Remediation 5 — 2026-11-18

Verification attempt 5 ran on 55abd18. The Claude verifier passed. The GPT verifier failed with two popover gaps that had already survived two fix attempts. Collin chose one more fix plus an invariant test (PLAN.md Decision 18). Details are in `REMEDIATION-5.md`.

| Gap | Fix | Where | Validated by |
|-----|-----|-------|--------------|
| Popover scroll reset by a refresh (R5's restore order) | The popover's scroll is restored after its final placement: `popTop` is passed from `redrawPop` to the last `placePopNow` call in `render` | `viewer/pages/agents.js` (the `let` list; the end of `redrawPop`; the end of `render`) | `viewer/test/app-agents-decks.spec.js` "popover invariant across a refresh" (4 scenarios × phone/desktop × Chromium/Firefox = 16; 6 fail on the old code) |
| Popover taller than the viewport when its deck is off screen | `placePop` measures only the room visible above and below the deck, caps the height at the viewport minus margins, and always clamps the box on screen | `viewer/pages/agents.js` `placePop` | same |

Lane: R6, standard, claude-sonnet-5-5.

Validation on the merged branch (fecd632):

```text
$ npm --prefix viewer run test:browser
  7 failed      # app-accounts.spec.js:519/527/534 ×2 browsers (fail identically without this change; time-of-day), app-handoff.spec.js:227 (known intermittent)
  34 skipped
  873 passed (7.0m)

$ node --test viewer/test/*.test.js      # load average 24-30 from other sessions
# tests 642
# pass 639
# fail 2      # app-machines.test.js, app-uploads-archive.test.js: 8/8 and 3/3 when run alone
```

### Remediation 6 — 2026-11-19

Verification attempt 6 ran on eacd33d. The Claude verifier passed. The GPT verifier failed with two gaps. For gap 1, Collin chose to reword the invariant (PLAN.md Decision 19): a popover keeps its scroll position, or the nearest one the box allows, and rows that were visible stay visible. Gap 1 therefore has no code change, only a boundary test. Details are in `REMEDIATION-6.md`.

| Gap | Fix | Where | Validated by |
|-----|-----|-------|--------------|
| 1. Popover scrollTop clamped when the box grows on refresh | No code change (Decision 19). New boundary test: the popover is scrolled to its bottom, the deck moves off screen, and the box grows. The test asserts the box stays inside the viewport, that `clientHeight` grew, that scrollTop equals `min(want, scrollHeight - clientHeight)` ±2, and that every fully visible round is still fully visible | `viewer/test/app-agents-decks.spec.js` "popover scrolled to the bottom grows on refresh" | That test: phone 997→850 (box 642→826), desktop 1211→894 (box 428→782), in Chromium and Firefox |
| 2. `--title '--round'` refused | The bare-`--round` check moved from a raw-argument scan into `flags()`, so it only applies where `--round` is in flag position | `viewer/app/wc.js` `flags()`; the scan in `sessionRequest` removed | `viewer/test/app-session-meta.test.js` "review round is validated before dedupe…" (asserts `--title --round` is accepted and a bare `--round` refused) |

Lanes:
- R7: light, gpt-6-luna.
- R8: standard, claude-sonnet-5-5.

Validation on the merged branch (50764ad):

```text
$ node --test --test-timeout=120000 viewer/test/*.test.js
# tests 629
# pass 628
# fail 0          # app-hub.test.js reported "not ok" at file level under load
$ node --test viewer/test/app-hub.test.js
# tests 114
# pass 114
# fail 0

$ npm --prefix viewer run test:browser
  1 failed        # [chromium] app-threads.spec.js:340 desktop "message box posts and shows queued" (known intermittent)
  34 skipped
  883 passed (5.1m)
$ npx playwright test test/app-threads.spec.js:340
  4 passed (14.5s)
```
