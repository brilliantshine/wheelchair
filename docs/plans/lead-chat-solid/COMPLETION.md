---
slug: lead-chat-solid
date: 2026-11-22
implemented-by: "T1 backend: standard / gpt-6.1-terra; T2 thread lines: standard / claude-sonnet-5-5; T3 protocol text: light / gpt-6-luna (attempt 2 at effort xhigh); T4 extra tests: standard / gpt-6.1-terra; T5 test 7 tightening: light / gpt-6-luna; sub-lead: claude-opus-5-5"
verified-by: []
---

# Completion Report — Make lead-to-lead chat solid

Written for a hostile reviewer: every claim checkable, no claim without evidence. Line numbers are at commit 2d73476e plus this report's commit. The plan has no Prior Work section, so every row is `this run`.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 acceptance: "no live lead right now" refusal removed; `to` must still name a lead session of the target (live or ended); other checks kept | this run | viewer/app/cards.js:155-163 (checks kept), refusal line removed | app-lead-messages.test.js:23 (refusals), :96; S6 grep (below) |
| S1 delivery step: latest live lead, else latest lead session; entry with `peer` pushed to the session queue and `thread.queues`; deliver only when live; returns `{name, held}` | this run | viewer/app/hub.js:201-216 (peer field :209, held :211, deliver :213) | app-lead-messages.test.js:96, :106 |
| S1 held message reaches the next lead after the restart context (normal and imported) | this run (no change to restartLead's queue move) | viewer/app/threads.js:161-171 (imported), :182-197 (normal) | app-lead-messages.test.js:160 (end to end, normal); app-handoff-restart.test.js:238 (both paths) |
| S1 receipt: `acceptCard` returns `held: true`; card.js prints `"held":true` | this run | viewer/app/hub.js:216; viewer/app/card.js:329; machine relays body unchanged (machine/service.js ~2301-2303, untouched) | card-receipt.test.js:17; app-lead-messages.test.js:96 |
| S1 hand-off and archive: held entries ignored by the busy check and deleted on export, Advance and archive | this run | viewer/app/peer-log.js:5-12 (heldEntry, dropHeld); viewer/app/handoff.js:98, :166; viewer/app/handoff-ops.js:104; viewer/app/threads.js:246 | app-handoff-restart.test.js:248 (export, archive, non-peer busy control) |
| S1 first contact unchanged (`lead: null` in session leads) | this run (no change; listLeads untouched) | viewer/app/peers.js not modified | git diff main...HEAD -- viewer/app/peers.js is empty |
| S2 pause: since = `user_at`, `peer_pauses`, 20 sent within 60 min after since, exact refusal, one `limit` entry per pause, written before the 422, no card stored | this run | viewer/app/cards.js:164-176 (refusal text :174, pause :171); refusal raised after the sender update completes | app-lead-messages.test.js:117, :132, :149 |
| S2 constants `PAIR_LIMIT`, `PAIR_WINDOW_MS` in one place, exported | this run | viewer/app/peer-log.js:2-3, :13 | app-lead-messages.test.js:117 |
| S3 `peer_log` shape, capped at 200; `sent` at acceptance; `received` only after successful submit | this run | viewer/app/peer-log.js:4; viewer/app/cards.js:182; viewer/app/sessions.js:537 | app-lead-messages.test.js:96, :176 |
| S4 restart context `cross_thread_messages` (last 20 sent/received, after import cutoff, omitted when empty) | this run | viewer/app/threads.js:148-149 | app-hub.test.js:2237-2247 |
| S4 lead.md rule: cross_thread_messages is background | this run | protocol/app/lead.md:895 | protocol-rules.test.js; read |
| S5 chat `peer` items: cutoff before fold, 30-minute fold, limit items, no text, interleaved | this run | viewer/app/chat.js:388-422, :444 | app-chat.test.js:426 |
| S5 render as `ctx` line with link, textContent only | this run | viewer/pages/thread.js:660-668 | app-peer-lines.spec.js:12 (Chromium, Firefox) |
| S5 `[wc:from ...]` turns stay hidden | this run (unchanged) | viewer/app/chat.js:127 | app-chat.test.js:426 (hidden text absent); app-lead-messages.test.js:56 |
| S6 cards.md: held receipt, message section, pause | this run | protocol/app/cards.md:37, :160-161 | read; S6 grep |
| S6 lead.md: Overlap held rule, Message limit bullet | this run | protocol/app/lead.md:745, :747 | protocol-rules.test.js |
| S6 grep for stale wording | this run | — | grep below |

## Deviations from plan

- Test 8 lives in a new file, viewer/test/app-peer-lines.spec.js, not browser.spec.js: browser.spec.js is the graph-editor suite and has no thread-page server (T2 choice, logged).
- Test 1's restart half is split: the end-to-end normal-path case is in app-lead-messages.test.js:160 and both restart paths are in app-handoff-restart.test.js:238.
- `held` is attached in Hub.acceptCard (viewer/app/hub.js:216) rather than cards.acceptCard; the receipt is the same.
- Every other worker choice is in the PLAN.md Log ("Choice:" lines).

## Routers

viewer/AGENTS.md:18 gains a row for the new module `app/peer-log.js` (peer message limits, log retention and held-queue cleanup). viewer/app/API.md documents the `held` receipt. No other router changed.

## Validation evidence

`node --test viewer/test/app-lead-messages.test.js viewer/test/app-hub.test.js viewer/test/app-chat.test.js viewer/test/app-handoff-restart.test.js viewer/test/card-receipt.test.js viewer/test/protocol-rules.test.js`

```text
# tests 209
# suites 0
# pass 209
# fail 0
# cancelled 0
exit 0
```

`node --test viewer/test/*.test.js`

```text
# tests 844
# suites 0
# pass 844
# fail 0
# cancelled 0
exit 0
```

`npm --prefix viewer run test:browser`

```text
  34 skipped
  1278 passed (16.5m)
exit 0
```

`grep -rn "no live lead right now" viewer machine protocol --exclude-dir=test`

```text
(no output, exit 1)
```

`bash machine/test/run.sh`: run as a whole it hangs after 553 passing tests (killed at 500 s and 580 s), on the feature branch both before and after this build's code. Run file by file (`for f in machine/test/*.test.js; do timeout 150 node --test $f; done`), nothing hangs; 46 of 48 files pass, and only these fail:

```text
machine/test/win.test.js rc=1 pass=5 fail=16
machine/test/win-tool-ready.test.js rc=1 pass=4 fail=2
error: 'wslpath failed: Error: spawnSync wslpath ENOENT'
```

The same two files fail the same way on main 7204dd2a (the canonical clone), and `git diff --stat main...HEAD -- machine` is empty: an environment gap (no `wslpath` on this Linux host), not this build.

## Known gaps / residual risks

- Accepted Risks in PLAN.md stand (not fixed, by decision).
- A message sent while the target lead is `pending` (mid-restart) waits in that pending queue: the receipt says `held: true`, it counts toward the target's "lead is busy" and is not dropped on hand-off until delivered (viewer/app/hub.js:205-211, peer-log.js:5). It is delivered when that lead starts.
- The `received` text is recovered by slicing the generated marker prefix (viewer/app/sessions.js:537); a change to the marker format must change both places.
- Earlier in the build the browser suite showed 8 failures in app-accounts.spec.js "lead waiting line" (a time-of-day date format) on the branch before T2; the final run above passed them all. They are time-dependent and unrelated.

## Remediation rounds

### Remediation 1 (after verification attempt 1, at d8b87e12)

Verification 1: Claude verifier (claude-opus-5-5) PASS; GPT verifier (gpt-6.2-sol) FAIL with three gaps (REMEDIATION-1.md). One was a rare path (a flood of other entries evicting counted sends from the 200-entry peer_log) and is in PLAN.md Accepted Risks, round verification-1. Two were fixed:

| Gap | Fix (file:line) | Lane | Validated by |
|-----|-----------------|------|--------------|
| A held message survived archive on a lead that was live until the archive | viewer/app/threads.js:252 (dropHeld now runs after the success path marks sessions ended) | light / gpt-6-luna | viewer/test/app-handoff-restart.test.js:267-279 |
| A held message counted toward the "N queued: waiting for the lead to finish its turn" note | viewer/app/chat.js:465 (held entries excluded from `queued`) | light / claude-haiku-5-5 | viewer/test/app-chat.test.js:459-477 |

Validation after remediation:

```text
focused (same six files as above): # tests 211 # pass 211 # fail 0  exit 0
node --test viewer/test/*.test.js: # tests 846 # pass 846 # fail 0  exit 0
npm --prefix viewer run test:browser:  34 skipped  1278 passed (17.5m)  exit 0
grep -rn "no live lead right now" viewer machine protocol --exclude-dir=test: no output, exit 1
```

machine/ is unchanged by the remediation; the machine evidence above stands.
