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

## Spec

Mode: two-part. Read `MAP.md` first; it has the file:line evidence for today's flow.

### Today and the change

Verifiers run whatever validation commands the Spec and brief name, which are usually the
whole suites, and often re-run them on main to compare failures (MAP.md, Verification flow).
After this change: verifiers run only the tests the picker selects for the change they
check (S1); the one full run happens once per pushed commit, by the session about to push
or hand off (S2, S5); browser runs use more workers when alone (S3); the flaky harness
assertion stops measuring load (S4).

### S1. Test picker: `test-support/pick-tests.js`

`node test-support/pick-tests.js --base <commit> [--head <commit>] [--json]`, run from the
repository root. `--head` defaults to `HEAD`. Changed files are
`git diff --name-only <base> <head>` (the two-commit form, so a merge's base can be the
new main tip). With `--full` instead of `--base`, it selects everything.

Output: one shell command per line (or with `--json`, `{ "changed": [...], "suites": [{ "suite", "command", "files", "reason" }] }`).
Every command runs from the repository root. Suites and their commands:

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

If `node --test viewer/test/*.test.js` needs a different cwd in practice (check
`viewer/package.json` scripts), use whatever form the root AGENTS.md lists; the picker's
commands must match AGENTS.md's Verification section exactly for full runs. Smoke, live and
`./install.sh` are never selected.

Rules, applied to each changed file; a test file is selected once even if several rules
pick it:

1. A changed test file (`viewer/test/*.test.js`, `viewer/test/*.spec.js`,
   `machine/test/*.test.js`) selects itself.
2. A changed source file under `viewer/` or `machine/` (not under `test/`) selects every
   test file of that component that names it in a `require(...)`/`import` path resolved
   relative to the test file, plus every test file whose basename starts with the source
   file's basename (without extension) followed by `.` or `-`.
3. `test-support/test-map.json`, a hand-kept list of `{ "glob", "tests" }` entries, adds
   tests for files the import rule cannot see (served pages, scripts, protocol files read
   by tests such as `viewer/test/protocol-rules.test.js`, `viewer/test/server.test.js`,
   `viewer/test/app-settings.test.js`, `machine/test/aside-turns.test.js`,
   `machine/test/service.test.js`, `machine/test/char-lib-argv.test.js`). `tests` may be
   test paths or a suite name meaning that whole suite. The builder seeds it by grepping
   tests for the paths they read; it need not be complete, because of rule 5.
4. Files that fan out select their whole suite: anything under `viewer/test/helpers/`,
   `viewer/playwright.config.js`, `viewer/package.json`, `viewer/package-lock.json`,
   `machine/test/` non-test files, `test-support/run-dir.js`; any file under
   `test-support/`, `sensitivity/`, `codex/`, `install/`, `sudo-helper/` selects that
   suite. `install.sh` selects install.
5. **Fallback:** a changed source file under `viewer/` or `machine/` that rules 2–3 map to
   no test selects its component's whole suites (viewer: viewer-node and viewer-browser;
   machine: machine). Any other changed file outside `docs/` and outside the rules
   (including root files other than `README.md`, `CONTRIBUTING.md`, `AGENTS.md` and
   `.gitignore`) selects every suite. Files under `docs/`, and `*.md` files no rule or
   map entry names, select nothing.
6. Viewer front-end files (`viewer/app/pages/**`, `viewer/app/**/*.html`, `*.css` and
   client-side scripts) select browser specs only through `test-map.json`; unmapped ones
   fall back by rule 5. Rule 2 never selects browser specs, since they reach the app over
   HTTP.
7. If nothing is selected (docs-only change), the picker prints nothing and exits 0;
   `--json` gives `suites: []`.

Exit 1 with a one-line reason if `--base` is not a commit or git fails. The picker is
deterministic: the same commits give the same output.

