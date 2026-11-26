# T2a report — incomplete

Implemented bridge argument generation and key binding in `machine/lib/folder-tools.js:78` and per-call reads and execution in `machine/lib/tool-bridge.js:7`. Added discovery, session state, starting instructions and agent routes in `machine/service.js:764`, `machine/service.js:960`, and `machine/service.js:2398`. Added connector reasons and contract documentation in `connectors/codex/machine.js:125`, `connectors/kimi/machine.js:250`, `connectors/pi/machine.js:20`, `connectors/contract.js` and `connectors/README.md`. Added focused coverage in `machine/test/folder-tools.test.js`, `machine/test/folder-tools-run.test.js` and `machine/test/folder-tools-launch.test.js`.

The required scenario matrix is incomplete: dedicated tests for project-store and own-shared routing, agent key status, NODE_DEBUG, hidden shared tools, multi-session persistence, server-key rejection, and Codex budget binding remain. The changes need review and those tests before this task can be considered done. The new focused tests were checked by breaking their respective behaviors and observing failures before restoration. Initial gate 1 failed on old expectations and a fixture without tool metadata; these were updated, and the subsequent gate passed.

## Validation

`node --test machine/test/folder-tools.test.js machine/test/folder-tools-run.test.js machine/test/folder-tools-launch.test.js machine/test/project-keys.test.js machine/test/shared-keys.test.js`

```text
exit 0
  ...
# Subtest: key store is private, revisioned and cleans failed temporary writes
ok 54 - key store is private, revisioned and cleans failed temporary writes
  ---
  duration_ms: 38.692158
  type: 'test'
  ...
# Subtest: identity is shared by alias and git worktree
ok 55 - identity is shared by alias and git worktree
  ---
  duration_ms: 37.528763
  type: 'test'
  ...
# Subtest: command timeout kills the child
ok 56 - command timeout kills the child
  ---
  duration_ms: 103.805507
  type: 'test'
  ...
# wc-one-worker: project tools: held back HOLD: also used in a command, args or URL
# wc-two-worker: project tools: local: skipped on Codex: it uses ${...} that Codex cannot pass through
# wc-two-worker: project tools: held back HOLD: also used in a command, args or URL
# wc-four-worker: project tools: local: skipped on Antigravity: uses ${...} that Antigravity cannot pass through
# Subtest: session launcher passes only selected keys outside recorded commands
ok 57 - session launcher passes only selected keys outside recorded commands
  ---
  duration_ms: 133.994614
  type: 'test'
  ...
# Subtest: launcher safely passes shell special names and removes the file
ok 58 - launcher safely passes shell special names and removes the file
  ---
  duration_ms: 51.514702
  type: 'test'
  ...
# Subtest: launcher errors are fixed messages and remove the file
ok 59 - launcher errors are fixed messages and remove the file
  ---
  duration_ms: 76.524132
  type: 'test'
  ...
# Subtest: an invalid executable cannot leak key values in startup errors
ok 60 - an invalid executable cannot leak key values in startup errors
  ---
  duration_ms: 26.444254
  type: 'test'
  ...
# Subtest: nested and unbalanced substitutions hold back every referenced name
ok 61 - nested and unbalanced substitutions hold back every referenced name
  ---
  duration_ms: 0.639903
  type: 'test'
  ...
# Subtest: an sse tool header key is a key reference
ok 62 - an sse tool header key is a key reference
  ---
  duration_ms: 0.346132
  type: 'test'
  ...
# Subtest: folder tool value usability boundaries
ok 63 - folder tool value usability boundaries
  ---
  duration_ms: 0.254667
  type: 'test'
  ...
# Subtest: private revisioned shared store and safe errors
ok 64 - private revisioned shared store and safe errors
  ---
  duration_ms: 41.813348
  type: 'test'
  ...
1..64
# tests 64
# suites 0
# pass 64
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 15971.698247
```

`node --test machine/test/project-mcp-codex.test.js machine/test/project-tools-service.test.js machine/test/name-guard.test.js machine/test/connectors-contract.test.js`

