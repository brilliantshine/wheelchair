---
slug: app-risks
date: 2026-11-15
implemented-by: "gpt standard (gpt-6.1-terra) ×7 workers: T1, T2, T3, T3b, R1-T1, R2-T1, R3-T1; sub-lead claude-opus-5-5 for the D10 seeding and the proposal wording fix"
verified-by:
  - round: 1
    lane: claude / claude-opus-5-5 (FAIL: startup path assertion)
    checks: gpt standard (gpt-6.1-terra)
  - round: 2
    lane: claude / claude-opus-5-5 (FAIL: smoke run folder leak)
    checks: gpt standard (gpt-6.1-terra)
  - round: 3
    lane: claude / claude-opus-5-5 (FAIL: same leak on the signal path)
    checks: gpt standard (gpt-6.1-terra)
  - round: 4
    lane: claude / claude-opus-5-5 (PASS at 3a749c0)
    checks: gpt standard (gpt-6.1-terra)
---

# Completion Report: Close the app's remaining risks

Written for a hostile reviewer: every claim checkable, no claim without evidence. The plan has no Prior Work rows, so every item is `this run`. Line numbers are at commit `f78b487`.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Harness 1: one run folder (hub state, cache, machine state, `TMUX_TMPDIR`, bare origin with seed commit, clone; live mode also has local `wc/<thread>`) | this run | `test-support/smoke/harness.js:42-73` | smoke suite; `--check-live` |
| Harness 2: three free loopback ports | this run | `harness.js:48-50` | smoke suite |
| Harness 3: hub state written with `viewer/app/state.js` before the hub starts: `machines.json` pointing at the proxy; live thread + sub-lead record | this run | `harness.js:85-89` | `--check-live` prints the seeded sub-lead through the hub |
| Harness 4: real hub with `--port --cache-root --state-dir`, `WHEELCHAIR_NO_BROWSER=1` | this run | `harness.js:116` | smoke check "readiness through hub" |
| Harness 5: real machine service with own state, port, host 127.0.0.1, secret, hub URL; `TMUX`/`TMUX_PANE`/`WHEELCHAIR_*` removed; smoke: temp HOME, no `CLAUDE_CONFIG_DIR`/`CODEX_HOME`; live keeps them | this run | `harness.js:51-53,117` | smoke suite (private tmux lists the session) |
| Harness 6: counting proxy, `POST /v1/sessions` per name | this run | `harness.js:91-106` | live run 2 slow-start row "1 start requests"; run with 5 s timeout counted 2 (`reports/T3.md`) |
| Harness 7: helpers (hub route, agent session request as sub-lead, machine routes, tmux, wait) | this run | `harness.js:119-123,111-112,21-29` | used by smoke.js and live.js |
| Harness 8: teardown on pass/fail/signal; private tmux only; run folder removed | this run | `harness.js:113,124-133`; `test-support/run-dir.js` | smoke check "clean" |
| Harness startup assertion: no 7373/7374; every state/cache/spool path inside the run folder | this run | `harness.js:54-57` | code reading (see Deviations) |
| No new flags needed for isolation | this run | the existing hub and machine flags were used (`viewer/server.js:1075-1085`, `machine/service.js:102-110,249-255`) | n/a |
| Smoke suite: exit 2 naming a missing tool | this run | `test-support/smoke/run.sh:3-8` | code reading |
| Smoke check 1, readiness through hub | this run | `test-support/smoke/smoke.js:14-22` | smoke output |
| Smoke check 2, start (`lead`, `wc/smoke`, real `claude`, private tmux) | this run | `smoke.js:23-30` | smoke output |
| Smoke check 3, stop | this run | `smoke.js:31-36` | smoke output |
| Smoke check 4, clean | this run | `smoke.js:39-44` | smoke output |
| Live: tools check, `--only`/`--provider`/`--tier`, table, exit code | this run | `test-support/smoke/live.sh:3-9`; `live.js:8-24,139-141` | `live.sh --only bogus` exits 2 (sub-lead) |
| Live: every start/stop via the seeded sub-lead | this run | `live.js:54-60` | live run 2 |
| Live slow start (D3): `ext::` origin with 8 s sleep, `protocol.ext.allow` in the clone only; >5 s and exactly 1 start request | this run | `harness.js:75-83`; `live.js:72-84` | run 2: PASS 12.93 s, 1 request. Failing-before with `START_TIMEOUT_MS=5000`: FAIL, 9.17 s, 2 start requests (`reports/T3.md`) |
| Live model tiers (D7): 4 tiers × 2 providers, model from the CLI's own transcript under the effective config folder, compared with `codex/model.sh` | this run | `live.js:32-40,87-108` | run 2: all 8 rows PASS (`reports/live-run.md`) |
| Live: not logged in → `skipped (not logged in)`, fails the run | this run | `live.js:69,111` | code reading |
| Live: stopped session stays listed `live:false`, `status:stopped` | this run | `live.js:57-60` | run 2 (a failed stop would add a FAIL row) |
| Live permission prompt (D8): seed `.claude/settings.json` ask rule; `permission_mode: auto`; open card → Enter on the private pane → cleared within 30 s → `smoke-ok` exists | this run | `harness.js:65-67`; `live.js:120-136` | run 2: PASS; T3's single permission run: PASS |
| Duplicate cards (D2): hub 500 on direct relay = spooled 202, redelivered with the same id; 4xx unchanged | this run | `machine/service.js:1026` | `machine/test/service.test.js:252-266`; failing-before `500 !== 202` (`reports/T1.md`) |
| Docs: AGENTS.md Verification (two commands, hearth only / costs model turns); `test-support/` row | this run | `AGENTS.md:56,110-111` | diff |
| Docs: proposal "Risks to close" each marked closed or out of scope | this run | `docs/proposals/app-followups/proposal.md:42-57` | diff |
| D10 (user): the live script's private hub alone turns usage protections off | this run | `harness.js:86-87`; `live.js:25,44-49` | the free seeded-settings check reported `held_back.worker:false, margin:0, leave:0`; run 2 honoured every provider |

