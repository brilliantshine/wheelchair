# T4c report

The T4b reproduction showed the hub lead waiting with `no claude account has room` and no machine session. Source reasoning: the synchronous machine status login checks include real home accounts, and the hub marked the machine unreachable after 3 seconds under load. `viewer/app/usage.js` now allows 15 seconds for both the status call and its race timer. `viewer/test/app-uploads-archive.test.js` uses a fresh home for the in-process machine and restores HOME and PATH on cleanup and error; the hub child inherits that home and the fake CLI on PATH. Its strict lead assertion now reports current hub and machine sessions on failure.

No existing viewer test pins this account-status timeout; no extra test was changed. The picker’s viewer command is covered by the archive and account-related runs below. The initial broader account-related run was stopped after about two minutes when assistant.test.js remained open; its output had no `not ok`, and its account-switch case passed separately. The registration errors in that interrupted log are expected fixture output from app-handoff-restart.

## Choices

- `app-uploads-archive.test.js`: the hub child inherits the isolated HOME as well as the fake CLI PATH.
- `app-uploads-archive.test.js`: diagnostic thread state is read from a fresh Hub only when the machine lead is absent.

## Validation

`node --test viewer/test/app-uploads-archive.test.js`

```text
exit 0
TAP version 13
# machine: screen startup cleanup failed: wcscreen-7aa3a3275ada.slice
# machine service listening on 127.0.0.1:34847
# machine: screen teardown failed: wcscreen-7aa3a3275ada-0fe1038fa765.slice
# Subtest: archive through the hub cancels a stalled upload to the real machine
ok 1 - archive through the hub cancels a stalled upload to the real machine
  ---
  duration_ms: 6853.156337
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-72ccf6a1e7a0.slice
# machine service listening on 127.0.0.1:40249
# Subtest: a lead still waiting takes uploads on the real machine
ok 2 - a lead still waiting takes uploads on the real machine
  ---
  duration_ms: 1508.627772
  type: 'test'
  ...
# machine: screen startup cleanup failed: wcscreen-2f186d9711c4.slice
# machine service listening on 127.0.0.1:34079
# Subtest: a lead still starting takes uploads on the real machine
ok 3 - a lead still starting takes uploads on the real machine
  ---
  duration_ms: 1496.288284
  type: 'test'
  ...
1..3
# tests 3
# suites 0
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9942.218256
```

`bash test-support/under-load.sh --repeat 10 -- node --test --test-name-pattern "stalled upload" viewer/test/app-uploads-archive.test.js`

```text
exit 0
# skipped 0
# todo 0
# duration_ms 9378.457901
TAP version 13
# machine: screen startup cleanup failed: wcscreen-94dd9577d441.slice
# machine service listening on 127.0.0.1:44969
# machine: screen teardown failed: wcscreen-94dd9577d441-0ec801aa2a71.slice
# Subtest: archive through the hub cancels a stalled upload to the real machine
ok 1 - archive through the hub cancels a stalled upload to the real machine
  ---
  duration_ms: 9033.061329
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9220.71276
TAP version 13
# machine: screen startup cleanup failed: wcscreen-6df559b501bc.slice
# machine service listening on 127.0.0.1:33399
# machine: screen teardown failed: wcscreen-6df559b501bc-07c6aaf05658.slice
# Subtest: archive through the hub cancels a stalled upload to the real machine
ok 1 - archive through the hub cancels a stalled upload to the real machine
  ---
  duration_ms: 9033.536905
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9216.750076
TAP version 13
# machine: screen startup cleanup failed: wcscreen-1586f06395fd.slice
# machine service listening on 127.0.0.1:45537
# machine: screen teardown failed: wcscreen-1586f06395fd-e6310fa99595.slice
# Subtest: archive through the hub cancels a stalled upload to the real machine
ok 1 - archive through the hub cancels a stalled upload to the real machine
  ---
  duration_ms: 8958.592949
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9192.666168
TAP version 13
# machine: screen startup cleanup failed: wcscreen-8aef7feb7c27.slice
# machine service listening on 127.0.0.1:42041
# machine: screen teardown failed: wcscreen-8aef7feb7c27-8ce011fa3827.slice
# Subtest: archive through the hub cancels a stalled upload to the real machine
ok 1 - archive through the hub cancels a stalled upload to the real machine
  ---
  duration_ms: 9400.363712
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 9593.574369
under-load: pass 10 of 10
```

