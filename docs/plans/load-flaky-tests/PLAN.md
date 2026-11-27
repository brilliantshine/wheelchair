---
slug: load-flaky-tests
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-26
---

# Make the whole-project test run reliable when the machine is busy

**Idea:** `IDEA.md`. Map: `MAP.md`, `docs/maps/load-sensitive-tests.md`, `docs/maps/full-test-runs.md`.

## Open Questions

None.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Load is reproduced by pinning the test and some CPU-burning helper processes to one CPU, not by loading the whole machine | Reproduces heavy contention for the test under check without slowing other threads on the shared machine | defaulted |
| 2 | Flaky tests are fixed by widening the gap between the good and bad outcome (longer budgets, waiting on events instead of fixed sleeps, time deadlines instead of loop counts), never by removing or loosening an assertion | IDEA.md: tests stay as strong as before | defaulted |
| 3 | The full-run stop test is fixed in the runner too: after a stop signal the runner waits for every process in both suites to end before exiting | The runner leaves browser test processes running after it exits; the test is right to expect them stopped | defaulted |
| 4 | No mockups: nothing here is visible in an app | Test-only and runner change | defaulted |
| 5 | The full run never re-runs a failed test; any failure fails the run | Collin picked "No re-run": a retry could let a real timing bug through | user |
| 6 | The install suite byte-checks only what wheelchair itself writes in the real `~/.wheelchair`, and skips what the AI tools write there while sessions run | Collin picked "Wheelchair's own files": passes while sessions run and still catches a wheelchair leak | user |
| 7 | Fixtures in `lifecycle.test.js` that start the real viewer with an explicit `--port` keep the probe-then-bind pattern unless a load run reproduces a clash there | Only the test's own holder has a reported failure; the viewer's own port handling is what those tests check | defaulted |
| 8 | S9 checks an allowlist of wheelchair's own files in account folders, not a skip list of AI-tool files | AI-tool file names change by version and event; the allowlist stays stable | review-round-1 |
| 9 | Supersedes 1: the load harness pins to 2 CPUs with 2 helpers per CPU by default, still leaving the rest of the machine alone | One CPU shared by a multi-process test and 3 helpers is harsher than the reported load | review-round-1 |
| 10 | Supersedes 3: after a stop signal the runner waits until its suites' own process groups are empty; browser engines in Playwright's own groups are Playwright's to close | Playwright starts browsers in separate groups and closes them on TERM | review-round-1 |
| 11 | The hub's archive call to the machine gets a 30 s timeout instead of 5 s | A real archive on a busy machine can take over 5 s and fail for the user; the test then still tells cancelling from waiting | review-round-1 |

## Spec

### General rules for every fix

- No assertion is removed, and no expected value is loosened. A timing budget may grow. A
  check that "nothing happened" waits past the timer it guards, with margin, and that timer
  is set long enough that the steps before it fit under load.
- Waits poll to a time deadline, never a fixed number of iterations.
- A waiter for a request or response is registered before the action that causes it.
- When a cause turns out to be a product race (wheelchair code, not test code), the product
  is fixed and the fix is named in the task report.
- New files that need picker coverage get a `test-support/test-map.json` entry, per that
  file's existing pattern.
- "Passes under load" below means
  `bash test-support/under-load.sh --repeat <K> -- <command>` exits 0 with the default CPUs and helpers.

### S1. A load harness: `test-support/under-load.sh`

`bash test-support/under-load.sh [--cpus N] [--hogs H] [--repeat K] -- <command...>`

- Picks the N highest-numbered CPUs it is allowed to run on (from `taskset -pc $$`, not the
  installed count; default N 2), pins itself and everything it starts to
  them with `taskset -c`, and starts H busy-loop helpers there (default 2 per CPU). Only
  those CPUs are loaded, so other threads on the machine are unaffected. The default
  roughly matches the reported load (about 3 to 4 busy processes per core). Usage errors
  include N larger than the number of allowed CPUs.
- Runs the command K times in a row (default 5), each with stdin from `/dev/null`, its
  output passed through, then prints `under-load: pass <p> of <K>` and exits 0 only if all
  K passed, else 1. Usage errors exit 2.
- Kills every helper on normal exit and on TERM, HUP and INT; a signal also stops the
  running command and exits non-zero.
