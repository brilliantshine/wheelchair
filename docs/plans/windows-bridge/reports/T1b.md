# T1b — Windows sync fixes

- `machine/lib/win-sync.js`: committed the existing real-index snapshot fix after review and its regression passed. Seeding now collapses ignored directories, filters them in the new worktree, passes a UTF-8 list file to PowerShell, and gives robocopy 30 minutes. Missing base entries now allow regular text add/add conflicts to carry markers.
- `machine/test/fixtures/win/powershell.exe`: read the seed list and copy directories recursively; record the encoded command length when requested.
- `machine/test/win-sync.test.js`: cover 3,000 seed files, a single ignored file, an untracked file, command length, and add/add conflict masking and resolution.

## Choices

- `win-sync.js` seeding: store the temporary list in the new copy's `.git/wheelchair-seed-list` and remove it after PowerShell completes, including on failure.

## Validation

Existing change regression, `node --test --test-name-pattern='a force-tracked ignored file' machine/test/win-sync.test.js`:

```text
exit 0
✔ a force-tracked ignored file survives repeated syncs and edits in both directions (2671.040779ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2723.56224
```

`node --test machine/test/win-env.test.js machine/test/win-sync.test.js`:

```text
exit 0
✔ detects WSL and its mount root (2.902656ms)
✔ repairs interop without leaking token or mutating the input (0.52044ms)
✔ PowerShell startup failure includes interop guidance (4.829163ms)
✔ gitWin translates a Windows path and runs real git in the copy (95.396097ms)
✔ state is persisted and unresolved paths are reported (3.10325ms)
✔ reconcile transfers additions, edits, deletions, renames and independent changes (1483.332847ms)
✔ text conflicts preserve the Windows version and mask markers until resolved (1556.02629ms)
✔ add/add text conflicts hold markers back from Windows until resolved (1522.41025ms)
✔ binary and modify/delete conflicts choose Linux and save Windows (884.924448ms)
✔ refuses case collisions and leaves external symlinks out (534.576654ms)
✔ refuses after two changes during apply without losing edits (995.34565ms)
✔ interrupted Windows apply is resumed after another Linux edit (1081.023176ms)
✔ raw bytes, executable mode, force-added and newly ignored files (1138.713615ms)
✔ seeding copies only ignored paths accepted by the new worktree (735.710411ms)
✔ seeding collapses a large ignored folder and keeps the command short (887.421534ms)
✔ deleting unresolved copies saves the Windows snapshot and removes copy refs (881.142378ms)
✔ concurrent reconciles for the same copy are serialized (913.041682ms)
✔ interrupted conflict application retains marker masking on the next sync (1192.19826ms)
✔ later force-add, repeated tracked deletion, and successive Windows edits sync (1764.856913ms)
✔ clean checkout LFS and eol attributes do not transform bridge bytes (550.061853ms)
✔ a force-tracked ignored file survives repeated syncs and edits in both directions (2682.383279ms)
ℹ tests 21
ℹ suites 0
ℹ pass 21
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 18926.951539
```

`bash machine/test/run.sh` (tail; the sole failure is the known missing Kimi Code installation):

