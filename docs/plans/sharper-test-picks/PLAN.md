---
slug: sharper-test-picks
status: ready-for-review   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-25
---

# Sharper test picks

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

## Spec

The law for this change is `CONTRIBUTING.md` at the merge-base; nothing here edits it.

### S1. Link walk in the picker (`test-support/pick-tests.js`)

Today a changed source file is matched by a test only through `byName` or a literal
relative import written in the test itself (`pick-tests.js:61-74`). Replace the import
half of that with a link walk. `byName`, the map, fan-out, the fallbacks (including rule
6), output format and every CLI option stay as they are.

1. **Files read.** Every file tracked at `head` whose name ends `.js`, `.cjs`, `.mjs`,
   `.sh` or `.py`, read at `head` with one `git cat-file --batch` (not one `git show` per
   file). Other files are link targets but are never read.
2. **Links from a read file F**, each resolved to a set of target paths:
   - **Import:** today's regex (`pick-tests.js:67`), resolved relative to F's directory;
     targets are the resolved path, `+.js`, `+.json`, `+/index.js` (as today, line 70).
   - **Relative literal:** any single-, double- or back-quoted string literal (no `${`,
     no whitespace, at most 200 characters) starting `./` or `../`, resolved the same way
     as an import. This covers `require(process.env.X || '../service')`
     (`machine/test/char-service-branches.test.js:7`) and
     `path.resolve(__dirname, '../../codex/model.sh')`.
   - **Named literal:** any such literal not starting `./` or `../`, containing no `..`
     segment, whose last `/`-separated segment has an extension (`/\.[A-Za-z0-9]+$/`).
     After stripping a leading `/`, its targets are every node whose path equals it or
     ends with `/` + it. So `'server.js'` in `path.join(__dirname, '..', 'server.js')`
     targets every tracked `server.js`; over-matching only makes picks larger.
   - A target counts only if it is a **node**: a path tracked at `head`, or one of the
     changed paths. Links to other paths are dropped.
3. **Roots:** every top-level `viewer/test/*.test.js`, `machine/test/*.test.js` and (new,
   Decision 6) `viewer/test/*.spec.js` tracked at `head`. `test-support/test/*` stays
   outside the walk, as today (its suite is fanned out for any `test-support/` change).
4. **Walk:** breadth-first from each root over links, with a visited set (the tree has
   import cycles, MAP.md). A root reaches a changed path P when P is a target of any
   visited file's link, or P is a visited file.