- Without `taskset` it prints `under-load: taskset not found` and exits 2.
- Tested by `test-support/test/under-load.test.js`, which skips (`t.skip`) on a host without
  `taskset`: the count line and exit code for a
  passing and a failing command, the command running pinned to the chosen CPUs, and no helper
  alive after a normal exit and after TERM.
- Not run by the full run beyond its own test.

Check: `node --test test-support/test/under-load.test.js`

### S2. Stopping a full run (`test-support/full-run.sh:34-45`, `test-support/test/full-run.test.js:50`)

Cause: the browser job's leader is a subshell. On TERM, `wait` returns when the subshell
dies, before its child has handled TERM, so the runner can exit while browser tests still
run; the test then finds no `viewer-browser stopped`. The fixture stub also writes `start`
before installing its trap, so a signal can land before the trap exists.

- `stop_run`, after sending TERM to each recorded process group, polls every 0.1 s until no
  process is left in that group (`kill -0 -- -<pgid>` fails), for up to 10 s; it then sends
  KILL to any group still present, polls again up to 2 s, and exits 1 without writing
  `summary.txt`, as today.
- Scope (Decision 10): the runner waits for its own suites' process groups. Browser engines
  that Playwright starts in groups of their own are Playwright's to close; its runner
  closes them on TERM before it exits, so an empty browser-job group means Playwright has
  finished stopping.
- The fixture stub installs its trap before it writes `start`, and writes its own PID in
  the `start` record. After the runner exits, the test asserts both `stopped` records, the
  no-summary file, and that neither stub PID is still alive (`process.kill(pid, 0)` throws
  `ESRCH`).

Check: `node --test test-support/test/full-run.test.js`, and it passes under load with
`--repeat 10`.

### S3. Pre-prefix holder (`viewer/test/lifecycle.test.js:57-77,255`)

Cause (likely): the test probes a free port, releases it, then the holder binds it; another
process can take it in the gap, and the holder exits 1 on EADDRINUSE.

- The holder listens on port 0 and prints `ready <port>`; `prePrefixHolder` reads the port
  from that line and returns it, and the tests use that port.
- The wait for `ready` has a 15 s deadline. stderr is collected from the start. If the
  holder ends before `ready` (waiting for `close`, so stderr is drained) or the deadline
  passes, the holder is killed if still running and the error includes its exit code or
  signal and its stderr.
- Other fixtures stay as they are (Decision 7).

Check: `node --test viewer/test/lifecycle.test.js`, and it passes under load.

### S4. Quiet-agent tests (`viewer/test/app-quiet.test.js`)

Cause: the file uses a 50 ms grace between a turn ending and the nudge. In test 6 the
worker's message must land inside it; under load it lands later and the nudge fires.

- A test that checks for silence after a step that must land inside the grace (6, 6c, 6d,
  and all of 7, which checks silence in both halves) runs with `WHEELCHAIR_QUIET_GRACE_MS`
  of at least 2000, and each silence check waits past the grace with at least 500 ms
  margin. Its waits for a nudge in the same test use `until`, whose 8 s deadline already
  covers the longer grace; raise that deadline for the test if needed.
- Test 5 keeps its check inside the grace (that no nudge has been sent before the grace
  ends) and its later check after it; its grace grows so that its 100 ms step fits under
  load (at least 2000), and its delays scale with it.
- Tests that only wait for a nudge keep their short grace.
- The worker checks the rest of the file by these rules and names any other test changed.

Check: `node --test viewer/test/app-quiet.test.js`, and it passes under load.

### S5. Verifier report retry (`viewer/test/app-hub.test.js:1327`)

Cause: besides the 1 s deadline, the hub saves the cleared queue after the machine records
the submit (`viewer/app/sessions.js:574-599`), so the test can read stale saved state.

- The test waits, to one 10 s deadline, until the fake machine has a submit and the saved
  thread shows the lead's queue empty and no `delivery_error`; then it makes the existing
  assertions, including exactly one submit with that exact text.

Check: `node --test --test-name-pattern "verifier report survives" viewer/test/app-hub.test.js`,
and it passes under load.

### S6. Archive cancels a stalled upload (`viewer/test/app-uploads-archive.test.js:65`)

