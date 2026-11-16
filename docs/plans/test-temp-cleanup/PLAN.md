---
slug: test-temp-cleanup
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
---

# Tests clean up their temp folders

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

### Q1: Where do test temp folders live?
- **Context:** Today machine tests and some viewer tests write to `/tmp` (a RAM-backed
  tmpfs shared by every thread on the machine); the viewer helper writes to
  `viewer/test/.tmp` inside the checkout. A folder inside the checkout has a catch: a test
  folder that is not itself a git repository sits inside the worktree's repository, so a
  `git` command run there finds the worktree's repo instead of failing. Tests that expect
  "not a git repository" or build their own repos could change behaviour.
- **Options:**
  - **System temp (`/tmp`, honouring `TMPDIR`), one folder per run.** Each test process
    makes one run folder; every temp folder that process needs goes inside it; the run
    folder is removed at exit. A leak can still reach `/tmp`, but there is one folder per
    run instead of hundreds, and the start-of-run sweep catches it.
  - **Inside the checkout (like `viewer/test/.tmp`).** A leak can never fill `/tmp`, and
    deleting a worktree deletes its leftovers. Costs: the git-lookup catch above, the disk
    instead of RAM, and auditing every test that runs `git`.
- **Recommendation:** system temp, one run folder per process. It keeps tests' behaviour
  identical, and the cleanup plus the sweep remove the reason to leave `/tmp`.

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

## Spec

(Written as decisions land.)

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|
| Viewer `.tmp` age-based sweep | pre-existing | `viewer/test/helpers/server.js:26-44` | high |
| Shell suites' EXIT trap | pre-existing | `install/test/run.sh:8`, `codex/test/run.sh:8`, `sensitivity/test/run.sh:7`, `seen/test/*_test.sh` | high |

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
