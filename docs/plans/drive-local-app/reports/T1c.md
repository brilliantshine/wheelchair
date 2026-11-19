# T1c report

- `machine/lib/screen-input.js`: X-tool calls, listing, capture, pointer and keyboard input, focus and bounded auto-focus.
- `machine/test/screen-input.test.js`: isolated fake-tool tests using per-process temporary directories.

Test mapping: windows → `windows: viewable direct children, untitled, empty and vanished`; screenshots → `shot: full screen, clipped window, off screen and ffmpeg errors`; pointer and drag → `pointer: exact move click drag and release on failure`; type → `type: literal option and scaled timeout`; key taps, hold and failed keydown → `keys: taps, hold order and failed keydown releases`; cut tap → `keys: deadline cuts tap, releases it, and stops further taps`; release failures and concurrency → `keys: failed and stalled releases lock input without starving others`; focus → `focus: exact argv and failure`; auto-focus → `autofocus: baseline, first new window, none, failure and stalled probe`; timeout → `runTool: timeout kills process`.

Validation (scratch: `/tmp/t1c-w7`):

```text
$ node --test machine/test/screen-input.test.js > "$SCRATCH/t1c.log" 2>&1; echo "exit $?"; tail -n 40 "$SCRATCH/t1c.log"
exit 0
  ...
# Subtest: keys: deadline cuts tap, releases it, and stops further taps
ok 6 - keys: deadline cuts tap, releases it, and stops further taps
  ---
  duration_ms: 107.426521
  type: 'test'
  ...
# Subtest: keys: failed and stalled releases lock input without starving others
ok 7 - keys: failed and stalled releases lock input without starving others
  ---
  duration_ms: 627.474468
  type: 'test'
  ...
# Subtest: focus: exact argv and failure
ok 8 - focus: exact argv and failure
  ---
  duration_ms: 12.453881
  type: 'test'
  ...
# Subtest: autofocus: baseline, first new window, none, failure and stalled probe
ok 9 - autofocus: baseline, first new window, none, failure and stalled probe
  ---
  duration_ms: 191.996401
  type: 'test'
  ...
# Subtest: runTool: timeout kills process
ok 10 - runTool: timeout kills process
  ---
  duration_ms: 53.604227
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
# duration_ms 1356.143682
$ for i in 1 2 3; do node --test machine/test/screen-input.test.js > "$SCRATCH/t1c-$i.log" 2>&1; echo "run $i exit $?"; done
run 1 exit 0
run 2 exit 0
run 3 exit 0
$ bash machine/test/run.sh > "$SCRATCH/t1c-all.log" 2>&1; echo "exit $?"; grep -E '^# (pass|fail)' "$SCRATCH/t1c-all.log"
exit 0
# pass 184
# fail 0
$ tail -n 80 "$SCRATCH/t1c-all.log"
# machine service listening on 127.0.0.1:35641
# Subtest: inspect accepts the thread checkout after archive and falls back to the local ref or supplied head
ok 174 - inspect accepts the thread checkout after archive and falls back to the local ref or supplied head
  ---
  duration_ms: 377.63357
  type: 'test'
  ...
# machine service listening on 127.0.0.1:34403
# Subtest: archive saves the in-progress marker before stopping and clears it on failure
ok 175 - archive saves the in-progress marker before stopping and clears it on failure
  ---
  duration_ms: 60.032121
  type: 'test'
  ...
# machine service listening on 127.0.0.1:41457
# Subtest: approval warnings are machine owned and never await a refresh
ok 176 - approval warnings are machine owned and never await a refresh
  ---
  duration_ms: 90.52035
  type: 'test'
  ...
# Subtest: medians, thresholds, outliers, both roles and ignored entries
ok 177 - medians, thresholds, outliers, both roles and ignored entries
  ---
  duration_ms: 75.436645
  type: 'test'
  ...
# Subtest: skips malformed records and missing copies, reads tail and caches only hits
ok 178 - skips malformed records and missing copies, reads tail and caches only hits
  ---
  duration_ms: 12.571176
  type: 'test'
  ...
# Subtest: refresh coalesces triggers, publishes on completion, and recovers from errors
ok 179 - refresh coalesces triggers, publishes on completion, and recovers from errors
  ---
  duration_ms: 21.009721
  type: 'test'
  ...
# Subtest: classifies both CLI tool tables and labels and keys
ok 180 - classifies both CLI tool tables and labels and keys
  ---
  duration_ms: 35.50754
  type: 'test'
  ...
# Subtest: Claude step hooks omit raw input and map ends
ok 181 - Claude step hooks omit raw input and map ends
  ---
  duration_ms: 0.851242
  type: 'test'
  ...
# Subtest: statusline independently throttles and spools both events
ok 182 - statusline independently throttles and spools both events
  ---
  duration_ms: 392.980123
  type: 'test'
  ...
# Subtest: empty commands, command arrays and empty patches have useful labels and keys
ok 183 - empty commands, command arrays and empty patches have useful labels and keys
  ---
  duration_ms: 0.330774
  type: 'test'
  ...
# machine service listening on 127.0.0.1:42775
# machine service listening on 127.0.0.1:42775
# Subtest: sudo registration, delivery, recovery and cancel preserve outcomes
ok 184 - sudo registration, delivery, recovery and cancel preserve outcomes
  ---
  duration_ms: 225.232849
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
# duration_ms 28903.557773
$ git diff --stat wc/940599e3df66...HEAD
(no output: the new files were uncommitted when run)
```

The first full suite run failed because concurrent fake-tool log writes interleaved; the fixture now writes each line in one append. The focused suite's first run also exposed inherited pipe handles delaying timeout completion; the fake now execs its stall and the runner resolves killed processes on exit.

## Choices

- `screen-input.js`: `baseDeadlineMs` is an optional test hook for the key operation; production defaults to 10000 ms.
- `screen-input.js`: failed screenshot temporary files are removed, and malformed window geometry is treated as gone/off screen.
- `screen-input.test.js`: fake-tool scripts are generated in the test temp directory; no persistent fixtures are needed.

Nothing else was left undone.