5. **Selection** for each changed path P that today's code would scan (not under any
   `test/` directory, not under `docs/`; `pick-tests.js:61`):
   - A Node test root reaching P is selected with reason `import` if P is a direct
     import target of that root (today's case), else `link`. Either sets `mapped` and
     `covered`, as `byImport` does today.
   - A spec root reaching P is selected in `viewer-browser` with reason `link` and sets
     `mapped` and `covered`, **unless P is a front-end file** (rule 6's test,
     `pick-tests.js:91`): front-end files are never matched by the walk for specs, and
     their Node-test matches still do not stop rule 6's fallback.
   - Changed test files keep selecting only themselves (`pick-tests.js:57-59`).
6. **Speed:** `node test-support/pick-tests.js --base HEAD~1` finishes in under 5 s on
   this repository on an idle machine.

### S2. Stale map check (`test-support/test/pick-tests.test.js`)

A new test reads the working `test-support/test-map.json` and the files tracked at the
checkout's `HEAD` commit (`git ls-tree -r --name-only HEAD`; the index and working tree do not count), and fails listing every entry where: a `tests` item
is neither one of the picker's suite names (`pick-tests.js:20-28`) nor a tracked file
the picker recognises as a test (`viewer/test/*.test.js`, `viewer/test/*.spec.js`,
`machine/test/*.test.js`); or the `glob`, compiled with the picker's glob rules
(`pick-tests.js:35-43`), matches no tracked file. The message names each bad entry by its
`glob` and the bad target. To share the glob and suite rules rather than copy them,
`pick-tests.js` exports them (for example `module.exports = { glob, suites, testSuite }`
when required, running the CLI only when it is the main module); the CLI's behaviour does
not change. The map has no stale entries today (MAP.md), so the test passes on landing.

### S3. Picker tests (`test-support/test/pick-tests.test.js`)

Existing cases keep passing unchanged. Add:

- Fixture repo cases: a source reached only through a two-step helper chain with a cycle
  selects the root test with reason `link` and no whole-suite fallback; a file named as a
  literal in a helper (`path.join(__dirname, '..', 'tool.js')`) and a file it imports are
  both reached; a relative literal in a computed `require` is reached; a spec root
  reaching a server-side file selects that spec; a front-end file reached by a spec still
  falls back to the whole browser suite when unmapped.
- Real-tree cases added to the existing list (`pick-tests.test.js:48-57`):
  `machine/lib/tool-bridge.js` selects `machine/test/folder-tools-run.test.js`;
  `machine/service.js` selects `machine/test/char-service-branches.test.js`;
  `codex/model.sh` selects at least one of the split round-trip files from S4.
- The S2 map check.

### S4. Split the slow machine test file

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
- No JavaScript parser: links are lexical, and a file reached only by a name built at run
  time can be missed; the full run before each push covers it (Decision 4).

### Validation

```bash
node --test test-support/test/pick-tests.test.js
node --test machine/test/connectors-model-roundtrip-*.test.js
time node test-support/pick-tests.js --base HEAD~1 >/dev/null     # under 5 s (S1.6)
node test-support/pick-tests.js --base <comparison commit> --json  # sanity: picks for this branch
```

The split files, run together with the command above on an idle machine, finish in
under 150 s wall (S4), against about 292 s for the old file.

Full-run check (IDEA "What good looks like", last bullet): the full run for the built
commit, already started by the pusher, writes `summary.txt`. Its `machine` seconds are
below its `viewer-browser` seconds, and the slowest suite's seconds are below 561
(9 min 21 s).

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

### Round 1 — 2026-11-25

**Lanes:** claude (intent); other family (mechanics); cross-family: yes.

**Changed since Round 0:** n/a (first round — whole Spec in scope)

| Lane | Reported | Finding | Lead verdict | Resolution |
|------|----------|---------|--------------|------------|
| intent | major | Following links fully makes most targeted picks much larger (e.g. `viewer/app/sessions.js` 16 viewer-node tests today → 73 + 51 specs); only whole-suite fallbacks narrow. Decision 6's rationale is wrong: these files run no specs today | user-decision | Asked Collin how to proceed with the picker change |
| intent | major | No check that picks get narrower on the real tree | upheld | Waits on the picker decision |
| intent | minor | Full-run speed goal not measured | upheld | Validation: full-run summary check |
| intent | minor | Named-literal suffix matching crosses components (`server.js`, `model.sh`) | upheld | Waits on the picker decision |
| mechanics | blocking | `machine/lib/hook-post.js`: walk suppresses the machine fallback but misses `pi-turns.test.js`, which reaches it via `machine/hook.sh:8` `"$root/machine/lib/hook-in.js"` | upheld | Waits on the picker decision; shows lexical links miss real readers when they narrow a fallback |
| mechanics | blocking | S4 moved `roundTrip`'s relative paths break one level down | upheld | S4 allows exactly those three path changes |
| mechanics | minor | S2 says HEAD but names `git ls-files` (index) | upheld | S2 uses `git ls-tree -r --name-only HEAD` |
| mechanics | minor | `codex/model.sh` real-tree case is satisfied by the whole-suite map | upheld | Waits on the picker decision |
| mechanics | minor | 5.5 MB batch read overflows the default `execFileSync` buffer | upheld | Waits on the picker decision |
| mechanics | minor | `connectors/README.md:334` names the deleted file | upheld | S4 updates the router line |
| mechanics | minor | Full-run criteria not measured | declined | Duplicate of the intent full-run finding, fixed there |

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
