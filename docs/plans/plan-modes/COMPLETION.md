---
slug: plan-modes
date: 2026-11-18
implemented-by: "standard / gpt-6.1-terra (T1 two attempts, T2); light (T3); sub-lead: claude-opus-5-5"
verified-by: []
---

# Completion Report — Plan modes: thorough, two-part, proof of concept

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

All rows: origin `this run` (Prior Work was empty).

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Modes: three values in IDEA.md `mode:`; missing/unknown means thorough; meaning of each mode | this run | protocol/templates/IDEA.md:4; protocol/app/lead.md:143, :207-210 | read-through (T2 report) |
| Hardening definition; never defer what builds the wrong thing or is needed to work | this run | protocol/app/lead.md:225-226 | read-through |
| Choosing the mode: question card after the offer, leaning + why, draft IDEA.md committed on answer, unclear/no choice = thorough, IDEA confirmation waits | this run | protocol/app/lead.md:138-143 | read-through |
| Restart before IDEA.md: recover the mode from cards / recent messages; post the question if never posted | this run | protocol/app/lead.md:501-506 | read-through |
| Changing the mode: before PLAN.md (logged at creation), to thorough in one commit + retract, thorough→lighter, between lighter (repost), `user` not `idea-change` | this run | protocol/app/lead.md:178, :212-221 | read-through |
| Change during a running round waits for triage, goes into next "Changed since" | this run | protocol/app/lead.md:219-221 | read-through |
| Change or pull-back after approval retracts approval, back to ready-for-review; latest-approval-only press rule only after a change | this run | protocol/app/lead.md:240-245 | read-through |
| `Build accepted: approval <id>` commit, lock pin, then start sub-lead; fixed from then | this run | protocol/app/lead.md:348-352, :245 | read-through |
| Restart: pin reconciled with `mode:` before Build accepted; approved + Build accepted → lock and start; else fresh approval; thorough unchanged | this run | protocol/app/lead.md:508-514 | read-through |
| PLAN.md `## Deferred` section and table; source values; notes | this run | protocol/templates/PLAN.md:53-58; protocol/app/lead.md:223-226 | read-through |
| Pull-backs: `Pulled back:` entries, never re-deferred, logged even if row gone, repeats ignored, `Pending pull-back:` during a round, matching by exact bullet text, one text per item | this run | protocol/app/lead.md:227-238 | read-through |
| Restart replays pending pull-backs and `removed:` presses using `card_kinds`; restarts a running round with fresh reviewers, same number, only its own reports; applies pending mode changes | this run | protocol/app/lead.md:516-522 | read-through |
| `deferred` card kind: lead only, fields `mode`/`bullets`/`locked`, unique ids and texts, unknown fields refused | this run | viewer/app/card.js:13, :28, :78-84 | viewer/test/app-hub.test.js:2110 |
| Pinned singleton; a second replaces the first; stays pinned after Start building | this run | viewer/app/cards.js:9; viewer/app/chat.js:247 (only `idea` hidden, unchanged) | app-hub.test.js:2110 |
| `removed` press on deferred reaches the lead as `[card <id>] removed: <text>` and does not set `answered` | this run | viewer/app/threads.js:334; viewer/pages/thread.js:454 | app-hub.test.js:2110 |
| Hub refuses `removed` on other kinds or non-matching text (400), on locked deferred (422); replaced/retracted already refused | this run | viewer/app/threads.js:287-289 | app-hub.test.js:2110 |
| `deferred` retractable; retract removes it from the pins | this run | viewer/app/card.js:226-227 | app-hub.test.js:2110 |
| Rendering: headings, hints, "Nothing deferred yet", fold over three (own fold state), "Pull back in" ×, no buttons when locked/archived/retracted, withdrawn dimmed | this run | viewer/pages/thread.js:8, :25, :552-578, :866 | viewer/test/app-threads.spec.js:30 |
| Restart context `card_kinds` (all cards, replaced included) | this run | viewer/app/threads.js:132 | app-hub.test.js:2146 |
| Restart context `stub_summary` (summary only, no commits line); lead.md says background only | this run | viewer/app/threads.js:133; protocol/app/lead.md:501-502 | app-hub.test.js:2146 |
| Card docs: kind table, `deferred` section, retract refusal list, `removed` refusals | this run | protocol/app/cards.md:39, :57; protocol/app/cards-lead.md:33-43, :256 | viewer/test/protocol-rules.test.js |
| Plan review in lighter modes: brief names mode + Deferred as settled; reviewer rule; upheld-needed item folded back; hardening moved to Deferred; clean test ignores deferred findings | this run | protocol/app/lead.md:265-271; protocol/app/reviewer.md:26-27 | read-through |
| Verification: verifier brief names the mode + Deferred table; Deferred out of scope | this run | protocol/app/sub-lead.md:232; protocol/app/verifier.md:31 | read-through |
| Verification deferral steps 1-4: one message listing every gap marked hardening/must-fix/surviving; save + commit + message; remediation only on remaining; one all-deferred re-check with Log line | this run | protocol/app/sub-lead.md:243-255; protocol/app/lead.md:377-379 | read-through |
| Second all-deferred failure: question "Fix them" / "Defer them and finish" with Log line and `result` | this run | protocol/app/sub-lead.md:254-259; protocol/app/lead.md:382-384 | read-through |
| Surviving gap first; hardening saved before stopping; continuation after Collin's answer | this run | protocol/app/sub-lead.md:261-263; protocol/app/lead.md:380-382 | read-through |
| Never deferrable: failing validation command, pulled-back item | this run | protocol/app/sub-lead.md:247-248; protocol/app/lead.md:378-379 | read-through |
| Sub-lead restart in `verifying`: read Log first, finish or re-verify on tip, skip steps 2-3; lead's brief carries unlogged answers | this run | protocol/app/sub-lead.md:31-38; protocol/app/lead.md:500-501 | read-through |
| Pin reconciled from PLAN.md before done | this run | protocol/app/lead.md:385 | read-through |
| Done two-part: stub after done with exact first line, contents, depends_on_parent; no rows = no stub + note | this run | protocol/app/lead.md:398-404 | read-through |
| Done proof-of-concept: `left_as_is` lists Deferred; "defer and finish" noted | this run | protocol/app/lead.md:404-406 | read-through |
| Restart in a done two-part thread: finish step 8, then post the stub only if no marker stub exists | this run | protocol/app/lead.md:522-524 | read-through |
| Thorough unchanged | this run | every new lead.md rule is conditioned on a lighter mode or a change; T2 report read-through | read-through |

