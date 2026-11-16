---
slug: test-temp-cleanup
date: 2026-11-15
implemented-by: "GPT standard (gpt-6.1-terra): T1, T2, T3, T4; GPT light (gpt-6-luna): T5; sub-lead: Claude opus-5-5"
verified-by: []
---

# Completion Report — Tests clean up their temp folders

Written for a hostile reviewer: every claim checkable, no claim without evidence.

All line references are against the feature branch `wc/25ba351f336d` at the commit this report is
committed in. Worker reports: `docs/plans/test-temp-cleanup/reports/T1.md` … `T5.md`.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| §1 `runDir()`: lazy `<tmpdir>/wheelchair-test-run-<pid>-XXXXXX`, `owner.json` with pid and start, sweep once, handlers once | this run | `test-support/run-dir.js:101-118`; `owner.json` writer `:88-92` (temp name + rename) | helper suite, all cases |
| §1 `makeTemp` / `makeTempSync` | this run | `test-support/run-dir.js:119-120` | helper suite; every converted suite |
| §1 `trackChild(child, {group})`, drops itself on `exit`, rewrites `owner.json` children | this run | `test-support/run-dir.js:121-128` | helper suite "exit kills a tracked running child" |
| §1 `onCleanup(fn)` | this run | `test-support/run-dir.js:129`, run first in `cleanupNow` `:93-100` | used by `machine/test/aside-turns.test.js:22,85,103`; machine suite ×3 pass |
| §1 `cleanupNow()` exported | this run | `test-support/run-dir.js:93-100`, export `:130` | helper suite |
| §1 start time = field 22 of `/proc/<pid>/stat`, parsed after last `)`; null if unreadable | this run | `test-support/run-dir.js:15-21` | code reading (index 19 after the state field = field 22) |
| §2 exit: onCleanup → SIGKILL tracked (group when `group`) → wait ≤2 s, 10 ms `Atomics.wait` polls, gone or `Z` → `rmSync` with retries, else leave; errors swallowed | this run | `test-support/run-dir.js:28-47` (stopped/wait/kill/remove), `:93-100` | helper suite; leak checks below |
| §2 SIGINT/SIGTERM/SIGHUP: same cleanup, remove own listeners, re-raise | this run | `test-support/run-dir.js:107-116` | helper suite (3 signal cases assert `{code:null, signal}` and empty TMPDIR); Interrupt check below |
| §2 aside "real detached groups" test tracks with `group: true` | this run | `machine/test/aside-turns.test.js:54-55` | machine suite |
| §3 step 1 sweep of dead-owner run folders, with the child kill rule (kill only when both start times readable and equal; never otherwise) | this run | `test-support/run-dir.js:48-66` | helper suite "sweep respects owner liveness" (dead owner removed, live sibling kept); Kill check below. The orphan-child and PID-reuse branches have no dedicated test (see gaps) |
| §3 step 2 legacy prefixes, older than 1 h | this run | list `test-support/run-dir.js:7`, rule `:67-77` | helper suite (old `wc-doc-` removed, young kept) |
| §3 step 3 `viewer/test/.tmp` entries older than 1 h | this run (replaces pre-existing `pruneStaleScratch`) | `test-support/run-dir.js:78-86` | `.tmp` count unchanged across full runs (all 696 entries were < 1 h old, from a pre-T3 baseline run at 19:01–19:09) |
| §4 machine conversions | this run | `machine/test/service.test.js:16`; `accounts.test.js:19,42,59`; `aside-turns.test.js:17,45,52,66,78` | grep below returns nothing; machine suite ×3 |
| §4 viewer helper `makeDir` → `makeTemp`, `pruneStaleScratch`/`TMP_ROOT` removed | this run | `viewer/test/helpers/server.js:26-28` | unit + browser suites |
| §4 viewer direct `os.tmpdir()` users | this run | `app-chat`, `app-asides`, `app-slug`, `app-usage`, `app-machines`, `app-hub` `.test.js` (T3 diff); `app-doc.spec.js:22`; `app-threads.spec.js:209,243`; `app-state-queue.test.js:13` (child gets the path as a string) | `grep -rnE "os\.tmpdir\(\)|mkdtemp" machine/test viewer/test` → no matches |
| §5 `startServer`: track; kill and await on startup failure; `stop()` awaits `exit` on every path | this run | `viewer/test/helpers/server.js:59-101` (`waitForExit`, try/catch, stop) | unit + browser suites |
| §5 other test-owned spawns tracked, stop paths await `exit` | this run | `trackedSpawn` wrapper at line 4 of `routes`, `registration`, `lifecycle`, `server`, `app-machines` `.test.js`; e.g. `registration.test.js:28,36,226,273`, `server.test.js:180,923,969`, `app-machines.test.js:148`; `routes.test.js` stop `:46-53`; `pages.spec.js:86,123` with `stopChild` | unit + browser suites |
| §5 machine hook-post/statusline spawns | this run | `machine/test/service.test.js:405,814,819` (`trackChild`) | machine suite |
| §5 aside stores `onCleanup` killing running turns' groups | this run | `machine/test/aside-turns.test.js:22,85,103` | machine suite |
| §6 shell suites INT/TERM/HUP traps | this run | `install/test/run.sh:10`, `codex/test/run.sh:10`, `sensitivity/test/run.sh:9`, `seen/test/hook_test.sh:6`, `seen/test/wording_test.sh:6`, `seen/test/set_test.sh:9` | `bash -n` + each suite exit 0 |
| §6 shell suites' EXIT trap | pre-existing | `install/test/run.sh:9`, `codex/test/run.sh:9`, `sensitivity/test/run.sh:8`, `seen/test/*_test.sh` | each suite exit 0 |
| §6 `aside-probe.sh` removes its folder in its EXIT cleanup, plus signal traps | this run | `machine/test/aside-probe.sh:18-20` | `bash -n` only (the probe drives real CLIs; not run) |
| §7 root `AGENTS.md`: Executable row, Where-to-go row, Verification line | this run | `AGENTS.md:36,56,111` | read |
| §7 `viewer/AGENTS.md`, `machine/AGENTS.md` one line each | this run | `viewer/AGENTS.md:73`, `machine/AGENTS.md:19` | read |
| §7 `.gitignore` keeps `viewer/test/.tmp/` | pre-existing | `.gitignore` | unchanged |
| Validation 1, helper suite | this run | `test-support/test/run-dir.test.js` | 6/6 pass |

