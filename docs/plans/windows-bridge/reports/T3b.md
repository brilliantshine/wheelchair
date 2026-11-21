# T3b — Windows bridge manager

## Attempt 2 — completed after ownership extension

### Outcome: done

The sub-lead extended ownership to `reconcile` and `snapshot`. The first reconcile now treats Windows as an empty tree without snapshotting disk; its normal `read-tree --reset -u` applies the Linux result and initializes the Windows bridge index. Subsequent reconciles use the ordinary Windows snapshot with ignore rules in place.

`machine/test/win-sync.test.js` seeds a `Library/cache` from a source copy, runs two reconciles, and verifies after each that the cache remains on Windows and appears in neither bridge index nor the base tree. The real WSL check now confirms the second copy is ready and has the seeded file, archives successfully, and removes both copies. The previously reported app-start/stop race remains an integration risk outside the brief's requested changes.

### Choices

- `machine/lib/win-sync.js`: use `git mktree` to write the empty tree object in the new Windows repository before making its empty snapshot commit.
- `machine/test/win.test.js`: intercept the tracker module only during construction to exercise its close callback while `win-apps.js` is built in parallel.

### Validation

`node --test machine/test/win.test.js machine/test/win-sync.test.js`:

```text
exit 0
✔ state is persisted and unresolved paths are reported (3.159326ms)
✔ reconcile transfers additions, edits, deletions, renames and independent changes (1478.439692ms)
✔ text conflicts preserve the Windows version and mask markers until resolved (1513.358337ms)
✔ binary and modify/delete conflicts choose Linux and save Windows (791.375056ms)
✔ refuses case collisions and leaves external symlinks out (428.468484ms)
✔ refuses after two changes during apply without losing edits (1332.628114ms)
✔ interrupted Windows apply is resumed after another Linux edit (1299.105275ms)
✔ raw bytes, executable mode, force-added and newly ignored files (1307.291276ms)
✔ seeding copies only ignored paths accepted by the new worktree (737.079905ms)
✔ seeding accepts robocopy success code 1 and reports failure code 8 (977.020243ms)
✔ first and second reconciles preserve seeded ignored files outside both indexes and base (1315.664858ms)
✔ deleting unresolved copies saves the Windows snapshot and removes copy refs (854.430862ms)
✔ concurrent reconciles for the same copy are serialized (848.10275ms)
✔ interrupted conflict application retains marker masking on the next sync (1124.859684ms)
✔ later force-add, repeated tracked deletion, and successive Windows edits sync (1687.824282ms)
✔ clean checkout LFS and eol attributes do not transform bridge bytes (418.596596ms)
✔ availability, role, session and argument checks are ordered (5.598033ms)
✔ session environment applies to tool roles without creating state (1.061285ms)
✔ run timeout syncs, status syncs an exit and launch environment excludes the token (2080.348638ms)
✔ readying times out without blocking launch and does not create copies for ordinary sessions (535.575844ms)
✔ worker merge cleanup deletes its copy and stop does not reconcile (502.508635ms)
✔ verifier stop returns immediately and deletes after its apps stop (495.294147ms)
✔ failed copies survive ordinary removal and archive, but verifier and merge removal delete them (2630.024326ms)
✔ archive waits for successful final sync then deletes the copy (1074.42245ms)
✔ archive waits once for a final sync and retains a failed copy (628.416553ms)
✔ sweep reconciles a dead lead with no apps (1051.777128ms)
✔ sweep marks dead app copies and reconciles a shared thread worktree after a worker registered (1377.174787ms)
✔ tracker close callback marks the copy used (507.498453ms)
✔ sessions sharing a worktree share the copy and Windows tool use triggers stop sync (880.453523ms)
✔ archive deletes copies while retaining conflict refs (973.317398ms)
✔ cleanup removes a vanished linked worktree copy without a reconcile (519.540101ms)
✔ info reports a PowerShell startup failure and environment names are case insensitive (0.484369ms)
ℹ tests 32
ℹ suites 0
ℹ pass 32
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 16194.993722
```

`bash machine/test/run.sh` (only the known pre-existing Kimi installation failure):

