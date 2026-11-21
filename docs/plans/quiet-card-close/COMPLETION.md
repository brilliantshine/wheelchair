---
slug: quiet-card-close
date: 2026-11-21
implemented-by: "T1 standard gpt (gpt-6.1-terra); T2 standard claude (claude-sonnet-5-5); sub-lead claude-opus-5-5"
verified-by:
  - round: 1
    lane: gpt / gpt-6.2-sol (PASS)
    checks: T1 gpt, T2 claude
  - round: 1
    lane: claude / claude-opus-5-5 (FAIL, 1 gap)
    checks: T1 gpt, T2 claude
  - round: 2
    lane: claude / claude-opus-5-5 (PASS)
    checks: T1 gpt, T2 claude, R1 gpt
  - round: 2
    lane: gpt / gpt-6.2-sol (FAIL, 1 gap)
    checks: T1 gpt, T2 claude, R1 gpt
---

# Completion Report — Close the "agent stopped without reporting" card

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 starter message closes the quiet card (on acceptance, same thread, `started_by`, only when `quiet_card` set) | this run | `viewer/app/cards.js:167` | `viewer/test/app-quiet.test.js:93` (held delivery, message stays queued), `:113` (no card: stage unchanged), `:126` (app messages do not close) |
| S1 child start closes the quiet card (new/waiting, duplicate, `resumeUnanswered`; saved under the thread lock; throw changes nothing) | this run | `viewer/app/sessions.js:694-699,701,724` | `viewer/test/app-quiet.test.js:103` (new, duplicate on fresh read, refused), `:117` (unanswered retry) |
| S1 dismissed card rearms after either event | this run | same as above (`quiet.reset` when `quiet_card` set, answered or not) | `viewer/test/app-quiet.test.js:132` |
| S1 existing closers unchanged | pre-existing | `viewer/app/cards.js:158-161`; `viewer/app/sessions.js` stop/death paths | existing `viewer/test/app-quiet.test.js:33-84` |
| S2 blocking rule (live session, `needs_card` = id, `needs_open`) | this run | `viewer/app/card.js:238-240` | `viewer/test/app-hub.test.js:1805`, `:2220` |
| S2 hub dismiss: non-blocking system needs resolved by user "Dismissed", no enqueue; blocking 422; answered 422; non-system unchanged; frozen first | this run | `viewer/app/threads.js:440-453` | `viewer/test/app-hub.test.js:1805` (held card 422, `needs_open`/`permission_open` unchanged), `:2220` (quiet + Session ended dismissed, lead gets nothing, stale and stopped-session holds dismissable) |
| S2 read-time `blocking` flag, not stored | this run | `viewer/app/chat.js:412-416` | `viewer/test/app-hub.test.js:1805` (flag in view, absent from stored card) |
| S2 lead resolve/retract still refuse system cards; press route still refuses | pre-existing | `viewer/app/card.js` `resolvable`/`retractable`; `viewer/app/threads.js:394` | existing `viewer/test/app-hub.test.js:1743`, `:2087` |
| S2 thread page Dismiss button (after Open terminal, one row, disabled when archived, errors like presses) | this run | `viewer/pages/thread.js:765-778` (`dismissCard`), `:1032-1041` | `viewer/test/app-needs.spec.js:30`, `:39` (click dims, "Dismissed"; held card has no Dismiss) |
| S2 Needs-you count drops a dismissed card | pre-existing | `viewer/app/views.js:140-149` (counts only unanswered) | covered by resolution to answered |
| S2b project-tools card stays dismissed for same names; report still refreshes; name change reposts | this run | `viewer/app/sessions.js:174-175` | `viewer/test/app-project-tools-card.test.js:224` |
| S3 docs | this run | `protocol/app/cards.md:70` (one sentence), `protocol/app/cards-lead.md:90,327`, `viewer/app/API.md:23`, `docs/maps/system-needs-quiet.md:16,29` | read |

