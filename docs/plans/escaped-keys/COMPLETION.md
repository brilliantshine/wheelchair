---
slug: escaped-keys
date: 2026-11-26
implemented-by: "heavy / gpt-6.2-sol (T1 attempt 4); earlier attempts standard / gpt-6.1-terra at medium, high, xhigh, not merged"
verified-by: []
---

# Completion Report — Hide keys printed in escaped form

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| E1 escapes of one character (`\uXXXX`, `\xXX`, `\c`, `%XX`, hex either case, `u`/`x` lower only) | this run | `machine/lib/key-spell.js:27` (`spellings`, local parses), `:336` (`sequences` for edges) | `machine/test/key-redact.test.js:40` |
| E1 layers up to three, mixed order | this run | `machine/lib/key-spell.js:47` (`at(level,pos)` recursion over level-1 pieces) | `machine/test/key-redact.test.js:48` (E1 examples; four-layer `%2525252B…` left unchanged) |
| E1 a key's spellings, every start, overlaps, never decode first | this run | `machine/lib/key-spell.js:205` (`forward`, per-key index bitsets), `:148` (`finishRecords`, backward marking) | `machine/test/key-redact.test.js:59` (`progress=100%41CD%2BEFGH`, overlap, `dir\ABCDEFGHIJKL`) |
| E1 no `%`/`\` byte → today's plain path | this run (old code kept as `plainCapture`) | `machine/lib/key-redact.js:8`, `:54-55` | existing tests in `machine/test/key-redact.test.js`; `machine/test/key-redact.test.js:65` |
| E1 shared work budget and fallback (`[not checked for keys]`, plain keys, K4 trim, both-edges rule, runs on capture as captured) | this run | `machine/lib/key-redact.js:6` (64M units), `:28` (`markUnchecked`), `:66-80` | `machine/test/key-redact.test.js:100` (all five Validation cases, `workBudget: 1`) |
| E1 pinned speed fixtures (o), (a)-(d) | this run | `machine/test/key-redact.test.js` (moved there in Remediation 1; was `key-redact-speed.test.js`) | evidence below |
| E2 cut end: longest proper beginning of a spelling | this run | `machine/lib/key-spell.js:378` (`prefixes`), `:411` (`cutEndPosition`) | `machine/test/key-redact.test.js:75` |
| E2 cut start: longest proper ending of a spelling | this run | `machine/lib/key-spell.js:349` (`tails`), `:205` (`forward` with tail seeds) | same test; `machine/test/key-redact.test.js:88` |
| E2 larger of K4 trim and stretch; one `[output cut]` per edge; both edges cut and all escape-like → dropped whole | this run | `machine/lib/key-redact.js:58-64`, `:73-75`, `:82-93` | `machine/test/key-redact.test.js:75` (`[output cut][output cut]`) |
| E3 order: search on capture as captured, render once; overlap across a removed edge | this run | `machine/lib/key-spell.js:470` (`findSpellings`), `machine/lib/key-redact.js:82-93` | `42%43DEFGHIJKLM rest` → `[output cut][key] rest` in `machine/test/key-redact.test.js:75` |
| E3 1 MiB cut and 4 KiB stderr tail unchanged in `tool-run.js` | pre-existing | `machine/lib/tool-run.js:37-41` (not changed) | runner tests in `machine/test/key-redact.test.js` |
| Runner fixtures (timeout, 64 KiB stderr, end-to-end `AB+CD/EF=GH`), failing with the old redactor | this run | — | `machine/test/key-redact.test.js:109`, `:120`, `:132`; old-redactor failures pasted in `reports/T1.md` (3 fail) |
| E4 guide sentence | this run | `protocol/tools.md:70` | greps below; read as rendered |

## Deviations from plan

None against the Spec as amended. The E1 speed limits changed during verification (PLAN.md Decision 13, the lead's choice): they are CPU time of the `redactCapture` call, (o) under 3 s and (a)-(d) under 10 s, as a hang guard. Quiet-machine CPU times: (o) about 0.17 s, (a) 0.49 s, (b) 0.77 s, (c) 0.81 s, (d) 0.78 s; under the parallel full run (c) reached about 3.4 s CPU. Fixture details the Spec left open are logged as worker choices in PLAN.md (fixture spelling generator uses `\c` and lowercase `%hh` only; (o)'s five spellings sit on their own lines at the end of the JSON).

## Routers

`machine/AGENTS.md`: new row for `lib/key-spell.js` (finds escaped key spellings and cut-edge pieces within a shared budget). No ownership moved.

## Validation evidence

Merged tip `dee08033`.

`node --test machine/test/key-redact.test.js machine/test/folder-tools-run.test.js machine/test/name-guard.test.js`:

```text
# tests 45
# suites 0
# pass 45
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 16374.154386
```

`node --test machine/test/key-redact-speed.test.js` (no fallback in (o), (c), (d): asserted by exact output):

```text
# (o) redaction: 82.1 ms
# (a) redaction: 404.1 ms
# (b) redaction: 448.2 ms
# (c) redaction: 809.1 ms
# (d) redaction: 745.3 ms
# tests 5
# pass 5
# fail 0
```

Worker's slowest of three, and under the parallel machine suite: (o) 94/177 ms, (a) 448/1196 ms, (b) 476/1011 ms, (c) 921/2580 ms, (d) 808/1778 ms (`reports/T1.md`). Work used: (c) 22.3M of the 64M budget; (b) reaches the budget and falls back.

E4: `grep -n -i "never print or log a key" protocol/tools.md` → line 70; `grep -n "not yet" protocol/tools.md` → no match (exit 1).

`node test-support/pick-tests.js --base 672764aeaa4a1170c7cd6d15af0cfb9673ced4e2` selects every suite (the `protocol/**` rule); the full run is the lead's before push.

## Known gaps / residual risks

- Fixture (c) took 2.58 s of its 3 s limit while the whole machine suite ran in parallel; a slower or busier machine could trip that timing assertion. The redaction result does not depend on timing.
- The worker reports `install/test/run.sh:705` ("real wheelchair directory is byte-identical after suite") failing twice. That check compares the live `~/.wheelchair` tree before and after the suite, which live sessions on this machine write to; this change touches no installer file. Not confirmed against main here.
- Accepted risk unchanged: the plain-key scan on one repeated character with long overlapping keys (PLAN.md Accepted Risks).

## Remediation rounds

### Remediation 1 — 2026-11-26

Verification attempt 1 (`9f2ed5da`): verifier PASS; the full run on that commit failed `machine` ((c) 4752 ms and (d) 4702 ms wall against 3000 ms; output correct), `install` and `viewer-node`. Gap list and judgment in `REMEDIATION-1.md`.

- R1-T1 (light / gpt-6-luna): the five speed fixtures moved into `machine/test/key-redact.test.js` (so the Spec's command runs them) and are checked by CPU time; `key-redact-speed.test.js` deleted.
- `install` (`real wheelchair directory is byte-identical after suite`): the same test fails with the same error at the comparison commit `672764ae` (a `git archive` copy). Already on main.
- `viewer-node` (`viewer/test/app-quiet.test.js:41`, `6 message clears debt`): this change touches no viewer file; the file passes 27/27 alone. To be rechecked by the next full run.

Spec validation command after the fix (exit 0):

```text
# (o) redaction: 344.4 ms CPU, 340.4 ms wall
# (a) redaction: 1360.9 ms CPU, 1435.2 ms wall
# (b) redaction: 1497.9 ms CPU, 1242.9 ms wall
# (c) redaction: 2152.7 ms CPU, 2178.8 ms wall
# (d) redaction: 2298.6 ms CPU, 2418.2 ms wall
# tests 50
# pass 50
# fail 0
```

### Remediation 2 — 2026-11-26

Verification attempt 2 (`9ccd916d`): verifier FAIL, one gap: (c) over its 3000 ms CPU limit under parallel load (3164-3417 ms CPU), also in the full run. It survived Remediation 1; the lead chose option A (PLAN.md Decision 13). Gap list in `REMEDIATION-2.md`.

- R2-T1 (light / gpt-6-luna): the `timed` limits in `machine/test/key-redact.test.js` set to 3000 ms for (o) and 10000 ms for (a)-(d).
- Full-run failures in files this change does not touch, left to the lead's full run against main: viewer-node `6 message clears debt` (`viewer/test/app-quiet.test.js:41`, in both full runs) and `archive through the hub cancels a stalled upload to the real machine`; test-support `HUP stops both suites`.

Spec validation command after the fix (exit 0):

```text
# (o) redaction: 315.1 ms CPU, 244.4 ms wall
# (a) redaction: 1407.4 ms CPU, 1387.5 ms wall
# (b) redaction: 1223.2 ms CPU, 740.9 ms wall
# (c) redaction: 2762.9 ms CPU, 2855.5 ms wall
# (d) redaction: 2004.3 ms CPU, 1998.1 ms wall
# tests 50
# pass 50
# fail 0
```