## Deviations from plan

- **Slow origin only for the slow-start start.** The Spec says "every worker start's fetch takes over 8 s". In live run 1 that froze the machine service, because a start's `git fetch` runs synchronously (`machine/service.js:380`). The hub's 3 s status call timed out (`viewer/app/usage.js:48-62`) and the hub put later starts on hold. The origin is now slow only around the slow-start request, followed by a 16 s wait for the hub's 15 s machine-status cache (`live.js:72-82`). The slow-start check itself is unchanged.
- **D10 added** (source: user) after live run 1. The test hub's Settings have workers not held back, margin 0 and leave 0, so each requested provider/tier is honoured. Collin's real Settings are untouched (separate `--state-dir`).
- **Startup path assertion covers the paths the harness passes**, not each process's computed defaults. Every default (hub state, cache root, machine state and its spool) is overridden by an explicit flag (`harness.js:116-117`), so no process falls back to a default. This is weaker than the Spec's wording.
- **Smoke readiness reads the Claude version from the machine's `/v1/status` answer as the proxy relays it to the hub** (`smoke.js:17-21`). The hub's agents route reports reachability, not the version.
- **The proposal edit**: T3 replaced the bullets; the sub-lead restored the original wording and appended the marks.

## Routers

Root `AGENTS.md`: the `test-support/` row now names `smoke/` (harness.js, run.sh, live.sh), and Verification lists `bash test-support/smoke/run.sh` (hearth only) and `bash test-support/smoke/live.sh` (hearth only, costs model turns). No ownership moved.

## Validation evidence

Free suites at `f78b487`:

```
$ bash machine/test/run.sh
# tests 98
# pass 98
# fail 0
$ node --test viewer/test/*.test.js
not ok 265 - a starter that loses the freed port registers through the new holder
not ok 293 - an app page carries font-src self and the font route serves only the allowlist
# tests 386
# pass 384
# fail 2
$ node --test test-support/test/*.test.js
# tests 6
# pass 6
# fail 0
$ bash test-support/smoke/run.sh
PASS readiness through hub
PASS start
PASS stop
  removed run folder: /tmp/wheelchair-test-run-683141-bBhrSg; private tmux server gone
PASS clean
exit 0
$ node test-support/smoke/harness.js --check-live
Seeded session: {"name":"wc-smoke-sub-lead","role":"sub-lead","live":true,"status":"ready"}
Slow origin fetch: 8.02 s
Run folder removed: true
exit 0
```

The 2 viewer failures are not from this build: `git diff 378f2fa -- viewer/` is empty. Test 265 is recorded in `docs/known-issues.md`. Test 293 needs `viewer/node_modules/@fontsource` (`viewer/server.js:1862-1865`), which this worktree does not have; `install.sh` installs it in the clone.

Live run 2 (`bash test-support/smoke/live.sh`, commit `b09e538`):

```
CHECK | RESULT | DETAIL
slow-start | PASS | request succeeded; 12.93 s; 1 start requests
light/claude | PASS | model claude-haiku-5-5
light/gpt | PASS | model gpt-6-luna
standard/claude | PASS | model claude-sonnet-5-5
standard/gpt | PASS | model gpt-6.1-terra
heavy/claude | PASS | model claude-opus-5-5
heavy/gpt | PASS | model gpt-6.1-sol
critical/claude | PASS | model claude-fable-5-2
critical/gpt | PASS | model gpt-6-astra
permission | PASS | prompt opened, Enter approved, card answered, smoke-ok exists

real	2m49.696s
user	0m41.150s
sys	0m15.939s
exit=0
```

Failing-before evidence: `docs/plans/app-risks/reports/T1.md` (card fix: `500 !== 202`) and `reports/T3.md` (slow start at a 5 s timeout: `slow-start | FAIL | request succeeded; 9.17 s; 2 start requests`). Live run 1 (failing) is kept in `reports/live-run.md`.

## Known gaps / residual risks

