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
| 12 | Split off S9: the install suite's real-folder check moves to its own thread; IDEA.md's What and What good looks like drop it and Not doing points to the new thread. Decisions 6 and 8 and S9's two Accepted Risks go with it | Collin picked "Split it off" after S9 drew blocking or major findings in rounds 1-3 while the rest settled | idea-change |

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

- Picks N CPUs at random from those it is allowed to run on (from `taskset -pc $$`, not the
  installed count; default N 2) and prints them as `under-load: cpus <list>`, so two runs at once usually
  land on different CPUs; it pins itself and everything it starts to
  them with `taskset -c`, and starts H busy-loop helpers there (default 2 per CPU). Only
  those CPUs are loaded, so other threads on the machine are unaffected. The default
  roughly matches the reported load (about 3 to 4 busy processes per core). Usage errors
  include N larger than the number of allowed CPUs.
- Runs the command K times in a row (default 5), each in its own process group (`setsid`)
  with stdin from `/dev/null`, its
  output passed through, then prints `under-load: pass <p> of <K>` and exits 0 only if all
  K passed, else 1. Usage errors exit 2.
- Kills every helper on normal exit and on TERM, HUP and INT (INT works only when the
  harness runs in the foreground; a background caller cancels it with TERM, and its test
  uses TERM); a signal also sends TERM to
  the running command's whole process group, waits up to 60 s for it to empty (longer than
  S2's 45 s runner cleanup, so a nested full-run fixture can finish stopping), then KILLs
  it, and exits non-zero. Processes the command moved into groups of their own are the
  command's to stop.
- Without `taskset` it prints `under-load: taskset not found` and exits 2.
- Tested by `test-support/test/under-load.test.js`, which skips (`t.skip`) on a host without
  `taskset`: the count line and exit code for a
  passing and a failing command, the command running pinned to the chosen CPUs, and no helper
  alive after a normal exit and after TERM; the TERM case runs a command that starts a
  child of its own, and checks that child is gone too.
- That test keeps its own cost small, since it runs in every full run: one helper, one CPU,
  `--repeat` of at most 2, and commands that finish in under a second.
- Not run by the full run beyond its own test.

Check: `node --test test-support/test/under-load.test.js`

### S2. Stopping a full run (`test-support/full-run.sh:34-45`, `test-support/test/full-run.test.js:50`)

Cause: the browser job's leader is a subshell. On TERM, `wait` returns when the subshell
dies, before its child has handled TERM, so the runner can exit while browser tests still
run; the test then finds no `viewer-browser stopped`. The fixture stub also writes `start`
before installing its trap, so a signal can land before the trap exists.

- `stop_run`, after sending TERM to each recorded process group, polls every 0.1 s until no
  process is left in that group (`kill -0 -- -<pgid>` fails), for up to 45 s (longer than
  Playwright's 30 s worker teardown limit, so a worker closing its browsers is not cut
  short); it then sends KILL to any group still present, polls again up to 2 s, and exits 1 without writing
  `summary.txt`, as today.
- Scope (Decision 10): the runner waits for its own suites' process groups. Browser engines
  that Playwright starts in groups of their own are Playwright's to close; its runner
  closes them on TERM before it exits, so an empty browser-job group within the 45 s means
  Playwright has finished stopping. After a KILL nothing is promised about browser engines.
- The fixture stub installs its trap before it writes `start`, and writes its own PID in
  the `start` record. The browser stub's trap waits until the viewer-node stub's `stopped` record exists
  (polling, up to 5 s), then 1 s more, before writing its own `stopped` and exiting, so a
  runner that returns as soon as the browser job's leader dies is caught by the test. After the runner exits, the test asserts both `stopped` records, the
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
  margin. In test 7, after the reminder reaches the fake machine, it waits until the saved
  thread shows that delivery (queue empty, turn started) before writing the waiting child
  into the state file. Its waits for a nudge in the same test use `until`, whose 8 s deadline already
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

- `waitFor` polls every 10 ms to a 20 s time deadline instead of 300 iterations.
- Cause found in review: two background timers call `checkReady`, which marks the switch
  done and clears `active_switch` (`machine/service.js:1238`): the readiness poll
  (`pollTimer`, every 2 s, `machine/service.js:471`) and the trust poll (`trustTimer`,
  every 500 ms, `machine/service.js:479`, which checks `starting` sessions relaunched in
  the last 30 s, the state a switch leaves). Either can finish the switch before a slow
  test sees it, so the wait never succeeds. The test fixture stops every background timer
  that can reach `checkReady` (at least `pollTimer` and `trustTimer`) right after
  `listen()`; the tests already call `checkReady` themselves where they mean readiness to
  happen. Product code unchanged.

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
  is present, then two frames, then check geometry and scroll. In scenarios with a
  `change`, the wait is for a new `.deck-pop` rendered from the changed data (the deck shows
  round 41), since a response fetched before the change can replace the popover first.
  This applies to every scenario in that `describe` and to "popover scrolled to the bottom
  grows on refresh", which adds round 41 inline rather than in `change`.
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
`npm --prefix viewer run test:browser -- test/app-agents-decks.spec.js -g "popover invariant across a refresh|popover scrolled to the bottom grows on refresh" --project chromium --workers 1`

### S9. (Removed)

The install suite's real-folder check moved to its own thread (Decision 12). Do not
change `install/test/run.sh` in this plan.

### S10. Full-run pass rule

