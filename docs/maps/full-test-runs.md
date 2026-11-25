# Map: full test runs

Checked against: `a399cf8a871e8f4612c279ac37f39e6c8c616015` (origin/main)
Files covered: `test-support/pick-tests.js`, `test-support/test-map.json`, `test-support/full-run.sh`, `test-support/browser-workers.js`, `viewer/playwright.config.js`, `viewer/test/helpers/server.js`, `viewer/test/helpers/app.js`, `viewer/server.js`, `protocol/app/lead.md`, `protocol/app/sub-lead.md`, `protocol/app/verifier.md`, `protocol/app/worker.md`, `AGENTS.md`, `viewer/AGENTS.md`, `CONTRIBUTING.md`.

## Flow

The picker compares base and head, selects changed tests, direct readers and map entries, then adds shared-file and conservative fallbacks; it prints selected commands (`test-support/pick-tests.js:45-104`). For a build, the sub-lead starts a full run on the verification commit alongside verifiers, replacing it after fixes; its pass gates handoff (`protocol/app/sub-lead.md:249-256`, `protocol/app/sub-lead.md:273-283`). The runner refuses tracked changes, records HEAD, runs suites sequentially and writes exits even after a failure (`test-support/full-run.sh:26-71`).

```text
changed commits -> picker -> targeted checks
verification commit -> full run -> browser -> viewer node -> machine -> remaining suites -> summary -> handoff
```

The picker reads test source at head for viewer-node and machine tests, matching relative import strings directly against each changed path or `.js`, `.json`, and `/index.js`; it does not traverse imports or scan browser specs for them (`test-support/pick-tests.js:30-32`, `test-support/pick-tests.js:55-74`). Map globs name tests or whole suites, with additive entries unable to suppress fallback (`test-support/pick-tests.js:76-80`, `test-support/test-map.json:127-168`). Unmapped viewer source falls back to both viewer suites; unmapped non-doc source can fall back to all (`test-support/pick-tests.js:89-96`).

The runner puts browser first, then viewer-node, machine, test-support, sensitivity, codex, install and both sudo-helper commands (`test-support/full-run.sh:48-65`). `summary.txt` has `commit <sha>` and `suite <name> exit <n>` lines, no timing field; individual logs capture command output (`test-support/full-run.sh:31-42`). Playwright matches `*.spec.js` for both desktop Chromium and Firefox, without project-specific match or configured timeout; CLI `--workers` overrides its worker choice (`viewer/playwright.config.js:10-20`). A lone full run takes half the CPU count bounded 2–6; other and non-full runs take 2, using PID files to detect other full runs and an environment variable to carry the decision (`test-support/browser-workers.js:7-9`, `test-support/browser-workers.js:11-57`). The cap limits concurrent load (`viewer/AGENTS.md:57`).

A server helper binds port 0, closes the probe, then spawns the viewer using that port and separate cache/state directories (`viewer/test/helpers/server.js:15-23`, `viewer/test/helpers/server.js:66-81`). The gap between close and bind permits another process to take the port. On `EADDRINUSE`, the viewer identifies the holder, retries a missing holder briefly, and refuses an unidentifiable holder (`viewer/server.js:2287-2310`).

The lead requires a passing full run for an uncovered pushed commit, including a clean default-branch merge; a descendant is covered if the picker selects nothing since a covered commit (`protocol/app/lead.md:119-140`). The verifier runs Spec commands and picker-selected targeted checks, leaving whole suites selected only by the picker to its starter's same-commit run; workers never run the full run (`protocol/app/verifier.md:44-54`, `protocol/app/worker.md:38-40`). The root heading opts this project in and contributing guidance names the full set (`AGENTS.md:76-84`, `CONTRIBUTING.md:75-93`).

Not checked: all individual test dependencies, every browser-specific test condition, other projects' role opt-in, or the performance of a newly run suite.
