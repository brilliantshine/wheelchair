---
slug: silent-stops
date: 2026-11-15
implemented-by: "standard: codex gpt-6.1-terra (T2 effort medium; T1 attempt 2 effort high, after attempt 1 at medium came back unfinished); integration by the sub-lead (claude-opus-5-5)"
verified-by:
  - round: 1
    lane: claude-opus-5-5 (wc-989abf66ac00-verifier), FAIL on 34a33d6
    checks: codex gpt-6.1-terra (T1, T2)
  - round: 2
    lane: claude-opus-5-5 (wc-989abf66ac00-verifier-2), PASS on 90addd8
    checks: codex gpt-6.1-terra (T1, T2, R1-T2), gpt-6-luna (R1-T1), sub-lead test fixes
---

# Completion Report — Catch agents that stop silently

Written for a hostile reviewer: every claim checkable, no claim without evidence.

Builds: T2 merged at `c122c1d` (plus sub-lead tidy-ups `ac3bf9c`, `2239d10`); T1 merged at
`3e90726`; router row `b8fcbf5`. Worker reports: `docs/plans/silent-stops/reports/T1.md`,
`reports/T2.md`.

## Spec coverage

All rows are origin `this run`; the plan's Prior Work section is empty.

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Terms: watched session (worker, mapper, sub-lead, reviewer, verifier with `started_by`; lead never; finished reviewer/verifier not watched) | this run | `viewer/app/quiet.js:3-5` | app-quiet tests 8, 9 |
| Terms: `owes_reply` set on create with `first_message` | this run | `viewer/app/sessions.js:249` (start), `:113` (resume of an unanswered start) | tests 1, 7 |
| Terms: `owes_reply` set on every successful `deliver()` to a watched session | this run | `viewer/app/sessions.js:344` | tests 13, 15, 18 |
| Terms: `owes_reply` cleared by an accepted `result`/`message` card | this run | `viewer/app/cards.js:81` | tests 3, 5, 6 |
| Terms: cleared by a synthesized reviewer/verifier result | this run | `viewer/app/sessions.js:275` | test 8 (reviewer with text: no nudge, `finished`) |
| Terms: waiting on others (live child that owes a reply, is `status: 'waiting'`, or has a non-empty queue; `finished` not consulted) | this run | `viewer/app/quiet.js:6` | tests 7, 13, 15, 18 |
| Terms: quiet (owes, `turn_ended`, empty queue, no hold, no future `limited_until`, not waiting on others) | this run | `viewer/app/quiet.js:7` | tests 1, 14 |
| Detector 1: arm `quiet_check_at = now + grace` on `turn-ended`, after `deliverReport` | this run | `viewer/app/sessions.js:405`, `viewer/app/quiet.js:12` | tests 1, 5 |
| Detector 1: a successful delivery deletes `quiet_check_at` | this run | `viewer/app/sessions.js:345` | test 16 |
| Detector 2: check on the queue retry timer, per thread under `withThread`, archived skipped, errors caught | this run | `viewer/app/hub.js:60`, `viewer/app/quiet.js:32-58` | all app-quiet tests run through the timer |
| Detector 2: a due check blocked by hold/queue/limit/children is kept and re-checked each tick; deleted when not owed or not live | this run | `viewer/app/quiet.js:42,44` | test 14 |
| Detector 2: stage-2 timer path (`quiet_starter_at + escalate`, live, owes, not waiting; no `turn_ended` needed) | this run | `viewer/app/quiet.js:52` | test 4 |
| Detector 3: 0 → 1 agent nudge tagged `quiet: 'agent'` | this run | `viewer/app/quiet.js:47` | tests 1, 11 |
| Detector 3: 1 → 2 starter nudge tagged `quiet: 'starter'`, `about`; `quiet_starter_at` set on its successful delivery; dead starter → stage 3 | this run | `viewer/app/quiet.js:48-50`, `viewer/app/sessions.js:346` | tests 2, 12 |
| Detector 3: 2 → 3 on a quiet turn waits until the starter was told; dead starter with reminder queued → stage 3 on the next tick | this run | `viewer/app/quiet.js:43,45` | tests 16, 17 |
| Detector 3: stage 3 posts a system `needs` card, id in `quiet_card`; nothing more until reset | this run | `viewer/app/quiet.js:25-31` | tests 3, 4, 17 |
| Detector 4: reset on cleared `owes_reply` (stage 0, delete check/starter times, answer card, remove queued nudges from own and starter queues, `thread.queues` in step) | this run | `viewer/app/quiet.js:13-24`, called at `viewer/app/cards.js:81`, `viewer/app/sessions.js:275` | tests 3, 11 |
| Detector 4: stop and found-ended answer the card, delete the check, remove nudges | this run | `viewer/app/sessions.js:521` (`stopSession`), `:580` (`pollDead`) | test 10 |
| Detector 4: a delivered message does not reset the stage | this run | `viewer/app/sessions.js:344-346` (no stage change) | test 16 |
| Timings: `quietGraceMs`/`quietEscalateMs`, env fallbacks, defaults 30 000/600 000, validated like `queueRetryInterval` | this run | `viewer/app/hub.js:16,41-44` | app-quiet tests use the env settings |
| Texts: agent nudge (worker/mapper/sub-lead), agent nudge (reviewer/verifier), starter nudge with role wording | this run | `viewer/app/quiet.js:8-11` | tests 1, 2, 8 |
| Texts: Collin's card, title and three bodies by path, closing sentence | this run | `viewer/app/quiet.js:25-30` | tests 3, 4 (timer body), 17 (starter-not-live body) |
| Rules: cards.md commands section (own `wc.js`/`card.js` always allowed, default port) and markers section (`[wc:from app]` reminder) | this run | `protocol/app/cards.md:349`, `:338` | protocol-rules.test.js |
| Rules: worker.md, mapper.md: same rule plus blocked-not-silent | this run | `protocol/app/worker.md:11-14`, `protocol/app/mapper.md:12-15` | protocol-rules.test.js |
| Rules: sub-lead.md, lead.md: briefs restricting ports/network/commands exempt own calls, never name the port as off limits; starter-nudge line; sub-lead blocked-not-silent | this run | `protocol/app/sub-lead.md:15-18,61,113`; `protocol/app/lead.md:68-70,357` | protocol-rules.test.js |
| Rules: reviewer.md, verifier.md report-instead-of-silence; `BLOCKED:` and `VERDICT: BLOCKED`/`REASON:` forms; lead.md and sub-lead.md handling | this run | `protocol/app/reviewer.md:12-14,57`; `protocol/app/verifier.md:19-21,60-66`; `protocol/app/lead.md:243,369-371`; `protocol/app/sub-lead.md:203-204` | protocol-rules.test.js (report + silently) |
| Rules: foreground-waiting rule in every watched role, sub-lead exemption for sessions it started | this run | `worker.md:16-17`, `mapper.md:17-18`, `sub-lead.md:20-23`, `reviewer.md:16-17`, `verifier.md:23-24` | protocol-rules.test.js |
| Tests 1-18 in `viewer/test/app-quiet.test.js` | this run | `viewer/test/app-quiet.test.js:27-44` | itself |
| Rules test `viewer/test/protocol-rules.test.js` | this run | `viewer/test/protocol-rules.test.js:12-31` | itself |
| Validation: API.md documents the new session fields and timers | this run | `viewer/app/API.md:146-149` | read |

