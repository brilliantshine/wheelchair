# Remediation 2: app-risks

Verification attempt 2 (verifier `wc-0958e89051d8-verifier-2`, claude / claude-opus-5-5, commit `c40302f`): FAIL with one gap. The gap from attempt 1 (startup path assertion) was confirmed closed; this is a different gap.

## Gap list (verbatim)

GAP: Smoke check 4 "Clean" / Harness step 8 ("the run folder is removed") — the check passes, but every smoke run leaves its run folder behind in /tmp, and nothing ever removes it. The real `claude` started by the start check recreates `<run folder>/home/.claude.json` and `home/.claude/backups/` after the folder is removed. The recreated folder has no `owner.json`, so `run-dir.js`'s sweep skips it permanently (`test-support/run-dir.js:50`, which returns when `owner.json` is unreadable). `smoke.js:39-44` checks `fs.existsSync(h.dir)` right after teardown, before the late write lands, so it reports PASS. — `bash test-support/smoke/run.sh` printed `removed run folder: /tmp/wheelchair-test-run-894686-ORP7SC … PASS clean`. Checking that path afterwards: `t+0: exists=no`, `t+2: exists=yes`, `t+5: exists=yes`, and it contains `home/.claude.json` and `home/.claude/backups/.claude.json.backup.1794806086613`. /tmp already holds nine of these folders (owner=no, contents `home/.claude*`), one per smoke run since 20:47. They include `/tmp/wheelchair-test-run-861862-cil1Mg`, the run the sub-lead cites in COMPLETION.md as passing after the merge. No process from these runs is still alive, so the write happens during shutdown.

## Leaked folders (not deleted; no-delete rule)

Sub-lead count at the start of remediation 2: 10 folders, all `owner=no`, holding only `home/.claude.json` / `home/.claude/`:
- `/tmp/wheelchair-test-run-211417-Gc568d`
- `/tmp/wheelchair-test-run-378205-RsMmwm`
- `/tmp/wheelchair-test-run-403300-4as1xg`
- `/tmp/wheelchair-test-run-419309-KfkMsp`
- `/tmp/wheelchair-test-run-517740-tlAfns`
- `/tmp/wheelchair-test-run-850989-ZihC6o`
- `/tmp/wheelchair-test-run-858265-Z01OvJ`
- `/tmp/wheelchair-test-run-861862-cil1Mg`
- `/tmp/wheelchair-test-run-875810-Yl1Vyq`
- `/tmp/wheelchair-test-run-894686-ORP7SC`

`/tmp/wheelchair-test-run-3907868-S7ruFY` has an `owner.json` and is not from this build.

## Tasks

### R2-T1: the smoke run folder must stay removed

Route: GPT, Standard (remediation attempt 1 for this gap, brief sharpened).

# Worker brief — app-risks R2-T1: the smoke run folder must stay removed

Read first: /home/collin/projects/personal/wheelchair/protocol/app/worker.md (your role rules).
Plan slug: app-risks. Task id: R2-T1. Lead session (send questions here with a `message` card): wc-0958e89051d8-lead.
Context: docs/plans/app-risks/PLAN.md Spec "Shared harness" step 8 and "1. Smoke suite" check 4; docs/plans/app-risks/REMEDIATION-2.md (the gap, verbatim).

## Hard rules
- The port/state ban covers only what the harness and scripts point at and write to. Your own wc.js and card.js commands go through this machine's service on 7374; that is expected and required.
- **Never delete files yourself**: no `rm`, no `rmdir`, no `git rm`, no `git clean`, no `fs.rm*` calls you add to harness code. Removing the run folder stays `test-support/run-dir.js`'s job (`cleanupNow()`), as today. **Do not touch the folders already left in /tmp**; the sub-lead reports them.
- Never run ./install.sh. Never point anything at port 7374/7373 or write ~/.local/state/wheelchair. Never restart the wheelchair-viewer or wheelchair-machine services. Never kill the user's default tmux server, and never signal a process that is not one of this harness run's own (see below).
- **Never run `test-support/smoke/live.sh`** (it costs real model turns). The smoke suite and `--check-live` are free.
- Do not change `viewer/`, `machine/` or `test-support/run-dir.js`.
- If the same gate fails twice, stop and report rather than iterating.