Two budgets are involved. The hub's archive call to the machine uses the default 5 s
timeout of `hub.call` (`viewer/app/threads.js:234`, `viewer/app/machine-client.js:73`);
the stalled upload never finishes on its own, because the client never sends the rest.
If archive waited for the upload, the archive call would time out and the test would see a
non-200. Under load, a real archive can also take over 5 s, which fails the test and would
fail a user's archive on a busy machine.

- Product (Decision 11): the hub's archive call passes a 30 s timeout instead of the 5 s
  default. Nothing else in `hub.call` changes.
- Test: before starting archive, it asserts the upload is still pending (the `.part` file
  exists and the outcome promise has not settled). The archive must return 200; the elapsed
  check becomes "under 25 s", which an archive that waited on the never-ending upload
  cannot meet. The 5.2 s stall stays unless reproduction shows it is the failing step; if
  it changes, the report says why.
- Waits that only cover setup (the `.part` file appearing) and the upload outcome after
  archive poll to at least a 15 s deadline; the test's own timeout grows to fit (at least
  90 s).

Check: `node --test --test-name-pattern "stalled upload" viewer/test/app-uploads-archive.test.js`,
and it passes under load.

### S7. Account switch (`machine/test/switch-http.test.js:107,136`)

`waitFor` polls every 10 ms to a 20 s time deadline instead of 300 iterations.

Check: `node --test machine/test/switch-http.test.js`, and it passes under load.

### S8. Browser specs

