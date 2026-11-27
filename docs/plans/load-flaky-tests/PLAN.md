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

- Picks the N highest-numbered CPUs (default 2), pins itself and everything it starts to
  them with `taskset -c`, and starts H busy-loop helpers there (default 2 per CPU). Only
  those CPUs are loaded, so other threads on the machine are unaffected. The default
  roughly matches the reported load (about 3 to 4 busy processes per core). Usage errors
  include N larger than the machine's CPU count.
- Runs the command K times in a row (default 5), each with stdin from `/dev/null`, its
  output passed through, then prints `under-load: pass <p> of <K>` and exits 0 only if all
  K passed, else 1. Usage errors exit 2.
- Kills every helper on normal exit and on TERM, HUP and INT; a signal also stops the
  running command and exits non-zero.
- Without `taskset` it prints `under-load: taskset not found` and exits 2.
- Tested by `test-support/test/under-load.test.js`: the count line and exit code for a
  passing and a failing command, the command running pinned to the chosen CPUs, and no helper
  alive after a normal exit and after TERM.
- Not run by the full run beyond its own test.

Check: `node --test test-support/test/under-load.test.js`

### S2. Stopping a full run (`test-support/full-run.sh:34-45`, `test-support/test/full-run.test.js:50`)

Cause: the browser job's leader is a subshell. On TERM, `wait` returns when the subshell
dies, before its child has handled TERM, so the runner can exit while browser tests still
run; the test then finds no `viewer-browser stopped`. The fixture stub also writes `start`
before installing its trap, so a signal can land before the trap exists.

- `stop_run`, after sending TERM to each recorded group, polls every 0.1 s until no process
  is left in that group (`kill -0 -- -<pgid>` fails), for up to 10 s; it then sends KILL to
  any group still present, and exits 1 without writing `summary.txt`, as today.
- The fixture stub installs its trap before it writes `start`.
- Both `stopped` assertions and the no-summary assertion stay.

Check: `node --test test-support/test/full-run.test.js`, and it passes under load with
`--repeat 10`.

### S3. Pre-prefix holder (`viewer/test/lifecycle.test.js:57-77,255`)

Cause (likely): the test probes a free port, releases it, then the holder binds it; another
process can take it in the gap, and the holder exits 1 on EADDRINUSE.

- The holder listens on port 0 and prints `ready <port>`; `prePrefixHolder` reads the port
  from that line and returns it, and the tests use that port.
- If the holder exits before `ready`, the error includes its exit code and stderr.
- Other fixtures stay as they are (Decision 7).

Check: `node --test viewer/test/lifecycle.test.js`, and it passes under load.

### S4. Quiet-agent tests (`viewer/test/app-quiet.test.js`)

Cause: the file uses a 50 ms grace between a turn ending and the nudge. In test 6 the
worker's message must land inside it; under load it lands later and the nudge fires.

- Each test in the file whose check is "no nudge" or "no submit" after a step runs with
  `WHEELCHAIR_QUIET_GRACE_MS` of at least 2000, and waits past it with at least 500 ms
  margin before checking. The current list: 6, 6c, 6d, and the first part of 7; the
  worker checks the rest of the file by the same rule.
- Tests that wait for a nudge keep their short grace and wait with `until`.

Check: `node --test viewer/test/app-quiet.test.js`, and it passes under load.

### S5. Verifier report retry (`viewer/test/app-hub.test.js:1327`)

The 1 s deadline for the retried submit becomes 10 s. Assertions unchanged.

Check: `node --test --test-name-pattern "verifier report survives" viewer/test/app-hub.test.js`,
and it passes under load.

### S6. Archive cancels a stalled upload (`viewer/test/app-uploads-archive.test.js:65`)

The test checks that archive ends the stalled upload instead of waiting for the machine's
default timeout, with under 5 s of margin between them.

- Reproduce under load and note which wait or budget fails.
- Widen the gap inside the test first: measure the stall and archive steps against the
  default machine timeout the code already uses, instead of the fixed `delay(5200)` and
  `< 5000` budget (`viewer/test/app-uploads-archive.test.js:96-99`), so a slow machine
  passes and an archive that waits for that timeout still fails. Only if that cannot keep
  a clear gap, make the timeout longer for this test through a setting the code already
  reads, or, failing that, a new one, named in the report.
- Waits that only cover setup (the `.part` file appearing, the upload outcome) poll to at
  least a 15 s deadline; the test's own timeout grows to fit.

Check: `node --test --test-name-pattern "stalled upload" viewer/test/app-uploads-archive.test.js`,
and it passes under load.

### S7. Account switch (`machine/test/switch-http.test.js:107,136`)

`waitFor` polls every 10 ms to a 20 s time deadline instead of 300 iterations.

Check: `node --test machine/test/switch-http.test.js`, and it passes under load.

### S8. Browser specs

`viewer/test/app-threads.spec.js:573` ("approval: Start building enabled when Ready and
presses; offer press", Firefox) and `viewer/test/app-agents-decks.spec.js:247`
("popover invariant across a refresh", "page scrolled", Chromium).

- Reproduce each under load with a Playwright trace (`--trace on`), find the cause, and fix
  it under the general rules. Name the cause in the task report.
- A larger time budget (`test.slow()` or a longer wait timeout) is allowed only where the
  trace shows plain slowness; a missed event or wrong order is fixed, not waited out.
- If either does not fail in 20 tries under load, apply the general rules found in the
  spec (waiters registered before actions, deadlines long enough for a slow page), and say
  in the report that it did not reproduce.

Checks, each passing under load (`--repeat 5`):
`npm --prefix viewer exec -- playwright test test/app-threads.spec.js -g "offer press" --project firefox --workers 1`
`npm --prefix viewer exec -- playwright test test/app-agents-decks.spec.js -g "page scrolled" --project chromium --workers 1`

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
- On a mismatch the failure lists the changed paths (relative to `~/.wheelchair`), not only
  two hashes.
- A self-check in the suite, on a temporary copy of the tree: changing a checked file
  changes the result; changing an unchecked account file does not; creating or deleting a
  shared file does.
- The other five real-file checks at `install/test/run.sh:700-704` stay as they are.

Check: `bash install/test/run.sh` passes on this machine while wheelchair sessions are
running, three times in a row.

### S10. Full-run pass rule

Unchanged: no re-runs. Any suite exit other than 0 fails the run (Decision 5).

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

## Implementation Tasks
