# T1b — load harness test races

## Changes

- `test-support/test/under-load.test.js`: affinity regexes now capture the full list to end of line with multiline matching. The TERM test writes the child PID through a temporary file and atomic rename, requires a positive integer PID, writes and waits for a trap-installed marker passed as a third path, then sends TERM.

## Causes and fixes

- Affinity assertion: `\d+` stopped at the first digit, so a reported list such as `0-15` could be read as `0`. The controlled regression fixture with selected CPU `0` and affinity `0-15` failed with `'0-15' !== '0'`; capturing the full list makes the existing equality assertion detect the mismatch.
- Child PID: the PID file could be observed between creation and write completion; an empty read converts to `0`, which passes `alive(0)` as a process-group check. I broke atomic publication by writing an empty file; under load the test failed with `invalid command child PID: 0`. The temporary file plus rename prevents readers from seeing a partial PID, and the explicit positive-integer assertion rejects malformed contents.
- TERM trap readiness: TERM could arrive before the child installed its handler. I broke readiness by delaying trap installation and removing the marker wait; under load the test failed with `command child did not receive TERM`. The child now writes the marker immediately after installing the trap, and the test waits for it before signalling.

## Validation

`node --test test-support/test/under-load.test.js`

```text
TAP version 13
# Subtest: counts passing and failing commands and pins command affinity
ok 1 - counts passing and failing commands and pins command affinity
  ---
  duration_ms: 144.327046
  type: 'test'
  ...
# Subtest: reaps helper after normal exit
ok 2 - reaps helper after normal exit
  ---
  duration_ms: 598.093365
  type: 'test'
  ...
# Subtest: TERM reaps helper and command child
ok 3 - TERM reaps helper and command child
  ---
  duration_ms: 102.327898
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
# duration_ms 948.664393
```

`bash test-support/under-load.sh --repeat 10 -- node --test test-support/test/under-load.test.js`

