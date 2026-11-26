# Map: full test runs

Checked against: `6802372cdc5c1af28742818c90732cd3a83d4f3c` (origin/main)
Files covered: `test-support/pick-tests.js`, `test-support/test-map.json`, `test-support/full-run.sh`, `test-support/browser-workers.js`, `viewer/playwright.config.js`, `viewer/test/helpers/server.js`, `viewer/test/helpers/app.js`, `viewer/server.js`, `protocol/app/lead.md`, `protocol/app/sub-lead.md`, `protocol/app/verifier.md`, `protocol/app/worker.md`, `AGENTS.md`, `viewer/AGENTS.md`, `CONTRIBUTING.md`.

## Flow

The picker compares base and head, selects changed tests, direct readers and map entries, then adds shared-file and conservative fallbacks (`test-support/pick-tests.js:45-104`). The starter runs the full suite on the verification commit beside verifiers, replacing it after fixes; its pass gates handoff (`protocol/app/sub-lead.md:251-258,275-283`). The runner refuses tracked changes, records HEAD, and starts browser tests alongside the other suites, which run one after another; it waits for browser and writes all exits and seconds (`test-support/full-run.sh:26-33,47-73,84-107`).

```text
changed commits -> picker -> targeted checks
verification commit -> browser suite -----------------> summary -> handoff
                    -> viewer node -> machine -> others -> summary
```

The picker reads head's viewer-node and machine test source for direct relative imports; browser specs are excluded. Map globs add file or suite targets; additive entries do not suppress fallback. Front-end paths require a non-additive map entry to avoid viewer fallback even if a Node test imports them (`test-support/pick-tests.js:30-33,55-96`; `test-support/test-map.json:127-168`).

Browser runs concurrently with viewer-node, machine, test-support, sensitivity, codex, install and the combined sudo-helper commands, the latter suites in that order. Summary lines are fixed-order `suite <name> exit <n> seconds <s>`; TERM/HUP stop the runner's browser and current suite process groups (`test-support/full-run.sh:34-45,47-58,75-107`). Playwright runs every spec on Chromium and the listed specs on Firefox (`viewer/playwright.config.js:3-18`). A full run takes `max(2, floor(min(8, floor(cpus/2)) / (others+1)))` browser workers based on live runs at startup; non-full runs take two (`test-support/browser-workers.js:7-12,15-34,48-60`).

The server helper chooses an isolated port and cache/state directories, spawns the server and retries up to five times on a port clash unless the caller supplied the port (`viewer/test/helpers/server.js:15-23,69-96`). The lead requires a passing full run for an uncovered pushed commit; a descendant is covered if the picker selects nothing since a covered commit (`protocol/app/lead.md:121-135`). The verifier runs Spec commands and picker-selected targeted checks, leaving whole suites selected only by the picker to its starter's same-commit run; workers do not run the full run (`protocol/app/verifier.md:44-54`; `protocol/app/worker.md:38-42`). The root heading opts in and contributing guidance names the full set (`AGENTS.md:78-88`; `CONTRIBUTING.md:73-94`).

Not checked: every individual test dependency, browser-specific test condition, other projects' opt-in, or a fresh performance run.
