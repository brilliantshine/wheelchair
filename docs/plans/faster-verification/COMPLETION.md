---
slug: faster-verification
date: 2026-11-23
implemented-by: "T1 standard gpt-6.1-terra; T2 light gpt-6-luna; T3 standard gpt-6.1-terra; T4 light gpt-6-luna; T5 standard claude-sonnet-5-5; integration fixes by the sub-lead (claude-opus-5-5)"
verified-by: []
---

# Completion Report — Faster verification checks

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 picker CLI (`--base`, `--head`, `--full`, `--json`), exit 1 on bad base | this run | `test-support/pick-tests.js:10-19,48,103-107` | `test-support/test/pick-tests.test.js:34`; `--base nonsense` exit 1 (below) |
| S1 suite table, full commands as in AGENTS.md | this run | `test-support/pick-tests.js:20-28` | `pick-tests.test.js:32` (`--full` gives 8 suites); output below |
| S1 rule 0 deletions and renames, head paths only | this run | `test-support/pick-tests.js:30,33,49-54,59` | `pick-tests.test.js:25,29,30` |
| S1 rule 1 changed test selects itself | this run | `test-support/pick-tests.js:59` | `pick-tests.test.js:25` |
| S1 rule 2 imports across both components, basename prefix | this run | `test-support/pick-tests.js:61-75` | `pick-tests.test.js:30,36` |
| S1 rule 3 test-map.json | this run | `test-support/pick-tests.js:55,76-80`; `test-support/test-map.json` | `pick-tests.test.js:31,35` |
| S1 rule 4 fan-out files | this run | `test-support/pick-tests.js:81-86` | `pick-tests.test.js:32` |
| S1 rules 5–6 fallback; front-end only through the map | this run | `test-support/pick-tests.js:87-94` | `pick-tests.test.js:33,34,37` |
| S1 rule 7 nothing selected | this run | `test-support/pick-tests.js:95-104` | `pick-tests.test.js:34`; docs-only scratch commit (below) |
| S2 full-run.sh | this run | `test-support/full-run.sh:5-29` (usage, root, dirty refusal), `:31` (`WHEELCHAIR_FULL_RUN=1`), `:33-46` (summary, per-suite logs), `:48-66` (order: browser first), `:71` exit | Full run below; usage and dirty-tree exit 2 (T2 report and sub-lead re-run) |
| S3 browser workers | this run | `test-support/browser-workers.js:7-9` (`chooseWorkers`), `:11-31` (stale files), `:33-42` (register/unregister), `:44-57` (`decide`, once, in main process, env carry); `viewer/playwright.config.js:8-13` | `test-support/test/browser-workers.test.js:10,17,25,32`; worker-count runs (below) |
| S4 flaky harness test | this run | `viewer/test/app-harnesses.test.js:298-330` | 10x loop under load (below) |
| S5.0 opt-in and handshake | this run | `AGENTS.md:76-87`; `protocol/app/lead.md:116`; `protocol/app/sub-lead.md:226-228,247-248`; `protocol/app/verifier.md:44-52`; `protocol/app/worker.md:38` | `node --test viewer/test/protocol-rules.test.js` |
| S5.1 Spec validation commands | this run | `protocol/app/lead.md:239-243` | read |
| S5.2 comparing a failure with main | this run | `protocol/app/verifier.md:54-65` | read |
| S5.3 verifier runs picked commands | this run | `protocol/app/verifier.md:44-52` | read |
| S5.4 picker base and comparison commit | this run | `protocol/app/lead.md:130-137,715,726-729`; `protocol/app/sub-lead.md:247-252` | read |
| S5.5 sub-lead full run, gate, baseline | this run | `protocol/app/sub-lead.md:226-228,252-254,272-279` | read |
| S5.6 lead full run before push; Covered; baseline.txt | this run | `protocol/app/lead.md:116-130,159-160,526-533,726-729` | read |
| S5.7 workers | this run | `protocol/app/worker.md:38-40` | read |
| S5.8 AGENTS.md and CONTRIBUTING.md | this run | `AGENTS.md:28,76-87`; `CONTRIBUTING.md:75-78` | read |

