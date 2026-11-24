# Map: test temporary directories

Checked against: `7b93c1ae6a0425c72abe043bedba4a3aea7aa62d` (origin/main)
Files covered: `test-support/run-dir.js`, `test-support/test/run-dir.test.js`, `test-support/smoke/harness.js`, `viewer/test/helpers/server.js`, `viewer/playwright.config.js`, `viewer/package.json`.

## Flow

A test's first allocation sweeps eligible stale runs, makes a per-process temp run directory and records its owner; later allocations create subdirectories (`test-support/run-dir.js:101`, `test-support/run-dir.js:119`). Spawned children registered with `trackChild` are recorded with PID and Linux process start identity; cleanup callbacks and registered children run on exit or handled signals (`test-support/run-dir.js:88`, `test-support/run-dir.js:93`, `test-support/run-dir.js:121`). The viewer helper starts a server with a free port and cache root, tracks it and also offers explicit stop (`viewer/test/helpers/server.js:66`).

```text
test allocation -> sweep old runs -> owned run directory -> tracked children
                                                     -> exit cleanup -> remove directory
```

A later sweep checks the owner's identity and, when the owner is gone, checks tracked child identities before killing them and removing the directory; missing or ambiguous identity can prevent cleanup. Legacy temp folders are removed by age, without process discovery (`test-support/run-dir.js:48`, `test-support/run-dir.js:67`). Smoke has an additional callback that kills its tmux server (`test-support/smoke/harness.js:194-196`). Untracked processes are not covered by the child registry (`test-support/run-dir.js:121`).

Playwright selects Chromium and Firefox and caps each run at two workers, overridable on the command line; node tests have no concurrency flag (`viewer/playwright.config.js:9-19`, `viewer/package.json:6-8`). These directories track cleanup, not an exclusive test-run lock (`test-support/run-dir.js:48-65,101-127`). Cleanup tests exercise tracked child and sweep behavior (`test-support/test/run-dir.test.js:1`).

Not checked: every test's process ownership, live leaked processes, or runner defaults outside this repository.
