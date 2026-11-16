---
slug: test-temp-cleanup
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# Tests clean up their temp folders

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

(none)

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Scope is the JavaScript suites (machine `*.test.js`, viewer `*.test.js` and `*.spec.js`, their helpers) plus small hardening of the shell suites and `machine/test/aside-probe.sh` | MAP: shell suites already remove their root on EXIT; the leaks are in the Node suites (`docs/maps/test-temp-dirs.md`) | defaulted |
| 2 | One shared mechanism, not per-test `rm` calls scattered over ~150 allocation sites: every allocation goes through a helper that places it under a per-process run folder, removed once when the process ends | One removal point covers success, failure and thrown errors; fewer edits; new tests get it for free | defaulted |
| 3 | The run folder is removed on normal exit and on SIGINT/SIGTERM/SIGHUP (handler removes synchronously, then re-raises the signal so exit codes stay right) | IDEA "Ctrl-C removes its folders" | defaulted |
| 4 | Start-of-run sweep removes run folders whose owning process is gone (owner PID and start time recorded in the folder), never by age alone | IDEA constraint: never delete another live run's folder; covers force-killed runs | defaulted |
| 5 | The sweep also removes legacy leftovers matching the old prefixes (`wheelchair-machine-test-*`, `wc-doc-*`, `wc-git-*`, …) only when older than one hour | Clears what earlier code leaked; the one-hour age matches the existing viewer sweep and the cleanup Collin already approved | defaulted |
| 6 | Every helper that stops a spawned process (viewer `startServer().stop`, `pages.spec.js` starter, machine `service().close`, aside stores) awaits the child's actual exit, including after KILL, before the run folder can be removed | IDEA constraint: remove only once writers stopped (MAP: `viewer/test/helpers/server.js:100`) | defaulted |
| 7 | Shell suites add INT/TERM/HUP to their existing cleanup trap; `aside-probe.sh` removes its folder in its EXIT trap | Small hardening; EXIT alone is not guaranteed on signals (MAP) | defaulted |
| 8 | Test temp folders live in system temp (`os.tmpdir()`, so `TMPDIR` is honoured), one run folder per test process, removed at exit; this includes the viewer helper's `makeDir`, which moves out of `viewer/test/.tmp` | Keeps tests' behaviour identical (no folder inside a git checkout); removal at exit plus the sweep stop pile-up | user |
| 9 | The shared helper lives at a new root file `test-support/run-dir.js` (CommonJS, Node built-ins only) used by both machine and viewer suites, with its own suite `test-support/test/run-dir.test.js` | Machine must not depend on viewer code or vice versa; one mechanism, one test | defaulted |
| 10 | Owner liveness = PID alive (`process.kill(pid, 0)`, EPERM counts as alive) **and**, on Linux, `/proc/<pid>/stat` start time equal to the recorded one; where start time cannot be read, a live PID counts as alive | Guards against PID reuse without ever risking a live run's folder | defaulted |

## Spec

### What changes, in one paragraph

Every temp folder a JavaScript test creates is made by one shared helper, inside one
**run folder** that belongs to the current Node process. The run folder is removed when the
process ends: normally, after a failure, or on Ctrl-C. Each new process first sweeps run
folders left by processes that no longer exist, and old-style leftovers from before this
change. Helpers that start child processes wait for them to exit, and anything still
running at exit is killed before removal. The shell suites keep their own `mktemp -d` +
trap, hardened for signals.

### 1. The helper: `test-support/run-dir.js`

New file, CommonJS, Node built-ins only (`node:fs`, `node:os`, `node:path`), works on
Node 20 and 26. Exports:

- `runDir()` → string. Lazily (first call per process) creates
  `<os.tmpdir()>/wheelchair-test-run-<pid>-XXXXXX` with `fs.mkdtempSync`, writes
  `owner.json` (`{ "pid": <process.pid>, "start": <start time or null> }`) inside it,
  runs the sweep (§3) once, and installs the exit/signal handlers (§2). Later calls
  return the same path. Synchronous, so it can be used from any setup code.
- `makeTemp(prefix = 'tmp-')` → `Promise<string>`: `fs.promises.mkdtemp(path.join(runDir(), prefix))`.
  `makeTempSync(prefix)` is the synchronous twin. Prefixes stay as today's (e.g.
  `wheelchair-machine-test-`, `wc-doc-`), so a leftover is still recognisable.