## Deviations from plan

None in behaviour. Small choices outside the briefs are in PLAN.md's Log (T1: 6, T2: 5). One visible difference from before: dismissing a replaced system needs card returns 422 `card is already answered` rather than 404.

## Routers

None — this change moved no ownership and no router named a file it touched.

## Validation evidence

On the feature branch at `91957977` (both tasks merged):

```text
$ node --test viewer/test/*.test.js
# tests 789
# pass 789
# fail 0
```

```text
$ npm --prefix viewer run test:browser
  2 failed
    [chromium] › test/app-threads.spec.js:567:5 › desktop › approval: Re-check button shows while not Ready
    [firefox] › test/app-threads.spec.js:538:5 › desktop › approval: Start building enabled when Ready and presses; offer press
  34 skipped
  1162 passed (13.9m)
```

The two failures are unrelated to this change: the chromium one is `server exited before ready (1): Refused to use a port held by a process it cannot identify.` (port collision); the firefox one is a 30 s `waitForRequest` timeout on the offer press, a different test in each browser. Re-run:

```text
$ npm --prefix viewer run test:browser -- app-threads.spec.js -g "approval"
  16 passed (11.5s)
```

```text
$ npm --prefix viewer run test:browser -- app-needs.spec.js
  4 passed (3.1s)
```

The T2 worker also reported a full browser run of 1164 passed.

## Known gaps / residual risks

- The stopped-session hold test (`viewer/test/app-hub.test.js:2220`) builds a stopped session object directly rather than going through the real stop path.
- The "enqueues nothing" assertion checks only that the card id is not in the lead's queue.
- No test for a child start that returns `waiting`, or for a cross-thread message (code path at `viewer/app/cards.js:167` sits inside the same-thread branch).
- `dismissCard` (`viewer/pages/thread.js:765`) does not mark the card answered before the refresh, unlike `press`; if the refresh fails, a second click gets a 422 shown as an error.

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.

### Remediation 1

Gap (Claude verifier, attempt 1): the new test "dismissed quiet episode rearms the ladder after starter message or child start" (`viewer/test/app-quiet.test.js`) was flaky under load. It edited the thread and called `checkQuiet` through a second Hub outside the server's thread lock, racing the server's 20 ms retry timer. Product code unchanged.

Fix (R1, gpt standard, second attempt at effort xhigh): the test now drives the ladder through real turn-ended events, using `feed` so each session is mid-turn with an empty queue before its ladder. It waits on the agent reminder, the starter reminder and a new unanswered quiet card with a different id. Worker case: starter message reset. Sub-lead case: child start reset, with the lead as starter.

Evidence (sub-lead re-run):

```text
$ for r in 1 2; do for i in 1 2 3 4 5 6; do node --test viewer/test/app-quiet.test.js > q-$r-$i.log 2>&1 & done; wait; grep -h '^# fail' q-$r-*.log | sort | uniq -c; done
      6 # fail 0
      6 # fail 0
$ node --test viewer/test/*.test.js
# tests 789
# pass 789
# fail 0
```

### Remediation 2

Gap (GPT verifier, attempt 2): the duplicate-start case in "child starts reset quiet card on new and duplicate starts, but not refusal" (`viewer/test/app-quiet.test.js`) seeded an already-dismissed card, so closing an open card on the duplicate branch was untested. The verifier confirmed the behaviour by a direct API check; product code unchanged.

Fix (R2, gpt light): the duplicate start now runs against an open quiet card and asserts `duplicate: true`, `quiet_card` cleared, `quiet_stage` 0 and the card answered on a fresh read (`viewer/test/app-quiet.test.js:109-113`).

Evidence (sub-lead re-run after merge):

```text
$ node --test viewer/test/app-quiet.test.js
# pass 24
# fail 0
$ node --test viewer/test/*.test.js
# tests 789
# pass 789
# fail 0
```