## Deviations from plan

- The check is `quiet.checkQuiet(hub)` in a new module `viewer/app/quiet.js`, chained after
  `retryQueues` on the same timer (`viewer/app/hub.js:60`), rather than a function named
  `sessions.checkQuiet`. Same timer, same per-thread locking and error handling; only the
  module differs.
- The timer card's minutes are `Math.round(escalate / 60000)`, as specified; at the test
  setting (400 ms) that prints "0 minutes". Default settings print "10 minutes".
- Test 7's waiting-to-start child is written directly into thread state (the hub allows only one
  live sub-lead per thread, and producing a real waiting worker needs provider limits).
- Test 11 needed a per-session submit failure switch in the fake machine
  (`viewer/test/helpers/app-machine.js:207`).

## Routers

`viewer/AGENTS.md`: a row for the new `app/quiet.js` (the quiet-turn detector, run on the
queue retry timer). No other router changed; no ownership moved.

## Validation evidence

Failing-first, rules (T2): `protocol-rules.test.js` committed alone at `cb2d22e`; worker's run
showed 15 of 15 failing (pasted in `reports/T2.md`).

Failing-first, detector (T1), re-run by the sub-lead with the test file at `4b750ca` against the
pre-fix code (a scratch copy made into a git repository, since the test helper reads `HEAD`):

