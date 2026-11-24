---
slug: fix-others-prs
date: 2026-11-23
implemented-by: "T1 standard (claude-sonnet-5-5); T2 light (gpt-6-luna); T3 standard (gpt-6.1-terra); T4 standard (claude-sonnet-5-5); sub-lead claude-opus-5-5"
verified-by:
  - round: 1
    lane: top (claude-opus-5-5) PASS
    checks: T1-T4 (claude-sonnet-5-5, gpt-6-luna, gpt-6.1-terra)
  - round: 1
    lane: top (gpt-6.2-sol) FAIL
    checks: T1-T4 (claude-sonnet-5-5, gpt-6-luna, gpt-6.1-terra)
  - round: 2
    lane: top (claude-opus-5-5) PASS
    checks: R1-1 (gpt-6-luna) and the build
  - round: 2
    lane: top (gpt-6.2-sol) FAIL
    checks: R1-1 (gpt-6-luna) and the build
  - round: 3
    lane: top (claude-opus-5-5) PASS
    checks: R2-1 (gpt-6-luna) and the build
  - round: 3
    lane: top (gpt-6.2-sol) FAIL (both gaps judged rare paths; Accepted Risks)
    checks: R2-1 (gpt-6-luna) and the build
---

# Completion Report — Fix other people's pull requests

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

All items were built in this run; Prior Work was empty.

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| §1 `permit` schema: lead-only, shown, fields `pr_url` + `why` only | this run | `viewer/app/card.js:19`, `:39`, `:124` | `viewer/test/app-permit.test.js:31` |
| §1 retractable, refusal text `... reach or permit card can be retracted` | this run | `viewer/app/card.js:280-281` | `viewer/test/app-hub.test.js:2106`; `app-permit.test.js:137` |
| §1 never queued; unavailable text | this run | `machine/service.js:2263-2269` | `machine/test/service.test.js:327` |
| §1 hub checks: `gh pr view` with the named `--json` fields; refusals 1, 2, 3, 4, 4a, 5, 6, 7, 8, 9 in order with exact texts | this run | `viewer/app/cards.js:15-51` (checkPermit), called at `:214` | `app-permit.test.js:40` (all in order, no write on refusal), `:61` (refusal 7 cases incl. other project), `:84` (8 and 9) |
| §1 copied fields `pr_number`, `pr_title`, `pr_author`, `head_branch` | this run | `viewer/app/cards.js:50` | `app-permit.test.js:97` |
| §1 shown card text, why, head branch, Allow / Don't allow, one answer, answered tags incl. "Allow failed: <reason>" | this run | `viewer/pages/thread.js:796`, `:846-850`, `:1000-1018`, `:1346` | `viewer/test/app-permit.spec.js:26`, `:49` (Chromium and Firefox) |
| §1 Needs you entry, title `Push to #<pr_number>?` | this run | `viewer/app/views.js:143`, `:149` | `viewer/test/app-slug.test.js:141` |
| §1 press: Allow re-runs 7 and 8, sets `target_pr` with no await between; `allow_failed`; Don't allow changes nothing; messages to latest live lead; second press refused | this run | `viewer/app/threads.js:352-371`; shared check `viewer/app/cards.js:20-27` | `app-permit.test.js:97`, `:111`, `:115` |
| §1 docs: cards-lead.md section + retract text; cards.md row and press forms; protocol-rules `leadKinds` | this run | `protocol/app/cards-lead.md:307`; `protocol/app/cards.md:62`, `:234`; `viewer/test/protocol-rules.test.js:34` | `viewer/test/protocol-rules.test.js` |
| §2 done gate uses `target_pr.head_branch` only for the exact target URL | this run | `viewer/app/pr-gate.js:10-11` | `viewer/test/app-done-gate.test.js:81` |
| §3 no slug for a thread with `target_pr` (features path, discoverSlug, remote refresh) | this run | `viewer/app/views.js:38`, `:59`, `:102`; `viewer/app/remote-plan.js:25`, `:37` | `app-slug.test.js:128`; `viewer/test/app-remote-plan.test.js:118` |
| §3 auto-merge does nothing for the target-PR done card | this run | `viewer/app/auto-merge.js:28` | `viewer/test/app-auto-merge.test.js:246` |
| §4 lead.md line at :515 | this run | `protocol/app/lead.md:515` | read |
| §4 lead.md section "Fixing someone else's pull request" (When, Look first, Ask first, Off the normal path, Bring it in, Push, Finish, After done, Stubs) | this run | `protocol/app/lead.md:741-792` | read; cross-references checked against lead.md numbering |

## Deviations from plan

- §3 auto-merge: the skip sits at the top of `attempt` (`auto-merge.js:28`), which `afterCheck` schedules, rather than in `afterCheck` itself. Same effect: no merge, no notice, no deletion, no attempt record.
- §4 wording: "lead step 9, After done" is written "step 9, After done" inside lead.md; refusal 5 placeholders in cards-lead.md read `<base>` / `<default branch>`.
- Small choices are logged in PLAN.md's Log ("Choice: T1..T4").

## Routers

None — this change moved no ownership and no router named a file it touched.

## Validation evidence