```text
exit 1
✔ Done refused while index.lock exists (192.341915ms)
✔ Done after an interrupted Try with HEAD at the target keeps Switch back (200.215296ms)
✔ Done after an interrupted Back with HEAD at the return branch counts as success (224.720195ms)
✔ Forget during an interrupted switch leaves pending, active and the return pin and last (208.909324ms)
✔ try A then B then back to the original branch (401.207484ms)
✔ a thread that removes an ignore rule: file not counted, back succeeds, file intact (286.978254ms)
✔ files appearing after back are listed (276.454795ms)
✔ a file untracked before and after Back is not in appeared (286.176367ms)
✔ a new file in an originally ignored directory whose rule the thread removed is listed on Back (289.024717ms)
✔ Back refused while pending is set (173.724847ms)
✔ after an interrupted move between threads active is kept (206.953456ms)
✔ return branch deleted or checked out elsewhere is refused (399.924794ms)
✔ stale record: Back refused; Dismiss deletes return pin when its branch contains it, else keeps it (550.031015ms)
✔ folder replaced by another clone during a trial: Dismiss keeps entries marked old identity (195.652658ms)
✔ stale version on back, dismiss and forget is refused (224.71626ms)
✔ required smudge filter failing on Back is interrupted, files recorded and no file deleted (297.562356ms)
✔ re-cloning after a completed Back allows Try (420.959184ms)
✔ tracked path colliding with an ignored file on Back is refused with the file intact (298.782861ms)
✔ Try keeps an ignored directory intact when the thread tracks its path as a file (188.415771ms)
✔ Back keeps an ignored directory intact when the earlier branch tracks its path as a file (309.492517ms)
✔ folder under state worktrees is refused (63.346152ms)
✔ real git am in progress is refused (102.594258ms)
✔ a long switch does not delay the same project agent worktree queue (2140.306492ms)
✔ two symlink spellings of one folder pressed together are refused (1171.738629ms)
✔ index.lock is shown after nothing moved and hidden while a switch runs (207.938859ms)
✔ Status for stale, moved, trying-other and mismatch includes the right fields (260.966812ms)
✔ capped file lists retain full files_count and appeared_count (486.583999ms)
✔ kept entries show missing and old_identity flags (54.824378ms)
✔ Status runs no content filter while active (236.509011ms)
✔ required smudge filter failing on a move between threads records exact interrupted paths (317.97268ms)
✔ real git switch unable to unlink warning is interrupted (185.441085ms)
✔ commit subject containing unable to unlink gives plain success (182.08765ms)
✔ hanging filter subprocess outlives deadline and its whole process group is killed (594.034982ms)
✔ delayed process filter failing after HEAD moved records files across reload (217.29983ms)
✔ detects WSL and its mount root (3.909205ms)
✔ repairs interop without leaking token or mutating the input (0.446279ms)
✔ PowerShell startup failure includes interop guidance (7.280746ms)
✔ gitWin translates a Windows path and runs real git in the copy (124.632745ms)
✔ state is persisted and unresolved paths are reported (4.921914ms)
✔ reconcile transfers additions, edits, deletions, renames and independent changes (1692.587935ms)
✔ text conflicts preserve the Windows version and mask markers until resolved (1665.836003ms)
✔ add/add text conflicts hold markers back from Windows until resolved (1598.427939ms)
✔ binary and modify/delete conflicts choose Linux and save Windows (902.721346ms)
✔ refuses case collisions and leaves external symlinks out (556.55947ms)
✔ refuses after two changes during apply without losing edits (1032.037597ms)
✔ interrupted Windows apply is resumed after another Linux edit (1084.013087ms)
✔ raw bytes, executable mode, force-added and newly ignored files (1128.756582ms)
✔ seeding copies only ignored paths accepted by the new worktree (731.768966ms)
✔ seeding collapses a large ignored folder and keeps the command short (884.983367ms)
✔ deleting unresolved copies saves the Windows snapshot and removes copy refs (880.076223ms)
✔ concurrent reconciles for the same copy are serialized (896.755244ms)
✔ interrupted conflict application retains marker masking on the next sync (1190.144225ms)
✔ later force-add, repeated tracked deletion, and successive Windows edits sync (1748.213271ms)
✔ clean checkout LFS and eol attributes do not transform bridge bytes (534.100183ms)
✔ a force-tracked ignored file survives repeated syncs and edits in both directions (2684.301618ms)
ℹ tests 465
ℹ suites 0
ℹ pass 464
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 37779.522451

✖ failing tests:

test at machine/test/kimi.test.js:164:1
✖ new login clears previous result and uses exact target (99.269151ms)
  Error: Kimi Code is not installed
      at MachineService.startLogin (/home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc-c833faa8e033-w1/machine/service.js:1471:70)
      at TestContext.<anonymous> (/home/gleam/.local/state/wheelchair/worktrees/wheelchair/wc-c833faa8e033-w1/machine/test/kimi.test.js:168:17)
      at Test.runInAsyncScope (node:async_hooks:226:14)
      at Test.run (node:internal/test_runner/test:1402:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:974:18)
      at Test.postRun (node:internal/test_runner/test:1542:19)
      at Test.run (node:internal/test_runner/test:1467:12)
      at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    status: 409
  }
```

Real WSL check, `node /tmp/wc-t1b-logs/real.js` (scratch script not committed):

```text
exit 0
ensureCopy {"created":true,"seeded_from":{"windows":"C:\\Users\\Collin\\AppData\\Local\\Wheelchair\\copies\\t1b-smoke\\6b81edfa6ebc","linux":"/mnt/c/Users/Collin/AppData/Local/Wheelchair/copies/t1b-smoke/6b81edfa6ebc"}}
files arrived 2000
elapsed seconds 2.382
copies deleted true
```