```text
exit 1
✔ re-cloning after a completed Back allows Try (370.046375ms)
✔ tracked path colliding with an ignored file on Back is refused with the file intact (285.307109ms)
✔ Try keeps an ignored directory intact when the thread tracks its path as a file (176.244215ms)
✔ Back keeps an ignored directory intact when the earlier branch tracks its path as a file (266.164698ms)
✔ folder under state worktrees is refused (61.950144ms)
✔ real git am in progress is refused (98.302555ms)
✔ a long switch does not delay the same project agent worktree queue (2169.191216ms)
✔ two symlink spellings of one folder pressed together are refused (1157.153165ms)
✔ index.lock is shown after nothing moved and hidden while a switch runs (203.823858ms)
✔ Status for stale, moved, trying-other and mismatch includes the right fields (217.658023ms)
✔ capped file lists retain full files_count and appeared_count (597.164747ms)
✔ kept entries show missing and old_identity flags (54.841877ms)
✔ Status runs no content filter while active (231.733405ms)
✔ required smudge filter failing on a move between threads records exact interrupted paths (280.866441ms)
✔ real git switch unable to unlink warning is interrupted (177.319172ms)
✔ commit subject containing unable to unlink gives plain success (174.533378ms)
✔ hanging filter subprocess outlives deadline and its whole process group is killed (592.797791ms)
✔ delayed process filter failing after HEAD moved records files across reload (212.811771ms)
✔ parses every operation (1.817664ms)
✔ rejects invalid operations and arguments with 400 (0.571371ms)
✔ detects WSL and its mount root (4.654285ms)
✔ repairs interop without leaking token or mutating the input (0.686478ms)
✔ PowerShell startup failure includes interop guidance (6.966354ms)
✔ gitWin translates a Windows path and runs real git in the copy (137.214724ms)
✔ state is persisted and unresolved paths are reported (6.095058ms)
✔ reconcile transfers additions, edits, deletions, renames and independent changes (1803.129928ms)
✔ text conflicts preserve the Windows version and mask markers until resolved (1807.207957ms)
✔ binary and modify/delete conflicts choose Linux and save Windows (909.417912ms)
✔ refuses case collisions and leaves external symlinks out (451.879316ms)
✔ refuses after two changes during apply without losing edits (1019.243166ms)
✔ interrupted Windows apply is resumed after another Linux edit (1099.982803ms)
✔ raw bytes, executable mode, force-added and newly ignored files (1088.550015ms)
✔ seeding copies only ignored paths accepted by the new worktree (621.137498ms)
✔ seeding accepts robocopy success code 1 and reports failure code 8 (835.428897ms)
✔ first and second reconciles preserve seeded ignored files outside both indexes and base (1211.021625ms)
✔ deleting unresolved copies saves the Windows snapshot and removes copy refs (791.18909ms)
✔ concurrent reconciles for the same copy are serialized (810.822348ms)
✔ interrupted conflict application retains marker masking on the next sync (1103.368451ms)
✔ later force-add, repeated tracked deletion, and successive Windows edits sync (1682.937278ms)
✔ clean checkout LFS and eol attributes do not transform bridge bytes (409.848747ms)
✔ availability, role, session and argument checks are ordered (6.496786ms)
✔ session environment applies to tool roles without creating state (1.279115ms)
✔ run timeout syncs, status syncs an exit and launch environment excludes the token (2518.50099ms)
✔ readying times out without blocking launch and does not create copies for ordinary sessions (661.519751ms)
✔ worker merge cleanup deletes its copy and stop does not reconcile (584.496296ms)
✔ verifier stop returns immediately and deletes after its apps stop (584.605232ms)
✔ failed copies survive ordinary removal and archive, but verifier and merge removal delete them (2295.183059ms)
✔ archive waits for successful final sync then deletes the copy (910.723586ms)
✔ archive waits once for a final sync and retains a failed copy (523.718791ms)
✔ sweep reconciles a dead lead with no apps (866.847377ms)
✔ sweep marks dead app copies and reconciles a shared thread worktree after a worker registered (1209.98678ms)
✔ tracker close callback marks the copy used (461.778078ms)
✔ sessions sharing a worktree share the copy and Windows tool use triggers stop sync (811.413851ms)
✔ archive deletes copies while retaining conflict refs (933.686386ms)
✔ cleanup removes a vanished linked worktree copy without a reconcile (505.589312ms)
✔ info reports a PowerShell startup failure and environment names are case insensitive (0.48998ms)
ℹ tests 484
ℹ suites 0
ℹ pass 483
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 37992.08011

✖ failing tests:

test at machine/test/kimi.test.js:164:1
✖ new login clears previous result and uses exact target (78.505063ms)
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

Real WSL check, two worktrees with real PowerShell and Git for Windows:

```text
exit 0
info {"wsl":true,"ok":true,"ready":true,"copy_windows":"C:\\Users\\Collin\\AppData\\Local\\Wheelchair\\copies\\real-599943\\f91a04affd5b","copy_linux":"/mnt/c/Users/Collin/AppData/Local/Wheelchair/copies/real-599943/f91a04affd5b","sandboxed":false}
initial sync {"to_windows":[".gitignore","initial"],"to_linux":[],"conflicts":[],"unresolved":[],"skipped":[]}
two-sided sync {"to_windows":["linux-file"],"to_linux":["windows-file"],"conflicts":[],"unresolved":[],"skipped":[]}
round trip linux windows
second info {"wsl":true,"ok":true,"ready":true,"copy_windows":"C:\\Users\\Collin\\AppData\\Local\\Wheelchair\\copies\\real-599943\\4614c57d7210","copy_linux":"/mnt/c/Users/Collin/AppData/Local/Wheelchair/copies/real-599943/4614c57d7210","sandboxed":false}
seed seeded
archive initial {"pending":["wc-real-worker"]}
archive final {"pending":[]}
deleted [true,true]
```

## Attempt 2 — initial result before ownership extension

### Outcome at that point: blocked

The requested real WSL check still fails: the second copy reports ready, but the seeded ignored cache is absent after its first reconcile. A separate diagnostic established that robocopy did copy the cache; the first reconcile snapshots the new copy before its `.gitignore` is present, and the initial checkout then removes that cache. Fixing this requires work outside the brief's seed-script-only ownership of `win-sync.js`; I asked the lead whether to expand ownership or assign it to T1b. The real check stopped before archive and removed its copies and temporary repository. The launch/stop race noted in Attempt 1 also remains open and outside the stated robustness changes.

### Changes

- `machine/lib/win-sync.js`: seed folder arguments trim trailing backslashes, exit explicitly succeeds after robocopy codes 0–7, and report a failure exit code.
- `machine/lib/win.js`: stop idempotence uses the manager's stopped set even if the service already marked the session stopped; the persisted `thread_worktree` flag identifies shared lead/sub-lead copies for sweep.
- `machine/test/fixtures/win/powershell.exe` and `machine/test/win-sync.test.js`: the seed fake checks the generated script and simulates robocopy success and failure codes.
- `machine/test/win.test.js`: covers sandboxed start and info, token exclusion, stopped-status handling and idempotence, dead-app sweep and shared worktree, close notifications, failure cleanup exceptions, both archive outcomes, and the extra unresolved conflict ref.

### Choices

- `machine/test/win.test.js`: intercepted the tracker module only during construction to exercise its close callback while `win-apps.js` is being built in parallel.

### Validation

`node --test machine/test/win.test.js machine/test/win-sync.test.js`:

```text
exit 0
✔ state is persisted and unresolved paths are reported (2.949686ms)
✔ reconcile transfers additions, edits, deletions, renames and independent changes (1595.467818ms)
✔ text conflicts preserve the Windows version and mask markers until resolved (1696.831976ms)
✔ binary and modify/delete conflicts choose Linux and save Windows (947.765039ms)
✔ refuses case collisions and leaves external symlinks out (573.255851ms)
✔ refuses after two changes during apply without losing edits (1090.839793ms)
✔ interrupted Windows apply is resumed after another Linux edit (1176.150588ms)
✔ raw bytes, executable mode, force-added and newly ignored files (1211.856467ms)
✔ seeding copies only ignored paths accepted by the new worktree (756.930906ms)
✔ seeding accepts robocopy success code 1 and reports failure code 8 (987.357917ms)
✔ deleting unresolved copies saves the Windows snapshot and removes copy refs (917.899978ms)
✔ concurrent reconciles for the same copy are serialized (948.775046ms)
✔ interrupted conflict application retains marker masking on the next sync (1254.324112ms)
✔ later force-add, repeated tracked deletion, and successive Windows edits sync (1874.116472ms)
✔ clean checkout LFS and eol attributes do not transform bridge bytes (553.618645ms)
✔ availability, role, session and argument checks are ordered (4.233272ms)
✔ session environment applies to tool roles without creating state (0.873986ms)
✔ run timeout syncs, status syncs an exit and launch environment excludes the token (2231.272852ms)
✔ readying times out without blocking launch and does not create copies for ordinary sessions (709.585929ms)
✔ worker merge cleanup deletes its copy and stop does not reconcile (673.270555ms)
✔ verifier stop returns immediately and deletes after its apps stop (668.04629ms)
✔ failed copies survive ordinary removal and archive, but verifier and merge removal delete them (2781.828936ms)
✔ archive waits for successful final sync then deletes the copy (1030.861778ms)
✔ archive waits once for a final sync and retains a failed copy (671.14167ms)
✔ sweep reconciles a dead lead with no apps (1039.240038ms)
✔ sweep marks dead app copies and reconciles a shared thread worktree after a worker registered (1404.92469ms)
✔ tracker close callback marks the copy used (627.131062ms)
✔ sessions sharing a worktree share the copy and Windows tool use triggers stop sync (963.487436ms)
✔ archive deletes copies while retaining conflict refs (1089.99011ms)
✔ cleanup removes a vanished linked worktree copy without a reconcile (662.145924ms)
✔ info reports a PowerShell startup failure and environment names are case insensitive (0.52116ms)
ℹ tests 31
ℹ suites 0
ℹ pass 31
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 15659.984988
```

`bash machine/test/run.sh` (the known pre-existing Kimi installation failure):

```text
exit 1
✔ required smudge filter failing on Back is interrupted, files recorded and no file deleted (302.830375ms)
✔ re-cloning after a completed Back allows Try (428.353811ms)
✔ tracked path colliding with an ignored file on Back is refused with the file intact (296.110286ms)
✔ Try keeps an ignored directory intact when the thread tracks its path as a file (190.005198ms)
✔ Back keeps an ignored directory intact when the earlier branch tracks its path as a file (321.598078ms)
✔ folder under state worktrees is refused (65.511667ms)
✔ real git am in progress is refused (103.691582ms)
✔ a long switch does not delay the same project agent worktree queue (2161.857313ms)
✔ two symlink spellings of one folder pressed together are refused (1183.37235ms)
✔ index.lock is shown after nothing moved and hidden while a switch runs (208.047914ms)
✔ Status for stale, moved, trying-other and mismatch includes the right fields (262.079109ms)
✔ capped file lists retain full files_count and appeared_count (542.204498ms)
✔ kept entries show missing and old_identity flags (59.249031ms)
✔ Status runs no content filter while active (239.532866ms)
✔ required smudge filter failing on a move between threads records exact interrupted paths (321.019728ms)
✔ real git switch unable to unlink warning is interrupted (184.281104ms)
✔ commit subject containing unable to unlink gives plain success (176.278882ms)
✔ hanging filter subprocess outlives deadline and its whole process group is killed (593.523644ms)
✔ delayed process filter failing after HEAD moved records files across reload (219.112662ms)
✔ parses every operation (1.676112ms)
✔ rejects invalid operations and arguments with 400 (0.924719ms)
✔ detects WSL and its mount root (3.658661ms)
✔ repairs interop without leaking token or mutating the input (0.607872ms)
✔ PowerShell startup failure includes interop guidance (6.528506ms)
✔ gitWin translates a Windows path and runs real git in the copy (133.33943ms)
✔ state is persisted and unresolved paths are reported (6.962144ms)
✔ reconcile transfers additions, edits, deletions, renames and independent changes (1934.863759ms)
✔ text conflicts preserve the Windows version and mask markers until resolved (2010.995137ms)
✔ binary and modify/delete conflicts choose Linux and save Windows (1065.133719ms)
✔ refuses case collisions and leaves external symlinks out (600.346841ms)
✔ refuses after two changes during apply without losing edits (1160.162393ms)
✔ interrupted Windows apply is resumed after another Linux edit (1169.466828ms)
✔ raw bytes, executable mode, force-added and newly ignored files (1221.76426ms)
✔ seeding copies only ignored paths accepted by the new worktree (759.83133ms)
✔ seeding accepts robocopy success code 1 and reports failure code 8 (978.987431ms)
✔ deleting unresolved copies saves the Windows snapshot and removes copy refs (954.423798ms)
✔ concurrent reconciles for the same copy are serialized (983.893885ms)
✔ interrupted conflict application retains marker masking on the next sync (1274.383133ms)
✔ later force-add, repeated tracked deletion, and successive Windows edits sync (1879.329076ms)
✔ clean checkout LFS and eol attributes do not transform bridge bytes (563.326513ms)
✔ availability, role, session and argument checks are ordered (7.005526ms)
✔ session environment applies to tool roles without creating state (1.303575ms)
✔ run timeout syncs, status syncs an exit and launch environment excludes the token (2714.657705ms)
✔ readying times out without blocking launch and does not create copies for ordinary sessions (825.925334ms)
✔ worker merge cleanup deletes its copy and stop does not reconcile (798.462744ms)
✔ verifier stop returns immediately and deletes after its apps stop (727.889839ms)
✔ failed copies survive ordinary removal and archive, but verifier and merge removal delete them (2859.852827ms)
✔ archive waits for successful final sync then deletes the copy (1039.040356ms)
✔ archive waits once for a final sync and retains a failed copy (694.924394ms)
✔ sweep reconciles a dead lead with no apps (1034.394838ms)
✔ sweep marks dead app copies and reconciles a shared thread worktree after a worker registered (1431.289135ms)
✔ tracker close callback marks the copy used (640.531441ms)
✔ sessions sharing a worktree share the copy and Windows tool use triggers stop sync (972.913103ms)
✔ archive deletes copies while retaining conflict refs (1097.827962ms)
✔ cleanup removes a vanished linked worktree copy without a reconcile (691.368424ms)
✔ info reports a PowerShell startup failure and environment names are case insensitive (0.51143ms)
ℹ tests 483
ℹ suites 0
ℹ pass 482
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 38897.263307

