# Remediation 1 — project-tools-solid

Verification attempt 1 on `23cfa5f`: Claude verifier PASS; GPT verifier FAIL with two gaps (no duplicates between reports). Manual hearth checks passed under both.

## Gaps (verbatim)

1. GAP: §§3–4, duplicate HTTP headers — Repeating the exact same header key in `.mcp.json` silently keeps the last value and enables the server. The reader parses the object before either adapter checks for duplicates. A fixture with two `X-Fixture` keys produced zero warnings and an enabled server on both CLIs.
2. GAP: §6, unreadable saved state — The loader accepts valid JSON with an invalid state shape. A saved `null` aborts the start before tmux launch, and a saved `{}` produces `seq: null`. Both should fall back to empty state and return `seq: 1` on the next start.

Also noted by both verifiers, not counted as a gap: `machine/test/project-tools-state.test.js` "tmux PATH, timeout and unset fallback drive program checks" failed once under the full suite with `tmux buffer failed`; hardened in R2. (`viewer/test/app-quiet.test.js` "6 message clears debt" flaked once; not touched by this branch.)

## Tasks

### R1

# Task R1 (remediation 1) — catch a header written twice with the exact same name

Gap from verification (verbatim): "§§3–4, duplicate HTTP headers — Repeating the exact same header key in `.mcp.json` silently keeps the last value and enables the server. The reader parses the object before either adapter checks for duplicates. A fixture with two `X-Fixture` keys produced zero warnings and an enabled server on both CLIs."

Spec §3 and §4: two header names equal ignoring case → skip with "has the same header twice". `JSON.parse` keeps only the last of two identical keys, so the adapters' case-insensitive check never sees the exact duplicate.

Ownership boundary: `machine/lib/project-mcp.js`, `machine/adapters/codex.js`, `machine/adapters/agy.js`, `machine/test/project-mcp-reader.test.js`, `machine/test/project-mcp-codex.test.js`, `machine/test/project-mcp-agy.test.js`, your report (`docs/plans/project-tools-solid/reports/R1.md`). Touch nothing else.

## Exactly what to build
1. In `machine/lib/project-mcp.js`, export `DUPLICATE_HEADERS = Symbol('duplicate headers')`.
2. Add a function `duplicateHeaderServers(text)` in the same file returning a `Set` of server names. It walks the JSON text (already known valid, because `JSON.parse` succeeded) with a small recursive-descent scanner that tracks the key path. For every object value found at path `mcpServers` → `<server name>` → `headers` (each occurrence separately), it collects that object's keys (decode each key token with `JSON.parse` of the string token so escapes like `X` compare correctly) and, if two keys are equal after `toLowerCase()`, adds `<server name>` to the set. It ignores everything else. No regex parsing of JSON.
3. In `readProjectMcp`, after the existing validation, for each server kept in `servers` whose name is in that set and whose `type` is `http` or `sse`, set `entry[DUPLICATE_HEADERS] = true` (a symbol key: it is not enumerable by `Object.keys` and not written by `JSON.stringify`).
4. In `machine/adapters/codex.js` and `machine/adapters/agy.js`, the existing duplicate-header check also fires when `entry[DUPLICATE_HEADERS]` is true (same position in the check order, same reason text "has the same header twice").

## Tests
Reader: a file with two exact `X-Fixture` keys in one http server's headers marks that server (and only that one); `Authorization` + `authorization` marks it; an escaped duplicate (`"X"` and `"X"`) marks it; duplicates in an `env` object or at other paths do not mark; the mark does not appear in `JSON.stringify(entry)` or `Object.keys(entry)`. Codex and Antigravity: a server read from such a file (use `readProjectMcp` on a temp file, or set the symbol on the entry) is skipped with `<name>: skipped on Codex: has the same header twice` / `... on Antigravity: has the same header twice`; no `--add-dir`/overrides for it.

## Validation
```
node --test machine/test/project-mcp-reader.test.js machine/test/project-mcp-codex.test.js machine/test/project-mcp-agy.test.js
bash machine/test/run.sh
```

### R2

# Task R2 (remediation 1) — saved project-tools state with the wrong shape, and a flaky test

Gap from verification (verbatim): "§6, unreadable saved state — The loader accepts valid JSON with an invalid state shape. A saved `null` aborts the start before tmux launch, and a saved `{}` produces `seq: null`. Both should fall back to empty state and return `seq: 1` on the next start."

Spec §6: "Loaded from disk on first use after a service start (a missing or unreadable file means empty state with `seq` 0)."

Ownership boundary: `machine/service.js` (only `updateProjectTools`'s loading code and a helper next to it), `machine/test/project-tools-state.test.js`, your report (`docs/plans/project-tools-solid/reports/R2.md`). Touch nothing else.

## Exactly what to build
1. In `machine/service.js` `updateProjectTools`, after `JSON.parse` of `<stateDir>/project-tools/<id>.json`, accept the loaded value only if it is a plain object (not null, not an array) with `seq` a non-negative safe integer, `file` and `programs` arrays of lines, and `clis` a plain object whose every value is a plain object with `lines` an array of lines, `thread` a boolean and `hash` a string or null. A line is a plain object with `names` an array of strings and `text` a string. Anything else → `{ seq: 0, file: [], programs: [], clis: {} }`, exactly as for a missing file. Put the check in a small pure function (e.g. `validProjectToolsState(value)`) beside `updateProjectTools`.
2. Harden the flaky test: both verifiers saw `tmux PATH, timeout and unset fallback drive program checks` (`machine/test/project-tools-state.test.js`) fail once under the full parallel suite with `tmux buffer failed` (the fake tmux's `load-buffer` failing during the initial-message submit), and pass on rerun. Find the cause in the test's fake tmux (for example the `hang` setting leaking into calls other than `show-environment`, or the fake failing on `load-buffer` under load) and fix it in the test file, without weakening what the test checks. Explain the cause in your report. Then run the full suite three times.

## Tests
Saved `null`, `{}`, `[]`, `{"seq":-1,...}`, `{"seq":"3",...}` and a state with a malformed line each give the next start `project_tools.seq === 1` with empty lists, and the start launches. A valid saved state still loads (next seq = saved seq + 1).

## Validation
```
node --test machine/test/project-tools-state.test.js
bash machine/test/run.sh   # three times; paste the three summaries
```
