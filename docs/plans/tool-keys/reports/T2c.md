# T2c — keyed tool tests

Added bridge process tests in `machine/test/folder-tools-run.test.js`, launch and route tests in `machine/test/folder-tools-launch.test.js`, and the legacy budget test in `machine/test/project-mcp-codex.test.js`. No production fix was needed. Existing shared bridge coverage was retained and used for groups 2–4.

## Groups and mutation checks

Each mutation was applied temporarily, its named test run to a nonzero exit, and the production file restored. Line numbers identify the original source before mutation. Mutation logs are in the worker's scratch directory, not committed.

1. `project bridge overrides inherited key and reads project store on each call`, `machine/test/folder-tools-run.test.js:103`: replaced the env assignment at `machine/lib/tool-bridge.js:21` with a wrong value; failed.
2. Same test and `keyed bridge reads shared keys on every call and binds names`, `machine/test/folder-tools-run.test.js:88`: inverted the shared-store choice at `machine/lib/tool-bridge.js:18`; failed.
3. Same project and shared bridge tests: disabled missing-key refusal at `machine/lib/tool-bridge.js:20`; failed.
4. `old bridge arguments refuse newly declared keys but preserve keyless edits`, `machine/test/folder-tools-run.test.js:120`, and shared bridge test at line 88: disabled changed/binding refusal at `machine/lib/tool-bridge.js:15`; failed.
5. `bridge refuses keyed calls with Node child process debugging but runs keyless calls`, `machine/test/folder-tools-run.test.js:132`: ignored `result.refused` at `machine/lib/tool-bridge.js:23`; failed.
6. `keyed discovery omits missing keys and keeps secrets out of launch artifacts`, `machine/test/folder-tools-launch.test.js:546`: inserted the sentinel value into bridge arguments at `machine/lib/folder-tools.js:78`; failed.
7. `shared project uses shared store and missing shared tool identifies its source`, `machine/test/folder-tools-launch.test.js:559`: removed the own-project shared-store selection at `machine/lib/folder-tools.js:80`; failed.
8. `keyed discovery omits missing keys and keeps secrets out of launch artifacts` and shared project test, lines 546 and 559: disabled missing-key filtering at `machine/service.js:1011`; failed.
9. `shell-only sessions report keyed tools and include the starting clause`, `machine/test/folder-tools-launch.test.js:531`; `shell-only keyed lines survive other sessions and disappear after end`, line 586; hidden case, line 594: disabled keyed-line creation at `machine/service.js:1003`; failed.
10. Shell-only starting clause test at line 531 and `starting prompt excludes keyed clause for keyless or hidden shared scripts`, line 594: disabled clause at `machine/service.js:1118`; failed.
11. `keyed server is excluded while keyless server connects`, `machine/test/folder-tools-launch.test.js:569`, and `launcher refuses server tool declaring keys`, `machine/test/folder-tools-run.test.js:140`: removed folder problems at `machine/service.js:996`; failed. This mutation checks the problem line, not the separate launcher refusal, whose validator lies outside the authorized production edit boundary.
12. `agent routes report key status and sandbox restriction without values`, `machine/test/folder-tools-launch.test.js:575`: replaced the sandbox reason with null at `machine/service.js:2398`; failed. This mutation checks the restriction field, not each key status independently.
13. `keyless bridge retains legacy arguments and fits the same near-limit Codex budget`, `machine/test/project-mcp-codex.test.js:168`: inserted an extra bridge argument at `machine/lib/folder-tools.js:78`; failed.

## Validation

The following are the exit lines and final 80 lines of each requested gate. Initial targeted fixture runs failed because the test used an invalid empty keys array and expected a config for an empty tool set; those fixtures were corrected before these gates. No gate failed twice.

### `node --test machine/test/folder-tools.test.js machine/test/folder-tools-run.test.js machine/test/folder-tools-launch.test.js machine/test/project-keys.test.js machine/test/shared-keys.test.js`

