# T3b — Windows bridge manager

## Outcome: blocked

Implemented and committed the bridge manager and its focused tests. The real WSL check did not pass: its second worktree copied the seed cache successfully but `ensureCopy` returned `seed failed`, because the existing PowerShell seeding script passed robocopy's success exit code 1 through as a process failure. This function is owned by parallel task T1b and was not modified here; the lead has been notified. The full machine suite was run twice and failed both times only on the brief's known pre-existing Kimi installation failure; I stopped further iteration after the second failure, as required.

## Changes

- `machine/lib/win.js`: copy registry, WSL/access checks, command delegation, startup readying, stop/removal, sweep, and archive handling.
- `machine/test/win.test.js`: 12 tests using stub app tracking and real git with the Windows process fakes.
- No changes to the pre-existing `win-env.js` or `win-sync.js`.

## Outstanding work and integration risks

- The required real check did not establish successful readying of the seeded copy. Retest after T1b fixes the robocopy exit handling. Both Windows copies and their temporary thread directory were removed after the check.
- The focused suite does not separately cover all requested cases: sandboxed `start`, `start` token exclusion, sweep terminating a dead app and marking its copy, every failed-reconcile deletion exception, successful archive pending, and failure of final reconcile under all timing races need explicit tests.
- The registry currently stores the last session's single `role`; if a worker and lead share a worktree and the worker was recorded last, sweep can overlook the lead copy. The registry needs to persist the roles using the copy and sweep should consider those roles.
- T4 must invoke `onStop` before it changes `session.status` to `stopped`; the current service changes the status before its screen cleanup. The manager has not been integrated into the service.
- The launch path checks the session after its initial reconcile but does not fence an app start that races with session stop; this needs a post-launch check and job termination on a failed fence.
- The real-check script logged the seed failure but exited 0 because `beforeLaunch` correctly resolves on failure; the output below is therefore a failed behavioral check despite the process exit status.

## Choices

- `win.js` stores `thread_id`, worktree path, copy paths, last session and role in the sync helper's existing `state.json`; it also stores the Git common directory to support cleanup after a linked worktree is removed.
- `win.js` records usage timestamps and an in-memory usage counter to preserve app-close notifications across in-flight reconciles.
- `win.js` keeps archive-attempt markers in memory until archive finish so each copy is attempted at most once during archive.
- `win.js` uses `readyTimeoutMs` as the injectable startup-readying deadline and reports an in-progress timeout in `info.reason`.
- `win.js` reports null copy paths when PowerShell cannot supply LOCALAPPDATA for `info`.
- `win.js` rejects case variants of `WHEELCHAIR_SESSION_TOKEN` because Windows environment variable names are case-insensitive.

## Validation

`node --test machine/test/win.test.js`:

```text
exit 0
✔ availability, role, session and argument checks are ordered (4.217246ms)
✔ session environment applies to tool roles without creating state (0.924438ms)
✔ run timeout syncs, status syncs an exit and launch environment excludes the token (1847.992667ms)
✔ readying times out without blocking launch and does not create copies for ordinary sessions (685.347242ms)
✔ worker merge cleanup deletes its copy and stop does not reconcile (651.118034ms)
✔ verifier stop returns immediately and deletes after its apps stop (655.58464ms)
✔ archive waits once for a final sync and retains a failed copy (675.255589ms)
✔ sweep reconciles a dead lead with no apps (1027.99595ms)
✔ sessions sharing a worktree share the copy and Windows tool use triggers stop sync (975.696788ms)
✔ archive deletes copies while retaining conflict refs (1093.832183ms)
✔ cleanup removes a vanished linked worktree copy without a reconcile (676.357041ms)
✔ info reports a PowerShell startup failure and environment names are case insensitive (0.581702ms)
ℹ tests 12
ℹ suites 0
ℹ pass 12
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 8355.869104
```

`bash machine/test/run.sh` (second run; first run had the same Kimi failure):