`node --test viewer/test/app-harnesses.test.js viewer/test/app-switch.test.js viewer/test/char-hub-dispatch.test.js viewer/test/app-handoff-restart.test.js viewer/test/minimal-manifest.test.js viewer/test/app-kimi-settings.test.js viewer/test/app-openrouter-usage.test.js viewer/test/app-usage.test.js viewer/test/app-balancer.test.js`

```text
exit 0
ok 124 - idle probes all and only supported tools, including live Kimi
  ---
  duration_ms: 87.731545
  type: 'test'
  ...
# Subtest: usage displays forecasts, spend, problems and warnings by provider
ok 125 - usage displays forecasts, spend, problems and warnings by provider
  ---
  duration_ms: 16.710957
  type: 'test'
  ...
# Subtest: settings preserve provider plans, scout wording, review fallback and discovery
ok 126 - settings preserve provider plans, scout wording, review fallback and discovery
  ---
  duration_ms: 3.219993
  type: 'test'
  ...
# Subtest: model routes validate each provider, aliases, efforts and review choices
ok 127 - model routes validate each provider, aliases, efforts and review choices
  ---
  duration_ms: 1258.73357
  type: 'test'
  ...
# Subtest: aside fork chooses each supported parent and rejects unsupported providers
ok 128 - aside fork chooses each supported parent and rejects unsupported providers
  ---
  duration_ms: 1.554811
  type: 'test'
  ...
# Subtest: chat selects distinct report and transcript formats for every CLI
ok 129 - chat selects distinct report and transcript formats for every CLI
  ---
  duration_ms: 4.346233
  type: 'test'
  ...
# Subtest: session limit switching and persisted harness ids vary by provider
ok 130 - session limit switching and persisted harness ids vary by provider
  ---
  duration_ms: 77.613807
  type: 'test'
  ...
# Subtest: worker effort ceilings apply to every provider with effort
ok 131 - worker effort ceilings apply to every provider with effort
  ---
  duration_ms: 1916.571238
  type: 'test'
  ...
# Subtest: session model resolution uses provider cells and tier aliases
ok 132 - session model resolution uses provider cells and tier aliases
  ---
  duration_ms: 184.106381
  type: 'test'
  ...
# Subtest: switch placement runs preflight only for GPT
ok 133 - switch placement runs preflight only for GPT
  ---
  duration_ms: 29.372773
  type: 'test'
  ...
# Subtest: minimal manifest can be read by the settings store
ok 134 - minimal manifest can be read by the settings store
  ---
  duration_ms: 14.883234
  type: 'test'
  ...
# Subtest: minimal manifest works in hub routes, assets and usage
ok 135 - minimal manifest works in hub routes, assets and usage
  ---
  duration_ms: 640.024928
  type: 'test'
  ...
1..135
# tests 148
# suites 0
# pass 148
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 22291.400307
```

`node test-support/pick-tests.js --base wc/6c419c5e634b`

```text
exit 0
node --test viewer/test/app-balancer.test.js viewer/test/app-harnesses.test.js viewer/test/app-kimi-settings.test.js viewer/test/app-openrouter-usage.test.js viewer/test/app-switch.test.js viewer/test/app-uploads-archive.test.js viewer/test/app-usage.test.js viewer/test/char-hub-dispatch.test.js
node --test machine/test/name-guard.test.js
```