```text
exit 0
  ...
# Subtest: key store is private, revisioned and cleans failed temporary writes
ok 64 - key store is private, revisioned and cleans failed temporary writes
  ---
  duration_ms: 26.21473
  type: 'test'
  ...
# Subtest: identity is shared by alias and git worktree
ok 65 - identity is shared by alias and git worktree
  ---
  duration_ms: 29.583959
  type: 'test'
  ...
# Subtest: command timeout kills the child
ok 66 - command timeout kills the child
  ---
  duration_ms: 102.546143
  type: 'test'
  ...
# wc-one-worker: project tools: held back HOLD: also used in a command, args or URL
# wc-two-worker: project tools: local: skipped on Codex: it uses ${...} that Codex cannot pass through
# wc-two-worker: project tools: held back HOLD: also used in a command, args or URL
# wc-four-worker: project tools: local: skipped on Antigravity: uses ${...} that Antigravity cannot pass through
# Subtest: session launcher passes only selected keys outside recorded commands
ok 67 - session launcher passes only selected keys outside recorded commands
  ---
  duration_ms: 105.979145
  type: 'test'
  ...
# Subtest: launcher safely passes shell special names and removes the file
ok 68 - launcher safely passes shell special names and removes the file
  ---
  duration_ms: 43.342646
  type: 'test'
  ...
# Subtest: launcher errors are fixed messages and remove the file
ok 69 - launcher errors are fixed messages and remove the file
  ---
  duration_ms: 67.052631
  type: 'test'
  ...
# Subtest: an invalid executable cannot leak key values in startup errors
ok 70 - an invalid executable cannot leak key values in startup errors
  ---
  duration_ms: 22.954088
  type: 'test'
  ...
# Subtest: nested and unbalanced substitutions hold back every referenced name
ok 71 - nested and unbalanced substitutions hold back every referenced name
  ---
  duration_ms: 0.980507
  type: 'test'
  ...
# Subtest: an sse tool header key is a key reference
ok 72 - an sse tool header key is a key reference
  ---
  duration_ms: 0.325152
  type: 'test'
  ...
# Subtest: folder tool value usability boundaries
ok 73 - folder tool value usability boundaries
  ---
  duration_ms: 0.237073
  type: 'test'
  ...
# Subtest: private revisioned shared store and safe errors
ok 74 - private revisioned shared store and safe errors
  ---
  duration_ms: 23.887635
  type: 'test'
  ...
1..74
# tests 74
# suites 0
# pass 74
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 16204.261284
```

### `node --test machine/test/project-mcp-codex.test.js machine/test/project-tools-service.test.js machine/test/name-guard.test.js machine/test/connectors-contract.test.js`

```text
exit 0
  ---
  duration_ms: 0.212297
  type: 'test'
  ...
# Subtest: exported Codex checks share the command rules
ok 20 - exported Codex checks share the command rules
  ---
  duration_ms: 0.533351
  type: 'test'
  ...
# Subtest: Windows stdio tools pass the bridge environment on WSL
ok 21 - Windows stdio tools pass the bridge environment on WSL
  ---
  duration_ms: 0.411016
  type: 'test'
  ...
# Subtest: folder entries respect sandbox, order, budget and validation
ok 22 - folder entries respect sandbox, order, budget and validation
  ---
  duration_ms: 1.647444
  type: 'test'
  ...
# Subtest: keyless bridge retains legacy arguments and fits the same near-limit Codex budget
ok 23 - keyless bridge retains legacy arguments and fits the same near-limit Codex budget
  ---
  duration_ms: 10.620329
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-88f301e74611.slice
# Subtest: project tools launch privately and stale Antigravity files are swept
ok 24 - project tools launch privately and stale Antigravity files are swept
  ---
  duration_ms: 179.476536
  type: 'test'
  ...
# Subtest: sweep protects the live underscore record over a stopped dot record
ok 25 - sweep protects the live underscore record over a stopped dot record
  ---
  duration_ms: 5.355111
  type: 'test'
  ...
# Subtest: sweep protects the live dot record over a stopped underscore record
ok 26 - sweep protects the live dot record over a stopped underscore record
  ---
  duration_ms: 4.991976
  type: 'test'
  ...
# Subtest: a refused start is retained only for the grace period
ok 27 - a refused start is retained only for the grace period
  ---
  duration_ms: 5.436106
  type: 'test'
  ...
# Subtest: the newest non-stopped record wins a collision
ok 28 - the newest non-stopped record wins a collision
  ---
  duration_ms: 4.587491
  type: 'test'
  ...
# Subtest: without records the exact spelling wins, or a lone rewritten name survives
ok 29 - without records the exact spelling wins, or a lone rewritten name survives
  ---
  duration_ms: 8.208082
  type: 'test'
  ...
# Subtest: non-live entries respect grace and an unknown tmux state removes nothing
ok 30 - non-live entries respect grace and an unknown tmux state removes nothing
  ---
  duration_ms: 4.949615
  type: 'test'
  ...
1..30
# tests 30
# suites 0
# pass 30
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 606.320417
```