- `trackChild(child)`: records a `ChildProcess`; it drops itself from the set on `exit`.
  Used by every test helper that spawns a long-lived child (servers, fake machines,
  aside stores' CLIs where the test owns the spawn).
- `cleanupNow()`: the same removal the exit handler does; exported for the helper's own
  tests.

`start` is field 22 of `/proc/<pid>/stat` (parse after the last `)`); `null` where
`/proc` is absent.

### 2. Removal at exit

- `process.on('exit')`: SIGKILL every tracked child still running, then
  `fs.rmSync(runDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })`.
  Errors are swallowed (a leftover is caught by the next sweep); nothing is printed on
  success.
- `SIGINT`, `SIGTERM`, `SIGHUP`: a handler runs the same cleanup synchronously, removes
  its own listeners, and re-raises the signal with `process.kill(process.pid, signal)`,
  so the process still dies of that signal (exit status unchanged for the runner).
- Handlers are installed only when `runDir()` is first called, so a test file that makes
  no temp folder is unaffected.
- `node --test` runs each test file in its own child process, and each Playwright worker
  is its own process; each gets its own run folder. Ctrl-C at a terminal signals the whole
  process group, so each child cleans its own. SIGKILL (Playwright force-stopping a worker,
  `kill -9`, OOM) skips all of this: §3 handles it.

### 3. The start-of-run sweep

Runs once per process, inside the first `runDir()` call, before creating the new folder.
Every step ignores errors per entry (another process may be sweeping too).

1. For each entry in `os.tmpdir()` named `wheelchair-test-run-*`: read `owner.json`. If it
   is missing or unreadable and the folder's mtime is older than one hour, remove it. If
   it parses and the owner is not alive (Decision 10), remove it. Otherwise leave it.
2. Legacy leftovers in `os.tmpdir()` whose name starts with one of the prefixes below and
   whose mtime is older than one hour are removed:
   `wheelchair-machine-test-`, `wc-accounts-`, `wc-statusline-`, `wc-seed-`, `aside-test-`,
   `aside-recover-`, `aside-groups-`, `aside-http-`, `aside-tombstone-`, `wc-doc-`,
   `wc-archived-`, `wc-gh-`, `wc-git-`, `wheelchair-viewer-version-`,
   `wheelchair-viewer-state-`, `wc-graph-`, `usage-test-`, `hub-version-`, `wc-asides-`,
   `app-slug-`. (Source: `docs/maps/test-temp-dirs.md`; implementers add any further
   system-temp prefix they find when converting a call site.)
3. Entries of `viewer/test/.tmp/` older than one hour are removed (the existing
   `pruneStaleScratch` rule, moved here; the folder itself stays gitignored).

### 4. Converting the call sites

Every system-temp or `viewer/test/.tmp` allocation in the JavaScript suites goes through
`makeTemp`/`makeTempSync`. The full list is in `docs/maps/test-temp-dirs.md`; the
groups:

- **machine:** `service.test.js` `temp()` (line 16); `accounts.test.js`;
  `aside-turns.test.js`.
- **viewer helpers:** `helpers/server.js` `makeDir()` becomes a thin wrapper over
  `makeTemp` (same signature, default prefix `server-`); `pruneStaleScratch` and
  `TMP_ROOT` go (moved into §3). `helpers/app.js`, `helpers/app-views-setup.js` and
  every other `makeDir` user need no change beyond that.
- **viewer direct `os.tmpdir()` users:** `app-doc.spec.js`, `app-threads.spec.js`,
  `app-hub.test.js`, `app-chat.test.js`, `app-usage.test.js`, `app-machines.test.js`,
  `app-asides.test.js`, `app-slug.test.js`, `app-settings.spec.js`, and
  `app-state-queue.test.js` (its child script gets a `makeTempSync` path in place of
  `os.tmpdir()`, passed in as a string).
- Existing per-test `rm` calls (e.g. `app-slug.test.js` finally blocks) may stay; they
  are harmless.
- Hard-coded `/tmp/...` strings that are fake paths in assertions (`helpers/app-machine.js:184`,
  `helpers/app.js:57`, `app-threads.spec.js:158`) are not allocations; leave them.

After conversion, `grep -rnE "os\.tmpdir\(\)|mkdtemp" machine/test viewer/test` matches
only `test-support/run-dir.js`-backed helpers (no raw `os.tmpdir()` allocation remains in
a test file).

### 5. Children stop before their folder goes

- `viewer/test/helpers/server.js` `startServer`: `trackChild(child)` right after spawn;
  if startup fails (`waitForLine` rejects or the token read fails) the child is killed and
  awaited before the error is rethrown. `stop()` awaits the child's `exit` event in every
  path, including after SIGKILL (no resolving on the timer alone).
- The second server starter in `pages.spec.js` (around line 82) gets the same treatment,
  or is replaced by the shared helper if its behaviour is identical.
- `machine/test/service.test.js` `service().close()` already closes the HTTP server;
  child processes spawned by the service under test (fake tmux/CLI scripts) are short-lived
  and synchronous; hook-post/statusline children (lines ~405, ~813) are awaited where the
  test spawns them. No product code changes.
- `aside-turns.test.js` keeps its `finally` process-group kills.

### 6. Shell suites

- `install/test/run.sh`, `codex/test/run.sh`, `sensitivity/test/run.sh`,
  `seen/test/hook_test.sh`, `seen/test/wording_test.sh`, `seen/test/set_test.sh`: the
  existing `trap '<rm>' EXIT` stays, and `trap 'exit 130' INT; trap 'exit 143' TERM; trap 'exit 129' HUP`
  is added so a signal ends the script through its EXIT trap.
- `machine/test/aside-probe.sh`: its EXIT trap also removes its `mktemp -d` folder, after
  killing the tmux session; same INT/TERM/HUP lines.

### 7. Docs

- `AGENTS.md` (root): add `test-support/` to the Executable row and the Files/Where-to-go
  tables (one line: "shared run folder for the JavaScript test suites"); add
  `node --test test-support/test/*.test.js` to Verification.
- `viewer/AGENTS.md` and `machine/AGENTS.md`: one line each that test temp folders come
  from `test-support/run-dir.js`.
- `.gitignore` keeps `viewer/test/.tmp/` (older checkouts' leftovers).

### Non-goals

Temp files created by code under test or by external tools outside a test's folder;
product code changes; any cleanup run by an agent rather than the suites.

### Validation

1. Helper suite: `node --test test-support/test/*.test.js` covers, using a private
   `TMPDIR` per case (spawned child processes):
   - normal exit removes the run folder;
   - a failing test (`process.exitCode = 1` / thrown error) removes it;
   - SIGINT and SIGTERM to a child that is mid-test remove it and the child still dies of
     that signal;
   - a tracked child still running at exit is killed and the folder removed;
   - sweep removes a folder whose `owner.json` names a dead PID, keeps one owned by a live
     process (the test's own sibling), keeps a legacy-prefixed folder younger than one
     hour, removes one older (mtime set with `fs.utimesSync`).
2. Leak check, every JavaScript suite, run with a fresh `TMPDIR`:
   ```bash
   export TMPDIR=$(mktemp -d)   # outside the suites; inspect, do not delete others' files
   bash machine/test/run.sh
   node --test viewer/test/*.test.js
   npm --prefix viewer run test:browser
   find "$TMPDIR" -mindepth 1 -maxdepth 1 | wc -l   # expect 0
   ```
   (Playwright browsers may create their own profile folders in `TMPDIR`; those are
   external-tool files and outside scope. The check counts only `wheelchair-test-run-*`
   and the legacy prefixes.)
3. Interrupt check: start `bash machine/test/run.sh` with a fresh `TMPDIR`, send SIGINT
   to its process group after ~5 s, then confirm no `wheelchair-test-run-*` remains.
4. Kill check: start a suite, `kill -9` one test-file process, confirm its run folder
   remains, then run any suite again and confirm it is gone.
5. All existing suites pass as before: the commands in `AGENTS.md` Verification,
   except `./install.sh` (canonical clone only).
6. `viewer/test/.tmp/` gets no new entries from a full run.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-15

**Lanes:** pending.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|
| Viewer `.tmp` age-based sweep | pre-existing | `viewer/test/helpers/server.js:26-44` | high |
| Shell suites' EXIT trap | pre-existing | `install/test/run.sh:8`, `codex/test/run.sh:8`, `sensitivity/test/run.sh:7`, `seen/test/*_test.sh` | high |

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
