# R1a report

Changed `machine/test/try.test.js`: after two dirty Back refusals, the assertion now expects zero kept entries resolving to the commit. The existing assertion after a successful clean Back still expects exactly one.

## Validation

`node --test machine/test/try.test.js`

```text
1..66
# tests 66
# suites 0
# pass 66
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 22287.839198
exit 0
```

`bash machine/test/run.sh`

```text
1..411
# tests 411
# suites 0
# pass 411
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 31469.982971
exit 0
```

## Files changed

- `machine/test/try.test.js`
- `docs/plans/local-checkout-handoff/reports/R1a.md`

## Choices

none
