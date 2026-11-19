# T1c — screen input layer, attempt 2

## Changes

- `machine/lib/screen-input.js`: preserved the input layer from attempt 1; drag releases use an independent one-second timeout, invalid text is converted to 422, and non-array autofocus baselines return null.
- `machine/test/screen-input.test.js`: strengthened fake-tool coverage for the review findings, including concurrent releases and their start order.

## Test mapping

- Window listing, viewability, untitled, empty, vanished: `windows: viewable direct children, untitled, empty and vanished`.
- Full-screen and clipped shots, off-screen, temp rename, ffmpeg failure: `shot: full screen, clipped window, off screen and ffmpeg errors`.
- Move, click, drag, failure and timeout release: `pointer: exact move click drag and release on failure`.
- Literal text, scaled timeout, invalid text: `type: literal option and scaled timeout`.
- Tap and hold order, failed keydown: `keys: taps, hold order and failed keydown releases`.
- Tap deadline and release: `keys: deadline cuts tap, releases it, and stops further taps`.
- Failed and stalled release, parallel cleanup: `keys: failed and stalled first release locks input without starving others`.
- Focus argv and failure: `focus: exact argv and failure`.
- Baselines, first new window, no window, failed focus and stalled probe: `autofocus: baseline, first new window, none, failure and stalled probe`.
- Tool timeout: `runTool: timeout kills process`.

## Validation

The first repeated test run exposed concurrent process log ordering, and the first machine suite also encountered an unrelated `EADDRINUSE` alongside the same ordering assertion. The assertions were corrected to observe call start order; the complete validation below passed on retry.

```text
exit 0
  ...
# Subtest: keys: deadline cuts tap, releases it, and stops further taps
ok 6 - keys: deadline cuts tap, releases it, and stops further taps
  ---
  duration_ms: 108.044231
  type: 'test'
  ...
# Subtest: keys: failed and stalled first release locks input without starving others
ok 7 - keys: failed and stalled first release locks input without starving others
  ---
  duration_ms: 629.310728
  type: 'test'
  ...
# Subtest: focus: exact argv and failure
ok 8 - focus: exact argv and failure
  ---
  duration_ms: 11.361794
  type: 'test'
  ...
# Subtest: autofocus: baseline, first new window, none, failure and stalled probe
ok 9 - autofocus: baseline, first new window, none, failure and stalled probe
  ---
  duration_ms: 203.802427
  type: 'test'
  ...
# Subtest: runTool: timeout kills process
ok 10 - runTool: timeout kills process
  ---
  duration_ms: 53.607431
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
# duration_ms 1446.54022
run 1 exit 0
run 2 exit 0
run 3 exit 0
exit 0
# pass 184
# fail 0
 docs/plans/drive-local-app/reports/T1c.md | 154 ++++++++++++++++++++++++++++++
 machine/lib/screen-input.js               | 124 ++++++++++++++++++++++++
 machine/test/screen-input.test.js         |  46 +++++++++
 3 files changed, 324 insertions(+)
```

The validation commands were the brief's exact commands, with `SCRATCH` set to the temporary directory. The stat describes the committed cherry-pick at the time of the command; the final commit additionally contains the review fixes and this rewritten report.

Worker-required tails for the repeated runs and machine suite:

`t1c-1.log`:

```text
TAP version 13
# Subtest: windows: viewable direct children, untitled, empty and vanished
ok 1 - windows: viewable direct children, untitled, empty and vanished
  ---
  duration_ms: 71.779191
  type: 'test'
  ...
# Subtest: shot: full screen, clipped window, off screen and ffmpeg errors
ok 2 - shot: full screen, clipped window, off screen and ffmpeg errors
  ---
  duration_ms: 28.035552
  type: 'test'
  ...
# Subtest: pointer: exact move click drag and release on failure
ok 3 - pointer: exact move click drag and release on failure
  ---
  duration_ms: 163.393382
  type: 'test'
  ...
# Subtest: type: literal option and scaled timeout
ok 4 - type: literal option and scaled timeout
  ---
  duration_ms: 6.640422
  type: 'test'
  ...
# Subtest: keys: taps, hold order and failed keydown releases
ok 5 - keys: taps, hold order and failed keydown releases
  ---
  duration_ms: 116.699527
  type: 'test'
  ...
# Subtest: keys: deadline cuts tap, releases it, and stops further taps
ok 6 - keys: deadline cuts tap, releases it, and stops further taps
  ---
  duration_ms: 108.572134
  type: 'test'
  ...
# Subtest: keys: failed and stalled first release locks input without starving others
ok 7 - keys: failed and stalled first release locks input without starving others
  ---
  duration_ms: 629.079756
  type: 'test'
  ...
# Subtest: focus: exact argv and failure
ok 8 - focus: exact argv and failure
  ---
  duration_ms: 9.918637
  type: 'test'
  ...
# Subtest: autofocus: baseline, first new window, none, failure and stalled probe
ok 9 - autofocus: baseline, first new window, none, failure and stalled probe
  ---
  duration_ms: 204.455329
  type: 'test'
  ...
# Subtest: runTool: timeout kills process
ok 10 - runTool: timeout kills process
  ---
  duration_ms: 53.132851
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
# duration_ms 1441.728756
```

`t1c-2.log`:

```text
TAP version 13
# Subtest: windows: viewable direct children, untitled, empty and vanished
ok 1 - windows: viewable direct children, untitled, empty and vanished
  ---
  duration_ms: 74.661667
  type: 'test'
  ...
# Subtest: shot: full screen, clipped window, off screen and ffmpeg errors
ok 2 - shot: full screen, clipped window, off screen and ffmpeg errors
  ---
  duration_ms: 24.296653
  type: 'test'
  ...
# Subtest: pointer: exact move click drag and release on failure
ok 3 - pointer: exact move click drag and release on failure
  ---
  duration_ms: 157.616066
  type: 'test'
  ...
# Subtest: type: literal option and scaled timeout
ok 4 - type: literal option and scaled timeout
  ---
  duration_ms: 6.752637
  type: 'test'
  ...
# Subtest: keys: taps, hold order and failed keydown releases
ok 5 - keys: taps, hold order and failed keydown releases
  ---
  duration_ms: 113.97821
  type: 'test'
  ...
# Subtest: keys: deadline cuts tap, releases it, and stops further taps
ok 6 - keys: deadline cuts tap, releases it, and stops further taps
  ---
  duration_ms: 108.955859
  type: 'test'
  ...
# Subtest: keys: failed and stalled first release locks input without starving others
ok 7 - keys: failed and stalled first release locks input without starving others
  ---
  duration_ms: 629.313665
  type: 'test'
  ...
# Subtest: focus: exact argv and failure
ok 8 - focus: exact argv and failure
  ---
  duration_ms: 8.844859
  type: 'test'
  ...
# Subtest: autofocus: baseline, first new window, none, failure and stalled probe
ok 9 - autofocus: baseline, first new window, none, failure and stalled probe
  ---
  duration_ms: 188.987403
  type: 'test'
  ...
# Subtest: runTool: timeout kills process
ok 10 - runTool: timeout kills process
  ---
  duration_ms: 52.466604
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
# duration_ms 1420.450079
```

`t1c-3.log`:

```text
TAP version 13
# Subtest: windows: viewable direct children, untitled, empty and vanished
ok 1 - windows: viewable direct children, untitled, empty and vanished
  ---
  duration_ms: 71.510085
  type: 'test'
  ...
# Subtest: shot: full screen, clipped window, off screen and ffmpeg errors
ok 2 - shot: full screen, clipped window, off screen and ffmpeg errors
  ---
  duration_ms: 27.429781
  type: 'test'
  ...
# Subtest: pointer: exact move click drag and release on failure
ok 3 - pointer: exact move click drag and release on failure
  ---
  duration_ms: 163.507881
  type: 'test'
  ...
# Subtest: type: literal option and scaled timeout
ok 4 - type: literal option and scaled timeout
  ---
  duration_ms: 5.999072
  type: 'test'
  ...
# Subtest: keys: taps, hold order and failed keydown releases
ok 5 - keys: taps, hold order and failed keydown releases
  ---
  duration_ms: 117.001806
  type: 'test'
  ...
# Subtest: keys: deadline cuts tap, releases it, and stops further taps
ok 6 - keys: deadline cuts tap, releases it, and stops further taps
  ---
  duration_ms: 107.43816
  type: 'test'
  ...
# Subtest: keys: failed and stalled first release locks input without starving others
ok 7 - keys: failed and stalled first release locks input without starving others
  ---
  duration_ms: 632.938184
  type: 'test'
  ...
# Subtest: focus: exact argv and failure
ok 8 - focus: exact argv and failure
  ---
  duration_ms: 9.456371
  type: 'test'
  ...
# Subtest: autofocus: baseline, first new window, none, failure and stalled probe
ok 9 - autofocus: baseline, first new window, none, failure and stalled probe
  ---
  duration_ms: 194.534178
  type: 'test'
  ...
# Subtest: runTool: timeout kills process
ok 10 - runTool: timeout kills process
  ---
  duration_ms: 53.166926
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
# duration_ms 1438.997311
```