Run by the sub-lead on the merged tip (T1–T4 merged, commit 916be6e8 plus this report).

`node --test viewer/test/*.test.js` (exit 1):
```
not ok 253 - switching a harness off cancels its install on every known machine, without waiting
# tests 947
# pass 946
# fail 1
```
The one failure is the pre-existing timing flake listed under residual risks.

`npm --prefix viewer run test:browser` (exit 1):
```
  ✘   404 [chromium] › test/app-send-now.spec.js:84:1 › Enter sends, Shift+Enter starts a new line, and the switch turns Enter-to-send off (30.0s)
  1 failed
  34 skipped
  1427 passed (19.1m)
```
Re-run alone twice, it passed both times (the machine was running the machine suite in parallel at the time):
```
$ npm --prefix viewer run test:browser -- app-send-now
  12 passed (16.3s)
  12 passed (16.0s)
```
The new `app-permit.spec.js` passed in Chromium and Firefox in the full run.

`bash machine/test/run.sh` (exit 1):
```
ok 402 - permit is never spooled when the hub is unavailable or earlier cards are waiting
# tests 735
# pass 715
# fail 18
```
All 18 failures are in `machine/test/win.test.js` and `machine/test/win-tool-ready.test.js` (tests 700–735, Windows bridge), failing with `wslpath failed: Error: spawnSync wslpath ENOENT`. This host is not WSL and has no `wslpath`. This build's only machine change is the relay condition at `machine/service.js:2263-2269`. The T2 worker reported the same 18 failures on its branch.

Focused runs after each acceptance: `app-permit` + `app-reach` + `app-hub` 130/130; `app-done-gate` + `app-auto-merge` + `app-slug` + `app-remote-plan` 37/37; `protocol-rules` 44/44; browser `app-permit` + `app-reach` 10/10.

## Known gaps / residual risks

- The full machine suite cannot pass on this Linux host: 18 Windows bridge tests need `wslpath`.
- `viewer/test/app-send-now.spec.js` Enter-to-send timed out once under load and passed when re-run alone.
- `viewer/test/app-harnesses.test.js` "switching a harness off cancels its install on every known machine, without waiting" asserts `Date.now() - started < 1000` and fails intermittently under machine load. It failed 2 of 3 runs on the feature branch before this build's viewer changes were merged (load average 13–17), so it predates this work.
- Handoff export leaves permit cards out of the history (`viewer/app/handoff.js` `historyText` default), and `target_pr` is not carried over; handing off mid-fix is already an Accepted Risk.
- The machine does not enforce the push target (D2, deferred); the rule is protocol-only, as the own-branch rule is today.

## Remediation rounds

### Remediation 1 (after verification attempt 1)

- Gap "draft after push keeps the Finish wait polling": rare path, recorded in PLAN.md Accepted Risks (verification-1). Not changed.
- Gap "machine permit test would pass if every post returned 503": fixed in `machine/test/service.test.js` by the test `permit is relayed synchronously and returns the hub's answer` (hub 200 returns the card id, one `/cards` call, nothing spooled during or after; hub 422 returns the refusal, nothing spooled). Fake hub `allowed` map gains `permit: ['lead']` (`machine/test/service.test.js:44`). Lane: light (gpt-6-luna).

Evidence (sub-lead, worker branch):
```
$ node --test --test-name-pattern "permit" machine/test/service.test.js
ok 1 - permit is never spooled when the hub is unavailable or earlier cards are waiting
ok 2 - permit is relayed synchronously and returns the hub's answer
ok 3 - prompt failures precede worktree creation and permit retry
# pass 3
# fail 0
```
The worker's mutation run (permit removed from the relay condition at `machine/service.js:2263`) failed the new test at the in-flight spool assertion; restored.

### Remediation 2 (after verification attempt 2)

- Gap "the relay test waits forever if the machine answers 503 without contacting the hub": fixed in `machine/test/service.test.js:350-353`. The wait is now bounded at 5 s, ends as soon as the machine answers, and asserts that the hub was contacted. Lane: light (gpt-6-luna).
- Gaps "single-branch clone leaves `origin/<head>` missing" and "tag with the head branch's name": rare paths, recorded in PLAN.md Accepted Risks (verification-2). Not changed.

Evidence (sub-lead, worker branch):
```
$ node --test --test-name-pattern "permit" machine/test/service.test.js
ok 1 - permit is never spooled when the hub is unavailable or earlier cards are waiting
ok 2 - permit is relayed synchronously and returns the hub's answer
ok 3 - prompt failures precede worktree creation and permit retry
# pass 3
# fail 0
```
The worker's fault run (permit forced to 503 before the hub call) gave `not ok 1 - permit is relayed synchronously...` with "the machine must contact the hub before answering a permit card" in 360 ms; restored, it passed.

### Verification 3

Claude verifier PASS. GPT verifier FAIL on two gaps, both judged rare paths by the sub-lead and recorded in PLAN.md Accepted Risks (verification-3): the GitHub CLI default repository differing from `origin`, and two clones of one repository on one hub. No remediation. Verified commit: 783bb14c0f83dcf144247c118d9593d5b4097a69.