```text
under-load: cpus 5,9
TAP version 13
# Subtest: counts passing and failing commands and pins command affinity
ok 1 - counts passing and failing commands and pins command affinity
  ---
  duration_ms: 222.422785
  type: 'test'
  ...
# Subtest: reaps helper after normal exit
ok 2 - reaps helper after normal exit
  ---
  duration_ms: 588.233375
  type: 'test'
  ...
# Subtest: TERM reaps helper and command child
ok 3 - TERM reaps helper and command child
  ---
  duration_ms: 303.713157
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
# duration_ms 1410.876352
TAP version 13
# Subtest: counts passing and failing commands and pins command affinity
ok 1 - counts passing and failing commands and pins command affinity
  ---
  duration_ms: 243.481762
  type: 'test'
  ...
# Subtest: reaps helper after normal exit
ok 2 - reaps helper after normal exit
  ---
  duration_ms: 604.99827
  type: 'test'
  ...
# Subtest: TERM reaps helper and command child
ok 3 - TERM reaps helper and command child
  ---
  duration_ms: 262.308841
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
# duration_ms 1422.617479
TAP version 13
# Subtest: counts passing and failing commands and pins command affinity
ok 1 - counts passing and failing commands and pins command affinity
  ---
  duration_ms: 170.77339
  type: 'test'
  ...
# Subtest: reaps helper after normal exit
ok 2 - reaps helper after normal exit
  ---
  duration_ms: 585.721491
  type: 'test'
  ...
# Subtest: TERM reaps helper and command child
ok 3 - TERM reaps helper and command child
  ---
  duration_ms: 305.83781
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
# duration_ms 1305.297561
TAP version 13
# Subtest: counts passing and failing commands and pins command affinity
ok 1 - counts passing and failing commands and pins command affinity
  ---
  duration_ms: 103.756958
  type: 'test'
  ...
# Subtest: reaps helper after normal exit
ok 2 - reaps helper after normal exit
  ---
  duration_ms: 553.80492
  type: 'test'
  ...
# Subtest: TERM reaps helper and command child
ok 3 - TERM reaps helper and command child
  ---
  duration_ms: 295.882587
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
# duration_ms 1150.944105
TAP version 13
# Subtest: counts passing and failing commands and pins command affinity
ok 1 - counts passing and failing commands and pins command affinity
  ---
  duration_ms: 215.750956
  type: 'test'
  ...
# Subtest: reaps helper after normal exit
ok 2 - reaps helper after normal exit
  ---
  duration_ms: 584.680484
  type: 'test'
  ...
# Subtest: TERM reaps helper and command child
ok 3 - TERM reaps helper and command child
  ---
  duration_ms: 321.429798
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
# duration_ms 1414.744677
TAP version 13
# Subtest: counts passing and failing commands and pins command affinity
ok 1 - counts passing and failing commands and pins command affinity
  ---
  duration_ms: 143.402483
  type: 'test'
  ...
# Subtest: reaps helper after normal exit
ok 2 - reaps helper after normal exit
  ---
  duration_ms: 581.38121
  type: 'test'
  ...
# Subtest: TERM reaps helper and command child
ok 3 - TERM reaps helper and command child
  ---
  duration_ms: 264.795238
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
# duration_ms 1228.706115
TAP version 13
# Subtest: counts passing and failing commands and pins command affinity
ok 1 - counts passing and failing commands and pins command affinity
  ---
  duration_ms: 128.987612
  type: 'test'
  ...
# Subtest: reaps helper after normal exit
ok 2 - reaps helper after normal exit
  ---
  duration_ms: 581.117735
  type: 'test'
  ...
# Subtest: TERM reaps helper and command child
ok 3 - TERM reaps helper and command child
  ---
  duration_ms: 322.303393
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
# duration_ms 1378.049988
TAP version 13
# Subtest: counts passing and failing commands and pins command affinity
ok 1 - counts passing and failing commands and pins command affinity
  ---
  duration_ms: 193.210589
  type: 'test'
  ...
# Subtest: reaps helper after normal exit
ok 2 - reaps helper after normal exit
  ---
  duration_ms: 585.513431
  type: 'test'
  ...
# Subtest: TERM reaps helper and command child
ok 3 - TERM reaps helper and command child
  ---
  duration_ms: 309.923622
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
# duration_ms 1302.948387
TAP version 13
# Subtest: counts passing and failing commands and pins command affinity
ok 1 - counts passing and failing commands and pins command affinity
  ---
  duration_ms: 209.46699
  type: 'test'
  ...
# Subtest: reaps helper after normal exit
ok 2 - reaps helper after normal exit
  ---
  duration_ms: 596.368859
  type: 'test'
  ...
# Subtest: TERM reaps helper and command child
ok 3 - TERM reaps helper and command child
  ---
  duration_ms: 305.962118
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
# duration_ms 1424.964647
TAP version 13
# Subtest: counts passing and failing commands and pins command affinity
ok 1 - counts passing and failing commands and pins command affinity
  ---
  duration_ms: 183.22627
  type: 'test'
  ...
# Subtest: reaps helper after normal exit
ok 2 - reaps helper after normal exit
  ---
  duration_ms: 645.229358
  type: 'test'
  ...
# Subtest: TERM reaps helper and command child
ok 3 - TERM reaps helper and command child
  ---
  duration_ms: 310.270286
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
# duration_ms 1470.800688
under-load: pass 10 of 10
```

## Break checks

- Affinity: controlled unpinned `0-15` fixture failed the equality assertion (`'0-15' !== '0'`); harness result `under-load: pass 0 of 1`.
- PID publication and validation: empty PID marker failed with `invalid command child PID: 0`; harness result `under-load: pass 0 of 1`.
- Trap readiness: delayed trap with the marker wait removed failed with `command child did not receive TERM`; harness result `under-load: pass 0 of 1`.

No extra tests changed.

## Choices

none
