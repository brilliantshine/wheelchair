# T2b report

- `machine/lib/project-tools.js`: validate exactly one configured origin URL and at most one push URL, preserving Git rewriting when used; extract the last HTTPS line from PR creation output.
- `machine/test/project-tools.test.js`: cover configured URLs, PR output, default-branch changes, serialized HTTP saves, and shared keys across aliases and worktrees. The existing non-GitHub origin test covers that requested case.
- The service lock passed the route test and needed no change.

The Spec names `git remote get-url`, while this task explicitly settles using configured URL text via `git config --get-all` to honor the accepted `insteadOf` risk. API.md has no conflicting route contract for this detail.

## Validation

Command: `bash machine/test/run.sh > /tmp/wc-t2b-validation.log 2>&1; echo "exit $?"; tail -n 80 /tmp/wc-t2b-validation.log`

```text
exit 0
# machine service listening on 127.0.0.1:35445
# Subtest: inspect accepts the thread checkout after archive and falls back to the local ref or supplied head
ok 191 - inspect accepts the thread checkout after archive and falls back to the local ref or supplied head
  ---
  duration_ms: 499.441389
  type: 'test'
  ...
# machine service listening on 127.0.0.1:46503
# Subtest: archive saves the in-progress marker before stopping and clears it on failure
ok 192 - archive saves the in-progress marker before stopping and clears it on failure
  ---
  duration_ms: 59.743064
  type: 'test'
  ...
# machine service listening on 127.0.0.1:35773
# Subtest: approval warnings are machine owned and never await a refresh
ok 193 - approval warnings are machine owned and never await a refresh
  ---
  duration_ms: 95.984587
  type: 'test'
  ...
# Subtest: medians, thresholds, outliers, both roles and ignored entries
ok 194 - medians, thresholds, outliers, both roles and ignored entries
  ---
  duration_ms: 164.600494
  type: 'test'
  ...
# Subtest: skips malformed records and missing copies, reads tail and caches only hits
ok 195 - skips malformed records and missing copies, reads tail and caches only hits
  ---
  duration_ms: 40.105579
  type: 'test'
  ...
# Subtest: refresh coalesces triggers, publishes on completion, and recovers from errors
ok 196 - refresh coalesces triggers, publishes on completion, and recovers from errors
  ---
  duration_ms: 15.736314
  type: 'test'
  ...
# Subtest: classifies both CLI tool tables and labels and keys
ok 197 - classifies both CLI tool tables and labels and keys
  ---
  duration_ms: 71.341565
  type: 'test'
  ...
# Subtest: Claude step hooks omit raw input and map ends
ok 198 - Claude step hooks omit raw input and map ends
  ---
  duration_ms: 1.016168
  type: 'test'
  ...
# Subtest: statusline independently throttles and spools both events
ok 199 - statusline independently throttles and spools both events
  ---
  duration_ms: 599.454679
  type: 'test'
  ...
# Subtest: empty commands, command arrays and empty patches have useful labels and keys
ok 200 - empty commands, command arrays and empty patches have useful labels and keys
  ---
  duration_ms: 0.660927
  type: 'test'
  ...
# machine service listening on 127.0.0.1:39463
# machine service listening on 127.0.0.1:39463
# Subtest: sudo registration, delivery, recovery and cancel preserve outcomes
ok 201 - sudo registration, delivery, recovery and cancel preserve outcomes
  ---
  duration_ms: 282.112454
  type: 'test'
  ...
1..201
# tests 201
# suites 0
# pass 201
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 32607.100783
```

## Choices

none