```text
exit 1
✔ after an interrupted move between threads active is kept (218.252211ms)
✔ return branch deleted or checked out elsewhere is refused (444.05042ms)
✔ stale record: Back refused; Dismiss deletes return pin when its branch contains it, else keeps it (569.92199ms)
✔ folder replaced by another clone during a trial: Dismiss keeps entries marked old identity (203.32856ms)
✔ stale version on back, dismiss and forget is refused (236.323069ms)
✔ required smudge filter failing on Back is interrupted, files recorded and no file deleted (302.019128ms)
✔ re-cloning after a completed Back allows Try (424.916417ms)
✔ tracked path colliding with an ignored file on Back is refused with the file intact (299.868847ms)
✔ Try keeps an ignored directory intact when the thread tracks its path as a file (190.802321ms)
✔ Back keeps an ignored directory intact when the earlier branch tracks its path as a file (318.484445ms)
✔ folder under state worktrees is refused (67.609152ms)
✔ real git am in progress is refused (106.920358ms)
✔ a long switch does not delay the same project agent worktree queue (2172.094664ms)
✔ two symlink spellings of one folder pressed together are refused (1181.108403ms)
✔ index.lock is shown after nothing moved and hidden while a switch runs (208.379656ms)
✔ Status for stale, moved, trying-other and mismatch includes the right fields (262.503746ms)
✔ capped file lists retain full files_count and appeared_count (541.509192ms)
✔ kept entries show missing and old_identity flags (57.458386ms)
✔ Status runs no content filter while active (241.631726ms)
✔ required smudge filter failing on a move between threads records exact interrupted paths (322.873473ms)
✔ real git switch unable to unlink warning is interrupted (181.38493ms)
✔ commit subject containing unable to unlink gives plain success (182.340581ms)
✔ hanging filter subprocess outlives deadline and its whole process group is killed (595.129748ms)
✔ delayed process filter failing after HEAD moved records files across reload (224.224035ms)
✔ parses every operation (1.469498ms)
✔ rejects invalid operations and arguments with 400 (0.561301ms)
✔ detects WSL and its mount root (4.499647ms)
✔ repairs interop without leaking token or mutating the input (0.434389ms)
✔ PowerShell startup failure includes interop guidance (6.374227ms)
✔ gitWin translates a Windows path and runs real git in the copy (121.895165ms)
✔ state is persisted and unresolved paths are reported (5.70359ms)
✔ reconcile transfers additions, edits, deletions, renames and independent changes (1953.896631ms)
✔ text conflicts preserve the Windows version and mask markers until resolved (1938.454162ms)
✔ binary and modify/delete conflicts choose Linux and save Windows (1060.509704ms)
✔ refuses case collisions and leaves external symlinks out (588.053509ms)
✔ refuses after two changes during apply without losing edits (1157.016339ms)
✔ interrupted Windows apply is resumed after another Linux edit (1198.216882ms)
✔ raw bytes, executable mode, force-added and newly ignored files (1225.985754ms)
✔ seeding copies only ignored paths accepted by the new worktree (767.163239ms)
✔ deleting unresolved copies saves the Windows snapshot and removes copy refs (925.868287ms)
✔ concurrent reconciles for the same copy are serialized (970.088149ms)
✔ interrupted conflict application retains marker masking on the next sync (1320.848306ms)
✔ later force-add, repeated tracked deletion, and successive Windows edits sync (1908.669901ms)
✔ clean checkout LFS and eol attributes do not transform bridge bytes (569.9942ms)
✔ availability, role, session and argument checks are ordered (7.509389ms)
✔ session environment applies to tool roles without creating state (1.166842ms)
✔ run timeout syncs, status syncs an exit and launch environment excludes the token (2243.22455ms)
✔ readying times out without blocking launch and does not create copies for ordinary sessions (795.583189ms)
✔ worker merge cleanup deletes its copy and stop does not reconcile (772.18603ms)
✔ verifier stop returns immediately and deletes after its apps stop (765.674514ms)
✔ archive waits once for a final sync and retains a failed copy (724.89407ms)
✔ sweep reconciles a dead lead with no apps (1111.009494ms)
✔ sessions sharing a worktree share the copy and Windows tool use triggers stop sync (1017.745062ms)
✔ archive deletes copies while retaining conflict refs (1102.667559ms)
✔ cleanup removes a vanished linked worktree copy without a reconcile (674.186333ms)
✔ info reports a PowerShell startup failure and environment names are case insensitive (0.594472ms)
ℹ tests 478
ℹ suites 0
ℹ pass 477
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 38278.338358

✖ failing tests:

test at machine/test/kimi.test.js:164:1
✖ new login clears previous result and uses exact target (114.233646ms)
  Error: Kimi Code is not installed
      at MachineService.startLogin (/home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc-c833faa8e033-w7/machine/service.js:1471:70)
      at TestContext.<anonymous> (/home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc-c833faa8e033-w7/machine/test/kimi.test.js:168:17)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1402:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:974:18)
      at Test.postRun (node:internal/test_runner/test:1542:19)
      at Test.run (node:internal/test_runner/test:1467:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    status: 409
  }
```

Real WSL check, using a stub service and apps, a temporary Git repository and linked worktree, and real PowerShell/Git for Windows:

```text
exit 0
info {"wsl":true,"ok":true,"ready":true,"copy_windows":"C:\\Users\\Collin\\AppData\\Local\\Wheelchair\\copies\\real-412205\\f230a932510f","copy_linux":"/mnt/c/Users/Collin/AppData/Local/Wheelchair/copies/real-412205/f230a932510f","sandboxed":false}
initial sync {"to_windows":[".gitignore","initial"],"to_linux":[],"conflicts":[],"unresolved":[],"skipped":[]}
two-sided sync {"to_windows":["linux-file"],"to_linux":["windows-file"],"conflicts":[],"unresolved":[],"skipped":[]}
round trip linux windows
LOG Error: seed failed: 
second info {"wsl":true,"ok":true,"ready":false,"reason":"seed failed: ","copy_windows":"C:\\Users\\Collin\\AppData\\Local\\Wheelchair\\copies\\real-412205\\5253372bf35c","copy_linux":"/mnt/c/Users/Collin/AppData/Local/Wheelchair/copies/real-412205/5253372bf35c","sandboxed":false}
seed seeded
archive initial {"pending":["wc-real-worker"]}
archive final {"pending":[]}
deleted [true,true]
```
