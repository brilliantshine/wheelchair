# T1f — auto-focus survives a transient window vanishing

## Changes

- `machine/lib/screen-input.js`: preserve `timedOut` on tool errors; strict window enumeration now skips failed child probes that did not time out, while timed-out probes still fail the operation.
- `machine/test/screen-input.test.js`: cover a vanished middle child in `windowIds` and a vanished sibling while auto-focus discovers and focuses a new window.

## Validation

`for i in 1 2 3; do node --test machine/test/screen-input.test.js > "$SCRATCH/t1f-$i.log" 2>&1; echo "run $i exit $? $(grep -E '^# (pass|fail)' "$SCRATCH/t1f-$i.log" | tr '\n' ' ')"; done`

```text
run 1 exit 0 # pass 12 # fail 0
run 2 exit 0 # pass 12 # fail 0
run 3 exit 0 # pass 12 # fail 0
```

`bash machine/test/run.sh > "$SCRATCH/t1f-all.log" 2>&1; echo "exit $?"; grep -E '^# (pass|fail)' "$SCRATCH/t1f-all.log"`

```text
exit 0
# pass 205
# fail 0
```

`git diff --stat wc/940599e3df66...HEAD`

```text
(no output)
```

## Could not do

None.

## Choices

none
