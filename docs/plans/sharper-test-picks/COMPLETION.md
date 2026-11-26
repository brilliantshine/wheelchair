---
slug: sharper-test-picks
date: 2026-11-25
implemented-by: "T1 standard (gpt-6.1-terra); T2 light (gpt-6-luna); sub-lead claude-opus-5-5"
verified-by: []
---

# Completion Report — Sharper test picks

Written for a hostile reviewer: every claim checkable, no claim without evidence.

Comparison commit (merge-base with `main`): `6802372cdc5c1af28742818c90732cd3a83d4f3c`.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| S1 `staleEntries(map, files)` pure export, returns `{ glob, target, problem }` per missing/unknown test target or unmatched glob, additive and ordinary entries both checked | this run | `test-support/pick-tests.js:27` (function), `:44` (export); reuses the picker's `glob` and `testSuite`, now at module scope | `test-support/test/pick-tests.test.js:85` |
| S1 CLI body runs only when `require.main === module`; CLI behaviour and output unchanged | this run | `test-support/pick-tests.js:46` | Scout ran base and new CLI on identical inputs (`--full`, `--base … --head …`, `--json`, bad usage): identical output and exit codes; existing tests 1–13 in `pick-tests.test.js` unchanged and pass |
| S1 real-tree test: map and file list both from `HEAD`, asserts nothing stale, failure message lists glob and target | this run | `test-support/test/pick-tests.test.js:75` | passes (test 14 below); T1 report shows a forced failure printing `glob -> target: problem` |
| S1 fixture test: missing test file, unknown suite, unmatched glob, one valid entry; exactly the three bad entries returned | this run | `test-support/test/pick-tests.test.js:85` | passes (test 15 below) |
| S2 shared helper `machine/test/helpers/model-roundtrip.js` holding `roundTrip` and `slots`; only the three paths gain one `..` | this run | `machine/test/helpers/model-roundtrip.js:6,7,18`, export `:74` | Scout compared with the old file's lines 11–73: only those three paths differ |
| S2 real-connector round trip, own file | this run | `machine/test/connectors-model-roundtrip-real.test.js:6` | passes |
| S2 six invalid-sixth-connector cases, one file each, same mutation and error pattern | this run | `machine/test/connectors-model-roundtrip-invalid-{capital-model,effort,extra-effort,format,missing-light,sublead}.test.js:7` | passes; scout mapped each to old lines 78–83 |
| S2 sixth connector with defaults / with `none` defaults, one file each | this run | `machine/test/connectors-model-roundtrip-sixth.test.js:6`, `machine/test/connectors-model-roundtrip-sixth-none.test.js:6` | passes |
| S2 each test keeps `timeout: 120000` | this run | line 6 or 7 of each of the nine files | grep above |
| S2 old file deleted; `machine/test/run.sh` finds the new files through its glob | this run | file absent; `machine/test/run.sh` unchanged | T2 report: `bash machine/test/run.sh` 836 pass, 2 skipped, 0 fail |
| S2 `connectors/README.md:334` names the new glob and the helper | this run | `connectors/README.md:334` | read |
| S2 split files finish under 150 s wall | this run | — | 62.0 s wall below |
| Full-run check (max(viewer-browser, sum of the rest) < 480 s; machine < viewer-browser) | this run | — | the full run for the verified commit; summary pasted below once it finishes |

## Deviations from plan

- Test names in the split files are new: the six invalid cases carry short labels, the `none` case is "sixth connector with none defaults round trip" (was "sixth connector and none defaults round trip"), and the defaults case is "sixth connector round trip". The Spec did not set names.
- `connectors/README.md:334`: "runs … and checks" became "run … and check" to agree with the plural subject. Otherwise the sentence is unchanged.

## Routers

None. This change moved no ownership, and no router named a file it touched. `machine/test/helpers/` already existed for shared test helpers.

## Validation evidence

On the merged feature branch at `aab9dff8`:

```text
$ node --test test-support/test/pick-tests.test.js     # exit 0
ok 14 - map entries reference tracked files and known suites at HEAD
ok 15 - stale map entries identify missing targets and unmatched globs
# tests 15
# pass 15
# fail 0

$ time node --test machine/test/connectors-model-roundtrip-*.test.js     # exit 0
# tests 9
# pass 9
# fail 0
# duration_ms 61945.664249
real	1m1.973s
```

For the old file the plan measured about 292 s.

## Known gaps / residual risks

- The nine split files run concurrently, and each spawns `codex/model.sh` with its own temp directory and env overrides (from `makeTempSync` in the helper). They ran clean together three times (the worker once, the sub-lead twice) and in the whole machine suite once.
- Accepted Risk from review: the real-tree check uses `git ls-tree` without `-z`.

## Remediation rounds