`t1c-all.log`:

```text
# machine service listening on 127.0.0.1:46083
# Subtest: inspect accepts the thread checkout after archive and falls back to the local ref or supplied head
ok 174 - inspect accepts the thread checkout after archive and falls back to the local ref or supplied head
  ---
  duration_ms: 388.558483
  type: 'test'
  ...
# machine service listening on 127.0.0.1:42049
# Subtest: archive saves the in-progress marker before stopping and clears it on failure
ok 175 - archive saves the in-progress marker before stopping and clears it on failure
  ---
  duration_ms: 56.339439
  type: 'test'
  ...
# machine service listening on 127.0.0.1:36979
# Subtest: approval warnings are machine owned and never await a refresh
ok 176 - approval warnings are machine owned and never await a refresh
  ---
  duration_ms: 77.834953
  type: 'test'
  ...
# Subtest: medians, thresholds, outliers, both roles and ignored entries
ok 177 - medians, thresholds, outliers, both roles and ignored entries
  ---
  duration_ms: 95.064225
  type: 'test'
  ...
# Subtest: skips malformed records and missing copies, reads tail and caches only hits
ok 178 - skips malformed records and missing copies, reads tail and caches only hits
  ---
  duration_ms: 34.344198
  type: 'test'
  ...
# Subtest: refresh coalesces triggers, publishes on completion, and recovers from errors
ok 179 - refresh coalesces triggers, publishes on completion, and recovers from errors
  ---
  duration_ms: 19.83002
  type: 'test'
  ...
# Subtest: classifies both CLI tool tables and labels and keys
ok 180 - classifies both CLI tool tables and labels and keys
  ---
  duration_ms: 36.138869
  type: 'test'
  ...
# Subtest: Claude step hooks omit raw input and map ends
ok 181 - Claude step hooks omit raw input and map ends
  ---
  duration_ms: 0.781288
  type: 'test'
  ...
# Subtest: statusline independently throttles and spools both events
ok 182 - statusline independently throttles and spools both events
  ---
  duration_ms: 441.377698
  type: 'test'
  ...
# Subtest: empty commands, command arrays and empty patches have useful labels and keys
ok 183 - empty commands, command arrays and empty patches have useful labels and keys
  ---
  duration_ms: 0.304393
  type: 'test'
  ...
# machine service listening on 127.0.0.1:40149
# machine service listening on 127.0.0.1:40149
# Subtest: sudo registration, delivery, recovery and cancel preserve outcomes
ok 184 - sudo registration, delivery, recovery and cancel preserve outcomes
  ---
  duration_ms: 232.612285
  type: 'test'
  ...
1..184
# tests 184
# suites 0
# pass 184
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 29453.435177
```

## Choices

- `pointer`: named the optional test deadline `baseDeadlineMs`, matching `pressKeys`.
- `typeText`: added an optional `onTimeout` test hook to observe the actual timeout supplied to the tool.
- `pressKeys`: added an optional `onRelease` test hook to assert release invocation order, since concurrently spawned tools may log in a different order.
- Tests: stalled token `c` is the first release of held `a b c`; fake tools and logs stay in `makeTempSync` directories.

Nothing remains unimplemented. The final commit SHA is recorded in the result card; it cannot be embedded in the contents of the same commit without changing that SHA.
