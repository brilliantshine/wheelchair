---
slug: mergeable-before-done
date: 2026-11-18
implemented-by: "standard, gpt-6.1-terra (T1, T2, T3); light, gpt-6-luna (T4, T5); sub-lead: claude-opus-5-5"
verified-by: []
---

# Completion Report — Pull requests are mergeable before work is called done

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

All rows: origin `this run` (Prior Work was empty).

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| A1 `done.head` required, `/^[0-9a-f]{40}$/` | this run | `viewer/app/card.js:121` | `viewer/test/app-done-gate.test.js:48` (missing / non-hex head refused, through hub, no gh call) |
| A2 `done` never spooled: drain first, 503 if still queued or no `hub_url` | this run | `machine/service.js:1292-1298` | `machine/test/service.test.js:303` |
| A2 direct relay, 30 s timeout, 2xx/4xx pass through, 5xx/timeout/connection error → 503 | this run | `machine/service.js:1299-1305` | `machine/test/service.test.js:320` (hub 422 after 6 s → 422), `:303` (hub 503 → 503, no spool file) |
| A2 other kinds unchanged | this run | `machine/service.js:1307-1316` | existing spool tests `machine/test/service.test.js:261,291` (switched from `done` to `idea`) |
| A3 `pr-gate.js`: `checkPr` / pure `judgePr` | this run | `viewer/app/pr-gate.js:8-29,31-44` | `viewer/test/app-done-gate.test.js:17` |
| A3 step 1: non-GitHub URL refused without gh | this run | `viewer/app/pr-gate.js:32` | `viewer/test/app-done-gate.test.js:48` (gh call log empty) |
| A3 step 2: one gh call, 15 s, auth stderr → login reason, other errors → "couldn't reach GitHub" | this run | `viewer/app/pr-gate.js:35-42` | `viewer/test/app-done-gate.test.js:61` |
| A3 step 3: identity (branch, base, head) before merged | this run | `viewer/app/pr-gate.js:10-12` | `viewer/test/app-done-gate.test.js:17` (wrong branch, wrong base, merged at another commit) |
| A3 steps 4-6: MERGED ok, closed refused, CLEAN/HAS_HOOKS ok, BLOCKED all-passed ok, DIRTY/BEHIND/UNSTABLE/BLOCKED-pending/UNKNOWN reasons | this run | `viewer/app/pr-gate.js:13-28` | `viewer/test/app-done-gate.test.js:17` |
| A3 hub: schema check first (invalid skips gate), gate on `state.thread` snapshot outside `withThread`, 422 on refusal, other kinds unchanged | this run | `viewer/app/hub.js:144-156` | `viewer/test/app-done-gate.test.js:43,48` (refused card leaves thread file byte-identical), `:68` (3 s gh does not block another card on the thread) |
| A4 `wc.js git commit` completes a merge in progress | this run | `machine/service.js:993-996` | `machine/test/service.test.js:456` (refused with unmerged paths; completes with two parents after resolving) |
| B `cards-lead.md` `done`: `head` row + acceptance paragraph | this run | `protocol/app/cards-lead.md:119,122` | `viewer/test/protocol-rules.test.js:90` |
| B lead.md new section "Making the pull request mergeable", items 0-9 + git bullets | this run | `protocol/app/lead.md:360-456` (section) | `viewer/test/protocol-rules.test.js:83` |
| B lead.md item 2 poll (gh pr view every 60 s, stop conditions, 10-min cap, 5-min no-checks grace, gh errors ignored; no `gh pr checks --json`) | this run | `viewer/app/pr-wait.py`, invoked from `protocol/app/lead.md` item 2 | `viewer/test/pr-wait.test.js` (ready, conflicts, head changed, closed or merged, check failed) |
| B steps 1, 8 (item 2), 9 point at the section; step 8 still commits `status: done` before the push; step 9 old item 4 replaced, item 3 kept; pushes `wc.js git push -u origin HEAD:wc/<thread-id>` | this run | `protocol/app/lead.md:120-122,320-324,353-355,444` | `viewer/test/protocol-rules.test.js:83-88` |
| B sub-lead.md, verifier.md unchanged | this run | no diff | `git diff main -- protocol/app/sub-lead.md protocol/app/verifier.md` is empty |

## Deviations from plan

- The lead's poll is a script, `viewer/app/pr-wait.py`, rather than a command written inline in
  lead.md. The Spec asks for "one foreground shell command"; an inline heredoc inside an indented
  Markdown list can't be pasted and run (it fails with "unexpected indent", and the indented
  terminator never closes the heredoc). The script implements exactly the item 2 conditions and
  ends with a `STOP: <reason>` line. Its gh command can be overridden with `WC_GH`, for tests.
- `viewer/app/hub.js` requires `pr-gate.js` lazily, when a `done` card arrives, so an existing test
  that copies hub.js alone into a temporary clone still loads.

## Routers

None — this change moved no ownership and no router named a file it touched.

## Validation evidence

Run on the feature branch after merging T1-T5 (2026-11-18):

```
$ node --test viewer/test/*.test.js
# tests 548
# pass 548
# fail 0

$ bash machine/test/run.sh
# tests 142
# pass 142
# fail 0

$ node --test viewer/test/pr-wait.test.js viewer/test/protocol-rules.test.js
# pass 40
# fail 0

$ git diff --stat main -- protocol/app/sub-lead.md protocol/app/verifier.md
(empty)
```

The Playwright specs whose `done` posts changed (`viewer/test/app-threads.spec.js`) were run by the T1
worker; see `docs/plans/mergeable-before-done/reports/T1.md`.

## Known gaps / residual risks

- Machine: the timeout and connection-error paths of the direct `done` relay share the 503 catch
  with the tested hub-503 path, but they have no test of their own.
- A `done` relay that times out after the hub stored the card answers 503; a retry posts a second
  `done` (Accepted Risks: duplicate notice).
- `node --test viewer/test/*.test.js` hung once in `app-sudo.test.js` during a T1 re-run (the file
  passes alone, before and after this change); the next two full runs passed. This looks like a
  pre-existing flaky test.
- Accepted Risks in PLAN.md apply unchanged.

## Remediation rounds

Appended by Stage 4 loops; never erase earlier content.