```text
ok 9 - 9 lead is never watched
# pass 1
# fail 17
```

Test 9 guards against watching the lead; the old code never nudged anyone, so it passes before
the fix by nature.

After the merges, on the feature branch:

```text
$ node --test viewer/test/protocol-rules.test.js
# pass 15
# fail 0

$ node --test viewer/test/app-quiet.test.js      (three runs in a row)
# pass 18 # fail 0
# pass 18 # fail 0
# pass 18 # fail 0

$ node --test viewer/test/*.test.js
not ok 285 - a starter that loses the freed port registers through the new holder
# tests 421
# pass 420
# fail 1

$ npm --prefix viewer run test:browser            (run at 21:37 PST)
  6 failed
    [chromium] › test/app-accounts.spec.js:442:3 › lead waiting line › a waiting lead shows when the provider refills
    [chromium] › test/app-accounts.spec.js:450:3 › lead waiting line › a waiting lead pinned to a provider names it when the lead has none
    [chromium] › test/app-accounts.spec.js:457:3 › lead waiting line › a waiting lead with no provider anywhere says it is waiting for room
    [firefox]  (the same three)
  2 skipped
  584 passed (2.3m)

$ TZ=UTC npm --prefix viewer run test:browser
  2 skipped
  590 passed (2.4m)
```

The node failure is the recorded known issue (`docs/known-issues.md:6`) and fails identically
on the pre-build commit `9f7f5b6`. The six browser failures expect "about <digit>" and get
"about Mon 12:38 AM": the tests set a wait three hours out, which crosses local midnight late in
the evening, and the page then shows a weekday. This build changes no page code
(`git diff 9f7f5b6 HEAD -- viewer/pages` is empty); under `TZ=UTC` the whole browser suite passes.

## Known gaps / residual risks

- The "lead waiting line" browser tests (`viewer/test/app-accounts.spec.js:442-462`) fail when
  run within three hours of local midnight. Pre-existing and outside this plan; not recorded in
  `docs/known-issues.md` by this run.
- Test 12 checks that no card appears before the starter reminder is delivered and that one
  appears afterwards, but does not measure the full escalate interval after delivery.
- The tests drive timings of 20-400 ms; a heavily loaded machine could make the "no nudge"
  waits (220 ms) shorter than a delayed tick. Three consecutive runs were stable.
- `viewer/app/quiet.js` is written in a dense one-line style; correct against the Spec as
  reviewed, but harder to read than its neighbours.
- T1 attempt 1's unmerged branch `wc-989abf66ac00-w1` and its worktree remain (the service
  removes only merged worktrees, and nothing here deletes).

## Remediation rounds

### Remediation 1 — 2026-11-15

Verification attempt 1 (`wc-989abf66ac00-verifier`, claude-opus-5-5, on `34a33d6`): FAIL, one
gap: test 5 did not exercise the grace (`REMEDIATION-1.md`).

