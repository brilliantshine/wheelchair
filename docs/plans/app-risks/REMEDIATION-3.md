# Remediation 3: app-risks

Verification attempt 3 (verifier `wc-0958e89051d8-verifier-3`, claude / claude-opus-5-5, commit `727f0a0`): FAIL with one gap. This is **the same gap as REMEDIATION-2** (the smoke run folder leaks), now on the signal path, after one fix attempt. Per the sub-lead rules this is the second and last fix attempt; if it survives, it goes to the lead as a plan defect.

## Gap list (verbatim)

GAP: Shared harness step 8 ("On exit (pass, fail or signal): … lets `run-dir.js` remove the run folder") — remediation 2 fixed only the normal teardown. When the run is interrupted by a signal, the run folder still leaks, the same way REMEDIATION-2 described. On SIGINT/SIGTERM/SIGHUP, `run-dir.js:108-113` calls `cleanupNow()`. That runs the harness's `onCleanup` callback (`harness.js:153`, `tmux kill-server` and `proxy.close()`), kills the hub and machine, and removes the folder straight away. It never waits for the run's own processes. The new wait in `teardown` (`harness.js:171-182`) is not on that path. The real `claude` then writes `home/.claude.json` into the deleted folder. The recreated folder has no `owner.json`, so the sweep skips it for good (`run-dir.js:50`). — I ran `node test-support/smoke/smoke.js` and sent `kill -INT` right after it printed `PASS start`. It exited 130. I then checked `/tmp/wheelchair-test-run-981116-ZlIxpv`: absent at t≈0, present at t≈4 s and t≈8 s. It holds only `home/.claude.json` and `home/.claude/backups/.claude.json.backup.1794806522915`, with no `owner.json`. I left that folder in place (no-delete rule). It is the only leak from my runs.

Verifier note (not a gap): live run 2 was at `b09e538`, before the remediation 1/2 harness changes; in live mode those changes have run only through `--check-live`.

## Why the brief failed

The R2-T1 brief told the worker to put the wait inside `teardown`, so the worker built exactly that. The defect was in the brief, not the worker: the brief did not name the signal path. Same tier; the brief now names where the wait goes (the `onCleanup` callback, which every exit path runs).

## Tasks

### R3-T1: no leaked run folder on a signal either

Route: GPT, Standard.

# Worker brief — app-risks R3-T1: no leaked run folder on a signal either

Read first: /home/collin/projects/personal/wheelchair/protocol/app/worker.md (your role rules).
Plan slug: app-risks. Task id: R3-T1. Lead session (send questions here with a `message` card): wc-0958e89051d8-lead.
Context: docs/plans/app-risks/PLAN.md Spec "Shared harness" step 8 ("On exit (pass, fail or signal) … lets run-dir.js remove the run folder"); docs/plans/app-risks/REMEDIATION-2.md and REMEDIATION-3.md (the gaps, verbatim). Read `test-support/run-dir.js` and `test-support/smoke/harness.js` in full first.

## Hard rules
- The port/state ban covers only what the harness and scripts point at and write to. Your own wc.js and card.js commands go through this machine's service on 7374; that is expected and required.
- **Never delete files yourself**: no `rm`, `rmdir`, `git rm`, `git clean`, and no `fs.rm*` calls added to harness code. Removing the run folder stays `run-dir.js`'s job. **Do not touch any folder already in /tmp.**
- Never run ./install.sh. Never point anything at port 7374/7373 or write ~/.local/state/wheelchair. Never restart the wheelchair-viewer or wheelchair-machine services. Never kill the user's default tmux server. Signal only processes `runProcesses` matches for this run.
- **Never run `test-support/smoke/live.sh`.** The smoke suite and `--check-live` are free.
- Do not change `viewer/`, `machine/` or `test-support/run-dir.js`.
- If the same gate fails twice, stop and report rather than iterating.

## The gap
Remediation 2 added a wait for this run's processes, but only inside the async `teardown()` (`harness.js:171-182`). On SIGINT/SIGTERM/SIGHUP (and on a plain process `exit`), `run-dir.js:93-99,108-113` calls `cleanupNow()`. That runs the harness's `onCleanup` callback (`harness.js:153`: `tmux kill-server` and `proxy.close()`), kills the tracked hub/machine and removes the folder at once. The real `claude` then rewrites `home/.claude.json`, and the folder comes back with no `owner.json`. Measured by the verifier: `node test-support/smoke/smoke.js`, then `kill -INT` right after `PASS start` → exit 130, folder absent at t≈0 and present at t≈4 s and 8 s.

## What to build (settled design; do not re-decide)
1. In `harness.js`, a **synchronous** `waitForRunProcesses(dir, matchPaths)`. It polls `runProcesses(dir, matchPaths)` every 100 ms for up to 10 s, then SIGTERMs the matches and polls 2 s, then SIGKILLs and polls 2 s. It returns the count still alive. Sleep synchronously with `Atomics.wait` on a `SharedArrayBuffer`, the same technique `run-dir.js` uses (`sleeper`); no async and no busy spin.
2. Replace the `onCleanup` callback at `harness.js:153` with one that does, in order: `tmux kill-server`; `proxy.close()`; `waitForRunProcesses(dir, matchPaths)`. Hoist `matchPaths` (`{ tmux: paths.tmux, ...(mode === 'smoke' ? { home: paths.home } : {}) }`) so both paths use the same value. `cleanupNow()` runs callbacks before killing tracked children and removing the folder (`run-dir.js:96-99`), so this covers every exit path: signal, `exit`, and the normal `teardown()`.
3. In `teardown()`, replace its async poll/signal block with `const leftoverProcesses = waitForRunProcesses(dir, matchPaths);` before `cleanupNow()`. The return value is unchanged: `{ privateTmuxGone, runFolderGone, leftoverProcesses }`. The callback will then run again inside `cleanupNow()`, where it finds nothing and returns quickly; that is fine.
4. Unit test in `test-support/test/smoke-harness.test.js`: with the injectable proc interface, `waitForRunProcesses` returns 0 once the fake process list empties, and is bounded when it never empties (inject a short timeout or clock if needed; keep the defaults 10 s/2 s/2 s).

## Ownership boundary
- `test-support/smoke/harness.js` (the cleanup callback, teardown's wait, the new function)
- `test-support/test/smoke-harness.test.js`
- `docs/plans/app-risks/reports/R3-T1.md`

## Validation (paste output in the report)
For each of INT, TERM and HUP: start `node test-support/smoke/smoke.js` in the background with output to a file, wait until the file contains `PASS start`, send `kill -<SIG> <pid>`, wait for the process to exit and record its exit code, then record the run folder path (it appears in the output, or take it from the `ls -d /tmp/wheelchair-test-run-<pid>-*` glob) and check `test -e <folder>` at +0 s, +5 s and +10 s. Expected: absent all three times. Then:
```bash
bash test-support/smoke/run.sh; bash test-support/smoke/run.sh
node --test test-support/test/*.test.js
node test-support/smoke/harness.js --check-live
node --check test-support/smoke/live.js
```
Failing-before is already recorded by the verifier (REMEDIATION-3.md). Do not re-create it; it would leak another folder.

## Deliverable
Commit via `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit --paths <exact paths> --message "..."`. Report at `docs/plans/app-risks/reports/R3-T1.md` with the pasted outputs, then post a `result` card (task R3-T1).

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