- **Machine service freezes during a slow `git fetch`:** handed to its own thread (Collin's choice; the lead posted the stub). A session start's fetch runs synchronously (`machine/service.js:380`, `command()` = `spawnSync` at `:67-73`). Measured: `/v1/status` took 6789 ms during an 8 s fetch, against 0.39 s with a fast origin. On a slow network the live service stalls status, cards and hooks for the length of the fetch. A start in that window can then be held with a misleading "no account has room". This plan does not touch it.
- `live.sh` costs model turns (about 9 one-word turns plus a short permission turn) and spends past Collin's usage reserve on the private hub (D10). It is never run by another suite.
- The permission check approves with Enter, relying on the Claude dialog's default option being approve. A future Claude CLI that changes the default would make the check fail rather than pass falsely, because it also requires `smoke-ok` to exist.
- The startup path assertion is weaker than the Spec's wording (see Deviations).

## Remediation rounds


### Remediation 1 (2026-11-15)

Verification 1 (claude / claude-opus-5-5 at `d258bd8`) failed one gap: the startup path assertion checked only paths the harness built itself, so it could never fail. See `REMEDIATION-1.md`. The rows and deviation above about that assertion are superseded by this section; the original text is left as written.

Fix, R1-T1 (gpt / gpt-6.1-terra, `wc-0958e89051d8-worker-5`, commit `c5e32f2`):
- `test-support/smoke/harness.js:42-54` `effectivePaths({ hubArgv, machineArgv, env })` resolves each process's state, cache, spool, worktrees and settings paths and ports from the exact argv and child env about to be spawned. It uses each program's own defaults (`viewer/server.js:1112,2241`, `machine/service.js:26,144`).
- `harness.js:56-62` `assertIsolated` rejects any path outside the run folder and ports 7373/7374. It runs at `:80-81` before the proxy listens or anything spawns, and the spawns use the same argv arrays. `:81` also requires the resolved paths to equal the intended ones: in smoke mode `HOME` is inside the run folder, so a dropped flag would otherwise still pass.
- `harness.js:158-165` read-back after start: `machine.json` in the resolved machine state has the harness port and hub URL; the hub's `.token` is read from the resolved cache root; in live mode the seeded sub-lead is visible through the hub. On a mismatch it tears down and throws.
- `test-support/test/smoke-harness.test.js`: dropping `--state-dir`, `--cache-root` or `--stateDir` yields the real-HOME default and the assertion throws; port 7374 throws.

Shown failing on the real path (`reports/R1-T1.md`): with the hub's `--state-dir` temporarily removed, `bash test-support/smoke/run.sh` → `FAIL setup: AssertionError [ERR_ASSERTION]: hubState differs from intended path` (actual `<run folder>/home/.local/state/wheelchair`), exit 1. Restored, not committed.

Also corrected: live run 2's recorded output had lost its header and slow-start row (a sub-lead copy error); the full output is now above and in `reports/live-run.md`.

Validation after the merge (sub-lead):

```
$ node --test test-support/test/*.test.js
# tests 7
# pass 7
# fail 0
$ bash test-support/smoke/run.sh
PASS readiness through hub
PASS start
PASS stop
  removed run folder: /tmp/wheelchair-test-run-861862-cil1Mg; private tmux server gone
PASS clean
exit 0
```

### Remediation 2 (2026-11-15)

Verification 2 (claude / claude-opus-5-5 at `c40302f`) confirmed remediation 1's gap closed and failed a new gap: every smoke run leaked its run folder. The real `claude` in the smoke start wrote `home/.claude.json` into the temporary HOME after teardown had removed the folder, and the clean check looked too early. See `REMEDIATION-2.md`, which lists the 10 folders this build leaked. They were not deleted (no-delete rule) and Collin decides.

Fix, R2-T1 (gpt / gpt-6.1-terra, `wc-0958e89051d8-worker-6`, commit `275b0d9`):
- `test-support/smoke/harness.js:42-57` `runProcesses(dir, paths)` matches only this run's processes owned by the current uid: environment `HOME=<temp home>` (smoke mode only), `TMUX_TMPDIR=<private tmux folder>`, or a cwd inside the run folder. It never matches the real HOME.
- `harness.js:171-184`: teardown waits up to 10 s for those processes after the tmux server is killed, then SIGTERM (2 s), then SIGKILL, and only then calls `cleanupNow()`. It returns `leftoverProcesses`.
- `test-support/smoke/smoke.js:38-47`: the clean check waits 5 s after teardown, then requires the folder still absent and `leftoverProcesses === 0`.
- `test-support/test/smoke-harness.test.js`: a matcher test over an injected `/proc` (uid filter, exact env match, directory boundary).

Failing-before (`reports/R2-T1.md`): unfixed code, run then 5 s wait: `/tmp/wheelchair-test-run-903082-g6WoX3/home` exists again. That folder is the 11th leak and was not deleted.

Sub-lead check after the merge: one smoke run, then 10 s, then a diff of `/tmp/wheelchair-test-run-*`. The only new folder belonged to a concurrently running test process from another thread, with a live `owner.json` the sweep handles, not to the smoke run. Separately, three smoke runs on the worker's branch left none of their own folders.

```
$ bash test-support/smoke/run.sh
PASS readiness through hub
PASS start
PASS stop
PASS clean: run folder absent after 5s: /tmp/wheelchair-test-run-943100-Z1WEl5; leftover processes: 0; private tmux server gone
exit 0
new /tmp/wheelchair-test-run-* folders 10 s after the run:
/tmp/wheelchair-test-run-943871-IpGp5k owner: {"pid":943871,"start":"16676003","children":[{"pid":945379,"start":"16677463","group":false},{"pid":945391,"start":"16677497","group":false}]}
(end)
$ node --test test-support/test/*.test.js
# tests 8
# pass 8
# fail 0
$ node test-support/smoke/harness.js --check-live
Seeded session: {"name":"wc-smoke-sub-lead","role":"sub-lead","live":true,"status":"ready"}
Slow origin fetch: 8.01 s
Run folder removed: true
```

### Remediation 3 (2026-11-15)

Verification 3 (claude / claude-opus-5-5 at `727f0a0`) confirmed remediations 1 and 2 on their paths. It failed the same leak gap on the signal path: SIGINT during a smoke run went through `run-dir.js`'s `cleanupNow()`, which never waited for the run's processes. See `REMEDIATION-3.md`. The R2 brief had named only `teardown()`; this is the second fix attempt for this gap.

Fix, R3-T1 (gpt / gpt-6.1-terra, `wc-0958e89051d8-worker-7`, commit `82ddac5`):
- `test-support/smoke/harness.js:59-77` `waitForRunProcesses(dir, matchPaths)` is synchronous: it polls `runProcesses` for 10 s, then SIGTERM (2 s), then SIGKILL (2 s), and sleeps with `Atomics.wait` as `run-dir.js` does. It returns the count still alive.
- `harness.js:174`: the `onCleanup` callback now runs `tmux kill-server`, `proxy.close()` and then that wait. `cleanupNow()` runs callbacks before it removes the folder (`run-dir.js:96-99`), so the signal, `exit` and normal paths all wait.
- `harness.js:192`: `teardown()` uses the same function.
- `test-support/test/smoke-harness.test.js`: the wait returns 0 once the processes go, and escalates and stays bounded when they do not (injected clock, sleep and kill).

Failing-before: the verifier's SIGINT run (REMEDIATION-3.md), which left `/tmp/wheelchair-test-run-981116-ZlIxpv`. It was not re-created.

Sub-lead check after the merge. Each signal line comes from `node test-support/smoke/smoke.js`, sent that signal right after `PASS start`, then the run's own folder tested at +0, +5 and +10 s:

```
SIGINT pid=1034623 exit=130 folder=/tmp/wheelchair-test-run-1034623-rojNzu +0s=absent +5s=absent +10s=absent
SIGTERM pid=1040531 exit=143 folder=/tmp/wheelchair-test-run-1040531-yjkg2C +0s=absent +5s=absent +10s=absent
SIGHUP pid=1049272 exit=129 folder=/tmp/wheelchair-test-run-1049272-PLmvpb +0s=absent +5s=absent +10s=absent
$ node --test test-support/test/*.test.js
# tests 9
# pass 9
# fail 0
$ bash test-support/smoke/run.sh
PASS readiness through hub
PASS start
PASS stop
PASS clean: run folder absent after 5s: /tmp/wheelchair-test-run-1058235-5R816R; leftover processes: 0; private tmux server gone
exit 0
$ node test-support/smoke/harness.js --check-live
Seeded session: {"name":"wc-smoke-sub-lead","role":"sub-lead","live":true,"status":"ready"}
Slow origin fetch: 8.02 s
Run folder removed: true
```

### Verification 4 (2026-11-15)

PASS at `3a749c0` (claude / claude-opus-5-5). It re-ran SIGINT/SIGTERM/SIGHUP interruptions (no folder at +0/+5/+10 s), the smoke suite, `--check-live`, machine 98/98 and test-support 9/9. Viewer was 383/386: tests 265 and 293 as explained above, plus 336 (the global write lock), which passed 3/3 when run alone and is not in this branch's diff (`viewer/` unchanged), so it is a flake under load from other threads' tests on the machine. No new gap.
