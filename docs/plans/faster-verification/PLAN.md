---
slug: faster-verification
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-23
---

# Faster verification checks

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

## Watch List

Things noticed that need looking into — not yet decisions for the user. Written down the
moment they're spotted so they can't be forgotten, surfaced to the user one line at a
time as they appear, and emptied before Stage 1 exits.

Each item ends up settled by the agent (noted in the Log), promoted to an Open Question,
promoted to a Constraint or Accepted Risk, or waved off by the user.

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is two-part (chosen before PLAN.md existed). | Collin picked it. | user |
| 2 | The flaky harness test (viewer/test/app-harnesses.test.js:298-319) stops relying on a 1000 ms wall-clock deadline: it asserts the route answers while the never-resolving machine request is still pending, with a generous safety timeout only. | MAP.md: the never-resolving promise already proves non-blocking; the deadline only measures load. | defaulted |
| 3 | A failure seen during a check is compared with main by re-running only the failing test files on main, never the whole suite. | The whole-suite comparison was most of the doubled time. | defaulted |
| 4 | Browser workers: a run that finds no other cooperating browser run active (machine-wide lock in the test-run area) and a 1-minute load average below half the cores uses up to 6 workers; otherwise 2. An explicit --workers still wins. | Keeps S7's cap for concurrent runs (Constraint); 16 cores leave room solo. Collin offered lock or load check; both together cover non-cooperating runs. | defaulted |
| 5 | Tests are picked by a selector script: changed files -> tests from names, direct imports and a small hand-kept table; config, shared helpers or anything unmapped falls back to the full suite. | Predictable, errs toward running more. | user |
| 6 | The full run before a push is done by the session about to push or hand off (sub-lead at build end, lead for small fixes, after-done fixes and repairs), on the exact commit, in the background; verifiers run only picked tests. | Results do not depend on who runs them; removes the full run from every check. | user |
| 7 | Superseded Decision 4: browser workers are chosen by the registration lock only (no load average); a run alone uses min(6, cpus/2), later runs 2; full-run.sh runs the browser suite first. | Round 1: the run's own Node suite and the parallel verifier defeated the load check. | review-round-1 |
| 8 | A conflict-free merge of the default branch into work whose full run passed gets the picker's targeted run, not a full run; the Constraint is worded to match. | Collin's original ask (idea 3, also IDEA What good looks like); round 1 found the Spec contradicting it. | review-round-1 |
| 9 | The picker and full-run rules are opt-in per project through a `Test picker and full run` heading in the project's AGENTS.md; other projects keep today's flow. | Role rules serve every project; round 1. | review-round-1 |
| 10 | Verifier briefs name a picker base and a separate comparison commit (merge-base with the default branch); the main comparison uses `git archive` into scratch. | Round 1: a retry's base is not main; verifiers cannot add git worktrees. | review-round-1 |
| 11 | Superseded Decision 7's worker rule: only full runs (started by full-run.sh) may take the larger worker count, and only when no other full run is live; all other runs use 2. | Round 2: a short picked run must not hold a 10-minute full run at 2. | review-round-2 |
| 12 | Full-run evidence carries to descendant commits the picker selects nothing for, and to a conflict-free default-branch merge whose picked check passed. Verifiers switch to picked-only mode only when the brief gives a picker base and says the starter runs the full run. | Round 2: bookkeeping commits and rollout handshake. | review-round-2 |

## Spec

Mode: two-part. Read `MAP.md` first; it has the file:line evidence for today's flow.

### Today and the change

Verifiers run whatever validation commands the Spec and brief name, which are usually the
whole suites, and often re-run them on main to compare failures (MAP.md, Verification flow).
After this change, in a project that declares a test picker and a full run (S5.0; this
repository does): verifiers run only the tests the picker selects for the change they check
(S1); one full run covers each pushed commit (with the S5.6 exemptions), done by the session
about to push or hand off (S2, S5); full browser runs use more workers when no other full run
is going (S3); the flaky harness assertion stops measuring load (S4). Projects that declare
neither keep today's flow.

Rollout: this thread is built and checked under the installed rules, which run this Spec's
validation commands as written. The new rules take effect for threads started after the pull
request is merged and installed.