## Deviations from plan

- The hub refuses a locked `deferred` press with 422 and a kind/text mismatch with 400; the Spec says "same refusal shape as other stale presses" (422 is what the other stale presses use) and "400 with a reason" respectively. Matches.
- The retract refusal message was reworded for every kind to add `deferred` (viewer/app/card.js:227); the meaning is unchanged.
- `stub_summary` is set whenever `thread.context` exists (stub threads are the only ones that have it).
- Otherwise none.

## Routers

None — this change moved no ownership and no router named a file it touched.

## Validation evidence

On the feature branch at the merge of all three tasks:

`node --test viewer/test/*.test.js` (exit 0):
```
# tests 538
# suites 0
# pass 538
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

`npm --prefix viewer run test:browser`, second full run (exit 0):
```

  28 skipped
  732 passed (3.3m)
```
The first full run had 1 failure, in `test/app-sudo.spec.js:87` (firefox, phone: "every outcome state shows its result and drops the buttons"), a spec this build did not touch. That spec then passed 3 runs out of 3 on its own (28/28 each), and the full suite passed on the re-run above. I read it as a load-timing flake.

`node --test viewer/test/protocol-rules.test.js`:
```
# tests 33
# pass 33
# fail 0
```

Read-through per mode: docs/plans/plan-modes/reports/T2.md ("Read-through").

## Known gaps / residual risks

- Protocol behaviour (the lead's, sub-lead's, reviewer's and verifier's rules) is prose; it is checked by read-through, not by tests.
- `deferredOpen` is one global flag, not reset when the deferred card is replaced; a new card opens expanded if the last one was.
- Repeated presses on the same deferred bullet each queue a message; the lead treats repeats as no-ops (Spec "Matching is by bullet text").
- The Accepted Risks in PLAN.md stand (crash-timing cases, replacement lead missing a live sub-lead's result, duplicate follow-up stub after a partial save).

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.