Unchanged: no re-runs. Any suite exit other than 0 fails the run (Decision 5).
`test-support/test/full-run.test.js`'s stub records which command started it (the
sudo-helper suite runs two: the Python tests and `install-test.sh`), and the failure cases
assert exactly one `start` record per command, so a re-run would fail the test.

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

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 1:** S1 (2 allowed CPUs, 2 helpers each, taskset skip); S2 (scope to the suites' own groups, KILL then re-poll, stub PID checks; Decision 10); S3 (15 s ready deadline, cleanup, stderr); S4 (rules for tests 5 and 7); S5 (wait for saved state too); S6 (two budgets, archive call timeout 30 s, Decision 11; upload asserted pending); S8 (npm commands; deck test waits for the popover to be replaced); S9 (allowlist of wheelchair files in account folders, Decision 8; skip by path; snapshot after the last case; `install/test/tree-state.sh` and its self-check); S10 (one start per stub).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | S9 allowlists "wheelchair's entries under skills/", but wheelchair writes nothing there and live sessions change it | upheld | skills/ removed from the allowlist |
| intent | minor | `agy-models.json` outside accounts/ is rewritten by the live hub when Settings loads | upheld | Live-service files outside accounts/ get the create-or-delete check, each named |
| intent | minor | Rare path: in-place rewrite of `wheelchair-account.json` at session start | accepted-risk | Accepted Risks |
| mechanics | blocking | S10's one-start check fails on a correct run: sudo-helper runs two commands | upheld | One start per command, stub records its command |
| mechanics | blocking | S8 change scenarios can measure a popover rendered from data fetched before the change | upheld | Wait for the popover showing round 41 |
| mechanics | major | S1 kills only the command PID, leaving descendants | upheld | Own process group, TERM then KILL the group; tested with a child |
| mechanics | major | S2's 10 s KILL cuts Playwright's 30 s worker teardown short | upheld | 45 s before KILL; no promise after KILL |
| mechanics | major | S9 flags an account seeded live during the suite | accepted-risk | Rare path; Accepted Risks |
| mechanics | minor | S4 test 7 writes the fixture before the hub saves the delivery | upheld | Wait for saved state first |
| mechanics | minor | S9 lists the whole installer suite as a Spec check | upheld | Targeted self-check only; live check is the full run |

### Round 3 — 2026-11-26

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 2:** S1 (command in its own process group, group cleanup on signal, tested with a child); S2 (45 s before KILL, no promise after KILL); S4 (test 7 waits for saved delivery state); S8 (change scenarios wait for the popover showing round 41); S9 (skills/ dropped; live-service files outside accounts/ get the create-or-delete check; whole-suite command removed); S10 (one start per command); two new Accepted Risks.

A first start of this round's reviewers was stopped before they reported, because the plan edits had not been saved; it does not count.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | minor | S1 always picks the same CPUs, so two threads' load checks stack on them | upheld | CPUs picked at random and printed |
| intent | minor | S1's own test could burn two CPUs on every full run | upheld | Test limited to one helper, one CPU, at most 2 repeats |
| mechanics | blocking | S1's 10 s KILL can cut short a nested full-run fixture's 45 s cleanup when a load check is cancelled | downgraded to minor | Only on cancelling a check; leftovers are fixture sleeps that end on their own. S1 now waits 60 s before KILL |
| mechanics | minor | S2's browser stub exits fast enough that the old leader-only wait could still pass | upheld | Stub's trap waits 1 s before `stopped` |
| mechanics | minor | S8: the bottom-scroll test adds round 41 inline and needs the same marker wait | upheld | Named in S8 |
| mechanics | blocking | S9: create-or-delete check still trips on live first creation of `agy-models.json` and on a Settings CLI install's result and PID files | upheld | S9 split off (Decision 12) |
| mechanics | blocking | S9: the moved snapshot helper is also used for fixture isolation and idempotence checks; the allowlist must apply only to the real-home snapshots | upheld | S9 split off (Decision 12) |

### Round 4 — 2026-11-26

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 3:** S1 (CPUs picked at random and printed; small cost for its own test; 60 s before KILL); S2 (stub trap waits 1 s before `stopped`); S8 (the bottom-scroll test also waits for round 41); S9 removed and split off (Decision 12), with IDEA.md updated; S9's Accepted Risks removed with it.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | — | No findings | — | — |
| mechanics | blocking | S7: the background readiness poll can finish the switch and clear `active_switch` before the test sees it | upheld | Fixture stops the poll timer |
| mechanics | minor | S2: equal delays on both stubs let the old runner pass | upheld | Browser stub waits for viewer-node's `stopped` first |
| mechanics | minor | S8's deck command misses the bottom-scroll test | upheld | Filter extended |

### Round 5 — 2026-11-26

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 4:** S7 (fixture stops the background readiness poll); S2 (browser stub waits for viewer-node's `stopped`); S8 (deck command covers the bottom-scroll test).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | S7 stops only `pollTimer`; `trustTimer` (500 ms) also calls `checkReady` on a just-switched session | upheld | Fixture stops every timer that reaches `checkReady` |
| mechanics | blocking | S7 leaves the 500 ms trust timer running (same as the intent finding) | upheld | Same fix |
| mechanics | minor | S1's INT cleanup cannot work when launched in the background | upheld | INT for foreground only; TERM is the supported cancel |

### Round 6 — 2026-11-26

**Lanes:** intent: claude / claude-opus-5-5; mechanics: gpt / gpt-6.2-sol; cross-family: yes.

**Changed since Round 5:** S7 (fixture stops every timer that reaches `checkReady`, including `trustTimer`); S1 (INT only in the foreground; TERM is the supported cancel).

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Implementation Tasks