```text
exit 0
  ---
  duration_ms: 0.422858
  type: 'test'
  ...
# Subtest: skips a reader-marked duplicate header without overrides
ok 19 - skips a reader-marked duplicate header without overrides
  ---
  duration_ms: 0.308169
  type: 'test'
  ...
# Subtest: exported Codex checks share the command rules
ok 20 - exported Codex checks share the command rules
  ---
  duration_ms: 0.962872
  type: 'test'
  ...
# Subtest: Windows stdio tools pass the bridge environment on WSL
ok 21 - Windows stdio tools pass the bridge environment on WSL
  ---
  duration_ms: 0.715318
  type: 'test'
  ...
# Subtest: folder entries respect sandbox, order, budget and validation
ok 22 - folder entries respect sandbox, order, budget and validation
  ---
  duration_ms: 3.198968
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-408c6fcfe5e6.slice
# Subtest: project tools launch privately and stale Antigravity files are swept
ok 23 - project tools launch privately and stale Antigravity files are swept
  ---
  duration_ms: 205.529284
  type: 'test'
  ...
# Subtest: sweep protects the live underscore record over a stopped dot record
ok 24 - sweep protects the live underscore record over a stopped dot record
  ---
  duration_ms: 9.669001
  type: 'test'
  ...
# Subtest: sweep protects the live dot record over a stopped underscore record
ok 25 - sweep protects the live dot record over a stopped underscore record
  ---
  duration_ms: 5.503315
  type: 'test'
  ...
# Subtest: a refused start is retained only for the grace period
ok 26 - a refused start is retained only for the grace period
  ---
  duration_ms: 5.473238
  type: 'test'
  ...
# Subtest: the newest non-stopped record wins a collision
ok 27 - the newest non-stopped record wins a collision
  ---
  duration_ms: 5.127206
  type: 'test'
  ...
# Subtest: without records the exact spelling wins, or a lone rewritten name survives
ok 28 - without records the exact spelling wins, or a lone rewritten name survives
  ---
  duration_ms: 9.612163
  type: 'test'
  ...
# Subtest: non-live entries respect grace and an unknown tmux state removes nothing
ok 29 - non-live entries respect grace and an unknown tmux state removes nothing
  ---
  duration_ms: 5.936614
  type: 'test'
  ...
1..29
# tests 29
# suites 0
# pass 29
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 724.436653
```

`node --test machine/test/key-redact.test.js machine/test/service.test.js`

```text
exit 0
  ...
# machine service listening on 127.0.0.1:39463
# Subtest: inspect accepts the thread checkout after archive and falls back to the local ref or supplied head
ok 129 - inspect accepts the thread checkout after archive and falls back to the local ref or supplied head
  ---
  duration_ms: 358.389343
  type: 'test'
  ...
# machine service listening on 127.0.0.1:33357
# Subtest: archive saves the in-progress marker before stopping and clears it on failure
ok 130 - archive saves the in-progress marker before stopping and clears it on failure
  ---
  duration_ms: 81.251763
  type: 'test'
  ...
# machine service listening on 127.0.0.1:33665
# Subtest: agents cannot set approval warnings
ok 131 - agents cannot set approval warnings
  ---
  duration_ms: 92.874544
  type: 'test'
  ...
# machine service listening on 127.0.0.1:46361
# Subtest: idle and unfinished transcript copies avoid kept reads and registry writes; failed saves retry
ok 132 - idle and unfinished transcript copies avoid kept reads and registry writes; failed saves retry
  ---
  duration_ms: 75.37314
  type: 'test'
  ...
# machine service listening on 127.0.0.1:36973
# Subtest: copier cuts a crash fragment before replaying a complete source row
ok 133 - copier cuts a crash fragment before replaying a complete source row
  ---
  duration_ms: 70.377433
  type: 'test'
  ...
# machine service listening on 127.0.0.1:36007
# Subtest: busy transcript copies reuse in-memory hashes and drop them when idle or stopped
ok 134 - busy transcript copies reuse in-memory hashes and drop them when idle or stopped
  ---
  duration_ms: 80.456572
  type: 'test'
  ...
# machine service listening on 127.0.0.1:39651
# Subtest: idle hash timer sweeps without a copy and is cleared on close
ok 135 - idle hash timer sweeps without a copy and is cleared on close
  ---
  duration_ms: 42.97021
  type: 'test'
  ...
# machine service listening on 127.0.0.1:34623
# Subtest: transcript stamps avoid all content reads on a match and detect replacement
ok 136 - transcript stamps avoid all content reads on a match and detect replacement
  ---
  duration_ms: 73.771956
  type: 'test'
  ...
# machine service listening on 127.0.0.1:33551
# Subtest: Kimi usage route protects credentials and reports usage failures
ok 137 - Kimi usage route protects credentials and reports usage failures
  ---
  duration_ms: 53.951113
  type: 'test'
  ...
# machine service listening on 127.0.0.1:37111
# Subtest: spooled receipt id becomes the drained hub card id
ok 138 - spooled receipt id becomes the drained hub card id
  ---
  duration_ms: 73.864484
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
# duration_ms 38290.912257
```

## Choices

none
