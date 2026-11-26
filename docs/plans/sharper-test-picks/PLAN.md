---
slug: sharper-test-picks
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-25
---

# Sharper test picks

(Scope after Decision 8: the stale-map check and the machine-suite split; the picker's choices do not change.)

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows.

## Open Questions

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

Append-only. A reversal is a new entry superseding the old, never an edit.

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| 1 | Mode is thorough | Collin picked it on the mode card | user |
| 2 | Machine suite speed-up is in scope | Collin picked "Include it" | user |
| 3 | The map check is a test in `test-support/test/pick-tests.test.js` against the real tracked tree and the working `test-map.json`, failing with a message naming each entry whose test target is a missing file or unknown suite, or whose glob matches no tracked file | Runs with the test-support suite the picker already selects for picker changes; the map has no stale entries today (MAP.md), so it passes on landing | defaulted |
| 4 | Files named as text in tests and helpers count as links, like imports: a spawned or path-read file, and everything it imports, is covered by the tests that name it (directly or through a helper) | Collin picked "Names count as links" over deeper-imports-only-for-unnamed-files and a hand-kept list; it covers the server and machine scripts the map found without anyone maintaining entries, and the full run before each push catches a name built only at run time | user |
| 5 | Speed up the machine suite by splitting `machine/test/connectors-model-roundtrip.test.js` into several files that node runs side by side, assertions unchanged; `codex/model.sh` is not changed | Collin picked "Split it up"; the file is about 292 s of a 292 s suite wall time | user |
| 6 | Browser specs become roots of the link walk for every changed file except front-end files; front-end files keep rule 6 (browser coverage only through the map) | Specs start the server through `viewer/test/helpers/*`, so without them as roots a deeper link would switch off today's browser fallback for server-side files and run fewer browser specs than today | defaulted |
| 7 | `test-support/full-run.sh` scheduling is unchanged | After the split the machine suite is about 2 min and runs after viewer-node (about 1.5 min) while the browser suite (about 6 min) runs in parallel, so the browser suite becomes the longest part without any reordering | defaulted |
| 8 | Leave the picker's choices as they are: the link walk (Decisions 4 and 6) is dropped and "smaller picks" moves to IDEA's Not doing | Collin picked "Leave the picker" after round 1 showed the walk mostly enlarges picks and text-based links miss real readers (`machine/hook.sh:8`); supersedes Decisions 4 and 6 | idea-change |

## Spec

The law for this change is `CONTRIBUTING.md` at the merge-base; nothing here edits it.

### S1. Stale map check

`test-support/pick-tests.js` exports a pure function `staleEntries(map, files)`: `map` is
the parsed `test-map.json` array, `files` the tracked paths. It returns one item per
problem, `{ glob, target, problem }`, for every entry where a `tests` item is neither one
of the picker's suite names (`pick-tests.js:20-28`) nor a path in `files` the picker
recognises as a test (`testSuite`, `pick-tests.js:31`) (`target` is that item), or where
the `glob`, compiled with the picker's glob rules (`pick-tests.js:35-43`), matches no
path in `files` (`target` is null). Additive and ordinary entries are both checked. To
export it, the CLI body runs only when `require.main === module`; the CLI's behaviour and
output do not change.

Two new tests in `test-support/test/pick-tests.test.js`:

- **Real tree:** reads the map and the file list from the same commit, `HEAD`, as the
  picker does (`git show HEAD:test-support/test-map.json`, `git ls-tree -r --name-only
  HEAD`), and asserts `staleEntries` returns nothing; on failure the message lists each
  item's glob and target. The map has no stale entries today (MAP.md), so it passes on
  landing.
- **Fixture:** a map with one entry naming a missing test file, one naming an unknown
  suite, one whose glob matches nothing, and one valid entry; asserts exactly the three
  bad entries are returned, each with its glob and target.

Existing tests in that file keep passing unchanged. A test deletion or rename that leaves
a stale entry does not select the test-support suite in targeted picks (a changed test
selects only itself, `pick-tests.js:59`), so the failure first shows in the full run
before the push; that is the intended place.

### S2. Split the slow machine test file

`machine/test/connectors-model-roundtrip.test.js` (about 292 s alone; its three tests ran
120 s, 118 s and 54 s in one timed run) becomes several top-level
`machine/test/connectors-model-roundtrip-*.test.js` files plus one shared non-test module
`machine/test/helpers/model-roundtrip.js` holding `roundTrip` and `slots`. Moving them
one directory down means three paths gain one `..`: the `codex/model.sh` spawn path and
the `test-support/run-dir` and `connectors` requires (`connectors-model-roundtrip.test.js:7-8,19`).
Those path changes are the only edits to the moved code.
One `roundTrip` call per test, each in its own file:

- the real-connector round trip (today's first test);
- each of the six invalid-sixth-connector cases (today's second test, lines 83-93), one
  file each, with the same mutation and the same expected error pattern;
- the sixth connector with defaults, and the sixth connector with `none` defaults (today's
  third test), one file each.

Every assertion, mutation and error pattern stays as it is; no case is dropped. Each test
keeps `timeout: 120000`. The old file is deleted. `bash machine/test/run.sh` still finds
every new file through its `*.test.js` glob. `connectors/README.md:334` names the old
file; it is updated to name `machine/test/connectors-model-roundtrip-*.test.js` and the
shared helper, with the sentence otherwise unchanged.

### Non-goals

- No change to `codex/model.sh`, `test-support/full-run.sh`, `machine/test/run.sh`,
  `test-map.json` entries, suite lists, or the browser and viewer Node suites.
- No change to which tests `pick-tests.js` selects for any change (Decision 8).

### Validation

```bash
node --test test-support/test/pick-tests.test.js
node --test machine/test/connectors-model-roundtrip-*.test.js
```

The split files, run together with the command above on an idle machine, finish in
under 150 s wall (S2), against about 292 s for the old file.

Full-run check (IDEA "What good looks like", last bullet): the full run for the built
commit, already started by the pusher, writes `summary.txt`. `full-run.sh` runs
`viewer-browser` alongside the other suites, which run one after another
(`test-support/full-run.sh:84-105`), so the run's length is the larger of the
`viewer-browser` seconds and the sum of every other suite's seconds. That length is under
480 s (8 min, against 561 s before), and the `machine` seconds are below the
`viewer-browser` seconds.

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|
| The S1 real-tree check lists files with `git ls-tree` without `-z`, so a tracked name with unusual characters is quoted and a glob for it could be reported stale | No such names in the tree; rare path (`realism.md`) | review-round-2 |

## Review Rounds

### Round 1 — 2026-11-25

**Lanes:** claude (intent); other family (mechanics); cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Following links fully makes most targeted picks much larger (e.g. `viewer/app/sessions.js` 16 viewer-node tests today → 73 + 51 specs); only whole-suite fallbacks narrow. Decision 6's rationale is wrong: these files run no specs today | user-decision | Collin chose to leave the picker (Decision 8); S1 link walk removed |
| intent | major | No check that picks get narrower on the real tree | upheld | Moot: link walk removed (Decision 8) |
| intent | minor | Full-run speed goal not measured | upheld | Validation: full-run summary check |
| intent | minor | Named-literal suffix matching crosses components (`server.js`, `model.sh`) | upheld | Moot: link walk removed (Decision 8) |
| mechanics | blocking | `machine/lib/hook-post.js`: walk suppresses the machine fallback but misses `pi-turns.test.js`, which reaches it via `machine/hook.sh:8` `"$root/machine/lib/hook-in.js"` | upheld | Moot: link walk removed (Decision 8); showed lexical links miss real readers when they narrow a fallback |
| mechanics | blocking | S4 moved `roundTrip`'s relative paths break one level down | upheld | S2 (then S4) allows exactly those three path changes |
| mechanics | minor | S2 says HEAD but names `git ls-files` (index) | upheld | S1 (then S2) uses `git ls-tree -r --name-only HEAD` |
| mechanics | minor | `codex/model.sh` real-tree case is satisfied by the whole-suite map | upheld | Moot: link walk removed (Decision 8) |
| mechanics | minor | 5.5 MB batch read overflows the default `execFileSync` buffer | upheld | Moot: link walk removed (Decision 8) |
| mechanics | minor | `connectors/README.md:334` names the deleted file | upheld | S2 (then S4) updates the router line |
| mechanics | minor | Full-run criteria not measured | declined | Duplicate of the intent full-run finding, fixed there |

### Round 2 — 2026-11-25

**Lanes:** claude (intent); other family (mechanics); cross-family: yes.

**Changed since Round 1:**
- Decision 8: the picker link walk (old S1) and its tests (old S3) are removed; IDEA.md's What, Why, What good looks like and Not doing updated to match (`idea-change`).
- Old S2 is now S1 (stale map check), reading `git ls-tree -r --name-only HEAD`.
- Old S4 is now S2 (split): the three relative paths that gain one `..`, and the `connectors/README.md:334` router update.
- Validation: picker timing commands removed; full-run summary check added.

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| mechanics | blocking | Full-run check passes a run as long as before: summary has per-suite times and "slowest suite below 561" ignores the serial chain | downgraded | Minor: a validation weakness, it would not build the wrong thing or stop a worker. Fixed: length = max(browser, sum of the rest) < 480 s |
| mechanics | minor | S1 tested only against a valid map | upheld | S1: `staleEntries` plus a fixture with three bad entries |
| mechanics | minor | Rare path: `git ls-tree` quotes unusual file names | accepted-risk | Rare path; see Accepted Risks |
| intent | minor | Full-run check doesn't measure the total | declined | Duplicate of the mechanics full-run finding, fixed there |
| intent | minor | S1 read the working map against the HEAD tree; uncommitted entries fail falsely | upheld | S1 reads both at `HEAD` |
| intent | minor | Decision 3 implies targeted picks catch stale entries; they don't | upheld | S1 says the failure first shows in the full run |

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
