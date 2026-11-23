# T1e — hub characterization

## Changes

- `viewer/test/char-hub-dispatch.test.js`: ten characterization tests exercise all five CLIs through hub exports and isolated server fixtures. They cover idle polling, usage display, session model selection and effort, switching and identifier persistence, settings and routes, aside parents, chat reports and parsers, and preflight.
- `docs/plans/modular-harness-connectors/reports/T1e.md`: checklist, validation output and choices.

Every new test was run against a deliberate in-memory source mutation using a temporary Node module loader. Each mutated run failed in the intended test; the production files on disk were never changed. No case requires a real CLI or external network.

## Checklist

1. `viewer/app/usage-poll.js:17-42`: which tools are probed when idle, the Kimi live-session rule and machine retry (confirm existing tests in `viewer/test/app-usage.test.js` cover all five tools; add what is missing). covered: idle poll stores a Kimi reading while its session is live; idle poll tries another machine when a Kimi probe fails (viewer/test/app-usage.test.js); test: idle probes all and only supported tools, including live Kimi (viewer/test/char-hub-dispatch.test.js)
2. `viewer/app/sessions.js:106-119,209-212,627,677,888`: model-family syntax and slot aliases per provider, effort ceiling, live-switch eligibility (Claude/GPT only), harness ids. covered: scout preferences and session layers follow the selected provider (viewer/test/app-settings.test.js); worker effort overrides and escalation ceilings reject before starting (viewer/test/app-hub.test.js); test: session model resolution uses provider cells and tier aliases; worker effort ceilings apply to every provider with effort; session limit switching and persisted harness ids vary by provider (viewer/test/char-hub-dispatch.test.js)
3. `viewer/app/usage.js:20-25,78-87,145`: spend vs forecast display, CLI problem/warning, account display, per tool. test: usage displays forecasts, spend, problems and warnings by provider (viewer/test/char-hub-dispatch.test.js)
4. `viewer/app/routes.js:313-331,378`: model-name validation per provider ("model is invalid"; e.g. a 65-character GPT model), Claude `haiku`/`sonnet`/`opus` aliases, effort error wording (GPT "effort for GPT must be one of low, medium, high, xhigh" vs "effort is invalid"), reviewer-family choices. test: model routes validate each provider, aliases, efforts and review choices (viewer/test/char-hub-dispatch.test.js)
5. `viewer/app/settings.js:36-40,238,323,430-440`: plans and weights per provider, prompt wording, reviewer choices including the fallback to `both` for an invalid saved value (`:323`), model discovery per provider (fresh defaults and migration are already in `char-settings-defaults.test.js`). covered: fresh and migrated placement orders preserve exclusions and add unseen families (viewer/test/char-settings-defaults.test.js); test: settings preserve provider plans, scout wording, review fallback and discovery (viewer/test/char-hub-dispatch.test.js)
6. `viewer/app/balancer.js:59,97`: GPT preflight and OpenRouter append-when-requested (likely covered in `app-balancer.test.js`; confirm). covered: OpenRouter explicit placement outside order respects review family (viewer/test/app-balancer.test.js); test: switch placement runs preflight only for GPT (viewer/test/char-hub-dispatch.test.js)
7. `viewer/app/asides.js:41`: aside parent field for Claude (`cli_session_id`), Codex (`codex_thread_id`), Pi (`cli_session_id`). test: aside fork chooses each supported parent and rejects unsupported providers (viewer/test/char-hub-dispatch.test.js)
8. `viewer/app/chat.js`: per-tool report selection (`:270-299,369-375`) and parser choice for all five (confirm `app-chat.test.js`). covered: renders Antigravity fixture turns, tools, timestamps and report (viewer/test/app-chat.test.js); Kimi report selects a turn and orders the last step parts by block (viewer/test/app-kimi-hub.test.js); Pi report selects only the named assistant entry (viewer/test/app-openrouter-hub.test.js); test: chat selects distinct report and transcript formats for every CLI (viewer/test/char-hub-dispatch.test.js)

## Validation

`node --test viewer/test/char-hub-*.test.js` (final):

