---
slug: review-progress
date: 2026-11-15
implemented-by: "T1 standard (gpt-6.1-terra); T2 standard, asked for claude, landed on gpt (gpt-6.1-terra); sub-lead claude-opus-5-5"
verified-by:
  - round: 1
    lane: top (claude-opus-5-5)
    checks: standard (gpt-6.1-terra)
---

# Completion Report — See progress while a plan is reviewed and a build is verified

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| `stage` field: `build` \| `review` \| `verify`, absent = build; bad value → `invalid or missing field: stage` | this run | `viewer/app/card.js:82` | `viewer/test/app-hub.test.js:38` (stage `foo` case) |
| `done`/`total` required for build only, `0 <= done <= total`; refused on review/verify | this run | `viewer/app/card.js:83-84`, `:140-142`, `:143-158` | `app-hub.test.js:38` (stage-less build accepted; review with `done` refused) |
| `machines`, `choice_waiting` required every stage | pre-existing, unchanged | `viewer/app/card.js:89-90` | `app-hub.test.js:38` (all cases carry them) |
| `pass` integer >= 1, required for review/verify, refused for build | this run | `viewer/app/card.js:85`, `:143-158` | `app-hub.test.js:38` (missing pass, pass 0, pass on build) |
| `phase` checking/fixing/clean, required for review/verify | this run | `viewer/app/card.js:86`, `:145-155` | `app-hub.test.js:38` (each phase accepted for both stages) |
| `found`/`fixed`: required with fixing (found >= 1, 0 <= fixed <= found); both-or-neither and equal with review clean; refused with checking and verify clean | this run | `viewer/app/card.js:87-88`, `:147-163` | `app-hub.test.js:38` (fixing without found, fixed > found, found 0, fixed -1, found on checking, one count on review clean, counts on verify clean, unequal clean) |
| Roles unchanged (lead and sub-lead post any stage) | pre-existing | `viewer/app/card.js:28` | existing suite |
| A `verify` card replaces a `build` card in `pinned.progress` | pre-existing pin logic, new test this run | `viewer/app/cards.js:22-25` | `viewer/test/app-hub.test.js` "verify progress replaces build progress in the pin" (ok 70) |
| Rendering table: Reviewing plan / Plan reviewed / Verifying / Verified labels and texts | this run | `viewer/pages/thread.js:576-586`, `:686-698` | `viewer/test/app-threads.spec.js:295` (review fixing text, verify clean "Verified", verify fixing texts) |
| Build / stage-less line unchanged | this run (guarded) | `viewer/pages/thread.js:578-587` | `app-threads.spec.js:295` ("Building", "tasks done") |
| No segment bar for review/verify | this run | `viewer/pages/thread.js:581` | `app-threads.spec.js:295` (`.segs` count 0) |
| Machines appended only for verify, when non-empty | this run | `viewer/pages/thread.js:697` | read in code; no test posts verify with machines |
| Blue dot, amber `choice_waiting`, "choice for you" pill kept for every stage | this run (shared path) | `viewer/pages/thread.js:574-575`, `:589` | `app-threads.spec.js:295` (review line has class `amber`) |
| Unknown stage renders as Building | this run | `viewer/pages/thread.js:576-578` (only review/verify are staged) | read in code; validation refuses unknown stages |
| Folded pin label: label + " · " + text (+ ": choice for you"); build folded label unchanged | this run | `viewer/pages/thread.js:708-712` | `app-threads.spec.js:295` (folded "Reviewing plan · pass 2 · 5 found, 3 resolved", no "undefined") |
| Fits 360px with no horizontal overflow; text wraps | this run | `viewer/pages/thread.css:55` | `app-threads.spec.js:295` (viewport 360, `scrollWidth <= clientWidth`) |
| Remediation acceptance leaves the pin on Verifying | this run | rendering above; rule in `protocol/app/sub-lead.md:95-97`, `:132-134` | `app-threads.spec.js:295` (verify fixing re-posted with fixed + 1 reads "Verifying", "2 gaps, 1 fixed") |
| cards.md `progress` section: fields and rendering table | this run | `protocol/app/cards.md:123-152` | read |
| lead.md: post `checking` on launching round N; numbering never resets; dead-reviewer round keeps its number | this run | `protocol/app/lead.md:198-201` | read |
| lead.md: clean (equal counts or none) vs fixing with rising `fixed`; what counts as found / resolved | this run | `protocol/app/lead.md:221-229` | read |
| lead.md: `choice_waiting` while a question or the budget needs card waits | this run | `protocol/app/lead.md:227-229` | read |
| lead.md: "No round count" sentence replaced | this run | `protocol/app/lead.md:241-242` | `grep -n "No round count" protocol/app/lead.md` prints nothing (below) |
| lead.md step 7.3: "same fields as the sub-lead's last one" | this run | `protocol/app/lead.md:276` | read |
| lead.md: small-fix (step 1) and after-done (step 9) verifiers post no progress line | this run | `protocol/app/lead.md:91` | read |
| sub-lead.md: verify/checking after starting attempt N's verifiers | this run | `protocol/app/sub-lead.md:187-188` | read |
| sub-lead.md: PASS → `clean` before the result | this run | `protocol/app/sub-lead.md:189-191` | read |
| sub-lead.md: FAIL → fixing with distinct gaps, duplicates merged across two verifiers, `fixed` rising | this run | `protocol/app/sub-lead.md:192-195` | read |
| sub-lead.md: surviving gap leaves the line on fixing, lead sets `choice_waiting` | this run | `protocol/app/sub-lead.md:205-206` | read |
| sub-lead.md: after `verifying`, dispatch/acceptance posts re-post the verify line, never build (both places) | this run | `protocol/app/sub-lead.md:95-97`, `:132-134` | read |
| `viewer/app/API.md` updated only if it documents progress fields | n/a | `grep -n progress viewer/app/API.md` returns nothing, so no change | grep |