### S1. Test picker: `test-support/pick-tests.js`

`node test-support/pick-tests.js --base <commit> [--head <commit>] [--json]`, run from the
repository root. `--head` defaults to `HEAD`. Changed files are
`git diff --name-status -M <base> <head>` (two-commit form). With `--full` instead of
`--base`, it selects every suite.

Output: one shell command per line (or with `--json`,
`{ "changed": [...], "suites": [{ "suite", "command", "files", "reason" }] }`). Every
command runs from the repository root. Suites:

| Suite | Full command | Narrowed command |
|---|---|---|
| viewer-node | `node --test viewer/test/*.test.js` | `node --test <files>` |
| viewer-browser | `npm --prefix viewer run test:browser` | `npm --prefix viewer run test:browser -- <spec basenames>` |
| machine | `bash machine/test/run.sh` | `node --test <files>` |
| test-support | `node --test test-support/test/*.test.js` | (always full) |
| sensitivity | `bash sensitivity/test/run.sh` | (always full) |
| codex | `bash codex/test/run.sh` | (always full) |
| install | `bash install/test/run.sh` | (always full) |
| sudo-helper | `python3 -m unittest discover -s sudo-helper/test` and `bash sudo-helper/test/install-test.sh` | (always full) |

Full commands match AGENTS.md's Verification section exactly. Smoke, live and `./install.sh`
are never selected.

Rules, applied to each changed path; a test file is selected once even if several rules pick
it. **Only paths that exist at `<head>` are ever put in a command.**

0. **Deletions and renames.** A rename is treated as a change to its new path. A deleted test
   file selects nothing. A deleted non-test file is treated like a changed file of the same
   path (rules 2–5), so tests that still import it at head are found, else the fallback runs.
1. A changed test file (`viewer/test/*.test.js`, `viewer/test/*.spec.js`,
   `machine/test/*.test.js`) selects itself.
2. A changed source file (anywhere outside `*/test/` and `docs/`) selects every test file in
   `viewer/test/` **and** `machine/test/` (both components, at head) that names it in a
   `require(...)`/`import` path resolved relative to the test file, plus every test file of
   its own component (`viewer/` or `machine/`) whose basename starts with the source file's
   basename (without extension) followed by `.` or `-`.
3. `test-support/test-map.json`, a hand-kept list of `{ "glob", "tests" }` entries, adds
   tests for paths the import rule cannot see: served pages, scripts, protocol files read by
   tests (`viewer/test/protocol-rules.test.js`, `viewer/test/server.test.js`,
   `viewer/test/app-settings.test.js`, `machine/test/aside-turns.test.js`,
   `machine/test/service.test.js`, `machine/test/char-lib-argv.test.js`), and fixtures under
   `docs/` read by tests (for example `docs/plans/openrouter-harness/samples/**`, read by
   `viewer/test/app-openrouter-hub.test.js` and `machine/test/pi-login.test.js`, and
   `docs/plans/*/graphs/**`, which `viewer/test/browser.spec.js` finds with `git ls-files`). `tests`
   may be test paths or a suite name meaning that whole suite. The builder seeds it by
   grepping the test files for every repository path they read (`git ls-files`, `readFileSync`, `path.join`
   with `__dirname`, served URLs); it need not be complete, because of rule 5.
4. Files that fan out select their whole suite: anything under `viewer/test/helpers/` and
   `viewer/test/fixtures/` if present, `viewer/playwright.config.js`, `viewer/package.json`,
   `viewer/package-lock.json`, non-test files in `machine/test/`, `test-support/run-dir.js`;
   any file under `test-support/`, `sensitivity/`, `codex/`, `install/`, `sudo-helper/`
   selects that suite. `install.sh` selects install.
5. **Fallback:** a changed source file under `viewer/` or `machine/` that rules 2–3 map to no
   test selects its component's whole suites (viewer: viewer-node and viewer-browser;
   machine: machine). Any other changed path outside `docs/` that no rule or map entry
   covers (including root files other than `README.md`, `CONTRIBUTING.md`, `AGENTS.md` and
   `.gitignore`) selects every suite. Paths under `docs/`, and `*.md` files, that no map
   entry names select nothing.