```text
exit 0
TAP version 13
# Subtest: idle probes all and only supported tools, including live Kimi
ok 1 - idle probes all and only supported tools, including live Kimi
  ---
  duration_ms: 28.938721
  type: 'test'
  ...
# Subtest: usage displays forecasts, spend, problems and warnings by provider
ok 2 - usage displays forecasts, spend, problems and warnings by provider
  ---
  duration_ms: 11.606392
  type: 'test'
  ...
# Subtest: settings preserve provider plans, scout wording, review fallback and discovery
ok 3 - settings preserve provider plans, scout wording, review fallback and discovery
  ---
  duration_ms: 1.419266
  type: 'test'
  ...
# Subtest: model routes validate each provider, aliases, efforts and review choices
ok 4 - model routes validate each provider, aliases, efforts and review choices
  ---
  duration_ms: 850.185993
  type: 'test'
  ...
# Subtest: aside fork chooses each supported parent and rejects unsupported providers
ok 5 - aside fork chooses each supported parent and rejects unsupported providers
  ---
  duration_ms: 0.9203
  type: 'test'
  ...
# Subtest: chat selects distinct report and transcript formats for every CLI
ok 6 - chat selects distinct report and transcript formats for every CLI
  ---
  duration_ms: 1.657887
  type: 'test'
  ...
# Subtest: session limit switching and persisted harness ids vary by provider
ok 7 - session limit switching and persisted harness ids vary by provider
  ---
  duration_ms: 54.818604
  type: 'test'
  ...
# Subtest: worker effort ceilings apply to every provider with effort
ok 8 - worker effort ceilings apply to every provider with effort
  ---
  duration_ms: 1527.930389
  type: 'test'
  ...
# Subtest: session model resolution uses provider cells and tier aliases
ok 9 - session model resolution uses provider cells and tier aliases
  ---
  duration_ms: 174.436315
  type: 'test'
  ...
# Subtest: switch placement runs preflight only for GPT
ok 10 - switch placement runs preflight only for GPT
  ---
  duration_ms: 19.399816
  type: 'test'
  ...
1..10
# tests 10
# suites 0
# pass 10
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2739.211943
```

`bash machine/test/run.sh`:

```text
exit 1
    ensureCopy (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w5/machine/lib/win-sync.js:75:9)
    WinBridge.create (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w5/machine/lib/win.js:107:11)
    WinBridge.handle (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w5/machine/lib/win.js:470:20)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w5/machine/test/win.test.js:334:3)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: info reports a PowerShell startup failure and environment names are case insensitive
ok 692 - info reports a PowerShell startup failure and environment names are case insensitive
  ---
  duration_ms: 0.953411
  type: 'test'
  ...
# Subtest: launch and restart mark existing copies used and recover only live copies
ok 693 - launch and restart mark existing copies used and recover only live copies
  ---
  duration_ms: 5.210773
  type: 'test'
  ...
# Subtest: launch marking causes a final reconcile after readying
not ok 694 - launch marking causes a final reconcile after readying
  ---
  duration_ms: 38.765517
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w5/machine/test/win.test.js:373:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:

    0 !== 1

  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 1
  actual: 0
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w5/machine/test/win.test.js:385:10)
    process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
# Subtest: without launch marking, readying does not cause a final reconcile
ok 695 - without launch marking, readying does not cause a final reconcile
  ---
  duration_ms: 37.205989
  type: 'test'
  ...
# Subtest: restart recovery tracks a live lead and reconciles on stop
not ok 696 - restart recovery tracks a live lead and reconciles on stop
  ---
  duration_ms: 38.931735
  type: 'test'
  location: '/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w5/machine/test/win.test.js:402:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:

    false !== true

  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: true
  actual: false
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (/home/collin/.local/state/wheelchair/worktrees/wheelchair/wc-dfb566cd9dd5-w5/machine/test/win.test.js:414:10)
    async Test.run (node:internal/test_runner/test:1054:7)
    async Test.processPendingSubtests (node:internal/test_runner/test:744:7)
  ...
1..696
# tests 696
# suites 0
# pass 676
# fail 18
# cancelled 0
# skipped 2
# todo 0
# duration_ms 69520.56405
```

The 18 failures below are exactly the listed baseline Windows-bridge failures caused by missing `wslpath`:

- existing copy remains waiting until a post-start reconcile completes
- failed readying becomes ready after a later successful sync
- run timeout syncs, status syncs an exit and launch environment excludes the token
- readying times out without blocking launch and does not create copies for ordinary sessions
- worker merge cleanup deletes its copy and stop does not reconcile
- verifier stop returns immediately and deletes after its apps stop
- failed copies survive ordinary removal and archive, but verifier and merge removal delete them
- archive waits for successful final sync then deletes the copy
- archive removes the thread folder when the copy went with its worktree first
- archive waits once for a final sync and retains a failed copy
- sweep reconciles a dead lead with no apps
- sweep marks dead app copies and reconciles a shared thread worktree after a worker registered
- tracker close callback marks the copy used
- sessions sharing a worktree share the copy and Windows tool use triggers stop sync
- archive deletes copies while retaining conflict refs
- cleanup removes a vanished linked worktree copy without a reconcile
- launch marking causes a final reconcile after readying
- restart recovery tracks a live lead and reconciles on stop

`(cd viewer && npm test)` (first run):