## Deviations from plan

- S1 rule 6 names `viewer/app/pages/**`; the tree's pages live in `viewer/pages/`. The picker treats both, viewer `*.html`/`*.css` and `viewer/doc.js` as front-end (`pick-tests.js:89`).
- S1 rule 5: every `*.md` file (not only root ones) and `.gitignore` select nothing unless mapped, matching rule 5's last sentence.
- S3: a run without `WHEELCHAIR_FULL_RUN=1` always takes 2, even if it inherits a full run's `WHEELCHAIR_BROWSER_WORKERS` (`browser-workers.js:45-47`); stricter than the Spec's wording, same intent.
- This build ran under the installed rules, so the sub-lead ran full validation itself before verification, as those rules require.

## Routers

- `AGENTS.md`: the `test-support/` row now names `pick-tests.js` with `test-map.json`, `full-run.sh` and `browser-workers.js`; new `## Test picker and full run` section (the S5.0 opt-in heading).
- `viewer/AGENTS.md`: the `playwright.config.js` row now describes the worker choice from `test-support/browser-workers.js` (up to 6 for a lone full run, 2 otherwise) instead of a fixed `workers: 2` (fixed in Remediation 4; it wrongly said "unchanged" before).

## Validation evidence

All on the hearth machine, 2026-11-23, with other threads' test runs live (load average 9–27).

**test-support suite** (`node --test test-support/test/*.test.js`, commit 87b61340): `# tests 23 / # pass 23 / # fail 0`.

**Protocol rules** (`node --test viewer/test/protocol-rules.test.js`, after the last protocol edit): `# pass 44 / # fail 0`.

**Picker, docs-only** (scratch clone, one commit editing `docs/plans/faster-verification/IDEA.md`):
```
$ node test-support/pick-tests.js --base HEAD~1 --head HEAD --json
{ "changed": [ "docs/plans/faster-verification/IDEA.md" ], "suites": [] }
```
**Picker against this branch's merge-base** (7b93c1ae):
```
node --test viewer/test/*.test.js
npm --prefix viewer run test:browser
node --test machine/test/aside-turns.test.js machine/test/char-lib-argv.test.js machine/test/service.test.js
node --test test-support/test/*.test.js
```
(viewer whole: `viewer/playwright.config.js` changed; machine narrowed to the protocol readers; test-support whole.)

**S4 loop under load**: `for i in $(seq 10); do node --test viewer/test/app-harnesses.test.js || exit 1; done` while `node --test viewer/test/*.test.js` ran concurrently: `loop exit 0`, last run `# pass 20 / # fail 0`. (The load run itself: 934/935, one failure in an unrelated graph kill test.)