6. Viewer front-end files (`viewer/app/pages/**`, `viewer/app/**/*.html`, `*.css` and
   client-side scripts) select browser specs only through `test-map.json`; unmapped ones fall
   back by rule 5. Rule 2 never selects browser specs, since they reach the app over HTTP.
7. If nothing is selected, the picker prints nothing and exits 0; `--json` gives
   `suites: []`.

Exit 1 with a one-line reason if `--base` is not a commit or git fails. The picker is
deterministic.

`test-support/test/pick-tests.test.js` covers each rule with a temp git repository built from
fixture files (it never depends on the real tree's map), including a cross-component import,
a deleted and a renamed test, a deleted source file, a `docs/` fixture entry, the fallback and
a docs-only change.

### S2. Full run: `test-support/full-run.sh`

`bash test-support/full-run.sh <log-dir>` runs every full command from S1's table,
**viewer-browser first** (so its worker choice in S3 is not affected by this run's own
earlier suites), then the rest in table order, each into `<log-dir>/<suite>.log`,
continuing past failures. It writes `<log-dir>/summary.txt`: first line
`commit <full sha of HEAD>`, then one line per suite `suite <name> exit <n>`. It refuses
(exit 2) when `git status --porcelain --untracked-files=no` is not empty. It exits 0 only
when every suite exited 0. It does not run smoke, live or `./install.sh`. A full run
**passes** for a commit when `summary.txt` names that commit and every suite exit is 0.

### S3. Browser workers when alone

`viewer/playwright.config.js` chooses workers through `test-support/browser-workers.js`,
which exports a pure `chooseWorkers({ full, othersFull, cpus })` and the registration handling:

- The decision is made once, in the Playwright runner's main process, and passed to its
  worker processes (for example through an environment variable set on first load), so
  worker processes re-loading the config neither register nor decide again.
- A run is **full** when started by `full-run.sh`, which sets `WHEELCHAIR_FULL_RUN=1`; any
  other run (a picked run, a worker's run) is not.
- A machine-wide directory `wheelchair-browser-tests` under `os.tmpdir()` holds one file per
  running full browser run, named by its process id. Files whose process is gone are ignored
  and removed. A full run adds its own file and removes it at exit.
- `chooseWorkers`: a full run with no other live full run registered →
  `min(6, floor(cpus / 2))`, at least 2; every other case → 2. There is no load-average check
  (a run's own earlier suites would defeat it). Picked runs are short, so they keep 2, and a
  short run never holds a full run down.
- The choice is made at start and kept. So the browser load is at most one larger full run
  plus 2 per other run.
- Runs that do not register (checkouts without this change) are not seen; they use their
  own cap of 2.
- `--workers` on the command line still overrides, as today. Node test concurrency is
  unchanged.
- `test-support/test/browser-workers.test.js` covers `chooseWorkers`, the stale-file handling
  and registration/removal.

### S4. Flaky harness test

In `viewer/test/app-harnesses.test.js` (the "switching a harness off … without waiting" test,
around lines 298-319), keep the never-resolving, rejected and 409 machine requests. Replace
`assert.ok(Date.now() - started < 1000)` and the first 100 ms sleep: assert the route answers
200 **while the never-resolving request is still pending**, and wait for all three DELETEs by
an observed event (a promise resolved when the third call arrives), with a safety timeout of
at least 10 seconds that fails the test instead of hanging. The switch-on half (the second
sleep and `assert.deepEqual(calls, [])`) stays as it is. `viewer/app/routes.js` does not
change.

### S5. Rules: who runs what

Edit `protocol/app/lead.md`, `protocol/app/sub-lead.md`, `protocol/app/verifier.md`,
`protocol/app/worker.md` as needed, `AGENTS.md` (Verification) and `CONTRIBUTING.md`:

0. **Opt-in per project.** The role rules apply to every project. A project opts in by
   naming, in its root `AGENTS.md` under a heading `Test picker and full run`, a picker
   command (taking a base commit) and a full-run command (taking a log directory, writing a
   summary that names the commit and passes as S2 defines). Wheelchair's `AGENTS.md` names
   `node test-support/pick-tests.js --base <commit>` and
   `bash test-support/full-run.sh <log-dir>`. Rules 3–6 below apply only in an opted-in
   project, and rule 2 too; elsewhere today's rules stand.
   **Handshake:** a verifier uses rules 2–3 only when its brief gives a picker base and says
   the starter runs the full run; a brief without both gets today's behaviour. So a lead or
   sub-lead still on older rules never gets a verifier that skips the full suite.
1. **Spec validation commands** (lead.md, step 4.6): in an opted-in project the lead writes
   targeted commands per Spec item and does not list whole-suite or full-run commands as
   validation; the full run is the pusher's (5, 6). Verifiers always run every Spec
   validation command as written, so older plans that list whole suites still get them.
2. **Comparing a failure with main** (verifier.md): run only the failing test files at the
   **comparison commit** the brief names (default: `git merge-base origin/<default branch>
   HEAD`), never the whole suite. Get that tree as its own clone in a scratch directory
   outside any repository: `git clone --quiet <your checkout> <scratch>/main` then
   `git -C <scratch>/main checkout --quiet --detach <commit>` (this writes only the scratch
   clone's own metadata), and link into it the dependency folders present in your own
   checkout (for this repository `viewer/node_modules` and any top-level `node_modules`). A
   failure counts as already on main only when the same test fails there with the same
   error; a test file that does not exist at the comparison commit, or fails there for a
   different reason, is the branch's failure. Report the comparison commit.
3. **Verifiers in an opted-in project** run the Spec's commands and the commands the picker
   prints for the **picker base** the brief names; never the full-run command, and never a
   whole suite the picker did not select. The report names both commits and the picked
   commands.
4. **Which commits a verifier brief names.** The comparison commit is always the merge-base of
   the checked commit with the default branch. The picker base is: the comparison commit for
   a first check of a build, small fix or after-done fix; the commit the previous attempt
   checked, for a re-check after remediation or a failed attempt (so the picker covers only
   the fix); the default-branch tip that was merged in, for a check after merging the default
   branch (repair or head changed, lead.md Making the pull request mergeable 6–7), so only
   this branch's own changes are retested on top of it.
5. **Sub-lead at the end of a build**: "full validation" before COMPLETION.md is replaced by
   the targeted task checks already run. When it starts verifiers it also starts the full run
   on the same commit in the background, logs in a scratch directory outside the repository.
   It sends the build `result` only when the verifiers pass **and** the full run passes for
   the commit it reports, and pastes `summary.txt` into COMPLETION.md. A full-run failure is a
   gap like a verifier gap (same remediation, counting, two-attempt rule and realism
   judgment). When a new commit replaces the one a full run is checking, stop that run first;
   after the fix, verifiers re-check with the previously checked commit as picker base, as in 4, and the full run
   repeats on the new commit.
6. **Lead before a push that adds commits** (small fix, after-done fix, repair) runs the full
   run on the exact commit, in the background alongside its verifier, stopping any full run
   whose commit was replaced. A full-run failure is a failed check under the rule that
   already governs that push: for a small fix or after-done fix it counts toward the two
   attempts and Collin's existing choice (push it as it is, or drop it and revert); for a
   repair (Making the pull request mergeable 6–8) nothing unverified is pushed and the
   budget's `needs` card applies, as today.
   **Covered:** a commit Y is covered by a passing full run on commit X when X is Y or an
   ancestor of Y and the picker selects nothing for X..Y (so COMPLETION.md and
   `status: done` commits stay covered). No full run is needed when:
   - the commit to push is covered; or
   - the push is a conflict-free merge of the default branch into a covered commit
     (Making the pull request mergeable 6–7):
     the verifier's picked run (base = the merged default-branch tip) is its check, as
     Collin asked. Once that check passes, the merge commit counts as covered too, so a later
     clean merge keeps the exemption. A merge with conflicts gets the full run.
7. **Workers** keep running their task's commands; worker.md may point them at the picker for
   their own changes. No worker runs the full run.
8. AGENTS.md's Verification section and CONTRIBUTING.md name the picker and the full run,
   keeping every existing command listed, and AGENTS.md gains the `Test picker and full run`
   heading of 0.

### Non-goals

Speeding up individual tests other than S4; changing what tests exist or check; changing
GitHub CI (`.github/workflows/macos.yml`); changing Node test concurrency; a coverage map;
gating the app's handoff export (it pushes a thread for handoff, unchanged); other projects'
own pickers.

### Validation

These are for this thread's verifiers, which run under the installed rules.

- `node --test test-support/test/*.test.js` (picker, workers, existing tests) exits 0.
- `for i in $(seq 10); do node --test viewer/test/app-harnesses.test.js || exit 1; done`
  exits 0 while `node --test viewer/test/*.test.js` runs concurrently in another shell as
  load (the second command's own result does not matter).
- `node test-support/pick-tests.js --base <docs-only commit>~1 --head <docs-only commit> --json`
  gives `suites: []` (create the commit in a scratch clone); against this branch's merge-base
  it selects the suites this branch touches.
- `bash test-support/full-run.sh <scratch-dir>` on the final commit exits 0 and `summary.txt`
  lists all eight suites with exit 0. (For this thread the sub-lead runs it; under the
  installed rules a verifier may run it too.)
- `node --test viewer/test/protocol-rules.test.js` exits 0 after the protocol edits.
- A browser run with `WHEELCHAIR_FULL_RUN=1` and no other full run uses `min(6, floor(cpus/2))`
  workers; a second full run started while the first runs uses 2, and a run without the
  variable uses 2 (check each runner's reported worker count).

## Deferred

Optional; present only in the lighter modes.

| # | Item | Why it can wait | Source | Notes for the follow-up |
|---|------|-----------------|--------|-------------------------|
| 1 | Follow imports transitively so picks are smaller | The fallback already runs more, never less | planning | Rule 2 reads only direct imports |
| 2 | A check that flags test-map.json entries pointing at missing files or globs matching nothing | A stale entry only makes picks larger or falls back | planning | Could live in pick-tests.test.js against the real tree |
| 3 | Record per-suite timings from full runs | Nice for tuning, not needed for speed | planning | summary.txt could gain a seconds column |

## Accepted Risks

Real issues consciously not fixed, each with the reason. Part of the spec, not review
scaffolding — an implementer should read these, and later review rounds must not
re-raise them. Rare paths per `protocol/app/realism.md` land here in every mode, with round
`review-round-N`, `verification-N` or `lead-check`.

| Risk | Why accepted | Round |
|------|--------------|-------|
| Two browser runs starting within the same instant can both see no other run and both take the larger worker count | Sub-second race between two actors (realism.md rare path); worst case is extra load for one run | review-round-1 |

## Check Once Built

Review findings only the built code can settle, per `protocol/app/realism.md`. Verifiers
check each row against the build; a listed row is settled for later review rounds and
stays as review history.

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — 2026-11-23

**Lanes:** intent: claude (reviewer); mechanics: gpt (reviewer-2); cross-family: yes.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | S5.5 forced a full run on a clean merge, against IDEA "What good looks like" | upheld | D8; S5.6 exemption; Constraint reworded |
| intent | major | Load check defeated by the run's own Node suite and the parallel verifier | upheld | D7; S3 lock only; S2 browser first |
| intent | minor | Superseded full runs keep running | upheld | S5.5/S5.6 stop replaced runs |
| mechanics | blocking | Wheelchair commands in role rules used by every project | upheld | D9; S5.0 opt-in |
| mechanics | blocking | No rollout path for this build's own gate | downgraded (minor) | Normal protocol rollout: this thread runs under installed rules; Spec now says so |
| mechanics | blocking | Handoff export pushes without the gate | downgraded (minor) | Export is a handoff, not a finishing push; added as non-goal |
| mechanics | blocking | Push-as-is choice after two failures unaddressed | downgraded (minor) | Obvious reconciliation; S5.6 now states it |
| mechanics | blocking | Validation lists suites verifiers are forbidden to run | downgraded (major) | S5.1 verifiers run Spec commands as written; Validation scoped to installed rules |
| mechanics | blocking | Overlap validation contradicts launch-time choice | downgraded (major) | S3 states kept choice and bound; validation fixed; race in Accepted Risks |
| mechanics | blocking | Retry base used as main comparison commit | downgraded (major) | D10; S5.2/S5.4 separate commits |
| mechanics | blocking | Deleted test files put in commands | downgraded (major) | S1 rule 0; only head paths |
| mechanics | blocking | Cross-component imports missed | downgraded (major) | S1 rule 2 scans both components |
| mechanics | blocking | docs/plans fixtures read by tests skip the full run | downgraded (major) | S1 rule 3 docs fixtures; S5.6 exemption is "picker selects nothing" |
| mechanics | major | No supported way to get the main comparison checkout | upheld | S5.2 git archive + linked deps |
| mechanics | minor | S4 switch-on assertion underspecified | upheld | S4 keeps switch-on half unchanged |

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`check-once-built`/`user-decision`) is what gates the
exit. Downgrades and declines cite evidence.

### Round 2 — 2026-11-23

**Lanes:** intent: claude (reviewer-3); mechanics: gpt (reviewer-4); cross-family: yes.

**Changed since Round 1:** S1 rule 0 (deletions/renames), rule 2 (both components), rule 3 (docs fixtures), rule 5 wording; S2 browser first, no clean line; S3 lock only, kept choice, bound; S4 switch-on unchanged; S5.0 opt-in per project; S5.1 verifiers run Spec commands as written; S5.2 comparison via git archive; S5.4 two commits; S5.5/S5.6 stop replaced runs, push-as-is, exemptions (picker selects nothing; conflict-free default-branch merge); rollout paragraph; non-goals; Validation; IDEA Constraint wording; Accepted Risk (registration race).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | A short picked run starting first holds the full run at 2 workers | upheld | D11; S3 full-run priority |
| intent | minor | Per-file main comparison applied to every project; "same failure" undefined | upheld | S5.0 rule 2 opted-in only; S5.2 same test, same error |
| intent | minor | Summary says full run per pushed commit, ignoring exemptions | upheld | Wording fixed |
| mechanics | blocking | git archive copy lacks git metadata for git-using tests | downgraded (major) | S5.2 scratch clone at the comparison commit |
| mechanics | blocking | Full-run evidence lost across bookkeeping commits and clean merges | downgraded (major) | D12; "covered" definition; merge commit covered |
| mechanics | blocking | Push-as-is choice wrongly extended to repairs | downgraded (major) | S5.6 repairs keep no-unverified-push and needs card |
| mechanics | major | No rollout handshake between old leads and new verifiers | upheld | D12; S5.0 handshake |
| mechanics | major | docs graphs read via git ls-files unmapped | upheld | S1 rule 3 entry and seeding by git ls-files |
| mechanics | minor | S5.5 vs S5.4 re-check base wording | upheld | S5.5 aligned with S5.4 |

### Round 3 — 2026-11-23

**Lanes:** intent: claude; mechanics: not claude; cross-family: yes.

**Changed since Round 2:** S3 only full runs (WHEELCHAIR_FULL_RUN) take the larger count; S5.0 rule 2 opted-in only and the verifier handshake; S5.2 scratch clone, same-test-same-error; S5.3 no-base sentence removed; S5.5 re-check base; S5.6 repairs vs push-as-is, "covered" definition, merge commit covered; S1 rule 3 graphs entry; summary wording; Validation S3 line.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

Parts of the Spec already built before this plan reached Stage 3 — adopted from outside
with work already done, or left behind by an implementation run that died partway.

Stage 3 does not re-implement `pre-existing` items and does not touch their code. Stage 4
verifies them exactly as rigorously as everything else: this code has never been through
the gate, so skipping it would leave the least-trustworthy part of the change as the only
part nobody checked.

Ambiguous evidence means **not done**. A wrong "done" is a silent hole; a wrong "not done"
costs a worker one look.

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|
|           | pre-existing / partial | | high / low |

`partial` items are implemented by Stage 3 — the brief names what exists so the worker
completes it instead of restarting it.

## Implementation Tasks

Filled by Stage 3. One row per worker brief.

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

Session id = the `thread_id` of a `codex exec` lane, so remediation can resume it.

## Log

Free-form running notes: deviations discovered mid-implementation, scope events,
anything a future session needs that fits nowhere above.