`node --test machine/test/name-guard.test.js`

```text
exit 0
TAP version 13
# Subtest: detector recognizes name checks across lines
ok 1 - detector recognizes name checks across lines
  ---
  duration_ms: 6.476367
  type: 'test'
  ...
# Subtest: tool names do not dispatch outside connectors
ok 2 - tool names do not dispatch outside connectors
  ---
  duration_ms: 237.881521
  type: 'test'
  ...
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 303.509342
```

`timeout 60s node --test --test-name-pattern 'account switching sends assistant identity' viewer/test/assistant.test.js`

```text
exit 0
TAP version 13
# Subtest: account switching sends assistant identity without a project
ok 1 - account switching sends assistant identity without a project
  ---
  duration_ms: 128.207815
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 220.230887
```

`node --test viewer/test/app-hub.test.js viewer/test/app-harnesses.test.js viewer/test/app-switch.test.js viewer/test/char-hub-dispatch.test.js viewer/test/app-handoff-import.test.js viewer/test/background-completion.test.js viewer/test/assistant.test.js viewer/test/app-settings.test.js viewer/test/app-kimi-settings.test.js viewer/test/minimal-manifest.test.js viewer/test/app-openrouter-usage.test.js viewer/test/app-usage.test.js viewer/test/app-balancer.test.js viewer/test/app-handoff-restart.test.js`

```text
exit 1
  type: 'test'
  ...
# Subtest: idle poll stores default and named Kimi account readings
ok 282 - idle poll stores default and named Kimi account readings
  ---
  duration_ms: 97.205722
  type: 'test'
  ...
# Subtest: idle poll stores a Kimi reading while its session is live
ok 283 - idle poll stores a Kimi reading while its session is live
  ---
  duration_ms: 110.467145
  type: 'test'
  ...
# Subtest: idle poll tries another machine when a Kimi probe fails
ok 284 - idle poll tries another machine when a Kimi probe fails
  ---
  duration_ms: 103.318701
  type: 'test'
  ...
# Subtest: idle poll skips a live Claude account
ok 285 - idle poll skips a live Claude account
  ---
  duration_ms: 98.497056
  type: 'test'
  ...
# Subtest: idle poll drops a reading when the account becomes live
ok 286 - idle poll drops a reading when the account becomes live
  ---
  duration_ms: 94.753439
  type: 'test'
  ...
# Subtest: idle poll keeps stored usage on failure and throttles retries
ok 287 - idle poll keeps stored usage on failure and throttles retries
  ---
  duration_ms: 106.949382
  type: 'test'
  ...
# Subtest: overlapping idle polls share one run
ok 288 - overlapping idle polls share one run
  ---
  duration_ms: 100.129657
  type: 'test'
  ...
# Subtest: idle poll skips readings less than nine minutes old
ok 289 - idle poll skips readings less than nine minutes old
  ---
  duration_ms: 100.347555
  type: 'test'
  ...
# Subtest: idle poll rechecks later accounts before probing
ok 290 - idle poll rechecks later accounts before probing
  ---
  duration_ms: 102.058905
  type: 'test'
  ...
# Subtest: a newer live reading survives an idle probe after the session ends
ok 291 - a newer live reading survives an idle probe after the session ends
  ---
  duration_ms: 102.490413
  type: 'test'
  ...
# Subtest: idle poll drops a removed account result
ok 292 - idle poll drops a removed account result
  ---
  duration_ms: 150.462083
  type: 'test'
  ...
# Subtest: idle poll promotes a waiting start when usage frees room
ok 293 - idle poll promotes a waiting start when usage frees room
  ---
  duration_ms: 1390.997707
  type: 'test'
  ...
# Subtest: a reported GPT plan sets the account plan and weight unless the weight was typed in
ok 294 - a reported GPT plan sets the account plan and weight unless the weight was typed in
  ---
  duration_ms: 10.971674
  type: 'test'
  ...
```