## Deviations from plan

- None in behaviour. Two notes:
  - `app-state-queue.test.js` uses a new prefix `state-queue-`. It is allocated inside the run folder, so no legacy-sweep entry is needed.
  - Validation 2's browser leak check leaves `node-compile` and `playwright-transform-cache` in `TMPDIR`. They are external-tool caches, which the plan already puts out of scope.

## Routers

- `AGENTS.md` (root): `test-support/` is listed as Executable, has a Where-to-go row, and its suite is a Verification line.
- `viewer/AGENTS.md`, `machine/AGENTS.md`: each says test temp folders come from `test-support/run-dir.js` and tests never allocate from `os.tmpdir()` directly.
- highways not installed (`command -v highways` found nothing); the other routers were not maintained.

## Validation evidence

Run by the sub-lead on the feature branch after all five merges (HEAD `c93cb06` plus this report). Worktrees have no `viewer/node_modules`, so the viewer suites ran with `NODE_PATH`/`PATH` pointing at the main clone's `viewer/node_modules`; no file was added to the worktree.

Grep (Spec §4):
```
$ grep -rnE "os\.tmpdir\(\)|mkdtemp" machine/test viewer/test; echo grep=$?
grep=1
```

All suites, with a fresh `TMPDIR`:
```
bash sensitivity/test/run.sh exit=0
bash seen/test/run.sh exit=0
bash codex/test/run.sh exit=0
bash install/test/run.sh exit=0
node --test test-support/test/run-dir.test.js exit=0
machine run 1 exit=0 # pass 96 # fail 0
machine run 2 exit=0 # pass 96 # fail 0
machine run 3 exit=0 # pass 96 # fail 0
viewer unit exit=1 # pass 374 # fail 2
not ok 257 - a starter that loses the freed port registers through the new holder
not ok 285 - an app page carries font-src self and the font route serves only the allowlist
TMPDIR entries: 0
.tmp before=696 after=696
```

