# T1e — wait for launcher calls

## Changes

- `machine/test/screen.test.js`: added `waitForCall` and used it for the two detached `systemd-run` launcher lookups (`app` and `--help`). The `xdotool windowfocus` assertion after a detached app launch now waits for its log entry too. Other lookups are for awaited service calls or already poll for the call.

## Validation

`for i in 1 2 3 4 5; do node --test machine/test/screen.test.js > "$SCRATCH/t1e-$i.log" 2>&1; echo "run $i exit $? $(grep -E '^# (pass|fail)' "$SCRATCH/t1e-$i.log" | tr '\n' ' ')"; done`

```text
run 1 exit 0 # pass 19 # fail 0
run 2 exit 0 # pass 19 # fail 0
run 3 exit 0 # pass 19 # fail 0
run 4 exit 0 # pass 19 # fail 0
run 5 exit 0 # pass 19 # fail 0
```

`bash machine/test/run.sh > "$SCRATCH/t1e-all.log" 2>&1; echo "exit $?"; grep -E '^# (pass|fail)' "$SCRATCH/t1e-all.log"`

```text
exit 0
# pass 203
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