## Deviations from plan

- The Spec's browser cases are one sequential test per viewport (`app-threads.spec.js:295`),
  run at phone and desktop sizes in Chromium and Firefox, not separate tests. Every listed
  assertion is in it.
- The lead.md "no progress line" sentence for the step-1 and step-9 verifiers sits once above
  step 1 (`lead.md:91`) rather than inside each step.
- No new case posts a `verify` card with non-empty machines; the machines suffix is checked
  by reading the code only.

## Routers

None — this change moved no ownership and no router named a file it touched in a way that
changed.

## Validation evidence

Run on the merged feature branch (`9377027` plus this commit), from this worktree, after
`npm --prefix viewer ci`.

```text
$ node --test viewer/test/*.test.js
ok 69 - validates progress stages and their counts
ok 70 - verify progress replaces build progress in the pin
not ok 267 - a starter that loses the freed port registers through the new holder
# tests 388
# pass 387
# fail 1
```

```text
$ npm --prefix viewer run test:browser
  ✓ [chromium] › test/app-threads.spec.js:295:5 › phone › progress stages render and remain pinned through remediation
  ✓ [firefox]  › test/app-threads.spec.js:295:5 › phone › progress stages render and remain pinned through remediation
  ✓ [chromium] › test/app-threads.spec.js:295:5 › desktop › progress stages render and remain pinned through remediation
  ✓ [firefox]  › test/app-threads.spec.js:295:5 › desktop › progress stages render and remain pinned through remediation
  2 failed
    [chromium] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
    [firefox] › test/browser.spec.js:2395:1 › no drawn arrow's line passes through either box it connects, over every committed graph
  2 skipped
  588 passed (3.0m)
```

```text
$ grep -n "No round count" protocol/app/lead.md
(no output, exit 1)
```

Both failures are recorded in `docs/known-issues.md` ("a starter that loses the freed port
registers through the new holder" at line 6; "no drawn arrow's line passes through either
box it connects" at line 57) and touch files this build did not change
(`viewer/test/lifecycle.test.js`, `viewer/test/browser.spec.js`, the graph viewer).

## Known gaps / residual risks

- The running hub refuses the new stages until this branch is deployed by the canonical
  clone's install; the protocol docs here already tell sessions to post them.
- The protocol rules (who posts which line when) are instructions to agents and have no
  automated test; they hold only as far as leads and sub-leads follow them.
- `docs/plans/review-progress/reports/T2.md` pastes the full TAP output (about 5,400 lines).

## Remediation rounds