### `node --test machine/test/key-redact.test.js machine/test/service.test.js`

```text
exit 0
  ...
# machine service listening on 127.0.0.1:36551
# Subtest: inspect accepts the thread checkout after archive and falls back to the local ref or supplied head
ok 129 - inspect accepts the thread checkout after archive and falls back to the local ref or supplied head
  ---
  duration_ms: 356.87801
  type: 'test'
  ...
# machine service listening on 127.0.0.1:39685
# Subtest: archive saves the in-progress marker before stopping and clears it on failure
ok 130 - archive saves the in-progress marker before stopping and clears it on failure
  ---
  duration_ms: 83.642038
  type: 'test'
  ...
# machine service listening on 127.0.0.1:42765
# Subtest: agents cannot set approval warnings
ok 131 - agents cannot set approval warnings
  ---
  duration_ms: 93.182813
  type: 'test'
  ...
# machine service listening on 127.0.0.1:46263
# Subtest: idle and unfinished transcript copies avoid kept reads and registry writes; failed saves retry
ok 132 - idle and unfinished transcript copies avoid kept reads and registry writes; failed saves retry
  ---
  duration_ms: 78.805049
  type: 'test'
  ...
# machine service listening on 127.0.0.1:40821
# Subtest: copier cuts a crash fragment before replaying a complete source row
ok 133 - copier cuts a crash fragment before replaying a complete source row
  ---
  duration_ms: 69.794419
  type: 'test'
  ...
# machine service listening on 127.0.0.1:37363
# Subtest: busy transcript copies reuse in-memory hashes and drop them when idle or stopped
ok 134 - busy transcript copies reuse in-memory hashes and drop them when idle or stopped
  ---
  duration_ms: 77.788032
  type: 'test'
  ...
# machine service listening on 127.0.0.1:34149
# Subtest: idle hash timer sweeps without a copy and is cleared on close
ok 135 - idle hash timer sweeps without a copy and is cleared on close
  ---
  duration_ms: 39.644273
  type: 'test'
  ...
# machine service listening on 127.0.0.1:44629
# Subtest: transcript stamps avoid all content reads on a match and detect replacement
ok 136 - transcript stamps avoid all content reads on a match and detect replacement
  ---
  duration_ms: 74.60071
  type: 'test'
  ...
# machine service listening on 127.0.0.1:42853
# Subtest: Kimi usage route protects credentials and reports usage failures
ok 137 - Kimi usage route protects credentials and reports usage failures
  ---
  duration_ms: 52.559937
  type: 'test'
  ...
# machine service listening on 127.0.0.1:43431
# Subtest: spooled receipt id becomes the drained hub card id
ok 138 - spooled receipt id becomes the drained hub card id
  ---
  duration_ms: 75.094986
  type: 'test'
  ...
1..138
# tests 138
# suites 0
# pass 138
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 38150.813054
```

## Choices

- `machine/test/folder-tools-launch.test.js`: used a fake ended session status to exercise removal on the next start, matching the service cleanup boundary.
- Mutation group 11: mutated the service problem propagation inside the ownership boundary; the launcher validator was not mutated.