`viewer/test/app-threads.spec.js:573` ("approval: Start building enabled when Ready and
presses; offer press", Firefox) and `viewer/test/app-agents-decks.spec.js:247`
("popover invariant across a refresh", "page scrolled", Chromium).

- Deck spec, known gap: after setup it waits for an `/api/agents` response and two frames,
  but the page renders only after both `/api/agents` and `/api/threads` complete
  (`viewer/pages/agents.js:247`), and a render replaces the popover. So geometry can be read
  before the refresh it means to test. Fix: before the refresh, take a handle to the
  current `.deck-pop`; after it, wait until that handle is detached and a new `.deck-pop`
  is present, then two frames, then check geometry and scroll. This applies to every
  scenario in that `describe`.
- Approval spec, and the deck spec if it still fails: reproduce under load with a
  Playwright trace (`--trace on`), find the cause, and fix it under the general rules.
  Name the cause in the task report.
- A larger time budget (`test.slow()` or a longer wait timeout) is allowed only where the
  trace shows plain slowness; a missed event or wrong order is fixed, not waited out.
- If the approval spec does not fail in 20 tries under load, apply the general rules
  (waiters registered before actions, deadlines long enough for a slow page) and say in the
  report that it did not reproduce.

Checks, each passing under load (`--repeat 5`):
`npm --prefix viewer run test:browser -- test/app-threads.spec.js -g "offer press" --project firefox --workers 1`
`npm --prefix viewer run test:browser -- test/app-agents-decks.spec.js -g "popover invariant across a refresh" --project chromium --workers 1`

### S9. Install suite's real-folder check (`install/test/run.sh:27-49,234,705`)

The check names what wheelchair writes; it never lists what the AI tools write, since
those change with each tool version and event (Decision 6).

- Outside `accounts/`, the real `~/.wheelchair` stays checked in full, as today.
- Inside each `accounts/<name>/`, only the files wheelchair's code writes there are
  checked, byte for byte: `CLAUDE.md`, `AGENTS.md`, `wheelchair-account.json`, and
  wheelchair's entries under `skills/`. The worker confirms the list by searching the
  code that writes into account folders (for example `connectors/common.js`,
  `machine/lib/harness-install.js`, `viewer/app/`) and names every writer in a comment
  beside the list. Everything else inside an account folder is not checked.
- Files both sides write (for example Codex's `config.toml`, which wheelchair creates once
  at `connectors/common.js:13` and Codex may then change, and Claude's `settings.json`)
  are checked only for being created or deleted during the suite, not for content. The
  comment names them.
- Which paths are skipped depends on the path, not on who writes it: transcripts the machine
  service copies into an account's `projects/` or `sessions/` during an account switch
  (`machine/service.js:922-935`) are skipped like the CLIs' own, and so is any other
  tool's account folder content (including Kimi's `sessions/`).
- The second snapshot is taken after the suite's last fixture case, just before the
  `RESULT` line, so the Darwin and later cases are covered too. The other five real-file
  checks move with it.
- On a mismatch the failure lists the changed paths (relative to `~/.wheelchair`), not only
  two hashes.
- The snapshot function moves to `install/test/tree-state.sh`, sourced by `run.sh`. Its
  self-check, `install/test/tree-state-test.sh`, builds a synthetic tree in a temporary
  directory (never copying real account files) and checks: changing a checked file changes
  the result; changing an unchecked account file does not; creating or deleting a shared
  file does; the mismatch lists the changed path. `run.sh` runs it, so the full run covers
  it.

Checks: `bash install/test/tree-state-test.sh`; and `bash install/test/run.sh` passes on
this machine while wheelchair sessions are running, three times in a row.

### S10. Full-run pass rule

Unchanged: no re-runs. Any suite exit other than 0 fails the run (Decision 5).
`test-support/test/full-run.test.js`'s failure cases also assert that each suite stub
wrote exactly one `start` record, so a re-run would fail the test.

Check: `node --test test-support/test/full-run.test.js`

### Non-goals

- No retries, no change to which suites the full run runs or how many browser workers it
  uses.
- No changes to tests not named here, unless a worker finds they share a cause with a named
  one and fixes them the same way; such extras are named in the report.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-26

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | S9's skip list of AI-tool files is unstable: tools add versioned and event-written files the 10-minute watch misses | upheld | S9 now lists what wheelchair writes in account folders (allowlist); shared files checked for create/delete only |
| intent | minor | S1 on one CPU with 3 helpers is harsher than the reported load, inviting needless budget growth | upheld | S1 defaults to 2 CPUs, 2 helpers per CPU |
| intent | minor | S6 jumps to a new product setting before trying an in-test fix | upheld | S6 widens the gap inside the test first |
| mechanics | blocking | S8 commands run Playwright from the repo root, missing the viewer config | upheld | Commands use `npm --prefix viewer run test:browser --` |
| mechanics | blocking | S5: hub saves the cleared queue after the submit, so a longer wait alone still reads stale state | upheld | S5 waits for submit and saved state together |
| mechanics | blocking | S6 conflates the upload's lifetime with the hub's 5 s archive call timeout | upheld | S6 names both; archive call gets 30 s (Decision 11); upload asserted pending |
| mechanics | blocking | S2 group probes cannot prove browser engines stopped; no process-exit check | downgraded to major | Scope set to the suites' own groups (Decision 10); fixture checks stub PIDs gone |
| mechanics | blocking | S9 second snapshot runs before the Darwin and later cases | upheld | Snapshot moved after the last case |
| mechanics | blocking | S8 deck test can check geometry before the refresh redraws the popover | upheld | Wait for the old popover detached and a new one present |
| mechanics | minor | S1 uses installed CPU count, not allowed affinity; no taskset handling in its test | upheld | Allowed CPUs; test skips without taskset |
| mechanics | minor | S3 readiness deadline and failure cleanup unspecified | upheld | 15 s deadline, kill on failure, stderr via close |
| mechanics | minor | S4 conflicting for mixed cases (5, 7) | upheld | Rules for 5 and 7 spelled out |
| mechanics | minor | S9 skip by writer misses machine-copied transcripts and Kimi | upheld | Skip by path, not writer |
| mechanics | minor | S9 self-check has no targeted command | upheld | `install/test/tree-state-test.sh` |
| mechanics | minor | S10 no check that nothing is re-run | upheld | One `start` per stub asserted |

### Round 2 — 2026-11-26

**Lanes:** intent: pending; mechanics: pending; cross-family: pending.

**Changed since Round 1:** S1 (2 allowed CPUs, 2 helpers each, taskset skip); S2 (scope to the suites' own groups, KILL then re-poll, stub PID checks; Decision 10); S3 (15 s ready deadline, cleanup, stderr); S4 (rules for tests 5 and 7); S5 (wait for saved state too); S6 (two budgets, archive call timeout 30 s, Decision 11; upload asserted pending); S8 (npm commands; deck test waits for the popover to be replaced); S9 (allowlist of wheelchair files in account folders, Decision 8; skip by path; snapshot after the last case; `install/test/tree-state.sh` and its self-check); S10 (one start per stub).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks
