---
slug: faster-full-runs
date: 2026-11-25
implemented-by: "standard / gpt-6.1-terra (T1–T4); sub-lead claude-opus-5-5 (post-merge fixes named below)"
verified-by:
  - round: 1
    lane: verifier, claude (not-provider gpt)
    checks: standard / gpt-6.1-terra
---

# Completion Report — Faster full test runs

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 retry on clash when the helper chose the port; 5 attempts; last error unchanged; other failures throw at once | this run (T1) | `viewer/test/helpers/server.js:69-101` (loop `:77`, gate on the two messages after kill and await) | `viewer/test/server-port-retry.test.js:19` (a), `:44` (c), `:50` (five clashes) |
| S1 explicit `port` never retries | this run (T1) | `viewer/test/helpers/server.js:78`, retry gate | `viewer/test/server-port-retry.test.js:30` (b) |
| S1 failed child killed and awaited; temp and state dirs reused | this run (T1) | `viewer/test/helpers/server.js:70-74` (dirs before the loop), kill + `waitForExit` in the catch | review of the diff (scout, T1) |
| S1 stderr read before deciding | this run (sub-lead fix) | `viewer/test/helpers/server.js:52-53` (`close`, not `exit`) | server/routes/lifecycle/registration/retry tests 127/127 |
| S1 optional `nextPort` (default `freePort`) | this run (T1) | `viewer/test/helpers/server.js:69` | `viewer/test/server-port-retry.test.js:19` |
| S1 `startServerWithEnv` goes through `startServer`; both callers drop the port | this run (T1) | `viewer/test/routes.test.js:32`, callers `:93`, `:213` | `node --test viewer/test/routes.test.js` |
| S1 inline `port: await freePort()` callers drop `port` | this run (T1, T4) | server.test.js, routes.test.js, registration.test.js, lifecycle.test.js; variable-held starts that only use the port after start converted in T4; `viewer/test/pages.spec.js:87` own helper given the same retry (T4) | whole viewer node suite 1018/1018 on T1's branch; pages.spec.js chromium 10/10 |
| S2 browser suite in the background, own process group; others in order | this run (T2) | `test-support/full-run.sh:34` (`set -m`), `:52-58` (browser job), sequential `run_suite` calls | `test-support/test/full-run.test.js` (overlap assertion) |
| S2 summary fixed order with `seconds`; progress lines with seconds | this run (T2) | `test-support/full-run.sh:71`, `:100`, `:104-106` | `test-support/test/full-run.test.js` summary tests (success, machine fails, browser-only fails) |
| S2 TERM/HUP kill browser group and current suite, wait, exit non-zero | this run (T2) | `test-support/full-run.sh:37-45` | `test-support/test/full-run.test.js` TERM and HUP tests |
| S2 missing browser result counts as failure | this run (sub-lead fix) | `test-support/full-run.sh:93-97` | read of the script; no test |
| S2 exit status, dirty refusal, `WHEELCHAIR_FULL_RUN=1`, log names, sudo-helper pair unchanged | this run (T2) | `test-support/full-run.sh` (dirty check unchanged, `export WHEELCHAIR_FULL_RUN=1`, `sudo_suite`) | dirty-tree test exits 2; summary tests |
| S2 `AGENTS.md` format sentence | this run (T2) | `AGENTS.md:87` | read |
| S3 `CAP = 8`, `max(2, floor(top / (others + 1)))`, non-full 2 | this run (T3) | `test-support/browser-workers.js:7-12`, `decide()` | `test-support/test/browser-workers.test.js` (alone, beside one, beside two or more, 16/8/4/2/1 cores, non-full) |
| S3 comments and router | this run (T3 + sub-lead wording) | `viewer/playwright.config.js` worker comment, `viewer/AGENTS.md:57` | read |
| S3 timing record (D15) | this run (sub-lead) | "Timing record" below | — |
| S4 chromium every spec; firefox only `viewer/test/firefox-specs.js` (15 files, each with a reason) | this run (T3) | `viewer/playwright.config.js:7`, project list; `viewer/test/firefox-specs.js:3-17` | `viewer/test/playwright-projects.test.js:16`, `:22`; `--list`: 52 files, firefox exactly the 15 |
| S4 missing browser still fails loudly | this run (T3) | no skip added in `viewer/playwright.config.js` | read |
| S4 law and routers | this run (T3) | `CONTRIBUTING.md:93`, `AGENTS.md:76`, `viewer/AGENTS.md:57`, `:97`, `viewer/playwright.config.js:3-4` | read |
| S5 lead.md step 7 | this run (T2) | `protocol/app/lead.md:740` | rendered read: the step's start and pass conditions are both under "with that heading"; a lead without the heading reads nothing about full runs there |

## Deviations from plan

- T4 is not a Spec task: it extends S1's caller conversion to starts whose `freePort()` port sat in a variable but was used only after the start (registration and lifecycle tests), and gives `pages.spec.js`'s own spawn helper the same retry. The Spec's Accepted Risk ("few such tests") understated their number (about 17 plus the two pages.spec.js starts); IDEA's goal is that the clash no longer fails runs. 24 `freePort()` sites remain, each using the port before any start or having no `startServer` at all (reasons in `reports/T4.md`).
- The `AGENTS.md` Chromium/Firefox statement is a paragraph at `:76` (end of the Validation section); `:67`'s command comment was trimmed.
- Ctrl-C in a terminal no longer reaches the suites (process groups via `set -m`); S2 promises TERM/HUP only (Round 2 verdict).

## Routers

`AGENTS.md` (summary format with seconds; Chromium/Firefox statement), `viewer/AGENTS.md:57` (the config's row: Firefox list and worker numbers) and `:97`. No ownership moved.

## Validation evidence

Merged tree `b61edc80` (before this file), sub-lead's run:

```text
$ node --test viewer/test/server-port-retry.test.js viewer/test/server.test.js viewer/test/app-new-thread.test.js viewer/test/routes.test.js
# tests 89
# pass 89
# fail 0
$ node --test test-support/test/full-run.test.js test-support/test/browser-workers.test.js
# tests 10
# pass 10
# fail 0
$ node --test viewer/test/playwright-projects.test.js
# tests 2
# pass 2
# fail 0
$ npm --prefix viewer run test:browser -- --list
Total: 1186 tests in 52 files
firefox lists exactly the 15 files of viewer/test/firefox-specs.js (diff empty)
$ npm --prefix viewer run test:browser -- touch.spec.js app-new-thread.spec.js
  31 passed (8.4s)
$ git diff --check main...HEAD
exit 0
```

Worker branches, re-run by the sub-lead at acceptance: whole viewer node suite on T1 1018/1018; T4 registration + lifecycle + retry 55/55, pages.spec.js chromium 10/10.

## Timing record (D15)

Before (plan, 2026-11-25 logs): total 14–21 min, browser 8–11 min, machine about 6 min, run alone.

After (this build, commit `36da8a13`, `bash test-support/full-run.sh`, started 07:02, finished 07:11:24 PST):

```text
commit 36da8a138d61c1eb57ad98e9bebe7cd7508d4998
suite viewer-browser exit 0 seconds 349
suite viewer-node exit 0 seconds 96
suite machine exit 0 seconds 387
suite test-support exit 0 seconds 25
suite sensitivity exit 0 seconds 3
suite codex exit 0 seconds 7
suite install exit 0 seconds 33
suite sudo-helper exit 0 seconds 10
```

- Total wall time: 561 s (9 min 21 s), against 14–21 min before.
- Browser suite 349 s with 8 workers, in Chromium for all 52 specs and Firefox for the 15 listed, running alongside the sequential suites (sum of the sequential suites: 561 s, so the browser suite no longer adds to the total).
- Also running: another thread's full run (`e1976e067aa7`, old script, in its non-browser suites, so this run still took 8 browser workers), and this build's verifier from about 07:03.
- Wait between the verifier passing (reported about 07:11 PST) and the full run passing: 0 minutes; the full run had passed before the verifier reported.
- Not like-for-like (D15): the before figures are from runs on other commits, run alone and one suite after another.

## Known gaps / residual risks

- Accepted Risks in PLAN.md stand. Remaining variable-held ports (24 sites) keep the probe-then-bind race.
- `viewer/test/playwright-projects.test.js` imports Playwright's internal `playwright/lib/util`; a Playwright upgrade may move it.
- `docs/maps/full-test-runs.md` still describes the old summary format (Round 3 declined updating maps).

## Full run

`summary.txt` for the reported commit is above (Timing record); every suite exit is 0. No failures to confirm on main.

## Verification

Attempt 1 on `36da8a13`: PASS, no gaps, no rare paths. The verifier noted the branch now contains main's PR #192 (merge-base with `origin/main` is `a399cf8a`), so it used that for the law range and `git diff --check`.

## Remediation rounds

None.