```text
exit 1
ok 882 - win status passes the operation and unchanged arguments
  ---
  duration_ms: 171.219212
  type: 'test'
  ...
# Subtest: win windows passes the operation and unchanged arguments
ok 883 - win windows passes the operation and unchanged arguments
  ---
  duration_ms: 132.61269
  type: 'test'
  ...
# Subtest: win shot passes the operation and unchanged arguments
ok 884 - win shot passes the operation and unchanged arguments
  ---
  duration_ms: 103.729993
  type: 'test'
  ...
# Subtest: win stop passes the operation and unchanged arguments
ok 885 - win stop passes the operation and unchanged arguments
  ---
  duration_ms: 123.489962
  type: 'test'
  ...
# Subtest: win path passes the operation and unchanged arguments
ok 886 - win path passes the operation and unchanged arguments
  ---
  duration_ms: 139.308752
  type: 'test'
  ...
# Subtest: win non-2xx response is reported with the wc prefix
ok 887 - win non-2xx response is reported with the wc prefix
  ---
  duration_ms: 102.959627
  type: 'test'
  ...
# Subtest: unknown win op fails without sending a request
ok 888 - unknown win op fails without sending a request
  ---
  duration_ms: 109.603317
  type: 'test'
  ...
# Subtest: winRequest rejects unknown and missing operations
ok 889 - winRequest rejects unknown and missing operations
  ---
  duration_ms: 5.520418
  type: 'test'
  ...
# Subtest: win info writes disk warnings to stderr and preserves JSON stdout
ok 890 - win info writes disk warnings to stderr and preserves JSON stdout
  ---
  duration_ms: 125.647783
  type: 'test'
  ...
# Subtest: the page eligibility regex equals the machine one
ok 891 - the page eligibility regex equals the machine one
  ---
  duration_ms: 2.247077
  type: 'test'
  ...
# Subtest: the page eligibility function
ok 892 - the page eligibility function
  ---
  duration_ms: 6.242972
  type: 'test'
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 893 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 87.14761
  type: 'test'
  ...
1..893
# tests 909
# suites 0
# pass 907
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 68671.908742
```

The first viewer run failed `6 message clears debt` (assertion: 1 !== 0) and `an app page carries font-src self and the font route serves only the allowlist` (port already held). Other workers were running suites concurrently; the subsequent retry was run after the competing suites stopped.

`(cd viewer && npm test)` (retry):

```text
exit 1
ok 883 - win status passes the operation and unchanged arguments
  ---
  duration_ms: 62.904223
  type: 'test'
  ...
# Subtest: win windows passes the operation and unchanged arguments
ok 884 - win windows passes the operation and unchanged arguments
  ---
  duration_ms: 83.412775
  type: 'test'
  ...
# Subtest: win shot passes the operation and unchanged arguments
ok 885 - win shot passes the operation and unchanged arguments
  ---
  duration_ms: 118.024717
  type: 'test'
  ...
# Subtest: win stop passes the operation and unchanged arguments
ok 886 - win stop passes the operation and unchanged arguments
  ---
  duration_ms: 59.812966
  type: 'test'
  ...
# Subtest: win path passes the operation and unchanged arguments
ok 887 - win path passes the operation and unchanged arguments
  ---
  duration_ms: 55.148007
  type: 'test'
  ...
# Subtest: win non-2xx response is reported with the wc prefix
ok 888 - win non-2xx response is reported with the wc prefix
  ---
  duration_ms: 57.422524
  type: 'test'
  ...
# Subtest: unknown win op fails without sending a request
ok 889 - unknown win op fails without sending a request
  ---
  duration_ms: 44.404684
  type: 'test'
  ...
# Subtest: winRequest rejects unknown and missing operations
ok 890 - winRequest rejects unknown and missing operations
  ---
  duration_ms: 0.531247
  type: 'test'
  ...
# Subtest: win info writes disk warnings to stderr and preserves JSON stdout
ok 891 - win info writes disk warnings to stderr and preserves JSON stdout
  ---
  duration_ms: 50.627216
  type: 'test'
  ...
# Subtest: the page eligibility regex equals the machine one
ok 892 - the page eligibility regex equals the machine one
  ---
  duration_ms: 1.878732
  type: 'test'
  ...
# Subtest: the page eligibility function
ok 893 - the page eligibility function
  ---
  duration_ms: 0.54299
  type: 'test'
  ...
# Subtest: stored ZIP has names and bytes readable by Python
ok 894 - stored ZIP has names and bytes readable by Python
  ---
  duration_ms: 44.383935
  type: 'test'
  ...
1..894
# tests 910
# suites 0
# pass 909
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 50179.399918
```

Retry failure: `listen EADDRINUSE: address already in use` in the fake machine server. The viewer validation remains blocked because the same port-collision gate failed twice; the task rules require stopping rather than retrying again.

Retry failures:

- refuses a second press on an answered question or offer and queues only the first

## Choices

- `viewer/test/char-hub-dispatch.test.js`: used isolated fake machine responses and a temporary model command to characterize the current branches without live CLIs; performed deliberate mutations with a temporary in-memory loader to respect the no-production-edits boundary.