✖ failing tests:

test at machine/test/kimi.test.js:164:1
✖ new login clears previous result and uses exact target (92.079334ms)
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

Real WSL check, two worktrees with real PowerShell and Git for Windows:

```text
exit 1
info {"wsl":true,"ok":true,"ready":true,"copy_windows":"C:\\Users\\Collin\\AppData\\Local\\Wheelchair\\copies\\real-551449\\daaa51045f6c","copy_linux":"/mnt/c/Users/Collin/AppData/Local/Wheelchair/copies/real-551449/daaa51045f6c","sandboxed":false}
initial sync {"to_windows":[".gitignore","initial"],"to_linux":[],"conflicts":[],"unresolved":[],"skipped":[]}
two-sided sync {"to_windows":["linux-file"],"to_linux":["windows-file"],"conflicts":[],"unresolved":[],"skipped":[]}
round trip linux windows
second info {"wsl":true,"ok":true,"ready":true,"copy_windows":"C:\\Users\\Collin\\AppData\\Local\\Wheelchair\\copies\\real-551449\\1eeb9692ad84","copy_linux":"/mnt/c/Users/Collin/AppData/Local/Wheelchair/copies/real-551449/1eeb9692ad84","sandboxed":false}
Error: ENOENT: no such file or directory, open '/mnt/c/Users/Collin/AppData/Local/Wheelchair/copies/real-551449/1eeb9692ad84/Library/cache'
    at Object.readFileSync (node:fs:624:20)
    at /tmp/wc-t3b-attempt2/real.js:48:21
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
```

A diagnostic run showed the seed script received `Library/cache`; a second diagnostic observed that file immediately after PowerShell returned and before the first reconcile. It was absent once readying completed. The real-check script and diagnostics live only in scratch space and are not committed.

## Attempt 1

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