`test-support/test/pick-tests.test.js` covers each rule with a temp git repository built
from fixture files (it never depends on the real tree's map), including the fallback and a
docs-only change.

### S2. Full run: `test-support/full-run.sh`

`bash test-support/full-run.sh <log-dir>` runs every full command from S1's table, in that
order, each into `<log-dir>/<suite>.log`, continuing past failures. It writes
`<log-dir>/summary.txt`: first line `commit <full sha of HEAD>`, then `clean yes|no`
(whether `git status --porcelain --untracked-files=no` was empty at start), then one line
per suite `suite <name> exit <n>`. It exits 0 only when every suite exited 0. It refuses
(exit 2) when run from a dirty tracked tree. It does not run smoke, live or `./install.sh`.
A full run **passes** for a commit when `summary.txt` names that commit, `clean yes`, and
every suite exit is 0.

### S3. Browser workers when alone

`viewer/playwright.config.js` chooses workers in a small module
(`test-support/browser-workers.js`, exporting a pure `chooseWorkers({ others, load1, cpus })`
and the lock handling):

- The decision is made once, in the Playwright runner's main process, and passed to its
  worker processes (for example through an environment variable set on first load), so
  each worker process re-loading the config does not register or decide again.
- A machine-wide directory `wheelchair-browser-tests` under `os.tmpdir()` holds one file
  per running browser run, named by its process id. Files whose process is gone are
  ignored and removed. The run adds its own file and removes it at exit.
- `chooseWorkers`: if no other live run is registered and the 1-minute load average is
  below `cpus / 2`, use `min(6, floor(cpus / 2))` but at least 2; otherwise 2.
- `--workers` on the command line still overrides, as today. Node test concurrency is
  unchanged.
- `test-support/test/browser-workers.test.js` covers `chooseWorkers` and the stale-file
  handling.

### S4. Flaky harness test

In `viewer/test/app-harnesses.test.js` (around lines 298-319), the switch-off test keeps
its never-resolving, rejected and 409 machine requests. It asserts that the route answers
200 **while the never-resolving request is still pending** (that is the proof it does not
wait on the machine), and that all three DELETEs were launched, by waiting on an observed
event (for example a promise resolved when the third DELETE arrives) instead of a fixed
100 ms sleep. The only time limit left is a safety timeout of at least 10 seconds that
fails the test instead of hanging. Behaviour of `viewer/app/routes.js` does not change.

### S5. Rules: who runs what

Edit `protocol/app/lead.md`, `protocol/app/sub-lead.md`, `protocol/app/verifier.md`,
`protocol/app/worker.md` as needed, `AGENTS.md` (Verification) and `CONTRIBUTING.md`, so
that:

1. **Spec validation commands** (lead.md, step 4.6): the lead writes targeted commands per
   Spec item and does not list whole-suite commands as verifier work; the full run is
   `test-support/full-run.sh`, done by the pusher (below).
2. **Verifiers** (verifier.md): run the Spec's targeted commands and the commands
   `node test-support/pick-tests.js --base <base>` prints, with the base the brief names;
   never `full-run.sh`, and never a whole suite the picker did not select. A failure is
   compared with main by running only the failing test files at the base's main commit
   in a separate throwaway checkout (Decision 3). The report names the base and the
   picked commands. A brief with no base: use `git merge-base origin/<default branch> HEAD`.
3. **Which base** a verifier brief names: a first check of a build, small fix or after-done
   fix uses the merge-base with the default branch; a re-check after remediation or a
   failed attempt uses the commit the previous attempt checked (the picker then covers only
   the fix); a check after merging the default branch in (repair or head changed,
   lead.md Making the pull request mergeable 6–7) uses the default branch tip that was
   merged, so only this branch's own changes are retested on top of it.
4. **Sub-lead at the end of a build** (sub-lead.md, Finishing and verifying): "full
   validation" before COMPLETION.md is replaced by the targeted task checks already run;
   when it starts verifiers it also starts `full-run.sh` on the same commit in the
   background, logs in a scratch directory outside the repository. It sends the lead the
   build `result` only when the verifiers pass **and** the full run passes for the
   commit it reports. A full-run failure is a gap like a verifier gap (same remediation,
   counting and realism judgment); after its fix, verifiers re-check from the previous
   base as in 3 and the full run repeats on the new commit. Paste `summary.txt` into
   COMPLETION.md.
5. **Lead before every push that adds commits** (small fix, after-done fix, repair,
   merge re-verify): run `full-run.sh` on the exact commit to push, in the background
   alongside its verifier. Push only when both pass for that commit. A full-run failure is
   a failed check for the existing retry and budget rules. A planned build's push needs no
   second full run when the sub-lead's passing full run names the commit being pushed
   and only `docs/plans/` files changed since (the `status: done` commit).
   A push that adds no code commits (only `docs/plans/`) needs no full run.
6. **Workers** keep running their task's commands; worker.md may point them at the
   picker for their own changes. No worker runs `full-run.sh`.
7. AGENTS.md's Verification section and CONTRIBUTING.md name the picker and
   `full-run.sh`, keeping every existing command listed.

### Non-goals

Speeding up individual tests other than S4; changing what tests exist or check; changing
GitHub CI (`.github/workflows/macos.yml`); changing Node test concurrency; a coverage map.

### Validation

- `node --test test-support/test/*.test.js` (picker, workers, existing tests) exits 0.
- `node --test viewer/test/app-harnesses.test.js` passes 10 times in a row while
  `node --test viewer/test/*.test.js` runs concurrently in another shell.
- `node test-support/pick-tests.js --base HEAD~1 --json` on a docs-only commit gives
  `suites: []`; on this branch against its merge-base it selects the suites touched.
- `bash test-support/full-run.sh <scratch-dir>` on the final commit exits 0 and
  `summary.txt` lists all eight suites with exit 0.
- `node --test viewer/test/protocol-rules.test.js` exits 0 after the protocol edits.
- Two browser runs started together each use 2 workers; one run alone on an idle machine
  uses more (check the runner's reported worker count).

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

## Check Once Built

Review findings only the built code can settle, per `protocol/app/realism.md`. Verifiers
check each row against the build; a listed row is settled for later review rounds and
stays as review history.

| # | What to check | Round |
|---|---------------|-------|

## Review Rounds

### Round 1 — 2026-11-23

**Lanes:** <family / model>; <family / model>; cross-family: <yes|no>.

Written for every round, including one where the table below stays empty. The table gets a row
per finding, so a clean round would otherwise leave no record of which gate ran — which is the
round where knowing it matters most.

<!-- Round 2+: list what changed since the previous round; that list scopes the reviewers. -->

**Changed since Round N-1:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

Reported severity is the reviewer's opinion; the lead verdict
(`upheld`/`downgraded`/`declined`/`accepted-risk`/`check-once-built`/`user-decision`) is what gates the
exit. Downgrades and declines cite evidence.

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