Browser suite, fresh `TMPDIR`, compared with a baseline worktree whose viewer tests are unchanged (`wc-25ba351f336d-w3`: T1 plus a T2 duplicate, no viewer changes):
```
== feature branch                                  == baseline
  4 failed                                           5 failed
  [chromium] app-fonts.spec.js:13                    [chromium] app-fonts.spec.js:13
  [chromium] browser.spec.js:2395 (arrow routing)    [chromium] browser.spec.js:2395
  [firefox]  app-fonts.spec.js:13                    [firefox]  app-fonts.spec.js:13
  [firefox]  browser.spec.js:2395                    [firefox]  app-settings.spec.js:61
                                                     [firefox]  browser.spec.js:2395
  2 skipped, 570 passed (3.2m)                       2 skipped, 18 did not run, 551 passed
TMPDIR after feature run: node-compile, playwright-transform-cache (external caches); 0 wheelchair-test-run-*, 0 legacy prefixes
.tmp before=696 after=696
```

Pre-existing failures, all also present without this change:
- Both suites' font tests: the worktree has no installed font packages.
- `lifecycle.test.js` "a starter that loses the freed port…": fails 5 out of 5 when the file runs on its own, on the baseline too.
- `browser.spec.js:2395`: fails on the baseline too.

Interrupt check (Validation 3): `bash machine/test/run.sh` started in its own process group with a fresh `TMPDIR`, SIGINT to the group after 4 s:
```
during: ['wheelchair-test-run-2860196-dcuMqk']
run.sh exit: 1
group gone
after: []
```

Kill check (Validation 4):
```
during: ['wheelchair-test-run-2862565-tRtD5x']
owner pid 2862565            (kill -9 sent to it)
after kill -9 and suite end: ['wheelchair-test-run-2862565-tRtD5x']
next suite exit 0
after a later runDir() in that TMPDIR: []
```

Validation 6: `viewer/test/.tmp` had 696 entries before and after the full unit and browser runs; none were new.

## Known gaps / residual risks

- The helper suite does not exercise the sweep branch that kills a dead run's still-running recorded child, nor the PID-reuse branch. The code at `test-support/run-dir.js:48-66` follows the Spec's rule, but only reading the code covers those two branches.
- Node 20 was not available on this machine (`node --version` v22.23.5). The helper uses only APIs that exist in Node 20 (`fs.mkdtempSync`, `Atomics.wait`, `SharedArrayBuffer`, `fs.rmSync` with `maxRetries`); it was not run on Node 20.
- `aside-probe.sh` was checked with `bash -n` only. Its new `rm -rf -- "$dir"` also removes `probe.log`, which the probe prints the path of; after the probe exits, that log is gone.
- Accepted Risks in PLAN.md stand: detached grandchildren started by code under test are not tracked, and the legacy sweep uses age alone.
- The hub started T2 three times on one attempt id (worker-3, -4, -5). Branches `wc-25ba351f336d-w3` and `-w5` and their worktrees remain unmerged; nothing was deleted.

## Remediation rounds

### Remediation 1 — 2026-11-15

Verifier attempt 1 (GPT `gpt-6.1-sol`, on `db1dc52`): FAIL. The one gap was Spec §7: `viewer/AGENTS.md` placed the temp-folder sentence inside the Tests bash fence (`bash -n` of the block exited 2), and its `test/` row still said cache roots live under `test/.tmp/`. The sub-lead added the same staleness at root `AGENTS.md`'s `.gitignore` row. Plan: `REMEDIATION-1.md`.

Fixed by task R1 (GPT light `gpt-6-luna`, worker-8; worker reported no choices), merged at `daa8d95`:
- `viewer/AGENTS.md:65`: the `test/` row now says the cache root is a folder from `test-support/run-dir.js` under system temp.
- `viewer/AGENTS.md` Tests: the fence closes after the two commands, and the sentence is prose below it.
- `AGENTS.md:69`: the `.gitignore` row says `viewer/test/.tmp/` is where older checkouts wrote scratch, swept after an hour by `test-support/run-dir.js`.

Evidence (sub-lead, on the feature branch after the merge):
```
$ awk '/^```bash$/{f=1;next} /^```$/{f=0} f' viewer/AGENTS.md | bash -n && echo bash-blocks-ok
bash-blocks-ok
```
No code changed, so the suite evidence above still stands.