## The gap
Smoke check 2 starts the real `claude` in a pane on the private tmux server, with `HOME=<run folder>/home`. Teardown (`test-support/smoke/harness.js`, the `teardown` function) kills the private tmux server and then calls `cleanupNow()` right away. The `claude` process is still shutting down and writes `<run folder>/home/.claude.json` and `home/.claude/backups/…` **after** the folder is removed, so the folder comes back with no `owner.json`, and `run-dir.js`'s sweep never removes it (`test-support/run-dir.js:50`). `smoke.js`'s clean check looks immediately, so it passes. The verifier measured: `t+0 exists=no, t+2 exists=yes, t+5 exists=yes`. Note the machine launches tmux through `systemd-run --user --scope` (`machine/service.js:449-450`), so pane processes are not children of the harness.

## What to build
1. **In `teardown`, after `tmux kill-server` and before `cleanupNow()`:** wait until no process of this run is alive. "Of this run" means a process whose `/proc/<pid>/environ` contains `HOME=<paths.home>` (smoke mode) or `TMUX_TMPDIR=<paths.tmux>`, or whose `/proc/<pid>/cwd` is inside the run folder. Read `/proc` only for processes owned by the current uid, and ignore unreadable entries. Poll every 100 ms for up to 10 s. Any still alive after 10 s gets SIGTERM; after 2 s more, SIGKILL. Only these processes, never anything else. Put the matcher in a small exported pure-ish function, e.g. `runProcesses(dir, paths)`, that returns the pids.
2. **Return** `{ privateTmuxGone, runFolderGone, leftoverProcesses }` from teardown, where `leftoverProcesses` is the count still alive just before `cleanupNow()` (expected 0).
3. **`smoke.js` clean check:** after teardown, wait 5 s, then assert the run folder still does not exist and `leftoverProcesses === 0`. Print both facts on the PASS line.
4. Live mode has the same teardown. The live HOME is real, so the matcher there relies on `TMUX_TMPDIR` and cwd only. It must never match by the real HOME.

## Ownership boundary
- `test-support/smoke/harness.js` (teardown and the new matcher only), `test-support/smoke/smoke.js` (clean check only).
- `test-support/test/smoke-harness.test.js` — add a test for the matcher with a fake `/proc`-like input if you made it injectable, or skip it with a one-line reason in the report.
- `docs/plans/app-risks/reports/R2-T1.md`.

## Validation (paste output in the report)
```bash
ls -d /tmp/wheelchair-test-run-* 2>/dev/null | sort > /tmp/before-r2.txt   # snapshot, read-only
for i in 1 2 3; do bash test-support/smoke/run.sh; done
sleep 10; ls -d /tmp/wheelchair-test-run-* 2>/dev/null | sort > /tmp/after-r2.txt; comm -13 /tmp/before-r2.txt /tmp/after-r2.txt   # must print nothing
node --test test-support/test/*.test.js
node test-support/smoke/harness.js --check-live
node --check test-support/smoke/live.js
```
Also paste the failing-before evidence: run `bash test-support/smoke/run.sh` once on the unfixed code, wait 5 s, and show its run folder exists again (`ls -la <that folder>/home`). Do not remove that folder; list it in your report.

## Deliverable
Commit via `node /home/collin/projects/personal/wheelchair/viewer/app/wc.js git commit --paths <exact paths> --message "..."`. Report at `docs/plans/app-risks/reports/R2-T1.md` with the pasted outputs, the folders your runs left behind (expected: only the one from the failing-before run), then post a `result` card (task R2-T1).

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