**S3 worker counts** (Playwright's "Running N tests using K workers"; `nproc` 16):
- Full run alone (the full run below): `Running 1466 tests using 6 workers`.
- `WHEELCHAIR_FULL_RUN=1` run while that full run was live: `Running 6 tests using 2 workers`; registry held only the full run's pid (`2201540`).
- Run without the variable while it was live: `Running 6 tests using 2 workers`; no registry file for it.
- Inherited `WHEELCHAIR_BROWSER_WORKERS=6` without `WHEELCHAIR_FULL_RUN`: `Running 4 tests using 2 workers`.
- Full run started while a non-full run was live gets 6: T3 report (`reports/T3.md`, "Running 6 tests using 6 workers" during an ordinary 2-worker run).
- Registry directory empty after runs end.

**Full run** (`bash test-support/full-run.sh <scratch>/full1`) — summary.txt:
```
commit 87b61340fa27cb20e48cb553c849367eb90378bf
suite viewer-browser exit 1
suite viewer-node exit 0
suite machine exit 1
suite test-support exit 0
suite sensitivity exit 0
suite codex exit 0
suite install exit 0
suite sudo-helper exit 0
```
Commits after 87b61340 change only `protocol/app/verifier.md` (one phrase), this file and PLAN.md.

Failures, each checked by S5.2's method (scratch clone at merge-base 7b93c1ae, failing files only):

- **machine** — already on main. `machine/test/win.test.js` fails 16 tests and `win-tool-proxy`/`win-tool-ready` 2 more, alone and in the suite, with errors `spawnSync wslpath ENOENT` and an `ENOENT` open: this Linux machine has no `wslpath`. Branch and main, same five files (`service`, `switch-http`, `win`, `win-tool-proxy`, `win-tool-ready`): both `# tests 189 / # pass 171 / # fail 18`, the same 18 test names, error lines identical after stripping temp paths and numbers. In both full machine runs, `win-tool-proxy.test.js` also hung in the whole suite (idle for 30+ minutes, waiting in `epoll`) and was stopped by hand. Another thread's run on an older main had the same file hung for 4h40m at the same time. This branch changes nothing under `machine/`.
- **viewer-browser** — 2 of 1466 failed, at 6 workers with load ~20: `[chromium] app-threads.spec.js:414 desktop › queued bubbles keep the queue order across tabs` and `[firefox] app-settings.spec.js:45 desktop › six sections, kept across a reload through the hash` (34 did not run after them). Re-runs on the branch: both tests `--repeat-each 3` at 2 workers, 18/18 passed; both whole files at `--workers 6` with load ~17, 242/242 passed (Playwright used 4). The same files on main at `--workers 6` with load ~13: 211 passed, 1 failed (`[firefox] app-settings.spec.js:99 editing a table cell saves`). These browser specs fail under machine load on main too. An earlier overlapping run on the branch (during the full run's Node suites, `--repeat-each 2`) reproduced the same two failures; the quiet re-run did not.

## Known gaps / residual risks

- test-map.json is seeded, not complete (Spec rule 3 allows this): most `viewer/pages/*` files fall back to both whole viewer suites. Picks are larger, never smaller.
- Picker paths in printed commands are not shell-quoted; the tree has no paths with spaces.
- `decide()` itself has no unit test; its once-only and full-only behaviour is shown by the worker-count runs below.
- The registration race between two full runs starting in the same instant is in Accepted Risks.
- The full run cannot exit 0 on this machine at any commit, main included, while `machine/test/win.test.js` needs `wslpath`; the S2 baseline exception (failures confirmed on main and written down) is what lets a full run pass here.
- Six browser workers mean more load per run. The two browser failures above passed on re-run and similar specs fail on main under load, but a busy machine may make full runs flake more than at 2 workers. Worth watching in the first threads that use it.
- `win-tool-proxy.test.js` can hang inside the whole machine suite (seen on main too), which stalls a full run until it is stopped. Not addressed here (Spec non-goal: individual tests).

## Remediation rounds

### Remediation 1 (after verification attempt 1, 2026-11-23)

Gaps and tasks: `REMEDIATION-1.md`. Lead's per-gap answers and the full-run reading are in PLAN.md's Log.

- **R1** (S1 rule 3): `test-support/test-map.json:13-18` maps `docs/plans/kimi-code/samples/**` to `viewer/test/app-kimi-hub.test.js`. A re-grep of every test for tracked `docs/` reads found no other unmapped one (`reports/R1.md`). Scratch-clone commit touching `docs/plans/kimi-code/samples/wire.jsonl` → picker selects `viewer/test/app-kimi-hub.test.js`. `node --test test-support/test/*.test.js`: 23/23.
- **R2** (S5.1/S5.3, S5.5, S5.6):
  - `protocol/app/verifier.md:49-51`: Spec commands always run as written, even a whole suite.
  - `protocol/app/sub-lead.md:36-40` and `:298-301`: the deferral-finish paths still need a passing full run.
  - `protocol/app/lead.md:536-538`: a merge of the user's pull-request commits gets a full run unless covered.
  - `node --test viewer/test/protocol-rules.test.js`: 44/44.
- **Accepted Risk** (verification-1): full-run.sh with a directory at `summary.txt`.
- **Deferred 4** (verification): the free-port race in `viewer/test/helpers/server.js`.

**Full run on 381e4014** (`bash test-support/full-run.sh <scratch>/full2`), started 22:36 with load average ~13 from other threads:
```
commit 381e401482d94a08ebe23e6c63a7d81c80ace2b7
suite viewer-browser exit 1
suite viewer-node exit 1
suite machine exit 1
suite test-support exit 0
suite sensitivity exit 0
suite codex exit 0
suite install exit 0
suite sudo-helper exit 0
```
The browser stage ran `Running 1466 tests using 6 workers`.

Every failure, judged by the lead's reading of S2 (confirmed on main by S5.2, or a load flake that passes alone):

| Suite | Failure | Judgment | Evidence |
|---|---|---|---|
| viewer-browser | `app-accounts.spec.js:576,584,591,599` "lead waiting line", chromium and firefox (8) | on main | Main clone at 7b93c1ae, `-g "lead waiting line"`: the same 8 fail with the same error, `Expected pattern: /^Waiting for GPT to refill, about \d/`, `Received string: "Waiting for GPT to refill, about Tue 01:46 AM"` (late evening, the time rolls into the next day). Branch: identical. |
| viewer-browser | `[chromium] app-handoff.spec.js:206`, `[chromium] app-threads.spec.js:414 desktop` | load flake | `--project chromium --repeat-each 3` on both: `9 passed`, exit 0. |
| viewer-node | `app-new-thread.test.js` "GET /new-thread returns found repositories…" (`Refused to use a port held by a process it cannot identify`); the file then hung 11+ min and the sub-lead stopped it | load flake (Deferred 4) | Alone: `# pass 13 / # fail 0`. |
| viewer-node | `lifecycle.test.js:313` "--service gives up after three takeovers" (same port race) | load flake (Deferred 4) | Alone: `# pass 31 / # fail 0`. |
| machine | 18 tests in `win.test.js`, `win-tool-proxy.test.js`, `win-tool-ready.test.js` (`spawnSync wslpath ENOENT`) | on main | The same 18 names and error lines as main's run of those files (attempt 1 evidence above). |
| machine | `win-tool-proxy.test.js` hung 13+ min in the whole suite, stopped by the sub-lead; its "stand-in hands held calls…" and `win-tool-ready.test.js` "context errors before a readying task write failed" then failed (`Cannot read properties of undefined (reading 'ok')`) | load flake / hang (also hangs on main) | Both files alone, 3 runs: `# pass 31 / # fail 2` each time, and the 2 are main's `wslpath` failures ("existing copy remains waiting…", "failed readying becomes ready…"). Hang on main: attempt 1 evidence above. |

So the full run on 381e4014 passes under the lead's reading of S2.

### Remediation 2 (after verification attempt 2, 2026-11-23)

Gaps and tasks: `REMEDIATION-2.md`. Lead's answers are in PLAN.md's Log.

- **R3** (S1 rule 3, map completeness): `test-support/test-map.json` now has:
  - no front-end entries (`viewer/index.html`, `doc.html`, `doc.js` and `pages/markdown.js` fall back to both viewer suites by rules 5–6);
  - all-suite entries for `protocol/**`, `connectors/**`, `test-support/**`, `sensitivity/**`, `codex/**`, `install/**`, `sudo-helper/**` and `install.sh`;
  - the docs fixture entries (kimi, openrouter samples, graphs) kept, each with every reader (`reports/R3.md`).

  The new test `test-support/test/pick-tests.test.js` "real repository changes include readers across suites" clones the real tree and picks for `connectors/pi/guard.js`, `viewer/doc.js`, `protocol/sensitivity.md`, `install/guard.sh` and `docs/plans/kimi-code/samples/wire.jsonl`. On the old map it failed with the five misses; now `node --test test-support/test/*.test.js` gives 24/24.
- **R4** (S5.0/S5.3, S5.5), by the sub-lead:
  - `protocol/app/verifier.md:48-50` runs the picker command the project names (wheelchair's flags as the example).
  - `protocol/app/sub-lead.md` step 4 pastes `summary.txt` into COMPLETION.md and commits before sending the result.
  - `node --test viewer/test/protocol-rules.test.js` gives 44/44.
- **Accepted Risk** (verification-2): unquoted test file names with spaces.
- **Trade-off:** a protocol-only change now picks every suite (see PLAN.md Log).

The full run for this round runs alongside the attempt-3 verifiers on this commit; its summary and judgments are appended below when it ends.

**Full run on 70d11cdb** (`bash test-support/full-run.sh <scratch>/full3`, started 23:25, alongside the attempt-3 verifiers):
```
commit 70d11cdb1dac76d240e96ec7ae1bb0455d1e8c75
suite viewer-browser exit 1
suite viewer-node exit 0
suite machine exit 1
suite test-support exit 0
suite sensitivity exit 0
suite codex exit 0
suite install exit 0
suite sudo-helper exit 0
```
The browser stage ran `Running 1466 tests using 6 workers`, with 1423 passed, 9 failed and 34 skipped. Nothing hung.

| Suite | Failure | Judgment | Evidence |
|---|---|---|---|
| viewer-browser | `app-accounts.spec.js:576,584,591,599` "lead waiting line", chromium and firefox (8) | on main | Same tests and error as main at 7b93c1ae (Remediation 1 evidence): the expected `about \d`, the received `"Waiting for GPT to refill, about Tue 02:31 AM"`. |
| viewer-browser | `[chromium] app-threads.spec.js:353 phone › message box posts and shows queued` | load flake | `--project chromium --repeat-each 3`: `6 passed`, exit 0. |
| machine | 18 tests, the same names as main's run of `win*.test.js` (`comm` against the main list: no extras, none missing). 14 have the error `wslpath failed: Error: spawnSync wslpath ENOENT`, 1 an `ENOENT` open, and 3 multi-line errors | on main | Main comparison in Remediation 1. |

So the full run on 70d11cdb passes under the lead's reading of S2. Commits after it change only COMPLETION.md and PLAN.md, which the picker maps to nothing, so they stay covered.

### Remediation 3 (after verification attempt 3, 2026-11-24)

Gaps and decision: `REMEDIATION-3.md`; Collin's choice is PLAN.md D15. The verification-3 row in Accepted Risks covers further picker misses of the same kind.

- **R5**:
  - `test-support/pick-tests.js` (map loop): an entry with `"additive": true` adds its tests but does not count as mapping, so rules 5–6 still fall back.
  - `test-support/test-map.json` gains additive name-guard entries (`machine/**`, `viewer/app/**`, `viewer/pages/**`, `viewer/server.js`), `viewer/server.js` → both viewer suites, and additive `machine/test/fixtures/**` → `viewer/test/app-chat.test.js`.
  - Tests: the real-tree test gained `viewer/app/sessions.js`, `viewer/server.js` and `machine/test/fixtures/agy/transcript.jsonl` cases, and a fixture test covers additive entries.
  - `node --test test-support/test/*.test.js`: 25/25. Mutations: ignoring `additive` fails the fixture test; dropping the new entries fails the real-tree test.
- **R6**: `protocol/app/lead.md` small-fix path waits for the full run (or coverage) before the push. `node --test viewer/test/protocol-rules.test.js`: 44/44.

**Full run on 736bb799** (`bash test-support/full-run.sh <scratch>/full4`, started ~00:12, run alongside the attempt-4 verifiers with load average 27–50):
```
commit 736bb7999fb58955fd1db3bc1699f9bceaeb862d
suite viewer-browser exit 1
suite viewer-node exit 1
suite machine exit 1
suite test-support exit 0
suite sensitivity exit 0
suite codex exit 0
suite install exit 0
suite sudo-helper exit 0
```
The browser stage ran `Running 1466 tests using 6 workers`. The "lead waiting line" tests passed this time (the time of day no longer rolls into the next day).

| Suite | Failure | Judgment | Evidence |
|---|---|---|---|
| viewer-browser | `[chromium] app-handoff.spec.js:206`, `[chromium] app-send-now.spec.js:59` | load flake | `--project chromium --repeat-each 3`: `6 passed`, exit 0. |
| viewer-browser | `[firefox] app-threads.spec.js:555` phone and desktop, `page.waitForRequest: Test timeout of 30000ms exceeded` | on main | Main at 7b93c1ae, `--project firefox --repeat-each 5` (load ~45): 2 failed with the same `page.waitForRequest: Test timeout of 30000ms exceeded`. On the branch, `--repeat-each 3` alone: 5 passed, 1 failed. The branch changes nothing under `viewer/` except `playwright.config.js` and `app-harnesses.test.js`. |
| viewer-node | `app-quiet.test.js:41`, `app-uploads-archive.test.js:65`, `server.test.js:457` | load flake | Alone: `app-quiet` 27/27, `app-uploads-archive` 3/3, `server` 50/50. |
| machine | the same 18 tests as main (`win*.test.js`, `wslpath`) | on main | `comm` against main's list: all 18 present, none missing. |
| machine | `win-tool-proxy.test.js` hung 8+ min in the whole suite (also on main) and was stopped by the sub-lead; it and `screen.test.js` "marker mode and app umask preserve service umask" (ENOENT on a temp umask file) then reported 4 extra failures | load flake / hang | Alone: `win-tool-proxy.test.js` 27/27, `screen.test.js` 46/46. |

So the full run on 736bb799 passes under the lead's reading of S2. Later commits change only COMPLETION.md and PLAN.md, which the picker maps to nothing.

### Remediation 4 (after verification attempt 4, 2026-11-24)

Gaps: `REMEDIATION-4.md`. One commit (R7), by the sub-lead:
- **S1 rule 2:** `test-support/pick-tests.js` import resolution also tries `<path>.json`. New fixture test "an import without an extension finds a .json file"; it fails when `.json` is removed. `node --test test-support/test/*.test.js`: 26/26.
- **S5.0:** `protocol/app/sub-lead.md` step 4 says "In an opted-in project, before sending the `result`, paste `summary.txt`…". The `protocol/app/lead.md` repair step says "(and, with that heading, a passing full run)".
- **S5.6:** the `protocol/app/lead.md` small-fix push waits for the full run "unless they chose to push it as it is".
- **Router:** the `viewer/AGENTS.md` `playwright.config.js` row now describes the worker choice; the Routers section above is corrected.
- `node --test viewer/test/protocol-rules.test.js`: 44/44.

The full run for this commit runs alongside the attempt-5 verifiers; its result is appended below.

**Full run on bb3e2e3c** (`bash test-support/full-run.sh <scratch>/full5`, run alongside the attempt-5 verifiers):
```
commit bb3e2e3c8eeb087ce47deac092d6f6c31a57dc34
suite viewer-browser exit 1
suite viewer-node exit 1
suite machine exit 1
suite test-support exit 0
suite sensitivity exit 0
suite codex exit 0
suite install exit 0
suite sudo-helper exit 0
```
The browser stage ran `Running 1466 tests using 6 workers`, with 1431 passed, 1 failed and 34 skipped.

| Suite | Failure | Judgment | Evidence |
|---|---|---|---|
| viewer-browser | `[chromium] app-handoff.spec.js:228` "an import drops pending bubbles…" | load flake | `--project chromium --repeat-each 3`: `3 passed`, exit 0. |
| viewer-node | `app-sudo.test.js` hung 9+ min in the whole suite and was stopped by the sub-lead; it then reported "the hub stores machine approval warnings" | hang / load flake | Alone: `# pass 22 / # fail 0`. |
| machine | the same 18 tests as main (`win*.test.js`, `wslpath`) | on main | `comm` against main's list: no extras, none missing. Nothing hung. |

So the full run on bb3e2e3c passes under the lead's reading of S2. Later commits change only COMPLETION.md and PLAN.md, which the picker maps to nothing.
