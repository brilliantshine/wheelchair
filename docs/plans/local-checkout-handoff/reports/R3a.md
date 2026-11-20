# R3a — in-the-way path parsing

Updated `machine/lib/try.js` to share `wayPaths` across Try and Back. It reads indented paths after Git `error:` headers ending in `:`, limits displayed paths to 50 with an additional-count phrase, and ensures nothing-moved outcomes use the specified timeout, Git error, or plain fallback sentence. Updated `machine/test/try.test.js` with the Aborting-only fallback check and ignored-directory/file collision reproductions for Try and Back; both assert the saved file remains intact and HEAD does not move.

## Validation

`node --test machine/test/try.test.js`

```text
exit 0
1..69
# tests 69
# suites 0
# pass 69
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 32731.71619
```

`bash machine/test/run.sh`

```text
exit 0
1..414
# tests 414
# suites 0
# pass 414
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 30524.521856
```

## Files changed

- `machine/lib/try.js`
- `machine/test/try.test.js`
- `docs/plans/local-checkout-handoff/reports/R3a.md`

## Choices

none