**Correction to the failing-first evidence above.** The "17 of 18 fail, only test 9 passes"
figure was measured with the test file as first committed (`4b750ca`), where tests 5 and 6 still
expected HTTP 200 instead of 202. With the final test file against the pre-build code, tests 5,
6 and 9 passed (verifier's run). Test 6 is guarded: removing message-clearing makes it fail.

**What changed**

| Item | Change | Where | By |
|------|--------|-------|----|
| Gap: test 5 | Grace 300 ms for this test; the `result` is posted 100 ms after the turn end (several 20 ms ticks), then 500 ms with no submit and `owes_reply` false | `viewer/test/app-quiet.test.js:37` | R1-T1 (`9f7c9a9`, Light, gpt-6-luna) |
| Tests unreliable under load (found by the sub-lead) | `until` waits up to 8 s; holds set and cleared through machine events (`stuck`, `prompt`, `prompt-cleared`); busy states from delivered messages; test 17 has the lead stop the sub-lead through the stop route | `viewer/test/app-quiet.test.js:8`, tests 12, 14, 16, 17, 18 | R1-T2 (`d279dbb`, Standard, gpt-6.1-terra effort high; first attempt at medium stopped at its guardrail) |
| Tests that could not fail (found by the sub-lead's mutation sweep) | `feed` helper (ends turns until the starter's message is delivered and the queue is empty); tests 7, 13, 18 assert the reminder stage and that the lead got no starter reminder; test 7 waits for the lead's message to be delivered before its baseline; test 14 asserts the stage holds at 0 and the check is kept during the hold | `viewer/test/app-quiet.test.js:26-32`, `:39`, `:79`, `:80`, `:84` | sub-lead |

No product code changed in this remediation (`git diff 34a33d6 HEAD -- viewer/app` is empty).

**Mutation evidence.** Each rule below was removed from `viewer/app/quiet.js` (or, for the
starter time, moved from delivery to enqueue in `quiet.js` and `sessions.js`), the named test
run, and the file restored with `git checkout`:

| Rule removed | Test | Result |
|--------------|------|--------|
| grace (arm at `Date.now()`) | 5 | not ok |
| child waiting to start counts as outstanding | 7 | not ok |
| child that owes a reply counts as outstanding | 13 | not ok |
| child with queued work counts as outstanding | 18 | not ok |
| `needs_open` hold | 14 | not ok |
| `quiet_starter_at` set at delivery, not enqueue | 12 | not ok |
| 2 → 3 waits until the starter was told | 16 | not ok |
| queued nudges removed on reset | 11 | not ok |
| dead-starter path | 17 | not ok |
| timer path | 4 | not ok |
| card answered on reset/stop | 3, 10 | not ok |

Removing `s.started_by &&` or the finished-reviewer clause from `quiet.js:5` changes nothing
observable: the lead is excluded by role as well, and a reviewer's synthesized result already
clears `owes_reply`. These are redundant guards, not test gaps.

**Validation after Remediation 1** (feature branch, test file as committed with this section):

```text
$ for r in 1 2 3; do for i in 1 2 3 4; do node --test viewer/test/app-quiet.test.js > q-$r-$i.txt 2>&1 & done; wait; done
round 1: 0 failures, 4 of 4 logs at 18 pass
round 2: 1 failures, 3 of 4 logs at 18 pass
round 3: 0 failures, 4 of 4 logs at 18 pass
```

Round 2's one failure is test 5 failing in setup, before any of its steps ran:
`server exited before ready (1): Refused to use a port held by a process it cannot identify.`
Two concurrent copies picked the same free port in the shared helper
(`viewer/test/helpers/server.js:54`); the fake machine that `setup()` had already started was
then never closed, so that process hung after its last test and was stopped by hand. That run's
other 17 tests passed. This is the shared helpers' port choice under four simultaneous copies of
one file, the same family as the known freed-port issue, and not something this build changed.

```text
$ node --test viewer/test/*.test.js      (twice)
not ok 285 - a starter that loses the freed port registers through the new holder # tests 421 # pass 420 # fail 1
not ok 285 - a starter that loses the freed port registers through the new holder # tests 421 # pass 420 # fail 1

$ TZ=UTC npm --prefix viewer run test:browser      (22:21 PST)
  2 skipped
  590 passed (2.3m)
```

**Residual risks added by this round**

- Shared test helpers can collide on a port when several app test files start servers at the
  same instant, and a failed `setup()` leaks the fake machine server, which keeps the test
  process alive. Pre-existing, in `viewer/test/helpers/`, outside this plan.
- Test 7 writes its waiting-to-start child into thread state directly (the hub makes one only
  under provider limits), with a write-and-confirm helper; it is the one remaining direct state
  write in `app-quiet.test.js`.
